import { GMAIL_CLIENT_ID } from './gmail';
import { start as oauthStart, cancel as oauthCancel, onUrl } from '@fabianlars/tauri-plugin-oauth';
import { openUrl } from '@tauri-apps/plugin-opener';

const CALENDAR_CLIENT_SECRET = import.meta.env.VITE_GMAIL_CLIENT_SECRET as string;

export interface CalendarToken {
  access_token: string;
  refresh_token: string;
  expiry: number;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  colorId?: string;
  htmlLink?: string;
  allDay: boolean;
  startDate: Date;
  endDate: Date;
}

export interface GoogleCalendar {
  id: string;
  summary: string;
  backgroundColor?: string;
  foregroundColor?: string;
  primary?: boolean;
  selected?: boolean;
}

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

// ── OAuth for Calendar ─────────────────────────────────────────────────────

export async function startCalendarOAuthFlow(): Promise<CalendarToken> {
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
          const redirectUri = `http://127.0.0.1:${port}`;
          const res = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              code,
              client_id: GMAIL_CLIENT_ID,
              client_secret: CALENDAR_CLIENT_SECRET,
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
      client_id: GMAIL_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email',
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

export async function refreshCalendarToken(token: CalendarToken): Promise<CalendarToken> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      client_secret: CALENDAR_CLIENT_SECRET,
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

export async function getValidCalendarToken(
  token: CalendarToken,
  setToken: (t: CalendarToken) => void
): Promise<string> {
  if (Date.now() < token.expiry - 60_000) return token.access_token;
  const refreshed = await refreshCalendarToken(token);
  setToken(refreshed);
  return refreshed.access_token;
}

// ── Calendar API ───────────────────────────────────────────────────────────

export async function fetchCalendarUserEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return 'Unbekannt';
  const data = await res.json();
  return (data.email as string) ?? 'Unbekannt';
}

export async function fetchCalendars(accessToken: string): Promise<GoogleCalendar[]> {
  const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Kalender konnten nicht abgerufen werden');
  const data = await res.json();
  return (data.items ?? []) as GoogleCalendar[];
}

function parseLocalDate(dateStr: string): Date {
  // "2026-04-20" → local midnight (not UTC midnight)
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function parseEventDate(e: CalendarEvent): CalendarEvent {
  const allDay = !e.start.dateTime;
  const startDate = allDay
    ? parseLocalDate(e.start.date ?? '')
    : new Date(e.start.dateTime ?? '');
  const endDate = allDay
    ? parseLocalDate(e.end.date ?? '')
    : new Date(e.end.dateTime ?? '');
  return { ...e, allDay, startDate, endDate };
}

export async function fetchCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return ((data.items ?? []) as CalendarEvent[]).map(parseEventDate);
}

export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: {
    summary: string;
    description?: string;
    location?: string;
    start: string; // ISO
    end: string;   // ISO
    allDay?: boolean;
  }
): Promise<CalendarEvent> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const body = event.allDay
    ? {
        summary: event.summary,
        description: event.description || undefined,
        location: event.location || undefined,
        start: { date: event.start.slice(0, 10) },
        end: { date: event.end.slice(0, 10) },
      }
    : {
        summary: event.summary,
        description: event.description || undefined,
        location: event.location || undefined,
        start: { dateTime: event.start, timeZone },
        end: { dateTime: event.end, timeZone },
      };

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message ?? 'Termin konnte nicht erstellt werden');
  }
  return parseEventDate(await res.json());
}

export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
  );
  // 204 No Content = success, 404 = already deleted → both are fine
  if (!res.ok && res.status !== 404) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message ?? `Löschen fehlgeschlagen (${res.status})`);
  }
}





