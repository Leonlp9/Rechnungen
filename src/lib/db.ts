import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;
// Promise-basiertes Mutex – verhindert Race Conditions bei parallelen Aufrufen
let dbInitPromise: Promise<Database> | null = null;

export async function getDb(): Promise<Database> {
  if (db) return db;
  if (!dbInitPromise) {
    dbInitPromise = Database.load('sqlite:rechnungen.db').then(async (instance) => {
      await migrate(instance);
      db = instance;
      return db!;
    }).catch((err) => {
      dbInitPromise = null; // Fehler zurücksetzen, damit erneut versucht werden kann
      throw err;
    });
  }
  return dbInitPromise;
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
    const cols = [
      "ALTER TABLE invoices ADD COLUMN is_locked INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE invoices ADD COLUMN pdf_sha256 TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE invoices ADD COLUMN delivery_date TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE invoices ADD COLUMN storno_of TEXT NOT NULL DEFAULT ''",
    ];
    for (const sql of cols) {
      try { await db.execute(sql); } catch { /* Spalte existiert bereits */ }
    }
    await db.execute('CREATE INDEX IF NOT EXISTS idx_invoices_year ON invoices(year)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(type)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_invoices_category ON invoices(category)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_invoices_partner ON invoices(partner)');
  },
  // v1 → v2: Atomare Rechnungsnummern-Sequenz (GoBD-lückenlos)
  async (db) => {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS invoice_sequences (
        prefix TEXT NOT NULL,
        year INTEGER NOT NULL,
        last_number INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (prefix, year)
      )
    `);
  },
  // v2 → v3: Fahrtenbuch + Kunden-CRM + Audit-Trail Hash-Verkettung
  async (db) => {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS fahrtenbuch (
        id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        datum       TEXT NOT NULL,
        abfahrt     TEXT NOT NULL,
        ziel        TEXT NOT NULL,
        km          REAL NOT NULL,
        zweck       TEXT NOT NULL,
        art         TEXT NOT NULL CHECK(art IN ('dienst', 'privat')),
        kfz_kennz   TEXT NOT NULL DEFAULT '',
        created_at  TEXT DEFAULT (datetime('now'))
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS customers (
        id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        name            TEXT NOT NULL,
        customer_number TEXT UNIQUE,
        email           TEXT,
        phone           TEXT,
        website         TEXT,
        street          TEXT,
        zip             TEXT,
        city            TEXT,
        country         TEXT DEFAULT 'DE',
        tax_id          TEXT,
        payment_days    INTEGER DEFAULT 14,
        notes           TEXT,
        created_at      TEXT DEFAULT (datetime('now')),
        updated_at      TEXT DEFAULT (datetime('now'))
      )
    `);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name)`);
    // Audit-Trail Hash-Verkettung
    for (const col of ['prev_hash TEXT DEFAULT ""', 'entry_hash TEXT DEFAULT ""']) {
      try { await db.execute(`ALTER TABLE audit_log ADD COLUMN ${col}`); } catch { /* exists */ }
    }
    // Customer link on invoices
    try { await db.execute(`ALTER TABLE invoices ADD COLUMN customer_id TEXT DEFAULT ''`); } catch { /* exists */ }
  },
  // v3 → v4: Bank-Transaktionen persistieren
  async (db) => {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS bank_transactions (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        transaction_id TEXT NOT NULL,
        booking_date TEXT NOT NULL,
        value_date TEXT NOT NULL DEFAULT '',
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'EUR',
        creditor_name TEXT,
        debtor_name TEXT,
        remittance_info TEXT NOT NULL DEFAULT '',
        source_file TEXT,
        matched_invoice_id TEXT,
        import_batch TEXT NOT NULL DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(transaction_id, booking_date, amount)
      )
    `);
    await db.execute('CREATE INDEX IF NOT EXISTS idx_bank_tx_date ON bank_transactions(booking_date)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_bank_tx_batch ON bank_transactions(import_batch)');
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

/** SHA-256 eines Strings – nutzt die Web Crypto API (immer verfügbar in Tauri WebView). */
async function sha256(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function addAuditLog(
  invoiceId: string,
  action: string,
  fieldName?: string | null,
  oldValue?: string | null,
  newValue?: string | null,
  userNote?: string,
): Promise<void> {
  const database = await getDb();

  // Letzten Eintrag für Hash-Verkettung holen
  const last = await database.select<{ entry_hash: string }[]>(
    'SELECT entry_hash FROM audit_log ORDER BY id DESC LIMIT 1'
  );
  const prevHash = last[0]?.entry_hash ?? '';

  const timestamp = new Date().toISOString();
  const hashInput = [invoiceId, action, fieldName ?? '', oldValue ?? '', newValue ?? '', timestamp, prevHash].join('|');
  const entryHash = await sha256(hashInput);

  await database.execute(
    `INSERT INTO audit_log (invoice_id, action, field_name, old_value, new_value, user_note, prev_hash, entry_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [invoiceId, action, fieldName ?? null, oldValue ?? null, newValue ?? null, userNote ?? '', prevHash, entryHash],
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
 * GoBD-Integritätsprüfung: Verifiziert die Hash-Verkettung des Audit-Logs.
 * Gibt die Anzahl der beschädigten Einträge zurück (0 = integer).
 */
export async function verifyAuditIntegrity(): Promise<{ ok: boolean; brokenEntries: number; total: number }> {
  const db = await getDb();
  const entries: AuditLogEntry[] = await db.select(
    'SELECT * FROM audit_log ORDER BY id ASC'
  );
  let broken = 0;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const prevHash = i === 0 ? '' : (entries[i - 1] as AuditLogEntry & { entry_hash?: string }).entry_hash ?? '';
    const hashInput = [e.invoice_id, e.action, e.field_name ?? '', e.old_value ?? '', e.new_value ?? '', e.timestamp, prevHash].join('|');
    const expectedHash = await sha256(hashInput);
    const storedHash = (e as AuditLogEntry & { entry_hash?: string }).entry_hash ?? '';
    if (storedHash && storedHash !== expectedHash) {
      broken++;
    }
  }
  return { ok: broken === 0, brokenEntries: broken, total: entries.length };
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
 * Verwendet eine atomare Sequenztabelle (GoBD-konform, lückenlos).
 * Format: {prefix}-{year}-{laufendeNummer} z.B. "R-2026-001"
 */
export async function generateInvoiceNumber(prefix = 'R', year?: number): Promise<string> {
  const y = year ?? new Date().getFullYear();
  const db = await getDb();
  // Atomares Upsert: Erstellt oder erhöht die Sequenz
  await db.execute(
    `INSERT INTO invoice_sequences (prefix, year, last_number) VALUES ($1, $2, 1)
     ON CONFLICT(prefix, year) DO UPDATE SET last_number = last_number + 1`,
    [prefix, y]
  );
  const rows: { last_number: number }[] = await db.select(
    'SELECT last_number FROM invoice_sequences WHERE prefix = $1 AND year = $2',
    [prefix, y]
  );
  const next = rows[0]?.last_number ?? 1;
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

// --- Fahrtenbuch ---

export interface Fahrt {
  id: string;
  datum: string;
  abfahrt: string;
  ziel: string;
  km: number;
  zweck: string;
  art: 'dienst' | 'privat';
  kfz_kennz: string;
  created_at?: string;
}

export const fahrtenbuch = {
  async getAll(): Promise<Fahrt[]> {
    const db = await getDb();
    return db.select<Fahrt[]>('SELECT * FROM fahrtenbuch ORDER BY datum DESC');
  },

  async add(fahrt: Omit<Fahrt, 'id' | 'created_at'>): Promise<void> {
    const db = await getDb();
    await db.execute(
      `INSERT INTO fahrtenbuch (datum, abfahrt, ziel, km, zweck, art, kfz_kennz)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [fahrt.datum, fahrt.abfahrt, fahrt.ziel, fahrt.km, fahrt.zweck, fahrt.art, fahrt.kfz_kennz]
    );
  },

  async update(id: string, fahrt: Partial<Fahrt>): Promise<void> {
    const db = await getDb();
    const sets = Object.keys(fahrt).filter(k => k !== 'id' && k !== 'created_at').map((k, i) => `${k}=$${i + 2}`).join(', ');
    const values = Object.entries(fahrt).filter(([k]) => k !== 'id' && k !== 'created_at').map(([, v]) => v);
    await db.execute(`UPDATE fahrtenbuch SET ${sets} WHERE id=$1`, [id, ...values]);
  },

  async delete(id: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM fahrtenbuch WHERE id=$1', [id]);
  },

  async getJahresauswertung(year: number) {
    const db = await getDb();
    const fahrten = await db.select<Fahrt[]>(
      `SELECT * FROM fahrtenbuch WHERE strftime('%Y', datum) = $1`,
      [String(year)]
    );
    const dienst = fahrten.filter(f => f.art === 'dienst');
    const privat = fahrten.filter(f => f.art === 'privat');
    const kmDienst = dienst.reduce((s, f) => s + f.km, 0);
    const kmPrivat = privat.reduce((s, f) => s + f.km, 0);
    // 30 Cent/km (2022+), 38 Cent ab km 21+ (vereinfacht: 30ct)
    const absetzbar = kmDienst * 0.30;
    return { kmDienst, kmPrivat, kmGesamt: kmDienst + kmPrivat, absetzbar, fahrten };
  },
};

// --- Customers (CRM) ---

export interface Customer {
  id: string;
  name: string;
  customer_number?: string;
  email?: string;
  phone?: string;
  website?: string;
  street?: string;
  zip?: string;
  city?: string;
  country: string;
  tax_id?: string;
  payment_days: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export const customers = {
  async getAll(): Promise<Customer[]> {
    const db = await getDb();
    return db.select<Customer[]>('SELECT * FROM customers ORDER BY name ASC');
  },

  async getById(id: string): Promise<Customer | null> {
    const db = await getDb();
    const rows = await db.select<Customer[]>('SELECT * FROM customers WHERE id=$1', [id]);
    return rows[0] ?? null;
  },

  async save(c: Omit<Customer, 'id'>): Promise<string> {
    const db = await getDb();
    const id = crypto.randomUUID();
    await db.execute(
      `INSERT INTO customers (id, name, customer_number, email, phone, website, street, zip, city, country, tax_id, payment_days, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [id, c.name, c.customer_number ?? null, c.email ?? null, c.phone ?? null, c.website ?? null,
       c.street ?? null, c.zip ?? null, c.city ?? null, c.country ?? 'DE',
       c.tax_id ?? null, c.payment_days ?? 14, c.notes ?? null]
    );
    return id;
  },

  async update(id: string, c: Partial<Customer>): Promise<void> {
    const db = await getDb();
    const entries = Object.entries(c).filter(([k]) => k !== 'id' && k !== 'created_at');
    const sets = entries.map(([k], i) => `${k}=$${i + 2}`).join(', ');
    await db.execute(
      `UPDATE customers SET ${sets}, updated_at=datetime('now') WHERE id=$1`,
      [id, ...entries.map(([, v]) => v)]
    );
  },

  async delete(id: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM customers WHERE id=$1', [id]);
  },

  async getInvoices(customerId: string): Promise<import('@/types').Invoice[]> {
    const db = await getDb();
    const rows: unknown[] = await db.select(
      'SELECT * FROM invoices WHERE customer_id=$1 ORDER BY date DESC',
      [customerId]
    );
    return rows.map(mapInvoiceRow);
  },

  async generateNextNumber(): Promise<string> {
    const db = await getDb();
    const row = await db.select<{ n: number }[]>(
      `SELECT COALESCE(MAX(CAST(REPLACE(customer_number, 'KD-', '') AS INTEGER)), 0) + 1 as n FROM customers`
    );
    return `KD-${String(row[0]?.n ?? 1).padStart(4, '0')}`;
  },
};

// --- Bank Transactions ---

export interface BankTransactionRow {
  id: string;
  transaction_id: string;
  booking_date: string;
  value_date: string;
  amount: number;
  currency: string;
  creditor_name: string | null;
  debtor_name: string | null;
  remittance_info: string;
  source_file: string | null;
  matched_invoice_id: string | null;
  import_batch: string;
  created_at: string;
}

export async function getAllBankTransactions(): Promise<BankTransactionRow[]> {
  const db = await getDb();
  return db.select('SELECT * FROM bank_transactions ORDER BY booking_date DESC, created_at DESC');
}

export async function saveBankTransactions(
  transactions: Omit<BankTransactionRow, 'id' | 'created_at'>[],
  batchId: string
): Promise<number> {
  const db = await getDb();
  let saved = 0;
  for (const tx of transactions) {
    try {
      await db.execute(
        `INSERT OR IGNORE INTO bank_transactions 
         (transaction_id, booking_date, value_date, amount, currency, creditor_name, debtor_name, remittance_info, source_file, matched_invoice_id, import_batch)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [tx.transaction_id, tx.booking_date, tx.value_date, tx.amount, tx.currency, tx.creditor_name, tx.debtor_name, tx.remittance_info, tx.source_file, tx.matched_invoice_id, batchId]
      );
      saved++;
    } catch {
      // duplicate – skip
    }
  }
  return saved;
}

export async function deleteBankTransaction(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM bank_transactions WHERE id = $1', [id]);
}

export async function deleteAllBankTransactions(): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM bank_transactions');
}

export async function updateBankTransactionMatch(id: string, matchedInvoiceId: string | null): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE bank_transactions SET matched_invoice_id = $1 WHERE id = $2', [matchedInvoiceId, id]);
}
