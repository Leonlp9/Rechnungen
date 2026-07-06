// Sync-Engine: Push/Pull von Zeilen-Änderungen und Dateien.
//
// Korruptions-Sicherheit:
// - Der Sync-Ordner ist append-only: Change-Dateien und Blobs werden nie
//   überschrieben oder gelöscht (create-only-Schreibmodus).
// - Jedes Gerät schreibt NUR in changes/<eigene-geräte-id>/ – Schreibkonflikte
//   sind damit per Design ausgeschlossen.
// - Blobs sind content-addressed (SHA-256) und werden nach dem Download
//   gegen ihren Hash verifiziert – beschädigte Übertragungen werden erkannt.
// - Konflikte werden per Last-Write-Wins gelöst; alles was nicht automatisch
//   anwendbar ist, landet in _sync_conflicts bzw. im konflikte/-Ordner statt
//   verloren zu gehen. Gelöschte Dateien wandern in den papierkorb/-Ordner.
// - Alle Schritte sind idempotent: Ein Absturz mitten im Sync führt höchstens
//   dazu, dass Daten erneut übertragen werden – nie zu Verlust.

import Database from '@tauri-apps/plugin-sql';
import { invoke } from '@tauri-apps/api/core';
import { readFile, remove, exists } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import type { ChangeFile, FileOp, RowOp, SyncProvider, SyncResult } from './types';
import {
  PK_SEP,
  SYNC_TABLES,
  type SyncTable,
  getMeta,
  setMeta,
  isSettingKeyExcluded,
} from './tracking';
import {
  type EncryptionContext,
  encryptBytes,
  decryptBytes,
  isEncrypted,
  sha256Hex,
  bytesToBase64,
} from './crypto';

const DELETED_HASH = '__deleted__';
const MAX_ROWS_PER_CHANGEFILE = 800;
/** Ordner im AppData-Verzeichnis, deren Dateien synchronisiert werden */
const SYNCED_DIRS = ['pdfs', 'entwuerfe', 'xrechnung'];

export interface EngineContext {
  db: Database;
  provider: SyncProvider;
  device: string;
  enc: EncryptionContext | null;
  progress: (message: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function canonicalJson(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${JSON.stringify(obj[k] ?? null)}`);
  return `{${parts.join(',')}}`;
}

async function rowHash(d: Record<string, unknown>): Promise<string> {
  return sha256Hex(new TextEncoder().encode(canonicalJson(d)));
}

function blobPath(sha: string): string {
  return `blobs/${sha.slice(0, 2)}/${sha}`;
}

function changeFileName(device: string, seq: number): string {
  return `changes/${device}/${String(seq).padStart(8, '0')}.json`;
}

async function encode(ctx: EngineContext, data: Uint8Array): Promise<Uint8Array> {
  return ctx.enc ? encryptBytes(ctx.enc, data) : data;
}

async function decode(ctx: EngineContext, data: Uint8Array): Promise<Uint8Array> {
  if (isEncrypted(data)) {
    if (!ctx.enc) {
      throw new Error(
        'Der Sync-Ordner ist verschlüsselt – bitte Passphrase in den Sync-Einstellungen hinterlegen.',
      );
    }
    return decryptBytes(ctx.enc, data);
  }
  return data;
}

const tableColumnsCache = new Map<string, string[]>();

async function tableColumns(db: Database, table: string): Promise<string[]> {
  const cached = tableColumnsCache.get(table);
  if (cached) return cached;
  const rows: { name: string }[] = await db.select(`SELECT name FROM pragma_table_info('${table}')`);
  const cols = rows.map((r) => r.name);
  tableColumnsCache.set(table, cols);
  return cols;
}

function pkWhere(t: SyncTable): string {
  return t.pk.map((c, i) => `${c} = $${i + 1}`).join(' AND ');
}

function pkValues(t: SyncTable, rowId: string): string[] {
  const vals = rowId.split(PK_SEP);
  if (vals.length !== t.pk.length) {
    throw new Error(`Ungültige row_id für ${t.name}: ${rowId}`);
  }
  return vals;
}

async function readRow(
  db: Database,
  t: SyncTable,
  rowId: string,
): Promise<Record<string, unknown> | null> {
  const rows: Record<string, unknown>[] = await db.select(
    `SELECT * FROM ${t.name} WHERE ${pkWhere(t)}`,
    pkValues(t, rowId),
  );
  return rows[0] ?? null;
}

async function recordConflict(
  db: Database,
  tbl: string,
  rowId: string,
  json: string,
  reason: string,
): Promise<void> {
  await db.execute(
    'INSERT INTO _sync_conflicts (tbl, row_id, row_json, reason) VALUES ($1, $2, $3, $4)',
    [tbl, rowId, json, reason],
  );
}

async function setRowmeta(db: Database, tbl: string, rowId: string, mt: string, del: 0 | 1) {
  await db.execute(
    `INSERT INTO _sync_rowmeta (tbl, row_id, mt, del) VALUES ($1, $2, $3, $4)
     ON CONFLICT(tbl, row_id) DO UPDATE SET mt = $3, del = $4`,
    [tbl, rowId, mt, del],
  );
}

async function setShipped(db: Database, tbl: string, rowId: string, hash: string) {
  await db.execute(
    `INSERT INTO _sync_shipped (tbl, row_id, row_hash) VALUES ($1, $2, $3)
     ON CONFLICT(tbl, row_id) DO UPDATE SET row_hash = $3`,
    [tbl, rowId, hash],
  );
}

// ─── Pull: fremde Änderungen anwenden ────────────────────────────────────────

async function applyRowOp(ctx: EngineContext, op: RowOp): Promise<boolean> {
  const { db } = ctx;
  const t = SYNC_TABLES.find((x) => x.name === op.t);
  if (!t) return false; // unbekannte Tabelle (neuere App-Version) – ignorieren

  if (t.name === 'settings') {
    const key = (op.d?.key as string) ?? op.id;
    if (isSettingKeyExcluded(key)) return false;
  }

  // LWW-Vergleich gegen die lokale Zeilen-Uhr
  const metaRows: { mt: string; del: number }[] = await db.select(
    'SELECT mt, del FROM _sync_rowmeta WHERE tbl = $1 AND row_id = $2',
    [t.name, op.id],
  );
  const local = metaRows[0];
  if (local) {
    if (local.mt > op.mt) return false; // lokal ist neuer
    if (local.mt === op.mt) {
      // Deterministischer Tiebreak bei exakt gleichem Zeitstempel
      const localRow = await readRow(db, t, op.id);
      const localHash = localRow ? await rowHash(localRow) : DELETED_HASH;
      const remoteHash = op.del ? DELETED_HASH : await rowHash(op.d);
      if (remoteHash <= localHash) return false;
    }
  }

  if (t.mode === 'seqmax') {
    // Rechnungsnummern-Sequenzen: niemals zurückdrehen – MAX gewinnt
    const remoteNum = Number(op.d?.last_number ?? 0);
    const vals = pkValues(t, op.id);
    const rows: { last_number: number }[] = await db.select(
      `SELECT last_number FROM invoice_sequences WHERE prefix = $1 AND year = $2`,
      vals,
    );
    const localNum = rows[0]?.last_number ?? 0;
    const merged = Math.max(localNum, remoteNum);
    await db.execute(
      `INSERT INTO invoice_sequences (prefix, year, last_number) VALUES ($1, $2, $3)
       ON CONFLICT(prefix, year) DO UPDATE SET last_number = $3`,
      [vals[0], Number(vals[1]), merged],
    );
    await setRowmeta(db, t.name, op.id, op.mt, 0);
    return true;
  }

  try {
    if (op.del === 1) {
      await db.execute(`DELETE FROM ${t.name} WHERE ${pkWhere(t)}`, pkValues(t, op.id));
      await setRowmeta(db, t.name, op.id, op.mt, 1);
      await setShipped(db, t.name, op.id, DELETED_HASH);
    } else {
      const cols = await tableColumns(db, t.name);
      const entries = Object.entries(op.d).filter(([k]) => cols.includes(k));
      if (entries.length === 0) return false;
      const names = entries.map(([k]) => k).join(', ');
      const placeholders = entries.map((_, i) => `$${i + 1}`).join(', ');
      const values = entries.map(([, v]) => v);
      await db.execute(
        `INSERT OR REPLACE INTO ${t.name} (${names}) VALUES (${placeholders})`,
        values,
      );
      await setRowmeta(db, t.name, op.id, op.mt, 0);
      await setShipped(db, t.name, op.id, await rowHash(op.d));
    }
    return true;
  } catch (err) {
    // Nicht anwendbar (z. B. UNIQUE/CHECK-Konflikt) – Daten sichern statt verlieren
    await recordConflict(db, t.name, op.id, canonicalJson(op.d), String(err));
    return false;
  }
}

async function applyFileOp(ctx: EngineContext, op: FileOp): Promise<boolean> {
  const { db } = ctx;
  const idxRows: { sha: string; mt: string; del: number }[] = await db.select(
    'SELECT sha, mt, del FROM _sync_files WHERE path = $1',
    [op.p],
  );
  const idx = idxRows[0];
  if (idx && idx.mt >= op.mt) return false;

  const base = await appDataDir();
  const absPath = await join(base, op.p);
  const fileExists = await exists(absPath);

  const upsertIndex = async (sha: string, del: 0 | 1) => {
    await db.execute(
      `INSERT INTO _sync_files (path, sha, size, mtime_ms, mt, del) VALUES ($1, $2, $3, 0, $4, $5)
       ON CONFLICT(path) DO UPDATE SET sha = $2, size = $3, mtime_ms = 0, mt = $4, del = $5`,
      [op.p, sha, op.size, op.mt, del],
    );
  };

  if (op.del === 1) {
    if (fileExists) {
      // Nie hart löschen: Datei in den lokalen Papierkorb-Ordner verschieben
      try {
        const data = await readFile(absPath);
        await invoke('sync_write_app_file', {
          relPath: `papierkorb/${op.p}`,
          dataB64: bytesToBase64(data),
        });
        await remove(absPath);
      } catch {
        // Verschieben fehlgeschlagen – Datei bleibt lieber liegen
        return false;
      }
    }
    await upsertIndex(op.sha, 1);
    return true;
  }

  // Lokale Datei schon identisch?
  if (fileExists) {
    try {
      const localSha = await invoke<string>('sync_hash_app_file', { relPath: op.p });
      if (localSha === op.sha) {
        await upsertIndex(op.sha, 0);
        return false;
      }
      // Lokale, noch nicht gepushte Änderung? → Kopie sichern, dann überschreiben
      if (idx && localSha !== idx.sha) {
        const data = await readFile(absPath);
        await invoke('sync_write_app_file', {
          relPath: `konflikte/${Date.now()}-${op.p.replace(/\//g, '_')}`,
          dataB64: bytesToBase64(data),
        });
      }
    } catch {
      // Hash fehlgeschlagen – weiter mit Download
    }
  }

  const blob = await ctx.provider.read(blobPath(op.sha));
  if (blob === null) {
    await recordConflict(db, '_file', op.p, JSON.stringify(op), 'Blob fehlt im Sync-Ordner');
    return false;
  }
  const plain = await decode(ctx, blob);
  const actualSha = await sha256Hex(plain);
  if (actualSha !== op.sha) {
    await recordConflict(
      db,
      '_file',
      op.p,
      JSON.stringify(op),
      `Integritätsfehler: erwartet ${op.sha}, erhalten ${actualSha}`,
    );
    return false;
  }
  await invoke('sync_write_app_file', { relPath: op.p, dataB64: bytesToBase64(plain) });
  await db.execute('INSERT OR IGNORE INTO _sync_blobs (sha) VALUES ($1)', [op.sha]);
  await upsertIndex(op.sha, 0);
  return true;
}

export async function pull(ctx: EngineContext): Promise<{ rows: number; files: number }> {
  const { db, provider, device } = ctx;
  ctx.progress('Suche nach Änderungen anderer Geräte …');

  const entries = await provider.list('changes');
  const byDevice = new Map<string, string[]>();
  for (const e of entries) {
    const m = e.path.match(/^changes\/([^/]+)\/([^/]+\.json)$/);
    if (!m || m[1] === device) continue;
    const list = byDevice.get(m[1]) ?? [];
    list.push(e.path);
    byDevice.set(m[1], list);
  }

  let appliedRows = 0;
  let appliedFiles = 0;

  for (const [dev, files] of byDevice) {
    files.sort();
    const cursor = (await getMeta(db, `cursor.${dev}`)) ?? '';
    for (const path of files) {
      if (path <= cursor) continue;
      ctx.progress(`Übernehme Änderungen von Gerät ${dev.slice(0, 6)} …`);
      const raw = await provider.read(path);
      if (raw === null) continue;
      let change: ChangeFile;
      try {
        const plain = await decode(ctx, raw);
        change = JSON.parse(new TextDecoder().decode(plain)) as ChangeFile;
      } catch (err) {
        // Unlesbare Change-Datei: merken und überspringen, Sync nicht abbrechen
        await recordConflict(db, '_changefile', path, '', `Unlesbar: ${err}`);
        await setMeta(db, `cursor.${dev}`, path);
        continue;
      }
      for (const op of change.rows ?? []) {
        if (await applyRowOp(ctx, op)) appliedRows++;
      }
      for (const op of change.files ?? []) {
        if (await applyFileOp(ctx, op)) appliedFiles++;
      }
      // Cursor erst NACH vollständiger Anwendung – Wiederholung ist idempotent
      await setMeta(db, `cursor.${dev}`, path);
    }
  }
  return { rows: appliedRows, files: appliedFiles };
}

// ─── Push: eigene Änderungen hochladen ───────────────────────────────────────

async function collectRowOps(ctx: EngineContext): Promise<RowOp[]> {
  const { db } = ctx;
  const dirty: { tbl: string; row_id: string }[] = await db.select('SELECT tbl, row_id FROM _sync_dirty');
  const ops: RowOp[] = [];

  for (const entry of dirty) {
    const t = SYNC_TABLES.find((x) => x.name === entry.tbl);
    if (!t) {
      await db.execute('DELETE FROM _sync_dirty WHERE tbl = $1 AND row_id = $2', [entry.tbl, entry.row_id]);
      continue;
    }
    if (t.name === 'settings' && isSettingKeyExcluded(entry.row_id)) {
      await db.execute('DELETE FROM _sync_dirty WHERE tbl = $1 AND row_id = $2', [entry.tbl, entry.row_id]);
      continue;
    }

    const metaRows: { mt: string; del: number }[] = await db.select(
      'SELECT mt, del FROM _sync_rowmeta WHERE tbl = $1 AND row_id = $2',
      [entry.tbl, entry.row_id],
    );
    const mt = metaRows[0]?.mt ?? new Date().toISOString();

    const row = await readRow(db, t, entry.row_id);
    const del: 0 | 1 = row === null ? 1 : 0;
    const hash = row === null ? DELETED_HASH : await rowHash(row);

    const shippedRows: { row_hash: string }[] = await db.select(
      'SELECT row_hash FROM _sync_shipped WHERE tbl = $1 AND row_id = $2',
      [entry.tbl, entry.row_id],
    );
    if (shippedRows[0]?.row_hash === hash) {
      // Gegenseite kennt diesen Stand bereits (z. B. Echo eines Pulls)
      await db.execute('DELETE FROM _sync_dirty WHERE tbl = $1 AND row_id = $2', [entry.tbl, entry.row_id]);
      continue;
    }

    ops.push({ t: t.name, id: entry.row_id, mt, del, d: row ?? {} });
  }
  return ops;
}

async function collectFileOps(ctx: EngineContext): Promise<FileOp[]> {
  const { db, provider } = ctx;
  ctx.progress('Prüfe lokale Dateien …');

  const scanned = await invoke<{ rel_path: string; size: number; mtime_ms: number }[]>(
    'sync_scan_app_files',
    { dirs: SYNCED_DIRS },
  );
  const index: { path: string; sha: string; size: number; mtime_ms: number; del: number }[] =
    await db.select('SELECT * FROM _sync_files');
  const indexByPath = new Map(index.map((i) => [i.path, i]));
  const scannedPaths = new Set(scanned.map((s) => s.rel_path));
  const now = new Date().toISOString();
  const ops: FileOp[] = [];

  for (const f of scanned) {
    // Temporäre Dateien von abgebrochenen atomaren Schreibvorgängen ignorieren
    if (/\.tmp-\d+$/.test(f.rel_path)) continue;
    const idx = indexByPath.get(f.rel_path);
    if (idx && idx.del === 0 && idx.size === f.size && idx.mtime_ms === f.mtime_ms) continue;

    const sha = await invoke<string>('sync_hash_app_file', { relPath: f.rel_path });
    if (idx && idx.del === 0 && idx.sha === sha) {
      // Inhalt unverändert, nur mtime anders → Index auffrischen
      await db.execute('UPDATE _sync_files SET size = $1, mtime_ms = $2 WHERE path = $3', [
        f.size,
        f.mtime_ms,
        f.rel_path,
      ]);
      continue;
    }

    // Blob hochladen (content-addressed, create-only → niemals Überschreiben)
    const known: { sha: string }[] = await db.select('SELECT sha FROM _sync_blobs WHERE sha = $1', [sha]);
    if (known.length === 0) {
      ctx.progress(`Lade Datei hoch: ${f.rel_path}`);
      const base = await appDataDir();
      const abs = await join(base, f.rel_path);
      const data = await readFile(abs);
      const payload = await encode(ctx, data);
      await provider.write(blobPath(sha), payload, true);
      await db.execute('INSERT OR IGNORE INTO _sync_blobs (sha) VALUES ($1)', [sha]);
    }

    ops.push({ p: f.rel_path, sha, size: f.size, mt: now, del: 0, lm: f.mtime_ms });
  }

  // Lokal gelöschte Dateien → Tombstone (Blob bleibt remote erhalten)
  for (const idx of index) {
    if (idx.del === 0 && !scannedPaths.has(idx.path)) {
      ops.push({ p: idx.path, sha: idx.sha, size: 0, mt: now, del: 1 });
    }
  }
  return ops;
}

export async function push(ctx: EngineContext): Promise<{ rows: number; files: number }> {
  const { db, provider, device } = ctx;
  ctx.progress('Sammle lokale Änderungen …');

  const rowOps = await collectRowOps(ctx);
  const fileOps = await collectFileOps(ctx);
  if (rowOps.length === 0 && fileOps.length === 0) return { rows: 0, files: 0 };

  let seq = Number((await getMeta(db, 'seq')) ?? '0');

  // In Blöcke aufteilen, damit Change-Dateien handlich bleiben
  const chunks: { rows: RowOp[]; files: FileOp[] }[] = [];
  for (let i = 0; i < rowOps.length || (i === 0 && fileOps.length > 0); i += MAX_ROWS_PER_CHANGEFILE) {
    chunks.push({
      rows: rowOps.slice(i, i + MAX_ROWS_PER_CHANGEFILE),
      files: i === 0 ? fileOps : [],
    });
  }

  for (const chunk of chunks) {
    ctx.progress(`Lade ${chunk.rows.length} Änderungen hoch …`);
    const change: ChangeFile = {
      v: 1,
      device,
      seq: seq + 1,
      ts: new Date().toISOString(),
      rows: chunk.rows,
      files: chunk.files,
    };
    const payload = await encode(ctx, new TextEncoder().encode(JSON.stringify(change)));

    // Create-only-Schreiben: existiert die Datei schon (z. B. nach Absturz),
    // wird die nächste Sequenznummer probiert – nie überschrieben.
    let written = false;
    for (let attempt = 0; attempt < 1000 && !written; attempt++) {
      seq++;
      written = await provider.write(changeFileName(device, seq), payload, true);
    }
    if (!written) throw new Error('Keine freie Sequenznummer gefunden');

    // Erst nach erfolgreichem Upload den lokalen Zustand fortschreiben
    await setMeta(db, 'seq', String(seq));
    for (const op of chunk.rows) {
      const hash = op.del === 1 ? DELETED_HASH : await rowHash(op.d);
      await setShipped(db, op.t, op.id, hash);
      await db.execute('DELETE FROM _sync_dirty WHERE tbl = $1 AND row_id = $2', [op.t, op.id]);
    }
    for (const op of chunk.files) {
      await db.execute(
        `INSERT INTO _sync_files (path, sha, size, mtime_ms, mt, del) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT(path) DO UPDATE SET sha = $2, size = $3, mtime_ms = $4, mt = $5, del = $6`,
        [op.p, op.sha, op.size, op.lm ?? 0, op.mt, op.del],
      );
    }
  }
  return { rows: rowOps.length, files: fileOps.length };
}

// ─── Gesamter Sync-Durchlauf ─────────────────────────────────────────────────

export async function runSyncCycle(ctx: EngineContext): Promise<SyncResult> {
  const pulled = await pull(ctx);
  const pushed = await push(ctx);
  const conflictRows: { cnt: number }[] = await ctx.db.select(
    'SELECT COUNT(*) as cnt FROM _sync_conflicts',
  );
  return {
    pulledRows: pulled.rows,
    pulledFiles: pulled.files,
    pushedRows: pushed.rows,
    pushedFiles: pushed.files,
    conflicts: conflictRows[0]?.cnt ?? 0,
  };
}
