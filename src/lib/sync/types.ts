// Gemeinsame Typen für den Cloud-Sync.

export interface RemoteEntry {
  path: string;
  size: number;
}

/**
 * Abstraktion über alle Speicher-Backends (lokaler Ordner, WebDAV, Google Drive).
 * Der Speicher ist ein "dummer" Dateiablageort – die gesamte Sync-Logik
 * läuft in der App. Es gibt bewusst KEIN delete: Der Sync-Ordner ist
 * append-only, damit nie Daten verloren gehen können.
 */
export interface SyncProvider {
  kind: SyncProviderKind;
  /** Listet alle Dateien unterhalb eines Präfix (rekursiv). */
  list(prefix: string): Promise<RemoteEntry[]>;
  /** Liest eine Datei; null wenn nicht vorhanden. */
  read(path: string): Promise<Uint8Array | null>;
  /**
   * Schreibt eine Datei. Mit ifNotExists=true wird eine bestehende Datei
   * NIE überschrieben – Rückgabe false heißt "existierte bereits".
   */
  write(path: string, data: Uint8Array, ifNotExists: boolean): Promise<boolean>;
  exists(path: string): Promise<boolean>;
}

export type SyncProviderKind = 'none' | 'local' | 'webdav' | 'gdrive';

export interface SyncConfig {
  kind: SyncProviderKind;
  /** Lokaler Ordner (z. B. Netzlaufwerk, USB, Sync-Ordner von Drittanbieter-Clients) */
  localBase?: string;
  /** WebDAV: volle URL des Sync-Ordners, z. B. https://cloud.example.com/remote.php/dav/files/user/KlevrSync */
  webdavUrl?: string;
  webdavUser?: string;
  /** Ende-zu-Ende-Verschlüsselung aktiv? */
  encrypted: boolean;
  /** Automatisch synchronisieren */
  autoSync: boolean;
  /** Intervall in Minuten */
  intervalMin: number;
}

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  kind: 'none',
  encrypted: false,
  autoSync: true,
  intervalMin: 10,
};

/** Eine Zeilen-Änderung in einer Change-Datei. */
export interface RowOp {
  /** Tabellenname */
  t: string;
  /** row_id (PK-Werte, mit  verbunden) */
  id: string;
  /** Änderungszeitpunkt (ISO, LWW-Uhr) */
  mt: string;
  /** 1 = gelöscht (Tombstone) */
  del: 0 | 1;
  /** Zeileninhalt (bei del=1 leer) */
  d: Record<string, unknown>;
}

/** Eine Datei-Änderung in einer Change-Datei. */
export interface FileOp {
  /** Relativer Pfad im AppData-Ordner, z. B. "pdfs/abc.pdf" */
  p: string;
  /** SHA-256 des Dateiinhalts (Blob-Adresse) */
  sha: string;
  size: number;
  mt: string;
  del: 0 | 1;
  /** Lokale mtime (nur für den eigenen Datei-Index, von Empfängern ignoriert) */
  lm?: number;
}

export interface ChangeFile {
  v: 1;
  device: string;
  seq: number;
  ts: string;
  rows: RowOp[];
  files: FileOp[];
}

export interface SyncProgress {
  phase: 'idle' | 'pull' | 'push' | 'files' | 'done' | 'error';
  message: string;
}

export interface SyncResult {
  pulledRows: number;
  pulledFiles: number;
  pushedRows: number;
  pushedFiles: number;
  conflicts: number;
}
