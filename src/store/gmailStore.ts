import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GmailToken, GmailMessage } from '@/lib/gmail';

export interface GmailAccount {
  email: string;
  token: GmailToken;
  emails: GmailMessage[];
  nextPageToken?: string;
}

interface GmailState {
  accounts: GmailAccount[];
  activeIndex: number;
  selectedEmail: GmailMessage | null;
  isLoading: boolean;
  isFetchingDetail: boolean;

  // account management
  addOrUpdateAccount: (account: GmailAccount) => void;
  removeAccount: (email: string) => void;
  setActiveIndex: (i: number) => void;
  updateAccountToken: (email: string, token: GmailToken) => void;
  updateAccountEmails: (email: string, emails: GmailMessage[], nextPageToken?: string) => void;

  // active account helpers (derived)
  setSelectedEmail: (email: GmailMessage | null) => void;
  setLoading: (v: boolean) => void;
  setFetchingDetail: (v: boolean) => void;
}

export const useGmailStore = create<GmailState>()(
  persist(
    (set) => ({
      accounts: [],
      activeIndex: 0,
      selectedEmail: null,
      isLoading: false,
      isFetchingDetail: false,

      addOrUpdateAccount: (account) =>
        set((s) => {
          const idx = s.accounts.findIndex((a) => a.email === account.email);
          if (idx >= 0) {
            const accounts = [...s.accounts];
            accounts[idx] = account;
            return { accounts, activeIndex: idx };
          }
          return { accounts: [...s.accounts, account], activeIndex: s.accounts.length };
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

      setSelectedEmail: (selectedEmail) => set({ selectedEmail }),
      setLoading: (isLoading) => set({ isLoading }),
      setFetchingDetail: (isFetchingDetail) => set({ isFetchingDetail }),
    }),
    {
      name: 'gmail-auth-v2',
      partialize: (state) => ({
        accounts: state.accounts
          .filter((a) => a.email && a.email !== 'Unbekannt')
          .map((a) => ({
            email: a.email,
            token: a.token,
            // Persist up to 50 emails per account as cache
            emails: a.emails.slice(0, 50),
            nextPageToken: a.nextPageToken,
          })),
        activeIndex: state.activeIndex,
      }),
    }
  )
);

// Selector helpers
export const selectActiveAccount = (s: GmailState) => s.accounts[s.activeIndex] ?? null;




