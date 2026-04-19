import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useState, useMemo } from 'react';
import type { NodeType } from '@/types/dashboard';
import { cn } from '@/lib/utils';
import {
  Columns2, Rows2, BookOpen,
  TrendingUp, TrendingDown, Euro, Calculator, FileText,
  BarChart2, PieChart, Activity, Receipt,
  Sparkles, Mail, List, RotateCcw, X, Info, CalendarRange,
  Percent, PiggyBank, Table2,
  PanelLeft, LayoutGrid, LayoutDashboard, AlignJustify,
  User, Search,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// ─── Sidebar Draggable Item ──────────────────────────────────────────────────

interface SidebarItemProps {
  type: NodeType;
  label: string;
  icon: React.ReactNode;
  description?: string;
  tooltip?: string;
}

function SidebarDraggableItem({ type, label, icon, description, tooltip }: SidebarItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `sidebar-${type}`,
    data: { source: 'sidebar', elementType: type },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 rounded-lg border bg-card cursor-grab active:cursor-grabbing hover:bg-muted/60 transition-colors select-none touch-none',
        isDragging && 'shadow-lg ring-2 ring-primary',
      )}
    >
      <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium truncate">{label}</div>
        {description && (
          <div className="text-[10px] text-muted-foreground truncate">{description}</div>
        )}
      </div>
      {tooltip && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="flex-shrink-0 h-5 w-5 rounded flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted transition-colors pointer-events-auto"
              tabIndex={-1}
            >
              <Info className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="left" align="center" className="w-56 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">{label}</p>
            <p>{tooltip}</p>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="px-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

// ─── Sidebar Component ───────────────────────────────────────────────────────

interface SidebarItemDef {
  type: NodeType;
  label: string;
  icon: React.ReactNode;
  description?: string;
  tooltip?: string;
  section: string;
}

interface DashboardEditSidebarProps {
  onClose: () => void;
  onReset: () => void;
}

export function DashboardEditSidebar({ onClose, onReset }: DashboardEditSidebarProps) {
  const [search, setSearch] = useState('');

  const allItems: SidebarItemDef[] = [
    // Grids
    { section: 'Grids', type: 'grid-horizontal', label: 'Horizontal', icon: <Columns2 className="h-4 w-4 text-blue-500" />, description: 'Elemente nebeneinander', tooltip: 'Ordnet alle enthaltenen Elemente nebeneinander in einer Zeile an. Ideal für KPI-Karten, die auf einen Blick verglichen werden sollen.' },
    { section: 'Grids', type: 'grid-vertical', label: 'Vertikal', icon: <Rows2 className="h-4 w-4 text-purple-500" />, description: 'Elemente untereinander', tooltip: 'Stapelt alle enthaltenen Elemente untereinander. Perfekt als Hauptstruktur oder um mehrere Charts in einer Spalte zu gruppieren.' },
    { section: 'Grids', type: 'grid-pages', label: 'Seiten', icon: <BookOpen className="h-4 w-4 text-orange-500" />, description: 'Tab-Seiten mit eigenem Inhalt', tooltip: 'Erstellt mehrere benannte Tab-Seiten in einem Container. So kannst du z. B. verschiedene Zeiträume oder Themenbereiche trennen, ohne Platz zu verschwenden.' },
    { section: 'Grids', type: 'grid-sidebar', label: 'Sidebar', icon: <PanelLeft className="h-4 w-4 text-cyan-500" />, description: 'Schmale Seitenleiste + Hauptbereich', tooltip: 'Zwei-Spalten-Layout: Das erste Kind erhält eine feste Breite als Seitenleiste (240 px), alle weiteren Kinder füllen den verbleibenden Platz. Ideal für Navigation + Inhalt.' },
    { section: 'Grids', type: 'grid-masonry', label: 'Masonry', icon: <LayoutGrid className="h-4 w-4 text-emerald-500" />, description: 'Wasserfall-Layout (2 Spalten)', tooltip: 'Karten fließen automatisch in zwei Spalten – ähnlich wie Pinterest. Unterschiedlich hohe Widgets füllen sich lückenlos. Kein manuelles Ausrichten nötig.' },
    { section: 'Grids', type: 'grid-accordion', label: 'Akkordeon', icon: <AlignJustify className="h-4 w-4 text-rose-500" />, description: 'Aufklappbare Sektionen', tooltip: 'Jedes Kind-Element bekommt einen klickbaren Header und kann einzeln ein- oder ausgeklappt werden. Spart Platz bei vielen Widgets.' },
    { section: 'Grids', type: 'grid-bento', label: 'Bento', icon: <LayoutDashboard className="h-4 w-4 text-violet-500" />, description: 'Konfigurierbares CSS-Grid (3 Spalten)', tooltip: 'Modernes Bento-Box-Layout mit 3 gleichmäßigen Spalten. Kinder können über colSpan in den Props mehrere Spalten einnehmen – für eine magazinartige Aufteilung.' },
    // Kennzahlen
    { section: 'Kennzahlen', type: 'kpi-einnahmen-ytd', label: 'Einnahmen YTD', icon: <TrendingUp className="h-4 w-4 text-green-600" />, description: 'Gesamteinnahmen im laufenden Jahr', tooltip: 'Zeigt die Summe aller Einnahmen vom 1. Januar bis heute, inklusive Vergleich zum Vorjahreszeitraum als Deltawert.' },
    { section: 'Kennzahlen', type: 'kpi-ausgaben-ytd', label: 'Ausgaben YTD', icon: <TrendingDown className="h-4 w-4 text-red-600" />, description: 'Gesamtausgaben im laufenden Jahr', tooltip: 'Zeigt die Summe aller Ausgaben vom 1. Januar bis heute, inklusive Vergleich zum Vorjahreszeitraum als Deltawert.' },
    { section: 'Kennzahlen', type: 'kpi-saldo-ytd', label: 'Saldo YTD', icon: <Euro className="h-4 w-4 text-primary" />, description: 'Einnahmen minus alle Ausgaben (YTD)', tooltip: 'Tatsächlich verfügbares Geld: Einnahmen abzüglich aller Ausgaben (inkl. Sonderausgaben) seit Jahresbeginn. Vergleich zum Vorjahr als Delta.' },
    { section: 'Kennzahlen', type: 'kpi-betriebsergebnis', label: 'Betriebsergebnis', icon: <Calculator className="h-4 w-4 text-violet-600" />, description: 'Steuerlich relevantes Ergebnis', tooltip: 'Einnahmen abzüglich nur der Betriebsausgaben (ohne Sonderausgaben). Entspricht dem steuerlich relevanten Gewinn im laufenden Jahr.' },
    { section: 'Kennzahlen', type: 'kpi-belege-30d', label: 'Belege (30 Tage)', icon: <FileText className="h-4 w-4 text-muted-foreground" />, description: 'Anzahl Belege der letzten 30 Tage', tooltip: 'Zeigt die Anzahl aller erfassten Belege (Ein- und Ausgaben) der vergangenen 30 Tage.' },
    { section: 'Kennzahlen', type: 'kpi-einnahmen-monat', label: 'Einnahmen (Monat)', icon: <TrendingUp className="h-4 w-4 text-green-600" />, description: 'Einnahmen im aktuellen Monat', tooltip: 'Summe aller Einnahmen im laufenden Kalendermonat, mit Vergleich zum selben Monat des Vorjahres.' },
    { section: 'Kennzahlen', type: 'kpi-ausgaben-monat', label: 'Ausgaben (Monat)', icon: <TrendingDown className="h-4 w-4 text-red-600" />, description: 'Ausgaben im aktuellen Monat', tooltip: 'Summe aller Ausgaben im laufenden Kalendermonat, mit Vergleich zum selben Monat des Vorjahres.' },
    { section: 'Kennzahlen', type: 'kpi-saldo-monat', label: 'Saldo (Monat)', icon: <Euro className="h-4 w-4 text-primary" />, description: 'Einnahmen minus Ausgaben (Monat)', tooltip: 'Monatlicher Überschuss: Einnahmen abzüglich aller Ausgaben im aktuellen Kalendermonat, mit Vorjahresvergleich.' },
    { section: 'Kennzahlen', type: 'kpi-saldo-prognose', label: 'Saldo inkl. Prognose', icon: <Sparkles className="h-4 w-4 text-violet-500" />, description: 'Hochgerechneter Monatsabschluss', tooltip: 'Aktueller Monatssaldo plus erwartete Einnahmen und Ausgaben bis Monatsende – basierend auf erkannten Wiederholungsmustern aus der Vergangenheit.' },
    { section: 'Kennzahlen', type: 'kpi-avg-einnahmen-monat', label: 'Ø Einnahmen / Monat', icon: <TrendingUp className="h-4 w-4 text-green-600" />, description: 'Durchschnittliche monatliche Einnahmen', tooltip: 'Gesamteinnahmen des Jahres geteilt durch 12 – mit Vergleich zum Vorjahreswert.' },
    { section: 'Kennzahlen', type: 'kpi-avg-ausgaben-monat', label: 'Ø Ausgaben / Monat', icon: <TrendingDown className="h-4 w-4 text-red-600" />, description: 'Durchschnittliche monatliche Ausgaben', tooltip: 'Gesamtausgaben des Jahres geteilt durch 12 – mit Vergleich zum Vorjahreswert.' },
    { section: 'Kennzahlen', type: 'kpi-marge', label: 'Gewinnmarge', icon: <Percent className="h-4 w-4 text-violet-500" />, description: 'Steuerlicher Gewinnanteil in %', tooltip: 'Betriebsergebnis geteilt durch Einnahmen – zeigt, wie viel Prozent der Einnahmen als Gewinn verbleiben.' },
    { section: 'Kennzahlen', type: 'kpi-steuerruecklage', label: 'Steuerrücklage (30 %)', icon: <PiggyBank className="h-4 w-4 text-amber-500" />, description: 'Empfohlene Rücklage für Einkommensteuer', tooltip: 'Richtwert: 30 % des Betriebsergebnisses als Steuerrücklage einplanen. Kein Steuerberaterersatz.' },
    { section: 'Kennzahlen', type: 'kpi-ust-jahr', label: 'USt-Zahllast (Jahr)', icon: <FileText className="h-4 w-4 text-muted-foreground" />, description: 'Nur für Regelbesteuerer sinnvoll', tooltip: 'Nur für regelbesteuerte Unternehmer relevant: Zeigt die USt, die du von Kunden eingenommen hast, minus der Vorsteuer aus deinen Einkäufen = Betrag ans Finanzamt.' },
    { section: 'Kennzahlen', type: 'kpi-kleinunternehmer', label: 'Kleinunternehmergrenze', icon: <Receipt className="h-4 w-4 text-emerald-500" />, description: 'Fortschritt zur USt-Pflichtgrenze', tooltip: 'Zeigt deine aktuellen Jahreseinnahmen im Verhältnis zur Kleinunternehmergrenze (25.000 € ab 2025). Farbige Warnung wenn du dich der Grenze näherst oder sie überschreitest.' },
    // Statistiken
    { section: 'Statistiken', type: 'chart-revenue', label: 'Umsatzchart', icon: <BarChart2 className="h-4 w-4 text-blue-500" />, description: 'Monatlicher Umsatz als Balkendiagramm', tooltip: 'Balkendiagramm mit Einnahmen und Ausgaben pro Monat für das ausgewählte Jahr. Zeigt auf einen Blick saisonale Schwankungen.' },
    { section: 'Statistiken', type: 'chart-cashflow', label: 'Cashflow (kumuliert)', icon: <BarChart2 className="h-4 w-4 text-blue-500" />, description: 'Kumulierter Jahres-Cashflow', tooltip: 'Zeigt den kumulierten Saldo Monat für Monat – hilfreich um Liquiditätsengpässe früh zu erkennen.' },
    { section: 'Statistiken', type: 'chart-category-donut', label: 'Kategorien-Donut', icon: <PieChart className="h-4 w-4 text-pink-500" />, description: 'Ausgaben nach Kategorie (Donut)', tooltip: 'Ringdiagramm, das die Ausgaben nach Kategorien aufschlüsselt. Ideal um zu sehen, wo das meiste Geld hinfließt.' },
    { section: 'Statistiken', type: 'chart-last28days', label: '28-Tage-Chart', icon: <Activity className="h-4 w-4 text-teal-500" />, description: 'Tagesgenauer Verlauf der letzten 28 Tage', tooltip: 'Liniendiagramm mit tagesgenauen Einnahmen und Ausgaben der letzten 28 Tage. Gut für kurzfristige Cashflow-Analyse.' },
    { section: 'Statistiken', type: 'chart-month', label: 'Monatschart', icon: <Activity className="h-4 w-4 text-cyan-500" />, description: 'Tagesgenauer Verlauf des gewählten Monats', tooltip: 'Balkendiagramm mit tagesgenauen Einnahmen und Ausgaben für den ausgewählten Monat.' },
    { section: 'Statistiken', type: 'card-sonderausgaben', label: 'Sonderausgaben', icon: <Receipt className="h-4 w-4 text-amber-500" />, description: 'Übersicht steuerlicher Sonderausgaben', tooltip: 'Listet alle als Sonderausgabe markierten Belege des Jahres auf – z. B. Versicherungen, Spenden oder Vorsorgeaufwendungen.' },
    { section: 'Statistiken', type: 'card-jahresvergleich', label: 'Jahresvergleich', icon: <BarChart2 className="h-4 w-4 text-indigo-500" />, description: 'Vergleich Einnahmen/Ausgaben Vorjahr', tooltip: 'Stellt Einnahmen, Ausgaben und Betriebsergebnis des gewählten Jahres dem Vorjahr gegenüber.' },
    { section: 'Statistiken', type: 'chart-jahresprognose', label: 'Jahresprognose (Abo-Cashflow)', icon: <Sparkles className="h-4 w-4 text-amber-500" />, description: 'Kumulierter Cashflow + Prognose auf Abo-Basis', tooltip: 'Zeigt den kumulierten Ist-Cashflow des laufenden Jahres und verlängert ihn für die verbleibenden Monate mit einer Prognose basierend auf erkannten wiederkehrenden Zahlungen (Abos).' },
    // Listen
    { section: 'Listen', type: 'list-top-ausgaben', label: 'Top Ausgaben', icon: <List className="h-4 w-4 text-red-500" />, description: 'Größte Einzel-Ausgaben', tooltip: 'Die fünf größten Ausgaben des Jahres als schnelle Übersicht.' },
    { section: 'Listen', type: 'list-top-einnahmen', label: 'Top Einnahmen', icon: <List className="h-4 w-4 text-green-500" />, description: 'Größte Einzel-Einnahmen', tooltip: 'Die fünf größten Einnahmen des Jahres – ideal um wichtige Kunden oder Großprojekte auf einen Blick zu sehen.' },
    { section: 'Listen', type: 'list-top-partner', label: 'Top Kunden', icon: <List className="h-4 w-4 text-green-500" />, description: 'Top Partner nach Umsatz', tooltip: 'Zeigt die Partner/Kunden mit dem höchsten Umsatz im ausgewählten Jahr.' },
    { section: 'Listen', type: 'list-forecast', label: 'Prognose (Monat)', icon: <Sparkles className="h-4 w-4 text-violet-500" />, description: 'Erwartete Buchungen bis Monatsende', tooltip: 'Zeigt voraussichtliche Einnahmen und Ausgaben bis zum Monatsende, abgeleitet aus erkannten Wiederholungsmustern (z. B. monatliche Abos).' },
    { section: 'Listen', type: 'list-forecast-28d', label: 'Prognose (28 Tage)', icon: <CalendarRange className="h-4 w-4 text-violet-400" />, description: 'Erwartete Buchungen in den nächsten 28 Tagen', tooltip: 'Zeigt alle voraussichtlichen Einnahmen und Ausgaben in einem rollierenden 28-Tage-Fenster ab heute – unabhängig vom ausgewählten Monat.' },
    { section: 'Listen', type: 'list-recent-emails', label: 'Letzte E-Mails', icon: <Mail className="h-4 w-4 text-blue-500" />, description: 'Zuletzt empfangene Rechnungs-Mails', tooltip: 'Zeigt die neuesten E-Mails aus dem verknüpften Gmail-Postfach mit erkannten Rechnungsanhängen – für schnellen Zugriff direkt vom Dashboard.' },
    { section: 'Listen', type: 'list-recent-invoices', label: 'Letzte 10 Belege', icon: <List className="h-4 w-4 text-muted-foreground" />, description: 'Tabelle der 10 zuletzt erfassten Belege', tooltip: 'Kompakte Tabelle mit den 10 zuletzt hinzugefügten Rechnungen oder Ausgaben. Per Klick gelangt man direkt zum jeweiligen Beleg.' },
    { section: 'Listen', type: 'card-monatsuebersicht', label: 'Monatsübersicht', icon: <Table2 className="h-4 w-4 text-blue-400" />, description: 'Jahresübersicht aller Monate als Tabelle', tooltip: 'Zeigt alle 12 Monate mit Einnahmen, Ausgaben und Saldo in einer kompakten Tabelle – ideal für einen schnellen Jahresüberblick.' },
    { section: 'Listen', type: 'card-partner', label: 'Partner-Umsatz', icon: <User className="h-4 w-4 text-indigo-500" />, description: 'Einnahmen & Ausgaben für einen Partner', tooltip: 'Zeigt Einnahmen, Ausgaben und Saldo für einen frei wählbaren Partner – filterbar nach aktuellem Monat, Jahr oder gesamt. Partner über das ⚙-Icon auswählen.' },
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.section.toLowerCase().includes(q),
    );
  }, [search]);

  // Group filtered items by section
  const sections = useMemo(() => {
    const map = new Map<string, SidebarItemDef[]>();
    for (const item of filtered) {
      if (!map.has(item.section)) map.set(item.section, []);
      map.get(item.section)!.push(item);
    }
    return map;
  }, [filtered]);

  return (
    <div className="w-72 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b flex-shrink-0">
        <div>
          <h3 className="font-semibold text-sm">Dashboard anpassen</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Ziehe Elemente ins Dashboard</p>
        </div>
        <button
          onClick={onClose}
          className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-1 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Elemente suchen…"
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* Palette – scrollable */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {sections.size === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Keine Elemente gefunden.</p>
        ) : (
          Array.from(sections.entries()).map(([sectionTitle, items]) => (
            <Section key={sectionTitle} title={sectionTitle}>
              {items.map((item) => (
                <SidebarDraggableItem key={item.type} {...item} />
              ))}
            </Section>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t flex-shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 text-muted-foreground"
          onClick={onReset}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Layout zurücksetzen
        </Button>
      </div>
    </div>
  );
}
