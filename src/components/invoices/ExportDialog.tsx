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
import { exportToXlsx } from '@/lib/export';
import { toast } from 'sonner';
import { Loader2, Download } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ExportDialog({ open, onClose }: Props) {
  const invoices = useAppStore((s) => s.invoices);
  const [year, setYear] = useState(new Date().getFullYear());
  const [exporting, setExporting] = useState(false);

  const years = useMemo(() => {
    const s = new Set(invoices.map((i) => i.year));
    s.add(new Date().getFullYear());
    return Array.from(s).sort((a, b) => b - a);
  }, [invoices]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const filtered = invoices.filter((i) => i.year === year);
      await exportToXlsx(filtered, year);
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
          <p className="text-sm text-muted-foreground">Format: XLSX (4 Sheets: Alle Belege, Zusammenfassung, Nach Monat, Hinweise)</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Exportieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

