import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useBlocker } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTemplateStore } from '@/store/templateStore';
import type { InvoiceTemplate, TemplateElement } from '@/types/template';
import { CANVAS_W, CANVAS_H } from '@/types/template';
import { DesignerCanvas } from '@/components/designer/DesignerCanvas';
import { PropertiesPanel } from '@/components/designer/PropertiesPanel';
import { VariableManager } from '@/components/designer/VariableManager';
import {
  Plus, Trash2, Copy, Type, Variable, Image, Square, Sliders, FileText, CheckSquare,
  Save, RotateCcw, RefreshCcw,
} from 'lucide-react';
import { toast } from 'sonner';

function newId() { return `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function defaultTextEl(): TemplateElement {
  return { id: newId(), type: 'text', x: 100, y: 100, width: 200, height: 40, zIndex: 5, content: 'Neuer Text', fontSize: 14, fontWeight: 'normal', fontStyle: 'normal', color: '#111827', backgroundColor: 'transparent', textAlign: 'left', lineHeight: 1.3 };
}
function defaultVarEl(key = ''): TemplateElement {
  return { id: newId(), type: 'variable', x: 100, y: 100, width: 200, height: 30, zIndex: 5, variableKey: key, prefix: '', suffix: '', fontSize: 12, fontWeight: 'normal', fontStyle: 'normal', color: '#2563eb', backgroundColor: 'transparent', textAlign: 'left', lineHeight: 1.3 };
}
function defaultRectEl(): TemplateElement {
  return { id: newId(), type: 'rectangle', x: 100, y: 100, width: 200, height: 60, zIndex: 1, backgroundColor: '#e0e7ff', borderColor: '#6366f1', borderWidth: 1, borderRadius: 4 };
}
function defaultImgEl(): TemplateElement {
  return { id: newId(), type: 'image', x: 100, y: 100, width: 150, height: 100, zIndex: 5, src: '', objectFit: 'contain' };
}

export default function InvoiceDesigner() {
  const navigate = useNavigate();
  const { templates, addTemplate, updateTemplate, deleteTemplate, resetBuiltin } = useTemplateStore();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(templates[0]?.id ?? null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [draft, setDraft] = useState<InvoiceTemplate | null>(null);
  const [varManagerOpen, setVarManagerOpen] = useState(false);
  const [scale, setScale] = useState(0.65);
  const [switchPending, setSwitchPending] = useState<string | null>(null); // id of template to switch to

  // Saved template from store
  const savedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;
  const isDirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(savedTemplate);

  // Block all navigation (tab switch, sidebar, browser back) when unsaved
  const blocker = useBlocker(isDirty);

  // Load draft when template selection changes
  useEffect(() => {
    const t = templates.find((x) => x.id === selectedTemplateId) ?? null;
    setDraft(t ? structuredClone(t) : null);
    setSelectedElementId(null);
  }, [selectedTemplateId]);

  // Sync draft when store changes externally (e.g. reset builtin)
  useEffect(() => {
    if (!draft || !savedTemplate) return;
    // Only sync if not dirty (avoid overwriting user edits)
    if (!isDirty) {
      setDraft(structuredClone(savedTemplate));
    }
  }, [savedTemplate]);

  const selectedElement = draft?.elements.find((e) => e.id === selectedElementId) ?? null;

  // ── Draft operations (never touch the store directly) ──────────────
  const updateDraftElement = useCallback((el: TemplateElement) => {
    setDraft((d) => d ? { ...d, elements: d.elements.map((e) => e.id === el.id ? el : e) } : d);
  }, []);

  const deleteDraftElement = useCallback((id: string) => {
    setDraft((d) => d ? { ...d, elements: d.elements.filter((e) => e.id !== id) } : d);
    setSelectedElementId(null);
  }, []);

  const addDraftElement = useCallback((el: TemplateElement) => {
    setDraft((d) => d ? { ...d, elements: [...d.elements, el] } : d);
    setSelectedElementId(el.id);
  }, []);

  // ── Save / Discard ──────────────────────────────────────────────────
  const save = () => {
    if (!draft) return;
    updateTemplate(draft.id, {
      name: draft.name,
      elements: draft.elements,
      variables: draft.variables,
      templateType: draft.templateType,
    });
    // Zustand updates are synchronous – sync draft with the freshly saved state
    // so isDirty becomes false immediately
    const fresh = useTemplateStore.getState().templates.find((t) => t.id === draft.id);
    if (fresh) setDraft(structuredClone(fresh));
    toast.success('Template gespeichert');
  };

  const discard = () => {
    if (!savedTemplate) return;
    setDraft(structuredClone(savedTemplate));
    setSelectedElementId(null);
    toast.info('Änderungen verworfen');
  };

  const restoreBuiltin = (id: string) => {
    resetBuiltin(id);
    const fresh = useTemplateStore.getState().templates.find((t) => t.id === id);
    if (fresh) setDraft(structuredClone(fresh));
    setSelectedElementId(null);
    toast.success('Standard wiederhergestellt');
  };

  // ── Delete key ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementId) {
        if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
        deleteDraftElement(selectedElementId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedElementId, deleteDraftElement]);

  // ── Template CRUD ───────────────────────────────────────────────────
  const createTemplate = () => {
    const t: InvoiceTemplate = {
      id: `tpl-${Date.now()}`, name: 'Neues Template', templateType: 'invoice',
      isBuiltin: false, variables: [], elements: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    addTemplate(t);
    setSelectedTemplateId(t.id);
  };

  const duplicateTemplate = (t: InvoiceTemplate) => {
    const copy: InvoiceTemplate = {
      ...t, id: `tpl-${Date.now()}`, name: `${t.name} (Kopie)`, isBuiltin: false,
      elements: t.elements.map((el) => ({ ...el, id: newId() })),
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    addTemplate(copy);
    setSelectedTemplateId(copy.id);
    toast.success('Template dupliziert');
  };

  const switchTemplate = (id: string) => {
    if (isDirty) {
      setSwitchPending(id);
      return;
    }
    setSelectedTemplateId(id);
  };

  return (
    <div className="flex h-full overflow-hidden bg-muted/30">
      {/* ── Left: Template list ── */}
      <div className="w-52 border-r border-border bg-background flex flex-col shrink-0">
        <div className="p-3 border-b border-border">
          <Button size="sm" className="w-full text-xs" onClick={createTemplate}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Neues Template
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {templates.map((t) => (
            <div key={t.id}
              className={`group flex items-center gap-1 rounded-lg px-2 py-2 cursor-pointer transition-colors text-xs ${selectedTemplateId === t.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}
              onClick={() => switchTemplate(t.id)}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 opacity-60" />
              <span className="flex-1 truncate">{t.name}</span>
              {selectedTemplateId === t.id && isDirty && (
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" title="Ungespeichert" />
              )}
              <span className={`text-[10px] px-1 rounded ${t.templateType === 'credit' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                {t.templateType === 'credit' ? 'G' : 'R'}
              </span>
              <div className="hidden group-hover:flex gap-0.5">
                <button className="p-0.5 hover:text-primary" title="Duplizieren" onClick={(e) => { e.stopPropagation(); duplicateTemplate(t); }}>
                  <Copy className="h-3 w-3" />
                </button>
                {!t.isBuiltin && (
                  <button className="p-0.5 hover:text-destructive" title="Löschen" onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); if (selectedTemplateId === t.id) setSelectedTemplateId(templates.find((x) => x.id !== t.id)?.id ?? null); }}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="p-2 border-t border-border">
          <Button variant="ghost" size="sm" className="w-full text-xs justify-start" onClick={() => navigate('/write-invoice')}>
            <CheckSquare className="mr-2 h-3.5 w-3.5" /> Rechnung schreiben
          </Button>
        </div>
      </div>

      {/* ── Center ── */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-2 shrink-0 flex-wrap">
          {draft ? (
            <>
              <Input
                value={draft.name}
                onChange={(e) => setDraft((d) => d ? { ...d, name: e.target.value } : d)}
                className="h-8 w-48 text-sm font-medium"
              />
              <div className="h-5 w-px bg-border" />
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => addDraftElement(defaultTextEl())}>
                <Type className="h-3.5 w-3.5" /> Text
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => addDraftElement(defaultVarEl(draft.variables[0]?.key))}>
                <Variable className="h-3.5 w-3.5" /> Variable
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => addDraftElement(defaultRectEl())}>
                <Square className="h-3.5 w-3.5" /> Rechteck
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => addDraftElement(defaultImgEl())}>
                <Image className="h-3.5 w-3.5" /> Bild
              </Button>
              <div className="h-5 w-px bg-border" />
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setVarManagerOpen(true)}>
                <Sliders className="h-3.5 w-3.5" /> Variablen
              </Button>

              <div className="ml-auto flex items-center gap-2 flex-wrap">
                {/* Builtin reset */}
                {draft.isBuiltin && (
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 text-orange-600 border-orange-300 hover:bg-orange-50"
                    onClick={() => restoreBuiltin(draft.id)}>
                    <RefreshCcw className="h-3.5 w-3.5" /> Standard wiederherstellen
                  </Button>
                )}
                {/* Save / Discard */}
                {isDirty && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={discard}>
                    <RotateCcw className="h-3.5 w-3.5" /> Verwerfen
                  </Button>
                )}
                <Button size="sm" className="h-8 text-xs gap-1.5" onClick={save} disabled={!isDirty}>
                  <Save className="h-3.5 w-3.5" /> {isDirty ? 'Speichern*' : 'Gespeichert'}
                </Button>
                <div className="h-5 w-px bg-border" />
                {/* Zoom */}
                <span className="text-xs text-muted-foreground">Zoom</span>
                <Button variant="outline" size="icon" className="h-7 w-7 text-xs" onClick={() => setScale((s) => Math.max(0.2, +(s - 0.1).toFixed(1)))}>−</Button>
                <input type="range" min={20} max={200} value={Math.round(scale * 100)}
                  onChange={(e) => setScale(Number(e.target.value) / 100)}
                  className="w-24 h-1.5 accent-primary" />
                <Button variant="outline" size="icon" className="h-7 w-7 text-xs" onClick={() => setScale((s) => Math.min(2, +(s + 0.1).toFixed(1)))}>+</Button>
                <span className="text-xs text-muted-foreground w-10">{Math.round(scale * 100)}%</span>
              </div>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Kein Template ausgewählt</span>
          )}
        </div>

        {/* Canvas area */}
        <div className="flex-1 overflow-auto">
          <div style={{ padding: '2rem', minWidth: 'fit-content', minHeight: 'fit-content', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
            {draft ? (
              <DesignerCanvas
                template={draft}
                selectedId={selectedElementId}
                onSelect={setSelectedElementId}
                onUpdate={updateDraftElement}
                scale={scale}
              />
            ) : (
              <div className="text-muted-foreground text-sm mt-20">Template auswählen oder neu erstellen</div>
            )}
          </div>
        </div>

        {/* Status bar */}
        {draft && (
          <div className="border-t border-border bg-background px-4 py-1 text-xs text-muted-foreground shrink-0 flex gap-4 items-center">
            <span>A4 – {CANVAS_W}×{CANVAS_H}px</span>
            {selectedElement && <span>Auswahl: {selectedElement.x},{selectedElement.y} – {selectedElement.width}×{selectedElement.height}px</span>}
            {isDirty && <span className="ml-auto text-orange-500 font-medium">● Ungespeicherte Änderungen</span>}
          </div>
        )}
      </div>

      {/* ── Right: Properties ── */}
      <div className="w-64 border-l border-border bg-background shrink-0 overflow-y-auto">
        <div className="p-3 border-b border-border">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Eigenschaften</span>
        </div>
        {draft && (
          <PropertiesPanel
            element={selectedElement}
            variables={draft.variables ?? []}
            onUpdate={updateDraftElement}
            onDelete={deleteDraftElement}
          />
        )}
      </div>

      {draft && (
        <VariableManager
          open={varManagerOpen}
          onClose={() => setVarManagerOpen(false)}
          variables={draft.variables ?? []}
          onChange={(vars) => setDraft((d) => d ? { ...d, variables: vars } : d)}
        />
      )}

      {/* ── Unsaved-changes blocker dialog (navigation) ── */}
      <Dialog open={blocker.state === 'blocked'} onOpenChange={() => blocker.reset?.()}>
        <DialogContent className="max-w-sm" showCloseButton={false} onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Ungespeicherte Änderungen</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Du hast ungespeicherte Änderungen am Template <span className="font-semibold text-foreground">„{draft?.name}"</span>.
            Möchtest du sie speichern oder verwerfen?
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => blocker.reset?.()}>
              Abbrechen
            </Button>
            <Button variant="outline" onClick={() => {
              discard();
              blocker.proceed?.();
            }}>
              Verwerfen & verlassen
            </Button>
            <Button onClick={() => {
              save();
              blocker.proceed?.();
            }}>
              Speichern & verlassen
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Unsaved-changes dialog (template switch) ── */}
      <Dialog open={switchPending !== null} onOpenChange={(o) => { if (!o) setSwitchPending(null); }}>
        <DialogContent className="max-w-sm" showCloseButton={false} onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Ungespeicherte Änderungen</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Du hast ungespeicherte Änderungen am Template <span className="font-semibold text-foreground">„{draft?.name}"</span>.
            Möchtest du sie speichern oder verwerfen?
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => setSwitchPending(null)}>
              Abbrechen
            </Button>
            <Button variant="outline" onClick={() => {
              discard();
              setSelectedTemplateId(switchPending);
              setSwitchPending(null);
            }}>
              Verwerfen & wechseln
            </Button>
            <Button onClick={() => {
              save();
              setSelectedTemplateId(switchPending);
              setSwitchPending(null);
            }}>
              Speichern & wechseln
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}




