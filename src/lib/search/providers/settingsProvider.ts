import { Settings, Sun, Moon, Eye, EyeOff, User, Key } from 'lucide-react';
import type { SearchProvider, SearchResult } from '../types';

interface SettingsProviderOptions {
  navigate: (path: string) => void;
  darkMode: boolean;
  toggleDark: () => void;
  privacyMode: boolean;
  togglePrivacyMode: () => void;
}

const STATIC_SETTINGS = [
  {
    id: 'settings-profile-name',
    title: 'Name / Firma',
    subtitle: 'Persönliche Daten → Einstellungen',
    icon: User,
    keywords: ['name', 'firma', 'profil', 'person'],
    path: '/settings',
  },
  {
    id: 'settings-profile-address',
    title: 'Adresse',
    subtitle: 'Persönliche Daten → Einstellungen',
    icon: User,
    keywords: ['adresse', 'anschrift', 'straße', 'ort'],
    path: '/settings',
  },
  {
    id: 'settings-tax',
    title: 'Steuernummer & USt-IdNr.',
    subtitle: 'Persönliche Daten → Einstellungen',
    icon: User,
    keywords: ['steuer', 'steuernummer', 'ust', 'umsatzsteuer', 'vat'],
    path: '/settings',
  },
  {
    id: 'settings-bank',
    title: 'IBAN & BIC',
    subtitle: 'Bankverbindung → Einstellungen',
    icon: User,
    keywords: ['iban', 'bic', 'bank', 'konto'],
    path: '/settings',
  },
  {
    id: 'settings-api',
    title: 'Gemini API-Key',
    subtitle: 'KI-Erkennung → Einstellungen',
    icon: Key,
    keywords: ['api', 'key', 'gemini', 'ki', 'ai', 'google'],
    path: '/settings',
  },
  {
    id: 'settings-general',
    title: 'Einstellungen öffnen',
    subtitle: 'Alle Einstellungen',
    icon: Settings,
    keywords: ['einstellungen', 'settings', 'konfiguration', 'optionen'],
    path: '/settings',
  },
];

export function createSettingsProvider(options: SettingsProviderOptions): SearchProvider {
  return {
    id: 'settings',
    label: 'Einstellungen',
    defaultEnabled: true,
    search: async (query) => {
      const q = query.toLowerCase();
      const results: SearchResult[] = [];

      // Statische Einstellungsseiten
      for (const item of STATIC_SETTINGS) {
        if (
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q) ||
          item.keywords.some((k) => k.includes(q))
        ) {
          results.push({
            id: item.id,
            title: item.title,
            subtitle: item.subtitle,
            icon: item.icon,
            category: 'Einstellungen',
            categoryColor: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
            onSelect: () => options.navigate(item.path),
          });
        }
      }

      // Dark Mode Toggle
      const darkKeywords = ['dark', 'dunkel', 'hell', 'licht', 'erscheinungsbild', 'theme', 'modus'];
      if (darkKeywords.some((k) => k.includes(q) || q.includes(k.slice(0, 3)))) {
        results.push({
          id: 'settings-toggle-dark',
          title: options.darkMode ? 'Dark Mode deaktivieren' : 'Dark Mode aktivieren',
          subtitle: `Aktuell: ${options.darkMode ? 'Dunkel' : 'Hell'}`,
          icon: options.darkMode ? Sun : Moon,
          category: 'Einstellungen',
          categoryColor: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
          onSelect: options.toggleDark,
        });
      }

      // Privacy Mode Toggle
      const privacyKeywords = ['privat', 'privacy', 'beträge', 'ausblenden', 'einblenden', 'verstecken'];
      if (privacyKeywords.some((k) => k.includes(q) || q.includes(k.slice(0, 3)))) {
        results.push({
          id: 'settings-toggle-privacy',
          title: options.privacyMode ? 'Beträge einblenden' : 'Beträge ausblenden',
          subtitle: `Privatsphäre-Modus: ${options.privacyMode ? 'An' : 'Aus'}`,
          icon: options.privacyMode ? Eye : EyeOff,
          category: 'Einstellungen',
          categoryColor: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
          onSelect: options.togglePrivacyMode,
        });
      }

      return results;
    },
  };
}

