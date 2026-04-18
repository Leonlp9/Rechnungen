import { invoke } from '@tauri-apps/api/core';
import type { GmailMessage } from './gmail';
import type { ImapConfig } from '@/store/gmailStore';

/** Fetch a page (30 emails) from the IMAP inbox. */
export async function imapFetchEmails(
  config: ImapConfig,
  username: string,
  page: number
): Promise<{ messages: GmailMessage[]; hasMore: boolean }> {
  const [messages, hasMore] = await invoke<[GmailMessage[], boolean]>('imap_fetch_emails', {
    host: config.imapHost,
    port: config.imapPort,
    username,
    password: config.password,
    page,
  });
  return { messages, hasMore };
}

/** Fetch full email detail (body + attachments with data). */
export async function imapFetchEmailDetail(
  config: ImapConfig,
  username: string,
  uid: string
): Promise<GmailMessage> {
  return invoke<GmailMessage>('imap_fetch_email_detail', {
    host: config.imapHost,
    port: config.imapPort,
    username,
    password: config.password,
    uid,
  });
}

/** Mark an email as read via IMAP UID STORE. */
export async function imapMarkRead(
  config: ImapConfig,
  username: string,
  uid: string
): Promise<void> {
  return invoke('imap_mark_read', {
    host: config.imapHost,
    port: config.imapPort,
    username,
    password: config.password,
    uid,
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

