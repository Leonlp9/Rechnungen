import { invoke } from '@tauri-apps/api/core';

const SERVICE = 'rechnungsmanager';

export async function keyringSave(key: string, value: string): Promise<void> {
  await invoke<void>('keyring_set', { service: SERVICE, key, value });
}

export async function keyringLoad(key: string): Promise<string | null> {
  return await invoke<string | null>('keyring_get', { service: SERVICE, key });
}

export async function keyringDelete(key: string): Promise<void> {
  await invoke<void>('keyring_delete', { service: SERVICE, key });
}

