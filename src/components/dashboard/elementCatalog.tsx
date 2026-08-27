// Katalog aller Dashboard-Bausteine (Layout-Container + Widgets).
//
// Gemeinsame Quelle für die Desktop-Bearbeitungsleiste und den
// Element-Picker des Mobile-Dashboards.

import type { NodeType } from '@/types/dashboard';
import {
  Columns2, Rows2, BookOpen,
  TrendingUp, TrendingDown, Euro, Calculator, FileText,
  BarChart2, PieChart, Activity, Receipt,
  Sparkles, Mail, List, CalendarRange,
  Percent, PiggyBank, Table2,
  PanelLeft, LayoutGrid, LayoutDashboard, AlignJustify,
  User, ShieldCheck, Package, HardDrive,
  GripHorizontal, Users, RefreshCw, Layers, Car,
} from 'lucide-react';

export interface SidebarItemDef {
  type: NodeType;
  label: string;
  icon: React.ReactNode;
  description?: string;
  tooltip?: string;
  section: string;
}

export const ALL_ITEMS: SidebarItemDef[] = [
    // ── Layout-Container ──
    { section: '🧱 Layout-Container', type: 'grid-split-h', label: 'Split (resizierbar)', icon: <GripHorizontal className="h-4 w-4 text-indigo-500" />, description: 'Zwei Spalten – Breite per Drag verschiebbar', tooltip: 'Teilt den Bereich in zwei Spalten. Die Breite lässt sich durch Ziehen des mittleren Trenners frei einstellen. Die prozentuale Aufteilung wird automatisch gespeichert.' },
    { section: '🧱 Layout-Container', type: 'grid-horizontal', label: 'Horizontal', icon: <Columns2 className="h-4 w-4 text-blue-500" />, description: 'Elemente nebeneinander', tooltip: 'Ordnet alle enthaltenen Elemente nebeneinander in einer Zeile an. Ideal für KPI-Karten, die auf einen Blick verglichen werden sollen.' },
    { section: '🧱 Layout-Container', type: 'grid-vertical', label: 'Vertikal', icon: <Rows2 className="h-4 w-4 text-purple-500" />, description: 'Elemente untereinander', tooltip: 'Stapelt alle enthaltenen Elemente untereinander. Perfekt als Hauptstruktur oder um mehrere Charts in einer Spalte zu gruppieren.' },
    { section: '🧱 Layout-Container', type: 'grid-pages', label: 'Seiten', icon: <BookOpen className="h-4 w-4 text-orange-500" />, description: 'Tab-Seiten mit eigenem Inhalt', tooltip: 'Erstellt mehrere benannte Tab-Seiten in einem Container. So kannst du z. B. verschiedene Zeiträume oder Themenbereiche trennen, ohne Platz zu verschwenden.' },
    { section: '🧱 Layout-Container', type: 'grid-sidebar', label: 'Sidebar', icon: <PanelLeft className="h-4 w-4 text-cyan-500" />, description: 'Schmale Seitenleiste + Hauptbereich', tooltip: 'Zwei-Spalten-Layout: Das erste Kind erhält eine feste Breite als Seitenleiste (240 px), alle weiteren Kinder füllen den verbleibenden Platz.' },
    { section: '🧱 Layout-Container', type: 'grid-masonry', label: 'Masonry', icon: <LayoutGrid className="h-4 w-4 text-emerald-500" />, description: 'Wasserfall-Layout (2 Spalten)', tooltip: 'Karten fließen automatisch in zwei Spalten – ähnlich wie Pinterest. Unterschiedlich hohe Widgets füllen sich lückenlos.' },
    { section: '🧱 Layout-Container', type: 'grid-accordion', label: 'Akkordeon', icon: <AlignJustify className="h-4 w-4 text-rose-500" />, description: 'Aufklappbare Sektionen', tooltip: 'Jedes Kind-Element bekommt einen klickbaren Header und kann einzeln ein- oder ausgeklappt werden.' },
    { section: '🧱 Layout-Container', type: 'grid-bento', label: 'Bento', icon: <LayoutDashboard className="h-4 w-4 text-violet-500" />, description: 'Konfigurierbares CSS-Grid (3 Spalten)', tooltip: 'Modernes Bento-Box-Layout mit 3 gleichmäßigen Spalten. Kinder können über colSpan mehrere Spalten einnehmen.' },

    // ── KPI – Einnahmen & Ausgaben ──
    { section: '📊 KPI – Einnahmen & Ausgaben', type: 'kpi-einnahmen-ytd', label: 'Einnahmen YTD', icon: <TrendingUp className="h-4 w-4 text-green-600" />, description: 'Gesamteinnahmen im laufenden Jahr', tooltip: 'Zeigt die Summe aller Einnahmen vom 1. Januar bis heute, inklusive Vergleich zum Vorjahreszeitraum als Deltawert.' },
    { section: '📊 KPI – Einnahmen & Ausgaben', type: 'kpi-ausgaben-ytd', label: 'Ausgaben YTD', icon: <TrendingDown className="h-4 w-4 text-red-600" />, description: 'Gesamtausgaben im laufenden Jahr', tooltip: 'Zeigt die Summe aller Ausgaben vom 1. Januar bis heute, inklusive Vergleich zum Vorjahreszeitraum als Deltawert.' },
    { section: '📊 KPI – Einnahmen & Ausgaben', type: 'kpi-saldo-ytd', label: 'Saldo YTD', icon: <Euro className="h-4 w-4 text-primary" />, description: 'Einnahmen minus alle Ausgaben (YTD)', tooltip: 'Tatsächlich verfügbares Geld: Einnahmen abzüglich aller Ausgaben seit Jahresbeginn. Private Belege und Sonderausgaben zählen mit, weil sie das Konto genauso belasten – als steuerlicher Gewinn ist diese Zahl deshalb nicht zu gebrauchen.' },
    { section: '📊 KPI – Einnahmen & Ausgaben', type: 'kpi-einnahmen-monat', label: 'Einnahmen (Monat)', icon: <TrendingUp className="h-4 w-4 text-green-600" />, description: 'Einnahmen im aktuellen Monat', tooltip: 'Summe aller Einnahmen im laufenden Kalendermonat, mit Vergleich zum selben Monat des Vorjahres.' },
    { section: '📊 KPI – Einnahmen & Ausgaben', type: 'kpi-ausgaben-monat', label: 'Ausgaben (Monat)', icon: <TrendingDown className="h-4 w-4 text-red-600" />, description: 'Ausgaben im aktuellen Monat', tooltip: 'Summe aller Ausgaben im laufenden Kalendermonat, mit Vergleich zum selben Monat des Vorjahres.' },
    { section: '📊 KPI – Einnahmen & Ausgaben', type: 'kpi-saldo-monat', label: 'Saldo (Monat)', icon: <Euro className="h-4 w-4 text-primary" />, description: 'Einnahmen minus Ausgaben (Monat)', tooltip: 'Monatlicher Überschuss: Einnahmen abzüglich aller Ausgaben im aktuellen Kalendermonat.' },
    { section: '📊 KPI – Einnahmen & Ausgaben', type: 'kpi-avg-einnahmen-monat', label: 'Ø Einnahmen / Monat', icon: <TrendingUp className="h-4 w-4 text-green-600" />, description: 'Durchschnittliche monatliche Einnahmen', tooltip: 'Gesamteinnahmen des Jahres geteilt durch 12 – mit Vergleich zum Vorjahreswert.' },
    { section: '📊 KPI – Einnahmen & Ausgaben', type: 'kpi-avg-ausgaben-monat', label: 'Ø Ausgaben / Monat', icon: <TrendingDown className="h-4 w-4 text-red-600" />, description: 'Durchschnittliche monatliche Ausgaben', tooltip: 'Gesamtausgaben des Jahres geteilt durch 12 – mit Vergleich zum Vorjahreswert.' },
    { section: '📊 KPI – Einnahmen & Ausgaben', type: 'kpi-belege-30d', label: 'Belege (30 Tage)', icon: <FileText className="h-4 w-4 text-muted-foreground" />, description: 'Anzahl Belege der letzten 30 Tage', tooltip: 'Zeigt die Anzahl aller erfassten Belege der vergangenen 30 Tage.' },

    // ── KPI – Gewinn & Steuer ──
    { section: '💰 KPI – Gewinn & Steuer', type: 'kpi-betriebsergebnis', label: 'Cash-Gewinn', icon: <Calculator className="h-4 w-4 text-violet-600" />, description: 'Was an Geld übrig geblieben ist', tooltip: 'Betriebseinnahmen minus Betriebsausgaben, Anschaffungen mit dem vollen Kaufpreis im Jahr der Zahlung. Das ist die Liquiditätssicht: Sie sagt, wie viel Geld geblieben ist, aber nicht, was zu versteuern ist. Für die Steuer gilt der steuerliche Gewinn (EÜR) daneben.' },
    { section: '💰 KPI – Gewinn & Steuer', type: 'kpi-betriebsergebnis-afa', label: 'Steuerlicher Gewinn (EÜR)', icon: <Calculator className="h-4 w-4 text-amber-600" />, description: 'Gewinn der Anlage EÜR (mit AfA)', tooltip: 'Dieselbe Rechnung wie beim Cash-Gewinn, aber Anschaffungen gehen nur mit der zeitanteiligen Abschreibung ein statt mit dem vollen Kaufpreis. Das ist die Zahl der Anlage EÜR. Sonderausgaben wie die Kranken- und Pflegeversicherung sind hier NICHT abgezogen – sie mindern erst eine Stufe später das zu versteuernde Einkommen.' },
    { section: '💰 KPI – Gewinn & Steuer', type: 'kpi-marge', label: 'Gewinnmarge', icon: <Percent className="h-4 w-4 text-violet-500" />, description: 'Gewinnanteil an den Einnahmen in %', tooltip: 'Betriebsergebnis geteilt durch die Betriebseinnahmen – zeigt, wie viel Prozent der Einnahmen als Gewinn verbleiben.' },
    { section: '💰 KPI – Gewinn & Steuer', type: 'kpi-steuerruecklage', label: 'Steuerrücklage', icon: <PiggyBank className="h-4 w-4 text-amber-500" />, description: 'Empfohlene Rücklage für die Steuer', tooltip: 'Rechnet den Einkommensteuertarif des § 32a EStG auf den steuerlichen Gewinn, zieht vorher die Sonderausgaben ab und legt Solidaritätszuschlag, Kirchensteuer und – bei Gewerbetreibenden – die nach der Anrechnung des § 35 EStG verbleibende Gewerbesteuer obendrauf. Die frühere Faustregel von 30 % war unter 20.000 € Gewinn zu hoch und darüber zu niedrig.' },
    { section: '💰 KPI – Gewinn & Steuer', type: 'kpi-ust-jahr', label: 'USt-Zahllast (Jahr)', icon: <FileText className="h-4 w-4 text-muted-foreground" />, description: 'Nur bei Regelbesteuerung aussagekräftig', tooltip: 'Umsatzsteuer aus den eigenen Rechnungen minus Vorsteuer aus den Einkäufen – das ist der Betrag ans Finanzamt. Ein Kleinunternehmer hat hier nichts stehen, schuldet die Steuer aber trotzdem selbst, wenn er Leistungen aus dem Ausland bezieht (§ 13b UStG) – dann ohne Vorsteuerabzug und mit eigener Voranmeldung.' },
    { section: '💰 KPI – Gewinn & Steuer', type: 'kpi-kleinunternehmer', label: 'Kleinunternehmergrenze', icon: <Receipt className="h-4 w-4 text-emerald-500" />, description: 'Abstand zu den Grenzen des § 19 UStG', tooltip: 'Die 25.000 € gelten für den Umsatz des Vorjahres, für das laufende Jahr sind es 100.000 €. Reißt der Vorjahresumsatz die Grenze, gilt ab dem 1. Januar des Folgejahres die Regelbesteuerung; die 100.000 € beenden den Status dagegen sofort und mitten im Jahr. Anlagenverkäufe zählen nicht zum Gesamtumsatz.' },
    { section: '💰 KPI – Gewinn & Steuer', type: 'kpi-saldo-prognose', label: 'Saldo inkl. Prognose', icon: <Sparkles className="h-4 w-4 text-violet-500" />, description: 'Hochgerechneter Monatsabschluss', tooltip: 'Aktueller Monatssaldo plus erwartete Einnahmen und Ausgaben bis Monatsende.' },

    // ── KPI – AfA & Vermögen ──
    { section: '🏗️ KPI – AfA & Vermögen', type: 'kpi-afa-jahres', label: 'AfA-Abschreibung (Jahr)', icon: <Calculator className="h-4 w-4 text-violet-500" />, description: 'Zeitanteilige Jahres-AfA', tooltip: 'Summe aller zeitanteiligen Abschreibungen (AfA + GWG-Sofortabzüge) für das ausgewählte Jahr.' },

    // ── KPI – Gesamt (alle Jahre) ──
    { section: '🌍 KPI – Gesamt (alle Jahre)', type: 'kpi-gesamt-einnahmen', label: 'Einnahmen gesamt', icon: <TrendingUp className="h-4 w-4 text-green-600" />, description: 'Über alle Jahre', tooltip: 'Summe aller Einnahmen über alle Jahre.' },
    { section: '🌍 KPI – Gesamt (alle Jahre)', type: 'kpi-gesamt-ausgaben', label: 'Ausgaben gesamt', icon: <TrendingDown className="h-4 w-4 text-red-600" />, description: 'Über alle Jahre', tooltip: 'Summe aller Ausgaben über alle Jahre.' },
    { section: '🌍 KPI – Gesamt (alle Jahre)', type: 'kpi-gesamt-saldo', label: 'Saldo gesamt', icon: <Euro className="h-4 w-4 text-primary" />, description: 'Über alle Jahre', tooltip: 'Einnahmen minus Ausgaben über alle Jahre.' },
    { section: '🌍 KPI – Gesamt (alle Jahre)', type: 'kpi-gesamt-belege', label: 'Belege gesamt', icon: <FileText className="h-4 w-4 text-muted-foreground" />, description: 'Alle erfassten Belege', tooltip: 'Gesamtanzahl aller erfassten Belege.' },
    { section: '🌍 KPI – Gesamt (alle Jahre)', type: 'kpi-gesamt-bestes-jahr', label: 'Bestes Jahr', icon: <TrendingUp className="h-4 w-4 text-amber-500" />, description: 'Jahr mit höchsten Einnahmen', tooltip: 'Das Jahr mit den höchsten Einnahmen.' },
    { section: '🌍 KPI – Gesamt (alle Jahre)', type: 'kpi-gesamt-avg-yearly-einnahmen', label: 'Ø Einnahmen / Jahr', icon: <TrendingUp className="h-4 w-4 text-green-600" />, description: 'Durchschnitt pro Jahr', tooltip: 'Durchschnittliche Einnahmen pro Jahr.' },
    { section: '🌍 KPI – Gesamt (alle Jahre)', type: 'kpi-gesamt-avg-yearly-ausgaben', label: 'Ø Ausgaben / Jahr', icon: <TrendingDown className="h-4 w-4 text-red-600" />, description: 'Durchschnitt pro Jahr', tooltip: 'Durchschnittliche Ausgaben pro Jahr.' },
    { section: '🌍 KPI – Gesamt (alle Jahre)', type: 'kpi-gesamt-marge', label: 'Ø Gewinnmarge (gesamt)', icon: <BarChart2 className="h-4 w-4 text-violet-500" />, description: 'Über alle Jahre', tooltip: 'Durchschnittliche Gewinnmarge über alle Jahre.' },

    // ── Charts – Umsatz & Cashflow ──
    { section: '📈 Charts – Umsatz & Cashflow', type: 'chart-revenue', label: 'Umsatzchart', icon: <BarChart2 className="h-4 w-4 text-blue-500" />, description: 'Monatlicher Umsatz als Balkendiagramm', tooltip: 'Balkendiagramm mit Einnahmen und Ausgaben pro Monat für das ausgewählte Jahr.' },
    { section: '📈 Charts – Umsatz & Cashflow', type: 'chart-cashflow', label: 'Cashflow (kumuliert)', icon: <BarChart2 className="h-4 w-4 text-blue-500" />, description: 'Kumulierter Jahres-Cashflow', tooltip: 'Zeigt den kumulierten Saldo Monat für Monat.' },
    { section: '📈 Charts – Umsatz & Cashflow', type: 'chart-last28days', label: '28-Tage-Chart', icon: <Activity className="h-4 w-4 text-teal-500" />, description: 'Tagesgenauer Verlauf der letzten 28 Tage', tooltip: 'Liniendiagramm mit tagesgenauen Einnahmen und Ausgaben der letzten 28 Tage.' },
    { section: '📈 Charts – Umsatz & Cashflow', type: 'chart-month', label: 'Monatschart', icon: <Activity className="h-4 w-4 text-cyan-500" />, description: 'Tagesgenauer Verlauf des gewählten Monats', tooltip: 'Balkendiagramm mit tagesgenauen Einnahmen und Ausgaben.' },
    { section: '📈 Charts – Umsatz & Cashflow', type: 'chart-category-donut', label: 'Kategorien-Donut', icon: <PieChart className="h-4 w-4 text-pink-500" />, description: 'Ausgaben nach Kategorie (Donut)', tooltip: 'Ringdiagramm, das die Ausgaben nach Kategorien aufschlüsselt.' },
    { section: '📈 Charts – Umsatz & Cashflow', type: 'chart-jahresprognose', label: 'Jahresprognose', icon: <Sparkles className="h-4 w-4 text-amber-500" />, description: 'Kumulierter Cashflow + Abo-Prognose', tooltip: 'Ist-Cashflow plus Prognose basierend auf erkannten wiederkehrenden Zahlungen.' },

    // ── Charts – Gesamt (alle Jahre) ──
    { section: '📈 Charts – Gesamt', type: 'chart-gesamt-revenue', label: 'Jahresvergleich-Chart', icon: <BarChart2 className="h-4 w-4 text-blue-500" />, description: 'Einnahmen/Ausgaben pro Jahr', tooltip: 'Balkendiagramm mit Einnahmen und Ausgaben je Jahr.' },
    { section: '📈 Charts – Gesamt', type: 'chart-gesamt-cashflow', label: 'Cashflow (alle Jahre)', icon: <BarChart2 className="h-4 w-4 text-blue-500" />, description: 'Kumulierter Cashflow über alle Jahre', tooltip: 'Zeigt den kumulierten Cashflow über alle Jahre.' },

    // ── Charts – AfA ──
    { section: '📈 Charts – AfA', type: 'chart-afa-typ', label: 'AfA nach Typ (Balken)', icon: <Calculator className="h-4 w-4 text-violet-500" />, description: 'Abschreibung nach Wirtschaftsgut-Typ', tooltip: 'Horizontales Balkendiagramm nach Wirtschaftsgut-Typ.' },
    { section: '📈 Charts – AfA', type: 'chart-afa-donut', label: 'AfA-Verteilung (Donut)', icon: <PieChart className="h-4 w-4 text-violet-400" />, description: 'Prozentuale AfA-Verteilung nach Typ', tooltip: 'Ringdiagramm der jährlichen Abschreibung nach Typ.' },
    { section: '📈 Charts – AfA', type: 'chart-afa-timeline', label: 'AfA-Zeitverlauf', icon: <Activity className="h-4 w-4 text-violet-500" />, description: 'Abschreibung aller Geräte über die Zeit', tooltip: 'Gestapeltes Flächendiagramm über die gesamte Nutzungsdauer. Umschaltbar zwischen jährlich und monatlich.' },

    // ── Listen & Tabellen ──
    { section: '📋 Listen & Tabellen', type: 'list-recent-invoices', label: 'Letzte 10 Belege', icon: <List className="h-4 w-4 text-muted-foreground" />, description: 'Tabelle der zuletzt erfassten Belege', tooltip: 'Kompakte Tabelle mit den 10 zuletzt hinzugefügten Rechnungen. Per Klick zum Beleg.' },
    { section: '📋 Listen & Tabellen', type: 'list-top-ausgaben', label: 'Top Ausgaben', icon: <List className="h-4 w-4 text-red-500" />, description: 'Größte Einzel-Ausgaben', tooltip: 'Die fünf größten Ausgaben des Jahres.' },
    { section: '📋 Listen & Tabellen', type: 'list-top-einnahmen', label: 'Top Einnahmen', icon: <List className="h-4 w-4 text-green-500" />, description: 'Größte Einzel-Einnahmen', tooltip: 'Die fünf größten Einnahmen des Jahres.' },
    { section: '📋 Listen & Tabellen', type: 'list-top-partner', label: 'Top Kunden', icon: <List className="h-4 w-4 text-green-500" />, description: 'Top Partner nach Umsatz', tooltip: 'Partner/Kunden mit dem höchsten Umsatz.' },
    { section: '📋 Listen & Tabellen', type: 'list-abos', label: 'Aktive Abos', icon: <List className="h-4 w-4 text-indigo-500" />, description: 'Erkannte wiederkehrende Zahlungen', tooltip: 'Alle automatisch erkannten Abos und wiederkehrenden Zahlungen.' },
    { section: '📋 Listen & Tabellen', type: 'card-monatsuebersicht', label: 'Monatsübersicht', icon: <Table2 className="h-4 w-4 text-blue-400" />, description: 'Alle 12 Monate als Tabelle', tooltip: 'Zeigt alle 12 Monate mit Einnahmen, Ausgaben und Saldo.' },
    { section: '📋 Listen & Tabellen', type: 'list-recent-emails', label: 'Letzte E-Mails', icon: <Mail className="h-4 w-4 text-blue-500" />, description: 'Zuletzt empfangene Rechnungs-Mails', tooltip: 'Neueste E-Mails aus dem verknüpften Gmail-Postfach.' },

    // ── Prognose ──
    { section: '🔮 Prognose', type: 'list-forecast', label: 'Prognose (Monat)', icon: <Sparkles className="h-4 w-4 text-violet-500" />, description: 'Erwartete Buchungen bis Monatsende', tooltip: 'Voraussichtliche Einnahmen und Ausgaben bis zum Monatsende.' },
    { section: '🔮 Prognose', type: 'list-forecast-28d', label: 'Prognose (28 Tage)', icon: <CalendarRange className="h-4 w-4 text-violet-400" />, description: 'Erwartete Buchungen in 28 Tagen', tooltip: 'Voraussichtliche Einnahmen und Ausgaben in einem rollierenden 28-Tage-Fenster.' },

    // ── Karten & Vergleiche ──
    { section: '🃏 Karten & Vergleiche', type: 'card-partner', label: 'Partner-Umsatz', icon: <User className="h-4 w-4 text-indigo-500" />, description: 'Einnahmen & Ausgaben für einen Partner', tooltip: 'Zeigt Einnahmen, Ausgaben und Saldo für einen frei wählbaren Partner.' },
    { section: '🃏 Karten & Vergleiche', type: 'card-jahresvergleich', label: 'Jahresvergleich', icon: <BarChart2 className="h-4 w-4 text-indigo-500" />, description: 'Vergleich Einnahmen/Ausgaben Vorjahr', tooltip: 'Stellt das gewählte Jahr dem Vorjahr gegenüber.' },
    { section: '🃏 Karten & Vergleiche', type: 'card-sonderausgaben', label: 'Sonderausgaben', icon: <Receipt className="h-4 w-4 text-amber-500" />, description: 'Übersicht steuerlicher Sonderausgaben', tooltip: 'Alle als Sonderausgabe markierten Belege des Jahres – Kranken- und Pflegeversicherung, Altersvorsorge, Spenden. Sie mindern nicht den Gewinn der EÜR, sondern erst das zu versteuernde Einkommen in der Einkommensteuererklärung (§ 10 EStG).' },

    // ── AfA & Vermögen ──
    { section: '🏗️ AfA & Vermögen', type: 'card-afa-uebersicht', label: 'AfA & GWG Übersicht', icon: <Calculator className="h-4 w-4 text-violet-500" />, description: 'Wirtschaftsgüter mit Abschreibung', tooltip: 'Alle Belege mit Kategorie „AfA" oder „GWG" inklusive Abschreibungsmethode und Jahressumme. Die Wertgrenzen von 250, 800 und 1.000 € werden immer am Nettobetrag gemessen – auch beim Kleinunternehmer, der anschließend den Bruttobetrag abschreibt.' },
    { section: '🏗️ AfA & Vermögen', type: 'card-vermoegenscheck', label: 'Vermögens-Check', icon: <ShieldCheck className="h-4 w-4 text-emerald-500" />, description: 'Aktiva vs. Passiva', tooltip: 'Überschlag des Betriebsvermögens: liquide Mittel plus Sachanlagen minus Rückstellungen. Keine Bilanz – wer den Gewinn per EÜR ermittelt, stellt gar keine auf; die Zahl ist eine Orientierung, kein Abschluss.' },
    { section: '🏗️ AfA & Vermögen', type: 'card-investitionsspiegel', label: 'Investitions-Spiegel', icon: <Package className="h-4 w-4 text-violet-500" />, description: 'Anlagevermögen mit Restwerten', tooltip: 'Alle Anlagegüter mit Anschaffungskosten, kumulierter Abschreibung und Restwert.' },
    { section: '🏗️ AfA & Vermögen', type: 'kpi-stille-reserven', label: 'Stille Reserven', icon: <Layers className="h-4 w-4 text-violet-400" />, description: 'Gesamt-Restwert aller Anlagen', tooltip: 'Summe der Restbuchwerte aller Anlagegüter – also das, was in den kommenden Jahren noch abgeschrieben werden kann. Echte stille Reserven wären erst die Differenz zwischen Buchwert und Verkehrswert; den Verkehrswert kennt die App nicht.' },

    // ── Risiko & Analyse ──
    { section: '🔍 Risiko & Analyse', type: 'kpi-kundenkonzentration', label: 'Kunden-Konzentration', icon: <Users className="h-4 w-4 text-blue-500" />, description: 'Klumpenrisiko: Top-Kunden-Anteil', tooltip: 'Anteil des umsatzstärksten Kunden an den Gesamteinnahmen. Über 50 % ist das ein Klumpenrisiko – und wenn dauerhaft fast alles von einem Auftraggeber kommt, ist es auch ein Indiz für Scheinselbständigkeit.' },
    { section: '🔍 Risiko & Analyse', type: 'kpi-mrc', label: 'Monthly Recurring Costs', icon: <RefreshCw className="h-4 w-4 text-cyan-500" />, description: 'Monatlich wiederkehrende Ausgaben', tooltip: 'Summe aller automatisch erkannten monatlichen Abo-Ausgaben. Zeigt deine fixen monatlichen Kosten.' },

    // ── System ──
    { section: '⚙️ System', type: 'card-system-stats', label: 'System & Speicher', icon: <HardDrive className="h-4 w-4 text-slate-500" />, description: 'Speicherplatz, RAM, CPU-Auslastung', tooltip: 'Zeigt Datenbankgröße, Größe der gespeicherten Rechnungsdateien, genutzten Arbeitsspeicher und CPU-Auslastung.' },

    // ── Fahrtenbuch ──
    { section: '🚗 Fahrtenbuch', type: 'kpi-fahrt-km', label: 'Dienstfahrten (km)', icon: <Car className="h-4 w-4 text-blue-500" />, description: 'Gefahrene Dienstkilometer im Jahr', tooltip: 'Gesamtkilometer aller Dienstfahrten im ausgewählten Jahr laut Fahrtenbuch.' },
    { section: '🚗 Fahrtenbuch', type: 'kpi-fahrt-absetzbar', label: 'km-Pauschale (absetzbar)', icon: <Car className="h-4 w-4 text-green-600" />, description: 'Steuerlich absetzbarer km-Betrag (Jahr)', tooltip: 'Dienstkilometer × km-Pauschale. Fließt automatisch in den steuerlichen Gewinn (EÜR) ein. Die Pauschale gibt es nur für ein Fahrzeug im Privatvermögen: Gehört der Wagen zum Betriebsvermögen, zählen die tatsächlichen Fahrzeugkosten – beides zusammen wäre ein doppelter Abzug.' },
    { section: '🚗 Fahrtenbuch', type: 'kpi-fahrt-km-monat', label: 'Dienstfahrten (km, Monat)', icon: <Car className="h-4 w-4 text-blue-400" />, description: 'Dienstkilometer im gewählten Monat', tooltip: 'Gesamtkilometer aller Dienstfahrten im ausgewählten Monat.' },
    { section: '🚗 Fahrtenbuch', type: 'kpi-fahrt-absetzbar-monat', label: 'km-Pauschale (Monat)', icon: <Car className="h-4 w-4 text-green-500" />, description: 'Steuerlich absetzbarer km-Betrag (Monat)', tooltip: 'Monatliche Dienstkilometer × km-Pauschale – ebenfalls nur für ein Fahrzeug im Privatvermögen und nicht neben den tatsächlichen Fahrzeugkosten.' },
    { section: '🚗 Fahrtenbuch', type: 'chart-fahrt-map', label: 'Fahrten-Karte', icon: <Car className="h-4 w-4 text-violet-500" />, description: 'Alle Fahrten auf der Karte (Monat/Jahr)', tooltip: 'Zeigt alle Dienst- und Privatfahrten des gewählten Monats oder Jahres auf einer interaktiven Karte. Blau = Dienst, Grau = Privat.' },
    { section: '🚗 Fahrtenbuch', type: 'card-fahrtenbuch', label: 'Fahrtenbuch-Übersicht', icon: <Car className="h-4 w-4 text-violet-400" />, description: 'km Dienst/Privat + absetzbarer Betrag', tooltip: 'Kompakte Übersicht: Dienstkilometer, Privatkilometer, absetzbare km-Pauschale und Anzahl der Fahrteneinträge. Die Pauschale für Dienstfahrten mit dem eigenen Pkw ist von der Entfernungspauschale für den Weg zur Arbeit zu trennen – sie gilt je tatsächlich gefahrenem Kilometer und ist nicht gedeckelt.' },
];

/** Alle Sektionen in Katalog-Reihenfolge. */
/**
 * Bausteine, die einen Betrieb voraussetzen. Wer angestellt ist, hat keine
 * Umsatzsteuer, keine Kleinunternehmergrenze und legt auch nichts für die
 * Einkommensteuer zurück – das erledigt der Lohnsteuerabzug.
 */
export const SELBSTSTAENDIGEN_WIDGETS: NodeType[] = [
  'kpi-ust-jahr',
  'kpi-steuerruecklage',
  'kpi-kleinunternehmer',
  'kpi-marge',
  'kpi-gesamt-marge',
  'kpi-stille-reserven',
  'kpi-kundenkonzentration',
  'card-partner',
  'list-top-partner',
];

/** Katalog für den jeweiligen Status. */
export function itemsFor(rechtsform: string, items: SidebarItemDef[]): SidebarItemDef[] {
  if (rechtsform !== 'angestellt') return items;
  return items.filter((i) => !SELBSTSTAENDIGEN_WIDGETS.includes(i.type));
}

export const CATALOG_SECTIONS: string[] = Array.from(new Set(ALL_ITEMS.map((i) => i.section)));

/** Nur echte Widgets (ohne Layout-Container) – für das Mobile-Dashboard. */
export const WIDGET_ITEMS: SidebarItemDef[] = ALL_ITEMS.filter((i) => !i.type.startsWith('grid-'));
