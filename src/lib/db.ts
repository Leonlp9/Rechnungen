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
}

export async function updateInvoice(inv: import('@/types').Invoice): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE invoices SET date=$1, year=$2, month=$3, category=$4, description=$5, partner=$6, netto=$7, ust=$8, brutto=$9, type=$10, currency=$11, pdf_path=$12, note=$13, updated_at=$14 WHERE id=$15`,
    [inv.date, inv.year, inv.month, inv.category, inv.description, inv.partner, inv.netto, inv.ust, inv.brutto, inv.type, inv.currency, inv.pdf_path, inv.note, new Date().toISOString(), inv.id]
  );
}

export async function deleteInvoice(id: string): Promise<void> {
  const db = await getDb();
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

