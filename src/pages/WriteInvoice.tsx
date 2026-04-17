import { useState, useEffect, useCallback } from 'react';
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
import { FileDown, Eye, EyeOff, FileText, Plus, Trash2, ReceiptText } from 'lucide-react';
import { format } from 'date-fns';
import type { LineItem, ItemsElement } from '@/types/template';
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
  const [selectedId, setSelectedId] = useState<string>(templates[0]?.id ?? '');
  const [values, setValues] = useState<Record<string, string>>({});
  const [settingsValues, setSettingsValues] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(true);
  const [previewScale, setPreviewScale] = useState(0.65);
  const [exporting, setExporting] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyItem()]);
  const [includeMwst, setIncludeMwst] = useState(true);
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
      const ab = await generateTemplatePdf(template, values, hasItemsTable ? lineItems : undefined, includeMwst);
      const suggested = (values['doc_number'] || 'Rechnung').replace(/[^a-zA-Z0-9_-]/g, '_');
      const path = await saveDialog({ defaultPath: `${suggested}.pdf`, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
      if (!path) return;
      await writeFile(path, new Uint8Array(ab));
      toast.success('PDF gespeichert!');
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
  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-80 border-r border-border bg-background overflow-y-auto flex flex-col shrink-0">
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
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                      <input type="checkbox" checked={includeMwst} onChange={(e) => setIncludeMwst(e.target.checked)} className="accent-primary" />
                      MwSt. ({mwstRate} %)
                    </label>
                  </CardHeader>
                  <CardContent className="px-3 pb-4 space-y-2">
                    {lineItems.map((item, idx) => (
                      <div key={item.id} className="border border-border rounded-lg p-2 bg-muted/20 relative group space-y-1.5">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground w-4 shrink-0">{idx + 1}.</span>
                          <Input value={item.description} onChange={(e) => updateItem(item.id, { description: e.target.value })}
                            placeholder="Bezeichnung" className="h-7 text-xs flex-1" />
                          <button className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity shrink-0"
                            onClick={() => removeItem(item.id)} title="Entfernen">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
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
      {showPreview && (
        <div className="flex-1 overflow-auto bg-muted/20 flex flex-col">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-background shrink-0">
            <span className="text-xs text-muted-foreground">Zoom</span>
            <Button variant="outline" size="icon" className="h-7 w-7 text-xs" onClick={() => setPreviewScale((s) => Math.max(0.2, +(s - 0.1).toFixed(1)))}>-</Button>
            <input type="range" min={20} max={200} value={Math.round(previewScale * 100)}
              onChange={(e) => setPreviewScale(Number(e.target.value) / 100)}
              className="w-28 h-1.5 accent-primary" />
            <Button variant="outline" size="icon" className="h-7 w-7 text-xs" onClick={() => setPreviewScale((s) => Math.min(2, +(s + 0.1).toFixed(1)))}>+</Button>
            <span className="text-xs text-muted-foreground w-10">{Math.round(previewScale * 100)}%</span>
          </div>
          <div className="flex-1 overflow-auto p-8">
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
                  readOnly
                />
              </div>
            ) : (
              <div className="text-muted-foreground text-sm mt-20">Template auswaehlen</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}