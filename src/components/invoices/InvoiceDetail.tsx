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
import type { Invoice, Category } from '@/types';
import { Loader2, Trash2, Save, FolderOpen, ChevronLeft, ChevronRight, Sparkles, AlertTriangle, Calculator, FileCode2, Lock, Check, Undo2, MoreHorizontal, ExternalLink } from 'lucide-react';
import { readFile } from '@tauri-apps/plugin-fs';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { invoke } from '@tauri-apps/api/core';
import { cn, fmtCurrency } from '@/lib/utils';
import { berechneAfaOptionen, getGwgKategorie, empfohlenAfaMethode, guessAssetType, NUTZUNGSDAUER_LABELS, ASSET_TYPES, berechneProRataAfa, berechnePoolAfaJahresplan, getNutzungsdauer } from '@/lib/afa';
import { StornoDialog } from './StornoDialog';
import { PdfCanvasViewer } from './PdfCanvasViewer';
import { useIsMobile } from '@/hooks/useIsMobile';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { saveXRechnungFile, saveXRechnungToAppData, getAbsoluteXRechnungPath } from '@/lib/xrechnung';
import { getSetting } from '@/lib/db';
import { ProjectSelector } from '@/components/projects/ProjectSelector';
import { reportInvalid } from '@/lib/formErrors';
import { CurrencySelect } from '@/components/ui/CurrencySelect';
import { ListGroup, ListRow } from '@/components/ui/list-group';
import { Segmented } from '@/components/ui/segmented';
import { FormGroup, FormRow, FormFullRow, FIELD, FIELD_DATE, FIELD_SELECT } from '@/components/ui/form-list';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CurrencyConversionHint } from './CurrencyConversionHint';
import { fmtOriginal, normalizeCurrency } from '@/lib/currency';

const schema = z.object({
  date: z.string().min(1),
  description: z.string().min(1),
  partner: z.string().min(1),
  netto: z.number(),
  fee: z.number().min(0),
  ust: z.number(),
  brutto: z.number(),
  type: z.enum(['einnahme', 'ausgabe', 'info']),
  category: z.enum(CATEGORIES),
  currency: z.string(),
  note: z.string(),
});

type FormData = z.infer<typeof schema>;

/** Umschalter Details ↔ Dokument – an zwei Stellen verwendet, je nachdem,
 *  welcher Bereich gerade sichtbar ist. */
function MobileTabs({
  value,
  onChange,
}: {
  value: 'details' | 'pdf';
  onChange: (v: 'details' | 'pdf') => void;
}) {
  return (
    <Segmented
      value={value}
      onChange={onChange}
      options={[
        { value: 'details', label: 'Details' },
        { value: 'pdf', label: 'Dokument' },
      ]}
    />
  );
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const invoices = useAppStore((s) => s.invoices);
  const setInvoices = useAppStore((s) => s.setInvoices);
  const activeAiFix = useAppStore((s) => s.activeAiFix);
  const setActiveAiFix = useAppStore((s) => s.setActiveAiFix);
  const branchenprofil = useAppStore((s) => s.branchenprofil);
  const steuerregelung = useAppStore((s) => s.steuerregelung);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const isMobile = useIsMobile();
  // Mobile: PDF und Formular passen nicht nebeneinander → Umschalter
  const [mobileTab, setMobileTab] = useState<'details' | 'pdf'>('details');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);
  const [stornoDialogOpen, setStornoDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiFixLoading, setAiFixLoading] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [xrechnungExporting, setXrechnungExporting] = useState(false);
  const [xrechnungArchiving, setXrechnungArchiving] = useState(false);

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
        // Bearbeitet werden IMMER die Beträge in der Belegwährung –
        // die Euro-Werte leitet die Datenschicht daraus ab.
        netto: inv.netto_original ?? inv.netto,
        fee: inv.fee_original ?? inv.fee,
        ust: inv.ust_original ?? inv.ust,
        brutto: inv.brutto_original ?? inv.brutto,
        type: inv.type,
        category: inv.category,
        currency: normalizeCurrency(inv.currency),
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
  /**
   * Ohne diesen Handler bricht react-hook-form bei ungültigen Feldern still ab –
   * der Speichern-Knopf sah dann aus, als würde er nichts tun. Häufigster Fall:
   * ein geleertes Zahlenfeld wird zu NaN und scheitert an z.number().
   */
  const onInvalid = (errs: Record<string, unknown>) => reportInvalid(errs, setInvalidFields);

  const onSubmit = async (data: FormData) => {
    if (!invoice) return;
    if (steuerregelung === 'kleinunternehmer' && data.type === 'einnahme' && Math.abs(data.ust) > 0.001) {
      toast.error('Bei Kleinunternehmer-Einnahmen muss USt 0 sein.');
      return;
    }
    if (data.fee > data.brutto) {
      toast.error('Gebuehr darf nicht hoeher als der Bruttobetrag sein.');
      return;
    }
    const sumDiff = Math.abs((data.netto + data.ust) - data.brutto);
    if (sumDiff > 0.01) {
      toast.error('Netto + USt muss dem Bruttobetrag entsprechen. Gebühren fließen hier nicht ein – sie werden separat gespeichert. Beispiel: Brutto 140 €, USt 0 €, Netto 140 € → Fee 22 € separat.');
      return;
    }
    setSaving(true);
    try {
      const dateObj = new Date(data.date);
      const updated: Invoice = {
        ...invoice,
        ...data,
        // Die Formularwerte sind Beträge in der Belegwährung. Ohne diese
        // Zuweisung würde die Umrechnung die alten Originalwerte verwenden.
        netto_original: data.netto,
        ust_original: data.ust,
        brutto_original: data.brutto,
        fee_original: data.fee,
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
      setInvalidFields([]);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } catch (e) {
      toast.error('Nicht gespeichert: ' + (e instanceof Error ? e.message : String(e)));
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

  const handleXRechnungExport = async () => {
    if (!invoice) return;
    setXrechnungExporting(true);
    try {
      const [name, street, zip, city, country, taxNumber, vatId, email] = await Promise.all([
        getSetting('profile_name'),
        getSetting('profile_street'),
        getSetting('profile_zip'),
        getSetting('profile_city'),
        getSetting('profile_country'),
        getSetting('profile_tax_number'),
        getSetting('profile_vat_id'),
        getSetting('profile_email'),
      ]);
      if (!name) {
        toast.warning('Bitte fülle zuerst dein Profil (Name, Steuernummer) in den Einstellungen aus.');
        return;
      }
      if (!taxNumber && !vatId) {
        toast.warning('Für XRechnung wird eine Steuernummer oder USt-ID benötigt. Bitte in Einstellungen → Profil eintragen.');
        return;
      }
      if (!invoice.delivery_date) {
        toast.warning('Das Leistungsdatum (§ 14 Abs. 4 UStG) fehlt. Bitte vor dem Export eintragen.');
        return;
      }
      await saveXRechnungFile(invoice, {
        sellerName: name ?? '',
        sellerStreet: street ?? '',
        sellerZip: zip ?? '',
        sellerCity: city ?? '',
        sellerCountry: country ?? 'DE',
        taxNumber: taxNumber ?? '',
        vatId: vatId ?? '',
        sellerEmail: email ?? '',
      });
      toast.success('XRechnung (UBL 2.1) erfolgreich exportiert!');
    } catch (e) {
      toast.error('XRechnung-Export fehlgeschlagen: ' + String(e));
    } finally {
      setXrechnungExporting(false);
    }
  };

  /** Archiviert nachträglich eine XRechnung für diesen Beleg */
  const handleXRechnungArchive = async () => {
    if (!invoice) return;
    setXrechnungArchiving(true);
    try {
      const [name, street, zip, city, country, taxNumber, vatId, email] = await Promise.all([
        getSetting('profile_name'),
        getSetting('profile_street'),
        getSetting('profile_zip'),
        getSetting('profile_city'),
        getSetting('profile_country'),
        getSetting('profile_tax_number'),
        getSetting('profile_vat_id'),
        getSetting('profile_email'),
      ]);
      if (!name) {
        toast.warning('Kein Profil-Name gefunden. Bitte Einstellungen → Profil ausfüllen.');
        return;
      }
      if (!invoice.delivery_date) {
        toast.warning('Leistungsdatum fehlt – bitte zuerst eintragen und speichern.');
        return;
      }
      const relPath = await saveXRechnungToAppData(invoice, {
        sellerName: name ?? '',
        sellerStreet: street ?? '',
        sellerZip: zip ?? '',
        sellerCity: city ?? '',
        sellerCountry: country ?? 'DE',
        taxNumber: taxNumber ?? '',
        vatId: vatId ?? '',
        sellerEmail: email ?? '',
      });
      const updated = { ...invoice, xrechnung_path: relPath, updated_at: new Date().toISOString() };
      await updateInvoice(updated);
      setInvoice(updated);
      const all = await getAllInvoices();
      setInvoices(all);
      toast.success('✅ XRechnung revisionssicher archiviert!');
    } catch (e) {
      toast.error('Archivierung fehlgeschlagen: ' + String(e));
    } finally {
      setXrechnungArchiving(false);
    }
  };

  /** Öffnet das archivierte XML im Datei-Explorer */
  /**
   * Auf dem Handy gibt es keinen Dateimanager, in dem sich etwas „im Ordner
   * zeigen" ließe – der Knopf lief dort ins Leere. Stattdessen reicht das
   * System die Datei an eine App weiter, die PDFs anzeigen kann.
   */
  const handleOpenExternal = async () => {
    if (!invoice?.pdf_path) return;
    try {
      const abs = await getAbsolutePdfPath(invoice.pdf_path);
      // Eigener Befehl statt Opener: Auf Android muss die Datei als
      // `content://`-Verweis übergeben werden, sonst darf die andere App sie
      // gar nicht lesen. Auf dem Desktop reicht der Befehl an den Opener weiter.
      await invoke('open_file_external', { path: abs, mime: 'application/pdf' });
    } catch (e) {
      toast.error('Konnte das PDF nicht an eine andere App übergeben', { description: String(e) });
    }
  };

  const handleRevealXml = async () => {
    if (!invoice?.xrechnung_path) return;
    try {
      const absPath = await getAbsoluteXRechnungPath(invoice.xrechnung_path);
      await revealItemInDir(absPath);
    } catch (e) {
      toast.error('Fehler: ' + String(e));
    }
  };

  // ─── Hilfs-Werte ────────────────────────────────────────────────────────────
  const watchedType = form.watch('type');
  const watchedCurrency = normalizeCurrency(form.watch('currency'));
  const privacyMode = useAppStore((s) => s.privacyMode);
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  const [justSaved, setJustSaved] = useState(false);
  const watchedCategory = form.watch('category');
  const hasCategoryIssue = watchedCategory && watchedType
      ? !isCategoryValidForType(watchedCategory, watchedType) || (watchedType === 'einnahme' && watchedCategory === 'einnahmen')
      : false;
  const hasPdf = !!invoice?.pdf_path;

  if (loading) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Lade...</div>;
  }

  return (
      // Am Handy bis zur Unterkante: Der Inhalt soll unter der schwebenden
      // Leiste durchlaufen (Glaseffekt) statt an einem toten Streifen davor
      // abzureißen. Den Freiraum zum Weiterscrollen bringen die Scrollbereiche
      // selbst mit (--app-main-pb).
      <div className={cn('h-full', isMobile ? 'flex flex-col gap-3 p-3 pb-0' : 'flex gap-6')}>
        {/* Mobile: Umschalter Details ↔ Dokument.
            Er sitzt IM jeweiligen Bereich, nicht als fester Balken darüber –
            oben soll beim Scrollen nur der Zurück-Knopf stehen bleiben. Über
            dem Dokument bleibt er fest, weil dort nichts scrollt. */}
        {isMobile && mobileTab === 'pdf' && <MobileTabs value={mobileTab} onChange={setMobileTab} />}

        {/* PDF-Ansicht (Desktop: links, Mobile: eigener Tab mit pdf.js-Renderer) */}
        <div
          className={cn(
            'rounded-xl border bg-card shadow-sm overflow-hidden min-w-0',
            isMobile ? (mobileTab === 'pdf' ? 'flex-1' : 'hidden') : 'flex-1',
          )}
        >
          {pdfUrl ? (
              isMobile ? (
                <PdfCanvasViewer url={pdfUrl} bottomInset="var(--app-main-pb, 0.5rem)" />
              ) : (
                <embed src={pdfUrl} type="application/pdf" className="h-full w-full" />
              )
          ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">Kein PDF vorhanden</div>
          )}
        </div>

        {/* Formular (Desktop: rechts, Mobile: eigener Tab in voller Breite) */}
        <div
          className={cn(
            'space-y-4 overflow-y-auto',
            isMobile ? (mobileTab === 'details' ? 'flex-1 min-h-0' : 'hidden') : 'w-[400px] shrink-0',
          )}
          style={isMobile ? { paddingBottom: 'var(--app-main-pb, 0.75rem)' } : undefined}
        >
          {isMobile && <MobileTabs value={mobileTab} onChange={setMobileTab} />}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Auf dem Handy steht „Beleg" schon in der Navigationsleiste –
                  eine zweite Überschrift darunter ist verschenkter Platz. */}
              {!isMobile && <h1 className="text-xl font-bold">Rechnungsdetails</h1>}
              {/* Status-Badge */}
              {invoice?.storno_of ? (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-300/40">
                  ↩ Storno
                </span>
              ) : invoice?.is_locked ? (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-300/40">
                  <Lock className="h-2.5 w-2.5 mr-1" />Festgeschrieben
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground border border-border">
                  Entwurf
                </span>
              )}
              {/* E-Rechnung Badge */}
              {invoice?.xrechnung_path ? (
                <button
                  type="button"
                  onClick={handleRevealXml}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-300/40 hover:bg-violet-500/20 transition-colors"
                  title={`E-Rechnung archiviert: ${invoice.xrechnung_path} – klicken zum Anzeigen`}
                >
                  <FileCode2 className="h-2.5 w-2.5" />
                  E-Rechnung ✓
                </button>
              ) : invoice?.type === 'einnahme' ? (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-300/40" title="E-Rechnung noch nicht archiviert – Pflicht ab 01.01.2025 für B2B">
                  <FileCode2 className="h-2.5 w-2.5" />
                  Kein XML
                </span>
              ) : null}
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" disabled={currentIndex <= 0} onClick={() => goToSibling(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" disabled={currentIndex >= invoices.length - 1} onClick={() => goToSibling(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Fremdwährung: gebuchter Euro-Wert und der dafür eingefrorene Kurs */}
          {invoice && normalizeCurrency(invoice.currency) !== 'EUR' && (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
              {invoice.fx_source === 'pending' ? (
                <p className="flex items-start gap-1.5 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Umrechnung steht noch aus – dieser Beleg wird aktuell mit seinem
                    {' '}{normalizeCurrency(invoice.currency)}-Betrag gezählt. Sobald ein Kurs
                    abrufbar ist, wird er automatisch umgerechnet.
                  </span>
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium">
                    <span className="text-muted-foreground">Gebucht:</span>
                    <span>{fmtCurrency(invoice.brutto, privacyMode)}</span>
                    <span className="text-muted-foreground">· Beleg:</span>
                    <span>
                      {privacyMode
                        ? '••••'
                        : fmtOriginal(invoice.brutto_original ?? invoice.brutto, normalizeCurrency(invoice.currency))}
                    </span>
                  </div>
                  <p className="mt-0.5 text-muted-foreground">
                    Kurs {(invoice.fx_rate ?? 1).toFixed(4)} EUR/{normalizeCurrency(invoice.currency)}
                    {invoice.fx_date && ` vom ${new Date(invoice.fx_date).toLocaleDateString('de-DE')}`}
                    {invoice.fx_source === 'ecb' && ' (EZB-Referenzkurs)'}
                    {invoice.fx_source === 'manual' && ' (manuell gesetzt)'}
                  </p>
                </>
              )}
            </div>
          )}

          <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-3">
            {isMobile ? (
            <>
            {/* ── Handy: iOS-Formular ──
                Beschriftung links, Eingabe rechts, 44-pt-Zeilen in flächigen
                Gruppen. Untereinander gestapelte Label/Feld-Paare ergaben auf
                dem Handy eine endlose, unübersichtliche Kolonne. */}
            <FormGroup title="Beleg">
              <FormRow label="Datum">
                <input type="date" {...form.register('date')} className={FIELD_DATE} />
              </FormRow>
              <FormRow label="Partner">
                <input {...form.register('partner')} className={FIELD} placeholder="Name" />
              </FormRow>
              <FormRow label="Beschreibung">
                <input {...form.register('description')} className={FIELD} placeholder="Wofür?" />
              </FormRow>
            </FormGroup>

            <FormGroup
              title={watchedCurrency === 'EUR' ? 'Beträge' : `Beträge in ${watchedCurrency}`}
              footer="Netto + USt muss dem Brutto entsprechen. Gebühren stehen daneben und zählen nicht hinein."
            >
              <FormRow label="Netto">
                <input type="number" step="0.01" {...form.register('netto', { valueAsNumber: true })} className={FIELD} />
              </FormRow>
              <FormRow label="USt">
                <input type="number" step="0.01" {...form.register('ust', { valueAsNumber: true })} className={FIELD} />
              </FormRow>
              <FormRow label="Brutto">
                <input type="number" step="0.01" {...form.register('brutto', { valueAsNumber: true })} className={FIELD} />
              </FormRow>
              <FormRow label="Gebühren">
                <input type="number" min={0} step="0.01" {...form.register('fee', { valueAsNumber: true })} className={FIELD} />
              </FormRow>
              <FormRow label="Währung">
                <CurrencySelect
                  value={form.watch('currency')}
                  onChange={(v) => form.setValue('currency', v, { shouldDirty: true })}
                />
              </FormRow>
            </FormGroup>

            {watchedCurrency !== 'EUR' && (
              <CurrencyConversionHint
                brutto={form.watch('brutto') || 0}
                currency={form.watch('currency')}
                date={form.watch('date')}
              />
            )}

            <FormGroup title="Einordnung">
              <FormRow label="Typ">
                <Select value={watchedType} onValueChange={(v) => {
                  const newType = v as 'einnahme' | 'ausgabe' | 'info';
                  form.setValue('type', newType);
                  const cur = form.getValues('category');
                  if (!(getCategoriesForTypeFiltered(newType) as string[]).includes(cur)) {
                    form.setValue('category', getDefaultCategoryForType(newType));
                  }
                }}>
                  <SelectTrigger className={FIELD_SELECT}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INVOICE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Kategorie" warn={!!hasCategoryIssue}>
                <Select value={watchedCategory} onValueChange={(v) => form.setValue('category', v as Category)}>
                  <SelectTrigger className={FIELD_SELECT}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {getCategoriesForTypeFiltered(watchedType).map((c) => (
                      <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label="Projekt">
                <ProjectSelector value={projectId} onChange={setProjectId} />
              </FormRow>
            </FormGroup>

            <FormGroup title="Notiz">
              <FormFullRow>
                <input {...form.register('note')} className="w-full bg-transparent text-[17px] outline-none placeholder:text-muted-foreground" placeholder="Optionale Notiz" />
              </FormFullRow>
            </FormGroup>
            </>
            ) : (
              <>
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
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  Netto
                  {watchedCurrency !== 'EUR' && (
                    <span className="font-mono text-[10px] text-muted-foreground">({watchedCurrency})</span>
                  )}
                  <InfoTooltip text="Nettobetrag ohne Umsatzsteuer. Basis für die EÜR (Einnahmen-Überschuss-Rechnung)." side="right" />
                </Label>
                <Input type="number" step="0.01" {...form.register('netto', { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  Gebuehren
                  {watchedCurrency !== 'EUR' && (
                    <span className="font-mono text-[10px] text-muted-foreground">({watchedCurrency})</span>
                  )}
                  <InfoTooltip text="Plattformgebühren oder Transaktionskosten (z. B. PayPal-Fee). Separat gespeichert, senken aber deinen Nettoerlös." side="right" />
                </Label>
                <Input type="number" min={0} step="0.01" {...form.register('fee', { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  USt
                  {watchedCurrency !== 'EUR' && (
                    <span className="font-mono text-[10px] text-muted-foreground">({watchedCurrency})</span>
                  )}
                  <InfoTooltip text="Umsatzsteuer (MwSt.): Aufschlag auf den Nettobetrag. Als Kleinunternehmer (§ 19 UStG) 0 eintragen." side="right" />
                </Label>
                <Input type="number" step="0.01" {...form.register('ust', { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  Brutto
                  {watchedCurrency !== 'EUR' && (
                    <span className="font-mono text-[10px] text-muted-foreground">({watchedCurrency})</span>
                  )}
                  <InfoTooltip text="Gesamtbetrag inkl. USt (Netto + USt). Relevant für die Kleinunternehmergrenze (§ 19 UStG)." side="right" />
                </Label>
                <Input type="number" step="0.01" {...form.register('brutto', { valueAsNumber: true })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                Währung
                <InfoTooltip text="Währung wie auf dem Beleg. Die Beträge oben werden in dieser Währung erfasst; Auswertungen rechnen immer in Euro – umgerechnet mit dem EZB-Referenzkurs vom Belegdatum." side="right" />
              </Label>
              <CurrencySelect
                value={form.watch('currency')}
                onChange={(v) => form.setValue('currency', v, { shouldDirty: true })}
              />
            </div>
            <CurrencyConversionHint
              brutto={form.watch('brutto') || 0}
              currency={form.watch('currency')}
              date={form.watch('date')}
            />
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                Typ
                <InfoTooltip text="Einnahme = Geld erhalten. Ausgabe = Geld bezahlt. Info = neutraler Vermerk ohne Buchungswirkung." side="right" />
              </Label>
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
                <Label className={cn('flex items-center gap-1', hasCategoryIssue && 'text-amber-500 dark:text-amber-400')}>
                  {hasCategoryIssue && <AlertTriangle className="inline h-3.5 w-3.5 mr-1 mb-0.5" />}
                  Kategorie
                  <InfoTooltip text="Kategorien helfen bei der steuerlichen Einordnung. Anlagevermögen (AfA) wird über mehrere Jahre abgeschrieben. GWG &lt; 800 € netto kann sofort abgesetzt werden." side="right" />
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

              </>
            )}
            <div className="flex flex-col gap-2 pt-2">
              {invalidFields.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Nicht gespeichert – bitte prüfen: <strong>{invalidFields.join(', ')}</strong>.
                    Zahlenfelder dürfen nicht leer sein (0 eintragen).
                  </span>
                </div>
              )}
              {invoice?.is_locked && (
                <p className="rounded-lg border border-blue-300/40 bg-blue-500/5 px-3 py-2 text-xs text-blue-700 dark:text-blue-400">
                  Dieser Beleg ist festgeschrieben – Änderungen sind nur noch per Stornobuchung möglich.
                </p>
              )}
              {isMobile ? (
                <>
              {/* ── Handy: eine klare Hauptaktion, alles Weitere als Liste ──
                  Sechs Knöpfe nebeneinander waren auf dem Handy nicht mehr
                  lesbar; welcher davon der wichtige ist, sah man auch nicht. */}
              <Button
                type="submit"
                disabled={saving || invoice?.is_locked}
                className={cn('h-[50px] w-full text-[17px] font-semibold', justSaved && 'bg-emerald-600 hover:bg-emerald-600')}
              >
                {saving
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : justSaved
                    ? <Check className="mr-2 h-4 w-4" />
                    : <Save className="mr-2 h-4 w-4" />}
                {saving ? 'Speichere …' : justSaved ? 'Gespeichert' : 'Speichern'}
              </Button>

              <ListGroup className="pt-3">
                {hasPdf && (
                  <ListRow
                    tint="blue"
                    icon={<ExternalLink />}
                    label="Mit anderer App öffnen"
                    hint="PDF an eine Anzeige-App übergeben"
                    onClick={() => { void handleOpenExternal(); }}
                    noChevron
                  />
                )}
                {invoice?.type === 'einnahme' && (
                  <ListRow
                    tint="purple"
                    icon={xrechnungExporting ? <Loader2 className="animate-spin" /> : <FileCode2 />}
                    label="Als XRechnung exportieren"
                    hint="UBL 2.1 – E-Rechnungspflicht ab 2025"
                    onClick={() => { if (!xrechnungExporting) void handleXRechnungExport(); }}
                    noChevron
                  />
                )}
                {invoice?.type === 'einnahme' && !invoice?.xrechnung_path && (
                  <ListRow
                    tint="purple"
                    icon={xrechnungArchiving ? <Loader2 className="animate-spin" /> : <FileCode2 />}
                    label="E-Rechnung nachträglich archivieren"
                    hint="Noch kein XML im Archiv"
                    onClick={() => { if (!xrechnungArchiving) void handleXRechnungArchive(); }}
                    noChevron
                  />
                )}
                {!invoice?.is_locked && (
                  <ListRow
                    tint="indigo"
                    icon={<Lock />}
                    label="Festschreiben"
                    hint="Danach nur noch per Storno korrigierbar"
                    onClick={() => setConfirmLock(true)}
                    noChevron
                  />
                )}
                {!invoice?.storno_of && (
                  <ListRow
                    tint="orange"
                    icon={<Undo2 />}
                    label="Stornieren"
                    hint="Gegenbuchung erstellen"
                    onClick={() => setStornoDialogOpen(true)}
                    noChevron
                  />
                )}
                {!invoice?.is_locked && (
                  <ListRow tint="red" icon={<Trash2 />} label="Löschen" destructive onClick={() => setConfirmDelete(true)} noChevron />
                )}
              </ListGroup>
                </>
              ) : (
                <>
              {/* ── Eine Hauptaktion, der Rest im Überlaufmenü ──
                  Sechs gleich große Knöpfe nebeneinander sagten nicht mehr,
                  welcher der wichtige ist – und Festschreiben, Stornieren und
                  Löschen sind alles Dinge, die man höchstens einmal pro Beleg
                  tut. Speichern bleibt sichtbar, alles Weitere liegt eine
                  Berührung tiefer. */}
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={saving || invoice?.is_locked}
                  className={cn('flex-1', justSaved && 'bg-emerald-600 hover:bg-emerald-600')}
                >
                  {saving
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : justSaved
                      ? <Check className="mr-2 h-4 w-4" />
                      : <Save className="mr-2 h-4 w-4" />}
                  {saving ? 'Speichere …' : justSaved ? 'Gespeichert' : 'Speichern'}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="icon" title="Weitere Aktionen" aria-label="Weitere Aktionen">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    {hasPdf && (
                      <DropdownMenuItem onSelect={() => { void handleReveal(); }}>
                        <FolderOpen className="h-4 w-4" />
                        PDF im Ordner anzeigen
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onSelect={() => { void handleXRechnungExport(); }}
                      disabled={xrechnungExporting || invoice?.type !== 'einnahme'}
                    >
                      {xrechnungExporting
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <FileCode2 className="h-4 w-4" />}
                      Als XRechnung exportieren
                    </DropdownMenuItem>
                    {invoice?.type === 'einnahme' && !invoice?.xrechnung_path && (
                      <DropdownMenuItem
                        onSelect={() => { void handleXRechnungArchive(); }}
                        disabled={xrechnungArchiving}
                      >
                        {xrechnungArchiving
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <FileCode2 className="h-4 w-4" />}
                        E-Rechnung nachträglich archivieren
                      </DropdownMenuItem>
                    )}

                    {(!invoice?.is_locked || !invoice?.storno_of) && <DropdownMenuSeparator />}
                    {!invoice?.is_locked && (
                      <DropdownMenuItem onSelect={() => setConfirmLock(true)}>
                        <Lock className="h-4 w-4" />
                        Festschreiben
                      </DropdownMenuItem>
                    )}
                    {!invoice?.storno_of && (
                      <DropdownMenuItem onSelect={() => setStornoDialogOpen(true)}>
                        <Undo2 className="h-4 w-4" />
                        Stornieren
                      </DropdownMenuItem>
                    )}
                    {!invoice?.is_locked && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                          <Trash2 className="h-4 w-4" />
                          Löschen
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Die E-Rechnungspflicht ist ein echtes Versäumnis-Risiko – der
                  Hinweis darauf bleibt sichtbar, die Aktion dazu steht oben. */}
              {invoice?.type === 'einnahme' && !invoice?.xrechnung_path && (
                <p className="rounded-lg border border-violet-300/40 bg-violet-500/5 px-3 py-2 text-xs text-violet-700 dark:text-violet-400">
                  Für diesen Einnahme-Beleg liegt noch keine XRechnung im Archiv (Pflicht ab 01.01.2025).
                </p>
              )}
                </>
              )}
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

