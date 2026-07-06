// Änderungs-Tracking für den Sync.
//
// SQLite-Trigger protokollieren jede Zeilenänderung in _sync_rowmeta
// (dauerhafte LWW-Uhr + Tombstones) und _sync_dirty (Push-Warteschlange).
// Dadurch muss KEIN bestehender App-Code angefasst werden – auch künftige
// Schreibpfade werden automatisch erfasst.

import Database from '@tauri-apps/plugin-sql';

export interface SyncTable {
  name: string;
  /** Primärschlüssel-Spalten (row_id = Werte mit  verbunden) */
  pk: string[];
  /** lww = Last-Write-Wins pro Zeile; seqmax = Merge über MAX(last_number) */
  mode: 'lww' | 'seqmax';
}

export const SYNC_TABLES: SyncTable[] = [
  { name: 'invoices', pk: ['id'], mode: 'lww' },
  { name: 'customers', pk: ['id'], mode: 'lww' },
  { name: 'projects', pk: ['id'], mode: 'lww' },
  { name: 'fahrtenbuch', pk: ['id'], mode: 'lww' },
  { name: 'bank_transactions', pk: ['id'], mode: 'lww' },
  { name: 'krankenkasse_saetze', pk: ['id'], mode: 'lww' },
  { name: 'krankenkasse_zahlungen', pk: ['id'], mode: 'lww' },
  { name: 'drafts', pk: ['id'], mode: 'lww' },
  { name: 'settings', pk: ['key'], mode: 'lww' },
  { name: 'invoice_sequences', pk: ['prefix', 'year'], mode: 'seqmax' },
];

/** Trennzeichen für zusammengesetzte Primärschlüssel */
export const PK_SEP = String.fromCharCode(31);

/**
 * Settings-Schlüssel, die NIE synchronisiert werden:
 * Sync-Konfiguration selbst, gerätespezifische Werte und Secrets.
 */
export function isSettingKeyExcluded(key: string): boolean {
  return key.startsWith('sync.') || key.startsWith('secret.') || key.startsWith('device.');
}

const NOW_EXPR = `strftime('%Y-%m-%dT%H:%M:%fZ','now')`;

function pkExpr(table: SyncTable, ref: 'NEW' | 'OLD'): string {
  return table.pk.map((c) => `CAST(${ref}.${c} AS TEXT)`).join(` || char(31) || `);
}

/**
 * Legt die Sync-Systemtabellen und Trigger an. Idempotent, wird bei jedem
 * App-Start aufgerufen (nach den regulären Migrationen).
 */
export async function initSyncTracking(db: Database): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    )
  `);
  // Dauerhafte LWW-Uhr pro Zeile + Tombstones (überlebt das Löschen der Zeile)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _sync_rowmeta (
      tbl TEXT NOT NULL,
      row_id TEXT NOT NULL,
      mt TEXT NOT NULL,
      del INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (tbl, row_id)
    )
  `);
  // Push-Warteschlange: Zeilen, die sich seit dem letzten Push geändert haben könnten
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _sync_dirty (
      tbl TEXT NOT NULL,
      row_id TEXT NOT NULL,
      PRIMARY KEY (tbl, row_id)
    )
  `);
  // Letzter Zeilen-Hash, den die Gegenseite kennt (Echo-Vermeidung)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _sync_shipped (
      tbl TEXT NOT NULL,
      row_id TEXT NOT NULL,
      row_hash TEXT NOT NULL,
      PRIMARY KEY (tbl, row_id)
    )
  `);
  // Konflikte, die nicht automatisch angewendet werden konnten – nichts geht verloren
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _sync_conflicts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tbl TEXT NOT NULL,
      row_id TEXT NOT NULL,
      row_json TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (${NOW_EXPR})
    )
  `);
  // Datei-Index: letzter bekannter Zustand jeder synchronisierten Datei
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _sync_files (
      path TEXT PRIMARY KEY,
      sha TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      mtime_ms INTEGER NOT NULL DEFAULT 0,
      mt TEXT NOT NULL,
      del INTEGER NOT NULL DEFAULT 0
    )
  `);
  // Blobs, von denen wir wissen, dass sie remote existieren
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _sync_blobs (
      sha TEXT PRIMARY KEY
    )
  `);

  // Trigger pro synchronisierter Tabelle (idempotent via Namen).
  //
  // WICHTIG: Kein "INSERT OR REPLACE/IGNORE" in Trigger-Bodies! SQLite ersetzt
  // die Konfliktbehandlung innerer Statements durch die des auslösenden
  // äußeren Statements (z. B. bei Upserts wie in setSetting) – das würde zu
  // UNIQUE-Fehlern führen. Deshalb konfliktfreie UPDATE+INSERT-Paare.
  for (const t of SYNC_TABLES) {
    for (const [suffix, event, ref, del] of [
      ['ai', 'INSERT', 'NEW', 0],
      ['au', 'UPDATE', 'NEW', 0],
      ['ad', 'DELETE', 'OLD', 1],
    ] as const) {
      const rowId = pkExpr(t, ref);
      await db.execute(`
        CREATE TRIGGER IF NOT EXISTS _sync_${suffix}_${t.name} AFTER ${event} ON ${t.name} BEGIN
          UPDATE _sync_rowmeta SET mt = ${NOW_EXPR}, del = ${del}
            WHERE tbl = '${t.name}' AND row_id = ${rowId};
          INSERT INTO _sync_rowmeta (tbl, row_id, mt, del)
            SELECT '${t.name}', ${rowId}, ${NOW_EXPR}, ${del}
            WHERE NOT EXISTS (SELECT 1 FROM _sync_rowmeta WHERE tbl = '${t.name}' AND row_id = ${rowId});
          INSERT INTO _sync_dirty (tbl, row_id)
            SELECT '${t.name}', ${rowId}
            WHERE NOT EXISTS (SELECT 1 FROM _sync_dirty WHERE tbl = '${t.name}' AND row_id = ${rowId});
        END
      `);
    }
  }

  // Bestehende Zeilen einmalig erfassen (Erstinstallation des Sync):
  // Alle Zeilen ohne rowmeta bekommen created_at/updated_at bzw. "jetzt" als mt
  // und landen in der Push-Warteschlange.
  const seeded = await getMeta(db, 'seeded');
  if (seeded !== '1') {
    for (const t of SYNC_TABLES) {
      const idExpr = t.pk.map((c) => `CAST(${c} AS TEXT)`).join(` || char(31) || `);
      const cols: { name: string }[] = await db.select(
        `SELECT name FROM pragma_table_info('${t.name}')`,
      );
      const colNames = new Set(cols.map((c) => c.name));
      const mtExpr = colNames.has('updated_at')
        ? `COALESCE(NULLIF(updated_at, ''), ${NOW_EXPR})`
        : colNames.has('created_at')
          ? `COALESCE(NULLIF(created_at, ''), ${NOW_EXPR})`
          : NOW_EXPR;
      await db.execute(`
        INSERT OR IGNORE INTO _sync_rowmeta (tbl, row_id, mt, del)
        SELECT '${t.name}', ${idExpr}, ${mtExpr}, 0 FROM ${t.name}
      `);
      await db.execute(`
        INSERT OR IGNORE INTO _sync_dirty (tbl, row_id)
        SELECT '${t.name}', ${idExpr} FROM ${t.name}
      `);
    }
    await setMeta(db, 'seeded', '1');
  }
}

export async function getMeta(db: Database, key: string): Promise<string | null> {
  const rows: { value: string }[] = await db.select(
    'SELECT value FROM _sync_meta WHERE key = $1',
    [key],
  );
  return rows[0]?.value ?? null;
}

export async function setMeta(db: Database, key: string, value: string): Promise<void> {
  await db.execute(
    'INSERT INTO _sync_meta (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2',
    [key, value],
  );
}

/** Geräte-ID (stabil pro Installation). */
export async function getDeviceId(db: Database): Promise<string> {
  let id = await getMeta(db, 'device_id');
  if (!id) {
    id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    await setMeta(db, 'device_id', id);
  }
  return id;
}
