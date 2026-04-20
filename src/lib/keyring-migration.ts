import { getSetting, setSetting } from '@/lib/db';
import { keyringSave } from '@/lib/keyring';

/**
 * One-time migration: move secrets from SQLite settings table to OS Keychain.
 */
export async function migrateSecretsToKeychain(): Promise<void> {
  const migrated = localStorage.getItem('secrets_migrated_v1');
  if (migrated) return;

  try {
    // Gemini API-Key
    const apiKey = await getSetting('gemini_api_key');
    if (apiKey) {
      await keyringSave('gemini_api_key', apiKey);
      await setSetting('gemini_api_key', '');
    }
  } catch (e) {
    console.warn('Keychain-Migration fehlgeschlagen (wird beim nächsten Start erneut versucht):', e);
    return; // Don't mark as done if it failed
  }

  localStorage.setItem('secrets_migrated_v1', 'true');
}

