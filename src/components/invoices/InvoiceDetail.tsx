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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getInvoiceById, updateInvoice, deleteInvoice, lockInvoice, getAllInvoices } from '@/lib/db';
import { getAbsolutePdfPath, readPdfAsBase64 } from '@/lib/pdf';
import { analyzeInvoicePdf } from '@/lib/gemini';
import { useAppStore } from '@/store';
import { CATEGORIES, CATEGORY_LABELS, INVOICE_TYPES, TYPE_LABELS, getCategoriesForTypeFiltered, getCategoriesForBranche, getDefaultCategoryForType, isCategoryValidForType } from '@/types';
import type { Invoice } from '@/types';
import { Loader2, Trash2, Save, FolderOpen, ChevronLeft, ChevronRight, Sparkles, AlertTriangle, Calculator } from 'lucide-react';
import { ProjectSelector } from '@/components/projects/ProjectSelector';
import { readFile } from '@tauri-apps/plugin-fs';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { cn } from '@/lib/utils';
import { berechneAfaOptionen, getGwgKategorie, empfohlenAfaMethode, guessAssetType, NUTZUNGSDAUER_LABELS, ASSET_TYPES, berechneProRataAfa, berechnePoolAfaJahresplan, getNutzungsdauer } from '@/lib/afa';
import { StornoDialog } from './StornoDialog';

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
  const activeAiFix = useAppStore((s) => s.activeAiFix);
  const setActiveAiFix = useAppStore((s) => s.setActiveAiFix);
  const branchenprofil = useAppStore((s) => s.branchenprofil);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);
  const [stornoDialogOpen, setStornoDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiFixLoading, setAiFixLoading] = useState(false);
  const [projectId, setProjectId] = useState('');

  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  // ─── Lade Rechnung ──────────────────────────────────────────────────────────
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
      setProjectId(inv.project_id ?? '');
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

  // ─── KI-Fix ausführen (getriggert vom Panel ODER lokal) ─────────────────────
  const runAiFix = useCallback(async (inv: Invoice) => {
    if (!inv.pdf_path) {
      toast.warning('Kein PDF vorhanden – bitte Kategorie manuell korrigieren.');
      setActiveAiFix(null);
      return;
    }
    setAiFixLoading(true);
    try {
      const absPath = await getAbsolutePdfPath(inv.pdf_path);
      const base64 = await readPdfAsBase64(absPath);
      const result = await analyzeInvoicePdf(base64 as string, invoices);

      if (result.is_invoice === false) {
        toast.warning(
          `⚠️ Kein Buchhaltungsdokument erkannt${result.rejection_reason ? `: ${result.rejection_reason}` : '.'}`,
          { duration: 6000 }
        );
        setActiveAiFix(null);
        return;
      }

      const fields = activeAiFix?.invoiceId === inv.id
        ? activeAiFix.fields
        : (['category'] as Array<'category' | 'type'>);

      const patch: Partial<Invoice> = {};
      if (fields.includes('category')) patch.category = result.suggested_category;
      if (fields.includes('type')) patch.type = result.type;

      // Formular sofort updaten (sichtbar für den Nutzer)
      if (patch.category) form.setValue('category', patch.category);
      if (patch.type) form.setValue('type', patch.type);

      // Speichern
      const updated: Invoice = { ...inv, ...patch, updated_at: new Date().toISOString() };
      await updateInvoice(updated);
      setInvoice(updated);
      const all = await getAllInvoices();
      setInvoices(all);

      const label = patch.category ? CATEGORY_LABELS[patch.category] ?? patch.category : null;
      toast.success(`KI-Fix angewendet${label ? `: Kategorie → „${label}"` : ''}`);
    } catch (err) {
      toast.error('KI-Analyse fehlgeschlagen: ' + String(err));
    } finally {
      setAiFixLoading(false);
      setActiveAiFix(null);
    }
  }, [invoices, activeAiFix, form, setInvoices, setActiveAiFix]);

  // Automatisch starten, wenn vom Panel getriggert
  useEffect(() => {
    if (
      !loading &&
      invoice &&
      activeAiFix?.invoiceId === invoice.id &&
      activeAiFix.loading &&
      !aiFixLoading
    ) {
      runAiFix(invoice);
    }
  }, [loading, invoice, activeAiFix, aiFixLoading, runAiFix]);

  // ─── Navigation ─────────────────────────────────────────────────────────────
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
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (e.target as HTMLElement)?.isContentEditable;
      if (isEditable) return;
      if (e.key === 'ArrowLeft') goToSibling(-1);
      if (e.key === 'ArrowRight') goToSibling(1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goToSibling]);

  // ─── Speichern / Löschen ────────────────────────────────────────────────────
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
        project_id: projectId,
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
      if (invoice.is_locked) {
        toast.error('Festgeschriebene Belege können nicht gelöscht werden. Verwende eine Stornobuchung.');
        return;
      }
      await deleteInvoice(invoice.id);
      const all = await getAllInvoices();
      setInvoices(all);
      toast.success('Rechnung gelöscht');
      navigate('/invoices');
    } catch (e) {
      toast.error('Fehler: ' + String(e));
    }
  };

  const handleLock = async () => {
    if (!invoice) return;
    try {
      await lockInvoice(invoice.id);
      const updated = await getInvoiceById(invoice.id);
      if (updated) setInvoice(updated);
      const all = await getAllInvoices();
      setInvoices(all);
      toast.success('Beleg festgeschrieben – nur noch per Storno korrigierbar.');
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

  // ─── Hilfs-Werte ────────────────────────────────────────────────────────────
  const watchedType = form.watch('type');
  const watchedCategory = form.watch('category');
  const hasCategoryIssue = watchedCategory && watchedType
    ? !isCategoryValidForType(watchedCategory, watchedType) || (watchedType === 'einnahme' && watchedCategory === 'einnahmen')
    : false;
  const hasPdf = !!invoice?.pdf_path;

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
            <Select value={watchedType} onValueChange={(v) => {
              const newType = v as 'einnahme' | 'ausgabe' | 'info';
              form.setValue('type', newType);
              const cur = form.getValues('category');
              if (!(getCategoriesForTypeFiltered(newType) as string[]).includes(cur)) {
                form.setValue('category', getDefaultCategoryForType(newType));
              }
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INVOICE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Kategorie – mit Fehlerindikator und KI-Fix-Button */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className={cn(hasCategoryIssue && 'text-amber-500 dark:text-amber-400')}>
                {hasCategoryIssue && <AlertTriangle className="inline h-3.5 w-3.5 mr-1 mb-0.5" />}
                Kategorie
              </Label>
              {hasCategoryIssue && (
                <button
                  type="button"
                  onClick={() => invoice && runAiFix(invoice)}
                  disabled={aiFixLoading || !hasPdf}
                  title={hasPdf ? 'KI analysiert das PDF und schlägt die richtige Kategorie vor' : 'Kein PDF – bitte manuell auswählen'}
                  className={cn(
                    'flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium border transition-colors',
                    hasPdf
                      ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-300/40 hover:bg-violet-500/20'
                      : 'bg-muted text-muted-foreground border-border cursor-not-allowed opacity-50',
                  )}
                >
                  {aiFixLoading
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Sparkles className="h-3 w-3" />
                  }
                  {aiFixLoading ? 'Analysiere…' : 'KI-Fix'}
                </button>
              )}
            </div>
            <Select
              value={watchedCategory}
              onValueChange={(v) => form.setValue('category', v as typeof CATEGORIES[number])}
            >
              <SelectTrigger className={cn(hasCategoryIssue && 'border-amber-400/60 ring-amber-400/20')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getCategoriesForBranche(watchedType, branchenprofil, watchedCategory).map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* AfA / GWG Hinweis – automatisch bei relevanten Kategorien */}
          {(watchedCategory === 'gwg' || watchedCategory === 'anlagevermoegen_afa') && form.watch('netto') > 0 && (
            <AfaInfoBox netto={form.watch('netto')} category={watchedCategory} description={form.watch('description') ?? ''} partner={form.watch('partner') ?? ''} date={form.watch('date') ?? ''} />
          )}

          <div className="space-y-1.5">
            <Label>Notiz</Label>
            <Input {...form.register('note')} />
          </div>

          <div className="space-y-1.5">
            <Label>Projekt</Label>
            <ProjectSelector
              value={projectId}
              onChange={setProjectId}
            />
          </div>

          <div className="flex flex-col gap-2 pt-2">
            {/* Zeile 1: Primäraktion + PDF */}
            <div className="flex gap-2">
              <Button type="submit" disabled={saving || invoice?.is_locked} className="flex-1">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Speichern
              </Button>
              <Button type="button" variant="outline" onClick={handleReveal} title="PDF im Explorer anzeigen">
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
            {/* Zeile 2: GoBD-Aktionen + Löschen */}
            <div className="flex gap-2">
              {!invoice?.is_locked && (
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setConfirmLock(true)}
                  title="Beleg festschreiben – danach nur noch per Storno korrigierbar (GoBD)"
                >
                  🔒 Festschreiben
                </Button>
              )}
              {!invoice?.storno_of && (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 text-orange-600 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                  onClick={() => setStornoDialogOpen(true)}
                  title="Gegenbuchung erstellen, die diesen Beleg buchhalterisch aufhebt (GoBD-konform)"
                >
                  ↩ Stornieren
                </Button>
              )}
              {!invoice?.is_locked && (
                <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)} title="Beleg löschen">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          {invoice?.is_locked && (
            <p className="text-xs text-amber-600 mt-1">🔒 Dieser Beleg ist festgeschrieben. Änderungen sind nur über eine Stornobuchung möglich.</p>
          )}
          {invoice?.storno_of && (
            <p className="text-xs text-orange-600 mt-1">
              ↩ Stornobuchung zu{' '}
              <button
                type="button"
                className="underline hover:text-orange-800 dark:hover:text-orange-400 font-medium transition-colors"
                onClick={() => navigate(`/invoices/${invoice.storno_of}`)}
                title="Originalbeleg öffnen"
              >
                Beleg #{invoice.storno_of.slice(0, 8)}…
              </button>
            </p>
          )}
        </form>
      </div>

      {/* Delete confirm dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
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

      {/* Festschreiben confirm dialog */}
      <AlertDialog open={confirmLock} onOpenChange={setConfirmLock}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Beleg festschreiben?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Der Beleg wird <strong>dauerhaft gesperrt</strong> und kann danach <strong>nicht mehr bearbeitet oder gelöscht</strong> werden.</p>
                <p>Das entspricht den <strong>GoBD-Anforderungen</strong> (Grundsätze ordnungsgemäßer Buchführung): Einmal verbuchte Belege dürfen nachträglich nicht verändert werden.</p>
                <p className="text-amber-600 dark:text-amber-400">Falls du den Beleg später korrigieren musst, ist nur noch eine <strong>Stornobuchung</strong> möglich – eine neue Gegenbuchung mit negativen Beträgen.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleLock}>🔒 Jetzt festschreiben</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Storno Dialog */}
      <StornoDialog
        open={stornoDialogOpen}
        invoice={invoice}
        onClose={() => setStornoDialogOpen(false)}
        onSuccess={(stornoId) => { setStornoDialogOpen(false); navigate(`/invoices/${stornoId}`); }}
      />
    </div>
  );
}

// ─── AfA / GWG Hinweis-Box ─────────────────────────────────────────────────

function AfaInfoBox({ netto, category, description, partner, date }: { netto: number; category: string; description: string; partner: string; date: string }) {
  const detectedType = guessAssetType(description, partner);
  const [selectedType, setSelectedType] = useState(detectedType);
  const [selectedMethode, setSelectedMethode] = useState<string | null>(null);
  const [showPlan, setShowPlan] = useState(false);

  // Vorauswahl aktualisieren wenn sich Beschreibung/Partner ändert
  useEffect(() => {
    setSelectedType(guessAssetType(description, partner));
    setSelectedMethode(null); // Methodenauswahl zurücksetzen bei neuem Typ
  }, [description, partner]);
  const gwgLabel = getGwgKategorie(netto);
  const empfohlen = empfohlenAfaMethode(netto);
  const optionen = berechneAfaOptionen(netto, selectedType, false);
  // Aktiv gewählte Option (oder empfohlene als Fallback)
  const aktiveOption = optionen.find((o) => o.methode === (selectedMethode ?? empfohlen)) ?? optionen[optionen.length - 1];
  const nutzungsdauer = aktiveOption?.nutzungsdauer ?? getNutzungsdauer(selectedType);
  const currentYear = new Date().getFullYear();
  const isPool = (selectedMethode ?? empfohlen) === 'pool';
  const proRata = nutzungsdauer > 1
    ? (isPool
        ? berechnePoolAfaJahresplan(netto, date, currentYear)
        : berechneProRataAfa(netto, date, nutzungsdauer, currentYear))
    : null;

  const fmtEur = (v: number) => v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

  // Warnung wenn falsche Kategorie gewählt
  const sollGwg = netto <= 800;
  const sollAfa = netto > 800;
  const falscheKategorie = (category === 'gwg' && sollAfa) || (category === 'anlagevermoegen_afa' && sollGwg);

  return (
    <div className="rounded-lg border border-blue-300/40 bg-blue-500/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Calculator className="h-4 w-4 text-blue-500" />
        <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">AfA-Einordnung</span>
      </div>

      <div className="text-xs space-y-1.5">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Netto-Preis:</span>
          <span className="font-medium">{fmtEur(netto)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Schwelle:</span>
          <span className="font-medium">{gwgLabel}</span>
        </div>

        {/* Typ-Auswahl */}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Wirtschaftsgut-Typ:</span>
          <Select value={selectedType} onValueChange={(v) => { setSelectedType(v); setSelectedMethode(null); }}>
            <SelectTrigger className="w-[180px] h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSET_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="text-xs">
                  {NUTZUNGSDAUER_LABELS[t] ?? t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedType !== detectedType && (
          <div className="text-[10px] text-muted-foreground italic">
            Automatisch erkannt: {NUTZUNGSDAUER_LABELS[detectedType] ?? detectedType}
          </div>
        )}

        {/* Monatliche AfA */}
        {proRata && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Monatliche AfA ({aktiveOption?.label ?? ''}):</span>
            <span className="font-medium">{fmtEur(proRata.monatsAfa)}</span>
          </div>
        )}
        {proRata && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">AfA in {currentYear}:</span>
            <span className="font-medium text-violet-600 dark:text-violet-400">
              {fmtEur(proRata.afaBetragImJahr)}{!isPool && ` (${proRata.monateImJahr}/12 Mon.)`}
              {isPool && <span className="ml-1 text-[10px] text-muted-foreground">(voller Jahresbetrag)</span>}
            </span>
          </div>
        )}

        {falscheKategorie && (
          <div className="flex items-start gap-1.5 rounded bg-amber-500/10 border border-amber-400/30 p-2 mt-1">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <span className="text-amber-700 dark:text-amber-400 text-[11px]">
              {sollGwg
                ? `Netto ≤ 800 € → sollte als „GWG" kategorisiert werden (Sofortabschreibung).`
                : `Netto > 800 € → sollte als „Anlagevermögen / AfA" kategorisiert werden (lineare Abschreibung).`
              }
            </span>
          </div>
        )}

        <div className="border-t border-blue-200/30 pt-1.5 mt-1.5 space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Abschreibungsoptionen:</span>
          {optionen.map((opt) => {
            const isActive = opt.methode === (selectedMethode ?? empfohlen);
            return (
              <button
                key={opt.methode}
                type="button"
                onClick={() => { setSelectedMethode(opt.methode); setShowPlan(false); }}
                className={cn(
                  'w-full text-left rounded p-1.5 text-[11px] border transition-colors',
                  isActive
                    ? 'bg-emerald-500/10 border-emerald-400/30 ring-1 ring-emerald-400/40'
                    : 'bg-muted/50 border-transparent hover:bg-muted',
                )}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">
                    {isActive && <span className="text-emerald-600 mr-1">✓</span>}
                    {opt.label}
                    {opt.methode === empfohlen && opt.methode !== (selectedMethode ?? empfohlen) && (
                      <span className="ml-1 text-[9px] text-muted-foreground">(empfohlen)</span>
                    )}
                    {opt.methode === empfohlen && isActive && selectedMethode == null && (
                      <span className="ml-1 text-[9px] text-muted-foreground">(empfohlen)</span>
                    )}
                  </span>
                  <span className="font-mono">{fmtEur(opt.jahresAbschreibung)}/Jahr</span>
                </div>
                {opt.nutzungsdauer > 1 && (
                  <span className="text-muted-foreground">Restwert nach 1 Jahr: {fmtEur(opt.restwert)}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Abschreibungsplan */}
        {proRata && proRata.jahresplan.length > 0 && (
          <div className="border-t border-blue-200/30 pt-1.5 mt-1.5">
            <button
              type="button"
              onClick={() => setShowPlan(!showPlan)}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {showPlan ? '▾' : '▸'} Abschreibungsplan ({proRata.jahresplan.length} Jahre)
            </button>
            {showPlan && (
              <div className="mt-1.5 rounded border overflow-hidden">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-2 py-1 font-medium">Jahr</th>
                      {!isPool && <th className="text-center px-2 py-1 font-medium">Monate</th>}
                      <th className="text-right px-2 py-1 font-medium">AfA</th>
                      <th className="text-right px-2 py-1 font-medium">Restwert</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proRata.jahresplan.map((row) => (
                      <tr key={row.jahr} className={cn(
                        'border-t',
                        row.jahr === currentYear && 'bg-violet-500/5 font-semibold',
                      )}>
                        <td className="px-2 py-1">{row.jahr}{row.jahr === currentYear ? ' ◄' : ''}</td>
                        {!isPool && <td className="px-2 py-1 text-center">{row.monate}/12</td>}
                        <td className="px-2 py-1 text-right">{fmtEur(row.betrag)}</td>
                        <td className="px-2 py-1 text-right">{fmtEur(row.restwert)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

