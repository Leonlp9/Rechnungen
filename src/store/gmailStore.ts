import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GmailToken, GmailMessage } from '@/lib/gmail';

export type MailAccountType = 'gmail' | 'imap';

export interface ImapConfig {
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  password: string;
}

export interface GmailAccount {
  type?: MailAccountType; // defaults to 'gmail' for backward compat
  email: string;
  token?: GmailToken;      // gmail only
  imapConfig?: ImapConfig; // imap only
  emails: GmailMessage[];
  nextPageToken?: string;  // gmail pagination
  imapPage?: number;       // imap pagination
  imapHasMore?: boolean;
  readEmailIds: string[];
}

interface GmailState {
  accounts: GmailAccount[];
  activeIndex: number;
  selectedEmail: GmailMessage | null;
  isLoading: boolean;
  isFetchingDetail: boolean;
  /** In "Alle Postfächer"-Modus: E-Mail-Adresse des Kontos, zu dem die angezeigte E-Mail gehört */
  detailAccountEmail: string | null;

  // account management
  addOrUpdateAccount: (account: GmailAccount) => void;
  removeAccount: (email: string) => void;
  setActiveIndex: (i: number) => void;
  updateAccountToken: (email: string, token: GmailToken) => void;
  updateAccountEmails: (email: string, emails: GmailMessage[], nextPageToken?: string) => void;
  markEmailAsRead: (accountEmail: string, messageId: string) => void;
  markEmailAsUnread: (accountEmail: string, messageId: string) => void;
  removeEmailFromList: (accountEmail: string, messageId: string) => void;

  // active account helpers (derived)
  setSelectedEmail: (email: GmailMessage | null) => void;
  setLoading: (v: boolean) => void;
  setFetchingDetail: (v: boolean) => void;
  setDetailAccountEmail: (email: string | null) => void;

  // Keyring-based IMAP password management
  loadImapPasswords: () => Promise<void>;
  saveImapAccount: (acc: GmailAccount) => Promise<void>;
}

export const useGmailStore = create<GmailState>()(
  persist(
    (set) => ({
      accounts: [],
      activeIndex: 0,
      selectedEmail: null,
      isLoading: false,
      isFetchingDetail: false,
      detailAccountEmail: null,

      addOrUpdateAccount: (account) =>
        set((s) => {
          const idx = s.accounts.findIndex((a) => a.email === account.email);
          if (idx >= 0) {
            const accounts = [...s.accounts];
            // preserve existing readEmailIds
            accounts[idx] = { ...account, readEmailIds: s.accounts[idx].readEmailIds ?? [] };
            return { accounts, activeIndex: idx };
          }
          return { accounts: [...s.accounts, { ...account, readEmailIds: [] }], activeIndex: s.accounts.length };
        }),

      removeAccount: (email) =>
        set((s) => {
          const accounts = s.accounts.filter((a) => a.email !== email);
          return {
            accounts,
            activeIndex: Math.min(s.activeIndex, Math.max(0, accounts.length - 1)),
            selectedEmail: null,
          };
        }),

      setActiveIndex: (activeIndex) => set({ activeIndex, selectedEmail: null }),

      updateAccountToken: (email, token) =>
        set((s) => ({
          accounts: s.accounts.map((a) => (a.email === email ? { ...a, token } : a)),
        })),

      updateAccountEmails: (email, emails, nextPageToken) =>
        set((s) => ({
          accounts: s.accounts.map((a) =>
            a.email === email ? { ...a, emails, nextPageToken } : a
          ),
        })),

      markEmailAsRead: (accountEmail, messageId) =>
        set((s) => ({
          accounts: s.accounts.map((a) =>
            a.email === accountEmail
              ? {
                  ...a,
                  readEmailIds: a.readEmailIds.includes(messageId)
                    ? a.readEmailIds
                    : [...a.readEmailIds, messageId],
                  emails: a.emails.map((e) =>
                    e.id === messageId ? { ...e, isUnread: false } : e
                  ),
                }
              : a
          ),
        })),

      setSelectedEmail: (selectedEmail) => set({ selectedEmail }),

      markEmailAsUnread: (accountEmail, messageId) =>
        set((s) => ({
          accounts: s.accounts.map((a) =>
            a.email === accountEmail
              ? {
                  ...a,
                  readEmailIds: a.readEmailIds.filter((id) => id !== messageId),
                  emails: a.emails.map((e) =>
                    e.id === messageId ? { ...e, isUnread: true } : e
                  ),
                }
              : a
          ),
        })),

      setLoading: (isLoading) => set({ isLoading }),
      setFetchingDetail: (isFetchingDetail) => set({ isFetchingDetail }),
      setDetailAccountEmail: (detailAccountEmail) => set({ detailAccountEmail }),

      removeEmailFromList: (accountEmail, messageId) =>
        set((s) => ({
          accounts: s.accounts.map((a) =>
            a.email === accountEmail
              ? { ...a, emails: a.emails.filter((e) => e.id !== messageId) }
              : a
          ),
          selectedEmail: s.selectedEmail?.id === messageId ? null : s.selectedEmail,
        })),

      loadImapPasswords: async () => {
        const { keyringLoad } = await import('@/lib/keyring');
        const accounts = useGmailStore.getState().accounts;
        const updated = await Promise.all(
          accounts.map(async (acc) => {
            if (acc.type !== 'imap' || !acc.imapConfig) return acc;
            const password = await keyringLoad(`imap_password_${acc.email}`).catch(() => null);
            return {
              ...acc,
              imapConfig: { ...acc.imapConfig, password: password ?? '' },
            };
          })
        );
        set({ accounts: updated });
      },

      saveImapAccount: async (acc) => {
        const { keyringSave } = await import('@/lib/keyring');
        if (acc.imapConfig?.password) {
          await keyringSave(`imap_password_${acc.email}`, acc.imapConfig.password);
        }
        const safeAcc = {
          ...acc,
          imapConfig: acc.imapConfig ? { ...acc.imapConfig, password: '' } : undefined,
        };
        set((s) => ({
          accounts: [...s.accounts.filter((a) => a.email !== acc.email), safeAcc],
        }));
      },
    }),
    {
      name: 'gmail-auth-v2',
      partialize: (state) => ({
        accounts: state.accounts
          .filter((a) => a.email && a.email !== 'Unbekannt')
          .map((a) => ({
            type: a.type ?? 'gmail',
            email: a.email,
            token: a.token,
            imapConfig: a.imapConfig
              ? { ...a.imapConfig, password: '' }
              : undefined,
            emails: a.emails.slice(0, 50),
            nextPageToken: a.nextPageToken,
            imapPage: a.imapPage,
            imapHasMore: a.imapHasMore,
            readEmailIds: a.readEmailIds ?? [],
          })),
        activeIndex: state.activeIndex,
      }),
    }
  )
);

// Selector helpers
export const selectActiveAccount = (s: GmailState) => s.accounts[s.activeIndex] ?? null;


