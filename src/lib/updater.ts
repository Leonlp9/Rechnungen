import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { toast } from 'sonner';

export async function checkForUpdates(silent = false) {
  try {
    const update = await check();
    if (!update) {
      if (!silent) toast.info('Keine Updates verfügbar. Du bist auf dem neuesten Stand!');
      return;
    }

    const confirmed = window.confirm(
      `Ein neues Update ist verfügbar!\n\nVersion: ${update.version}\n\nJetzt herunterladen und installieren?`
    );

    if (!confirmed) return;

    toast.info('Update wird heruntergeladen...');

    let downloaded = 0;
    let contentLength = 0;

    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          contentLength = event.data.contentLength ?? 0;
          break;
        case 'Progress':
          downloaded += event.data.chunkLength;
          if (contentLength > 0) {
            const pct = Math.round((downloaded / contentLength) * 100);
            if (pct % 25 === 0) {
              toast.info(`Download: ${pct}%`);
            }
          }
          break;
        case 'Finished':
          toast.success('Update installiert! App wird neu gestartet...');
          break;
      }
    });

    await relaunch();
  } catch (e) {
    if (!silent) {
      toast.error('Update-Check fehlgeschlagen: ' + String(e));
    }
    console.error('Update check failed:', e);
  }
}

