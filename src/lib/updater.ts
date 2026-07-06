import { check, type Update } from '@tauri-apps/plugin-updater';
import { toast } from 'sonner';
import type { UpdatePhase } from '@/components/UpdateDialog';
import { getVersion } from '@tauri-apps/api/app';
import { openUrl } from '@tauri-apps/plugin-opener';

/** Android/iOS: Der Desktop-Updater existiert dort nicht (ACL-Fehler). */
const IS_MOBILE_OS = /android|iphone|ipad/i.test(navigator.userAgent);

const RELEASES_API = 'https://api.github.com/repos/Leonlp9/Rechnungen/releases/latest';

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

/**
 * Update-Check für Android/iOS: fragt das neueste GitHub-Release ab und
 * verlinkt zum APK-Download (kein automatisches Installieren wie am Desktop).
 */
async function checkForUpdatesMobile(silent: boolean): Promise<void> {
  try {
    const current = await getVersion();
    const res = await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(`GitHub antwortet mit ${res.status}`);
    const release = (await res.json()) as { tag_name?: string; html_url?: string };
    const latest = (release.tag_name ?? '').replace(/^v/, '');
    if (latest && isNewerVersion(latest, current)) {
      toast.info(`Update ${latest} verfügbar (installiert: ${current})`, {
        duration: 12000,
        action: {
          label: 'Download',
          onClick: () => { void openUrl(release.html_url ?? 'https://github.com/Leonlp9/Rechnungen/releases/latest'); },
        },
      });
    } else if (!silent) {
      toast.info('Keine Updates verfügbar. Du bist auf dem neuesten Stand!');
    }
  } catch (e) {
    if (!silent) toast.error('Update-Check fehlgeschlagen: ' + String(e));
    console.error('Mobile update check failed:', e);
  }
}

export interface UpdateState {
  open: boolean;
  version: string;
  releaseNotes?: string;
  phase: UpdatePhase;
  progress: number;
}

type SetState = (s: Partial<UpdateState>) => void;

let _setState: SetState | null = null;
let _pendingUpdate: Update | null = null;

/** Called from App.tsx to wire up the React setter */
export function registerUpdateSetter(fn: SetState) {
  _setState = fn;
}

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
    _setState?.({ open: true, version: update.version, releaseNotes: update.body ?? undefined, phase: 'confirm', progress: 0 });
  } catch (e) {
    if (!silent) toast.error('Update-Check fehlgeschlagen: ' + String(e));
    console.error('Update check failed:', e);
  }
}

export async function startDownload() {
  if (!_pendingUpdate || !_setState) return;
  _setState({ phase: 'downloading', progress: 0 });

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
