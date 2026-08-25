// Zugriff auf den OS-Schlüsselbund – mit Rückfallebene für Mobilgeräte.
//
// Die Rust-Kommandos keyring_set/_get/_delete sind in src-tauri/src/lib.rs mit
// #[cfg(desktop)] ausgeklammert: Android und iOS haben keinen OS-Keyring, dort
// sind sie also gar nicht erst kompiliert. Ein Aufruf scheitert deshalb mit
// „command keyring_set not found" – und der Gemini-API-Key ließ sich auf dem
// Handy weder speichern noch lesen.
//
// Beim ersten Fehlversuch wird dauerhaft auf die lokale Datenbank umgeschaltet
// (Präfix „secret.", vom Cloud-Sync ausgeschlossen – siehe
// isSettingKeyExcluded in src/lib/sync/tracking.ts). Auf dem Handy schützt
// dann die Geräteverschlüsselung, nicht der Schlüsselbund.

import { invoke } from '@tauri-apps/api/core';
import { getSetting, setSetting } from '@/lib/db';

const SERVICE = 'klevr';
const FALLBACK_PREFIX = 'secret.';

/** null = noch nicht geprüft, false = kein Keyring vorhanden (Mobile) */
let keyringAvailable: boolean | null = null;

/**
 * Erkennt, dass das Kommando gar nicht existiert bzw. nicht erlaubt ist.
 * Andere Fehler (z. B. gesperrter Schlüsselbund am Desktop) werden bewusst
 * NICHT abgefangen – sonst landeten Secrets dort still im Klartext.
 */
function isUnavailable(e: unknown): boolean {
  const msg = String((e as { message?: string })?.message ?? e ?? '');
  return /not\s*found|not\s*allowed|unknown command|missing/i.test(msg);
}

async function withFallback<T>(
  viaKeyring: () => Promise<T>,
  viaDatabase: () => Promise<T>,
): Promise<T> {
  if (keyringAvailable === false) return viaDatabase();
  try {
    const result = await viaKeyring();
    keyringAvailable = true;
    return result;
  } catch (e) {
    if (keyringAvailable === null && isUnavailable(e)) {
      keyringAvailable = false;
      return viaDatabase();
    }
    throw e;
  }
}

export async function keyringSave(key: string, value: string): Promise<void> {
  await withFallback(
    () => invoke<void>('keyring_set', { service: SERVICE, key, value }),
    () => setSetting(`${FALLBACK_PREFIX}${key}`, value),
  );
}

export async function keyringLoad(key: string): Promise<string | null> {
  return withFallback(
    () => invoke<string | null>('keyring_get', { service: SERVICE, key }),
    async () => (await getSetting(`${FALLBACK_PREFIX}${key}`)) || null,
  );
}

export async function keyringDelete(key: string): Promise<void> {
  await withFallback(
    () => invoke<void>('keyring_delete', { service: SERVICE, key }),
    () => setSetting(`${FALLBACK_PREFIX}${key}`, ''),
  );
}

/** true, sobald feststeht, dass kein OS-Schlüsselbund verfügbar ist. */
export function isKeyringFallbackActive(): boolean {
  return keyringAvailable === false;
}
