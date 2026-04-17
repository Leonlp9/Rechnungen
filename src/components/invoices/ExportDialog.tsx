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

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ExportDialog({ open, onClose }: Props) {
  const invoices = useAppStore((s) => s.invoices);
  const [year, setYear] = useState(new Date().getFullYear());
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
      const filtered = invoices.filter((i) => i.year === year);
      if (filtered.length === 0) {
        toast.error('Keine Rechnungen für dieses Jahr gefunden.');
        return;
      }
      if (format === 'xlsx') await exportToXlsx(filtered, year);
      else if (format === 'zip') await exportToZip(filtered, year);
      else await exportAll(filtered, year);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exportieren</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
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
