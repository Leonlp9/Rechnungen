// Orchestrierung des Cloud-Syncs: Konfiguration, Secrets, Status-Store,
// Auto-Sync und der öffentliche Einstiegspunkt runSync().

import { create } from 'zustand';
import { toast } from 'sonner';
import { getDb, getSetting, setSetting, getAllInvoices, getAllDrafts } from '@/lib/db';
import { getAbsolutePdfPath } from '@/lib/pdf';
import { keyringLoad, keyringSave, keyringDelete } from '@/lib/keyring';
import { queryClient } from '@/lib/queryClient';
import { useAppStore } from '@/store';
import { useListsStore } from '@/store/listsStore';
import type { SyncConfig, SyncProvider, SyncProviderKind, SyncResult } from './types';
import { DEFAULT_SYNC_CONFIG } from './types';
import { initSyncTracking, getDeviceId, getMeta, setMeta } from './tracking';
import {
  createLocalProvider,
  createWebdavProvider,
  createGoogleDriveProvider,
  startDriveOAuthFlow,
  type DriveToken,
} from './providers';
import {
  type EncryptionContext,
  deriveKey,
  generateSalt,
  buildKeycheck,
  verifyKeycheck,
  bytesToBase64,
  base64ToBytes,
} from './crypto';
import { runSyncCycle, type EngineContext } from './engine';

export type { SyncConfig, SyncProviderKind, SyncResult };
export { startDriveOAuthFlow };

// ─── Konfiguration (settings-Tabelle, Schlüssel "sync." wird NIE synchronisiert) ──

const CONFIG_KEY = 'sync.config';

export async function loadSyncConfig(): Promise<SyncConfig> {
  const raw = await getSetting(CONFIG_KEY);
  if (!raw) return { ...DEFAULT_SYNC_CONFIG };
  try {
    return { ...DEFAULT_SYNC_CONFIG, ...(JSON.parse(raw) as Partial<SyncConfig>) };
  } catch {
    return { ...DEFAULT_SYNC_CONFIG };
  }
}

export async function saveSyncConfig(config: SyncConfig): Promise<void> {
  await setSetting(CONFIG_KEY, JSON.stringify(config));
  publishConfig(config);
}

// ─── Secrets (Keyring, Fallback: settings-Tabelle mit "secret."-Präfix) ────────
//
// Auf Mobilgeräten gibt es keinen Keyring – dort landen die Secrets in der
// lokalen Datenbank. "secret."-Schlüssel sind vom Sync ausgeschlossen.

async function secretSave(key: string, value: string): Promise<void> {
  try {
    await keyringSave(key, value);
  } catch {
    await setSetting(`secret.${key}`, value);
  }
}

async function secretLoad(key: string): Promise<string | null> {
  try {
    const v = await keyringLoad(key);
    if (v !== null) return v;
  } catch {
    // Keyring nicht verfügbar (Mobile) → Fallback
  }
  return getSetting(`secret.${key}`);
}

async function secretDelete(key: string): Promise<void> {
  try {
    await keyringDelete(key);
  } catch {
    // ignorieren
  }
  await setSetting(`secret.${key}`, '');
}

const SECRET_WEBDAV_PASSWORD = 'sync.webdav.password';
const SECRET_PASSPHRASE = 'sync.passphrase';
const SECRET_DRIVE_TOKEN = 'sync.gdrive.token';

export const syncSecrets = {
  setWebdavPassword: (v: string) => secretSave(SECRET_WEBDAV_PASSWORD, v),
  setPassphrase: (v: string) => secretSave(SECRET_PASSPHRASE, v),
  getPassphrase: () => secretLoad(SECRET_PASSPHRASE),
  setDriveToken: (t: DriveToken) => secretSave(SECRET_DRIVE_TOKEN, JSON.stringify(t)),
  getDriveToken: async (): Promise<DriveToken | null> => {
    const raw = await secretLoad(SECRET_DRIVE_TOKEN);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as DriveToken;
    } catch {
      return null;
    }
  },
  clearAll: async () => {
    await secretDelete(SECRET_WEBDAV_PASSWORD);
    await secretDelete(SECRET_PASSPHRASE);
    await secretDelete(SECRET_DRIVE_TOKEN);
  },
};

// ─── Status-Store für die UI ─────────────────────────────────────────────────

export interface SyncStatus {
  running: boolean;
  message: string;
  lastSync: string | null;
  lastError: string | null;
  lastResult: SyncResult | null;
  /** Aktiver Anbieter – 'none' bedeutet: Sync ist nicht eingerichtet. */
  kind: SyncProviderKind;
  autoSync: boolean;
  intervalMin: number;
  encrypted: boolean;
  /** Eigene Geräte-ID im Sync-Ordner (changes/<id>/) */
  deviceId: string | null;
  /** Zeitpunkt, an dem zuletzt Daten von anderen Geräten ankamen */
  lastIncoming: string | null;
  /** Anzahl der zuletzt empfangenen Zeilen + Dateien */
  lastIncomingCount: number;
}

interface SyncStatusStore extends SyncStatus {
  set: (patch: Partial<SyncStatus>) => void;
}

export const useSyncStatus = create<SyncStatusStore>((set) => ({
  running: false,
  message: '',
  lastSync: null,
  lastError: null,
  lastResult: null,
  kind: 'none',
  autoSync: DEFAULT_SYNC_CONFIG.autoSync,
  intervalMin: DEFAULT_SYNC_CONFIG.intervalMin,
  encrypted: false,
  deviceId: null,
  lastIncoming: null,
  lastIncomingCount: 0,
  set: (patch) => set(patch),
}));

/** Übernimmt die Konfiguration in den Status-Store (für die Indikatoren in der UI). */
function publishConfig(config: SyncConfig): void {
  useSyncStatus.getState().set({
    kind: config.kind,
    autoSync: config.autoSync,
    intervalMin: config.intervalMin,
    encrypted: config.encrypted,
  });
}

/** Menschenlesbarer Name des Anbieters – wird an mehreren Stellen angezeigt. */
export const PROVIDER_LABELS: Record<SyncProviderKind, string> = {
  none: 'Kein Sync',
  local: 'Lokaler Ordner',
  webdav: 'WebDAV',
  gdrive: 'Google Drive',
};

// ─── Provider-Aufbau ─────────────────────────────────────────────────────────

export async function buildProvider(config: SyncConfig): Promise<SyncProvider> {
  switch (config.kind) {
    case 'local': {
      if (!config.localBase) throw new Error('Kein lokaler Sync-Ordner konfiguriert');
      return createLocalProvider(config.localBase);
    }
    case 'webdav': {
      if (!config.webdavUrl || !config.webdavUser) throw new Error('WebDAV unvollständig konfiguriert');
      const password = (await secretLoad(SECRET_WEBDAV_PASSWORD)) ?? '';
      return createWebdavProvider(config.webdavUrl, config.webdavUser, password);
    }
    case 'gdrive': {
      const token = await syncSecrets.getDriveToken();
      if (!token) throw new Error('Google Drive ist nicht verbunden');
      return createGoogleDriveProvider(token, (t) => {
        void syncSecrets.setDriveToken(t);
      });
    }
    default:
      throw new Error('Kein Sync-Anbieter konfiguriert');
  }
}

// ─── Verschlüsselung initialisieren ──────────────────────────────────────────

async function setupEncryption(
  provider: SyncProvider,
  config: SyncConfig,
): Promise<EncryptionContext | null> {
  if (!config.encrypted) return null;
  const passphrase = await syncSecrets.getPassphrase();
  if (!passphrase) throw new Error('Verschlüsselung aktiv, aber keine Passphrase hinterlegt');

  // Salt aus dem Sync-Ordner laden oder neu anlegen (create-only gegen Races)
  let saltData = await provider.read('meta/encryption.json');
  if (saltData === null) {
    const salt = generateSalt();
    const doc = new TextEncoder().encode(JSON.stringify({ v: 1, salt: bytesToBase64(salt) }));
    await provider.write('meta/encryption.json', doc, true);
    saltData = await provider.read('meta/encryption.json');
    if (saltData === null) throw new Error('Verschlüsselungs-Metadaten konnten nicht angelegt werden');
  }
  const parsed = JSON.parse(new TextDecoder().decode(saltData)) as { salt: string };
  const key = await deriveKey(passphrase, base64ToBytes(parsed.salt));
  const ctx: EncryptionContext = { key };

  const keycheck = await provider.read('meta/keycheck');
  if (keycheck === null) {
    await provider.write('meta/keycheck', await buildKeycheck(ctx), true);
  } else if (!(await verifyKeycheck(ctx, keycheck))) {
    throw new Error('Falsche Passphrase für diesen Sync-Ordner');
  }
  return ctx;
}

// ─── Listen (Zustand/localStorage) über die settings-Tabelle syncen ──────────

const LISTS_KEY = 'lists.data';
let lastWrittenLists = '';
let listsMirrorStarted = false;

function startListsMirror(): void {
  if (listsMirrorStarted) return;
  listsMirrorStarted = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  useListsStore.subscribe((state) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const json = JSON.stringify({ updatedAt: new Date().toISOString(), lists: state.lists });
      if (json === lastWrittenLists) return;
      lastWrittenLists = json;
      void setSetting(LISTS_KEY, json);
    }, 2000);
  });
}

async function hydrateListsFromSettings(): Promise<void> {
  const raw = await getSetting(LISTS_KEY);
  if (!raw || raw === lastWrittenLists) return;
  try {
    const parsed = JSON.parse(raw) as { updatedAt: string; lists: unknown };
    if (Array.isArray(parsed.lists)) {
      lastWrittenLists = raw;
      useListsStore.setState({ lists: parsed.lists as never });
    }
  } catch {
    // ungültige Daten ignorieren
  }
}

// ─── Nach dem Pull: UI mit den neuen Daten versorgen ─────────────────────────
//
// Ohne diesen Schritt landen fremde Änderungen zwar in der Datenbank, die
// laufende Oberfläche zeigt aber weiter den alten Stand (Zustand-Store und
// React-Query-Caches). Deshalb nach jedem Sync mit Zugängen alles auffrischen.

async function refreshAppData(result: SyncResult): Promise<void> {
  const incoming = result.pulledRows + result.pulledFiles;
  if (incoming === 0) return;

  // React-Query (Kunden, Projekte, Fahrtenbuch, Einstellungen …).
  // Bewusst nicht abgewartet: invalidateQueries() wartet auf die Refetches
  // aktiver Queries – der Sync gilt sonst erst als fertig, wenn auch die
  // langsamste Abfrage durch ist.
  void queryClient.invalidateQueries().catch(() => {});

  // Zustand-Stores, die nicht über React Query laufen
  try {
    useAppStore.getState().setInvoices(await getAllInvoices());
  } catch {
    // Datenbank kurzzeitig nicht lesbar – nächster Lauf holt es nach
  }
  try {
    const rows = await getAllDrafts();
    const drafts = await Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        filePath: await getAbsolutePdfPath(r.file_path),
        fileName: r.file_name,
        addedAt: r.added_at,
        relativePath: r.file_path,
      })),
    );
    useAppStore.getState().setDrafts(drafts);
  } catch {
    // s. o.
  }

  // Weckt alle Ansichten, die ihre Daten beim Mounten in lokalen State laden
  // (Kunden, Fahrtenbuch, Krankenkasse, Bankimport, Steuerbericht …).
  // Ohne das musste man die Seite einmal wechseln, damit die neuen Daten
  // sichtbar wurden.
  useAppStore.getState().bumpDataVersion();

  useSyncStatus.getState().set({
    lastIncoming: new Date().toISOString(),
    lastIncomingCount: incoming,
  });

  const parts: string[] = [];
  if (result.pulledRows > 0) parts.push(`${result.pulledRows} Datensätze`);
  if (result.pulledFiles > 0) parts.push(`${result.pulledFiles} Dateien`);
  toast.success(`Von anderen Geräten übernommen: ${parts.join(' · ')}`, {
    description: 'Die Ansicht wurde automatisch aktualisiert.',
  });
}

// ─── Haupt-Einstiegspunkt ────────────────────────────────────────────────────

let syncInFlight: Promise<SyncResult> | null = null;

export async function runSync(): Promise<SyncResult> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    const status = useSyncStatus.getState();
    status.set({ running: true, message: 'Sync startet …', lastError: null });
    try {
      const config = await loadSyncConfig();
      publishConfig(config);
      if (config.kind === 'none') throw new Error('Kein Sync-Anbieter konfiguriert');

      const db = await getDb();
      await initSyncTracking(db);
      const device = await getDeviceId(db);
      useSyncStatus.getState().set({ deviceId: device });
      const provider = await buildProvider(config);
      const enc = await setupEncryption(provider, config);

      const ctx: EngineContext = {
        db,
        provider,
        device,
        enc,
        progress: (message) => useSyncStatus.getState().set({ message }),
      };
      const result = await runSyncCycle(ctx);

      await hydrateListsFromSettings();
      await refreshAppData(result);

      const now = new Date().toISOString();
      await setMeta(db, 'last_sync', now);
      useSyncStatus.getState().set({
        running: false,
        message: '',
        lastSync: now,
        lastResult: result,
      });
      return result;
    } catch (err) {
      useSyncStatus.getState().set({
        running: false,
        message: '',
        lastError: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      syncInFlight = null;
    }
  })();
  return syncInFlight;
}

/**
 * Manuell angestoßener Sync mit einheitlichem Nutzer-Feedback.
 * Eingehende Änderungen melden sich selbst (siehe refreshAppData) – hier wird
 * nur quittiert, was sonst unsichtbar bliebe.
 */
export async function syncNow(): Promise<SyncResult | null> {
  try {
    const result = await runSync();
    const incoming = result.pulledRows + result.pulledFiles;
    const outgoing = result.pushedRows + result.pushedFiles;
    if (incoming === 0) {
      toast.success(
        outgoing > 0
          ? `Sync abgeschlossen – ${outgoing} Änderungen hochgeladen`
          : 'Sync abgeschlossen – alles auf dem neuesten Stand',
      );
    }
    return result;
  } catch (e) {
    toast.error(`Sync fehlgeschlagen: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

/** Verbindungstest ohne Datenübertragung (schreibt/prüft nur Metadaten). */
export async function testSyncConnection(config: SyncConfig): Promise<void> {
  const provider = await buildProvider(config);
  await provider.list('changes');
  await setupEncryption(provider, config);
}

// ─── Auto-Sync ───────────────────────────────────────────────────────────────

let autoSyncStarted = false;

export async function initAutoSync(): Promise<void> {
  if (autoSyncStarted) return;
  autoSyncStarted = true;

  startListsMirror();

  const config = await loadSyncConfig();
  publishConfig(config);
  if (config.kind === 'none') return;

  // Tracking sofort initialisieren, damit Trigger alle Änderungen erfassen
  try {
    const db = await getDb();
    await initSyncTracking(db);
    const last = await getMeta(db, 'last_sync');
    if (last) useSyncStatus.getState().set({ lastSync: last });
    useSyncStatus.getState().set({ deviceId: await getDeviceId(db) });
  } catch {
    // DB noch nicht bereit – Sync-Lauf initialisiert später erneut
  }

  const safeRun = () => {
    void runSync().catch(() => {
      // Fehler stehen im Status-Store; Auto-Sync soll still weiterlaufen
    });
  };

  // Initialer Sync kurz nach dem Start
  setTimeout(safeRun, 4000);

  if (config.autoSync) {
    const intervalMs = Math.max(2, config.intervalMin) * 60_000;
    setInterval(safeRun, intervalMs);

    // Zusätzlich beim Zurückkehren in die App. Auf dem Handy feuert 'focus'
    // nicht zuverlässig – dort greift 'visibilitychange'.
    const runIfStale = () => {
      const s = useSyncStatus.getState();
      const lastMs = s.lastSync ? Date.parse(s.lastSync) : 0;
      if (!s.running && Date.now() - lastMs > 60_000) safeRun();
    };
    window.addEventListener('focus', runIfStale);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') runIfStale();
    });
  }
}
