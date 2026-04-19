import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTemplateStore } from '@/store/templateStore';
import { DesignerCanvas } from '@/components/designer/DesignerCanvas';
import { generateTemplatePdf } from '@/lib/pdfExport';
import { getSetting } from '@/lib/db';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { toast } from 'sonner';
import { FileDown, Eye, EyeOff, FileText, Plus, Trash2, ReceiptText, ArrowLeftRight, Maximize2 } from 'lucide-react';
import { format } from 'date-fns';
import type { LineItem, ItemsElement } from '@/types/template';
import { CANVAS_W, CANVAS_H } from '@/types/template';
import { SaveInvoiceDialog } from '@/components/invoices/SaveInvoiceDialog';
import { useAppStore } from '@/store';
const SETTINGS_KEYS = [
  'profile_name', 'profile_address', 'profile_email', 'profile_phone',
  'profile_tax_number', 'profile_vat_id', 'profile_iban', 'profile_bic', 'profile_business_type',
];
function newLineItemId() { return `li-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }
function emptyItem(): LineItem {
  return { id: newLineItemId(), description: '', quantity: 1, unit: 'Std.', unitPrice: 0 };
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
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(320);
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
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyItem()]);
  const [includeMwst, setIncludeMwst] = useState(!isKleinunternehmer);
  const [simpleMode, setSimpleMode] = useState(false);
  const template = templates.find((t) => t.id === selectedId) ?? null;
  const itemsEl = template?.elements.find((e) => e.type === 'items') as ItemsElement | undefined;
  const hasItemsTable = !!itemsEl;
  const mwstRate = itemsEl?.mwstRate ?? 19;
  const netto = lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const mwstAmt = includeMwst ? netto * (mwstRate / 100) : 0;
  const brutto = netto + mwstAmt;
  const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' EUR';  const addItem = () => setLineItems((p) => [...p, emptyItem()]);
  const removeItem = (id: string) => setLineItems((p) => p.filter((i) => i.id !== id));
  const updateItem = useCallback((id: string, patch: Partial<LineItem>) =>
    setLineItems((p) => p.map((i) => i.id === id ? { ...i, ...patch } : i)), []);
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
  }, [selectedId, template, settingsValues]);
  const setValue = (key: string, val: string) => setValues((v) => ({ ...v, [key]: val }));
  const exportPdf = async () => {
    if (!template) return;
    try {
      setExporting(true);
      const ab = await generateTemplatePdf(template, values, hasItemsTable ? lineItems : undefined, simpleMode);
      const suggested = (values['doc_number'] || 'Rechnung').replace(/[^a-zA-Z0-9_-]/g, '_');
      const path = await saveDialog({ defaultPath: `${suggested}.pdf`, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
      if (!path) return;
      await writeFile(path, new Uint8Array(ab));
      toast.success('PDF gespeichert!');
      // Ask user if they want to add to invoice list
      setSaveDialogPrefill({
        partner: values['receiver_name'] ?? '',
        date: values['doc_date'] ?? format(new Date(), 'dd.MM.yyyy'),
        description: values['doc_number'] ?? suggested,
        netto,
        ust: mwstAmt,
        brutto,
      });
      setSaveDialogOpen(true);
    } catch (e) {
      toast.error('Fehler: ' + String(e));
    } finally {
      setExporting(false);
    }
  };
  const settingsVars = template?.variables.filter((v) => v.settingsKey && !v.autoCalculated) ?? [];
  const manualVars = template?.variables.filter((v) => !v.settingsKey && !v.autoCalculated) ?? [];

  // Auto-populate calculated variables whenever line items or MwSt toggle changes
  useEffect(() => {
    if (!hasItemsTable) return;
    const fmtVal = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20ac';
    setValues((v) => ({
      ...v,
      netto: fmtVal(netto),
      vat_amount: includeMwst ? fmtVal(mwstAmt) : '0,00 \u20ac',
      total: fmtVal(brutto),
    }));
  }, [netto, mwstAmt, brutto, includeMwst, hasItemsTable]);
  // Ctrl+Wheel zoom
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      setFitMode('manual');
      setPreviewScale((s) => Math.min(5, Math.max(0.2, +(s * factor).toFixed(2))));
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
      if (fitMode === 'width') {
        setPreviewScale(Math.max(0.1, pw / CANVAS_W));
      } else {
        setPreviewScale(Math.max(0.1, Math.min(pw / CANVAS_W, ph / CANVAS_H)));
      }
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(container);
    return () => ro.disconnect();
  }, [fitMode, showPreview]);

  return (
    <div className="flex h-full overflow-hidden">
      <div style={{ width: sidebarWidth, minWidth: 220, maxWidth: 600 }} className="border-r border-border bg-background overflow-y-auto flex flex-col shrink-0">
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
              <SelectTrigger><SelectValue placeholder="Template waehlen..." /></SelectTrigger>
              <SelectContent>
                {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {template && (
            <>
              {manualVars.length > 0 && (
                <Card className="rounded-xl">
                  <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Dokumentdaten</CardTitle></CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    {manualVars.map((v) => (
                      <div key={v.key} className="space-y-1">
                        <Label className="text-xs">{v.label}</Label>
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
                  </CardContent>
                </Card>
              )}
              {hasItemsTable && (
                <Card className="rounded-xl">
                  <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ReceiptText className="h-4 w-4 text-primary" />
                      Positionen
                    </CardTitle>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none" title="Nur Bezeichnung & Betrag, ohne Menge/Einheit/Einzelpreis">
                        <input type="checkbox" checked={simpleMode} onChange={(e) => setSimpleMode(e.target.checked)} className="accent-primary" />
                        Einfach
                      </label>
                      <label
                        className="flex items-center gap-1.5 text-xs cursor-pointer select-none"
                        title={isKleinunternehmer ? 'Als Kleinunternehmer (§ 19 UStG) weist du keine MwSt. auf Rechnungen aus. Du kannst die Checkbox trotzdem aktivieren, falls du die Regelbesteuerung wählst.' : ''}
                      >
                        <input
                          type="checkbox"
                          checked={includeMwst}
                          onChange={(e) => setIncludeMwst(e.target.checked)}
                          className="accent-primary"
                        />
                        MwSt. ({mwstRate} %)
                        {isKleinunternehmer && !includeMwst && (
                          <span className="text-muted-foreground/70 text-[10px]">(Kleinunternehmer)</span>
                        )}
                      </label>
                    </div>
                  </CardHeader>
                  <CardContent className="px-3 pb-4 space-y-2">
                    {lineItems.map((item, idx) => (
                      <div key={item.id} className="border border-border rounded-lg p-2 bg-muted/20 relative group space-y-1.5">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground w-4 shrink-0">{idx + 1}.</span>
                          <Input value={item.description} onChange={(e) => updateItem(item.id, { description: e.target.value })}
                            placeholder="Bezeichnung" className="h-7 text-xs flex-1" />
                          {simpleMode && (
                            <Input
                              type="number" min={0} step={0.01}
                              value={item.unitPrice}
                              onChange={(e) => updateItem(item.id, { quantity: 1, unit: '', unitPrice: parseFloat(e.target.value) || 0 })}
                              placeholder="Betrag" className="h-7 text-xs text-right w-24"
                            />
                          )}
                          <button className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity shrink-0"
                            onClick={() => removeItem(item.id)} title="Entfernen">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {!simpleMode && (
                          <div className="flex gap-1 items-center pl-5">
                            <Input type="number" min={0} step={0.01} value={item.quantity}
                              onChange={(e) => updateItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                              placeholder="Menge" className="h-7 text-xs text-right w-14" />
                            <Input value={item.unit} onChange={(e) => updateItem(item.id, { unit: e.target.value })}
                              placeholder="Einh." className="h-7 text-xs w-12" />
                            <span className="text-xs text-muted-foreground">x</span>
                            <Input type="number" min={0} step={0.01} value={item.unitPrice}
                              onChange={(e) => updateItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                              placeholder="0,00" className="h-7 text-xs text-right w-20" />
                            <span className="text-[10px] text-muted-foreground ml-auto whitespace-nowrap">
                              = {fmt(item.quantity * item.unitPrice)}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1" onClick={addItem}>
                      <Plus className="h-3 w-3" /> Position hinzufuegen
                    </Button>
                    <div className="border-t border-border pt-2 space-y-1 text-xs">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Netto</span>
                        <span className="font-medium text-foreground tabular-nums">{fmt(netto)}</span>
                      </div>
                      {includeMwst && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>MwSt. ({mwstRate} %)</span>
                          <span className="font-medium text-foreground tabular-nums">{fmt(mwstAmt)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-sm border-t border-border pt-1.5">
                        <span>Gesamt</span>
                        <span className="tabular-nums">{fmt(brutto)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
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
                    <p className="text-xs text-muted-foreground">
                      Diese Werte kommen aus den Einstellungen, koennen aber hier ueberschrieben werden.
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
        <div className="p-4 border-t border-border space-y-2">
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
      <div
        onMouseDown={handleResizeStart}
        className="w-1.5 cursor-col-resize bg-border hover:bg-primary/40 transition-colors shrink-0 active:bg-primary/60"
        title="Breite anpassen"
      />
      {showPreview && (
        <div className="flex-1 overflow-auto bg-muted/20 flex flex-col">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-background shrink-0">
            <span className="text-xs text-muted-foreground">Zoom</span>
            <Button variant="outline" size="icon" className="h-7 w-7 text-xs" onClick={() => { setFitMode('manual'); setPreviewScale((s) => Math.max(0.2, +(s * 0.9).toFixed(2))); }}>-</Button>
            <input type="range" min={20} max={500} value={Math.round(previewScale * 100)}
              onChange={(e) => { setFitMode('manual'); setPreviewScale(Number(e.target.value) / 100); }}
              className="w-28 h-1.5 accent-primary" />
            <Button variant="outline" size="icon" className="h-7 w-7 text-xs" onClick={() => { setFitMode('manual'); setPreviewScale((s) => Math.min(5, +(s * 1.1).toFixed(2))); }}>+</Button>
            <span className="text-xs text-muted-foreground w-10">{Math.round(previewScale * 100)}%</span>
            <Button
              variant={(fitMode === 'width' || fitMode === 'page') ? 'default' : 'outline'}
              size="icon" className="h-7 w-7"
              title={fitMode === 'width' ? 'An Breite anpassen (aktiv) – klicken für Seite' : 'An Seite anpassen (aktiv) – klicken für Breite'}
              onClick={() => setFitMode((m) => m === 'width' ? 'page' : 'width')}
            >
              {fitMode === 'width' ? <ArrowLeftRight className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <div className="flex-1 overflow-auto p-8 select-text" ref={previewContainerRef}>
            {template ? (
              <div className="space-y-3 w-fit mx-auto">
                <p className="text-xs text-center text-muted-foreground">Vorschau (Variablen aufgeloest)</p>
                <DesignerCanvas
                  template={template}
                  selectedId={null}
                  onSelect={() => {}}
                  onUpdate={() => {}}
                  scale={previewScale}
                  variableValues={values}
                  lineItems={hasItemsTable ? lineItems : undefined}
                  includeMwst={includeMwst}
                  simpleMode={simpleMode}
                  readOnly
                />
              </div>
            ) : (
              <div className="text-muted-foreground text-sm mt-20">Template auswaehlen</div>
            )}
          </div>
        </div>
      )}
      {saveDialogOpen && saveDialogPrefill && (
        <SaveInvoiceDialog
          open={saveDialogOpen}
          onClose={() => setSaveDialogOpen(false)}
          prefill={saveDialogPrefill}
        />
      )}
    </div>
  );
}