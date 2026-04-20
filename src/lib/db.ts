import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (db) return db;
  db = await Database.load('sqlite:rechnungen.db');
  await migrate(db);
  return db;
}

async function migrate(db: Database) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      partner TEXT NOT NULL DEFAULT '',
      netto REAL NOT NULL DEFAULT 0,
      ust REAL NOT NULL DEFAULT 0,
      brutto REAL NOT NULL DEFAULT 0,
      type TEXT NOT NULL DEFAULT 'ausgabe',
      currency TEXT NOT NULL DEFAULT 'EUR',
      pdf_path TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS drafts (
      id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      added_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // GoBD-konformer Audit-Trail – unveränderliches Änderungsprotokoll
  await db.execute(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id TEXT NOT NULL,
      action TEXT NOT NULL,
      field_name TEXT,
      old_value TEXT,
      new_value TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      user_note TEXT NOT NULL DEFAULT ''
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_audit_invoice ON audit_log(invoice_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp)`);
}

// --- Drafts ---

export interface DraftRow {
  id: string;
  file_path: string;
  file_name: string;
  added_at: string;
}

export async function getAllDrafts(): Promise<DraftRow[]> {
  const db = await getDb();
  return db.select('SELECT * FROM drafts ORDER BY added_at ASC');
}

export async function insertDraftDb(id: string, filePath: string, fileName: string, addedAt: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    'INSERT OR REPLACE INTO drafts (id, file_path, file_name, added_at) VALUES ($1, $2, $3, $4)',
    [id, filePath, fileName, addedAt]
  );
}

export async function deleteDraftDb(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM drafts WHERE id = $1', [id]);
}

export async function deleteAllDraftsDb(): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM drafts');
}

// --- Invoices ---

export async function getAllInvoices(): Promise<import('@/types').Invoice[]> {
  const db = await getDb();
  return db.select('SELECT * FROM invoices ORDER BY date DESC');
}

export async function getInvoiceById(id: string): Promise<import('@/types').Invoice | undefined> {
  const db = await getDb();
  const rows: import('@/types').Invoice[] = await db.select('SELECT * FROM invoices WHERE id = $1', [id]);
  return rows[0];
}

export async function insertInvoice(inv: import('@/types').Invoice): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO invoices (id, date, year, month, category, description, partner, netto, ust, brutto, type, currency, pdf_path, note, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [inv.id, inv.date, inv.year, inv.month, inv.category, inv.description, inv.partner, inv.netto, inv.ust, inv.brutto, inv.type, inv.currency, inv.pdf_path, inv.note, inv.created_at, inv.updated_at]
  );
  await addAuditLog(inv.id, 'created');
}

export async function updateInvoice(inv: import('@/types').Invoice): Promise<void> {
  const db = await getDb();
  // Log changes before update
  const old = await getInvoiceById(inv.id);
  if (old) await logInvoiceChanges(old, inv);

  await db.execute(
    `UPDATE invoices SET date=$1, year=$2, month=$3, category=$4, description=$5, partner=$6, netto=$7, ust=$8, brutto=$9, type=$10, currency=$11, pdf_path=$12, note=$13, updated_at=$14 WHERE id=$15`,
    [inv.date, inv.year, inv.month, inv.category, inv.description, inv.partner, inv.netto, inv.ust, inv.brutto, inv.type, inv.currency, inv.pdf_path, inv.note, new Date().toISOString(), inv.id]
  );
}

export async function deleteInvoice(id: string): Promise<void> {
  const db = await getDb();
  await addAuditLog(id, 'deleted');
  await db.execute('DELETE FROM invoices WHERE id = $1', [id]);
}

// --- Settings ---

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const rows: { value: string }[] = await db.select('SELECT value FROM settings WHERE key = $1', [key]);
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2`,
    [key, value]
  );
}

// --- Audit Log (GoBD) ---

export interface AuditLogEntry {
  id: number;
  invoice_id: string;
  action: 'created' | 'updated' | 'deleted' | 'restored' | string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  timestamp: string;
  user_note: string;
}

export async function addAuditLog(
  invoiceId: string,
  action: string,
  fieldName?: string | null,
  oldValue?: string | null,
  newValue?: string | null,
  userNote?: string,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO audit_log (invoice_id, action, field_name, old_value, new_value, user_note)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [invoiceId, action, fieldName ?? null, oldValue ?? null, newValue ?? null, userNote ?? ''],
  );
}

export async function getAuditLog(invoiceId: string): Promise<AuditLogEntry[]> {
  const db = await getDb();
  return db.select('SELECT * FROM audit_log WHERE invoice_id = $1 ORDER BY timestamp DESC', [invoiceId]);
}

export async function getFullAuditLog(limit = 200): Promise<AuditLogEntry[]> {
  const db = await getDb();
  return db.select('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT $1', [limit]);
}

/**
 * Loggt alle Feldänderungen zwischen alter und neuer Invoice-Version.
 */
export async function logInvoiceChanges(
  oldInv: import('@/types').Invoice,
  newInv: import('@/types').Invoice,
): Promise<void> {
  const fields: (keyof import('@/types').Invoice)[] = [
    'date', 'category', 'description', 'partner', 'netto', 'ust', 'brutto', 'type', 'currency', 'pdf_path', 'note',
  ];
  for (const f of fields) {
    const ov = String(oldInv[f] ?? '');
    const nv = String(newInv[f] ?? '');
    if (ov !== nv) {
      await addAuditLog(newInv.id, 'updated', f, ov, nv);
    }
  }
}

// --- Rechnungsnummern-Dubletten-Prüfung ---

/**
 * Prüft ob eine Kombination aus Partner + Brutto + Datum bereits existiert.
 * Gibt die IDs der möglichen Dubletten zurück.
 */
export async function findDuplicateInvoices(
  partner: string,
  brutto: number,
  date: string,
  excludeId?: string,
): Promise<import('@/types').Invoice[]> {
  const db = await getDb();
  const query = excludeId
    ? 'SELECT * FROM invoices WHERE partner = $1 AND brutto = $2 AND date = $3 AND id != $4'
    : 'SELECT * FROM invoices WHERE partner = $1 AND brutto = $2 AND date = $3';
  const params = excludeId ? [partner, brutto, date, excludeId] : [partner, brutto, date];
  return db.select(query, params);
}

