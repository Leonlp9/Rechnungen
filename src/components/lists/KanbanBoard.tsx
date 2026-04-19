import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  DndContext,
  DragOverlay,
  rectIntersection,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { KanbanListData, KanbanCard, KanbanColumn } from '@/store/listsStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, GripVertical, X, Pencil, Check, ImageIcon, XCircle } from 'lucide-react';
import { ImageLightbox } from './ImageLightbox';
import { ConfirmDialog } from './ConfirmDialog';

const COLUMN_COLORS = [
  '#6b7280', '#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4',
];

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Single Card ──────────────────────────────────────────────────────────────
interface CardProps {
  card: KanbanCard;
  onDelete: () => void;
  onUpdate: (card: KanbanCard) => void;
  overlay?: boolean;
}

function KanbanCardItem({ card, onDelete, onUpdate, overlay }: CardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', card },
  });
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(card.title);
  const [editDesc, setEditDesc] = useState(card.description ?? '');
  const [editImages, setEditImages] = useState<string[]>(card.images ?? []);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const [lightbox, setLightbox] = useState<{ src: string; id: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const saveEdit = () => {
    onUpdate({ ...card, title: editTitle.trim() || card.title, description: editDesc.trim() || undefined, images: editImages.length ? editImages : undefined });
    setEditing(false);
  };

  const startEdit = () => {
    setEditTitle(card.title);
    setEditDesc(card.description ?? '');
    setEditImages(card.images ?? []);
    setEditing(true);
  };

  const handleImgFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const src = await readImageFile(file);
    setEditImages((prev) => [...prev, src]);
    e.target.value = '';
  };

  const handleEditPaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imgItem = items.find((it) => it.type.startsWith('image/'));
    if (!imgItem) return;
    e.preventDefault();
    const file = imgItem.getAsFile();
    if (!file) return;
    const src = await readImageFile(file);
    setEditImages((prev) => [...prev, src]);
  };

  return (
    <>
    <div
      ref={setNodeRef}
      style={overlay ? {} : style}
      className={`group rounded-lg border bg-background shadow-sm p-3 mb-2 cursor-default select-none ${overlay ? 'shadow-xl ring-2 ring-primary/40 rotate-2' : ''}`}
    >
      {editing ? (
        <div className="space-y-1.5" onPaste={handleEditPaste}>
          <Input
            autoFocus
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="h-7 text-xs"
            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false); }}
          />
          <Input
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            className="h-7 text-xs"
            placeholder="Beschreibung…"
            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false); }}
          />
          {/* Image previews */}
          {editImages.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {editImages.map((src, i) => (
                <div key={i} className="relative group/img">
                  <img src={src} alt="" className="h-16 w-16 object-cover rounded border" />
                  <button
                    className="absolute -top-1 -right-1 text-destructive bg-background rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity"
                    onClick={() => setEditImages((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-1 justify-between items-center">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              onClick={() => imgInputRef.current?.click()}
            >
              <ImageIcon className="h-3.5 w-3.5" /> Bild
            </button>
            <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={handleImgFile} />
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setEditing(false)}><X className="h-3 w-3" /></Button>
              <Button size="sm" className="h-6 px-2 text-xs" onClick={saveEdit}><Check className="h-3 w-3" /></Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <div
            {...attributes}
            {...listeners}
            className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground shrink-0"
          >
            <GripVertical className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{card.title}</p>
            {card.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{card.description}</p>}
            {card.images && card.images.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {card.images.map((src, i) => {
                  const lid = `kanban-img-${card.id}-${i}`;
                  return (
                    <motion.img
                      key={i}
                      layoutId={lid}
                      src={src}
                      alt=""
                      className="h-14 w-14 object-cover rounded border cursor-zoom-in hover:brightness-110 transition-all"
                      onClick={() => setLightbox({ src, id: lid })}
                    />
                  );
                })}
              </div>
            )}
          </div>
          <div className="hidden group-hover:flex gap-0.5 shrink-0">
            <button onClick={startEdit} className="p-0.5 text-muted-foreground hover:text-primary">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setConfirmDel(true)} className="p-0.5 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
    <ImageLightbox
      src={lightbox?.src ?? null}
      layoutId={lightbox?.id ?? null}
      onClose={() => setLightbox(null)}
    />
    <ConfirmDialog
      open={confirmDel}
      title="Karte löschen?"
      description="Diese Karte wirklich unwiderruflich löschen?"
      onConfirm={() => { setConfirmDel(false); onDelete(); }}
      onCancel={() => setConfirmDel(false)}
    />
    </>
  );
}

// ── Column ───────────────────────────────────────────────────────
interface ColumnProps {
  column: KanbanColumn;
  cards: KanbanCard[];
  onAddCard: () => void;
  onDeleteCard: (cardId: string) => void;
  onUpdateCard: (card: KanbanCard) => void;
  onDeleteColumn: () => void;
  onRenameColumn: (title: string) => void;
  onColorColumn: (color: string) => void;
}

function KanbanColumnItem({
  column, cards, onAddCard, onDeleteCard, onUpdateCard, onDeleteColumn, onRenameColumn, onColorColumn
}: ColumnProps) {
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(column.title);
  const [showColors, setShowColors] = useState(false);
  const [confirmDelCol, setConfirmDelCol] = useState(false);

  const { setNodeRef: setSortableRef } = useSortable({ id: column.id, data: { type: 'column' } });
  // Extra droppable so empty columns are always a valid drop target
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: column.id });

  const setRef = (el: HTMLDivElement | null) => {
    setSortableRef(el);
    setDropRef(el);
  };

  return (
    <div
      ref={setRef}
      className={`flex flex-col rounded-xl border border-border bg-muted/40 w-72 shrink-0 h-full transition-colors ${isOver ? 'ring-2 ring-primary/50 bg-primary/5' : ''}`}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <div
          className="w-3 h-3 rounded-full shrink-0 cursor-pointer"
          style={{ background: column.color }}
          onClick={() => setShowColors((v) => !v)}
          title="Farbe ändern"
        />
        {showColors && (
          <div className="absolute z-50 mt-6 flex gap-1 bg-background border border-border rounded-lg p-2 shadow-lg flex-wrap w-40">
            {COLUMN_COLORS.map((c) => (
              <button
                key={c}
                className="w-6 h-6 rounded-full border-2 border-transparent hover:border-primary transition-all"
                style={{ background: c }}
                onClick={() => { onColorColumn(c); setShowColors(false); }}
              />
            ))}
          </div>
        )}
        {renaming ? (
          <Input
            autoFocus
            value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            className="h-6 text-xs flex-1 py-0"
            onKeyDown={(e) => {
              if (e.key === 'Enter') { onRenameColumn(renameVal.trim() || column.title); setRenaming(false); }
              if (e.key === 'Escape') setRenaming(false);
            }}
            onBlur={() => { onRenameColumn(renameVal.trim() || column.title); setRenaming(false); }}
          />
        ) : (
          <button
            className="flex-1 text-left text-sm font-semibold truncate hover:text-primary transition-colors"
            onDoubleClick={() => { setRenameVal(column.title); setRenaming(true); }}
            title="Doppelklick zum Umbenennen"
          >
            {column.title}
          </button>
        )}
        <span className="text-xs text-muted-foreground shrink-0">{cards.length}</span>
        <button onClick={() => setConfirmDelCol(true)} className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-0.5">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Cards */}
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 p-3 overflow-y-auto" style={{ minHeight: 60 }}>
          {cards.map((card) => (
            <KanbanCardItem
              key={card.id}
              card={card}
              onDelete={() => onDeleteCard(card.id)}
              onUpdate={onUpdateCard}
            />
          ))}
        </div>
      </SortableContext>

      {/* Add card */}
      <div className="p-2 border-t border-border">
        <button
          onClick={onAddCard}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-full px-2 py-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Karte hinzufügen
        </button>
      </div>
      <ConfirmDialog
        open={confirmDelCol}
        title="Spalte löschen?"
        description={`Spalte „${column.title}" mit allen ${cards.length} Karte(n) wirklich löschen?`}
        onConfirm={() => { setConfirmDelCol(false); onDeleteColumn(); }}
        onCancel={() => setConfirmDelCol(false)}
      />
    </div>
  );
}

// ── Board ────────────────────────────────────────────────────────────────────
interface Props {
  data: KanbanListData;
  onChange: (data: KanbanListData) => void;
  listName: string;
}

export function KanbanBoard({ data, onChange, listName }: Props) {
  const [activeCard, setActiveCard] = useState<KanbanCard | null>(null);
  // Always-fresh ref so drag handlers never see stale closures
  const dataRef = useRef(data);
  dataRef.current = data;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const findColOfCard = useCallback((cardId: string) =>
    dataRef.current.columns.find((col) => col.cards.some((c) => c.id === cardId)),
  []);

  const findColById = useCallback((colId: string) =>
    dataRef.current.columns.find((c) => c.id === colId),
  []);

  const addColumn = () => {
    const col: KanbanColumn = {
      id: `col-${Date.now()}`,
      title: 'Neue Spalte',
      color: COLUMN_COLORS[dataRef.current.columns.length % COLUMN_COLORS.length],
      cards: [],
    };
    onChange({ columns: [...dataRef.current.columns, col] });
  };

  const deleteColumn = (colId: string) => {
    onChange({ columns: dataRef.current.columns.filter((c) => c.id !== colId) });
  };

  const renameColumn = (colId: string, title: string) => {
    onChange({ columns: dataRef.current.columns.map((c) => (c.id === colId ? { ...c, title } : c)) });
  };

  const colorColumn = (colId: string, color: string) => {
    onChange({ columns: dataRef.current.columns.map((c) => (c.id === colId ? { ...c, color } : c)) });
  };

  const addCard = (colId: string) => {
    const card: KanbanCard = { id: `card-${Date.now()}`, title: 'Neue Karte' };
    onChange({
      columns: dataRef.current.columns.map((c) =>
        c.id === colId ? { ...c, cards: [...c.cards, card] } : c
      ),
    });
  };

  const deleteCard = (colId: string, cardId: string) => {
    onChange({
      columns: dataRef.current.columns.map((c) =>
        c.id === colId ? { ...c, cards: c.cards.filter((k) => k.id !== cardId) } : c
      ),
    });
  };

  const updateCard = (colId: string, card: KanbanCard) => {
    onChange({
      columns: dataRef.current.columns.map((c) =>
        c.id === colId ? { ...c, cards: c.cards.map((k) => (k.id === card.id ? card : k)) } : c
      ),
    });
  };

  const onDragStart = (e: DragStartEvent) => {
    const card = e.active.data.current?.card as KanbanCard | undefined;
    if (card) setActiveCard(card);
  };

  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const activeCol = findColOfCard(active.id as string);
    if (!activeCol) return;

    // Resolve target column: over a card → its column, over a column → that column
    const overCol =
      findColOfCard(over.id as string) ??
      findColById(over.id as string);

    if (!overCol || overCol.id === activeCol.id) return;

    const card = activeCol.cards.find((c) => c.id === active.id)!;
    // Insert at the position of the hovered card, or append if hovering the column itself
    const overCardIdx = overCol.cards.findIndex((c) => c.id === over.id);
    const insertIdx = overCardIdx >= 0 ? overCardIdx : overCol.cards.length;

    onChange({
      columns: dataRef.current.columns.map((c) => {
        if (c.id === activeCol.id) return { ...c, cards: c.cards.filter((k) => k.id !== card.id) };
        if (c.id === overCol.id) {
          const newCards = [...c.cards];
          newCards.splice(insertIdx, 0, card);
          return { ...c, cards: newCards };
        }
        return c;
      }),
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const activeCol = findColOfCard(active.id as string);
    const overCol =
      findColOfCard(over.id as string) ??
      findColById(over.id as string);

    if (!activeCol || !overCol || activeCol.id !== overCol.id) return;

    const oldIdx = activeCol.cards.findIndex((c) => c.id === active.id);
    const newIdx = activeCol.cards.findIndex((c) => c.id === over.id);
    if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return;

    onChange({
      columns: dataRef.current.columns.map((c) =>
        c.id === activeCol.id ? { ...c, cards: arrayMove(c.cards, oldIdx, newIdx) } : c
      ),
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border px-6 py-4 shrink-0 flex items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold">{listName}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {data.columns.length} Spalten · {data.columns.reduce((a, c) => a + c.cards.length, 0)} Karten
          </p>
        </div>
        <Button size="sm" variant="outline" className="ml-auto" onClick={addColumn}>
          <Plus className="h-4 w-4 mr-1" /> Spalte hinzufügen
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
          <div className="flex gap-4 h-full">
            {data.columns.map((col) => (
              <KanbanColumnItem
                key={col.id}
                column={col}
                cards={col.cards}
                onAddCard={() => addCard(col.id)}
                onDeleteCard={(cardId) => deleteCard(col.id, cardId)}
                onUpdateCard={(card) => updateCard(col.id, card)}
                onDeleteColumn={() => deleteColumn(col.id)}
                onRenameColumn={(title) => renameColumn(col.id, title)}
                onColorColumn={(color) => colorColumn(col.id, color)}
              />
            ))}
            {data.columns.length === 0 && (
              <div className="text-muted-foreground text-sm mt-10 mx-auto">
                Noch keine Spalten. Füge eine hinzu!
              </div>
            )}
          </div>
        </div>
        <DragOverlay>
          {activeCard && (
            <KanbanCardItem
              card={activeCard}
              onDelete={() => {}}
              onUpdate={() => {}}
              overlay
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}





