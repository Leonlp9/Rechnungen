// Orchestrierung des Cloud-Syncs: Konfiguration, Secrets, Status-Store,
// Auto-Sync und der öffentliche Einstiegspunkt runSync().

import { create } from 'zustand';
import { getDb, getSetting, setSetting } from '@/lib/db';
import { keyringLoad, keyringSave, keyringDelete } from '@/lib/keyring';
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
  set: (patch) => set(patch),
}));

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

// ─── Haupt-Einstiegspunkt ────────────────────────────────────────────────────

let syncInFlight: Promise<SyncResult> | null = null;

export async function runSync(): Promise<SyncResult> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    const status = useSyncStatus.getState();
    status.set({ running: true, message: 'Sync startet …', lastError: null });
    try {
      const config = await loadSyncConfig();
      if (config.kind === 'none') throw new Error('Kein Sync-Anbieter konfiguriert');

      const db = await getDb();
      await initSyncTracking(db);
      const device = await getDeviceId(db);
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
  if (config.kind === 'none') return;

  // Tracking sofort initialisieren, damit Trigger alle Änderungen erfassen
  try {
    const db = await getDb();
    await initSyncTracking(db);
    const last = await getMeta(db, 'last_sync');
    if (last) useSyncStatus.getState().set({ lastSync: last });
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
    // Zusätzlich beim Zurückkehren in die App
    window.addEventListener('focus', () => {
      const s = useSyncStatus.getState();
      const lastMs = s.lastSync ? Date.parse(s.lastSync) : 0;
      if (!s.running && Date.now() - lastMs > 60_000) safeRun();
    });
  }
}
