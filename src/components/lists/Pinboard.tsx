import { useState, useRef, useCallback } from 'react';
import type { PinboardData, PinItem } from '@/store/listsStore';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, StickyNote, GripHorizontal } from 'lucide-react';

const NOTE_COLORS = [
  '#fef9c3', '#dcfce7', '#dbeafe', '#fce7f3', '#ede9fe', '#fed7aa', '#ffffff',
];

function newId() {
  return `pin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface Props {
  data: PinboardData;
  onChange: (data: PinboardData) => void;
  listName: string;
}

export function Pinboard({ data, onChange, listName }: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);

  const updateItem = (item: PinItem) => {
    onChange({ ...data, items: data.items.map((i) => (i.id === item.id ? item : i)) });
  };

  const deleteItem = (id: string) => {
    onChange({ ...data, items: data.items.filter((i) => i.id !== id) });
  };

  const addNote = () => {
    const item: PinItem = {
      id: newId(),
      x: Math.max(0, -data.offsetX + 60),
      y: Math.max(0, -data.offsetY + 60),
      width: 200,
      height: 160,
      content: '',
      color: NOTE_COLORS[data.items.length % NOTE_COLORS.length],
      type: 'note',
    };
    onChange({ ...data, items: [...data.items, item] });
    setEditingId(item.id);
  };

  // Pan board with middle-click or space+drag
  const onBoardMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 1 && !e.altKey) return;
      e.preventDefault();
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, ox: data.offsetX, oy: data.offsetY };
      const onMove = (ev: MouseEvent) => {
        onChange({
          ...data,
          offsetX: panStart.current.ox + ev.clientX - panStart.current.x,
          offsetY: panStart.current.oy + ev.clientY - panStart.current.y,
        });
      };
      const onUp = () => {
        setIsPanning(false);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [data, onChange]
  );

  // Drag individual note
  const startDrag = (e: React.MouseEvent, item: PinItem) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX - item.x;
    const startY = e.clientY - item.y;
    const onMove = (ev: MouseEvent) => {
      updateItem({ ...item, x: ev.clientX - startX, y: ev.clientY - startY });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Resize note
  const startResize = (e: React.MouseEvent, item: PinItem) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = item.width;
    const startH = item.height;
    const onMove = (ev: MouseEvent) => {
      updateItem({
        ...item,
        width: Math.max(120, startW + ev.clientX - startX),
        height: Math.max(80, startH + ev.clientY - startY),
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 shrink-0 flex items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold">{listName}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {data.items.length} Notizen · Alt+Drag zum Bewegen des Boards · Mittlere Maustaste zum Panning
          </p>
        </div>
        <Button size="sm" variant="outline" className="ml-auto" onClick={addNote}>
          <Plus className="h-4 w-4 mr-1" />
          <StickyNote className="h-4 w-4 mr-1" /> Notiz
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-xs text-muted-foreground"
          onClick={() => onChange({ ...data, offsetX: 0, offsetY: 0 })}
        >
          Zurücksetzen
        </Button>
      </div>

      {/* Board */}
      <div
        ref={boardRef}
        className="flex-1 relative overflow-hidden select-none"
        style={{ cursor: isPanning ? 'grabbing' : 'default', background: 'repeating-linear-gradient(0deg,transparent,transparent 24px,hsl(var(--border)/0.3) 25px),repeating-linear-gradient(90deg,transparent,transparent 24px,hsl(var(--border)/0.3) 25px)' }}
        onMouseDown={onBoardMouseDown}
      >
        <div
          className="absolute inset-0"
          style={{ transform: `translate(${data.offsetX}px, ${data.offsetY}px)` }}
        >
          {data.items.map((item) => (
            <div
              key={item.id}
              className="absolute rounded-lg shadow-md border border-black/10 group flex flex-col"
              style={{
                left: item.x,
                top: item.y,
                width: item.width,
                height: item.height,
                background: item.color,
              }}
            >
              {/* Drag handle */}
              <div
                className="flex items-center justify-between px-2 pt-1.5 pb-1 cursor-grab active:cursor-grabbing shrink-0"
                onMouseDown={(e) => startDrag(e, item)}
              >
                <GripHorizontal className="h-3.5 w-3.5 text-black/30" />
                {/* Color dots */}
                <div className="hidden group-hover:flex gap-1 items-center">
                  {NOTE_COLORS.map((c) => (
                    <button
                      key={c}
                      className="w-3 h-3 rounded-full border border-black/20 hover:scale-125 transition-transform"
                      style={{ background: c }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => updateItem({ ...item, color: c })}
                    />
                  ))}
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => deleteItem(item.id)}
                    className="ml-1 text-red-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <textarea
                className="flex-1 w-full resize-none bg-transparent text-sm px-3 pb-2 outline-none text-gray-800 placeholder-gray-400"
                placeholder="Notiz…"
                value={item.content}
                autoFocus={editingId === item.id}
                onFocus={() => setEditingId(item.id)}
                onBlur={() => setEditingId(null)}
                onChange={(e) => updateItem({ ...item, content: e.target.value })}
                onMouseDown={(e) => e.stopPropagation()}
              />

              {/* Resize handle */}
              <div
                className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity"
                onMouseDown={(e) => startResize(e, item)}
                style={{
                  background: 'linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.2) 50%)',
                  borderBottomRightRadius: 8,
                }}
              />
            </div>
          ))}

          {data.items.length === 0 && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground pointer-events-none"
              style={{ transform: `translate(${-data.offsetX}px, ${-data.offsetY}px)` }}
            >
              <StickyNote className="h-10 w-10 opacity-20" />
              <p className="text-sm">Leeres Board. Füge eine Notiz hinzu!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

