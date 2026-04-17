import { check, type Update } from '@tauri-apps/plugin-updater';
import { toast } from 'sonner';
import type { UpdatePhase } from '@/components/UpdateDialog';

export interface UpdateState {
  open: boolean;
  version: string;
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
  try {
    const update = await check();
    if (!update) {
      if (!silent) toast.info('Keine Updates verfügbar. Du bist auf dem neuesten Stand!');
      return;
    }
    _pendingUpdate = update;
    _setState?.({ open: true, version: update.version, phase: 'confirm', progress: 0 });
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
