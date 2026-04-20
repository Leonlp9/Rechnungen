use sha2::{Sha256, Digest};

/// Verifies the integrity of the entire audit log chain
pub fn verify_audit_chain(conn: &rusqlite::Connection) -> Result<bool, String> {
    // Check if the columns exist
    let has_hash_cols = conn.prepare("SELECT entry_hash FROM audit_log LIMIT 0")
        .is_ok();

    if !has_hash_cols {
        // No hash columns yet — chain not set up, consider valid
        return Ok(true);
    }

    let mut stmt = conn.prepare(
        "SELECT prev_hash, entry_hash, timestamp, action, invoice_id, field_name, old_value
         FROM audit_log ORDER BY id ASC"
    ).map_err(|e| e.to_string())?;

    let mut prev_hash = String::new();

    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0).unwrap_or_default(),
            row.get::<_, String>(1).unwrap_or_default(),
            row.get::<_, String>(2).unwrap_or_default(),
            row.get::<_, String>(3).unwrap_or_default(),
            row.get::<_, String>(4).unwrap_or_default(),
            row.get::<_, String>(5).unwrap_or_default(),
            row.get::<_, String>(6).unwrap_or_default(),
        ))
    }).map_err(|e| e.to_string())?;

    for row in rows {
        let (stored_prev, stored_hash, ts, action, entity_id, field_name, details) = row.map_err(|e| e.to_string())?;

        // Skip entries without hashes (pre-migration)
        if stored_hash.is_empty() {
            continue;
        }

        if stored_prev != prev_hash {
            return Ok(false);
        }

        let hash_input = format!("{prev_hash}|{ts}|{action}|invoice:{entity_id}|{field_name}:{details}");
        let mut hasher = Sha256::new();
        hasher.update(hash_input.as_bytes());
        let computed = format!("{:x}", hasher.finalize());

        if computed != stored_hash {
            return Ok(false);
        }

        prev_hash = stored_hash;
    }

    Ok(true)
}

