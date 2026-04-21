export interface TutorialStep {
  id: string;
  route: string;
  target: string;
  title: string;
  description: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
  /** click = User muss das Element anklicken (Navigation). observe = Nur zeigen, Weiter-Button. */
  action: 'click' | 'observe';
  /** Wenn gesetzt: Settings-Tab, der vor dem Highlighting aktiviert werden soll. */
  settingsTab?: 'profil' | 'ki' | 'erscheinungsbild' | 'daten' | 'ueber' | 'dev';
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  // ── 1. CLICK: Dashboard-Tab anklicken ──
  {
    id: 'nav-dashboard',
    route: '/',
    target: '[data-tutorial="nav-dashboard"]',
    title: '👋 Willkommen im Klevr!',
    description: 'Das ist die Seitenleiste – deine Navigation. Klicke auf "Dashboard", um zu starten.',
    placement: 'right',
    action: 'click',
  },
  // ── 2. OBSERVE: Neue-Rechnung-Button zeigen ──
  {
    id: 'dashboard-topbar',
    route: '/',
    target: '[data-tutorial="topbar-new-invoice"]',
    title: '➕ Neue Rechnung anlegen',
    description: 'Mit diesem Button kannst du jederzeit schnell eine neue Rechnung erfassen – egal auf welcher Seite du bist.',
    placement: 'bottom',
    action: 'observe',
  },
  // ── 3. OBSERVE: Dashboard-Gesamtbereich zeigen ──
  {
    id: 'dashboard-kpis',
    route: '/',
    target: '[data-tutorial="dashboard-kpis"]',
    title: '📊 Dein Dashboard',
    description: 'Hier siehst du den Jahresüberblick: Einnahmen, Ausgaben, Gewinn und alle wichtigen Kennzahlen auf einen Blick.',
    placement: 'right',
    action: 'observe',
  },
  // ── 4. OBSERVE: Jahres-Dropdown zeigen ──
  {
    id: 'dashboard-year',
    route: '/',
    target: '[data-tutorial="dashboard-year-select"]',
    title: '📅 Jahresauswahl',
    description: 'Mit diesem Dropdown wechselst du das angezeigte Jahr. Alle Karten und Charts aktualisieren sich automatisch.',
    placement: 'bottom',
    action: 'observe',
  },
  // ── 5. CLICK: Alle-Rechnungen-Tab anklicken ──
  {
    id: 'nav-invoices',
    route: '/invoices',
    target: '[data-tutorial="nav-invoices"]',
    title: '📄 Alle Rechnungen',
    description: 'Hier findest du eine vollständige, filterbare Liste aller deiner Rechnungen. Klicke auf den Menüpunkt.',
    placement: 'right',
    action: 'click',
  },
  // ── 6. OBSERVE: Rechnungsliste zeigen ──
  {
    id: 'invoices-table',
    route: '/invoices',
    target: '[data-tutorial="invoices-table"]',
    title: '📋 Rechnungsliste',
    description: 'Hier werden alle Rechnungen aufgelistet – sortierbar, filterbar, mit Status und Kategorie. Du kannst eine Rechnung anklicken, um Details zu sehen.',
    placement: 'top',
    action: 'observe',
  },
  // ── 7. CLICK: Rechnung-schreiben-Tab anklicken ──
  {
    id: 'nav-write-invoice',
    route: '/write-invoice',
    target: '[data-tutorial="nav-write-invoice"]',
    title: '✏️ Rechnung schreiben',
    description: 'Hier erstellst du professionelle Rechnungen auf Basis deiner Vorlagen. Klicke auf den Menüpunkt.',
    placement: 'right',
    action: 'click',
  },
  // ── 8. OBSERVE: Rechnungsformular zeigen ──
  {
    id: 'write-invoice-sidebar',
    route: '/write-invoice',
    target: '[data-tutorial="write-invoice-sidebar"]',
    title: '📝 Rechnungsdaten eingeben',
    description: 'In dieser Seitenleiste füllst du alle Felder aus: Empfänger, Datum, Rechnungsnummer und mehr. Die Live-Vorschau rechts aktualisiert sich sofort.',
    placement: 'right',
    action: 'observe',
  },
  // ── 9. OBSERVE: Positionen-Karte zeigen ──
  {
    id: 'write-invoice-items',
    route: '/write-invoice',
    target: '[data-tutorial="write-invoice-items"]',
    title: '🧾 Positionen hinzufügen',
    description: 'Hier fügst du Leistungspositionen ein – Beschreibung, Menge, Einheit und Einzelpreis. MwSt wird automatisch berechnet.',
    placement: 'right',
    action: 'observe',
  },
  // ── 10. CLICK: Template-Designer-Tab anklicken ──
  {
    id: 'nav-invoice-designer',
    route: '/invoice-designer',
    target: '[data-tutorial="nav-invoice-designer"]',
    title: '🎨 Template Designer',
    description: 'Gestalte das Aussehen deiner Rechnungen – Logo, Farben, Schriftart und Layout per Drag & Drop. Klicke auf den Menüpunkt.',
    placement: 'right',
    action: 'click',
  },
  // ── 11. OBSERVE: Template-Liste zeigen ──
  {
    id: 'designer-template-list',
    route: '/invoice-designer',
    target: '[data-tutorial="designer-template-list"]',
    title: '📑 Template-Liste',
    description: 'Hier siehst du alle deine Vorlagen. Du kannst Vorlagen duplizieren, umbenennen oder löschen. Die mitgelieferte Standardvorlage lässt sich jederzeit zurücksetzen.',
    placement: 'right',
    action: 'observe',
  },
  // ── 12. OBSERVE: Ribbon-Toolbar zeigen ──
  {
    id: 'designer-toolbar',
    route: '/invoice-designer',
    target: '[data-tutorial="designer-toolbar"]',
    title: '🔧 Toolbar – Elemente einfügen',
    description: 'Über die Toolbar fügst du Elemente ein: Text, Variablen (z.B. {{name}}), Rechtecke, Bilder, die Positionstabelle und Linien. Auch Undo/Redo und Speichern findest du hier.',
    placement: 'bottom',
    action: 'observe',
  },
  // ── 13. OBSERVE: Canvas zeigen ──
  {
    id: 'designer-canvas',
    route: '/invoice-designer',
    target: '[data-tutorial="designer-canvas"]',
    title: '🖼️ Die Zeichenfläche (DIN A4)',
    description: 'Das ist die A4-Vorschau deiner Rechnung. Elemente lassen sich per Drag & Drop verschieben und an den Ecken/Kanten in der Größe verändern. Mit Ctrl+Scroll zoomst du.',
    placement: 'left',
    action: 'observe',
  },
  // ── 14. OBSERVE: Eigenschaften-Panel zeigen ──
  {
    id: 'designer-properties',
    route: '/invoice-designer',
    target: '[data-tutorial="designer-properties"]',
    title: '⚙️ Eigenschaften-Panel',
    description: 'Wenn du ein Element auf der Zeichenfläche auswählst, erscheinen hier alle Einstellungen: Schrift, Farbe, Größe, Position und bei Variablen der Platzhalter-Schlüssel.',
    placement: 'left',
    action: 'observe',
  },
  // ── 15. CLICK: Listen-Tab anklicken ──
  {
    id: 'nav-lists',
    route: '/lists',
    target: '[data-tutorial="nav-lists"]',
    title: '📋 Listen & Stammdaten',
    description: 'Verwalte Kundenlisten, Artikel und Preise für schnelleres Ausfüllen von Rechnungen. Klicke auf den Menüpunkt.',
    placement: 'right',
    action: 'click',
  },
  // ── 16. OBSERVE: KI-Chat-Button zeigen ──
  {
    id: 'ai-chat-btn',
    route: '/lists',
    target: '[data-tutorial="ai-chat-btn"]',
    title: '🤖 KI-Assistent',
    description: 'Der KI-Assistent ist immer unten rechts erreichbar. Er kann Rechnungen analysieren, Fragen zu deinen Daten beantworten und dir bei der App helfen.',
    placement: 'left',
    action: 'observe',
  },
  // ── 17. OBSERVE: KI-Chat-Fenster zeigen (öffnet sich automatisch) ──
  {
    id: 'ai-chat-window',
    route: '/lists',
    target: '[data-tutorial="ai-chat-window"]',
    title: '💬 KI-Assistent – Funktionen',
    description: 'Der Chat kennt den Kontext der aktuellen Seite. Du kannst z.B. fragen: „Zeig mir meine Top-Ausgaben" oder „Analysiere diese Rechnung". Er nutzt Google Gemini und braucht einen API-Key in den Einstellungen.',
    placement: 'left',
    action: 'observe',
  },
  // ── 12. CLICK: Mail-Tab anklicken ──
  {
    id: 'nav-gmail',
    route: '/gmail',
    target: '[data-tutorial="nav-gmail"]',
    title: '📧 Mail-Integration',
    description: 'Verbinde dein E-Mail-Konto, um eingehende Rechnungen automatisch zu erfassen und zu verwalten. Klicke auf den Menüpunkt.',
    placement: 'right',
    action: 'click',
  },
  // ── 13. CLICK: Einstellungen-Tab anklicken ──
  {
    id: 'nav-settings',
    route: '/settings',
    target: '[data-tutorial="nav-settings"]',
    title: '⚙️ Einstellungen',
    description: 'Hier richtest du die App ein: Profildaten, Steuerregelung, Theme und Backups. Klicke auf den Menüpunkt.',
    placement: 'right',
    action: 'click',
  },
  // ── 14. OBSERVE: Profildaten-Karte zeigen ──
  {
    id: 'settings-profile',
    route: '/settings',
    target: '[data-tutorial="settings-profile"]',
    title: '👤 Persönliche Daten hinterlegen',
    description: 'Trage hier Name, Adresse, Steuernummer und IBAN ein. Diese Daten erscheinen in deinen Rechnungen und helfen der KI.',
    placement: 'right',
    action: 'observe',
    settingsTab: 'profil',
  },
  // ── 15. OBSERVE: Steuerregelung-Karte zeigen ──
  {
    id: 'settings-steuer',
    route: '/settings',
    target: '[data-tutorial="settings-steuer"]',
    title: '🧾 Steuerregelung wählen',
    description: 'Wichtig: Wähle ob du Kleinunternehmer (§ 19 UStG) oder regelbesteuert bist. Das beeinflusst alle Rechnungen und das Dashboard-Widget.',
    placement: 'right',
    action: 'observe',
    settingsTab: 'profil',
  },
  // ── 16. OBSERVE: Erscheinungsbild-Karte zeigen ──
  {
    id: 'settings-appearance',
    route: '/settings',
    target: '[data-tutorial="settings-appearance"]',
    title: '🌈 Erscheinungsbild anpassen',
    description: 'Hier wählst du Dark Mode und dein Farbthema – von klassisch bis Liquid Glass. Probiere es nach dem Tutorial aus!',
    placement: 'right',
    action: 'observe',
    settingsTab: 'erscheinungsbild',
  },
  // ── 17. OBSERVE: Backup-Karte zeigen ──
  {
    id: 'settings-backup',
    route: '/settings',
    target: '[data-tutorial="settings-backup"]',
    title: '💾 Backup erstellen',
    description: 'Sichere alle Rechnungen, PDFs und Einstellungen als .rmbackup-Datei. Erstelle regelmäßig Backups!',
    placement: 'right',
    action: 'observe',
    settingsTab: 'daten',
  },
  // ── 18. OBSERVE: Suchleiste zeigen ──
  {
    id: 'topbar-search',
    route: '/settings',
    target: '[data-tutorial="topbar-search"]',
    title: '🔍 Globale Suche (Ctrl+K)',
    description: 'Mit Ctrl+K öffnest du die Suche – sie durchsucht Rechnungen, Seiten, Einstellungen und Hilfe gleichzeitig.',
    placement: 'bottom',
    action: 'observe',
  },
  // ── 19. CLICK: Hilfe-Tab anklicken ──
  {
    id: 'nav-help',
    route: '/help',
    target: '[data-tutorial="nav-help"]',
    title: '❓ Hilfe & Dokumentation',
    description: 'Ausführliche Anleitungen zu allen Funktionen. Klicke auf den Menüpunkt.',
    placement: 'right',
    action: 'click',
  },
  // ── 20. OBSERVE: Abschluss ──
  {
    id: 'finish',
    route: '/help',
    target: '[data-tutorial="tutorial-restart-btn"]',
    title: '🎉 Tutorial abgeschlossen!',
    description: 'Super! Du kennst jetzt alle wichtigen Funktionen. Mit diesem Button kannst du das Tutorial jederzeit erneut starten.',
    placement: 'right',
    action: 'observe',
  },
];



