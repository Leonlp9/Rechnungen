import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type {
  TemplateElement, TextElement, VariableElement, ImageElement, RectangleElement, ItemsElement,
  TemplateVariable,
} from '@/types/template';
import { Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';

interface Props {
  element: TemplateElement | null;
  variables: TemplateVariable[];
  onUpdate: (el: TemplateElement) => void;
  onDelete: (id: string) => void;
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2 items-center">
        <input type="color" value={!value || value === 'transparent' ? '#ffffff' : value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border border-border p-0.5" />
        <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => onChange('transparent')}>Transparent</Button>
      </div>
    </div>
  );
}

function NumInput({ label, value, onChange, min, max, step = 1 }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" value={value ?? 0} min={min} max={max} step={step}
        onChange={(e) => onChange(Number(e.target.value))} className="h-8 text-xs" />
    </div>
  );
}

// Sentinel – Radix Select crashes on value=""
const NONE_VAR = '__none__';

function TextVariablePanel({ element, variables, onUpdate }: {
  element: TextElement | VariableElement;
  variables: TemplateVariable[];
  onUpdate: (p: Partial<TemplateElement>) => void;
}) {
  const isVar = element.type === 'variable';
  const varEl = element as VariableElement;
  const textEl = element as TextElement;
  const varKeyValue = isVar && varEl.variableKey ? varEl.variableKey : NONE_VAR;

  return (
    <>
      {isVar && (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">Variable</Label>
            {variables.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Keine Variablen. Klick auf „Variablen" in der Toolbar.</p>
            ) : (
              <Select value={varKeyValue} onValueChange={(v) => { if (v !== NONE_VAR) onUpdate({ variableKey: v }); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Variable wählen…" /></SelectTrigger>
                <SelectContent>
                  {variables.map((v) => <SelectItem key={v.key} value={v.key}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Präfix</Label>
              <Input value={varEl.prefix || ''} onChange={(e) => onUpdate({ prefix: e.target.value })} className="h-7 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Suffix</Label>
              <Input value={varEl.suffix || ''} onChange={(e) => onUpdate({ suffix: e.target.value })} className="h-7 text-xs" />
            </div>
          </div>
        </div>
      )}
      {!isVar && (
        <div className="space-y-1">
          <Label className="text-xs">Inhalt</Label>
          <textarea value={textEl.content} rows={3}
            onChange={(e) => onUpdate({ content: e.target.value })}
            className="w-full text-xs border border-border rounded px-2 py-1 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      )}
      <NumInput label="Schriftgröße" value={element.fontSize ?? 12} onChange={(v) => onUpdate({ fontSize: v })} min={6} max={200} />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Gewicht</Label>
          <Select value={element.fontWeight || 'normal'} onValueChange={(v) => onUpdate({ fontWeight: v as 'normal' | 'bold' })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="bold">Fett</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Stil</Label>
          <Select value={element.fontStyle || 'normal'} onValueChange={(v) => onUpdate({ fontStyle: v as 'normal' | 'italic' })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="italic">Kursiv</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Ausrichtung</Label>
        <Select value={element.textAlign || 'left'} onValueChange={(v) => onUpdate({ textAlign: v as 'left' | 'center' | 'right' })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Links</SelectItem>
            <SelectItem value="center">Zentriert</SelectItem>
            <SelectItem value="right">Rechts</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <NumInput label="Zeilenabstand" value={element.lineHeight ?? 1.3} onChange={(v) => onUpdate({ lineHeight: v })} min={0.8} max={3} step={0.1} />
      <ColorInput label="Textfarbe" value={element.color || '#111827'} onChange={(v) => onUpdate({ color: v })} />
      <ColorInput label="Hintergrundfarbe" value={element.backgroundColor || 'transparent'} onChange={(v) => onUpdate({ backgroundColor: v })} />
    </>
  );
}

function RectPanel({ element, onUpdate }: { element: RectangleElement; onUpdate: (p: Partial<TemplateElement>) => void }) {
  return (
    <>
      <ColorInput label="Füllfarbe" value={element.backgroundColor || 'transparent'} onChange={(v) => onUpdate({ backgroundColor: v })} />
      <ColorInput label="Rahmenfarbe" value={element.borderColor || 'transparent'} onChange={(v) => onUpdate({ borderColor: v })} />
      <div className="grid grid-cols-2 gap-2">
        <NumInput label="Rahmenstärke" value={element.borderWidth ?? 0} onChange={(v) => onUpdate({ borderWidth: v })} min={0} />
        <NumInput label="Abrundung" value={element.borderRadius ?? 0} onChange={(v) => onUpdate({ borderRadius: v })} min={0} />
      </div>
    </>
  );
}

function ImagePanel({ element, onUpdate }: { element: ImageElement; onUpdate: (p: Partial<TemplateElement>) => void }) {
  const [loading, setLoading] = useState(false);
  const pick = async () => {
    try {
      setLoading(true);
      const path = await openDialog({ filters: [{ name: 'Bild', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }] });
      if (!path || typeof path !== 'string') return;
      const bytes = await readFile(path);
      const ext = path.split('.').pop()?.toLowerCase() ?? 'png';
      const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : `image/${ext}`;
      let bin = '';
      bytes.forEach((b) => (bin += String.fromCharCode(b)));
      onUpdate({ src: `data:${mime};base64,${btoa(bin)}` });
    } catch { /* ignore */ } finally { setLoading(false); }
  };
  return (
    <>
      <Button variant="outline" size="sm" className="w-full text-xs" onClick={pick} disabled={loading}>
        {loading ? 'Lädt…' : element.src ? 'Bild ersetzen' : 'Bild auswählen'}
      </Button>
      {element.src && <img src={element.src} alt="" className="w-full rounded border border-border max-h-24 object-contain" />}
      <div className="space-y-1">
        <Label className="text-xs">Skalierung</Label>
        <Select value={element.objectFit || 'contain'} onValueChange={(v) => onUpdate({ objectFit: v as ImageElement['objectFit'] })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="contain">Einpassen</SelectItem>
            <SelectItem value="cover">Ausfüllen</SelectItem>
            <SelectItem value="fill">Strecken</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

function ItemsPanel({ element, onUpdate }: { element: ItemsElement; onUpdate: (p: Partial<TemplateElement>) => void }) {
  const cols = element.colWidths || [0.07, 0.38, 0.1, 0.1, 0.15, 0.2];
  const colLabels = ['Pos.', 'Bezeichnung', 'Menge', 'Einheit', 'Einzelpreis', 'Gesamt'];
  return (
    <>
      <NumInput label="Schriftgröße" value={element.fontSize ?? 10} onChange={(v) => onUpdate({ fontSize: v })} min={6} max={20} />
      <NumInput label="Zeilenhöhe (px)" value={element.rowHeight ?? 24} onChange={(v) => onUpdate({ rowHeight: v })} min={16} max={60} />
      <NumInput label="MwSt-Satz (%)" value={element.mwstRate ?? 19} onChange={(v) => onUpdate({ mwstRate: v })} min={0} max={100} />
      <ColorInput label="Kopfzeile Hintergrund" value={element.headerBgColor || '#1e3a5f'} onChange={(v) => onUpdate({ headerBgColor: v })} />
      <ColorInput label="Kopfzeile Text" value={element.headerTextColor || '#ffffff'} onChange={(v) => onUpdate({ headerTextColor: v })} />
      <ColorInput label="Trennlinien" value={element.borderColor || '#d1d5db'} onChange={(v) => onUpdate({ borderColor: v })} />
      <ColorInput label="Alt.-Zeile Hintergrund" value={element.altRowBgColor || '#f8fafc'} onChange={(v) => onUpdate({ altRowBgColor: v })} />
      <ColorInput label="Summen-Zeile Hintergrund" value={element.summaryBgColor || '#1e3a5f'} onChange={(v) => onUpdate({ summaryBgColor: v })} />
      <div className="space-y-1">
        <Label className="text-xs font-medium">Spaltenbreiten (%)</Label>
        {colLabels.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs w-20 text-muted-foreground truncate">{label}</span>
            <Input
              type="number" min={1} max={80} step={1}
              value={Math.round(cols[i] * 100)}
              onChange={(e) => {
                const newCols = [...cols] as typeof cols;
                newCols[i] = Math.max(0.01, Number(e.target.value) / 100);
                onUpdate({ colWidths: newCols });
              }}
              className="h-7 text-xs w-16"
            />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function PropertiesPanel({ element, variables, onUpdate, onDelete }: Props) {
  if (!element) {
    return <div className="p-4 text-xs text-muted-foreground text-center mt-8">Element auswählen, um Eigenschaften zu bearbeiten</div>;
  }

  const patch = (p: Partial<TemplateElement>) => onUpdate({ ...element, ...p } as TemplateElement);
  const typeLabel = element.type === 'text' ? 'Text' : element.type === 'variable' ? 'Variable' : element.type === 'image' ? 'Bild' : element.type === 'items' ? 'Positionen-Tabelle' : 'Rechteck';

  return (
    <div className="p-3 space-y-4 text-sm overflow-y-auto">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">{typeLabel}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(element.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumInput label="X (px)" value={element.x} onChange={(v) => patch({ x: v })} min={0} />
        <NumInput label="Y (px)" value={element.y} onChange={(v) => patch({ y: v })} min={0} />
        <NumInput label="Breite" value={element.width} onChange={(v) => patch({ width: Math.max(1, v) })} min={1} />
        <NumInput label="Höhe" value={element.height} onChange={(v) => patch({ height: Math.max(1, v) })} min={1} />
      </div>
      <div className="flex items-center gap-2">
        <NumInput label="Ebene (z-index)" value={element.zIndex} onChange={(v) => patch({ zIndex: v })} min={0} />
        <div className="flex flex-col gap-1 mt-5">
          <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => patch({ zIndex: element.zIndex + 1 })}><ChevronUp className="h-3 w-3" /></Button>
          <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => patch({ zIndex: Math.max(0, element.zIndex - 1) })}><ChevronDown className="h-3 w-3" /></Button>
        </div>
      </div>
      {(element.type === 'text' || element.type === 'variable') && (
        <TextVariablePanel element={element as TextElement | VariableElement} variables={variables} onUpdate={patch} />
      )}
      {element.type === 'rectangle' && <RectPanel element={element as RectangleElement} onUpdate={patch} />}
      {element.type === 'image' && <ImagePanel element={element as ImageElement} onUpdate={patch} />}
      {element.type === 'items' && <ItemsPanel element={element as ItemsElement} onUpdate={patch} />}
    </div>
  );
}
