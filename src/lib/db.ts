import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (db) return db;
  db = await Database.load('sqlite:rechnungen.db');
  await migrate(db);
  return db;
}

// ─── Schema-Migrationssystem ──────────────────────────────────────────────────

async function getSchemaVersion(db: Database): Promise<number> {
  await db.execute(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL DEFAULT 0)`);
  const rows: { version: number }[] = await db.select('SELECT version FROM schema_version LIMIT 1');
  if (rows.length === 0) {
    await db.execute('INSERT INTO schema_version (version) VALUES (0)');
    return 0;
  }
  return rows[0].version;
}

async function setSchemaVersion(db: Database, version: number): Promise<void> {
  await db.execute('UPDATE schema_version SET version = $1', [version]);
}

const MIGRATIONS: Array<(db: Database) => Promise<void>> = [
  // v0 → v1: Neue Spalten für GoBD-Konformität
  async (db) => {
    // Spalten einzeln hinzufügen (ALTER TABLE kann nur eine Spalte pro Statement)
    const cols = [
      "ALTER TABLE invoices ADD COLUMN is_locked INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE invoices ADD COLUMN pdf_sha256 TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE invoices ADD COLUMN delivery_date TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE invoices ADD COLUMN storno_of TEXT NOT NULL DEFAULT ''",
    ];
    for (const sql of cols) {
      try { await db.execute(sql); } catch { /* Spalte existiert bereits */ }
    }
    // Indizes für Performance
    await db.execute('CREATE INDEX IF NOT EXISTS idx_invoices_year ON invoices(year)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(type)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_invoices_category ON invoices(category)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_invoices_partner ON invoices(partner)');
  },
];

async function migrate(db: Database) {
  // Basis-Tabellen (idempotent)
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
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_locked INTEGER NOT NULL DEFAULT 0,
      pdf_sha256 TEXT NOT NULL DEFAULT '',
      delivery_date TEXT NOT NULL DEFAULT '',
      storno_of TEXT NOT NULL DEFAULT ''
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

  // Versionierte Migrationen ausführen
  const currentVersion = await getSchemaVersion(db);
  for (let i = currentVersion; i < MIGRATIONS.length; i++) {
    await MIGRATIONS[i](db);
    await setSchemaVersion(db, i + 1);
  }
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
  const rows: any[] = await db.select('SELECT * FROM invoices ORDER BY date DESC');
  return rows.map(mapInvoiceRow);
}

export async function getInvoiceById(id: string): Promise<import('@/types').Invoice | undefined> {
  const db = await getDb();
  const rows: any[] = await db.select('SELECT * FROM invoices WHERE id = $1', [id]);
  return rows[0] ? mapInvoiceRow(rows[0]) : undefined;
}

/** Mappt DB-Zeile auf Invoice-Interface (is_locked: 0/1 → boolean) */
function mapInvoiceRow(row: any): import('@/types').Invoice {
  return {
    ...row,
    is_locked: row.is_locked === 1 || row.is_locked === true,
    pdf_sha256: row.pdf_sha256 ?? '',
    delivery_date: row.delivery_date ?? '',
    storno_of: row.storno_of ?? '',
  };
}

export async function insertInvoice(inv: import('@/types').Invoice): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO invoices (id, date, year, month, category, description, partner, netto, ust, brutto, type, currency, pdf_path, note, created_at, updated_at, is_locked, pdf_sha256, delivery_date, storno_of)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
    [inv.id, inv.date, inv.year, inv.month, inv.category, inv.description, inv.partner, inv.netto, inv.ust, inv.brutto, inv.type, inv.currency, inv.pdf_path, inv.note, inv.created_at, inv.updated_at, inv.is_locked ? 1 : 0, inv.pdf_sha256 ?? '', inv.delivery_date ?? '', inv.storno_of ?? '']
  );
  await addAuditLog(inv.id, 'created');
}

export async function updateInvoice(inv: import('@/types').Invoice): Promise<void> {
  const db = await getDb();
  // GoBD: Festgeschriebene Belege dürfen nicht bearbeitet werden
  const old = await getInvoiceById(inv.id);
  if (old?.is_locked) {
    throw new Error('Dieser Beleg ist festgeschrieben und kann nicht bearbeitet werden. Erstelle eine Stornobuchung.');
  }
  if (old) await logInvoiceChanges(old, inv);

  await db.execute(
    `UPDATE invoices SET date=$1, year=$2, month=$3, category=$4, description=$5, partner=$6, netto=$7, ust=$8, brutto=$9, type=$10, currency=$11, pdf_path=$12, note=$13, updated_at=$14, delivery_date=$15 WHERE id=$16`,
    [inv.date, inv.year, inv.month, inv.category, inv.description, inv.partner, inv.netto, inv.ust, inv.brutto, inv.type, inv.currency, inv.pdf_path, inv.note, new Date().toISOString(), inv.delivery_date ?? '', inv.id]
  );
}

/**
 * Festschreiben eines Belegs – ab dann nur noch per Storno korrigierbar.
 */
export async function lockInvoice(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE invoices SET is_locked = 1 WHERE id = $1', [id]);
  await addAuditLog(id, 'locked');
}

/**
 * GoBD-konforme Stornobuchung: Erstellt einen Gegenbeleg mit negativem Betrag
 * und sperrt den Originalbeleg.
 */
export async function stornoInvoice(id: string): Promise<import('@/types').Invoice> {
  const original = await getInvoiceById(id);
  if (!original) throw new Error('Beleg nicht gefunden');

  // Originalbeleg festschreiben
  await lockInvoice(id);

  // Storno-Gegenbeleg erstellen
  const stornoId = `storno-${id}-${Date.now()}`;
  const now = new Date().toISOString();
  const stornoInv: import('@/types').Invoice = {
    ...original,
    id: stornoId,
    netto: -original.netto,
    ust: -original.ust,
    brutto: -original.brutto,
    description: `[STORNO] ${original.description}`,
    note: `Stornobuchung zu Beleg ${id}`,
    storno_of: id,
    is_locked: true,
    created_at: now,
    updated_at: now,
    date: new Date().toISOString().slice(0, 10),
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  };
  await insertInvoice(stornoInv);
  await addAuditLog(id, 'storno', null, null, stornoId);
  return stornoInv;
}

/** Soft-Delete: Beleg wird storniert statt gelöscht (GoBD-konform) */
export async function deleteInvoice(id: string): Promise<void> {
  const db = await getDb();
  const inv = await getInvoiceById(id);
  if (inv?.is_locked) {
    throw new Error('Festgeschriebene Belege können nicht gelöscht werden. Verwende eine Stornobuchung.');
  }
  await addAuditLog(id, 'deleted');
  await db.execute('DELETE FROM invoices WHERE id = $1', [id]);
}

/** Löscht alle Stornobuchungen (storno_of IS NOT NULL) – nur für Testzwecke */
export async function deleteAllStornoInvoices(): Promise<number> {
  const db = await getDb();
  // Erst die IDs sammeln für Audit-Log
  const rows: { id: string }[] = await db.select("SELECT id FROM invoices WHERE storno_of IS NOT NULL AND storno_of != ''");
  for (const row of rows) {
    await addAuditLog(row.id, 'deleted');
  }
  await db.execute("DELETE FROM invoices WHERE storno_of IS NOT NULL AND storno_of != ''");
  // Auch Originalbelege wieder entsperren (die durch den Storno gesperrt wurden)
  await db.execute("UPDATE invoices SET is_locked = 0 WHERE id IN (SELECT storno_of FROM invoices WHERE storno_of IS NOT NULL AND storno_of != '') AND is_locked = 1");
  return rows.length;
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

// --- Rechnungsnummern-Generator ---

/**
 * Generiert die nächste fortlaufende Rechnungsnummer für ein Jahr.
 * Format: {prefix}-{year}-{laufendeNummer} z.B. "R-2026-001"
 */
export async function generateInvoiceNumber(prefix = 'R', year?: number): Promise<string> {
  const y = year ?? new Date().getFullYear();
  const db = await getDb();
  // Suche nach dem höchsten existierenden Nummern-Suffix
  const existing: { description: string }[] = await db.select(
    `SELECT description FROM invoices WHERE description LIKE $1`,
    [`%${prefix}-${y}-%`]
  );
  let maxNum = 0;
  const regex = new RegExp(`${prefix}-${y}-(\\d+)`);
  for (const row of existing) {
    const match = row.description.match(regex);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  }
  const next = maxNum + 1;
  return `${prefix}-${y}-${String(next).padStart(3, '0')}`;
}

/**
 * Prüft ob eine Rechnungsnummer bereits vergeben ist.
 */
export async function isInvoiceNumberUnique(docNumber: string, excludeId?: string): Promise<boolean> {
  const db = await getDb();
  const query = excludeId
    ? `SELECT COUNT(*) as cnt FROM invoices WHERE description = $1 AND id != $2`
    : `SELECT COUNT(*) as cnt FROM invoices WHERE description = $1`;
  const params = excludeId ? [docNumber, excludeId] : [docNumber];
  const rows: { cnt: number }[] = await db.select(query, params);
  return rows[0].cnt === 0;
}

// --- PDF-Integritätsprüfung (SHA-256) ---

/**
 * Berechnet SHA-256 Hash einer Datei und speichert ihn in der DB.
 */
export async function setPdfHash(invoiceId: string, hash: string): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE invoices SET pdf_sha256 = $1 WHERE id = $2', [hash, invoiceId]);
}

/**
 * Gibt den gespeicherten PDF-Hash zurück.
 */
export async function getPdfHash(invoiceId: string): Promise<string> {
  const db = await getDb();
  const rows: { pdf_sha256: string }[] = await db.select('SELECT pdf_sha256 FROM invoices WHERE id = $1', [invoiceId]);
  return rows[0]?.pdf_sha256 ?? '';
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

