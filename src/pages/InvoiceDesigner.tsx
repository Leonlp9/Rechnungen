import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useBlocker } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTemplateStore } from '@/store/templateStore';
import type { InvoiceTemplate, TemplateElement, ItemsElement, LineElement, BaseElement } from '@/types/template';
import { CANVAS_W, CANVAS_H, DEFAULT_FONT_FAMILY } from '@/types/template';
import { DesignerCanvas } from '@/components/designer/DesignerCanvas';
import { PropertiesPanel } from '@/components/designer/PropertiesPanel';
import { VariableManager } from '@/components/designer/VariableManager';
import { NewTemplateDialog } from '@/components/designer/NewTemplateDialog';
import type { AiTemplateResult } from '@/lib/gemini';
import { DEFAULT_RECHNUNG } from '@/lib/defaultTemplates';
import {
  Plus, Trash2, Copy, Type, Variable, Image, Square, Sliders, FileText, CheckSquare,
  Save, RotateCcw, RefreshCcw, Magnet, Undo2, Redo2, Table2, ArrowLeftRight, Maximize2, Minus,
} from 'lucide-react';
import { toast } from 'sonner';

function newId() { return `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function defaultTextEl(): TemplateElement {
  return { id: newId(), type: 'text', x: 100, y: 100, width: 200, height: 40, zIndex: 5, content: 'Neuer Text', fontSize: 14, fontWeight: 'normal', fontStyle: 'normal', fontFamily: DEFAULT_FONT_FAMILY, color: '#111827', backgroundColor: 'transparent', textAlign: 'left', lineHeight: 1.3 };
}
function defaultVarEl(key = ''): TemplateElement {
  return { id: newId(), type: 'variable', x: 100, y: 100, width: 200, height: 30, zIndex: 5, variableKey: key, prefix: '', suffix: '', fontSize: 12, fontWeight: 'normal', fontStyle: 'normal', fontFamily: DEFAULT_FONT_FAMILY, color: '#2563eb', backgroundColor: 'transparent', textAlign: 'left', lineHeight: 1.3 };
}
function defaultRectEl(): TemplateElement {
  return { id: newId(), type: 'rectangle', x: 100, y: 100, width: 200, height: 60, zIndex: 1, backgroundColor: '#e0e7ff', borderColor: '#6366f1', borderWidth: 1, borderRadius: 4 };
}
function defaultImgEl(): TemplateElement {
  return { id: newId(), type: 'image', x: 100, y: 100, width: 150, height: 100, zIndex: 5, src: '', objectFit: 'contain' };
}
function defaultItemsEl(): ItemsElement {
  return {
    id: newId(), type: 'items', x: 40, y: 400, width: 714, height: 200, zIndex: 5,
    fontSize: 10, rowHeight: 24,
    headerBgColor: '#1e3a5f', headerTextColor: '#ffffff',
    borderColor: '#d1d5db', altRowBgColor: '#f8fafc', summaryBgColor: '#1e3a5f',
    mwstRate: 19,
    colWidths: [0.07, 0.38, 0.1, 0.1, 0.15, 0.2],
  };
}
function defaultLineEl(): LineElement {
  return { id: newId(), type: 'line', zIndex: 3, x1: 40, y1: 300, x2: 754, y2: 300, color: '#d1d5db', thickness: 1, style: 'solid' };
}

export default function InvoiceDesigner() {
  const navigate = useNavigate();
  const { templates, addTemplate, updateTemplate, deleteTemplate, resetBuiltin } = useTemplateStore();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(templates[0]?.id ?? null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [draft, setDraft] = useState<InvoiceTemplate | null>(null);
  const draftRef = useRef<InvoiceTemplate | null>(null);

  // Keep draftRef in sync so history helpers can read current draft without setDraft side-effects
  useEffect(() => { draftRef.current = draft; }, [draft]);
  const [varManagerOpen, setVarManagerOpen] = useState(false);
  const [newTemplateDialogOpen, setNewTemplateDialogOpen] = useState(false);
  const [scale, setScale] = useState(0.65);
  const [fitMode, setFitMode] = useState<'width' | 'page' | 'manual'>('page');
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [templateListOpen, setTemplateListOpen] = useState(true);
  const [switchPending, setSwitchPending] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [propsWidth, setPropsWidth] = useState(256);
  const isResizingProps = useRef(false);
  const propsResizeStartX = useRef(0);
  const propsResizeStartW = useRef(256);
  const handlePropsResizeStart = (e: React.MouseEvent) => {
    isResizingProps.current = true;
    propsResizeStartX.current = e.clientX;
    propsResizeStartW.current = propsWidth;
    const onMove = (ev: MouseEvent) => {
      if (!isResizingProps.current) return;
      const newW = Math.min(600, Math.max(180, propsResizeStartW.current - (ev.clientX - propsResizeStartX.current)));
      setPropsWidth(newW);
    };
    const onUp = () => {
      isResizingProps.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── Undo / Redo history ─────────────────────────────────────────────
  const MAX_HISTORY = 50;
  const historyRef = useRef<InvoiceTemplate[]>([]);
  const futureRef = useRef<InvoiceTemplate[]>([]);
  const [historySize, setHistorySize] = useState(0);
  const [futureSize, setFutureSize] = useState(0);

  /** Call this BEFORE applying a draft mutation to record the current state */
  const recordHistory = useCallback(() => {
    const current = draftRef.current;
    if (!current) return;
    historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), structuredClone(current)];
    futureRef.current = [];
    setHistorySize(historyRef.current.length);
    setFutureSize(0);
  }, []);

  const undo = useCallback(() => {
    const prev = historyRef.current[historyRef.current.length - 1];
    if (!prev) return;
    historyRef.current = historyRef.current.slice(0, -1);
    const current = draftRef.current;
    if (current) futureRef.current = [structuredClone(current), ...futureRef.current].slice(0, MAX_HISTORY);
    setHistorySize(historyRef.current.length);
    setFutureSize(futureRef.current.length);
    setDraft(prev);
    setSelectedElementId(null);
  }, []);

  const redo = useCallback(() => {
    const next = futureRef.current[0];
    if (!next) return;
    futureRef.current = futureRef.current.slice(1);
    const current = draftRef.current;
    if (current) historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), structuredClone(current)];
    setHistorySize(historyRef.current.length);
    setFutureSize(futureRef.current.length);
    setDraft(next);
    setSelectedElementId(null);
  }, []);

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
    historyRef.current = [];
    futureRef.current = [];
    setHistorySize(0);
    setFutureSize(0);
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
    recordHistory();
    setDraft((d) => d ? { ...d, elements: d.elements.map((e) => e.id === el.id ? el : e) } : d);
  }, [recordHistory]);

  const deleteDraftElement = useCallback((id: string) => {
    recordHistory();
    setDraft((d) => d ? { ...d, elements: d.elements.filter((e) => e.id !== id) } : d);
    setSelectedElementId(null);
  }, [recordHistory]);

  const addDraftElement = useCallback((el: TemplateElement) => {
    recordHistory();
    setDraft((d) => d ? { ...d, elements: [...d.elements, el] } : d);
    setSelectedElementId(el.id);
  }, [recordHistory]);

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

  // ── Delete key + Undo/Redo ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA';

      // Undo: Ctrl+Z
      if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      // Redo: Ctrl+Shift+Z
      if (e.ctrlKey && e.shiftKey && e.key === 'Z') {
        e.preventDefault();
        redo();
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementId && !inInput) {
        deleteDraftElement(selectedElementId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedElementId, deleteDraftElement, undo, redo]);

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

  const createTemplateFromAI = (result: AiTemplateResult) => {
    const t: InvoiceTemplate = {
      id: `tpl-${Date.now()}`,
      name: result.name || 'KI-Template',
      templateType: 'invoice',
      isBuiltin: false,
      // Reuse the shared system variables so all variableKeys are available
      variables: DEFAULT_RECHNUNG.variables.map((v) => ({ ...v })),
      elements: result.elements,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addTemplate(t);
    setSelectedTemplateId(t.id);
    toast.success(`Template „${t.name}" wurde von der KI erstellt!`);
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

  // ── Ctrl+Wheel zoom ─────────────────────────────────────────────────
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      setFitMode('manual');
      setScale((s) => Math.min(5, Math.max(0.2, +(s * factor).toFixed(2))));
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  // ── Auto-fit scale ──────────────────────────────────────────────────
  useEffect(() => {
    if (fitMode === 'manual') return;
    const container = canvasContainerRef.current;
    if (!container) return;
    const compute = () => {
      const pw = container.clientWidth - 64;
      const ph = container.clientHeight - 64;
      if (fitMode === 'width') {
        setScale(Math.max(0.1, pw / CANVAS_W));
      } else {
        setScale(Math.max(0.1, Math.min(pw / CANVAS_W, ph / CANVAS_H)));
      }
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(container);
    return () => ro.disconnect();
  }, [fitMode]);

  return (
    <div className="flex h-full overflow-hidden bg-muted/30">
      {/* ── Left: Template list ── */}
      <div className={`${templateListOpen ? 'w-52' : 'w-8'} border-r border-border bg-background flex flex-col shrink-0 transition-all duration-200 overflow-hidden`}>
        {/* Collapse toggle */}
        <div className={`flex items-center border-b border-border shrink-0 ${templateListOpen ? 'p-3 gap-2' : 'p-1 justify-center'}`}>
          {templateListOpen && (
            <Button size="sm" className="flex-1 text-xs" onClick={() => setNewTemplateDialogOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Neues Template
            </Button>
          )}
          <button
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
            title={templateListOpen ? 'Panel zuklappen' : 'Panel aufklappen'}
            onClick={() => setTemplateListOpen(o => !o)}
          >
            {templateListOpen
              ? <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              : <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            }
          </button>
        </div>
        <div className={`flex-1 overflow-y-auto p-2 space-y-1 ${templateListOpen ? '' : 'hidden'}`}>
          {templates.map((t) => (
            <div key={t.id}
              className={`group flex items-center gap-1 rounded-lg px-2 py-2 cursor-pointer transition-colors text-xs ${selectedTemplateId === t.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}
              onClick={() => switchTemplate(t.id)}
              onDoubleClick={(e) => { e.stopPropagation(); setRenamingId(t.id); setRenameValue(t.name); }}
              onContextMenu={(e) => { e.preventDefault(); setRenamingId(t.id); setRenameValue(t.name); }}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 opacity-60" />
              {renamingId === t.id ? (
                <input
                  autoFocus
                  className="flex-1 text-xs bg-background border border-primary rounded px-1 py-0 outline-none min-w-0"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      recordHistory();
                      setDraft((d) => d && d.id === t.id ? { ...d, name: renameValue } : d);
                      setRenamingId(null);
                    }
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onBlur={() => {
                    recordHistory();
                    setDraft((d) => d && d.id === t.id ? { ...d, name: renameValue } : d);
                    setRenamingId(null);
                  }}
                />
              ) : (
                <span className="flex-1 truncate" title="Doppelklick zum Umbenennen">{t.name}</span>
              )}
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
        <div className={`p-2 border-t border-border ${templateListOpen ? '' : 'hidden'}`}>
          <Button variant="ghost" size="sm" className="w-full text-xs justify-start" onClick={() => navigate('/write-invoice')}>
            <CheckSquare className="mr-2 h-3.5 w-3.5" /> Rechnung schreiben
          </Button>
        </div>
      </div>

      {/* ── Center ── */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Ribbon Toolbar */}
        <div className="border-b border-border bg-background shrink-0 select-none">
          {draft ? (
            <div className="flex items-stretch overflow-x-auto">

              {/* ── Gruppe: Datei ── */}
              <div className="flex flex-col items-center justify-between px-3 py-1.5 border-r border-border min-w-fit gap-1">
                <div className="flex items-end gap-1">
                  {/* Save */}
                  <div className="flex flex-col items-center gap-0.5">
                    <Button
                      size="sm"
                      className={`h-10 w-14 flex-col gap-0.5 text-[10px] px-1 ${isDirty ? '' : 'opacity-60'}`}
                      onClick={save} disabled={!isDirty}
                      title="Speichern (Strg+S)"
                    >
                      <Save className="h-4 w-4" />
                      <span>{isDirty ? 'Speichern' : 'Gespeichert'}</span>
                    </Button>
                  </div>
                  {/* Discard */}
                  {isDirty && (
                    <div className="flex flex-col items-center gap-0.5">
                      <Button variant="outline" size="sm"
                        className="h-10 w-14 flex-col gap-0.5 text-[10px] px-1 text-orange-600 border-orange-300 hover:bg-orange-50"
                        onClick={discard} title="Änderungen verwerfen"
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span>Verwerfen</span>
                      </Button>
                    </div>
                  )}
                  {/* Reset Builtin */}
                  {draft.isBuiltin && (
                    <div className="flex flex-col items-center gap-0.5">
                      <Button variant="outline" size="sm"
                        className="h-10 w-16 flex-col gap-0.5 text-[10px] px-1 text-orange-600 border-orange-300 hover:bg-orange-50"
                        onClick={() => restoreBuiltin(draft.id)} title="Standard wiederherstellen"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        <span>Standard</span>
                      </Button>
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 pt-0.5">Datei</span>
              </div>

              {/* ── Gruppe: Bearbeiten ── */}
              <div className="flex flex-col items-center justify-between px-3 py-1.5 border-r border-border min-w-fit gap-1">
                <div className="flex items-end gap-1">
                  <div className="flex flex-col items-center gap-0.5">
                    <Button
                      variant="outline" size="sm"
                      className="h-10 w-12 flex-col gap-0.5 text-[10px] px-1"
                      title={`Rückgängig (Strg+Z)${historySize > 0 ? ` – ${historySize} Schritte` : ''}`}
                      disabled={historySize === 0} onClick={undo}
                    >
                      <Undo2 className="h-4 w-4" />
                      <span>Zurück</span>
                    </Button>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <Button
                      variant="outline" size="sm"
                      className="h-10 w-12 flex-col gap-0.5 text-[10px] px-1"
                      title={`Wiederholen (Strg+Shift+Z)${futureSize > 0 ? ` – ${futureSize} Schritte` : ''}`}
                      disabled={futureSize === 0} onClick={redo}
                    >
                      <Redo2 className="h-4 w-4" />
                      <span>Vor</span>
                    </Button>
                  </div>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 pt-0.5">Bearbeiten</span>
              </div>

              {/* ── Gruppe: Einfügen ── */}
              <div className="flex flex-col items-center justify-between px-3 py-1.5 border-r border-border min-w-fit gap-1">
                <div className="flex flex-col gap-1">
                  {/* Zeile 1 */}
                  <div className="flex gap-1">
                    {[
                      { icon: <Type className="h-4 w-4" />, label: 'Text', action: () => addDraftElement(defaultTextEl()) },
                      { icon: <Variable className="h-4 w-4" />, label: 'Variable', action: () => addDraftElement(defaultVarEl(draft.variables[0]?.key)) },
                      { icon: <Square className="h-4 w-4" />, label: 'Rechteck', action: () => addDraftElement(defaultRectEl()) },
                    ].map(({ icon, label, action }) => (                      <div key={label} className="flex flex-col items-center gap-0.5">
                        <Button variant="outline" size="sm"
                          className="h-10 w-14 flex-col gap-0.5 text-[10px] px-1 hover:bg-primary/10 hover:border-primary/50 hover:text-primary"
                          onClick={action}>
                          {icon}
                          <span>{label}</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                  {/* Zeile 2 */}
                  <div className="flex gap-1">
                    {[
                      { icon: <Image className="h-4 w-4" />, label: 'Bild', action: () => addDraftElement(defaultImgEl()) },
                      { icon: <Table2 className="h-4 w-4" />, label: 'Positionen', action: () => addDraftElement(defaultItemsEl()) },
                      { icon: <Minus className="h-4 w-4" />, label: 'Linie', action: () => addDraftElement(defaultLineEl()) },
                    ].map(({ icon, label, action }) => (
                      <div key={label} className="flex flex-col items-center gap-0.5">
                        <Button variant="outline" size="sm"
                          className="h-10 w-14 flex-col gap-0.5 text-[10px] px-1 hover:bg-primary/10 hover:border-primary/50 hover:text-primary"
                          onClick={action}>
                          {icon}
                          <span>{label}</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 pt-0.5">Einfügen</span>
              </div>

              {/* ── Gruppe: Variablen ── */}
              <div className="flex flex-col items-center justify-between px-3 py-1.5 border-r border-border min-w-fit gap-1">
                <div className="flex items-end gap-1">
                  <div className="flex flex-col items-center gap-0.5">
                    <Button
                      variant="outline" size="sm"
                      className="h-10 w-16 flex-col gap-0.5 text-[10px] px-1"
                      onClick={() => setVarManagerOpen(true)}
                    >
                      <Sliders className="h-4 w-4" />
                      <span>Verwalten</span>
                    </Button>
                  </div>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 pt-0.5">Variablen</span>
              </div>



            </div>
          ) : (
            <div className="px-4 py-3 text-xs text-muted-foreground">Kein Template ausgewählt</div>
          )}
        </div>

        {/* Canvas area */}
        <div className="flex-1 overflow-auto" ref={canvasContainerRef}>
          <div style={{ padding: '2rem', minWidth: 'fit-content', minHeight: 'fit-content', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
            {draft ? (
              <DesignerCanvas
                template={draft}
                selectedId={selectedElementId}
                onSelect={setSelectedElementId}
                onUpdate={updateDraftElement}
                scale={scale}
                snapEnabled={snapEnabled}
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
            {selectedElement && selectedElement.type !== 'line' && <span>Auswahl: {(selectedElement as BaseElement).x},{(selectedElement as BaseElement).y} – {(selectedElement as BaseElement).width}×{(selectedElement as BaseElement).height}px</span>}
            {selectedElement && selectedElement.type === 'line' && <span>Auswahl: Linie ({(selectedElement as LineElement).x1},{(selectedElement as LineElement).y1}) → ({(selectedElement as LineElement).x2},{(selectedElement as LineElement).y2})</span>}
            {isDirty && <span className="text-orange-500 font-medium">● Ungespeicherte Änderungen</span>}
            {/* Zoom + Snap – rechts */}
            <div className="ml-auto flex items-center gap-1.5">
              <Button
                variant={snapEnabled ? 'default' : 'outline'}
                size="icon" className="h-6 w-6"
                title={snapEnabled ? 'Snapping aktiv' : 'Snapping aus'}
                onClick={() => setSnapEnabled(s => !s)}
              >
                <Magnet className="h-3 w-3" />
              </Button>
              <div className="h-3.5 w-px bg-border" />
              <Button
                variant={(fitMode === 'width' || fitMode === 'page') ? 'default' : 'outline'}
                size="icon" className="h-6 w-6"
                title={fitMode === 'width' ? 'An Breite anpassen (aktiv) – klicken für Seite' : 'An Seite anpassen (aktiv) – klicken für Breite'}
                onClick={() => setFitMode((m) => m === 'width' ? 'page' : 'width')}
              >
                {fitMode === 'width' ? <ArrowLeftRight className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
              </Button>
              <div className="h-3.5 w-px bg-border" />
              <Button variant="ghost" size="icon" className="h-6 w-6 text-xs"
                onClick={() => { setFitMode('manual'); setScale((s) => Math.max(0.2, +(s - 0.1).toFixed(1))); }}>−</Button>
              <input type="range" min={20} max={500} value={Math.round(scale * 100)}
                onChange={(e) => { setFitMode('manual'); setScale(Number(e.target.value) / 100); }}
                className="w-24 h-1 accent-primary cursor-pointer" />
              <Button variant="ghost" size="icon" className="h-6 w-6 text-xs"
                onClick={() => { setFitMode('manual'); setScale((s) => Math.min(5, +(s + 0.1).toFixed(1))); }}>+</Button>
              <span className="w-9 text-right tabular-nums">{Math.round(scale * 100)}%</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Right: Properties ── */}
      {/* Resize Handle */}
      <div
        onMouseDown={handlePropsResizeStart}
        className="w-1.5 cursor-col-resize bg-border hover:bg-primary/40 transition-colors shrink-0 active:bg-primary/60"
        title="Breite anpassen"
      />
      <div style={{ width: propsWidth, minWidth: 180, maxWidth: 600 }} className="border-l border-border bg-background shrink-0 overflow-y-auto">
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
          onChange={(vars) => {
            recordHistory();
            setDraft((d) => d ? { ...d, variables: vars } : d);
          }}
        />
      )}

      {/* ── New Template Dialog ── */}
      <NewTemplateDialog
        open={newTemplateDialogOpen}
        onClose={() => setNewTemplateDialogOpen(false)}
        onCreateFromScratch={() => { setNewTemplateDialogOpen(false); createTemplate(); }}
        onCreateFromAI={(result) => { setNewTemplateDialogOpen(false); createTemplateFromAI(result); }}
      />

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




