import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { insertInvoice } from '@/lib/db';
import { useAppStore } from '@/store';
import { getAllInvoices } from '@/lib/db';
import { toast } from 'sonner';
import { CATEGORY_LABELS, INVOICE_TYPES, TYPE_LABELS, getCategoriesForBranche, getDefaultCategoryForType } from '@/types';
import type { Category, InvoiceType } from '@/types';
import { format, parse, isValid } from 'date-fns';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pre-filled values from the written invoice */
  prefill: {
    partner: string;
    date: string;       // dd.MM.yyyy
    description: string;
    netto: number;
    ust: number;
    brutto: number;
  };
}

export function SaveInvoiceDialog({ open, onClose, prefill }: Props) {
  const setInvoices = useAppStore((s) => s.setInvoices);
  const branchenprofil = useAppStore((s) => s.branchenprofil);

  const [partner, setPartner] = useState(prefill.partner);
  const [date, setDate] = useState(prefill.date);
  const [description, setDescription] = useState(prefill.description);
  const [type, setType] = useState<InvoiceType>('einnahme');
  const [category, setCategory] = useState<Category>('umsatz_pflichtig');
  const [brutto, setBrutto] = useState(prefill.brutto.toFixed(2));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Parse date (dd.MM.yyyy → ISO)
      let parsedDate: Date;
      try {
        parsedDate = parse(date, 'dd.MM.yyyy', new Date());
        if (!isValid(parsedDate)) parsedDate = new Date();
      } catch {
        parsedDate = new Date();
      }
      const isoDate = format(parsedDate, 'yyyy-MM-dd');
      const bruttoNum = parseFloat(brutto.replace(',', '.')) || prefill.brutto;
      const nettoNum = prefill.netto || bruttoNum / 1.19;
      const ustNum = bruttoNum - nettoNum;

      const inv = {
        id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        date: isoDate,
        year: parsedDate.getFullYear(),
        month: parsedDate.getMonth() + 1,
        category,
        description,
        partner,
        netto: Math.round(nettoNum * 100) / 100,
        ust: Math.round(ustNum * 100) / 100,
        brutto: bruttoNum,
        type,
        currency: 'EUR',
        pdf_path: '',
        note: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_locked: false,
        pdf_sha256: '',
        delivery_date: '',
        storno_of: '',
      };

      await insertInvoice(inv);
      const all = await getAllInvoices();
      setInvoices(all);
      toast.success('Rechnung eingetragen!');
      onClose();
    } catch (e) {
      toast.error('Fehler beim Eintragen: ' + String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rechnung eintragen?</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Soll diese Rechnung auch unter „Alle Rechnungen" gespeichert werden?
          </p>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Typ</Label>
              <Select value={type} onValueChange={(v) => {
                const t = v as InvoiceType;
                setType(t);
                setCategory(getDefaultCategoryForType(t));
              }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INVOICE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Datum</Label>
              <Input
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="TT.MM.JJJJ"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Partner / Kunde</Label>
            <Input value={partner} onChange={(e) => setPartner(e.target.value)} className="h-8 text-xs" placeholder="Name / Firma" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Beschreibung</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-8 text-xs" placeholder="z. B. Rechnungsnummer oder Betreff" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Kategorie</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-60">
                {getCategoriesForBranche(type, branchenprofil, category).map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Betrag (Brutto)</Label>
            <div className="relative">
              <Input
                type="number"
                min={0}
                step={0.01}
                value={brutto}
                onChange={(e) => setBrutto(e.target.value)}
                className="h-8 text-xs pr-10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">EUR</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Überspringen
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Speichere...' : 'Eintragen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

