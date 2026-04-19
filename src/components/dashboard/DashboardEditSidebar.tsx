import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { NodeType } from '@/types/dashboard';
import { cn } from '@/lib/utils';
import {
  Columns2, Rows2, BookOpen,
  TrendingUp, TrendingDown, Euro, Calculator, FileText,
  BarChart2, PieChart, Activity, Receipt,
  Sparkles, Mail, List, RotateCcw, X, Info, CalendarRange,
} from 'lucide-react';
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

interface DashboardEditSidebarProps {
  onClose: () => void;
  onReset: () => void;
}

export function DashboardEditSidebar({ onClose, onReset }: DashboardEditSidebarProps) {
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

      {/* Palette – scrollable */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        <Section title="Grids">
          <SidebarDraggableItem
            type="grid-horizontal"
            label="Horizontal"
            icon={<Columns2 className="h-4 w-4 text-blue-500" />}
            description="Elemente nebeneinander"
            tooltip="Ordnet alle enthaltenen Elemente nebeneinander in einer Zeile an. Ideal für KPI-Karten, die auf einen Blick verglichen werden sollen."
          />
          <SidebarDraggableItem
            type="grid-vertical"
            label="Vertikal"
            icon={<Rows2 className="h-4 w-4 text-purple-500" />}
            description="Elemente untereinander"
            tooltip="Stapelt alle enthaltenen Elemente untereinander. Perfekt als Hauptstruktur oder um mehrere Charts in einer Spalte zu gruppieren."
          />
          <SidebarDraggableItem
            type="grid-pages"
            label="Seiten"
            icon={<BookOpen className="h-4 w-4 text-orange-500" />}
            description="Tab-Seiten mit eigenem Inhalt"
            tooltip="Erstellt mehrere benannte Tab-Seiten in einem Container. So kannst du z. B. verschiedene Zeiträume oder Themenbereiche trennen, ohne Platz zu verschwenden."
          />
        </Section>

        <Section title="Kennzahlen">
          <SidebarDraggableItem type="kpi-einnahmen-ytd" label="Einnahmen YTD"
            icon={<TrendingUp className="h-4 w-4 text-green-600" />}
            description="Gesamteinnahmen im laufenden Jahr"
            tooltip="Zeigt die Summe aller Einnahmen vom 1. Januar bis heute, inklusive Vergleich zum Vorjahreszeitraum als Deltawert." />
          <SidebarDraggableItem type="kpi-ausgaben-ytd" label="Ausgaben YTD"
            icon={<TrendingDown className="h-4 w-4 text-red-600" />}
            description="Gesamtausgaben im laufenden Jahr"
            tooltip="Zeigt die Summe aller Ausgaben vom 1. Januar bis heute, inklusive Vergleich zum Vorjahreszeitraum als Deltawert." />
          <SidebarDraggableItem type="kpi-saldo-ytd" label="Saldo YTD"
            icon={<Euro className="h-4 w-4 text-primary" />}
            description="Einnahmen minus alle Ausgaben (YTD)"
            tooltip="Tatsächlich verfügbares Geld: Einnahmen abzüglich aller Ausgaben (inkl. Sonderausgaben) seit Jahresbeginn. Vergleich zum Vorjahr als Delta." />
          <SidebarDraggableItem type="kpi-betriebsergebnis" label="Betriebsergebnis"
            icon={<Calculator className="h-4 w-4 text-violet-600" />}
            description="Steuerlich relevantes Ergebnis"
            tooltip="Einnahmen abzüglich nur der Betriebsausgaben (ohne Sonderausgaben). Entspricht dem steuerlich relevanten Gewinn im laufenden Jahr." />
          <SidebarDraggableItem type="kpi-belege-30d" label="Belege (30 Tage)"
            icon={<FileText className="h-4 w-4 text-muted-foreground" />}
            description="Anzahl Belege der letzten 30 Tage"
            tooltip="Zeigt die Anzahl aller erfassten Belege (Ein- und Ausgaben) der vergangenen 30 Tage." />
          <SidebarDraggableItem type="kpi-einnahmen-monat" label="Einnahmen (Monat)"
            icon={<TrendingUp className="h-4 w-4 text-green-600" />}
            description="Einnahmen im aktuellen Monat"
            tooltip="Summe aller Einnahmen im laufenden Kalendermonat, mit Vergleich zum selben Monat des Vorjahres." />
          <SidebarDraggableItem type="kpi-ausgaben-monat" label="Ausgaben (Monat)"
            icon={<TrendingDown className="h-4 w-4 text-red-600" />}
            description="Ausgaben im aktuellen Monat"
            tooltip="Summe aller Ausgaben im laufenden Kalendermonat, mit Vergleich zum selben Monat des Vorjahres." />
          <SidebarDraggableItem type="kpi-saldo-monat" label="Saldo (Monat)"
            icon={<Euro className="h-4 w-4 text-primary" />}
            description="Einnahmen minus Ausgaben (Monat)"
            tooltip="Monatlicher Überschuss: Einnahmen abzüglich aller Ausgaben im aktuellen Kalendermonat, mit Vorjahresvergleich." />
          <SidebarDraggableItem type="kpi-saldo-prognose" label="Saldo inkl. Prognose"
            icon={<Sparkles className="h-4 w-4 text-violet-500" />}
            description="Hochgerechneter Monatsabschluss"
            tooltip="Aktueller Monatssaldo plus erwartete Einnahmen und Ausgaben bis Monatsende – basierend auf erkannten Wiederholungsmustern aus der Vergangenheit." />
        </Section>

        <Section title="Statistiken">
          <SidebarDraggableItem type="chart-revenue" label="Umsatzchart"
            icon={<BarChart2 className="h-4 w-4 text-blue-500" />}
            description="Monatlicher Umsatz als Balkendiagramm"
            tooltip="Balkendiagramm mit Einnahmen und Ausgaben pro Monat für das ausgewählte Jahr. Zeigt auf einen Blick saisonale Schwankungen." />
          <SidebarDraggableItem type="chart-cashflow" label="Cashflow (kumuliert)"
            icon={<BarChart2 className="h-4 w-4 text-blue-500" />}
            description="Kumulierter Jahres-Cashflow"
            tooltip="Zeigt den kumulierten Saldo Monat für Monat – hilfreich um Liquiditätsengpässe früh zu erkennen." />
          <SidebarDraggableItem type="chart-category-donut" label="Kategorien-Donut"
            icon={<PieChart className="h-4 w-4 text-pink-500" />}
            description="Ausgaben nach Kategorie (Donut)"
            tooltip="Ringdiagramm, das die Ausgaben nach Kategorien aufschlüsselt. Ideal um zu sehen, wo das meiste Geld hinfließt." />
          <SidebarDraggableItem type="chart-last28days" label="28-Tage-Chart"
            icon={<Activity className="h-4 w-4 text-teal-500" />}
            description="Tagesgenauer Verlauf der letzten 28 Tage"
            tooltip="Liniendiagramm mit tagesgenauen Einnahmen und Ausgaben der letzten 28 Tage. Gut für kurzfristige Cashflow-Analyse." />
          <SidebarDraggableItem type="chart-month" label="Monatschart"
            icon={<Activity className="h-4 w-4 text-cyan-500" />}
            description="Tagesgenauer Verlauf des gewählten Monats"
            tooltip="Balkendiagramm mit tagesgenauen Einnahmen und Ausgaben für den ausgewählten Monat." />
          <SidebarDraggableItem type="card-sonderausgaben" label="Sonderausgaben"
            icon={<Receipt className="h-4 w-4 text-amber-500" />}
            description="Übersicht steuerlicher Sonderausgaben"
            tooltip="Listet alle als Sonderausgabe markierten Belege des Jahres auf – z. B. Versicherungen, Spenden oder Vorsorgeaufwendungen." />
        </Section>

        <Section title="Listen">
          <SidebarDraggableItem type="list-top-ausgaben" label="Top Ausgaben"
            icon={<List className="h-4 w-4 text-red-500" />}
            description="Größte Einzel-Ausgaben"
            tooltip="Die fünf größten Ausgaben des Jahres als schnelle Übersicht." />
          <SidebarDraggableItem type="list-top-partner" label="Top Kunden"
            icon={<List className="h-4 w-4 text-green-500" />}
            description="Top Partner nach Umsatz"
            tooltip="Zeigt die Partner/Kunden mit dem höchsten Umsatz im ausgewählten Jahr." />
          <SidebarDraggableItem type="list-forecast" label="Prognose (Monat)"
            icon={<Sparkles className="h-4 w-4 text-violet-500" />}
            description="Erwartete Buchungen bis Monatsende"
            tooltip="Zeigt voraussichtliche Einnahmen und Ausgaben bis zum Monatsende, abgeleitet aus erkannten Wiederholungsmustern (z. B. monatliche Abos)." />
          <SidebarDraggableItem type="list-forecast-28d" label="Prognose (28 Tage)"
            icon={<CalendarRange className="h-4 w-4 text-violet-400" />}
            description="Erwartete Buchungen in den nächsten 28 Tagen"
            tooltip="Zeigt alle voraussichtlichen Einnahmen und Ausgaben in einem rollierenden 28-Tage-Fenster ab heute – unabhängig vom ausgewählten Monat." />
          <SidebarDraggableItem type="list-recent-emails" label="Letzte E-Mails"
            icon={<Mail className="h-4 w-4 text-blue-500" />}
            description="Zuletzt empfangene Rechnungs-Mails"
            tooltip="Zeigt die neuesten E-Mails aus dem verknüpften Gmail-Postfach mit erkannten Rechnungsanhängen – für schnellen Zugriff direkt vom Dashboard." />
          <SidebarDraggableItem type="list-recent-invoices" label="Letzte 10 Belege"
            icon={<List className="h-4 w-4 text-muted-foreground" />}
            description="Tabelle der 10 zuletzt erfassten Belege"
            tooltip="Kompakte Tabelle mit den 10 zuletzt hinzugefügten Rechnungen oder Ausgaben. Per Klick gelangt man direkt zum jeweiligen Beleg." />
        </Section>
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
