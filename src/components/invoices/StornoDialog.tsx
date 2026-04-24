import { useState, useEffect, useRef } from 'react';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { open } from '@tauri-apps/plugin-dialog';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CATEGORIES, CATEGORY_LABELS, INVOICE_TYPES, TYPE_LABELS, getCategoriesForBranche } from '@/types';
import type { Invoice } from '@/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { stornoInvoice, updateInvoice, getAllInvoices } from '@/lib/db';
import { copyPdfToAppData, readPdfAsBase64 } from '@/lib/pdf';
import { analyzeInvoicePdf } from '@/lib/gemini';
import { useAppStore } from '@/store';
import { Upload, Sparkles, Loader2, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface Props {
  open: boolean;
  invoice: Invoice | null;
  onClose: () => void;
  onSuccess: (stornoId: string) => void;
}

export function StornoDialog({ open: isOpen, invoice, onClose, onSuccess }: Props) {
  const setInvoices = useAppStore((s) => s.setInvoices);
  const branchenprofil = useAppStore((s) => s.branchenprofil);
  const [step, setStep] = useState<'confirm' | 'upload' | 'form'>('confirm');
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState('');
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const form = useForm<FormData>({ resolver: zodResolver(schema) });
  const watchedType = form.watch('type');
  const watchedCategory = form.watch('category');
  const watchedBrutto = form.watch('brutto');
  const watchedPartner = form.watch('partner');

  // Validation: amounts and partner must match original (negated)
  const bruttoMismatch = invoice && Math.abs(watchedBrutto - (-invoice.brutto)) > 0.01;
  const partnerMismatch = invoice && watchedPartner?.trim().toLowerCase() !== invoice.partner.trim().toLowerCase();

  useEffect(() => {
    if (isOpen && invoice) {
      setStep('confirm');
      setPdfPath(null);
      setPdfName('');
      setPdfDataUrl(null);
      form.reset({
        date: new Date().toISOString().slice(0, 10),
        description: `[STORNO] ${invoice.description}`,
        partner: invoice.partner,
        netto: -invoice.netto,
        ust: -invoice.ust,
        brutto: -invoice.brutto,
        type: invoice.type,
        category: invoice.category,
        currency: invoice.currency,
        note: `Stornobuchung zu Beleg ${invoice.id}`,
      });
      getAllInvoices().then(setAllInvoices).catch(() => {});
    }
  }, [isOpen, invoice]);

  // Drag-drop listener on upload step
  useEffect(() => {
    if (!isOpen || step !== 'upload') return;
    let unlisten: (() => void) | undefined;
    getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === 'over') setIsDragOver(true);
      else if (event.payload.type === 'leave') setIsDragOver(false);
      else if (event.payload.type === 'drop') {
        setIsDragOver(false);
        const paths: string[] = event.payload.paths ?? [];
        const pdf = paths.find((p) => p.toLowerCase().endsWith('.pdf'));
        if (pdf) loadPdf(pdf);
      }
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, [isOpen, step]);

  const loadPdf = async (filePath: string) => {
    setPdfPath(filePath);
    setPdfName(filePath.split(/[\\/]/).pop() ?? 'storno.pdf');
    try {
      const base64 = await readPdfAsBase64(filePath);
      setPdfDataUrl(`data:application/pdf;base64,${base64}`);
    } catch {
      setPdfDataUrl(null);
    }
    setStep('form');
  };

  const selectPdf = async () => {
    try {
      const result = await open({ multiple: false, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
      if (result) await loadPdf(result);
    } catch (e) {
      toast.error('Fehler: ' + String(e));
    }
  };

  const handleAiAnalyze = async () => {
    if (!pdfPath || !invoice) return;
    setAiLoading(true);
    try {
      const base64 = await readPdfAsBase64(pdfPath);
      const result = await analyzeInvoicePdf(base64, allInvoices);
      if (!result.is_invoice) {
        toast.warning(
          `⚠️ Kein Buchhaltungsdokument erkannt${result.rejection_reason ? `: ${result.rejection_reason}` : '. Bitte prüfe das hochgeladene Dokument.'}`,
          { duration: 6000 }
        );
        return;
      }
      // Only update description, date, note – keep partner + amounts locked to original
      form.setValue('date', result.date);
      form.setValue('description', result.description ? `[STORNO] ${result.description}` : form.getValues('description'));
      toast.success('KI-Analyse abgeschlossen – Partner und Beträge bleiben aus dem Original.');
    } catch (e) {
      toast.error(String(e));
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async (data: FormData) => {
    if (!invoice) return;
    setSaving(true);
    try {
      const storno = await stornoInvoice(invoice.id);

      let pdf_path = storno.pdf_path;
      if (pdfPath) {
        const fileName = `storno-${storno.id}-${Date.now()}.pdf`;
        pdf_path = await copyPdfToAppData(pdfPath, fileName);
      }

      const updated: Invoice = {
        ...storno,
        date: data.date,
        year: new Date(data.date).getFullYear(),
        month: new Date(data.date).getMonth() + 1,
        description: data.description,
        partner: data.partner,
        netto: data.netto,
        ust: data.ust,
        brutto: data.brutto,
        type: data.type,
        category: data.category,
        currency: data.currency,
        note: data.note,
        pdf_path,
        updated_at: new Date().toISOString(),
      };
      await updateInvoice(updated);

      const all = await getAllInvoices();
      setInvoices(all);
      toast.success(`Stornobuchung erstellt: ${updated.description}`);
      onSuccess(storno.id);
    } catch (e) {
      toast.error('Fehler: ' + String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!invoice) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className={step === 'form' ? 'max-w-[90vw] w-[90vw] max-h-[92vh] overflow-hidden' : 'max-w-lg'}>
        <DialogHeader>
          <DialogTitle>Beleg stornieren</DialogTitle>
          <DialogDescription>
            {step === 'confirm' && 'Lies die Hinweise und bestätige die Stornobuchung.'}
            {step === 'upload' && 'Lade einen Storno-Nachweis als PDF hoch (z. B. Storno-Bestätigung des Lieferanten).'}
            {step === 'form' && 'Prüfe die vorausgefüllten Daten. Partner und Beträge müssen mit dem Original übereinstimmen.'}
          </DialogDescription>
        </DialogHeader>

        {/* ── Step 1: Confirm ── */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-4 space-y-3 text-sm">
              <p>Es wird eine <strong>Stornobuchung mit negativen Beträgen</strong> erstellt, die diesen Beleg buchhalterisch aufhebt.</p>
              <p>Der <strong>Originalbeleg bleibt erhalten</strong> und wird gleichzeitig festgeschrieben (gesperrt).</p>
              <div className="flex items-start gap-2 rounded bg-amber-500/10 border border-amber-400/30 p-3">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-amber-700 dark:text-amber-400">
                  Im nächsten Schritt wirst du aufgefordert, einen <strong>PDF-Storno-Nachweis</strong> anzuhängen (empfohlen, aber optional).
                </span>
              </div>
              <div className="rounded bg-muted p-3 text-xs space-y-1 font-mono">
                <div>Partner: {invoice.partner}</div>
                <div>Brutto: {invoice.brutto.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} → <span className="text-red-500">−{Math.abs(invoice.brutto).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span></div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Abbrechen</Button>
              <Button className="bg-orange-600 hover:bg-orange-700 text-white" onClick={() => setStep('upload')}>
                Weiter → PDF anhängen
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: PDF Upload ── */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              ref={dropZoneRef}
              className={cn(
                'flex flex-col items-center gap-5 py-10 px-6 border-2 border-dashed rounded-xl transition-colors select-none cursor-pointer',
                isDragOver ? 'border-primary bg-primary/10 scale-[1.01]' : 'border-border bg-muted/20 hover:bg-muted/40',
              )}
              onClick={selectPdf}
            >
              <div className={cn('flex h-20 w-20 items-center justify-center rounded-full transition-colors', isDragOver ? 'bg-primary/20' : 'bg-muted')}>
                <Upload className={cn('h-10 w-10 transition-colors', isDragOver ? 'text-primary' : 'text-muted-foreground')} />
              </div>
              <div className="text-center space-y-1">
                <p className="text-lg font-semibold">{isDragOver ? 'Loslassen' : 'Storno-PDF hochladen'}</p>
                <p className="text-sm text-muted-foreground">Hierher ziehen oder klicken</p>
              </div>
              <Button onClick={(e) => { e.stopPropagation(); selectPdf(); }} size="lg">
                <FileText className="mr-2 h-4 w-4" />
                PDF auswählen
              </Button>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('confirm')}>← Zurück</Button>
              <Button variant="ghost" onClick={() => setStep('form')}>
                Ohne PDF überspringen →
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Form + Preview ── */}
        {step === 'form' && (
          <div className="flex gap-4 h-[78vh]">
            {/* Left: form */}
            <div className="flex-1 min-w-0 overflow-y-auto pr-1 space-y-4">
              {/* PDF info + AI button */}
              <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4" />
                  <span className="truncate max-w-[200px]">{pdfPath ? pdfName : 'Kein PDF angehängt'}</span>
                </div>
                {pdfPath && (
                  <Button
                    type="button"
                    onClick={handleAiAnalyze}
                    disabled={aiLoading}
                    className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600"
                  >
                    {aiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    {aiLoading ? 'Analysiere...' : '✨ KI-Erfassung'}
                  </Button>
                )}
              </div>

              {/* Validation hints */}
              {(bruttoMismatch || partnerMismatch) && (
                <div className="rounded-lg border border-amber-400/40 bg-amber-500/5 p-3 space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Felder müssen mit dem Original übereinstimmen:
                  </div>
                  {partnerMismatch && <p className="text-amber-700 dark:text-amber-400">• Partner muss „{invoice.partner}" sein</p>}
                  {bruttoMismatch && <p className="text-amber-700 dark:text-amber-400">• Brutto muss {(-invoice.brutto).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} sein</p>}
                </div>
              )}
              {!bruttoMismatch && !partnerMismatch && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Partner und Beträge stimmen mit dem Original überein.
                </div>
              )}

              <form onSubmit={form.handleSubmit(handleSave)} className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Datum</Label>
                  <Input type="date" {...form.register('date')} />
                </div>

                <div className="space-y-1.5">
                  <Label className={cn(partnerMismatch && 'text-amber-500')}>
                    {partnerMismatch && <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />}
                    Partner (muss übereinstimmen)
                  </Label>
                  <Input {...form.register('partner')} className={cn(partnerMismatch && 'border-amber-400')} />
                </div>

                <div className="col-span-2 space-y-1.5">
                  <Label>Beschreibung</Label>
                  <Input {...form.register('description')} />
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
                  <Label className={cn(bruttoMismatch && 'text-amber-500')}>
                    {bruttoMismatch && <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />}
                    Brutto (muss übereinstimmen)
                  </Label>
                  <Input type="number" step="0.01" {...form.register('brutto', { valueAsNumber: true })} className={cn(bruttoMismatch && 'border-amber-400')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Währung</Label>
                  <Input {...form.register('currency')} />
                </div>

                <div className="space-y-1.5">
                  <Label>Typ</Label>
                  <Select value={watchedType} onValueChange={(v) => form.setValue('type', v as 'einnahme' | 'ausgabe' | 'info')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INVOICE_TYPES.map((t) => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Kategorie</Label>
                  <Select value={watchedCategory} onValueChange={(v) => form.setValue('category', v as typeof CATEGORIES[number])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {getCategoriesForBranche(watchedType, branchenprofil, watchedCategory).map((c) => (
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
                  <Button type="button" variant="outline" onClick={() => setStep('upload')}>← Zurück</Button>
                  <Button
                    type="submit"
                    disabled={saving || !!(bruttoMismatch || partnerMismatch)}
                    className="bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50"
                  >
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    ↩ Storno speichern
                  </Button>
                </div>
              </form>
            </div>

            {/* Right: PDF preview */}
            <div className="w-[45%] shrink-0 rounded-lg border overflow-hidden bg-muted/30 flex flex-col">
              <div className="text-xs text-muted-foreground px-3 py-1.5 border-b font-medium">Storno-PDF Vorschau</div>
              {pdfDataUrl ? (
                <iframe src={pdfDataUrl} className="flex-1 w-full" title="Storno-PDF Vorschau" />
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                  Kein PDF angehängt
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


