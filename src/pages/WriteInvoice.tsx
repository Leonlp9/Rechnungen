import { useState, useEffect } from 'react';
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
import { FileDown, Eye, EyeOff, FileText } from 'lucide-react';
import { format } from 'date-fns';

const SETTINGS_KEYS = [
  'profile_name', 'profile_address', 'profile_email', 'profile_phone',
  'profile_tax_number', 'profile_vat_id', 'profile_iban', 'profile_bic', 'profile_business_type',
];

export default function WriteInvoice() {
  const { templates } = useTemplateStore();
  const [selectedId, setSelectedId] = useState<string>(templates[0]?.id ?? '');
  const [values, setValues] = useState<Record<string, string>>({});
  const [settingsValues, setSettingsValues] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(true);
  const [previewScale, setPreviewScale] = useState(0.65);
  const [exporting, setExporting] = useState(false);

  const template = templates.find((t) => t.id === selectedId) ?? null;

  // Load settings values
  useEffect(() => {
    Promise.all(SETTINGS_KEYS.map(async (k) => [k, (await getSetting(k)) ?? ''] as const))
      .then((entries) => setSettingsValues(Object.fromEntries(entries)))
      .catch(console.error);
  }, []);

  // Initialize/reset values when template changes
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
  }, [selectedId, template, settingsValues]);

  const setValue = (key: string, val: string) => setValues((v) => ({ ...v, [key]: val }));

  const exportPdf = async () => {
    if (!template) return;
    try {
      setExporting(true);
      const ab = await generateTemplatePdf(template, values);
      const suggested = (values['doc_number'] || 'Rechnung').replace(/[^a-zA-Z0-9_-]/g, '_');
      const path = await saveDialog({
        defaultPath: `${suggested}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (!path) return;
      await writeFile(path, new Uint8Array(ab));
      toast.success('PDF gespeichert!');
    } catch (e) {
      toast.error('Fehler: ' + String(e));
    } finally {
      setExporting(false);
    }
  };

  // Split variables into settings-prefilled and manual
  const settingsVars = template?.variables.filter((v) => v.settingsKey) ?? [];
  const manualVars = template?.variables.filter((v) => !v.settingsKey) ?? [];

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left form ── */}
      <div className="w-80 border-r border-border bg-background overflow-y-auto flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <h2 className="font-bold text-base flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Rechnung schreiben
          </h2>
        </div>

        <div className="p-4 space-y-4 flex-1">
          {/* Template selector */}
          <div className="space-y-1.5">
            <Label className="text-sm">Template</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger><SelectValue placeholder="Template wählen..." /></SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {template && (
            <>
              {/* Manual variables */}
              {manualVars.length > 0 && (
                <Card className="rounded-xl">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm">Dokumentdaten</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    {manualVars.map((v) => (
                      <div key={v.key} className="space-y-1">
                        <Label className="text-xs">{v.label}</Label>
                        {v.multiline ? (
                          <textarea
                            value={values[v.key] ?? ''}
                            rows={4}
                            onChange={(e) => setValue(v.key, e.target.value)}
                            className="w-full text-sm border border-border rounded px-3 py-2 bg-background resize-y min-h-[80px]"
                            placeholder={v.label}
                          />
                        ) : (
                          <Input
                            value={values[v.key] ?? ''}
                            onChange={(e) => setValue(v.key, e.target.value)}
                            placeholder={v.label}
                            className="text-sm"
                          />
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Settings variables (collapsible) */}
              {settingsVars.length > 0 && (
                <Card className="rounded-xl">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm text-muted-foreground">Absender (aus Einstellungen)</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    {settingsVars.map((v) => (
                      <div key={v.key} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{v.label}</Label>
                        <Input
                          value={values[v.key] ?? ''}
                          onChange={(e) => setValue(v.key, e.target.value)}
                          placeholder={v.label}
                          className="text-xs"
                        />
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                      Diese Werte kommen aus den Einstellungen, können aber hier überschrieben werden.
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t border-border space-y-2">
          <Button
            className="w-full"
            onClick={exportPdf}
            disabled={!template || exporting}
          >
            <FileDown className="mr-2 h-4 w-4" />
            {exporting ? 'Erstelle PDF...' : 'Als PDF exportieren'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => setShowPreview((p) => !p)}
          >
            {showPreview ? <EyeOff className="mr-2 h-3.5 w-3.5" /> : <Eye className="mr-2 h-3.5 w-3.5" />}
            Vorschau {showPreview ? 'ausblenden' : 'einblenden'}
          </Button>
        </div>
      </div>

      {/* ── Right preview ── */}
      {showPreview && (
        <div className="flex-1 overflow-auto bg-muted/20 flex flex-col">
          {/* Zoom toolbar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-background shrink-0">
            <span className="text-xs text-muted-foreground">Zoom</span>
            <Button variant="outline" size="icon" className="h-7 w-7 text-xs" onClick={() => setPreviewScale((s) => Math.max(0.2, +(s - 0.1).toFixed(1)))}>−</Button>
            <input type="range" min={20} max={200} value={Math.round(previewScale * 100)}
              onChange={(e) => setPreviewScale(Number(e.target.value) / 100)}
              className="w-28 h-1.5 accent-primary" />
            <Button variant="outline" size="icon" className="h-7 w-7 text-xs" onClick={() => setPreviewScale((s) => Math.min(2, +(s + 0.1).toFixed(1)))}>+</Button>
            <span className="text-xs text-muted-foreground w-10">{Math.round(previewScale * 100)}%</span>
          </div>
          <div className="flex-1 overflow-auto p-8 flex justify-center items-start">
            {template ? (
              <div className="space-y-3">
                <p className="text-xs text-center text-muted-foreground">Vorschau (Variablen aufgelöst)</p>
                <DesignerCanvas
                  template={template}
                  selectedId={null}
                  onSelect={() => {}}
                  onUpdate={() => {}}
                  scale={previewScale}
                  variableValues={values}
                  readOnly
                />
              </div>
            ) : (
              <div className="text-muted-foreground text-sm mt-20">Template auswählen</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}



