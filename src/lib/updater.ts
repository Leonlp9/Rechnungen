// Update-Prüfung und -Installation.
//
// Desktop: Der Tauri-Updater lädt und installiert selbst, danach Neustart.
//
// Android: Den Updater gibt es dort nicht. Bisher öffnete die App nur den
// GitHub-Link – herunterladen und installieren blieb Handarbeit. Jetzt lädt
// sie die APK selbst (in Rust, siehe update_commands.rs) und übergibt sie an
// den Paket-Installer des Systems. Die letzte Bestätigung („Aktualisieren")
// bleibt beim Nutzer – Android lässt eine stille Installation für
// App-Fremdquellen nicht zu, und das ist auch gut so.
//
// Wichtig fürs Wiederholen: Die fertige Datei bleibt liegen. Ein zweiter
// Anlauf öffnet sie erneut, statt dieselben Megabytes nochmal zu laden.

import { check, type Update } from '@tauri-apps/plugin-updater';
import { toast } from 'sonner';
import type { UpdatePhase } from '@/components/UpdateDialog';
import { getVersion } from '@tauri-apps/api/app';
import { openUrl, openPath } from '@tauri-apps/plugin-opener';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { appDataDir, join } from '@tauri-apps/api/path';

/** Android/iOS: Der Desktop-Updater existiert dort nicht (ACL-Fehler). */
const IS_MOBILE_OS = /android|iphone|ipad/i.test(navigator.userAgent);

const RELEASES_API = 'https://api.github.com/repos/Leonlp9/Rechnungen/releases/latest';
const RELEASES_PAGE = 'https://github.com/Leonlp9/Rechnungen/releases/latest';
/** Unterordner im App-Verzeichnis für heruntergeladene Update-Dateien */
const UPDATE_DIR = 'updates';

/** Vergleicht Versionen wie "0.9.2" numerisch. true = a ist neuer als b. */
function isNewerVersion(a: string, b: string): boolean {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

export interface UpdateState {
  open: boolean;
  version: string;
  releaseNotes?: string;
  phase: UpdatePhase;
  progress: number;
  /** true = Android-Ablauf (APK herunterladen und an den Installer geben) */
  mobile?: boolean;
  /** true = Datei liegt bereits vollständig vor, es wird nichts geladen */
  cached?: boolean;
  /** Menschenlesbarer Fehler aus dem letzten Versuch */
  error?: string;
}

type SetState = (s: Partial<UpdateState>) => void;

let _setState: SetState | null = null;
let _pendingUpdate: Update | null = null;

interface MobileUpdate {
  version: string;
  url: string;
  /** Erwartete Dateigröße laut GitHub – Prüfung auf Vollständigkeit */
  size: number;
  dir: string;
  fileName: string;
  path: string;
}
let _mobileUpdate: MobileUpdate | null = null;

/** Called from App.tsx to wire up the React setter */
export function registerUpdateSetter(fn: SetState) {
  _setState = fn;
}

// ─── Prüfung ────────────────────────────────────────────────────────────────

export async function checkForUpdates(silent = false) {
  if (IS_MOBILE_OS) {
    await checkForUpdatesMobile(silent);
    return;
  }
  try {
    const update = await check();
    if (!update) {
      if (!silent) toast.info('Keine Updates verfügbar. Du bist auf dem neuesten Stand!');
      return;
    }
    _pendingUpdate = update;
    _mobileUpdate = null;
    _setState?.({
      open: true,
      version: update.version,
      releaseNotes: update.body ?? undefined,
      phase: 'confirm',
      progress: 0,
      mobile: false,
      cached: false,
      error: undefined,
    });
  } catch (e) {
    if (!silent) toast.error('Update-Check fehlgeschlagen: ' + String(e));
    console.error('Update check failed:', e);
  }
}

interface GithubAsset {
  name?: string;
  size?: number;
  browser_download_url?: string;
}

/**
 * Android: neuestes GitHub-Release abfragen und – falls neuer – den
 * Update-Dialog öffnen. Der Download selbst startet erst auf Knopfdruck.
 */
async function checkForUpdatesMobile(silent: boolean): Promise<void> {
  try {
    const current = await getVersion();
    const res = await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(`GitHub antwortet mit ${res.status}`);
    const release = (await res.json()) as {
      tag_name?: string;
      body?: string;
      assets?: GithubAsset[];
    };
    const latest = (release.tag_name ?? '').replace(/^v/, '');

    if (!latest || !isNewerVersion(latest, current)) {
      if (!silent) toast.info('Keine Updates verfügbar. Du bist auf dem neuesten Stand!');
      return;
    }

    const apk = (release.assets ?? []).find((a) => (a.name ?? '').toLowerCase().endsWith('.apk'));
    if (!apk?.browser_download_url) {
      // Ohne APK im Release bleibt nur der alte Weg über die Release-Seite.
      toast.info(`Update ${latest} verfügbar (installiert: ${current})`, {
        duration: 12000,
        action: { label: 'Öffnen', onClick: () => { void openUrl(RELEASES_PAGE); } },
      });
      return;
    }

    const dir = await join(await appDataDir(), UPDATE_DIR);
    const fileName = apk.name ?? `klevr-${latest}.apk`;
    const path = await join(dir, fileName);

    // Liegt die Datei schon vollständig da? Dann wird sie nicht erneut geladen.
    const existing = await invoke<number>('downloaded_file_size', { path }).catch(() => 0);
    const cached = !!apk.size && existing === apk.size;

    _mobileUpdate = { version: latest, url: apk.browser_download_url, size: apk.size ?? 0, dir, fileName, path };
    _pendingUpdate = null;
    _setState?.({
      open: true,
      version: latest,
      releaseNotes: release.body ?? undefined,
      phase: 'confirm',
      progress: cached ? 100 : 0,
      mobile: true,
      cached,
      error: undefined,
    });
  } catch (e) {
    if (!silent) toast.error('Update-Check fehlgeschlagen: ' + String(e));
    console.error('Mobile update check failed:', e);
  }
}

// ─── Download / Installation ────────────────────────────────────────────────

export async function startDownload() {
  if (_mobileUpdate) {
    await startMobileUpdate();
    return;
  }
  if (!_pendingUpdate || !_setState) return;
  _setState({ phase: 'downloading', progress: 0, error: undefined });

  let downloaded = 0;
  let contentLength = 0;

  try {
    await _pendingUpdate.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          contentLength = event.data.contentLength ?? 0;
          break;
        case 'Progress':
          downloaded += event.data.chunkLength;
          if (contentLength > 0) {
            const pct = Math.min(99, Math.round((downloaded / contentLength) * 100));
            _setState?.({ progress: pct });
          }
          break;
        case 'Finished':
          _setState?.({ progress: 100, phase: 'done' });
          break;
      }
    });
  } catch (e) {
    toast.error('Download fehlgeschlagen: ' + String(e));
    _setState?.({ open: false });
  }
}

/**
 * Android: APK laden (falls nötig) und an den Paket-Installer übergeben.
 * Eine bereits vollständig geladene Datei wird direkt geöffnet.
 */
async function startMobileUpdate() {
  const update = _mobileUpdate;
  if (!update || !_setState) return;

  // Schon vollständig vorhanden → direkt öffnen, nichts erneut laden.
  const existing = await invoke<number>('downloaded_file_size', { path: update.path }).catch(() => 0);
  if (update.size > 0 && existing === update.size) {
    _setState({ phase: 'done', progress: 100, cached: true, error: undefined });
    await openInstaller();
    return;
  }

  _setState({ phase: 'downloading', progress: 0, error: undefined });

  let unlisten: UnlistenFn | null = null;
  try {
    unlisten = await listen<{ downloaded: number; total: number }>(
      'update-download-progress',
      (event) => {
        const { downloaded, total } = event.payload;
        if (total > 0) {
          _setState?.({ progress: Math.min(99, Math.round((downloaded / total) * 100)) });
        }
      },
    );

    await invoke('download_update', { url: update.url, dest: update.path });

    // Ältere APKs wegräumen – es muss nur die aktuelle liegen bleiben.
    await invoke('cleanup_update_files', { dir: update.dir, keepFileName: update.fileName }).catch(() => {});

    _setState({ phase: 'done', progress: 100, cached: true, error: undefined });
    await openInstaller();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    _setState({ phase: 'confirm', progress: 0, error: message });
    toast.error('Download fehlgeschlagen', { description: message });
  } finally {
    unlisten?.();
  }
}

/**
 * Übergibt die geladene APK ans System. Klappt das nicht (z. B. weil die
 * Installation aus dieser Quelle noch nicht erlaubt ist), bleibt die Datei
 * liegen – ein erneuter Versuch öffnet sie wieder, ohne neu zu laden.
 */
export async function openInstaller() {
  if (!_mobileUpdate) return;
  try {
    await openPath(_mobileUpdate.path);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    _setState?.({ error: message });
    toast.error('Installation konnte nicht gestartet werden', { description: message });
  }
}

/** true, wenn gerade ein Android-Update ansteht (steuert die Beschriftungen). */
export function hasMobileUpdate(): boolean {
  return _mobileUpdate !== null;
}
