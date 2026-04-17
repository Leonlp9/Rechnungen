import { create } from 'zustand';
import type { Invoice } from '@/types';

interface AppState {
  invoices: Invoice[];
  setInvoices: (invoices: Invoice[]) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  invoices: [],
  setInvoices: (invoices) => set({ invoices }),
  selectedYear: new Date().getFullYear(),
  setSelectedYear: (selectedYear) => set({ selectedYear }),
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  darkMode: false,
  setDarkMode: (darkMode) => set({ darkMode }),
}));

