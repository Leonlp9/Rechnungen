// Speicher-Provider für den Cloud-Sync.
//
// - LocalFolderProvider / WebdavProvider laufen über Rust-Commands
//   (atomare Schreibvorgänge; WebDAV umgeht CORS-Beschränkungen des WebViews).
// - GoogleDriveProvider nutzt die Drive-API v3 mit dem Scope drive.file
//   (die App sieht NUR die von ihr selbst erstellten Dateien).

import { invoke } from '@tauri-apps/api/core';
import { start as oauthStart, cancel as oauthCancel, onUrl } from '@fabianlars/tauri-plugin-oauth';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { RemoteEntry, SyncProvider } from './types';
import { base64ToBytes, bytesToBase64 } from './crypto';

// ─── Lokaler Ordner ──────────────────────────────────────────────────────────

interface RustStorageConfig {
  kind: 'local' | 'webdav';
  base?: string;
  url?: string;
  username?: string;
  password?: string;
}

class RustStorageProvider implements SyncProvider {
  constructor(
    public kind: 'local' | 'webdav',
    private config: RustStorageConfig,
  ) {}

  async list(prefix: string): Promise<RemoteEntry[]> {
    return invoke<RemoteEntry[]>('sync_storage_list', { config: this.config, prefix });
  }

  async read(path: string): Promise<Uint8Array | null> {
    const b64 = await invoke<string | null>('sync_storage_read', { config: this.config, path });
    return b64 === null ? null : base64ToBytes(b64);
  }

  async write(path: string, data: Uint8Array, ifNotExists: boolean): Promise<boolean> {
    return invoke<boolean>('sync_storage_write', {
      config: this.config,
      path,
      dataB64: bytesToBase64(data),
      ifNotExists,
    });
  }

  async exists(path: string): Promise<boolean> {
    return invoke<boolean>('sync_storage_exists', { config: this.config, path });
  }
}

export function createLocalProvider(base: string): SyncProvider {
  return new RustStorageProvider('local', { kind: 'local', base });
}

export function createWebdavProvider(url: string, username: string, password: string): SyncProvider {
  return new RustStorageProvider('webdav', { kind: 'webdav', url, username, password });
}

// ─── Google Drive ────────────────────────────────────────────────────────────

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GMAIL_CLIENT_ID as string;
const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GMAIL_CLIENT_SECRET as string;
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_FOLDER_NAME = 'KlevrSync';

export interface DriveToken {
  access_token: string;
  refresh_token: string;
  expiry: number;
}

function b64urlFromBytes(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/** OAuth-Flow für Google Drive (PKCE, wie Gmail/Calendar). */
export async function startDriveOAuthFlow(): Promise<DriveToken> {
  const verifierBytes = new Uint8Array(64);
  crypto.getRandomValues(verifierBytes);
  const codeVerifier = b64urlFromBytes(verifierBytes);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  const codeChallenge = b64urlFromBytes(new Uint8Array(digest));

  return new Promise((resolve, reject) => {
    (async () => {
      let port: number;
      let unlisten: (() => void) | null = null;
      try {
        port = await oauthStart();
      } catch (e) {
        reject(e);
        return;
      }
      try {
        unlisten = await onUrl(async (url: string) => {
          if (unlisten) unlisten();
          const params = new URL(url).searchParams;
          const code = params.get('code');
          const error = params.get('error');
          await oauthCancel(port).catch(() => {});
          if (error || !code) {
            reject(new Error(error ?? 'Kein Authorization-Code erhalten'));
            return;
          }
          try {
            const redirectUri = `http://127.0.0.1:${port}`;
            const res = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
                code_verifier: codeVerifier,
              }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error_description ?? data.error ?? 'Token-Austausch fehlgeschlagen');
            resolve({
              access_token: data.access_token,
              refresh_token: data.refresh_token,
              expiry: Date.now() + data.expires_in * 1000,
            });
          } catch (e) {
            reject(e);
          }
        });
      } catch (e) {
        await oauthCancel(port).catch(() => {});
        reject(e);
        return;
      }

      const redirectUri = `http://127.0.0.1:${port}`;
      const authParams = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: DRIVE_SCOPE,
        access_type: 'offline',
        prompt: 'consent',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });
      try {
        await openUrl(`https://accounts.google.com/o/oauth2/v2/auth?${authParams}`);
      } catch (e) {
        if (unlisten) unlisten();
        await oauthCancel(port).catch(() => {});
        reject(e);
      }
    })();
  });
}

async function refreshDriveToken(token: DriveToken): Promise<DriveToken> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description ?? 'Google-Token-Refresh fehlgeschlagen');
  return {
    access_token: data.access_token,
    refresh_token: token.refresh_token,
    expiry: Date.now() + data.expires_in * 1000,
  };
}

function escapeDriveQuery(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Google-Drive-Provider. Alle Sync-Dateien liegen flach in einem Ordner
 * "KlevrSync"; der Dateiname ist der volle relative Pfad (z. B.
 * "changes/dev1/00000001.json"). Drive erlaubt "/" in Dateinamen.
 */
class GoogleDriveProvider implements SyncProvider {
  kind = 'gdrive' as const;
  private folderId: string | null = null;

  constructor(
    private token: DriveToken,
    private onTokenRefresh: (t: DriveToken) => void,
  ) {}

  private async accessToken(): Promise<string> {
    if (Date.now() >= this.token.expiry - 60_000) {
      this.token = await refreshDriveToken(this.token);
      this.onTokenRefresh(this.token);
    }
    return this.token.access_token;
  }

  private async api(path: string, init?: RequestInit): Promise<Response> {
    const at = await this.accessToken();
    const res = await fetch(`https://www.googleapis.com${path}`, {
      ...init,
      headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${at}` },
    });
    if (res.status === 401) {
      // Token abgelaufen/widerrufen → einmal refreshen und erneut versuchen
      this.token = await refreshDriveToken(this.token);
      this.onTokenRefresh(this.token);
      return fetch(`https://www.googleapis.com${path}`, {
        ...init,
        headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${this.token.access_token}` },
      });
    }
    return res;
  }

  private async ensureFolder(): Promise<string> {
    if (this.folderId) return this.folderId;
    const q = encodeURIComponent(
      `name = '${DRIVE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    );
    const res = await this.api(`/drive/v3/files?q=${q}&fields=files(id)`);
    if (!res.ok) throw new Error(`Google Drive nicht erreichbar (${res.status})`);
    const data = await res.json();
    if (data.files?.length) {
      this.folderId = data.files[0].id as string;
      return this.folderId;
    }
    const createRes = await this.api('/drive/v3/files?fields=id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    });
    if (!createRes.ok) throw new Error('Sync-Ordner in Google Drive konnte nicht angelegt werden');
    const created = await createRes.json();
    this.folderId = created.id as string;
    return this.folderId;
  }

  private async findByName(path: string): Promise<string | null> {
    const folderId = await this.ensureFolder();
    const q = encodeURIComponent(
      `'${folderId}' in parents and name = '${escapeDriveQuery(path)}' and trashed = false`,
    );
    const res = await this.api(`/drive/v3/files?q=${q}&fields=files(id)&pageSize=1`);
    if (!res.ok) throw new Error(`Google-Drive-Suche fehlgeschlagen (${res.status})`);
    const data = await res.json();
    return data.files?.[0]?.id ?? null;
  }

  async list(prefix: string): Promise<RemoteEntry[]> {
    const folderId = await this.ensureFolder();
    const out: RemoteEntry[] = [];
    let pageToken: string | undefined;
    do {
      const q = encodeURIComponent(
        `'${folderId}' in parents and name contains '${escapeDriveQuery(prefix)}' and trashed = false`,
      );
      const pt = pageToken ? `&pageToken=${pageToken}` : '';
      const res = await this.api(
        `/drive/v3/files?q=${q}&fields=nextPageToken,files(id,name,size)&pageSize=1000${pt}`,
      );
      if (!res.ok) throw new Error(`Google-Drive-Liste fehlgeschlagen (${res.status})`);
      const data = await res.json();
      for (const f of data.files ?? []) {
        const name = f.name as string;
        if (name.startsWith(prefix)) {
          out.push({ path: name, size: Number(f.size ?? 0) });
        }
      }
      pageToken = data.nextPageToken;
    } while (pageToken);
    return out;
  }

  async read(path: string): Promise<Uint8Array | null> {
    const id = await this.findByName(path);
    if (!id) return null;
    const res = await this.api(`/drive/v3/files/${id}?alt=media`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Google-Drive-Download fehlgeschlagen (${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  }

  async write(path: string, data: Uint8Array, ifNotExists: boolean): Promise<boolean> {
    const existingId = await this.findByName(path);
    if (existingId && ifNotExists) return false;

    const folderId = await this.ensureFolder();
    const boundary = `klevr${Date.now()}${Math.random().toString(36).slice(2)}`;
    const metadata = existingId
      ? {}
      : { name: path, parents: [folderId] };

    const head =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`;
    const tail = `\r\n--${boundary}--`;
    const headBytes = new TextEncoder().encode(head);
    const tailBytes = new TextEncoder().encode(tail);
    const body = new Uint8Array(headBytes.length + data.length + tailBytes.length);
    body.set(headBytes, 0);
    body.set(data, headBytes.length);
    body.set(tailBytes, headBytes.length + data.length);

    const url = existingId
      ? `/upload/drive/v3/files/${existingId}?uploadType=multipart`
      : '/upload/drive/v3/files?uploadType=multipart';
    const res = await this.api(url, {
      method: existingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Google-Drive-Upload fehlgeschlagen (${res.status}): ${text.slice(0, 200)}`);
    }
    return true;
  }

  async exists(path: string): Promise<boolean> {
    return (await this.findByName(path)) !== null;
  }
}

export function createGoogleDriveProvider(
  token: DriveToken,
  onTokenRefresh: (t: DriveToken) => void,
): SyncProvider {
  return new GoogleDriveProvider(token, onTokenRefresh);
}
