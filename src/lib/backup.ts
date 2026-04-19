import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';

function getLocalStorageData(): string {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      data[key] = localStorage.getItem(key) ?? '';
    }
  }
  return JSON.stringify(data);
}

function restoreLocalStorageData(json: string): void {
  try {
    const data: Record<string, string> = JSON.parse(json);
    for (const [key, value] of Object.entries(data)) {
      localStorage.setItem(key, value);
    }
  } catch {
    // ignore parse errors
  }
}

export async function exportBackup(): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const destPath = await save({
      title: 'Backup speichern',
      defaultPath: `rechnungs-manager-backup-${new Date().toISOString().slice(0, 10)}.rmbackup`,
      filters: [
        { name: 'Rechnungs-Manager Backup', extensions: ['rmbackup'] },
      ],
    });

    if (!destPath) return { success: false };

    const localStorageJson = getLocalStorageData();
    await invoke('create_backup', {
      destPath,
      localStorageJson,
    });

    return { success: true, path: destPath };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function importBackup(
  filePath?: string,
): Promise<{ success: boolean; localStorageJson?: string; error?: string }> {
  try {
    let srcPath = filePath;
    if (!srcPath) {
      const selected = await open({
        title: 'Backup laden',
        multiple: false,
        filters: [
          { name: 'Rechnungs-Manager Backup', extensions: ['rmbackup'] },
        ],
      });
      if (!selected) return { success: false };
      srcPath = selected as string;
    }

    const localStorageJson = await invoke<string>('restore_backup', { srcPath });
    restoreLocalStorageData(localStorageJson);

    return { success: true, localStorageJson };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}


