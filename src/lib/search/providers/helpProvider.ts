import { HelpCircle } from 'lucide-react';
import type { SearchProvider, SearchResult } from '../types';

const HELP_ITEMS = [
	{
		id: 'help-overview',
		title: 'Erste Schritte – Übersicht',
		subtitle: 'Was kann die App? Empfohlene erste Schritte',
		keywords: ['start', 'anfang', 'einführung', 'übersicht', 'hilfe'],
		articleId: 'overview',
	},
	{
		id: 'help-pdf-upload',
		title: 'PDF hochladen & KI-Erkennung',
		subtitle: 'Rechnung hochladen und automatisch auslesen lassen',
		keywords: [
			'pdf',
			'upload',
			'hochladen',
			'ki',
			'ai',
			'gemini',
			'erkennung',
			'automatisch',
			'scan',
		],
		articleId: 'pdf-upload',
	},
	{
		id: 'help-manual-invoice',
		title: 'Rechnung manuell erfassen',
		subtitle: 'Alle Felder erklärt – Datum, Betrag, Partner, Kategorie',
		keywords: [
			'manuell',
			'neu',
			'erstellen',
			'eingabe',
			'formular',
			'erfassen',
		],
		articleId: 'manual-invoice',
	},
	{
		id: 'help-categories',
		title: 'Kategorien erklärt',
		subtitle: 'Einnahmen, Ausgaben, AfA, GWG, Software & Abos, …',
		keywords: [
			'kategorie',
			'einnahme',
			'ausgabe',
			'afa',
			'gwg',
			'software',
			'abo',
			'fremdleistung',
			'vertrag',
		],
		articleId: 'categories',
	},
	{
		id: 'help-dashboard',
		title: 'Dashboard & Auswertungen',
		subtitle: 'KPIs, Jahresauswahl, Charts verstehen',
		keywords: [
			'dashboard',
			'kpi',
			'umsatz',
			'statistik',
			'chart',
			'auswertung',
			'gewinn',
		],
		articleId: 'dashboard',
	},
	{
		id: 'help-export',
		title: 'Daten exportieren',
		subtitle: 'Excel und PDF-Export für Steuerberater',
		keywords: ['export', 'excel', 'csv', 'pdf', 'herunterladen', 'steuerberater'],
		articleId: 'export',
	},
	{
		id: 'help-templates',
		title: 'Rechnungsvorlagen gestalten',
		subtitle: 'Drag & Drop Designer, Variablen verwenden',
		keywords: ['vorlage', 'template', 'designer', 'variable', 'gestalten', 'layout'],
		articleId: 'designer',
	},
	{
		id: 'help-profile',
		title: 'Profildaten hinterlegen',
		subtitle: 'Name, Adresse, Steuernummer, IBAN für KI und Vorlagen',
		keywords: [
			'profil',
			'name',
			'adresse',
			'steuer',
			'daten',
			'einrichten',
			'iban',
		],
		articleId: 'settings-profile',
	},
	{
		id: 'help-darkmode',
		title: 'Dark Mode & Privatsphäre',
		subtitle: 'Design wechseln, Beträge ausblenden',
		keywords: [
			'dark',
			'dunkel',
			'hell',
			'design',
			'theme',
			'modus',
			'privat',
			'privacy',
			'betrag',
			'ausblenden',
		],
		articleId: 'privacy-dark',
	},
	{
		id: 'help-search',
		title: 'Suche & Tastaturkürzel',
		subtitle: 'Ctrl+K, Tastenkürzel, PDF-Volltextsuche',
		keywords: ['suche', 'suchen', 'ctrl', 'shortcut', 'tastenkürzel', 'strg'],
		articleId: 'search',
	},
	{
		id: 'help-pdf-search',
		title: 'PDF-Inhalte durchsuchen',
		subtitle: 'Volltext-Suche in hochgeladenen PDFs',
		keywords: ['pdf', 'volltext', 'durchsuchen', 'inhalt', 'langsam'],
		articleId: 'pdf-search',
	},
	{
		id: 'help-ai',
		title: 'KI-Erkennung mit Gemini',
		subtitle: 'API-Key einrichten, was wird erkannt',
		keywords: ['ki', 'ai', 'gemini', 'apikey', 'erkennung', 'google'],
		articleId: 'ai-recognition',
	},
];

export function createHelpProvider(navigate: (path: string) => void): SearchProvider {
	return {
		id: 'help',
		label: 'Hilfe',
		defaultEnabled: true,
		search: async (query) => {
			const q = query.toLowerCase();
			return HELP_ITEMS.filter(
				(item) =>
					item.title.toLowerCase().includes(q) ||
					item.subtitle.toLowerCase().includes(q) ||
					item.keywords.some((k) => k.includes(q))
			).map<SearchResult>((item) => ({
				id: item.id,
				title: item.title,
				subtitle: item.subtitle,
				icon: HelpCircle,
				category: 'Hilfe',
				categoryColor:
					'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
				onSelect: () => navigate(`/help?article=${item.articleId}`),
			}));
		},
	};
}
