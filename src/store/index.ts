import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Invoice } from '@/types';

export type AppTheme = 'default' | 'liquid-glass' | 'aurora-borealis' | 'crimson-dusk' | 'zinc' | 'stone' | 'windows11' | 'chroma';
export type Steuerregelung = 'kleinunternehmer' | 'regelbesteuerung';
export type Taetigkeitsart = 'freiberufler' | 'gewerbetreibend' | 'content_creator';
export type Rechtsform = 'freiberufler' | 'gewerbetreibend';
export type Branchenprofil = 'standard' | 'content_creator' | 'ecommerce' | 'handwerk' | 'beratung';

export interface InvoiceDraft {
  id: string;
  filePath: string;
  relativePath?: string;
  fileName: string;
  addedAt: string;
}

export interface ActiveAiFix {
  invoiceId: string;
  fields: Array<'category' | 'type'>;
  loading: boolean;
}

interface AppState {
  invoices: Invoice[];
  setInvoices: (invoices: Invoice[]) => void;
  drafts: InvoiceDraft[];
  setDrafts: (drafts: InvoiceDraft[]) => void;
  addDraft: (draft: InvoiceDraft) => void;
  removeDraft: (id: string) => void;
  clearDrafts: () => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  darkMode: boolean;
  setDarkMode: (darkMode: boolean) => void;
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  animations: boolean;
  setAnimations: (animations: boolean) => void;
  privacyMode: boolean;
  togglePrivacyMode: () => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  hiddenNavItems: string[];
  setHiddenNavItems: (items: string[]) => void;
  toggleNavItem: (path: string) => void;
  steuerregelung: Steuerregelung;
  setSteuerregelung: (r: Steuerregelung) => void;
  taetigkeitsart: Taetigkeitsart;
  setTaetigkeitsart: (t: Taetigkeitsart) => void;
  rechtsform: Rechtsform;
  setRechtsform: (r: Rechtsform) => void;
  branchenprofil: Branchenprofil;
  setBranchenprofil: (b: Branchenprofil) => void;
  /** Laufender KI-Fix – wird in InvoiceDetail ausgeführt */
  activeAiFix: ActiveAiFix | null;
  setActiveAiFix: (fix: ActiveAiFix | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      invoices: [],
      setInvoices: (invoices) => set({ invoices }),
      drafts: [],
      setDrafts: (drafts) => set({ drafts }),
      addDraft: (draft) => set((s) => ({ drafts: [...s.drafts, draft] })),
      removeDraft: (id) => set((s) => ({ drafts: s.drafts.filter((d) => d.id !== id) })),
      clearDrafts: () => set({ drafts: [] }),
      selectedYear: new Date().getFullYear(),
      setSelectedYear: (selectedYear) => set({ selectedYear }),
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      darkMode: false,
      setDarkMode: (darkMode) => set({ darkMode }),
      theme: 'default' as AppTheme,
      setTheme: (theme) => set({ theme }),
      animations: true,
      setAnimations: (animations) => set({ animations }),
      privacyMode: false,
      togglePrivacyMode: () => set((s) => ({ privacyMode: !s.privacyMode })),
      searchOpen: false,
      setSearchOpen: (searchOpen) => set({ searchOpen }),
      hiddenNavItems: [],
      setHiddenNavItems: (hiddenNavItems) => set({ hiddenNavItems }),
      toggleNavItem: (path) =>
        set((s) => ({
          hiddenNavItems: s.hiddenNavItems.includes(path)
            ? s.hiddenNavItems.filter((p) => p !== path)
            : [...s.hiddenNavItems, path],
        })),
      steuerregelung: 'kleinunternehmer' as Steuerregelung,
      setSteuerregelung: (steuerregelung) => set({ steuerregelung }),
      taetigkeitsart: 'gewerbetreibend' as Taetigkeitsart,
      setTaetigkeitsart: (taetigkeitsart) => set({ taetigkeitsart }),
      rechtsform: 'gewerbetreibend' as Rechtsform,
      setRechtsform: (rechtsform) => set({ rechtsform }),
      branchenprofil: 'standard' as Branchenprofil,
      setBranchenprofil: (branchenprofil) => set({ branchenprofil }),
      activeAiFix: null,
      setActiveAiFix: (activeAiFix) => set({ activeAiFix }),
    }),
    {
      name: 'rechnungs-manager-settings',
      partialize: (state) => ({ privacyMode: state.privacyMode, darkMode: state.darkMode, theme: state.theme, animations: state.animations, hiddenNavItems: state.hiddenNavItems, steuerregelung: state.steuerregelung, taetigkeitsart: state.taetigkeitsart, rechtsform: state.rechtsform, branchenprofil: state.branchenprofil }),
      merge: (persisted, current) => ({ ...current, ...(persisted as object), drafts: [] }),
    }
  )
);
