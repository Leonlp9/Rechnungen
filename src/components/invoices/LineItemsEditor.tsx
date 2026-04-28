import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  GripVertical, Trash2, Plus, FolderPlus, ReceiptText, Percent,
  BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import type { LineItem } from '@/types/template';
import { productCatalog, type CatalogItem } from '@/lib/db';
import {
  buildLineItemRenderEntries,
  getGroupDescendantIds,
  lineItemsNetTotal,
  lineItemTotal,
} from '@/lib/lineItems';

function newId() { return `li-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }

export function emptyItem(): LineItem {
  return { id: newId(), description: '', quantity: 1, unit: 'Std.', unitPrice: 0, parentGroupId: null };
}
export function emptyGroupHeader(label = 'Neue Gruppe'): LineItem {
  return { id: newId(), description: label, quantity: 0, unit: '', unitPrice: 0, isGroupHeader: true, parentGroupId: null };
}

function effectiveTotal(item: LineItem): number {
  return lineItemTotal(item);
}

function fmtLocal(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Sortable Row ─────────────────────────────────────────────────────────────

interface SortableRowProps {
  item: LineItem;
  depth: number;
  posIndex: number; // position number (skipping group headers)
  simpleMode: boolean;
  catalogItems: CatalogItem[];
  onUpdate: (id: string, patch: Partial<LineItem>) => void;
  onDelete: (id: string) => void;
  onSaveToCalog: (item: LineItem) => void;
}

function SortableRow({
  item, depth, posIndex, simpleMode, catalogItems,
  onUpdate, onDelete, onSaveToCalog,
}: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const descRef = useRef<HTMLInputElement>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const filtered = catalogItems.filter(
    (c) =>
      catalogQuery === '' ||
      c.name.toLowerCase().includes(catalogQuery.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(catalogQuery.toLowerCase()))
  );

  const applyCatalogItem = (c: CatalogItem) => {
    onUpdate(item.id, {
      description: c.name,
      unit: c.unit,
      unitPrice: c.unit_price,
    });
    setCatalogOpen(false);
    setCatalogQuery('');
    setTimeout(() => descRef.current?.focus(), 50);
  };

  const depthPad = 8 + depth * 14;

  const requestDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 2200);
      return;
    }
    onDelete(item.id);
  };

  if (item.isGroupHeader) return null;

  return (
    <div ref={setNodeRef} style={{ ...style, marginLeft: depthPad }} className="border border-border rounded-lg p-2 bg-muted/20 relative group space-y-1.5">
      <div className="flex items-center gap-1">
        <button
          className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground shrink-0"
          {...attributes} {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <span className="text-[10px] text-muted-foreground w-4 shrink-0 tabular-nums">{posIndex}.</span>

        {/* Description with catalog popover */}
        <Popover open={catalogOpen} onOpenChange={setCatalogOpen}>
          <PopoverTrigger asChild>
            <div className="flex-1 relative">
              <Input
                ref={descRef}
                value={item.description}
                onChange={(e) => {
                  onUpdate(item.id, { description: e.target.value });
                  setCatalogQuery(e.target.value);
                  if (e.target.value.length >= 2 && catalogItems.length > 0) setCatalogOpen(true);
                }}
                onFocus={() => { if (catalogItems.length > 0) { setCatalogQuery(item.description); setCatalogOpen(true); } }}
                placeholder="Bezeichnung"
                className="h-7 text-xs flex-1 pr-6"
                autoComplete="off"
              />
              {catalogItems.length > 0 && (
                <BookOpen className="h-3 w-3 absolute right-2 top-2 text-muted-foreground/40" />
              )}
            </div>
          </PopoverTrigger>
          {filtered.length > 0 && (
            <PopoverContent className="w-72 p-2" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
              <p className="text-[10px] text-muted-foreground px-1 mb-1.5 font-medium">Katalog</p>
              <div className="max-h-44 overflow-y-auto space-y-0.5">
                {filtered.slice(0, 8).map((c) => (
                  <button
                    key={c.id}
                    className="w-full flex items-start gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted transition-colors text-left"
                    onMouseDown={(e) => { e.preventDefault(); applyCatalogItem(c); }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{c.name}</p>
                      {c.description && <p className="text-muted-foreground text-[10px] truncate">{c.description}</p>}
                    </div>
                    <span className="text-muted-foreground font-mono shrink-0 text-[10px] mt-0.5">{fmtLocal(c.unit_price)} €/{c.unit}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          )}
        </Popover>

        {simpleMode && (
          <Input
            type="number" min={0} step={0.01}
            value={item.unitPrice || ''}
            onChange={(e) => onUpdate(item.id, { quantity: 1, unit: '', unitPrice: parseFloat(e.target.value) || 0 })}
            placeholder="0,00" className="h-7 text-xs text-right w-24"
          />
        )}
        <button
          className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity shrink-0"
          onClick={requestDelete}
          title="Position entfernen"
        >
          {confirmDelete ? <span className="text-[10px]">Wirklich?</span> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      {!simpleMode && (
        <div className="flex gap-1 items-center pl-5">
          <Input type="number" min={0} step={0.01} value={item.quantity || ''}
            onChange={(e) => onUpdate(item.id, { quantity: parseFloat(e.target.value) || 0 })}
            placeholder="Menge" className="h-7 text-xs text-right w-14" />
          <Input value={item.unit}
            onChange={(e) => onUpdate(item.id, { unit: e.target.value })}
            placeholder="Einh." className="h-7 text-xs w-12" />
          <span className="text-xs text-muted-foreground">×</span>
          <Input type="number" min={0} step={0.01} value={item.unitPrice || ''}
            onChange={(e) => onUpdate(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
            placeholder="0,00" className="h-7 text-xs text-right w-20" />

          {/* Discount field */}
          <div className="flex items-center gap-0.5 ml-auto">
            <Input
              type="number" min={0} max={100} step={1}
              value={item.discount || ''}
              onChange={(e) => onUpdate(item.id, { discount: parseFloat(e.target.value) || undefined })}
              placeholder="0" className="h-7 text-xs text-right w-10"
              title="Rabatt in %"
            />
            <Percent className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-[10px] text-muted-foreground ml-1 whitespace-nowrap tabular-nums">
              = {fmtLocal(effectiveTotal(item))} €
              {item.discount ? (
                <span className="ml-1 text-orange-500">(-{item.discount}%)</span>
              ) : null}
            </span>
          </div>
        </div>
      )}

      {/* Save-to-catalog hint */}
      {item.description && item.unitPrice > 0 && (
        <div className="pl-5 flex items-center">
          <button
            className="opacity-0 group-hover:opacity-60 hover:opacity-100! text-[10px] text-muted-foreground flex items-center gap-1 transition-opacity"
            onClick={() => onSaveToCalog(item)}
            title="In Katalog speichern"
          >
            <BookOpen className="h-2.5 w-2.5" />
            In Katalog speichern
          </button>
        </div>
      )}
    </div>
  );
}

function GroupSubtotalRow({
  group,
  depth,
  amount,
  onUpdate,
  onDelete,
}: {
  group: LineItem;
  depth: number;
  amount: number;
  onUpdate: (id: string, patch: Partial<LineItem>) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef: setSortableRef, transform, transition, isDragging } = useSortable({ id: group.id });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `drop-${group.id}` });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    marginLeft: 8 + depth * 14,
  };

  const requestDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 2200);
      return;
    }
    onDelete(group.id);
  };

  return (
    <div ref={setSortableRef} style={style} className="space-y-1">
      <div className="flex items-center gap-2 text-xs border border-dashed border-border rounded-md px-2 py-1.5 bg-[#f3f4f6]">
        <button
          className="cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-muted-foreground shrink-0"
          {...attributes}
          {...listeners}
          title="Gruppe verschieben"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <span className="text-muted-foreground font-medium shrink-0">∑</span>
        <Input
          value={group.description || ''}
          onChange={(e) => onUpdate(group.id, { description: e.target.value })}
          placeholder="Gruppenname"
          className="h-6 text-xs bg-transparent border-0 px-0 focus-visible:ring-0"
        />
        <span className="font-mono tabular-nums font-semibold ml-auto" style={{ color: '#7c3aed' }}>
          {fmtLocal(amount)} €
        </span>
        <button className="text-[10px] text-muted-foreground hover:text-destructive shrink-0" onClick={requestDelete} title="Gruppe entfernen">
          {confirmDelete ? 'Wirklich?' : 'Löschen'}
        </button>
      </div>
      <div
        ref={setDropRef}
        className={`rounded-md border border-dashed px-2 py-1 text-[10px] transition-colors ${
          isOver ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
        }`}
      >
        Inhalt hier hineinziehen
      </div>
    </div>
  );
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

interface LineItemsEditorProps {
  lineItems: LineItem[];
  onChange: (items: LineItem[]) => void;
  simpleMode: boolean;
  onSimpleModeChange: (v: boolean) => void;
  includeMwst: boolean;
  onIncludeMwstChange: (v: boolean) => void;
  mwstRate: number;
  onMwstRateChange: (v: number) => void;
  globalDiscount: number;
  onGlobalDiscountChange: (v: number) => void;
  isKleinunternehmer: boolean;
}

export function LineItemsEditor({
  lineItems, onChange, simpleMode, onSimpleModeChange,
  includeMwst, onIncludeMwstChange, mwstRate, onMwstRateChange,
  globalDiscount, onGlobalDiscountChange, isKleinunternehmer,
}: LineItemsEditorProps) {
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);

  useEffect(() => {
    productCatalog.getAll().then(setCatalogItems).catch(() => {});
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeItem = lineItems.find((i) => i.id === activeId);
    if (!activeItem) return;

    const targetParentId = overId.startsWith('drop-')
      ? overId.replace('drop-', '')
      : (lineItems.find((i) => i.id === overId)?.parentGroupId ?? null);

    if (activeItem.isGroupHeader && targetParentId) {
      const descendants = getGroupDescendantIds(lineItems, activeItem.id);
      if (targetParentId === activeItem.id || descendants.has(targetParentId)) {
        toast.error('Eine Gruppe kann nicht in sich selbst verschoben werden');
        return;
      }
    }

    const oldIdx = lineItems.findIndex((i) => i.id === activeId);
    if (oldIdx < 0) return;

    const next = [...lineItems];
    const [moving] = next.splice(oldIdx, 1);
    moving.parentGroupId = targetParentId;

    let insertIdx = next.length;
    if (overId.startsWith('drop-')) {
      const siblingIndexes: number[] = [];
      next.forEach((item, idx) => {
        if ((item.parentGroupId ?? null) === targetParentId) siblingIndexes.push(idx);
      });
      if (siblingIndexes.length > 0) {
        insertIdx = siblingIndexes[siblingIndexes.length - 1] + 1;
      } else if (targetParentId) {
        const parentIdx = next.findIndex((i) => i.id === targetParentId);
        insertIdx = parentIdx >= 0 ? parentIdx + 1 : next.length;
      }
    } else {
      const overIdx = next.findIndex((i) => i.id === overId);
      insertIdx = overIdx >= 0 ? overIdx : next.length;
    }

    next.splice(insertIdx, 0, moving);
    onChange(next);
  };

  const addItem = () => onChange([...lineItems, emptyItem()]);
  const addGroup = () => onChange([...lineItems, emptyGroupHeader()]);

  const removeItem = (id: string) => {
    const deleteIds = new Set([id]);
    const stack = [id];
    while (stack.length > 0) {
      const parent = stack.pop()!;
      for (const item of lineItems) {
        if ((item.parentGroupId ?? null) === parent && !deleteIds.has(item.id)) {
          deleteIds.add(item.id);
          if (item.isGroupHeader) stack.push(item.id);
        }
      }
    }
    onChange(lineItems.filter((i) => !deleteIds.has(i.id)));
  };

  const updateItem = useCallback((id: string, patch: Partial<LineItem>) =>
    onChange(lineItems.map((i) => i.id === id ? { ...i, ...patch } : i)),
    [lineItems, onChange]);

  const saveToCalog = async (item: LineItem) => {
    if (!item.description || item.unitPrice <= 0) return;
    try {
      await productCatalog.upsert({
        name: item.description,
        description: '',
        unit: item.unit,
        unit_price: item.unitPrice,
      });
      const fresh = await productCatalog.getAll();
      setCatalogItems(fresh);
      toast.success(`"${item.description}" im Katalog gespeichert`);
    } catch {
      toast.error('Fehler beim Speichern im Katalog');
    }
  };

  // Compute netto/mwst/brutto
  const netto = lineItemsNetTotal(lineItems);
  const nettoFinal = globalDiscount > 0 ? netto * (1 - globalDiscount / 100) : netto;
  const mwstAmt = includeMwst ? nettoFinal * (mwstRate / 100) : 0;
  const brutto = nettoFinal + mwstAmt;

  const renderEntries = useMemo(() => buildLineItemRenderEntries(lineItems), [lineItems]);
  const groupById = useMemo(
    () => Object.fromEntries(lineItems.filter((i) => i.isGroupHeader).map((i) => [i.id, i] as const)),
    [lineItems]
  );
  const posNumbers = useMemo(() => {
    const map: Record<string, number> = {};
    renderEntries.forEach((entry) => {
      if (entry.kind === 'item') map[entry.item.id] = entry.position;
    });
    return map;
  }, [renderEntries]);

  return (
    <Card className="rounded-xl" data-tutorial="write-invoice-items">
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <ReceiptText className="h-4 w-4 text-primary" />
          Positionen
          {lineItems.filter(i => !i.isGroupHeader).length > 0 && (
            <span className="text-xs text-muted-foreground font-normal">
              ({lineItems.filter(i => !i.isGroupHeader).length})
            </span>
          )}
        </CardTitle>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none" title="Nur Bezeichnung & Betrag">
            <input type="checkbox" checked={simpleMode} onChange={(e) => onSimpleModeChange(e.target.checked)} className="accent-primary" />
            Einfach
          </label>
          <Select value={String(mwstRate)} onValueChange={(v) => onMwstRateChange(Number(v))}>
            <SelectTrigger className="h-6 w-20 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="19">19 %</SelectItem>
              <SelectItem value="7">7 %</SelectItem>
              <SelectItem value="0">0 %</SelectItem>
            </SelectContent>
          </Select>
          <label
            className="flex items-center gap-1.5 text-xs cursor-pointer select-none"
            title={isKleinunternehmer ? 'Als Kleinunternehmer weist du keine MwSt. aus' : ''}
          >
            <input
              type="checkbox"
              checked={includeMwst}
              onChange={(e) => onIncludeMwstChange(e.target.checked)}
              className="accent-primary"
            />
            MwSt. ({mwstRate} %)
            {isKleinunternehmer && !includeMwst && (
              <span className="text-muted-foreground/70 text-[10px]">(KU)</span>
            )}
          </label>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-4 space-y-1.5">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={lineItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
            {renderEntries.map((entry) =>
              entry.kind === 'item' ? (
                <SortableRow
                  key={entry.item.id}
                  item={entry.item}
                  depth={entry.depth}
                  posIndex={posNumbers[entry.item.id] ?? 0}
                  simpleMode={simpleMode}
                  catalogItems={catalogItems}
                  onUpdate={updateItem}
                  onDelete={removeItem}
                  onSaveToCalog={saveToCalog}
                />
              ) : entry.kind === 'subtotal' ? (
                groupById[entry.groupId] ? (
                  <GroupSubtotalRow
                    key={`subtotal-${entry.groupId}`}
                    group={groupById[entry.groupId]}
                    depth={entry.depth}
                    amount={entry.amount}
                    onUpdate={updateItem}
                    onDelete={removeItem}
                  />
                ) : null
              ) : null
            )}
          </SortableContext>
        </DndContext>

        <div className="flex gap-1.5 pt-0.5">
          <Button variant="outline" size="sm" className="flex-1 h-7 text-xs gap-1" onClick={addItem}>
            <Plus className="h-3 w-3" /> Position
          </Button>
          <Button variant="outline" size="sm" className="flex-1 h-7 text-xs gap-1" onClick={addGroup}>
            <FolderPlus className="h-3 w-3" /> Gruppe
          </Button>
        </div>

        {/* Summary */}
        <div className="border-t border-border pt-2 space-y-1 text-xs">

          <div className="flex justify-between text-muted-foreground">
            <span>Netto (vor Rabatt)</span>
            <span className="font-medium text-foreground tabular-nums">{fmtLocal(netto)} €</span>
          </div>

          {/* Global discount */}
          <div className="flex justify-between items-center text-muted-foreground">
            <div className="flex items-center gap-1">
              <span>Globaler Rabatt</span>
              <div className="flex items-center gap-0.5">
                <Input
                  type="number" min={0} max={100} step={1}
                  value={globalDiscount || ''}
                  onChange={(e) => onGlobalDiscountChange(parseFloat(e.target.value) || 0)}
                  placeholder="0" className="h-5 text-xs text-right w-9 px-1"
                />
                <span className="text-[10px]">%</span>
              </div>
            </div>
            {globalDiscount > 0 && (
              <span className="font-medium text-orange-500 tabular-nums">
                −{fmtLocal(netto - nettoFinal)} €
              </span>
            )}
          </div>

          {globalDiscount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Netto (nach Rabatt)</span>
              <span className="font-medium text-foreground tabular-nums">{fmtLocal(nettoFinal)} €</span>
            </div>
          )}

          {includeMwst && (
            <div className="flex justify-between text-muted-foreground">
              <span>MwSt. ({mwstRate} %)</span>
              <span className="font-medium text-foreground tabular-nums">{fmtLocal(mwstAmt)} €</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm border-t border-border pt-1.5">
            <span>Gesamt</span>
            <span className="tabular-nums">{fmtLocal(brutto)} €</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Exported helpers for WriteInvoice
export { effectiveTotal, fmtLocal };




