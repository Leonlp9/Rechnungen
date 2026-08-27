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
export type Rechtsform = 'freiberufler' | 'gewerbetreibend' | 'angestellt';
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
  /**
   * Gewählte Farbgebung. `auto` folgt dem Betriebssystem – dort wird sie oft
   * nach Tageszeit umgeschaltet, und die App soll dann mitziehen.
   */
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  /** Hell → Dunkel → Automatisch → Hell (ein Knopf, drei Zustände) */
  cycleThemeMode: () => void;
  /** Meldet, was das System gerade möchte – wirkt nur im Modus `auto`. */
  syncSystemTheme: (prefersDark: boolean) => void;
  /** Was tatsächlich angezeigt wird – aus Modus und System abgeleitet. */
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
  rechtsform: Rechtsform;
  setRechtsform: (r: Rechtsform) => void;
  branchenprofil: Branchenprofil;
  setBranchenprofil: (b: Branchenprofil) => void;
  /** Laufender KI-Fix – wird in InvoiceDetail ausgeführt */
  activeAiFix: ActiveAiFix | null;
  setActiveAiFix: (fix: ActiveAiFix | null) => void;
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
  /** Einfache Entfernung zur Arbeit in km – Grundlage der Pendlerpauschale */
  pendlerKm: number;
  setPendlerKm: (km: number) => void;
  /** Tage im Büro im Steuerjahr */
  pendlerTage: number;
  setPendlerTage: (tage: number) => void;
  /** Tage im Homeoffice im Steuerjahr */
  homeofficeTage: number;
  setHomeofficeTage: (tage: number) => void;
  showGlossarTooltips: boolean;
  setShowGlossarTooltips: (v: boolean) => void;

  // ── Steuerprofil ─────────────────────────────────────────────────────────
  // Diese Angaben entscheiden über Beitragssätze, Freibeträge und
  // Abzugsgrenzen. Vorher waren sie fest verdrahtet und galten für alle
  // gleich – jetzt stellt jeder ein, was auf ihn zutrifft.
  /** Zusammenveranlagt? Verdoppelt den Grundfreibetrag und ändert die zumutbare Belastung. */
  verheiratet: boolean;
  setVerheiratet: (v: boolean) => void;
  /** Zahl der Kinder – wirkt auf zumutbare Belastung und Pflegeversicherung. */
  kinder: number;
  setKinder: (v: number) => void;
  /** Kirchensteuersatz in Prozent; 0 = keine Kirchensteuer. */
  kirchensteuerSatz: number;
  setKirchensteuerSatz: (v: number) => void;
  /** Hebesatz der Gemeinde für die Gewerbesteuer, in Prozent. */
  gewerbesteuerHebesatz: number;
  setGewerbesteuerHebesatz: (v: number) => void;
  /**
   * Gehört das Fahrzeug zum Betriebsvermögen? Dann zählen die tatsächlichen
   * Kosten und die Kilometerpauschale entfällt – sonst wäre es ein doppelter
   * Abzug.
   */
  fahrzeugImBetriebsvermoegen: boolean;
  setFahrzeugImBetriebsvermoegen: (v: boolean) => void;
  /** Krankengeldanspruch: entscheidet zwischen allgemeinem und ermäßigtem Beitragssatz. */
  kvKrankengeld: boolean;
  setKvKrankengeld: (v: boolean) => void;
  /**
   * Eigener Grundfreibetrag. 0 heißt: den amtlichen Wert des jeweiligen Jahres
   * nehmen. Vorher stand hier eine feste Zahl, die für jedes Jahr galt.
   */
  grundfreibetragManuell: number;
  setGrundfreibetragManuell: (v: number) => void;
  /**
   * Verpflegungsmehraufwand: Tage mit voller Abwesenheit (24 Stunden) und
   * Tage mit mehr als 8 Stunden bzw. An- und Abreisetage. Das Fahrtenbuch hält
   * nur Kilometer fest, keine Uhrzeiten – deshalb werden die Tage hier von
   * Hand gezählt. Ohne diese Angabe blieb die Pauschale bisher ganz liegen,
   * obwohl die Hilfe sie nannte.
   */
  reiseTageVoll: number;
  setReiseTageVoll: (v: number) => void;
  reiseTageTeil: number;
  setReiseTageTeil: (v: number) => void;
}

/** Hell, Dunkel oder dem System folgen. */
export type ThemeMode = 'light' | 'dark' | 'auto';

/** Was das Betriebssystem gerade möchte (auf dem Server: hell). */
function prefersDarkNow(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Aus Modus (und ggf. gespeichertem Wert) die tatsächliche Farbgebung. */
function resolveDark(mode: ThemeMode, fallback = false): boolean {
  if (mode === 'auto') return prefersDarkNow();
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return fallback;
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
      themeMode: 'auto' as ThemeMode,
      setThemeMode: (mode) => set({ themeMode: mode, darkMode: resolveDark(mode) }),
      cycleThemeMode: () => set((state) => {
        const order: ThemeMode[] = ['light', 'dark', 'auto'];
        const next = order[(order.indexOf(state.themeMode) + 1) % order.length];
        return { themeMode: next, darkMode: resolveDark(next) };
      }),
      syncSystemTheme: (prefersDark) => set((state) => (
        state.themeMode === 'auto' ? { darkMode: prefersDark } : {}
      )),
      darkMode: prefersDarkNow(),
      // Ein ausdrücklich gesetzter Wert heißt: nicht mehr dem System folgen.
      setDarkMode: (darkMode) => set({ darkMode, themeMode: darkMode ? 'dark' : 'light' }),
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
      rechtsform: 'freiberufler' as Rechtsform,
      setRechtsform: (rechtsform) => set({ rechtsform }),
      branchenprofil: 'standard' as Branchenprofil,
      setBranchenprofil: (branchenprofil) => set({ branchenprofil }),
      activeAiFix: null,
      setActiveAiFix: (activeAiFix) => set({ activeAiFix }),
      kmPauschale: 0.30,
      setKmPauschale: (kmPauschale) => set({ kmPauschale }),
      showAiChat: true,
      setShowAiChat: (showAiChat) => set({ showAiChat }),
      pageHeaderMounted: false,
      setPageHeaderMounted: (pageHeaderMounted) => set({ pageHeaderMounted }),
      pendlerKm: 0,
      setPendlerKm: (pendlerKm) => set({ pendlerKm }),
      pendlerTage: 0,
      setPendlerTage: (pendlerTage) => set({ pendlerTage }),
      homeofficeTage: 0,
      setHomeofficeTage: (homeofficeTage) => set({ homeofficeTage }),
      showGlossarTooltips: true,
      setShowGlossarTooltips: (showGlossarTooltips) => set({ showGlossarTooltips }),
      verheiratet: false,
      setVerheiratet: (verheiratet) => set({ verheiratet }),
      kinder: 0,
      setKinder: (kinder) => set({ kinder: Math.max(0, Math.round(kinder)) }),
      kirchensteuerSatz: 0,
      setKirchensteuerSatz: (kirchensteuerSatz) => set({ kirchensteuerSatz }),
      gewerbesteuerHebesatz: 400,
      setGewerbesteuerHebesatz: (gewerbesteuerHebesatz) => set({ gewerbesteuerHebesatz }),
      fahrzeugImBetriebsvermoegen: false,
      setFahrzeugImBetriebsvermoegen: (fahrzeugImBetriebsvermoegen) => set({ fahrzeugImBetriebsvermoegen }),
      kvKrankengeld: false,
      setKvKrankengeld: (kvKrankengeld) => set({ kvKrankengeld }),
      grundfreibetragManuell: 0,
      setGrundfreibetragManuell: (grundfreibetragManuell) => set({ grundfreibetragManuell }),
      reiseTageVoll: 0,
      setReiseTageVoll: (reiseTageVoll) => set({ reiseTageVoll: Math.max(0, Math.round(reiseTageVoll)) }),
      reiseTageTeil: 0,
      setReiseTageTeil: (reiseTageTeil) => set({ reiseTageTeil: Math.max(0, Math.round(reiseTageTeil)) }),
    }),
    {
      name: 'Klevr-settings',
      partialize: (state) => ({ privacyMode: state.privacyMode, darkMode: state.darkMode, themeMode: state.themeMode, theme: state.theme, animations: state.animations, hiddenNavItems: state.hiddenNavItems, steuerregelung: state.steuerregelung, rechtsform: state.rechtsform, branchenprofil: state.branchenprofil, kmPauschale: state.kmPauschale, showAiChat: state.showAiChat, showGlossarTooltips: state.showGlossarTooltips, pendlerKm: state.pendlerKm, pendlerTage: state.pendlerTage, homeofficeTage: state.homeofficeTage, verheiratet: state.verheiratet, kinder: state.kinder, kirchensteuerSatz: state.kirchensteuerSatz, gewerbesteuerHebesatz: state.gewerbesteuerHebesatz, fahrzeugImBetriebsvermoegen: state.fahrzeugImBetriebsvermoegen, kvKrankengeld: state.kvKrankengeld, grundfreibetragManuell: state.grundfreibetragManuell, reiseTageVoll: state.reiseTageVoll, reiseTageTeil: state.reiseTageTeil }),
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as object), drafts: [] };
        // Ein entferntes Theme im gespeicherten Zustand würde sonst eine
        // Klasse setzen, zu der es keine Regeln mehr gibt.
        const theme = normalizeTheme(merged.theme);
        // Ältere Stände kennen nur `darkMode`. Wer damals hell oder dunkel
        // gewählt hat, hat das bewusst getan – also bleibt es dabei, statt
        // ungefragt auf „Automatisch" zu springen.
        const themeMode: ThemeMode =
          merged.themeMode === 'light' || merged.themeMode === 'dark' || merged.themeMode === 'auto'
            ? merged.themeMode
            : merged.darkMode ? 'dark' : 'light';
        // Früher stand der Grundfreibetrag als eine feste Zahl im Profil und
        // galt für jedes Jahr. Wer nie etwas verstellt hat, hatte einen der
        // amtlichen Werte stehen – der wird jetzt auf „automatisch" (0)
        // gesetzt, damit jedes Jahr seinen eigenen bekommt. Nur ein davon
        // abweichender Wert war eine bewusste Eingabe und bleibt erhalten.
        const amtlicheGrundfreibetraege = [10_908, 11_604, 11_784, 12_084, 12_096, 12_348];
        // Der alte Schlüssel steht nur noch in gespeicherten Ständen, nicht
        // mehr im Typ – deshalb hier ausdrücklich aus dem rohen Objekt gelesen.
        const alterWert = (persisted as { grundfreibetrag?: unknown } | undefined)?.grundfreibetrag;
        const grundfreibetragManuell =
          typeof merged.grundfreibetragManuell === 'number'
            ? merged.grundfreibetragManuell
            : (typeof alterWert === 'number'
              && alterWert > 0
              && !amtlicheGrundfreibetraege.includes(alterWert))
              ? alterWert
              : 0;

        // `taetigkeitsart` und `rechtsform` beschrieben dasselbe und liefen
        // auseinander – im Zweifel gewinnt die Rechtsform, weil nur sie
        // ausgewertet wird. Die alte Angabe wird nicht mehr fortgeführt.
        return {
          ...merged,
          theme,
          themeMode,
          darkMode: resolveDark(themeMode, merged.darkMode),
          grundfreibetragManuell,
        };
      },
    }
  )
);
