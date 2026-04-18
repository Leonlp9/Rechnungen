import { start as oauthStart, cancel as oauthCancel, onUrl } from '@fabianlars/tauri-plugin-oauth';
import { openUrl } from '@tauri-apps/plugin-opener';

export const GMAIL_CLIENT_ID = import.meta.env.VITE_GMAIL_CLIENT_ID as string;
// The client_secret for a Desktop-app OAuth client is required by Google's token endpoint.
// It is loaded from the .env file at build time and never stored in source code.
const GMAIL_CLIENT_SECRET = import.meta.env.VITE_GMAIL_CLIENT_SECRET as string;

// ── PKCE helpers ───────────────────────────────────────────────────────────

function generateCodeVerifier(): string {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export interface GmailToken {
  access_token: string;
  refresh_token: string;
  expiry: number; // unix ms
}

export interface GmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  bodyHtml: string;
  bodyText: string;
  attachments: GmailAttachment[];
  hasAttachment: boolean;
}

// ── helpers ────────────────────────────────────────────────────────────────

function b64urlToUtf8(b64url: string): string {
  const base64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function getHeader(headers: { name: string; value: string }[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function extractParts(
  payload: any,
  attachments: GmailAttachment[]
): { html: string; text: string } {
  let html = '';
  let text = '';

  const processPart = (part: any) => {
    const mime: string = part.mimeType ?? '';
    if (part.parts) {
      part.parts.forEach(processPart);
      return;
    }
    if (part.body?.attachmentId) {
      const filename = part.filename || 'anhang';
      attachments.push({
        id: part.body.attachmentId,
        filename,
        mimeType: mime,
        size: part.body.size ?? 0,
      });
      return;
    }
    if (part.body?.data) {
      const decoded = b64urlToUtf8(part.body.data);
      if (mime === 'text/html') html = decoded;
      else if (mime === 'text/plain') text = decoded;
    }
  };

  if (payload.parts) {
    payload.parts.forEach(processPart);
  } else if (payload.body?.data) {
    const decoded = b64urlToUtf8(payload.body.data);
    if (payload.mimeType === 'text/html') html = decoded;
    else text = decoded;
  }

  return { html, text };
}

// ── OAuth ──────────────────────────────────────────────────────────────────

export async function startOAuthFlow(): Promise<GmailToken> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  return new Promise(async (resolve, reject) => {
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
          const token = await exchangeCode(code, port, codeVerifier);
          resolve(token);
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
      client_id: GMAIL_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email',
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
  });
}

async function exchangeCode(code: string, port: number, codeVerifier: string): Promise<GmailToken> {
  const redirectUri = `http://127.0.0.1:${port}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description ?? data.error ?? 'Token-Austausch fehlgeschlagen');
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry: Date.now() + data.expires_in * 1000,
  };
}

export async function refreshAccessToken(token: GmailToken): Promise<GmailToken> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description ?? 'Token-Refresh fehlgeschlagen');
  return {
    access_token: data.access_token,
    refresh_token: token.refresh_token,
    expiry: Date.now() + data.expires_in * 1000,
  };
}

export async function revokeToken(token: GmailToken): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${token.access_token}`, {
    method: 'POST',
  }).catch(() => {});
}

// ── Token helper ───────────────────────────────────────────────────────────

export async function getValidToken(
  token: GmailToken,
  setToken: (t: GmailToken) => void
): Promise<string> {
  if (Date.now() < token.expiry - 60_000) return token.access_token;
  const refreshed = await refreshAccessToken(token);
  setToken(refreshed);
  return refreshed.access_token;
}

export async function fetchUserEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return 'Unbekannt';
  const data = await res.json();
  return (data.email as string) ?? 'Unbekannt';
}



export async function fetchEmails(
  accessToken: string,
  maxResults = 30,
  pageToken?: string
): Promise<{ messages: GmailMessage[]; nextPageToken?: string }> {
  let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=in:inbox`;
  if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

  const listRes = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!listRes.ok) throw new Error('E-Mails konnten nicht abgerufen werden');
  const listData = await listRes.json();
  const messageRefs: { id: string }[] = listData.messages ?? [];
  const nextPageToken: string | undefined = listData.nextPageToken;

  const messages = await Promise.all(
    messageRefs.map(async ({ id }) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Content-Type`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!msgRes.ok) return null;
      const msg = await msgRes.json();
      const headers = msg.payload?.headers ?? [];
      const mimeType: string = msg.payload?.mimeType ?? '';
      const hasAttachment =
        mimeType.startsWith('multipart/mixed') ||
        mimeType.startsWith('multipart/related');
      return {
        id: msg.id,
        threadId: msg.threadId,
        from: getHeader(headers, 'from'),
        subject: getHeader(headers, 'subject'),
        date: getHeader(headers, 'date'),
        snippet: msg.snippet ?? '',
        bodyHtml: '',
        bodyText: '',
        attachments: [],
        hasAttachment,
      } as GmailMessage;
    })
  );

  return { messages: messages.filter(Boolean) as GmailMessage[], nextPageToken };
}

export async function fetchEmailDetail(
  accessToken: string,
  messageId: string
): Promise<GmailMessage> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error('E-Mail konnte nicht geladen werden');
  const msg = await res.json();
  const headers: { name: string; value: string }[] = msg.payload?.headers ?? [];
  const attachments: GmailAttachment[] = [];
  const { html, text } = extractParts(msg.payload, attachments);

  return {
    id: msg.id,
    threadId: msg.threadId,
    from: getHeader(headers, 'from'),
    subject: getHeader(headers, 'subject'),
    date: getHeader(headers, 'date'),
    snippet: msg.snippet ?? '',
    bodyHtml: html,
    bodyText: text,
    attachments,
    hasAttachment: attachments.length > 0,
  };
}

export async function fetchAttachmentData(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<string> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error('Anhang konnte nicht geladen werden');
  const data = await res.json();
  // Google returns base64url – convert to standard base64
  return (data.data as string).replace(/-/g, '+').replace(/_/g, '/');
}
















