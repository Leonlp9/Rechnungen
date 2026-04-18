import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { open } from '@tauri-apps/plugin-dialog';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { CATEGORIES, CATEGORY_LABELS, INVOICE_TYPES, TYPE_LABELS } from '@/types';
import type { Invoice } from '@/types';
import { insertInvoice, getAllInvoices } from '@/lib/db';
import { copyPdfToAppData, readPdfAsBase64 } from '@/lib/pdf';
import { analyzeInvoicePdf } from '@/lib/gemini';
import { useAppStore } from '@/store';
import { Upload, Sparkles, Loader2, FileText } from 'lucide-react';

const schema = z.object({
  date: z.string().min(1, 'Datum erforderlich'),
  description: z.string().min(1, 'Beschreibung erforderlich'),
  partner: z.string().min(1, 'Partner erforderlich'),
  netto: z.number(),
  ust: z.number(),
  brutto: z.number(),
  type: z.enum(['einnahme', 'ausgabe', 'info']),
  category: z.enum(CATEGORIES),
  currency: z.string().min(1),
  note: z.string(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  initialPdfPath?: string;
  initialPdfName?: string;
}

export function NewInvoiceDialog({ open: isOpen, onClose, initialPdfPath, initialPdfName }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState('');
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const setInvoices = useAppStore((s) => s.setInvoices);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      description: '',
      partner: '',
      netto: 0,
      ust: 0,
      brutto: 0,
      type: 'ausgabe',
      category: 'sonstiges',
      currency: 'EUR',
      note: '',
    },
  });

  const reset = () => {
    setStep(1);
    setPdfPath(null);
    setPdfName('');
    setPdfDataUrl(null);
    setAiLoading(false);
    setSaving(false);
    form.reset();
  };

  // Pre-fill when opened with a PDF from Gmail import
  useEffect(() => {
    if (isOpen && initialPdfPath) {
      setPdfPath(initialPdfPath);
      setPdfName(initialPdfName ?? initialPdfPath.split(/[\\/]/).pop() ?? 'document.pdf');
      readPdfAsBase64(initialPdfPath)
        .then((b64) => setPdfDataUrl(`data:application/pdf;base64,${b64}`))
        .catch(() => setPdfDataUrl(null));
      setStep(2);
    }
  }, [isOpen, initialPdfPath]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const selectPdf = async () => {
    try {
      const result = await open({
        multiple: false,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (result) {
        setPdfPath(result as string);
        setPdfName((result as string).split(/[\\/]/).pop() ?? 'document.pdf');
        // load preview
        try {
          const base64 = await readPdfAsBase64(result as string);
          setPdfDataUrl(`data:application/pdf;base64,${base64}`);
        } catch {
          setPdfDataUrl(null);
        }
        setStep(2);
      }
    } catch (e) {
      toast.error('Fehler beim Auswählen der PDF: ' + String(e));
    }
  };

  const handleAiAnalyze = async () => {
    if (!pdfPath) return;
    setAiLoading(true);
    try {
      const base64 = await readPdfAsBase64(pdfPath);
      const result = await analyzeInvoicePdf(base64 as string);
      form.setValue('date', result.date);
      form.setValue('description', result.description);
      form.setValue('partner', result.partner);
      form.setValue('netto', result.netto);
      form.setValue('ust', result.ust);
      form.setValue('brutto', result.brutto);
      form.setValue('currency', result.currency);
      form.setValue('type', result.type);
      form.setValue('category', result.suggested_category);
      toast.success('KI-Erfassung abgeschlossen!');
    } catch (e) {
      toast.error(String(e));
    } finally {
      setAiLoading(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!pdfPath) return;
    setSaving(true);
    try {
      const id = crypto.randomUUID();
      const dateObj = new Date(data.date);
      const fileName = `${id}.pdf`;
      const relativePath = await copyPdfToAppData(pdfPath, fileName);

      const invoice: Invoice = {
        id,
        date: data.date,
        year: dateObj.getFullYear(),
        month: dateObj.getMonth() + 1,
        category: data.category,
        description: data.description,
        partner: data.partner,
        netto: data.netto,
        ust: data.ust,
        brutto: data.brutto,
        type: data.type,
        currency: data.currency,
        pdf_path: relativePath,
        note: data.note,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await insertInvoice(invoice);
      const all = await getAllInvoices();
      setInvoices(all);
      toast.success('Rechnung gespeichert!');
      handleClose();
    } catch (e) {
      toast.error('Fehler beim Speichern: ' + String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className={step === 2 ? 'max-w-[90vw] w-[90vw] max-h-[92vh] overflow-hidden' : 'max-w-lg'}>
        <DialogHeader>
          <DialogTitle>Neue Rechnung</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="flex flex-col items-center gap-6 py-12">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <Upload className="h-10 w-10 text-muted-foreground" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-lg font-semibold">PDF hochladen</p>
              <p className="text-sm text-muted-foreground">Wähle eine PDF-Rechnung aus</p>
            </div>
            <Button onClick={selectPdf} size="lg">
              <FileText className="mr-2 h-4 w-4" />
              PDF auswählen
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="flex gap-4 h-[78vh]">
            {/* Left: form */}
            <div className="flex-1 min-w-0 overflow-y-auto pr-1 space-y-4">
              {/* PDF info + AI button */}
              <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4" />
                  <span className="truncate max-w-[200px]">{pdfName}</span>
                </div>
                <Button
                  onClick={handleAiAnalyze}
                  disabled={aiLoading}
                  className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600"
                >
                  {aiLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  {aiLoading ? 'Analysiere...' : '✨ KI-Erfassung'}
                </Button>
              </div>

              {/* Form */}
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Datum</Label>
                  <Input type="date" {...form.register('date')} />
                  {form.formState.errors.date && <p className="text-xs text-destructive">{form.formState.errors.date.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label>Partner</Label>
                  <Input {...form.register('partner')} />
                  {form.formState.errors.partner && <p className="text-xs text-destructive">{form.formState.errors.partner.message}</p>}
                </div>

                <div className="col-span-2 space-y-1.5">
                  <Label>Beschreibung</Label>
                  <Input {...form.register('description')} />
                  {form.formState.errors.description && <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>}
                </div>

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

                <div className="col-span-2 space-y-1.5">
                  <Label>Notiz</Label>
                  <Input {...form.register('note')} />
                </div>

                <div className="col-span-2 flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={handleClose}>Abbrechen</Button>
                  <Button type="submit" disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Speichern
                  </Button>
                </div>
              </form>
            </div>

            {/* Right: PDF preview */}
            <div className="w-[45%] shrink-0 rounded-lg border overflow-hidden bg-muted/30 flex flex-col">
              <div className="text-xs text-muted-foreground px-3 py-1.5 border-b font-medium">Vorschau</div>
              {pdfDataUrl ? (
                <iframe
                  src={pdfDataUrl}
                  className="flex-1 w-full"
                  title="PDF Vorschau"
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                  Keine Vorschau verfügbar
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}





