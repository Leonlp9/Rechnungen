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
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  tutorialId?: string;
  /** Kurzbeschreibung – wird im Mobile-Menü unter dem Namen angezeigt */
  hint?: string;
  /** Gruppierung im Mobile-Menü */
  group: 'Belege' | 'Organisation' | 'Auswertung' | 'System';
  /** Auf dem Handy nicht sinnvoll (Desktop-only Feature oder zu klein) */
  desktopOnly?: boolean;
  /** Nur im Mobile-Menü anzeigen */
  mobileOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, tutorialId: 'nav-dashboard', group: 'Belege', hint: 'Kennzahlen & Charts' },
  { to: '/invoices', label: 'Alle Rechnungen', icon: FileText, tutorialId: 'nav-invoices', group: 'Belege', hint: 'Belege suchen & filtern' },
  { to: '/scan', label: 'Beleg scannen', icon: Camera, group: 'Belege', hint: 'Foto → PDF → Entwurf', mobileOnly: true },
  { to: '/write-invoice', label: 'Rechnung schreiben', icon: FilePlus2, tutorialId: 'nav-write-invoice', group: 'Belege', hint: 'Ausgangsrechnung erstellen' },
  { to: '/invoice-designer', label: 'Template Designer', icon: PenSquare, tutorialId: 'nav-invoice-designer', group: 'Belege', hint: 'Rechnungsvorlagen gestalten', desktopOnly: true },

  { to: '/customers', label: 'Kunden', icon: Users, tutorialId: 'nav-customers', group: 'Organisation', hint: 'Kundenstamm' },
  { to: '/projects', label: 'Projekte', icon: FolderKanban, tutorialId: 'nav-projects', group: 'Organisation', hint: 'Belege nach Projekt' },
  { to: '/lists', label: 'Listen', icon: ListTodo, tutorialId: 'nav-lists', group: 'Organisation', hint: 'To-dos, Kanban, Pinnwand' },
  { to: '/fahrtenbuch', label: 'Fahrtenbuch', icon: Car, tutorialId: 'nav-fahrtenbuch', group: 'Organisation', hint: 'Fahrten & km-Pauschale' },
  { to: '/gmail', label: 'Mail', icon: Mail, tutorialId: 'nav-gmail', group: 'Organisation', hint: 'Rechnungs-Mails', desktopOnly: true },
  { to: '/calendar', label: 'Kalender', icon: CalendarDays, tutorialId: 'nav-calendar', group: 'Organisation', hint: 'Termine', desktopOnly: true },

  { to: '/steuerbericht', label: 'Steuerbericht', icon: Receipt, tutorialId: 'nav-steuerbericht', group: 'Auswertung', hint: 'EÜR, USt, Export' },
  { to: '/bank-import', label: 'Bankimport', icon: Landmark, tutorialId: 'nav-bank-import', group: 'Auswertung', hint: 'Kontoumsätze abgleichen' },
  { to: '/krankenkasse', label: 'Krankenkasse', icon: HeartPulse, tutorialId: 'nav-krankenkasse', group: 'Auswertung', hint: 'Beiträge & Sätze' },
  { to: '/revisionsprotokoll', label: 'Revisionsprotokoll', icon: ScrollText, tutorialId: 'nav-revisionsprotokoll', group: 'Auswertung', hint: 'GoBD-Audit-Trail' },

  { to: '/settings', label: 'Einstellungen', icon: Settings, tutorialId: 'nav-settings', group: 'System', hint: 'Profil, KI, Sync, Backup' },
  { to: '/help', label: 'Hilfe', icon: HelpCircle, tutorialId: 'nav-help', group: 'System', hint: 'Anleitungen & Glossar' },
];

export const NAV_GROUPS: NavItem['group'][] = ['Belege', 'Organisation', 'Auswertung', 'System'];

/** Nav-Einträge für die Desktop-Sidebar (ohne Mobile-only-Einträge). */
export const DESKTOP_NAV_ITEMS = NAV_ITEMS.filter((i) => !i.mobileOnly);

/** Nav-Einträge für das Handy (ohne Desktop-only-Features). */
export const MOBILE_NAV_ITEMS = NAV_ITEMS.filter((i) => !i.desktopOnly);
