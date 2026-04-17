import {
  LayoutDashboard,
  FileText,
  PenLine,
  Palette,
  Settings,
} from 'lucide-react';
import type { SearchProvider, SearchResult } from '../types';

const NAV_ITEMS = [
  {
    id: 'nav-dashboard',
    title: 'Dashboard',
    subtitle: 'Übersicht, KPIs, Diagramme, Prognosen',
    icon: LayoutDashboard,
    path: '/',
    keywords: ['dashboard', 'übersicht', 'kpi', 'umsatz', 'statistik', 'diagramm', 'prognose', 'muster', 'vorhersage', 'wiederholung', '28 tage', 'letzte tage', 'forecast'],
  },
  {
    id: 'nav-invoices',
    title: 'Alle Rechnungen',
    subtitle: 'Rechnungsliste, Tabelle, Filter',
    icon: FileText,
    path: '/invoices',
    keywords: ['rechnung', 'liste', 'tabelle', 'alle', 'übersicht', 'filter'],
  },
  {
    id: 'nav-write',
    title: 'Rechnung schreiben',
    subtitle: 'Neue Rechnung erstellen oder PDF hochladen',
    icon: PenLine,
    path: '/write-invoice',
    keywords: ['neu', 'erstellen', 'schreiben', 'upload', 'pdf', 'hochladen', 'hinzufügen'],
  },
  {
    id: 'nav-designer',
    title: 'Rechnungsdesigner',
    subtitle: 'Vorlagen gestalten und bearbeiten',
    icon: Palette,
    path: '/invoice-designer',
    keywords: ['designer', 'vorlage', 'template', 'gestalten', 'layout', 'design'],
  },
  {
    id: 'nav-settings',
    title: 'Einstellungen',
    subtitle: 'Profil, API-Key, Dark Mode',
    icon: Settings,
    path: '/settings',
    keywords: ['einstellungen', 'profil', 'api', 'key', 'dark', 'mode', 'erscheinungsbild', 'konfiguration'],
  },
];

export function createNavigationProvider(navigate: (path: string) => void): SearchProvider {
  return {
    id: 'navigation',
    label: 'Navigation',
    defaultEnabled: true,
    search: async (query) => {
      const q = query.toLowerCase();
      return NAV_ITEMS
        .filter(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            item.subtitle.toLowerCase().includes(q) ||
            item.keywords.some((k) => k.includes(q))
        )
        .map<SearchResult>((item) => ({
          id: item.id,
          title: item.title,
          subtitle: item.subtitle,
          icon: item.icon,
          category: 'Navigation',
          categoryColor: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
          onSelect: () => navigate(item.path),
        }));
    },
  };
}

