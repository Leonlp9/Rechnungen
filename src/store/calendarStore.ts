import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CalendarToken, GoogleCalendar } from '@/lib/googleCalendar';

export interface CalendarAccount {
  email: string;
  token: CalendarToken;
  calendars: GoogleCalendar[];
  selectedCalendarIds: string[];
}

interface CalendarState {
  accounts: CalendarAccount[];
  addOrUpdateAccount: (account: CalendarAccount) => void;
  removeAccount: (email: string) => void;
  updateToken: (email: string, token: CalendarToken) => void;
  updateCalendars: (email: string, calendars: GoogleCalendar[]) => void;
  setSelectedCalendarIds: (email: string, ids: string[]) => void;
  toggleCalendar: (email: string, calendarId: string) => void;
}

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set) => ({
      accounts: [],

      addOrUpdateAccount: (account) =>
        set((s) => {
          const idx = s.accounts.findIndex((a) => a.email === account.email);
          if (idx >= 0) {
            const accounts = [...s.accounts];
            accounts[idx] = { ...accounts[idx], token: account.token };
            return { accounts };
          }
          return { accounts: [...s.accounts, account] };
        }),

      removeAccount: (email) =>
        set((s) => ({ accounts: s.accounts.filter((a) => a.email !== email) })),

      updateToken: (email, token) =>
        set((s) => ({
          accounts: s.accounts.map((a) => (a.email === email ? { ...a, token } : a)),
        })),

      updateCalendars: (email, calendars) =>
        set((s) => ({
          accounts: s.accounts.map((a) => {
            if (a.email !== email) return a;
            // On first load, pre-select all calendars
            const selectedCalendarIds =
              a.calendars.length > 0
                ? a.selectedCalendarIds
                : calendars.filter((c) => c.selected !== false).map((c) => c.id);
            return { ...a, calendars, selectedCalendarIds };
          }),
        })),

      setSelectedCalendarIds: (email, ids) =>
        set((s) => ({
          accounts: s.accounts.map((a) =>
            a.email === email ? { ...a, selectedCalendarIds: ids } : a
          ),
        })),

      toggleCalendar: (email, calendarId) =>
        set((s) => ({
          accounts: s.accounts.map((a) => {
            if (a.email !== email) return a;
            const ids = a.selectedCalendarIds.includes(calendarId)
              ? a.selectedCalendarIds.filter((id) => id !== calendarId)
              : [...a.selectedCalendarIds, calendarId];
            return { ...a, selectedCalendarIds: ids };
          }),
        })),
    }),
    {
      name: 'calendar-accounts-v1',
      partialize: (state) => ({
        accounts: state.accounts.map((a) => ({
          email: a.email,
          token: a.token,
          calendars: a.calendars,
          selectedCalendarIds: a.selectedCalendarIds,
        })),
      }),
    }
  )
);

