import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { getInvoiceById, updateInvoice, deleteInvoice, getAllInvoices } from '@/lib/db';
import { getAbsolutePdfPath } from '@/lib/pdf';
import { useAppStore } from '@/store';
import { CATEGORIES, CATEGORY_LABELS, INVOICE_TYPES, TYPE_LABELS } from '@/types';
import type { Invoice } from '@/types';
import { Loader2, Trash2, Save, FolderOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { readFile } from '@tauri-apps/plugin-fs';
import { revealItemInDir } from '@tauri-apps/plugin-opener';

const schema = z.object({
  date: z.string().min(1),
  description: z.string().min(1),
  partner: z.string().min(1),
  netto: z.number(),
  ust: z.number(),
  brutto: z.number(),
  type: z.enum(['einnahme', 'ausgabe', 'info']),
  category: z.enum(CATEGORIES),
  currency: z.string(),
  note: z.string(),
});

type FormData = z.infer<typeof schema>;

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const invoices = useAppStore((s) => s.invoices);
  const setInvoices = useAppStore((s) => s.setInvoices);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loading, setLoading] = useState(true);

  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const inv = await getInvoiceById(id);
      if (!inv) {
        toast.error('Rechnung nicht gefunden');
        navigate('/invoices');
        return;
      }
      setInvoice(inv);
      form.reset({
        date: inv.date,
        description: inv.description,
        partner: inv.partner,
        netto: inv.netto,
        ust: inv.ust,
        brutto: inv.brutto,
        type: inv.type,
        category: inv.category,
        currency: inv.currency,
        note: inv.note,
      });
      if (inv.pdf_path) {
        const abs = await getAbsolutePdfPath(inv.pdf_path);
        const bytes = await readFile(abs);
        const blob = new Blob([bytes], { type: 'application/pdf' });
        setPdfUrl(URL.createObjectURL(blob));
      }
      setLoading(false);
    })();
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [id, navigate, form]);

  const currentIndex = invoices.findIndex((i) => i.id === id);

  const goToSibling = useCallback(
    (dir: -1 | 1) => {
      const next = currentIndex + dir;
      if (next >= 0 && next < invoices.length) {
        navigate(`/invoices/${invoices[next].id}`);
      }
    },
    [currentIndex, invoices, navigate]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goToSibling(-1);
      if (e.key === 'ArrowRight') goToSibling(1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goToSibling]);

  const onSubmit = async (data: FormData) => {
    if (!invoice) return;
    setSaving(true);
    try {
      const dateObj = new Date(data.date);
      const updated: Invoice = {
        ...invoice,
        ...data,
        year: dateObj.getFullYear(),
        month: dateObj.getMonth() + 1,
        updated_at: new Date().toISOString(),
      };
      await updateInvoice(updated);
      setInvoice(updated);
      const all = await getAllInvoices();
      setInvoices(all);
      toast.success('Änderungen gespeichert!');
    } catch (e) {
      toast.error('Fehler: ' + String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!invoice) return;
    try {
      await deleteInvoice(invoice.id);
      const all = await getAllInvoices();
      setInvoices(all);
      toast.success('Rechnung gelöscht');
      navigate('/invoices');
    } catch (e) {
      toast.error('Fehler: ' + String(e));
    }
  };

  const handleReveal = async () => {
    if (!invoice?.pdf_path) return;
    try {
      const abs = await getAbsolutePdfPath(invoice.pdf_path);
      await revealItemInDir(abs);
    } catch (e) {
      toast.error('Fehler: ' + String(e));
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Lade...</div>;
  }

  return (
    <div className="flex h-full gap-6">
      {/* Left: PDF */}
      <div className="flex-1 rounded-xl border bg-card shadow-sm overflow-hidden min-w-0">
        {pdfUrl ? (
          <embed src={pdfUrl} type="application/pdf" className="h-full w-full" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">Kein PDF vorhanden</div>
        )}
      </div>

      {/* Right: Form */}
      <div className="w-[400px] shrink-0 space-y-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Rechnungsdetails</h1>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" disabled={currentIndex <= 0} onClick={() => goToSibling(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" disabled={currentIndex >= invoices.length - 1} onClick={() => goToSibling(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Datum</Label>
            <Input type="date" {...form.register('date')} />
          </div>
          <div className="space-y-1.5">
            <Label>Partner</Label>
            <Input {...form.register('partner')} />
          </div>
          <div className="space-y-1.5">
            <Label>Beschreibung</Label>
            <Input {...form.register('description')} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label>Netto</Label>
              <Input type="number" step="0.01" {...form.register('netto', { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>USt</Label>
              <Input type="number" step="0.01" {...form.register('ust', { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>Brutto</Label>
              <Input type="number" step="0.01" {...form.register('brutto', { valueAsNumber: true })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Währung</Label>
            <Input {...form.register('currency')} />
          </div>
          <div className="space-y-1.5">
            <Label>Typ</Label>
            <Select value={form.watch('type')} onValueChange={(v) => form.setValue('type', v as 'einnahme' | 'ausgabe' | 'info')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INVOICE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Kategorie</Label>
            <Select value={form.watch('category')} onValueChange={(v) => form.setValue('category', v as typeof CATEGORIES[number])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Notiz</Label>
            <Input {...form.register('note')} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Speichern
            </Button>
            <Button type="button" variant="outline" onClick={handleReveal}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Zeigen
            </Button>
            <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>

      {/* Delete confirm dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechnung löschen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Diese Aktion kann nicht rückgängig gemacht werden.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Abbrechen</Button>
            <Button variant="destructive" onClick={handleDelete}>Endgültig löschen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



