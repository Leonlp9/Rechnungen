import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import React, { useState, useMemo } from 'react';
import type { NodeType, ElementType } from '@/types/dashboard';
import { cn } from '@/lib/utils';
import { RotateCcw, X, Info, Search, Eye } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DashboardElementNode } from './DashboardElementNode';
import { ALL_ITEMS, type SidebarItemDef } from './elementCatalog';

// ─── Sidebar Draggable Item ──────────────────────────────────────────────────

interface SidebarItemProps {
  type: NodeType;
  label: string;
  icon: React.ReactNode;
  description?: string;
  tooltip?: string;
  onPreview?: (type: NodeType) => void;
}

function SidebarDraggableItem({ type, label, icon, description, tooltip, onPreview }: SidebarItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `sidebar-${type}`,
    data: { source: 'sidebar', elementType: type },
  });

  const pointerStart = React.useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
    listeners?.onPointerDown?.(e as any);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (pointerStart.current && !type.startsWith('grid-') && onPreview) {
      const dx = Math.abs(e.clientX - pointerStart.current.x);
      const dy = Math.abs(e.clientY - pointerStart.current.y);
      if (dx < 5 && dy < 5) {
        onPreview(type);
      }
    }
    pointerStart.current = null;
  };

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 rounded-lg border bg-card cursor-grab active:cursor-grabbing hover:bg-muted/60 transition-colors select-none touch-none',
        isDragging && 'shadow-lg ring-2 ring-primary',
      )}
    >
      <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium truncate">{label}</div>
        {description && (
          <div className="text-[10px] text-muted-foreground truncate">{description}</div>
        )}
      </div>
      {tooltip && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="flex-shrink-0 h-5 w-5 rounded flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted transition-colors pointer-events-auto"
              tabIndex={-1}
            >
              <Info className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="left" align="center" className="w-56 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">{label}</p>
            <p>{tooltip}</p>
            {onPreview && !type.startsWith('grid-') && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2 gap-1.5 text-xs h-7"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview(type);
                }}
              >
                <Eye className="h-3 w-3" />
                Vorschau
              </Button>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="px-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

// ─── Sidebar Component ───────────────────────────────────────────────────────


interface DashboardEditSidebarProps {
  onClose: () => void;
  onReset: () => void;
}

// ─── Statische Element-Liste (außerhalb der Komponente, damit kein Re-Create beim Render) ──


export function DashboardEditSidebar({ onClose, onReset }: DashboardEditSidebarProps) {
  const [search, setSearch] = useState('');
  const [previewType, setPreviewType] = useState<ElementType | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ALL_ITEMS;
    return ALL_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.section.toLowerCase().includes(q),
    );
  }, [search]);

  // Group filtered items by section
  const sections = useMemo(() => {
    const map = new Map<string, SidebarItemDef[]>();
    for (const item of filtered) {
      if (!map.has(item.section)) map.set(item.section, []);
      map.get(item.section)!.push(item);
    }
    // Alphabetisch innerhalb jeder Sektion
    for (const items of map.values()) {
      items.sort((a, b) => a.label.localeCompare(b.label, 'de'));
    }
    return map;
  }, [filtered]);

  return (
    <>
    <div className="w-72 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b flex-shrink-0">
        <div>
          <h3 className="font-semibold text-sm">Dashboard anpassen</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Ziehe Elemente ins Dashboard</p>
        </div>
        <button
          onClick={onClose}
          className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-1 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Elemente suchen…"
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* Palette – scrollable */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {sections.size === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Keine Elemente gefunden.</p>
        ) : (
          Array.from(sections.entries()).map(([sectionTitle, items]) => (
            <Section key={sectionTitle} title={sectionTitle}>
              {items.map((item) => (
                <SidebarDraggableItem
                  key={item.type}
                  {...item}
                  onPreview={(t) => setPreviewType(t as ElementType)}
                />
              ))}
            </Section>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t flex-shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 text-muted-foreground"
          onClick={onReset}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Layout zurücksetzen
        </Button>
      </div>
    </div>

    {/* Preview Dialog */}
    <Dialog open={previewType !== null} onOpenChange={(open) => { if (!open) setPreviewType(null); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto p-6">
        <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5" />
          Vorschau – So sieht das Element im Dashboard aus
        </div>
        {previewType && (
          <div className="min-h-[200px]">
            <DashboardElementNode type={previewType} />
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
