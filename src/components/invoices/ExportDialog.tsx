// Export-Dialog: Zeitraum wählen, Format wählen, speichern.
//
// Auf dem Handy ist das ein Blatt von unten mit denselben Bausteinen wie
// überall sonst – segmentierte Auswahl für den Zeitraum, Gruppenliste für
// die Felder, eine breite Hauptaktion am Ende. Vorher war es ein mittiger
// Kasten mit eigenen Knöpfen: Der Zeitraumschalter war handgebaut (und damit
// in keinem Theme zu Hause), die Felder standen als Label-über-Feld-Kolonne
// da, und die beiden Knöpfe unten rechts waren mit dem Daumen kaum zu
// treffen.
//
// Am Rechner bleibt es der gewohnte Dialog – nur der Zeitraumschalter ist
// jetzt die gemeinsame segmentierte Auswahl, damit die Themes ihn kennen.

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Segmented } from '@/components/ui/segmented';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { FormGroup, FormRow, FIELD_SELECT } from '@/components/ui/form-list';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useAppStore } from '@/store';
import { exportToXlsx, exportToZip, exportAll, exportToDatev } from '@/lib/export';
import { toast } from 'sonner';
import { Loader2, Download } from 'lucide-react';

type ExportFormat = 'xlsx' | 'zip' | 'all' | 'datev';
type PeriodMode = 'month' | 'year' | 'all';

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

const PERIOD_OPTIONS = [
  { value: 'month' as const, label: 'Monat' },
  { value: 'year' as const, label: 'Jahr' },
  { value: 'all' as const, label: 'Alles' },
];

const FORMAT_OPTIONS: ReadonlyArray<{ value: ExportFormat; label: string; description: string }> = [
  {
    value: 'xlsx',
    label: '📊 Excel (XLSX)',
    description: 'Excel-Datei mit 4 Sheets (Alle Belege, Zusammenfassung, Nach Monat, Hinweise)',
  },
  {
    value: 'datev',
    label: '📋 DATEV (CSV)',
    description: 'CSV im DATEV-Buchungsstapel-Format – ideal für den Steuerberater oder DATEV-Import.',
  },
  {
    value: 'zip',
    label: '🗂 ZIP (Rechnungen als PDF)',
    description: 'ZIP-Archiv mit PDFs geordnet nach Monat → Kategorie, Dateinamen mit Datum/Partner/Betrag',
  },
  {
    value: 'all',
    label: '📦 Alles (Excel + ZIP)',
    description: 'Beides – zuerst Excel, dann ZIP (je ein Speichern-Dialog)',
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ExportDialog({ open, onClose }: Props) {
  const isMobile = useIsMobile();
  const invoices = useAppStore((s) => s.invoices);
  const [periodMode, setPeriodMode] = useState<PeriodMode>('year');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [exporting, setExporting] = useState(false);

  const years = useMemo(() => {
    const s = new Set(invoices.map((i) => i.year));
    s.add(new Date().getFullYear());
    return Array.from(s).sort((a, b) => b - a);
  }, [invoices]);

  const formatDescription =
    FORMAT_OPTIONS.find((o) => o.value === format)?.description ?? '';

  const handleExport = async () => {
    setExporting(true);
    try {
      let filtered = invoices;
      let label: number | string = year;

      if (periodMode === 'year') {
        filtered = invoices.filter((i) => i.year === year);
        label = year;
      } else if (periodMode === 'month') {
        filtered = invoices.filter((i) => i.year === year && i.month === month);
        label = `${year}-${String(month).padStart(2, '0')}`;
      }
      // 'all' → keep all invoices, label stays year (unused for filename below)

      if (filtered.length === 0) {
        toast.error('Keine Rechnungen für diesen Zeitraum gefunden.');
        return;
      }

      if (format === 'xlsx') await exportToXlsx(filtered, label as number);
      else if (format === 'zip') await exportToZip(filtered, label as number);
      else if (format === 'datev') await exportToDatev(filtered, label);
      else await exportAll(filtered, label as number);

      toast.success('Export erfolgreich!');
      onClose();
    } catch (e) {
      toast.error('Export fehlgeschlagen: ' + String(e));
    } finally {
      setExporting(false);
    }
  };

  // ── Felder, die beide Auftritte teilen ──
  const periodSegment = (
    <Segmented value={periodMode} onChange={setPeriodMode} options={PERIOD_OPTIONS} />
  );

  const yearSelect = (
    <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
      <SelectTrigger className={isMobile ? FIELD_SELECT : undefined}><SelectValue /></SelectTrigger>
      <SelectContent>
        {years.map((y) => (
          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const monthSelect = (
    <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
      <SelectTrigger className={isMobile ? FIELD_SELECT : undefined}><SelectValue /></SelectTrigger>
      <SelectContent>
        {MONTH_NAMES.map((name, idx) => (
          <SelectItem key={idx + 1} value={String(idx + 1)}>{name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const formatSelect = (
    <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
      <SelectTrigger className={isMobile ? FIELD_SELECT : undefined}><SelectValue /></SelectTrigger>
      <SelectContent>
        {FORMAT_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  /** Aufbau eines ZIP-Archivs – nur dort, wo PDFs mitgehen. */
  const zipHint = format !== 'xlsx' && format !== 'datev' && (
    <div className="space-y-1 rounded-xl bg-muted/50 p-3 text-[13px] text-muted-foreground">
      <p className="font-medium text-foreground">ZIP-Struktur:</p>
      <p className="font-mono break-all">
        01_Januar / Software &amp; Abos / 2026-01-15_GitHub_9-99EUR_GitHub Pro.pdf
      </p>
    </div>
  );

  const exportButton = (
    <Button
      className="h-[50px] w-full text-[17px] font-semibold"
      onClick={handleExport}
      disabled={exporting}
    >
      {exporting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Download className="mr-2 h-5 w-5" />}
      {exporting ? 'Exportiere…' : 'Exportieren'}
    </Button>
  );

  if (isMobile) {
    return (
      <ResponsiveModal open={open} onClose={onClose} title="Exportieren" closeLabel="Abbrechen">
        <div className="space-y-6">
          {periodSegment}

          {periodMode !== 'all' && (
            <FormGroup title="Zeitraum">
              <FormRow label="Jahr">{yearSelect}</FormRow>
              {periodMode === 'month' && <FormRow label="Monat">{monthSelect}</FormRow>}
            </FormGroup>
          )}

          <FormGroup title="Format" footer={formatDescription}>
            <FormRow label="Datei">{formatSelect}</FormRow>
          </FormGroup>

          {zipHint}
          {exportButton}
        </div>
      </ResponsiveModal>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportieren</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Zeitraum</Label>
            {periodSegment}
          </div>

          {periodMode !== 'all' && (
            <div className="space-y-1.5">
              <Label>Jahr</Label>
              {yearSelect}
            </div>
          )}

          {periodMode === 'month' && (
            <div className="space-y-1.5">
              <Label>Monat</Label>
              {monthSelect}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Format</Label>
            {formatSelect}
            <p className="text-xs text-muted-foreground">{formatDescription}</p>
          </div>

          {zipHint}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {exporting ? 'Exportiere…' : 'Exportieren'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
