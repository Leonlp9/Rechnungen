import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Invoice } from '@/types';

export type AppTheme = 'default' | 'apple26' | 'liquid-glass' | 'oneui' | 'windows11';

/**
 * Alle wählbaren Themes. Die früheren Farbvarianten (zinc, stone, chroma,
 * aurora-borealis, crimson-dusk) sind entfallen – sie tauschten nur Farben,
 * ohne der App eine eigene Formensprache zu geben. Geblieben sind die vier
 * Bauweisen: schlicht, Apple, Samsung One UI, Windows.
 */
export const APP_THEMES: AppTheme[] = ['default', 'apple26', 'liquid-glass', 'oneui', 'windows11'];

/** Fällt auf „default" zurück, wenn ein entferntes Theme gespeichert war. */
export function normalizeTheme(theme: unknown): AppTheme {
  return APP_THEMES.includes(theme as AppTheme) ? (theme as AppTheme) : 'default';
}
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
  /**
   * Zählt hoch, sobald von außen neue Daten in die Datenbank gekommen sind
   * (Cloud-Sync, Währungsumrechnung). Komponenten, die ihre Daten beim Mounten
   * in lokalen State laden, hängen diesen Wert in ihre Dependency-Liste und
   * laden dadurch automatisch neu – ohne dass man die Seite wechseln muss.
   */
  dataVersion: number;
  bumpDataVersion: () => void;
  drafts: InvoiceDraft[];
  setDrafts: (drafts: InvoiceDraft[]) => void;
  addDraft: (draft: InvoiceDraft) => void;
  removeDraft: (id: string) => void;
  clearDrafts: () => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  selectedMonth: number;
  setSelectedMonth: (month: number) => void;
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
  /** Konfigurierbarer Grundfreibetrag für Steuerrücklage-Berechnung */
  grundfreibetrag: number;
  setGrundfreibetrag: (v: number) => void;
  /** Km-Pauschale für Fahrtenbuch (Standard: 0,30 €/km) */
  kmPauschale: number;
  setKmPauschale: (v: number) => void;
  /** KI-Chat Float ein-/ausblenden */
  showAiChat: boolean;
  setShowAiChat: (v: boolean) => void;
  /** Erklärungssymbole (ⓘ) für Fachbegriffe ein-/ausblenden */
  /**
   * true, solange eine Seite eine eigene große Überschrift zeigt. Die
   * Kopfleiste wird dann von dieser Überschrift gerendert (direkt darunter,
   * damit sie beim Scrollen von unten nach oben wandert und dort hängen
   * bleibt) – das Layout lässt sie dann weg, sonst gäbe es sie doppelt.
   */
  pageHeaderMounted: boolean;
  setPageHeaderMounted: (mounted: boolean) => void;
  showGlossarTooltips: boolean;
  setShowGlossarTooltips: (v: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      invoices: [],
      setInvoices: (invoices) => set({ invoices }),
      dataVersion: 0,
      bumpDataVersion: () => set((st) => ({ dataVersion: st.dataVersion + 1 })),
      drafts: [],
      setDrafts: (drafts) => set({ drafts }),
      addDraft: (draft) => set((s) => ({ drafts: [...s.drafts, draft] })),
      removeDraft: (id) => set((s) => ({ drafts: s.drafts.filter((d) => d.id !== id) })),
      clearDrafts: () => set({ drafts: [] }),
      selectedYear: new Date().getFullYear(),
      setSelectedYear: (selectedYear) => set({ selectedYear }),
      selectedMonth: new Date().getMonth() + 1,
      setSelectedMonth: (selectedMonth) => set({ selectedMonth }),
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      darkMode: false,
      setDarkMode: (darkMode) => set({ darkMode }),
      theme: 'default' as AppTheme,
      setTheme: (theme) => set({ theme: normalizeTheme(theme) }),
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
      rechtsform: 'freiberufler' as Rechtsform,
      setRechtsform: (rechtsform) => set({ rechtsform }),
      branchenprofil: 'standard' as Branchenprofil,
      setBranchenprofil: (branchenprofil) => set({ branchenprofil }),
      activeAiFix: null,
      setActiveAiFix: (activeAiFix) => set({ activeAiFix }),
      grundfreibetrag: 12_348,
      setGrundfreibetrag: (grundfreibetrag) => set({ grundfreibetrag }),
      kmPauschale: 0.30,
      setKmPauschale: (kmPauschale) => set({ kmPauschale }),
      showAiChat: true,
      setShowAiChat: (showAiChat) => set({ showAiChat }),
      pageHeaderMounted: false,
      setPageHeaderMounted: (pageHeaderMounted) => set({ pageHeaderMounted }),
      showGlossarTooltips: true,
      setShowGlossarTooltips: (showGlossarTooltips) => set({ showGlossarTooltips }),
    }),
    {
      name: 'Klevr-settings',
      partialize: (state) => ({ privacyMode: state.privacyMode, darkMode: state.darkMode, theme: state.theme, animations: state.animations, hiddenNavItems: state.hiddenNavItems, steuerregelung: state.steuerregelung, taetigkeitsart: state.taetigkeitsart, rechtsform: state.rechtsform, branchenprofil: state.branchenprofil, grundfreibetrag: state.grundfreibetrag, kmPauschale: state.kmPauschale, showAiChat: state.showAiChat, showGlossarTooltips: state.showGlossarTooltips }),
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as object), drafts: [] };
        // Ein entferntes Theme im gespeicherten Zustand würde sonst eine
        // Klasse setzen, zu der es keine Regeln mehr gibt.
        return { ...merged, theme: normalizeTheme(merged.theme) };
      },
    }
  )
);
