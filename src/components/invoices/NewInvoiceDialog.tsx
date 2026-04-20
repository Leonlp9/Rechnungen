import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';
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
  DialogFooter,
  DialogDescription,
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
import { CATEGORIES, CATEGORY_LABELS, INVOICE_TYPES, TYPE_LABELS, getCategoriesForBranche, getDefaultCategoryForType } from '@/types';
import type { Invoice } from '@/types';
import { insertInvoice, getAllInvoices, insertDraftDb } from '@/lib/db';
import { copyPdfToAppData, readPdfAsBase64, copyPdfToDraftsFolder, getAbsolutePdfPath } from '@/lib/pdf';
import { analyzeInvoicePdf } from '@/lib/gemini';
import { useAppStore } from '@/store';
import type { InvoiceDraft } from '@/store';
import { Upload, Sparkles, Loader2, FileText, AlertTriangle, ExternalLink, Files, BookmarkPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { fmtCurrency } from '@/lib/utils';

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
  onClose: (saved?: boolean) => void;
  initialPdfPath?: string;
  initialPdfName?: string;
}

export function NewInvoiceDialog({ open: isOpen, onClose, initialPdfPath, initialPdfName }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState('');
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [duplicates, setDuplicates] = useState<Invoice[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [pendingData, setPendingData] = useState<FormData | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const setInvoices = useAppStore((s) => s.setInvoices);
  const addDraft = useAppStore((s) => s.addDraft);
  const drafts = useAppStore((s) => s.drafts ?? []);

  // If this dialog was opened from a draft, track its id so we can remove it on save/draft-resave
  const currentDraftId = initialPdfPath
    ? (drafts.find((d) => d.filePath === initialPdfPath)?.id ?? null)
    : null;

  const saveAsDraft = async () => {
    if (!pdfPath) return;
    // If already a draft (opened from DraftsPanel), just close — it's still in the list
    if (currentDraftId) {
      reset();
      onClose();
      return;
    }
    try {
      const id = crypto.randomUUID();
      const fileName = `${id}.pdf`;
      const name = pdfName || (pdfPath.split(/[\\/]/).pop() ?? 'document.pdf');
      const addedAt = new Date().toISOString();
      const relativePath = await copyPdfToDraftsFolder(pdfPath, fileName);
      const absPath = await getAbsolutePdfPath(relativePath);
      await insertDraftDb(id, relativePath, name, addedAt);
      const draft: InvoiceDraft = { id, filePath: absPath, relativePath, fileName: name, addedAt };
      addDraft(draft);
      toast.success('Als Entwurf gespeichert');
      reset();
      onClose();
    } catch (e) {
      toast.error('Fehler beim Speichern als Entwurf: ' + String(e));
    }
  };

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
    setDuplicates([]);
    setShowDuplicateWarning(false);
    setPendingData(null);
    form.reset();
  };

  // Tauri native drag-drop listener (liefert echte Dateipfade)
  useEffect(() => {
    if (!isOpen || step !== 1) return;
    let unlisten: (() => void) | undefined;
    getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === 'over') {
        setIsDragOver(true);
      } else if (event.payload.type === 'leave') {
        setIsDragOver(false);
      } else if (event.payload.type === 'drop') {
        setIsDragOver(false);
        const paths: string[] = event.payload.paths ?? [];
        const pdfs = paths.filter((p) => p.toLowerCase().endsWith('.pdf'));
        if (pdfs.length === 0) return;
        processFiles(pdfs);
      }
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, [isOpen, step]);

  const processFiles = async (files: string[]) => {
    if (files.length === 1) {
      const filePath = files[0];
      setPdfPath(filePath);
      setPdfName(filePath.split(/[\\/]/).pop() ?? 'document.pdf');
      try {
        const base64 = await readPdfAsBase64(filePath);
        setPdfDataUrl(`data:application/pdf;base64,${base64}`);
      } catch {
        setPdfDataUrl(null);
      }
      setStep(2);
    } else {
      for (const filePath of files) {
        const id = crypto.randomUUID();
        const fileName = `${id}.pdf`;
        const name = filePath.split(/[\\/]/).pop() ?? 'document.pdf';
        const addedAt = new Date().toISOString();
        try {
          const relativePath = await copyPdfToDraftsFolder(filePath, fileName);
          const absPath = await getAbsolutePdfPath(relativePath);
          await insertDraftDb(id, relativePath, name, addedAt);
          addDraft({ id, filePath: absPath, relativePath, fileName: name, addedAt });
        } catch { /* skip */ }
      }
      toast.success(`${files.length} Entwürfe gespeichert`);
      handleClose();
    }
  };

  // Load all invoices when dialog opens (for AI context + duplicate check)
  useEffect(() => {
    if (isOpen) {
      getAllInvoices().then(setAllInvoices).catch(() => {});
    }
  }, [isOpen]);

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
        multiple: true,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (!result) return;
      const files = (Array.isArray(result) ? result : [result]) as string[];
      await processFiles(files);
    } catch (e) {
      toast.error('Fehler beim Auswählen der PDF: ' + String(e));
    }
  };

  const handleAiAnalyze = async () => {
    if (!pdfPath) return;
    setAiLoading(true);
    try {
      const base64 = await readPdfAsBase64(pdfPath);
      const result = await analyzeInvoicePdf(base64 as string, allInvoices);
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

  const performSave = async (data: FormData) => {
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
      if (pdfPath?.includes('invoices')) {
        const fname = pdfPath.split(/[\\/]/).pop();
        if (fname) invoke('delete_invoice_file', { filename: fname }).catch(() => {});
      }
      reset();
      onClose(true);
    } catch (e) {
      toast.error('Fehler beim Speichern: ' + String(e));
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    // Duplicate check: same date, partner (case-insensitive), brutto
    const dups = allInvoices.filter(
      (inv) =>
        inv.date === data.date &&
        inv.partner.trim().toLowerCase() === data.partner.trim().toLowerCase() &&
        Math.abs(inv.brutto - data.brutto) < 0.01,
    );
    if (dups.length > 0) {
      setDuplicates(dups);
      setPendingData(data);
      setShowDuplicateWarning(true);
      return;
    }
    await performSave(data);
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className={step === 2 ? 'max-w-[90vw] w-[90vw] max-h-[92vh] overflow-hidden' : 'max-w-lg'}>
        <DialogHeader>
          <DialogTitle>Neue Rechnung</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div
            ref={dropZoneRef}
            className={`flex flex-col items-center gap-5 py-10 px-6 border-2 border-dashed rounded-xl transition-colors select-none cursor-pointer
              ${isDragOver
                ? 'border-primary bg-primary/10 scale-[1.01]'
                : 'border-border bg-muted/20 hover:bg-muted/40'
              }`}
            onClick={selectPdf}
          >
            <div className={`flex h-20 w-20 items-center justify-center rounded-full transition-colors ${isDragOver ? 'bg-primary/20' : 'bg-muted'}`}>
              <Upload className={`h-10 w-10 transition-colors ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <div className="text-center space-y-1">
              <p className="text-lg font-semibold">{isDragOver ? 'Loslassen zum Hinzufügen' : 'PDF hochladen'}</p>
              <p className="text-sm text-muted-foreground">Hierher ziehen oder klicken · eine oder mehrere PDFs</p>
              <p className="text-xs text-muted-foreground/60 flex items-center justify-center gap-1">
                <Files className="h-3 w-3" /> Mehrere Dateien werden als Entwürfe gespeichert
              </p>
            </div>
            <Button onClick={(e) => { e.stopPropagation(); selectPdf(); }} size="lg">
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
                  <Select value={form.watch('type')} onValueChange={(v) => {
                    const newType = v as 'einnahme' | 'ausgabe' | 'info';
                    form.setValue('type', newType);
                    form.setValue('category', getDefaultCategoryForType(newType));
                  }}>
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
                      {getCategoriesForBranche(form.watch('type'), useAppStore.getState().branchenprofil, form.watch('category')).map((c) => (
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
                  <Button type="button" variant="outline" onClick={saveAsDraft}>
                    <BookmarkPlus className="mr-2 h-4 w-4" />
                    {currentDraftId ? 'Entwurf behalten' : 'Als Entwurf speichern'}
                  </Button>
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

    {/* Duplicate Warning Dialog */}
    <Dialog open={showDuplicateWarning} onOpenChange={(v) => { if (!v) setShowDuplicateWarning(false); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Möglicher Duplikat-Beleg
          </DialogTitle>
          <DialogDescription>
            Es gibt bereits {duplicates.length} Beleg{duplicates.length > 1 ? 'e' : ''} mit demselben Datum, Partner und Betrag. Bitte prüfe, ob dieser Beleg bereits erfasst wurde.
          </DialogDescription>
        </DialogHeader>

        <div className="divide-y rounded-lg border overflow-hidden my-2">
          {duplicates.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between px-3 py-2 hover:bg-muted/60 cursor-pointer group transition-colors"
              onClick={() => {
                setShowDuplicateWarning(false);
                navigate(`/invoices/${inv.id}`);
              }}
              title="Beleg öffnen"
            >
              <div className="min-w-0">
                <p className="font-medium text-sm truncate flex items-center gap-1">
                  {inv.partner}
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </p>
                <p className="text-xs text-muted-foreground truncate">{inv.description}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(inv.date), 'dd.MM.yyyy', { locale: de })}</p>
              </div>
              <span className={`font-semibold text-sm shrink-0 ml-3 ${inv.type === 'einnahme' ? 'text-green-600' : 'text-red-600'}`}>
                {inv.type === 'einnahme' ? '+' : inv.type === 'ausgabe' ? '−' : ''}{fmtCurrency(inv.brutto, false)}
              </span>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 flex-row justify-end">
          <Button
            variant="outline"
            onClick={() => setShowDuplicateWarning(false)}
          >
            Abbrechen
          </Button>
          <Button
            variant="destructive"
            disabled={saving}
            onClick={async () => {
              setShowDuplicateWarning(false);
              if (pendingData) await performSave(pendingData);
            }}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Trotzdem speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}





