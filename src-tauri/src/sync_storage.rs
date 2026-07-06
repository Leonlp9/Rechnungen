// Storage-Backend für den Cloud-Sync.
//
// Grundprinzipien (Korruptionsschutz):
// - Schreibvorgänge sind atomar (temp-Datei + rename) – es gibt nie halb
//   geschriebene Dateien.
// - `if_not_exists`-Modus: bestehende Dateien werden NIEMALS überschrieben
//   (Change-Dateien und Blobs sind append-only / unveränderlich).
// - Relative Pfade werden strikt validiert (kein "..", keine absoluten Pfade).

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde::{Deserialize, Serialize};
use std::io::Read;
use std::path::{Component, Path, PathBuf};

#[derive(Deserialize, Clone)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum StorageConfig {
    Local {
        base: String,
    },
    Webdav {
        url: String,
        username: String,
        password: String,
    },
}

#[derive(Serialize)]
pub struct RemoteEntry {
    pub path: String,
    pub size: u64,
}

/// Validiert einen relativen Sync-Pfad: keine absoluten Pfade, kein "..".
fn validate_rel_path(rel: &str) -> Result<(), String> {
    if rel.is_empty() {
        return Err("Leerer Pfad".into());
    }
    let p = Path::new(rel);
    if p.is_absolute() || rel.contains('\\') || rel.starts_with('/') {
        return Err(format!("Ungültiger Pfad: {rel}"));
    }
    for comp in p.components() {
        match comp {
            Component::Normal(_) => {}
            _ => return Err(format!("Ungültiger Pfad: {rel}")),
        }
    }
    Ok(())
}

// ─── Lokaler Ordner ──────────────────────────────────────────────────────────

fn local_abs(base: &str, rel: &str) -> Result<PathBuf, String> {
    validate_rel_path(rel)?;
    Ok(Path::new(base).join(rel.replace('/', std::path::MAIN_SEPARATOR_STR)))
}

/// Atomares Schreiben: erst in temporäre Datei, dann rename.
fn write_atomic(dest: &Path, data: &[u8], if_not_exists: bool) -> Result<bool, String> {
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Ordner anlegen fehlgeschlagen: {e}"))?;
    }
    if dest.exists() {
        if if_not_exists {
            return Ok(false);
        }
    }
    let tmp = dest.with_extension(format!(
        "tmp-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    ));
    std::fs::write(&tmp, data).map_err(|e| format!("Schreiben fehlgeschlagen: {e}"))?;
    if dest.exists() {
        if if_not_exists {
            let _ = std::fs::remove_file(&tmp);
            return Ok(false);
        }
        // Windows: rename schlägt fehl wenn Ziel existiert
        std::fs::remove_file(dest).map_err(|e| format!("Ersetzen fehlgeschlagen: {e}"))?;
    }
    std::fs::rename(&tmp, dest).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        format!("Umbenennen fehlgeschlagen: {e}")
    })?;
    Ok(true)
}

fn local_list(base: &str, prefix: &str) -> Result<Vec<RemoteEntry>, String> {
    let root = if prefix.is_empty() {
        PathBuf::from(base)
    } else {
        local_abs(base, prefix)?
    };
    let mut out = Vec::new();
    if !root.exists() {
        return Ok(out);
    }
    let base_path = PathBuf::from(base);
    let mut stack = vec![root];
    while let Some(dir) = stack.pop() {
        let entries = std::fs::read_dir(&dir).map_err(|e| format!("Lesen fehlgeschlagen: {e}"))?;
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else if let Ok(meta) = entry.metadata() {
                // Temp-Dateien von abgebrochenen Schreibvorgängen ignorieren
                if path.extension().map(|e| e.to_string_lossy().starts_with("tmp-")).unwrap_or(false) {
                    continue;
                }
                if let Ok(rel) = path.strip_prefix(&base_path) {
                    out.push(RemoteEntry {
                        path: rel.to_string_lossy().replace('\\', "/"),
                        size: meta.len(),
                    });
                }
            }
        }
    }
    Ok(out)
}

// ─── WebDAV ──────────────────────────────────────────────────────────────────

fn dav_auth(username: &str, password: &str) -> String {
    format!("Basic {}", B64.encode(format!("{username}:{password}")))
}

/// Basis-URL + relativer Pfad, jedes Segment einzeln percent-encoded.
fn dav_url(base: &str, rel: &str) -> Result<String, String> {
    if !rel.is_empty() {
        validate_rel_path(rel)?;
    }
    let mut url = base.trim_end_matches('/').to_string();
    for seg in rel.split('/').filter(|s| !s.is_empty()) {
        url.push('/');
        url.push_str(&urlencoding::encode(seg));
    }
    Ok(url)
}

/// URL-Pfad-Anteil der Basis-URL (percent-dekodiert), für href-Vergleiche.
fn dav_base_path(base: &str) -> String {
    let no_scheme = base
        .trim_end_matches('/')
        .splitn(2, "://")
        .nth(1)
        .unwrap_or(base);
    let path = match no_scheme.find('/') {
        Some(i) => &no_scheme[i..],
        None => "/",
    };
    urlencoding::decode(path).map(|s| s.into_owned()).unwrap_or_else(|_| path.to_string())
}

fn dav_agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(120))
        .build()
}

const PROPFIND_BODY: &str = r#"<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getcontentlength/></d:prop></d:propfind>"#;

/// Listet ein einzelnes Verzeichnis (Depth 1). Gibt (Dateien, Unterordner) zurück.
fn dav_list_dir(
    agent: &ureq::Agent,
    base: &str,
    auth: &str,
    dir_rel: &str,
) -> Result<(Vec<RemoteEntry>, Vec<String>), String> {
    let url = dav_url(base, dir_rel)?;
    let res = agent
        .request("PROPFIND", &url)
        .set("Authorization", auth)
        .set("Depth", "1")
        .set("Content-Type", "application/xml")
        .send_string(PROPFIND_BODY);

    let res = match res {
        Ok(r) => r,
        Err(ureq::Error::Status(404, _)) => return Ok((Vec::new(), Vec::new())),
        Err(e) => return Err(format!("WebDAV PROPFIND fehlgeschlagen: {e}")),
    };

    let xml = res
        .into_string()
        .map_err(|e| format!("WebDAV-Antwort unlesbar: {e}"))?;
    let doc = roxmltree::Document::parse(&xml)
        .map_err(|e| format!("WebDAV-XML ungültig: {e}"))?;

    let base_path = dav_base_path(base);
    let self_path = if dir_rel.is_empty() {
        base_path.clone()
    } else {
        format!("{}/{}", base_path.trim_end_matches('/'), dir_rel)
    };

    let mut files = Vec::new();
    let mut dirs = Vec::new();

    for resp in doc
        .descendants()
        .filter(|n| n.has_tag_name(("DAV:", "response")))
    {
        let href_raw = resp
            .descendants()
            .find(|n| n.has_tag_name(("DAV:", "href")))
            .and_then(|n| n.text())
            .unwrap_or("");
        let href = urlencoding::decode(href_raw)
            .map(|s| s.into_owned())
            .unwrap_or_else(|_| href_raw.to_string());
        let href_trim = href.trim_end_matches('/');

        // Eintrag für das angefragte Verzeichnis selbst überspringen
        if href_trim == self_path.trim_end_matches('/') {
            continue;
        }

        let is_dir = resp
            .descendants()
            .any(|n| n.has_tag_name(("DAV:", "collection")));

        let rel = match href_trim.strip_prefix(&format!("{}/", base_path.trim_end_matches('/'))) {
            Some(r) => r.to_string(),
            None => continue,
        };

        if is_dir {
            dirs.push(rel);
        } else {
            let size = resp
                .descendants()
                .find(|n| n.has_tag_name(("DAV:", "getcontentlength")))
                .and_then(|n| n.text())
                .and_then(|t| t.parse::<u64>().ok())
                .unwrap_or(0);
            files.push(RemoteEntry { path: rel, size });
        }
    }
    Ok((files, dirs))
}

fn dav_list(base: &str, auth: &str, prefix: &str) -> Result<Vec<RemoteEntry>, String> {
    let agent = dav_agent();
    let mut out = Vec::new();
    let mut stack = vec![prefix.trim_end_matches('/').to_string()];
    while let Some(dir) = stack.pop() {
        let (files, dirs) = dav_list_dir(&agent, base, auth, &dir)?;
        out.extend(files);
        stack.extend(dirs);
    }
    Ok(out)
}

fn dav_read(base: &str, auth: &str, rel: &str) -> Result<Option<Vec<u8>>, String> {
    let agent = dav_agent();
    let url = dav_url(base, rel)?;
    let res = agent.get(&url).set("Authorization", auth).call();
    match res {
        Ok(r) => {
            let mut buf = Vec::new();
            r.into_reader()
                .take(512 * 1024 * 1024)
                .read_to_end(&mut buf)
                .map_err(|e| format!("WebDAV-Download fehlgeschlagen: {e}"))?;
            Ok(Some(buf))
        }
        Err(ureq::Error::Status(404, _)) => Ok(None),
        Err(e) => Err(format!("WebDAV GET fehlgeschlagen: {e}")),
    }
}

/// Legt alle Eltern-Collections an (MKCOL). Bereits vorhandene sind ok (405).
fn dav_mkdirs(agent: &ureq::Agent, base: &str, auth: &str, rel: &str) -> Result<(), String> {
    let parts: Vec<&str> = rel.split('/').collect();
    if parts.len() <= 1 {
        return Ok(());
    }
    let mut current = String::new();
    for seg in &parts[..parts.len() - 1] {
        if !current.is_empty() {
            current.push('/');
        }
        current.push_str(seg);
        let url = dav_url(base, &current)?;
        match agent.request("MKCOL", &url).set("Authorization", auth).call() {
            Ok(_) => {}
            // 405 = existiert bereits, 409 kann bei parallelem Anlegen auftreten
            Err(ureq::Error::Status(405, _)) | Err(ureq::Error::Status(409, _)) => {}
            Err(e) => return Err(format!("WebDAV MKCOL fehlgeschlagen: {e}")),
        }
    }
    Ok(())
}

fn dav_exists(agent: &ureq::Agent, base: &str, auth: &str, rel: &str) -> Result<bool, String> {
    let url = dav_url(base, rel)?;
    match agent
        .request("PROPFIND", &url)
        .set("Authorization", auth)
        .set("Depth", "0")
        .send_string(PROPFIND_BODY)
    {
        Ok(_) => Ok(true),
        Err(ureq::Error::Status(404, _)) => Ok(false),
        Err(e) => Err(format!("WebDAV-Prüfung fehlgeschlagen: {e}")),
    }
}

fn dav_write(base: &str, auth: &str, rel: &str, data: &[u8], if_not_exists: bool) -> Result<bool, String> {
    let agent = dav_agent();
    dav_mkdirs(&agent, base, auth, rel)?;
    let url = dav_url(base, rel)?;

    let mut req = agent
        .put(&url)
        .set("Authorization", auth)
        .set("Content-Type", "application/octet-stream");
    if if_not_exists {
        // Verhindert serverseitig das Überschreiben bestehender Dateien
        req = req.set("If-None-Match", "*");
    }
    match req.send_bytes(data) {
        Ok(_) => Ok(true),
        Err(ureq::Error::Status(412, _)) if if_not_exists => Ok(false),
        // Fallback für Server ohne If-None-Match-Unterstützung
        Err(ureq::Error::Status(501, _)) | Err(ureq::Error::Status(400, _)) if if_not_exists => {
            if dav_exists(&agent, base, auth, rel)? {
                return Ok(false);
            }
            let req2 = agent
                .put(&url)
                .set("Authorization", auth)
                .set("Content-Type", "application/octet-stream");
            req2.send_bytes(data)
                .map_err(|e| format!("WebDAV PUT fehlgeschlagen: {e}"))?;
            Ok(true)
        }
        Err(e) => Err(format!("WebDAV PUT fehlgeschlagen: {e}")),
    }
}

// ─── Tauri-Commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn sync_storage_list(config: StorageConfig, prefix: String) -> Result<Vec<RemoteEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || match &config {
        StorageConfig::Local { base } => local_list(base, &prefix),
        StorageConfig::Webdav { url, username, password } => {
            dav_list(url, &dav_auth(username, password), &prefix)
        }
    })
    .await
    .map_err(|e| format!("Task-Fehler: {e}"))?
}

#[tauri::command]
pub async fn sync_storage_read(config: StorageConfig, path: String) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let bytes = match &config {
            StorageConfig::Local { base } => {
                let abs = local_abs(base, &path)?;
                if !abs.exists() {
                    None
                } else {
                    Some(std::fs::read(&abs).map_err(|e| format!("Lesen fehlgeschlagen: {e}"))?)
                }
            }
            StorageConfig::Webdav { url, username, password } => {
                dav_read(url, &dav_auth(username, password), &path)?
            }
        };
        Ok(bytes.map(|b| B64.encode(b)))
    })
    .await
    .map_err(|e| format!("Task-Fehler: {e}"))?
}

/// Schreibt eine Datei. Bei `if_not_exists=true` wird eine bestehende Datei
/// NIE überschrieben – Rückgabe `false` bedeutet "existierte bereits".
#[tauri::command]
pub async fn sync_storage_write(
    config: StorageConfig,
    path: String,
    data_b64: String,
    if_not_exists: bool,
) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let data = B64
            .decode(&data_b64)
            .map_err(|e| format!("Base64-Fehler: {e}"))?;
        match &config {
            StorageConfig::Local { base } => {
                let abs = local_abs(base, &path)?;
                write_atomic(&abs, &data, if_not_exists)
            }
            StorageConfig::Webdav { url, username, password } => {
                dav_write(url, &dav_auth(username, password), &path, &data, if_not_exists)
            }
        }
    })
    .await
    .map_err(|e| format!("Task-Fehler: {e}"))?
}

#[tauri::command]
pub async fn sync_storage_exists(config: StorageConfig, path: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || match &config {
        StorageConfig::Local { base } => Ok(local_abs(base, &path)?.exists()),
        StorageConfig::Webdav { url, username, password } => {
            dav_exists(&dav_agent(), url, &dav_auth(username, password), &path)
        }
    })
    .await
    .map_err(|e| format!("Task-Fehler: {e}"))?
}
