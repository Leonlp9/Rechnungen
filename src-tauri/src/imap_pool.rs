use std::collections::HashMap;
use std::sync::Mutex;
use imap::Session;
use native_tls::TlsStream;
use std::net::TcpStream;

type ImapSession = Session<TlsStream<TcpStream>>;

#[allow(dead_code)]
pub struct ImapPool {
    pub sessions: Mutex<HashMap<String, (ImapSession, std::time::Instant)>>,
}

#[allow(dead_code)]
const SESSION_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(600);

#[allow(dead_code)]
impl ImapPool {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    /// Entfernt alle Sessions, die das Timeout überschritten haben.
    pub fn evict_expired(&self) {
        let mut sessions = self.sessions.lock().unwrap();
        let expired: Vec<String> = sessions
            .iter()
            .filter(|(_, (_, last_used))| last_used.elapsed() > SESSION_TIMEOUT)
            .map(|(key, _)| key.clone())
            .collect();
        for key in expired {
            if let Some((mut session, _)) = sessions.remove(&key) {
                let _ = session.logout();
            }
        }
    }

    /// Returns an existing session or creates a new one
    pub fn get_or_connect(
        &self,
        account_id: &str,
        host: &str,
        port: u16,
        username: &str,
        password: &str,
    ) -> Result<(), String> {
        // Abgelaufene Sessions vor dem Zugriff bereinigen
        self.evict_expired();

        let mut sessions = self.sessions.lock().unwrap();

        if let Some((session, last_used)) = sessions.get_mut(account_id) {
            match session.noop() {
                Ok(_) => {
                    *last_used = std::time::Instant::now();
                    return Ok(());
                }
                Err(_) => {
                    sessions.remove(account_id);
                }
            }
        }

        // New connection
        let stream = TcpStream::connect((host, port))
            .map_err(|e| format!("TCP-Verbindung fehlgeschlagen: {e}"))?;
        let connector = native_tls::TlsConnector::builder()
            .build()
            .map_err(|e| format!("TLS-Fehler: {e}"))?;
        let tls_stream = connector
            .connect(host, stream)
            .map_err(|e| format!("TLS-Handshake fehlgeschlagen: {e}"))?;
        let client = imap::Client::new(tls_stream);
        let session = client
            .login(username, password)
            .map_err(|(e, _)| format!("IMAP-Login fehlgeschlagen: {e}"))?;

        sessions.insert(account_id.to_string(), (session, std::time::Instant::now()));
        Ok(())
    }

    /// Execute an operation with the session
    pub fn with_session<F, R>(&self, account_id: &str, f: F) -> Result<R, String>
    where
        F: FnOnce(&mut ImapSession) -> Result<R, String>,
    {
        let mut sessions = self.sessions.lock().unwrap();
        let (session, last_used) = sessions
            .get_mut(account_id)
            .ok_or_else(|| "Keine aktive IMAP-Session".to_string())?;
        *last_used = std::time::Instant::now();
        f(session)
    }

    /// Explicitly close a session
    pub fn disconnect(&self, account_id: &str) {
        let mut sessions = self.sessions.lock().unwrap();
        if let Some((mut session, _)) = sessions.remove(account_id) {
            let _ = session.logout();
        }
    }
}

