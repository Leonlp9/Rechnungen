use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct ImapAttachmentData {
    pub id: String,
    pub filename: String,
    #[serde(rename = "mimeType")]
    pub mime_type: String,
    pub size: u64,
    #[serde(rename = "dataBase64")]
    pub data_base64: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct ImapMessageSummary {
    pub id: String,
    #[serde(rename = "threadId")]
    pub thread_id: String,
    pub from: String,
    pub subject: String,
    pub date: String,
    pub snippet: String,
    #[serde(rename = "bodyHtml")]
    pub body_html: String,
    #[serde(rename = "bodyText")]
    pub body_text: String,
    pub attachments: Vec<ImapAttachmentData>,
    #[serde(rename = "hasAttachment")]
    pub has_attachment: bool,
    #[serde(rename = "isUnread")]
    pub is_unread: bool,
}

pub fn imap_connect(
    host: &str,
    port: u16,
    username: &str,
    password: &str,
) -> Result<imap::Session<native_tls::TlsStream<std::net::TcpStream>>, String> {
    let stream = std::net::TcpStream::connect((host, port))
        .map_err(|e| format!("TCP-Verbindung fehlgeschlagen: {e}"))?;
    let connector = native_tls::TlsConnector::builder()
        .build()
        .map_err(|e| format!("TLS-Fehler: {e}"))?;
    let tls_stream = connector
        .connect(host, stream)
        .map_err(|e| format!("TLS-Handshake fehlgeschlagen: {e}"))?;
    let client = imap::Client::new(tls_stream);
    client
        .login(username, password)
        .map_err(|(e, _)| format!("Anmeldefehler: {e}"))
}

pub fn extract_mime_parts(
    part: &mailparse::ParsedMail,
    html: &mut String,
    text: &mut String,
    attachments: &mut Vec<ImapAttachmentData>,
) {
    use mailparse::MailHeaderMap;
    let mime = part.ctype.mimetype.to_lowercase();
    if !part.subparts.is_empty() {
        for sub in &part.subparts {
            extract_mime_parts(sub, html, text, attachments);
        }
        return;
    }
    let is_attachment = part
        .headers
        .get_first_value("Content-Disposition")
        .unwrap_or_default()
        .to_lowercase()
        .starts_with("attachment");
    if is_attachment || part.ctype.params.contains_key("name") {
        if let Ok(raw) = part.get_body_raw() {
            let filename = part
                .ctype
                .params
                .get("name")
                .cloned()
                .unwrap_or_else(|| "anhang".to_string());
            let id = filename.clone();
            let size = raw.len() as u64;
            attachments.push(ImapAttachmentData {
                id,
                filename,
                mime_type: mime.clone(),
                size,
                data_base64: BASE64.encode(&raw),
            });
        }
        return;
    }
    if let Ok(body) = part.get_body() {
        if mime == "text/html" && html.is_empty() {
            *html = body;
        } else if mime == "text/plain" && text.is_empty() {
            *text = body;
        }
    }
}

pub fn parse_imap_message(uid: u32, raw: &[u8], is_unread: bool) -> ImapMessageSummary {
    use mailparse::MailHeaderMap;
    match mailparse::parse_mail(raw) {
        Ok(parsed) => {
            let from = parsed.headers.get_first_value("From").unwrap_or_default();
            let subject = parsed.headers.get_first_value("Subject").unwrap_or_default();
            let date = parsed.headers.get_first_value("Date").unwrap_or_default();
            let mut html = String::new();
            let mut text = String::new();
            let mut attachments: Vec<ImapAttachmentData> = Vec::new();
            extract_mime_parts(&parsed, &mut html, &mut text, &mut attachments);
            let snippet: String = text.chars().take(200).collect();
            let has_attachment = !attachments.is_empty();
            ImapMessageSummary {
                id: uid.to_string(),
                thread_id: uid.to_string(),
                from,
                subject,
                date,
                snippet,
                body_html: html,
                body_text: text,
                attachments,
                has_attachment,
                is_unread,
            }
        }
        Err(_) => ImapMessageSummary {
            id: uid.to_string(),
            thread_id: uid.to_string(),
            from: String::new(),
            subject: String::new(),
            date: String::new(),
            snippet: String::new(),
            body_html: String::new(),
            body_text: String::new(),
            attachments: vec![],
            has_attachment: false,
            is_unread,
        },
    }
}

#[tauri::command]
pub async fn imap_fetch_emails(
    host: String,
    port: u16,
    username: String,
    password: String,
    page: u32,
    folder: Option<String>,
) -> Result<(Vec<ImapMessageSummary>, bool), String> {
    tokio::task::spawn_blocking(move || {
        let folder_name = folder.as_deref().unwrap_or("INBOX");
        let mut session = imap_connect(&host, port, &username, &password)?;

        if folder_name.eq_ignore_ascii_case("FLAGGED") {
            session
                .select("INBOX")
                .map_err(|e| format!("INBOX auswählen fehlgeschlagen: {e}"))?;
            let uids = session
                .search("FLAGGED")
                .map_err(|e| format!("Suche fehlgeschlagen: {e}"))?;
            let mut uid_list: Vec<u32> = uids.into_iter().collect();
            uid_list.sort_unstable_by(|a, b| b.cmp(a));
            let page_size = 30usize;
            let offset = ((page - 1) as usize) * page_size;
            let has_more = uid_list.len() > offset + page_size;
            let slice = &uid_list[offset.min(uid_list.len())..];
            let slice = &slice[..slice.len().min(page_size)];
            if slice.is_empty() {
                let _ = session.logout();
                return Ok((vec![], false));
            }
            let uid_str = slice
                .iter()
                .map(|u| u.to_string())
                .collect::<Vec<_>>()
                .join(",");
            let fetches = session
                .uid_fetch(&uid_str, "(UID FLAGS BODY.PEEK[])")
                .map_err(|e| format!("Fetch fehlgeschlagen: {e}"))?;
            let mut messages: Vec<ImapMessageSummary> = Vec::new();
            for fetch in fetches.iter() {
                let uid = fetch.uid.unwrap_or(fetch.message);
                let is_unread =
                    !fetch.flags().iter().any(|f| matches!(f, imap::types::Flag::Seen));
                if let Some(raw) = fetch.body() {
                    let mut msg = parse_imap_message(uid, raw, is_unread);
                    for att in &mut msg.attachments {
                        att.data_base64 = String::new();
                    }
                    messages.push(msg);
                }
            }
            messages.sort_unstable_by(|a, b| b.id.cmp(&a.id));
            let _ = session.logout();
            return Ok((messages, has_more));
        }

        let mailbox = session.select(folder_name).map_err(|e| {
            format!("Ordner '{}' auswählen fehlgeschlagen: {e}", folder_name)
        })?;
        let total = mailbox.exists;
        if total == 0 {
            let _ = session.logout();
            return Ok((vec![], false));
        }
        let page_size = 30u32;
        let offset = (page - 1) * page_size;
        if offset >= total {
            let _ = session.logout();
            return Ok((vec![], false));
        }
        let end = total - offset;
        let start = if end > page_size { end - page_size + 1 } else { 1 };
        let has_more = start > 1;

        let range = format!("{}:{}", start, end);
        let fetches = session
            .fetch(&range, "(UID FLAGS BODY.PEEK[])")
            .map_err(|e| format!("Fetch fehlgeschlagen: {e}"))?;

        let mut messages: Vec<ImapMessageSummary> = Vec::new();
        for fetch in fetches.iter() {
            let uid = fetch.uid.unwrap_or(fetch.message);
            let is_unread = !fetch
                .flags()
                .iter()
                .any(|f| matches!(f, imap::types::Flag::Seen));
            if let Some(raw) = fetch.body() {
                let mut msg = parse_imap_message(uid, raw, is_unread);
                for att in &mut msg.attachments {
                    att.data_base64 = String::new();
                }
                messages.push(msg);
            }
        }
        messages.reverse();
        let _ = session.logout();
        Ok((messages, has_more))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn imap_fetch_email_detail(
    host: String,
    port: u16,
    username: String,
    password: String,
    uid: String,
    folder: Option<String>,
) -> Result<ImapMessageSummary, String> {
    tokio::task::spawn_blocking(move || {
        let folder_name = folder.as_deref().unwrap_or("INBOX");
        let folder_name = if folder_name.eq_ignore_ascii_case("FLAGGED") {
            "INBOX"
        } else {
            folder_name
        };
        let mut session = imap_connect(&host, port, &username, &password)?;
        session
            .select(folder_name)
            .map_err(|e| format!("Ordner auswählen fehlgeschlagen: {e}"))?;
        let fetches = session
            .uid_fetch(&uid, "(UID FLAGS BODY.PEEK[])")
            .map_err(|e| format!("Fetch fehlgeschlagen: {e}"))?;
        let fetch = fetches.iter().next().ok_or("Nachricht nicht gefunden")?;
        let uid_num = fetch.uid.unwrap_or(fetch.message);
        let is_unread = !fetch
            .flags()
            .iter()
            .any(|f| matches!(f, imap::types::Flag::Seen));
        let raw = fetch.body().ok_or("Kein Nachrichteninhalt")?;
        let msg = parse_imap_message(uid_num, raw, is_unread);
        let _ = session.logout();
        Ok(msg)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn imap_mark_read(
    host: String,
    port: u16,
    username: String,
    password: String,
    uid: String,
    folder: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let folder_name = folder.as_deref().unwrap_or("INBOX");
        let folder_name = if folder_name.eq_ignore_ascii_case("FLAGGED") {
            "INBOX"
        } else {
            folder_name
        };
        let mut session = imap_connect(&host, port, &username, &password)?;
        session
            .select(folder_name)
            .map_err(|e| format!("Ordner auswählen fehlgeschlagen: {e}"))?;
        session
            .uid_store(&uid, "+FLAGS (\\Seen)")
            .map_err(|e| format!("Markieren fehlgeschlagen: {e}"))?;
        let _ = session.logout();
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn imap_delete_email(
    host: String,
    port: u16,
    username: String,
    password: String,
    uid: String,
    folder: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let folder_name = folder.as_deref().unwrap_or("INBOX");
        let folder_name = if folder_name.eq_ignore_ascii_case("FLAGGED") {
            "INBOX"
        } else {
            folder_name
        };
        let mut session = imap_connect(&host, port, &username, &password)?;
        session
            .select(folder_name)
            .map_err(|e| format!("Ordner auswählen fehlgeschlagen: {e}"))?;
        session
            .uid_store(&uid, "+FLAGS (\\Deleted)")
            .map_err(|e| format!("Löschen fehlgeschlagen: {e}"))?;
        session
            .expunge()
            .map_err(|e| format!("Expunge fehlgeschlagen: {e}"))?;
        let _ = session.logout();
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn imap_mark_unread(
    host: String,
    port: u16,
    username: String,
    password: String,
    uid: String,
    folder: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let folder_name = folder.as_deref().unwrap_or("INBOX");
        let folder_name = if folder_name.eq_ignore_ascii_case("FLAGGED") {
            "INBOX"
        } else {
            folder_name
        };
        let mut session = imap_connect(&host, port, &username, &password)?;
        session
            .select(folder_name)
            .map_err(|e| format!("Ordner auswählen fehlgeschlagen: {e}"))?;
        session
            .uid_store(&uid, "-FLAGS (\\Seen)")
            .map_err(|e| format!("Als ungelesen markieren fehlgeschlagen: {e}"))?;
        let _ = session.logout();
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn imap_toggle_flag(
    host: String,
    port: u16,
    username: String,
    password: String,
    uid: String,
    flagged: bool,
    folder: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let folder_name = folder.as_deref().unwrap_or("INBOX");
        let folder_name = if folder_name.eq_ignore_ascii_case("FLAGGED") {
            "INBOX"
        } else {
            folder_name
        };
        let mut session = imap_connect(&host, port, &username, &password)?;
        session
            .select(folder_name)
            .map_err(|e| format!("Ordner auswählen fehlgeschlagen: {e}"))?;
        let flag_op = if flagged {
            "+FLAGS (\\Flagged)"
        } else {
            "-FLAGS (\\Flagged)"
        };
        session
            .uid_store(&uid, flag_op)
            .map_err(|e| format!("Flag-Änderung fehlgeschlagen: {e}"))?;
        let _ = session.logout();
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn smtp_send_email(
    smtp_host: String,
    smtp_port: u16,
    username: String,
    password: String,
    from: String,
    to: String,
    subject: String,
    body_html: String,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        use lettre::message::{header, MultiPart, SinglePart};
        use lettre::transport::smtp::authentication::Credentials;
        use lettre::{Message, Transport};

        let body_text = {
            let mut s = body_html.clone();
            for tag in &["<br>", "<br/>", "<br />", "</p>", "</div>", "</li>", "</tr>"] {
                s = s.replace(tag, "\n");
            }
            let mut result = String::with_capacity(s.len());
            let mut in_tag = false;
            for ch in s.chars() {
                match ch {
                    '<' => in_tag = true,
                    '>' => in_tag = false,
                    _ if !in_tag => result.push(ch),
                    _ => {}
                }
            }
            result = result
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .replace("&nbsp;", " ");
            result
        };

        let email = Message::builder()
            .from(
                from.parse()
                    .map_err(|e: lettre::address::AddressError| e.to_string())?,
            )
            .to(to
                .parse()
                .map_err(|e: lettre::address::AddressError| e.to_string())?)
            .subject(&subject)
            .multipart(
                MultiPart::alternative()
                    .singlepart(
                        SinglePart::builder()
                            .header(header::ContentType::TEXT_PLAIN)
                            .body(body_text),
                    )
                    .singlepart(
                        SinglePart::builder()
                            .header(header::ContentType::TEXT_HTML)
                            .body(body_html),
                    ),
            )
            .map_err(|e| e.to_string())?;

        let creds = Credentials::new(username.clone(), password.clone());

        if smtp_port == 465 {
            let mailer = lettre::SmtpTransport::relay(&smtp_host)
                .map_err(|e| e.to_string())?
                .credentials(creds)
                .build();
            mailer.send(&email).map_err(|e| e.to_string())?;
        } else {
            let mailer = lettre::SmtpTransport::starttls_relay(&smtp_host)
                .map_err(|e| e.to_string())?
                .port(smtp_port)
                .credentials(creds)
                .build();
            mailer.send(&email).map_err(|e| e.to_string())?;
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

