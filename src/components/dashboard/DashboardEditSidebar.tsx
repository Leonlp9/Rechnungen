import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import React, { useState, useMemo } from 'react';
import type { NodeType, ElementType } from '@/types/dashboard';
import { cn } from '@/lib/utils';
import {
  Columns2, Rows2, BookOpen,
  TrendingUp, TrendingDown, Euro, Calculator, FileText,
  BarChart2, PieChart, Activity, Receipt,
  Sparkles, Mail, List, RotateCcw, X, Info, CalendarRange,
  Percent, PiggyBank, Table2,
  PanelLeft, LayoutGrid, LayoutDashboard, AlignJustify,
  User, Search, ShieldCheck, Package, Eye, HardDrive,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DashboardElementNode } from './DashboardElementNode';

// ─── Sidebar Draggable Item ──────────────────────────────────────────────────

interface SidebarItemProps {
  type: NodeType;
  label: string;
  icon: React.ReactNode;
  description?: string;
  tooltip?: string;
  onPreview?: (type: NodeType) => void;
}

function SidebarDraggableItem({ type, label, icon, description, tooltip, onPreview }: SidebarItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `sidebar-${type}`,
    data: { source: 'sidebar', elementType: type },
  });

  const pointerStart = React.useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
    listeners?.onPointerDown?.(e as any);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (pointerStart.current && !type.startsWith('grid-') && onPreview) {
      const dx = Math.abs(e.clientX - pointerStart.current.x);
      const dy = Math.abs(e.clientY - pointerStart.current.y);
      if (dx < 5 && dy < 5) {
        onPreview(type);
      }
    }
    pointerStart.current = null;
  };

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
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
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
            {onPreview && !type.startsWith('grid-') && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2 gap-1.5 text-xs h-7"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview(type);
                }}
              >
                <Eye className="h-3 w-3" />
                Vorschau
              </Button>
            )}
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

// ─── Statische Element-Liste (außerhalb der Komponente, damit kein Re-Create beim Render) ──

const ALL_ITEMS: SidebarItemDef[] = [
    // ── Layout-Container ──
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
    { section: '📊 KPI – Einnahmen & Ausgaben', type: 'kpi-saldo-ytd', label: 'Saldo YTD', icon: <Euro className="h-4 w-4 text-primary" />, description: 'Einnahmen minus alle Ausgaben (YTD)', tooltip: 'Tatsächlich verfügbares Geld: Einnahmen abzüglich aller Ausgaben seit Jahresbeginn.' },
    { section: '📊 KPI – Einnahmen & Ausgaben', type: 'kpi-einnahmen-monat', label: 'Einnahmen (Monat)', icon: <TrendingUp className="h-4 w-4 text-green-600" />, description: 'Einnahmen im aktuellen Monat', tooltip: 'Summe aller Einnahmen im laufenden Kalendermonat, mit Vergleich zum selben Monat des Vorjahres.' },
    { section: '📊 KPI – Einnahmen & Ausgaben', type: 'kpi-ausgaben-monat', label: 'Ausgaben (Monat)', icon: <TrendingDown className="h-4 w-4 text-red-600" />, description: 'Ausgaben im aktuellen Monat', tooltip: 'Summe aller Ausgaben im laufenden Kalendermonat, mit Vergleich zum selben Monat des Vorjahres.' },
    { section: '📊 KPI – Einnahmen & Ausgaben', type: 'kpi-saldo-monat', label: 'Saldo (Monat)', icon: <Euro className="h-4 w-4 text-primary" />, description: 'Einnahmen minus Ausgaben (Monat)', tooltip: 'Monatlicher Überschuss: Einnahmen abzüglich aller Ausgaben im aktuellen Kalendermonat.' },
    { section: '📊 KPI – Einnahmen & Ausgaben', type: 'kpi-avg-einnahmen-monat', label: 'Ø Einnahmen / Monat', icon: <TrendingUp className="h-4 w-4 text-green-600" />, description: 'Durchschnittliche monatliche Einnahmen', tooltip: 'Gesamteinnahmen des Jahres geteilt durch 12 – mit Vergleich zum Vorjahreswert.' },
    { section: '📊 KPI – Einnahmen & Ausgaben', type: 'kpi-avg-ausgaben-monat', label: 'Ø Ausgaben / Monat', icon: <TrendingDown className="h-4 w-4 text-red-600" />, description: 'Durchschnittliche monatliche Ausgaben', tooltip: 'Gesamtausgaben des Jahres geteilt durch 12 – mit Vergleich zum Vorjahreswert.' },
    { section: '📊 KPI – Einnahmen & Ausgaben', type: 'kpi-belege-30d', label: 'Belege (30 Tage)', icon: <FileText className="h-4 w-4 text-muted-foreground" />, description: 'Anzahl Belege der letzten 30 Tage', tooltip: 'Zeigt die Anzahl aller erfassten Belege der vergangenen 30 Tage.' },

    // ── KPI – Gewinn & Steuer ──
    { section: '💰 KPI – Gewinn & Steuer', type: 'kpi-betriebsergebnis', label: 'Cash-Gewinn', icon: <Calculator className="h-4 w-4 text-violet-600" />, description: 'Cashflow-Betriebsergebnis', tooltip: 'Einnahmen abzüglich aller Betriebsausgaben mit vollem Kaufpreis (ohne AfA-Korrektur). Zeigt, wie viel echtes Geld auf dem Konto geblieben ist.' },
    { section: '💰 KPI – Gewinn & Steuer', type: 'kpi-betriebsergebnis-afa', label: 'Steuerlicher Gewinn (EÜR)', icon: <Calculator className="h-4 w-4 text-amber-600" />, description: 'Gewinn nach AfA-Korrektur', tooltip: 'Einnahmen minus Betriebsausgaben mit zeitanteiliger AfA statt vollem Kaufpreis. Basis für die Einkommensteuer.' },
    { section: '💰 KPI – Gewinn & Steuer', type: 'kpi-marge', label: 'Gewinnmarge', icon: <Percent className="h-4 w-4 text-violet-500" />, description: 'Steuerlicher Gewinnanteil in %', tooltip: 'Betriebsergebnis geteilt durch Einnahmen – zeigt, wie viel Prozent der Einnahmen als Gewinn verbleiben.' },
    { section: '💰 KPI – Gewinn & Steuer', type: 'kpi-steuerruecklage', label: 'Steuerrücklage (30 %)', icon: <PiggyBank className="h-4 w-4 text-amber-500" />, description: 'Empfohlene Rücklage für Einkommensteuer', tooltip: 'Richtwert: 30 % des steuerlichen Gewinns (abzgl. Grundfreibetrag) als Rücklage.' },
    { section: '💰 KPI – Gewinn & Steuer', type: 'kpi-ust-jahr', label: 'USt-Zahllast (Jahr)', icon: <FileText className="h-4 w-4 text-muted-foreground" />, description: 'Nur für Regelbesteuerer sinnvoll', tooltip: 'USt von Kunden minus Vorsteuer aus eigenen Einkäufen = Betrag ans Finanzamt.' },
    { section: '💰 KPI – Gewinn & Steuer', type: 'kpi-kleinunternehmer', label: 'Kleinunternehmergrenze', icon: <Receipt className="h-4 w-4 text-emerald-500" />, description: 'Fortschritt zur USt-Pflichtgrenze', tooltip: 'Zeigt Jahreseinnahmen im Verhältnis zur Kleinunternehmergrenze (25.000 €).' },
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
    { section: '🃏 Karten & Vergleiche', type: 'card-sonderausgaben', label: 'Sonderausgaben', icon: <Receipt className="h-4 w-4 text-amber-500" />, description: 'Übersicht steuerlicher Sonderausgaben', tooltip: 'Alle als Sonderausgabe markierten Belege des Jahres.' },

    // ── AfA & Vermögen ──
    { section: '🏗️ AfA & Vermögen', type: 'card-afa-uebersicht', label: 'AfA & GWG Übersicht', icon: <Calculator className="h-4 w-4 text-violet-500" />, description: 'Wirtschaftsgüter mit Abschreibung', tooltip: 'Alle Belege mit Kategorie „AfA" oder „GWG" inkl. Abschreibungsmethode und Jahressumme.' },
    { section: '🏗️ AfA & Vermögen', type: 'card-vermoegenscheck', label: 'Vermögens-Check', icon: <ShieldCheck className="h-4 w-4 text-emerald-500" />, description: 'Aktiva vs. Passiva', tooltip: 'Vereinfachte Unternehmer-Bilanz: Liquide Mittel + Sachanlagen minus Rückstellungen.' },
    { section: '🏗️ AfA & Vermögen', type: 'card-investitionsspiegel', label: 'Investitions-Spiegel', icon: <Package className="h-4 w-4 text-violet-500" />, description: 'Anlagevermögen mit Restwerten', tooltip: 'Alle Anlagegüter mit Anschaffungskosten, kumulierter Abschreibung und Restwert.' },

    // ── System ──
    { section: '⚙️ System', type: 'card-system-stats', label: 'System & Speicher', icon: <HardDrive className="h-4 w-4 text-slate-500" />, description: 'Speicherplatz, RAM, CPU-Auslastung', tooltip: 'Zeigt Datenbankgröße, Größe der gespeicherten Rechnungsdateien, genutzten Arbeitsspeicher und CPU-Auslastung.' },
];

export function DashboardEditSidebar({ onClose, onReset }: DashboardEditSidebarProps) {
  const [search, setSearch] = useState('');
  const [previewType, setPreviewType] = useState<ElementType | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ALL_ITEMS;
    return ALL_ITEMS.filter(
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
    // Alphabetisch innerhalb jeder Sektion
    for (const items of map.values()) {
      items.sort((a, b) => a.label.localeCompare(b.label, 'de'));
    }
    return map;
  }, [filtered]);

  return (
    <>
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
                <SidebarDraggableItem
                  key={item.type}
                  {...item}
                  onPreview={(t) => setPreviewType(t as ElementType)}
                />
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

    {/* Preview Dialog */}
    <Dialog open={previewType !== null} onOpenChange={(open) => { if (!open) setPreviewType(null); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto p-6">
        <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5" />
          Vorschau – So sieht das Element im Dashboard aus
        </div>
        {previewType && (
          <div className="min-h-[200px]">
            <DashboardElementNode type={previewType} />
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
