import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useTemplateStore } from '@/store/templateStore';
import { DesignerCanvas } from '@/components/designer/DesignerCanvas';
import { generateTemplatePdf } from '@/lib/pdfExport';
import { getSetting, customers } from '@/lib/db';
import type { Customer } from '@/lib/db';
import { generateInvoiceNumber } from '@/lib/db';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { toast } from 'sonner';
import {
  FileDown, Eye, EyeOff, FileText, ArrowLeftRight,
  Maximize2, Users, Check, ChevronsUpDown, Sparkles, AlertCircle,
  AlertTriangle, Lightbulb, Wand2, QrCode, ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import type { LineItem, ItemsElement, QrCodeElement } from '@/types/template';
import { CANVAS_W, CANVAS_H } from '@/types/template';
import { SaveInvoiceDialog } from '@/components/invoices/SaveInvoiceDialog';
import { LineItemsEditor, emptyItem } from '@/components/invoices/LineItemsEditor';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';
import { checkInvoiceCompliance, improveInvoiceNote } from '@/lib/gemini';
import type { ComplianceIssue } from '@/lib/gemini';
import { generateEpcQrDataUrl } from '@/lib/epcQrCode';

const SETTINGS_KEYS = [
  'profile_name', 'profile_address', 'profile_email', 'profile_phone',
  'profile_tax_number', 'profile_w_idnr', 'profile_vat_id', 'profile_finanzamt',
  'profile_iban', 'profile_bic', 'profile_business_type',
];

function effectiveItemTotal(item: LineItem): number {
  const base = item.quantity * item.unitPrice;
  return item.discount ? base * (1 - item.discount / 100) : base;
}

export default function WriteInvoice() {
  const { templates } = useTemplateStore();
  const steuerregelung = useAppStore((s) => s.steuerregelung);
  const isKleinunternehmer = steuerregelung === 'kleinunternehmer';
  const [selectedId, setSelectedId] = useState<string>(templates[0]?.id ?? '');
  const [values, setValues] = useState<Record<string, string>>({});
  const [settingsValues, setSettingsValues] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(true);
  const [previewScale, setPreviewScale] = useState(0.65);
  const [fitMode, setFitMode] = useState<'width' | 'page' | 'manual'>('page');
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveDialogPrefill, setSaveDialogPrefill] = useState<{ partner: string; date: string; description: string; netto: number; ust: number; brutto: number } | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(360);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(360);

  // Customer picker
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Line items + discounts
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyItem()]);
  const [includeMwst, setIncludeMwst] = useState(!isKleinunternehmer);
  const [simpleMode, setSimpleMode] = useState(false);
  const [customMwstRate, setCustomMwstRate] = useState<number | null>(null);
  const [globalDiscount, setGlobalDiscount] = useState(0);

  // AI compliance
  const [complianceOpen, setComplianceOpen] = useState(false);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceResult, setComplianceResult] = useState<{ ok: boolean; issues: ComplianceIssue[]; improvedNote?: string } | null>(null);

  // EPC QR
  const [epcQrDataUrl, setEpcQrDataUrl] = useState<string | null>(null);
  const [epcQrLoading, setEpcQrLoading] = useState(false);
  const [showEpcPanel, setShowEpcPanel] = useState(false);

  // Improve dialog
  const [improveDialog, setImproveDialog] = useState<{ key: string; original: string; suggested: string } | null>(null);
  const [improvingKey, setImprovingKey] = useState<string | null>(null);

  const template = templates.find((t) => t.id === selectedId) ?? null;
  const itemsEl = template?.elements.find((e) => e.type === 'items') as ItemsElement | undefined;
  const qrEl = template?.elements.find((e) => e.type === 'qr_code') as QrCodeElement | undefined;
  const hasItemsTable = !!itemsEl;
  const mwstRate = customMwstRate ?? (itemsEl?.mwstRate ?? 19);

  const dataItems = lineItems.filter(i => !i.isGroupHeader);
  const netto = dataItems.reduce((s, i) => s + effectiveItemTotal(i), 0);
  const nettoFinal = globalDiscount > 0 ? netto * (1 - globalDiscount / 100) : netto;
  const mwstAmt = includeMwst ? nettoFinal * (mwstRate / 100) : 0;
  const brutto = nettoFinal + mwstAmt;
  const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' EUR';

  useEffect(() => {
    customers.getAll().then(setAllCustomers).catch(() => {});
  }, []);

  const filteredCustomers = allCustomers.filter((c) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.customer_number ?? '').toLowerCase().includes(customerSearch.toLowerCase())
  );

  function applyCustomer(c: Customer) {
    setSelectedCustomerId(c.id);
    setCustomerPickerOpen(false);
    setCustomerSearch('');
    const addressParts = [c.street, [c.zip, c.city].filter(Boolean).join(' ')].filter(Boolean);
    setValue('receiver_name', c.name);
    setValue('receiver_address', addressParts.join('\n'));
    if (c.payment_days) {
      const due = new Date();
      due.setDate(due.getDate() + c.payment_days);
      setValue('due_date', format(due, 'dd.MM.yyyy'));
      setValue('payment_terms', `Zahlbar innerhalb von ${c.payment_days} Tagen`);
    }
  }

  const handleResizeStart = (e: React.MouseEvent) => {
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const newW = Math.min(600, Math.max(220, startWidth.current + ev.clientX - startX.current));
      setSidebarWidth(newW);
    };
    const onUp = () => {
      isResizing.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  useEffect(() => {
    Promise.all(SETTINGS_KEYS.map(async (k) => [k, (await getSetting(k)) ?? ''] as const))
      .then((entries) => setSettingsValues(Object.fromEntries(entries)))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!template) return;
    const today = format(new Date(), 'dd.MM.yyyy');
    const initial: Record<string, string> = {};
    for (const v of template.variables) {
      if (v.settingsKey && settingsValues[v.settingsKey]) {
        initial[v.key] = settingsValues[v.settingsKey];
      } else {
        initial[v.key] = v.defaultValue || (v.key === 'doc_date' ? today : '');
      }
    }
    setValues(initial);
    setLineItems([emptyItem()]);
    setGlobalDiscount(0);
    setEpcQrDataUrl(null);
    setComplianceResult(null);
  }, [selectedId, template, settingsValues]);

  const setValue = (key: string, val: string) => setValues((v) => ({ ...v, [key]: val }));

  // Auto-populate calculated variables
  useEffect(() => {
    if (!hasItemsTable) return;
    const fmtVal = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20ac';
    setValues((v) => ({
      ...v,
      netto: fmtVal(nettoFinal),
      vat_amount: includeMwst ? fmtVal(mwstAmt) : '0,00 \u20ac',
      total: fmtVal(brutto),
    }));
  }, [netto, nettoFinal, mwstAmt, brutto, includeMwst, hasItemsTable]);

  // Ctrl+Wheel zoom
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setFitMode('manual');
      setPreviewScale((s) => Math.min(5, Math.max(0.2, +(s * (e.deltaY > 0 ? 0.9 : 1.1)).toFixed(2))));
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  // Auto-fit scale
  useEffect(() => {
    if (fitMode === 'manual') return;
    const container = previewContainerRef.current;
    if (!container) return;
    const compute = () => {
      const pw = container.clientWidth - 64;
      const ph = container.clientHeight - 64;
      setPreviewScale(Math.max(0.1, fitMode === 'width' ? pw / CANVAS_W : Math.min(pw / CANVAS_W, ph / CANVAS_H)));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(container);
    return () => ro.disconnect();
  }, [fitMode, showPreview]);

  // Suggest next invoice number
  const suggestInvoiceNumber = useCallback(async () => {
    try {
      const next = await generateInvoiceNumber('R');
      setValue('doc_number', next);
      toast.success(`Rechnungsnummer vorgeschlagen: ${next}`);
    } catch {
      toast.error('Konnte keine Rechnungsnummer generieren');
    }
  }, []);

  // AI Compliance Check
  const runComplianceCheck = useCallback(async () => {
    setComplianceLoading(true);
    setComplianceOpen(true);
    setComplianceResult(null);
    try {
      const result = await checkInvoiceCompliance({
        values, lineItems, includeMwst, mwstRate,
        netto: nettoFinal, globalDiscount, isKleinunternehmer,
      });
      setComplianceResult(result);
    } catch (e) {
      toast.error('KI-Prüfung fehlgeschlagen: ' + String(e));
      setComplianceOpen(false);
    } finally {
      setComplianceLoading(false);
    }
  }, [values, lineItems, includeMwst, mwstRate, nettoFinal, globalDiscount, isKleinunternehmer]);

  const improveNote = useCallback(async (noteKey: string) => {
    const current = values[noteKey] ?? '';
    setImprovingKey(noteKey);
    try {
      const improved = await improveInvoiceNote(current, values['receiver_name']);
      setImproveDialog({ key: noteKey, original: current, suggested: improved });
    } catch (e) {
      toast.error('KI-Verbesserung fehlgeschlagen: ' + String(e));
    } finally {
      setImprovingKey(null);
    }
  }, [values]);

  // Generate EPC QR code
  const generateEpcQr = useCallback(async () => {
    const iban = settingsValues['profile_iban'] || values['sender_iban'];
    const bic = settingsValues['profile_bic'] || values['sender_bic'] || '';
    const name = settingsValues['profile_name'] || values['sender_name'] || '';
    if (!iban) { toast.error('Keine IBAN in den Einstellungen hinterlegt'); return; }
    if (brutto <= 0) { toast.error('Bitte erst Positionen mit Preisen eingeben'); return; }
    setEpcQrLoading(true);
    try {
      const url = await generateEpcQrDataUrl(
        iban,
        bic,
        name,
        brutto,
        values['doc_number'] || 'Rechnung',
        {
          fgColor: qrEl?.fgColor,
          bgColor: qrEl?.bgColor,
        }
      );
      setEpcQrDataUrl(url);
      toast.success('EPC QR-Code generiert');
    } catch (e) {
      toast.error('QR-Code-Fehler: ' + String(e));
    } finally {
      setEpcQrLoading(false);
    }
  }, [settingsValues, values, brutto, qrEl]);

  const exportPdf = async () => {
    if (!template) return;
    if (!values['delivery_date']?.trim()) {
      toast.warning('Leistungszeitpunkt fehlt – Pflichtangabe nach § 14 Abs. 4 UStG.');
    }
    try {
      setExporting(true);
      const ab = await generateTemplatePdf(
        template, values,
        hasItemsTable ? lineItems : undefined,
        simpleMode, globalDiscount, epcQrDataUrl ?? undefined
      );
      const suggested = (values['doc_number'] || 'Rechnung').replace(/[^a-zA-Z0-9_-]/g, '_');
      const path = await saveDialog({ defaultPath: `${suggested}.pdf`, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
      if (!path) return;
      await writeFile(path, new Uint8Array(ab));
      toast.success('PDF gespeichert!');
      setSaveDialogPrefill({
        partner: values['receiver_name'] ?? '',
        date: values['doc_date'] ?? format(new Date(), 'dd.MM.yyyy'),
        description: values['doc_number'] ?? suggested,
        netto: nettoFinal, ust: mwstAmt, brutto,
      });
      setSaveDialogOpen(true);
    } catch (e) {
      toast.error('Fehler: ' + String(e));
    } finally {
      setExporting(false);
    }
  };

  const settingsVars = template?.variables.filter((v) => v.settingsKey && !v.autoCalculated) ?? [];
  const manualVars = template?.variables.filter((v) => !v.settingsKey && !v.autoCalculated && v.key !== 'delivery_date' && v.key !== 'payment_terms') ?? [];
  const complianceIssueCount = complianceResult?.issues.filter(i => i.type === 'error').length ?? 0;
  const complianceWarningCount = complianceResult?.issues.filter(i => i.type === 'warning').length ?? 0;

  return (
    <div className="flex h-full overflow-hidden">
      <div style={{ width: sidebarWidth, minWidth: 220, maxWidth: 600 }} data-tutorial="write-invoice-sidebar" className="border-r border-border bg-background overflow-y-auto flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <h2 className="font-bold text-base flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Rechnung schreiben
          </h2>
        </div>
        <div className="p-4 space-y-4 flex-1">
          <div className="space-y-1.5">
            <Label className="text-sm">Template</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger><SelectValue placeholder="Template wählen..." /></SelectTrigger>
              <SelectContent>
                {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {template && (
            <>
              {/* Customer picker */}
              {allCustomers.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-sm flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Empfänger aus Kunden wählen
                  </Label>
                  <Popover open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between text-sm font-normal h-9">
                        <span className={cn(!selectedCustomerId && 'text-muted-foreground')}>
                          {selectedCustomerId
                            ? (allCustomers.find((c) => c.id === selectedCustomerId)?.name ?? 'Kunde wählen…')
                            : 'Kunde wählen…'}
                        </span>
                        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-2" align="start">
                      <Input placeholder="Suchen…" value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="h-8 text-sm mb-2" autoFocus />
                      <div className="max-h-52 overflow-y-auto space-y-0.5">
                        {filteredCustomers.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-3">Keine Kunden gefunden</p>
                        )}
                        {filteredCustomers.map((c) => (
                          <button key={c.id}
                            className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted transition-colors text-left"
                            onClick={() => applyCustomer(c)}>
                            <Check className={cn('h-3.5 w-3.5 shrink-0', selectedCustomerId === c.id ? 'opacity-100' : 'opacity-0')} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{c.name}</p>
                              {c.customer_number && <p className="text-xs text-muted-foreground font-mono">{c.customer_number}</p>}
                            </div>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* Document data */}
              {manualVars.length > 0 && (
                <Card className="rounded-xl">
                  <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Dokumentdaten</CardTitle></CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    {manualVars.map((v) => (
                      <div key={v.key} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">{v.label}</Label>
                          {v.key === 'doc_number' && (
                            <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5 gap-1 text-primary"
                              onClick={suggestInvoiceNumber} title="Nächste fortlaufende Nummer vorschlagen">
                              <Wand2 className="h-2.5 w-2.5" /> Vorschlagen
                            </Button>
                          )}
                          {(v.key === 'notes' || v.key === 'payment_terms') && (
                            <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5 gap-1 text-primary"
                              onClick={() => improveNote(v.key)} title="Mit KI verbessern"
                              disabled={improvingKey === v.key}>
                              <Sparkles className={cn("h-2.5 w-2.5", improvingKey === v.key && "animate-spin")} />
                              {improvingKey === v.key ? 'Verbessere…' : 'Verbessern'}
                            </Button>
                          )}
                        </div>
                        {v.multiline ? (
                          <textarea value={values[v.key] ?? ''} rows={4}
                            onChange={(e) => setValue(v.key, e.target.value)}
                            className="w-full text-sm border border-border rounded px-3 py-2 bg-background resize-y min-h-20"
                            placeholder={v.label} />
                        ) : (
                          <Input value={values[v.key] ?? ''} onChange={(e) => setValue(v.key, e.target.value)}
                            placeholder={v.label} className="text-sm" />
                        )}
                      </div>
                    ))}
                    {/* Delivery date */}
                    <div className="space-y-1">
                      <Label className="text-xs">Leistungszeitpunkt *</Label>
                      <Input value={values['delivery_date'] ?? ''}
                        onChange={(e) => setValue('delivery_date', e.target.value)}
                        placeholder="z.B. März 2026 oder 01.03.2026 – 31.03.2026" className="text-sm" />
                      <p className="text-[10px] text-muted-foreground">Pflichtangabe (§ 14 Abs. 4 UStG)</p>
                    </div>
                    {/* Payment terms */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Zahlungsbedingungen</Label>
                        <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5 gap-1 text-primary"
                          onClick={() => improveNote('payment_terms')}
                          disabled={improvingKey === 'payment_terms'}>
                          <Sparkles className={cn("h-2.5 w-2.5", improvingKey === 'payment_terms' && "animate-spin")} />
                          {improvingKey === 'payment_terms' ? 'Verbessere…' : 'Verbessern'}
                        </Button>
                      </div>
                      <Input value={values['payment_terms'] ?? ''}
                        onChange={(e) => setValue('payment_terms', e.target.value)}
                        placeholder="z.B. Zahlbar innerhalb von 14 Tagen" className="text-sm" />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Line items with DnD, groups, discounts */}
              {hasItemsTable && (
                <LineItemsEditor
                  lineItems={lineItems} onChange={setLineItems}
                  simpleMode={simpleMode} onSimpleModeChange={setSimpleMode}
                  includeMwst={includeMwst} onIncludeMwstChange={setIncludeMwst}
                  mwstRate={mwstRate} onMwstRateChange={setCustomMwstRate}
                  globalDiscount={globalDiscount} onGlobalDiscountChange={setGlobalDiscount}
                  isKleinunternehmer={isKleinunternehmer}
                />
              )}

              {/* EPC QR Panel */}
              {hasItemsTable && (
                <Card className="rounded-xl">
                  <CardHeader className="py-2.5 px-4 cursor-pointer select-none" onClick={() => setShowEpcPanel(v => !v)}>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <QrCode className="h-4 w-4 text-primary" />
                        Bezahl-QR (EPC/GiroCode)
                        {epcQrDataUrl && <Badge variant="secondary" className="h-4 text-[10px] px-1.5">Aktiv</Badge>}
                      </CardTitle>
                      <ChevronRight className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', showEpcPanel && 'rotate-90')} />
                    </div>
                  </CardHeader>
                  {showEpcPanel && (
                    <CardContent className="px-4 pb-4 space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Generiert einen EPC QR-Code aus deiner IBAN und dem Bruttobetrag.
                        Der Kunde scannt ihn mit der Banking-App – alle Daten vorausgefüllt.
                      </p>
                      {settingsValues['profile_iban'] ? (
                        <div className="flex items-start gap-3">
                          {epcQrDataUrl && <img src={epcQrDataUrl} alt="EPC QR" className="w-16 h-16 border border-border rounded shrink-0" />}
                          <div className="flex-1 space-y-1.5">
                            <p className="text-xs text-muted-foreground">
                              IBAN: <span className="font-mono">{settingsValues['profile_iban'].slice(0, 8)}…</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Betrag: <span className="font-medium text-foreground">{fmt(brutto)}</span>
                            </p>
                            <Button variant={epcQrDataUrl ? 'outline' : 'default'} size="sm"
                              className="w-full h-7 text-xs gap-1"
                              onClick={generateEpcQr} disabled={epcQrLoading || brutto <= 0}>
                              <QrCode className="h-3 w-3" />
                              {epcQrLoading ? 'Generiere…' : epcQrDataUrl ? 'Aktualisieren' : 'QR-Code generieren'}
                            </Button>
                            {epcQrDataUrl && (
                              <Button variant="ghost" size="sm" className="w-full h-6 text-xs text-muted-foreground"
                                onClick={() => setEpcQrDataUrl(null)}>
                                Entfernen
                              </Button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Hinterlege deine IBAN in den <a href="/settings" className="text-primary underline">Einstellungen</a>.
                        </p>
                      )}
                    </CardContent>
                  )}
                </Card>
              )}

              {/* Sender settings */}
              {settingsVars.length > 0 && (
                <Card className="rounded-xl">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm text-muted-foreground">Absender (aus Einstellungen)</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    {settingsVars.map((v) => (
                      <div key={v.key} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{v.label}</Label>
                        <Input value={values[v.key] ?? ''} onChange={(e) => setValue(v.key, e.target.value)}
                          placeholder={v.label} className="text-xs" />
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">Überschreibbar für diese Rechnung.</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border space-y-2">
          {template && (
            <Button
              variant="outline"
              className={cn(
                'w-full text-xs gap-1.5',
                complianceResult && !complianceResult.ok && complianceIssueCount > 0 && 'border-red-300 text-red-600',
                complianceResult?.ok && 'border-green-300 text-green-600',
              )}
              onClick={complianceResult ? () => setComplianceOpen(true) : runComplianceCheck}
            >
              <Sparkles className="h-3.5 w-3.5" />
              KI-Compliance-Check
              {complianceIssueCount > 0 && (
                <Badge variant="destructive" className="h-4 min-w-4 text-[10px] px-1 ml-auto">{complianceIssueCount}</Badge>
              )}
              {complianceWarningCount > 0 && complianceIssueCount === 0 && (
                <Badge variant="secondary" className="h-4 min-w-4 text-[10px] px-1 ml-auto">{complianceWarningCount}</Badge>
              )}
              {complianceResult?.ok && complianceResult.issues.length === 0 && (
                <Check className="h-3 w-3 text-green-500 ml-auto" />
              )}
            </Button>
          )}
          <Button className="w-full" onClick={exportPdf} disabled={!template || exporting}>
            <FileDown className="mr-2 h-4 w-4" />
            {exporting ? 'Erstelle PDF...' : 'Als PDF exportieren'}
          </Button>
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setShowPreview((p) => !p)}>
            {showPreview ? <EyeOff className="mr-2 h-3.5 w-3.5" /> : <Eye className="mr-2 h-3.5 w-3.5" />}
            Vorschau {showPreview ? 'ausblenden' : 'einblenden'}
          </Button>
        </div>
      </div>

      {/* Resize Handle */}
      <div onMouseDown={handleResizeStart}
        className="w-1.5 cursor-col-resize bg-border hover:bg-primary/40 transition-colors shrink-0 active:bg-primary/60"
        title="Breite anpassen" />

      {showPreview && (
        <div className="flex-1 overflow-auto bg-muted/20 flex flex-col">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-background shrink-0">
            <span className="text-xs text-muted-foreground">Zoom</span>
            <Button variant="outline" size="icon" className="h-7 w-7 text-xs"
              onClick={() => { setFitMode('manual'); setPreviewScale((s) => Math.max(0.2, +(s * 0.9).toFixed(2))); }}>-</Button>
            <input type="range" min={20} max={500} value={Math.round(previewScale * 100)}
              onChange={(e) => { setFitMode('manual'); setPreviewScale(Number(e.target.value) / 100); }}
              className="w-28 h-1.5 accent-primary" />
            <Button variant="outline" size="icon" className="h-7 w-7 text-xs"
              onClick={() => { setFitMode('manual'); setPreviewScale((s) => Math.min(5, +(s * 1.1).toFixed(2))); }}>+</Button>
            <span className="text-xs text-muted-foreground w-10">{Math.round(previewScale * 100)}%</span>
            <Button
              variant={(fitMode === 'width' || fitMode === 'page') ? 'default' : 'outline'}
              size="icon" className="h-7 w-7"
              onClick={() => setFitMode((m) => m === 'width' ? 'page' : 'width')}
            >
              {fitMode === 'width' ? <ArrowLeftRight className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
            {epcQrDataUrl && (
              <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                <QrCode className="h-3.5 w-3.5 text-green-500" />
                <span>EPC QR aktiv</span>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-auto p-8 select-text" ref={previewContainerRef}>
            {template ? (
              <div className="space-y-3 w-fit mx-auto">
                <p className="text-xs text-center text-muted-foreground">Vorschau (Variablen aufgelöst)</p>
                <DesignerCanvas
                  template={template} selectedId={null}
                  onSelect={() => {}} onUpdate={() => {}}
                  scale={previewScale} variableValues={values}
                  lineItems={hasItemsTable ? lineItems : undefined}
                  includeMwst={includeMwst} simpleMode={simpleMode} readOnly
                  epcQrDataUrl={epcQrDataUrl ?? undefined}
                />
              </div>
            ) : (
              <div className="text-muted-foreground text-sm mt-20">Template auswählen</div>
            )}
          </div>
        </div>
      )}

      {saveDialogOpen && saveDialogPrefill && (
        <SaveInvoiceDialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} prefill={saveDialogPrefill} />
      )}

      {/* AI Compliance Dialog */}
      <Dialog open={complianceOpen} onOpenChange={setComplianceOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              KI-Compliance-Check
            </DialogTitle>
          </DialogHeader>
          {complianceLoading ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-2/3" />
              <p className="text-xs text-muted-foreground text-center mt-2">KI prüft deine Rechnung auf Pflichtangaben…</p>
            </div>
          ) : complianceResult ? (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {complianceResult.ok && complianceResult.issues.length === 0 ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 text-green-600">
                  <Check className="h-4 w-4 shrink-0" />
                  <p className="text-sm font-medium">Rechnung ist vollständig und rechtssicher ✓</p>
                </div>
              ) : (
                complianceResult.issues.map((issue, i) => (
                  <div key={i} className={cn(
                    'flex gap-2.5 p-3 rounded-lg text-sm',
                    issue.type === 'error' && 'bg-destructive/10 text-destructive',
                    issue.type === 'warning' && 'bg-orange-500/10 text-orange-600',
                    issue.type === 'tip' && 'bg-blue-500/10 text-blue-600',
                  )}>
                    {issue.type === 'error' && <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                    {issue.type === 'warning' && <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
                    {issue.type === 'tip' && <Lightbulb className="h-4 w-4 shrink-0 mt-0.5" />}
                    <div>
                      {issue.field && <p className="font-medium text-xs mb-0.5 opacity-80">{issue.field}</p>}
                      <p className="text-xs">{issue.message}</p>
                    </div>
                  </div>
                ))
              )}
              {complianceResult.improvedNote && (
                <div className="border border-primary/20 rounded-lg p-3 space-y-2 bg-primary/5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                    <Wand2 className="h-3.5 w-3.5" />
                    Vorgeschlagener Hinweistext
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{complianceResult.improvedNote}</p>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                    onClick={() => { setValue('notes', complianceResult.improvedNote!); toast.success('Hinweistext übernommen'); }}>
                    <Check className="h-3 w-3" /> Übernehmen
                  </Button>
                </div>
              )}
              <div className="pt-1 flex gap-2">
                <Button variant="outline" size="sm" className="text-xs gap-1" onClick={runComplianceCheck}>
                  <Sparkles className="h-3 w-3" /> Erneut prüfen
                </Button>
                <Button size="sm" className="text-xs ml-auto" onClick={() => setComplianceOpen(false)}>Schließen</Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Improve Note Dialog */}
      <Dialog open={!!improveDialog} onOpenChange={(open) => { if (!open) setImproveDialog(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              KI-Verbesserungsvorschlag
            </DialogTitle>
          </DialogHeader>
          {improveDialog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Original</p>
                  <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm leading-relaxed min-h-20 whitespace-pre-wrap">
                    {improveDialog.original || <span className="text-muted-foreground italic">Kein Text vorhanden</span>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide">Vorschlag</p>
                  <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm leading-relaxed min-h-20 whitespace-pre-wrap">
                    {improveDialog.suggested}
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImproveDialog(null)}>Verwerfen</Button>
            <Button onClick={() => {
              if (improveDialog) {
                setValue(improveDialog.key, improveDialog.suggested);
                toast.success('Verbesserung übernommen');
                setImproveDialog(null);
              }
            }}>
              <Check className="h-3.5 w-3.5 mr-1.5" /> Übernehmen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

