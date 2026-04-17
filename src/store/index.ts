import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Invoice } from '@/types';

interface AppState {
  invoices: Invoice[];
  setInvoices: (invoices: Invoice[]) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  darkMode: boolean;
  setDarkMode: (darkMode: boolean) => void;
  privacyMode: boolean;
  togglePrivacyMode: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      invoices: [],
      setInvoices: (invoices) => set({ invoices }),
      selectedYear: new Date().getFullYear(),
      setSelectedYear: (selectedYear) => set({ selectedYear }),
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      darkMode: false,
      setDarkMode: (darkMode) => set({ darkMode }),
      privacyMode: false,
      togglePrivacyMode: () => set((s) => ({ privacyMode: !s.privacyMode })),
    }),
    {
      name: 'rechnungs-manager-settings',
      partialize: (state) => ({ privacyMode: state.privacyMode, darkMode: state.darkMode }),
    }
  )
);
