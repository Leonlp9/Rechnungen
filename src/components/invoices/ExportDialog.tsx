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
import { useAppStore } from '@/store';
import { exportToXlsx, exportToZip, exportAll } from '@/lib/export';
import { toast } from 'sonner';
import { Loader2, Download } from 'lucide-react';

type ExportFormat = 'xlsx' | 'zip' | 'all';
type PeriodMode = 'month' | 'year' | 'all';

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ExportDialog({ open, onClose }: Props) {
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

  const formatDescriptions: Record<ExportFormat, string> = {
    xlsx: 'Excel-Datei mit 4 Sheets (Alle Belege, Zusammenfassung, Nach Monat, Hinweise)',
    zip: 'ZIP-Archiv mit PDFs geordnet nach Monat → Kategorie, Dateinamen mit Datum/Partner/Betrag',
    all: 'Beides – zuerst Excel, dann ZIP (je ein Speichern-Dialog)',
  };

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
      else await exportAll(filtered, label as number);

      toast.success('Export erfolgreich!');
      onClose();
    } catch (e) {
      toast.error('Export fehlgeschlagen: ' + String(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportieren</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">

          {/* Period mode switcher */}
          <div className="space-y-1.5">
            <Label>Zeitraum</Label>
            <div className="flex rounded-lg overflow-hidden border border-border text-sm">
              {(['month', 'year', 'all'] as PeriodMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPeriodMode(m)}
                  className={`flex-1 py-1.5 transition-colors ${
                    periodMode === m
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {m === 'month' ? 'Monat' : m === 'year' ? 'Jahr' : 'Alles'}
                </button>
              ))}
            </div>
          </div>

          {/* Year selector (shown for month + year modes) */}
          {periodMode !== 'all' && (
            <div className="space-y-1.5">
              <Label>Jahr</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Month selector (only for month mode) */}
          {periodMode === 'month' && (
            <div className="space-y-1.5">
              <Label>Monat</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, idx) => (
                    <SelectItem key={idx + 1} value={String(idx + 1)}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Format */}
          <div className="space-y-1.5">
            <Label>Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="xlsx">📊 Excel (XLSX)</SelectItem>
                <SelectItem value="zip">🗂 ZIP (Rechnungen als PDF)</SelectItem>
                <SelectItem value="all">📦 Alles (Excel + ZIP)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{formatDescriptions[format]}</p>
          </div>

          {format !== 'xlsx' && (
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">ZIP-Struktur:</p>
              <p className="font-mono">01_Januar / Software &amp; Abos / 2026-01-15_GitHub_9-99EUR_GitHub Pro.pdf</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {exporting ? 'Exportiere...' : 'Exportieren'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
