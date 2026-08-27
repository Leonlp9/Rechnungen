// Gemeinsame Navigationsliste für Desktop-Sidebar und Mobile-Menü.
// Eine Quelle – damit auf dem Handy wirklich JEDE Seite erreichbar ist.

import {
  LayoutDashboard,
  FileText,
  Settings,
  FilePlus2,
  PenSquare,
  HelpCircle,
  ListTodo,
  Mail,
  CalendarDays,
  Car,
  Users,
  Landmark,
  Receipt,
  FolderKanban,
  ScrollText,
  HeartPulse,
  Camera,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ListTint } from '@/components/ui/list-group';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  tutorialId?: string;
  /** Kurzbeschreibung – wird im Mobile-Menü unter dem Namen angezeigt */
  hint?: string;
  /** Gruppierung im Mobile-Menü */
  group: 'Belege' | 'Organisation' | 'Auswertung' | 'System';
  /** Farbe der Icon-Kachel im Handy-Menü (iOS-Systemfarben) */
  tint: ListTint;
  /** Auf dem Handy nicht sinnvoll (Desktop-only Feature oder zu klein) */
  desktopOnly?: boolean;
  /** Nur im Mobile-Menü anzeigen */
  mobileOnly?: boolean;
  /**
   * Für wen der Eintrag gedacht ist. Wer angestellt ist, schreibt keine
   * Rechnungen, führt kein Fahrtenbuch für den Betrieb und zahlt seine
   * Krankenkasse nicht selbst – solche Seiten stehen dann nur im Weg.
   * Ohne Angabe gilt der Eintrag für alle.
   */
  fuer?: 'selbststaendig' | 'angestellt';
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', tint: 'blue', label: 'Dashboard', icon: LayoutDashboard, tutorialId: 'nav-dashboard', group: 'Belege', hint: 'Kennzahlen & Charts' },
  { to: '/invoices', tint: 'indigo', label: 'Alle Rechnungen', icon: FileText, tutorialId: 'nav-invoices', group: 'Belege', hint: 'Belege suchen & filtern' },
  { to: '/scan', tint: 'green', label: 'Beleg scannen', icon: Camera, group: 'Belege', hint: 'Foto → PDF → Entwurf', mobileOnly: true },
  { to: '/write-invoice', tint: 'orange', label: 'Rechnung schreiben', icon: FilePlus2, tutorialId: 'nav-write-invoice', group: 'Belege', hint: 'Ausgangsrechnung erstellen' , fuer: 'selbststaendig'},
  // Seit der Designer ein Baukasten mit eigener Handy-Fassung ist, gibt es
  // keinen Grund mehr, ihn dort zu verstecken.
  { to: '/invoice-designer', tint: 'purple', label: 'Rechnungsvorlagen', icon: PenSquare, tutorialId: 'nav-invoice-designer', group: 'Belege', hint: 'Vorlagen aus Bausteinen bauen', fuer: 'selbststaendig'},

  { to: '/customers', tint: 'teal', label: 'Kunden', icon: Users, tutorialId: 'nav-customers', group: 'Organisation', hint: 'Kundenstamm' , fuer: 'selbststaendig'},
  { to: '/projects', tint: 'yellow', label: 'Projekte', icon: FolderKanban, tutorialId: 'nav-projects', group: 'Organisation', hint: 'Belege nach Projekt' , fuer: 'selbststaendig'},
  { to: '/lists', tint: 'pink', label: 'Listen', icon: ListTodo, tutorialId: 'nav-lists', group: 'Organisation', hint: 'To-dos, Kanban, Pinnwand' },
  { to: '/fahrtenbuch', tint: 'blue', label: 'Fahrtenbuch', icon: Car, tutorialId: 'nav-fahrtenbuch', group: 'Organisation', hint: 'Fahrten & km-Pauschale' },
  { to: '/gmail', tint: 'red', label: 'Mail', icon: Mail, tutorialId: 'nav-gmail', group: 'Organisation', hint: 'Rechnungs-Mails', desktopOnly: true },
  { to: '/calendar', tint: 'red', label: 'Kalender', icon: CalendarDays, tutorialId: 'nav-calendar', group: 'Organisation', hint: 'Termine', desktopOnly: true },

  { to: '/gehalt', tint: 'green', label: 'Gehalt', icon: Wallet, group: 'Organisation', hint: 'Gehalt, Erhöhungen, Sonderzahlungen', fuer: 'angestellt' },

  { to: '/steuerbericht', tint: 'green', label: 'Steuerbericht', icon: Receipt, tutorialId: 'nav-steuerbericht', group: 'Auswertung', hint: 'EÜR, USt, Export' },
  { to: '/bank-import', tint: 'indigo', label: 'Bankimport', icon: Landmark, tutorialId: 'nav-bank-import', group: 'Auswertung', hint: 'Kontoumsätze abgleichen' },
  { to: '/krankenkasse', tint: 'red', label: 'Krankenkasse', icon: HeartPulse, tutorialId: 'nav-krankenkasse', group: 'Auswertung', hint: 'Beiträge & Sätze' , fuer: 'selbststaendig'},
  { to: '/revisionsprotokoll', tint: 'gray', label: 'Revisionsprotokoll', icon: ScrollText, tutorialId: 'nav-revisionsprotokoll', group: 'Auswertung', hint: 'GoBD-Audit-Trail' },

  { to: '/settings', tint: 'gray', label: 'Einstellungen', icon: Settings, tutorialId: 'nav-settings', group: 'System', hint: 'Profil, KI, Sync, Backup' },
  { to: '/help', tint: 'blue', label: 'Hilfe', icon: HelpCircle, tutorialId: 'nav-help', group: 'System', hint: 'Anleitungen & Glossar' },
];

export const NAV_GROUPS: NavItem['group'][] = ['Belege', 'Organisation', 'Auswertung', 'System'];

/**
 * Filtert die Liste nach dem rechtlichen Status. Angestellte sehen die
 * Betriebs-Seiten nicht, Selbstständige nicht die Gehaltsseite.
 */
export function navItemsFor(rechtsform: string, items: NavItem[] = NAV_ITEMS): NavItem[] {
  const angestellt = rechtsform === 'angestellt';
  return items.filter((i) => !i.fuer || i.fuer === (angestellt ? 'angestellt' : 'selbststaendig'));
}

/** Nav-Einträge für die Desktop-Sidebar (ohne Mobile-only-Einträge). */
export const DESKTOP_NAV_ITEMS = NAV_ITEMS.filter((i) => !i.mobileOnly);

/** Nav-Einträge für das Handy (ohne Desktop-only-Features). */
export const MOBILE_NAV_ITEMS = NAV_ITEMS.filter((i) => !i.desktopOnly);
