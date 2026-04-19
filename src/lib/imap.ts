import { invoke } from '@tauri-apps/api/core';
import type { GmailMessage } from './gmail';
import type { ImapConfig } from '@/store/gmailStore';

/** Fetch a page (30 emails) from an IMAP folder. */
export async function imapFetchEmails(
  config: ImapConfig,
  username: string,
  page: number,
  folder = 'INBOX'
): Promise<{ messages: GmailMessage[]; hasMore: boolean }> {
  const [messages, hasMore] = await invoke<[GmailMessage[], boolean]>('imap_fetch_emails', {
    host: config.imapHost,
    port: config.imapPort,
    username,
    password: config.password,
    page,
    folder,
  });
  return { messages, hasMore };
}

/** Fetch full email detail (body + attachments with data). */
export async function imapFetchEmailDetail(
  config: ImapConfig,
  username: string,
  uid: string,
  folder = 'INBOX'
): Promise<GmailMessage> {
  return invoke<GmailMessage>('imap_fetch_email_detail', {
    host: config.imapHost,
    port: config.imapPort,
    username,
    password: config.password,
    uid,
    folder,
  });
}

/** Mark an email as read via IMAP UID STORE. */
export async function imapMarkRead(
  config: ImapConfig,
  username: string,
  uid: string,
  folder = 'INBOX'
): Promise<void> {
  return invoke('imap_mark_read', {
    host: config.imapHost,
    port: config.imapPort,
    username,
    password: config.password,
    uid,
    folder,
  });
}

/** Delete an email via IMAP UID STORE \Deleted + EXPUNGE. */
export async function imapDeleteEmail(
  config: ImapConfig,
  username: string,
  uid: string,
  folder = 'INBOX',
): Promise<void> {
  return invoke('imap_delete_email', {
    host: config.imapHost,
    port: config.imapPort,
    username,
    password: config.password,
    uid,
    folder,
  });
}

/** Mark an email as unread via IMAP UID STORE -FLAGS \Seen. */
export async function imapMarkUnread(
  config: ImapConfig,
  username: string,
  uid: string,
  folder = 'INBOX',
): Promise<void> {
  return invoke('imap_mark_unread', {
    host: config.imapHost,
    port: config.imapPort,
    username,
    password: config.password,
    uid,
    folder,
  });
}

/** Toggle \Flagged flag on an IMAP email. */
export async function imapToggleFlag(
  config: ImapConfig,
  username: string,
  uid: string,
  flagged: boolean,
  folder = 'INBOX',
): Promise<void> {
  return invoke('imap_toggle_flag', {
    host: config.imapHost,
    port: config.imapPort,
    username,
    password: config.password,
    uid,
    flagged,
    folder,
  });
}

/** Send email via SMTP. */
export async function smtpSendEmail(
  config: ImapConfig,
  username: string,
  from: string,
  to: string,
  subject: string,
  bodyHtml: string
): Promise<void> {
  return invoke('smtp_send_email', {
    smtpHost: config.smtpHost,
    smtpPort: config.smtpPort,
    username,
    password: config.password,
    from,
    to,
    subject,
    bodyHtml,
  });
}

