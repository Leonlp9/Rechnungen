import { useState } from 'react';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { DashboardNode } from '@/types/dashboard';
import { isGridType } from '@/types/dashboard';
import { DashboardElementNode, ELEMENT_LABELS } from './DashboardElementNode';
import { cn } from '@/lib/utils';
import { GripVertical, X, Plus, BookOpen, Columns2, Rows2 } from 'lucide-react';

// ─── Insertion line ──────────────────────────────────────────────────────────

function InsertionLine({ horizontal }: { horizontal: boolean }) {
  return (
    <div
      className={cn(
        'flex-shrink-0 bg-primary rounded-full pointer-events-none z-30',
        horizontal
          ? 'w-0.5 self-stretch min-h-[40px]'
          : 'h-0.5 w-full',
      )}
    />
  );
}

// ─── Grid Node ───────────────────────────────────────────────────────────────

interface GridNodeProps {
  node: DashboardNode;
  editMode: boolean;
  overContainerId: string | null;
  overItemId: string | null;
  activeDragId: string | null;
  onDelete: (id: string) => void;
  onAddPage: (gridId: string) => void;
  onDeletePage: (gridId: string, pageId: string) => void;
  onRenamePage: (gridId: string, pageId: string, label: string) => void;
  depth?: number;
}

export function DashboardGridNode({
  node, editMode, overContainerId, overItemId, activeDragId,
  onDelete, onAddPage, onDeletePage, onRenamePage, depth = 0,
}: GridNodeProps) {
  const [activePageId, setActivePageId] = useState<string | undefined>(
    node.type === 'grid-pages' ? node.pages?.[0]?.id : undefined,
  );

  const isRoot = node.id === 'root';
  const isHorizontal = node.type === 'grid-horizontal';
  const isPages = node.type === 'grid-pages';

  // Use a separate droppable id so hovering over child items doesn't
  // accidentally trigger "drop into this container"
  const dropId = `${node.id}__drop`;

  const { setNodeRef: setDropRef } = useDroppable({
    id: dropId,
    data: { type: 'container', containerId: node.id, pageId: activePageId },
    disabled: !editMode,
  });

  const children = isPages
    ? (node.pages?.find((p) => p.id === activePageId)?.children ?? node.pages?.[0]?.children ?? [])
    : (node.children ?? []);

  const childIds = children.map((c) => c.id);

  // Show container highlight when targeted but NOT when we have a specific item lined up
  const isTargeted = overContainerId === node.id;
  // Show end-of-container line when targeted and no specific item is being hovered
  const showEndLine = editMode && isTargeted && !overItemId && children.length > 0;
  // Show empty hint when targeted and empty
  const showEmptyHint = editMode && children.length === 0;

  const gridLabel = isHorizontal ? 'Horizontal' : isPages ? 'Seiten' : 'Vertikal';
  const GridIcon = isHorizontal ? Columns2 : isPages ? BookOpen : Rows2;

  const containerClass = cn(
    'relative transition-all',
    isHorizontal ? 'flex flex-row gap-3 items-stretch' : 'flex flex-col gap-3',
    editMode && [
      'rounded-xl border-2 border-dashed p-3',
      isTargeted
        ? 'border-primary bg-primary/5'
        : 'border-muted-foreground/30 bg-muted/20',
      showEmptyHint && 'min-h-[80px]',
    ],
  );

  return (
    <div className="w-full">
      {/* Grid header (non-root) */}
      {editMode && !isRoot && (
        <div className="flex items-center gap-1 mb-1.5 select-none">
          <GridIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            {gridLabel}
          </span>
          <button
            onClick={() => onDelete(node.id)}
            className="ml-auto h-5 w-5 rounded hover:bg-destructive/10 hover:text-destructive flex items-center justify-center text-muted-foreground transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Pages tabs */}
      {isPages && node.pages && (
        <div className="flex items-center gap-1 mb-2 flex-wrap border-b pb-1">
          {node.pages.map((page) => (
            <div key={page.id} className="flex items-center">
              <button
                onClick={() => setActivePageId(page.id)}
                className={cn(
                  'px-3 py-1 text-xs rounded-t border-b-2 transition-colors',
                  (activePageId ?? node.pages![0].id) === page.id
                    ? 'border-primary text-primary font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {editMode ? (
                  <input
                    value={page.label}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onRenamePage(node.id, page.id, e.target.value)}
                    className="bg-transparent w-20 outline-none text-xs"
                  />
                ) : (
                  page.label
                )}
              </button>
              {editMode && node.pages!.length > 1 && (
                <button
                  onClick={() => onDeletePage(node.id, page.id)}
                  className="h-4 w-4 ml-0.5 rounded hover:bg-destructive/10 hover:text-destructive flex items-center justify-center text-muted-foreground/50 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          {editMode && (
            <button
              onClick={() => onAddPage(node.id)}
              className="px-2 py-1 text-xs rounded text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-1 transition-colors"
            >
              <Plus className="h-3 w-3" /> Seite
            </button>
          )}
        </div>
      )}

      <SortableContext
        items={childIds}
        strategy={isHorizontal ? horizontalListSortingStrategy : verticalListSortingStrategy}
      >
        <div ref={setDropRef} className={containerClass}>
          {/* Empty hint */}
          {showEmptyHint && (
            <div className={cn(
              'flex items-center justify-center h-16 text-xs rounded-lg border-2 border-dashed transition-colors pointer-events-none',
              isTargeted ? 'border-primary/60 text-primary' : 'border-muted-foreground/20 text-muted-foreground/40',
            )}>
              Element hierher ziehen
            </div>
          )}

          {children.map((child) => {
            // Show insertion line BEFORE this child when it's the over target
            // (but not if this child IS the thing being dragged)
            const showLineBefore =
              editMode && overItemId === child.id && activeDragId !== child.id;

            return (
              <>
                {showLineBefore && <InsertionLine key={`line-${child.id}`} horizontal={isHorizontal} />}
                <SortableItem
                  key={child.id}
                  node={child}
                  editMode={editMode}
                  isHorizontal={isHorizontal}
                  overContainerId={overContainerId}
                  overItemId={overItemId}
                  activeDragId={activeDragId}
                  onDelete={onDelete}
                  onAddPage={onAddPage}
                  onDeletePage={onDeletePage}
                  onRenamePage={onRenamePage}
                  depth={depth + 1}
                />
              </>
            );
          })}

          {/* End-of-container insertion line */}
          {showEndLine && <InsertionLine horizontal={isHorizontal} />}
        </div>
      </SortableContext>
    </div>
  );
}

// ─── Sortable Item Wrapper ────────────────────────────────────────────────────

interface SortableItemProps {
  node: DashboardNode;
  editMode: boolean;
  isHorizontal: boolean;
  overContainerId: string | null;
  overItemId: string | null;
  activeDragId: string | null;
  onDelete: (id: string) => void;
  onAddPage: (gridId: string) => void;
  onDeletePage: (gridId: string, pageId: string) => void;
  onRenamePage: (gridId: string, pageId: string, label: string) => void;
  depth: number;
}

function SortableItem({
  node, editMode, isHorizontal, overContainerId, overItemId, activeDragId,
  onDelete, onAddPage, onDeletePage, onRenamePage, depth,
}: SortableItemProps) {
  const isGrid = isGridType(node.type);

  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({
    id: node.id,
    data: { source: 'layout', nodeId: node.id, nodeType: node.type },
    disabled: !editMode,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.2 : 1,
    flex: isHorizontal ? '1 1 0' : undefined,
    minWidth: isHorizontal ? 0 : undefined,
    // Stretch to full row height so all cards in a horizontal grid are equal height
    alignSelf: isHorizontal ? 'stretch' : undefined,
  };

  const label = isGrid
    ? ''
    : ELEMENT_LABELS[node.type as keyof typeof ELEMENT_LABELS] ?? node.type;

  // For element nodes: apply drag listeners to the entire wrapper (content is pointer-events-none anyway)
  // For grid nodes: keep listeners on the dedicated grip handle to avoid interfering with tabs/buttons
  const wrapperListeners = !isGrid && editMode ? listeners : {};
  const wrapperAttributes = !isGrid && editMode ? attributes : {};

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...wrapperAttributes}
      {...wrapperListeners}
      className={cn(
        'relative group',
        isHorizontal && 'flex-1 min-w-0',
        // Grab-cursor for the whole element node
        editMode && !isGrid && 'cursor-grab active:cursor-grabbing',
      )}
    >
      {/* ── Grid: dedicated grip handle in top-left (visible on hover) ── */}
      {editMode && isGrid && (
        <div className="absolute top-1 left-1 z-20 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 rounded bg-background/90 backdrop-blur-sm border shadow-sm hover:bg-muted touch-none"
            title="Grid verschieben"
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* ── Element: visual-only grip indicator (no listeners here) ── */}
      {editMode && !isGrid && (
        <div className="absolute top-1 left-1 z-20 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="p-1 rounded bg-background/90 backdrop-blur-sm border shadow-sm">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <span className="text-[10px] text-muted-foreground bg-background/90 backdrop-blur-sm border rounded px-1 py-0.5 leading-tight">
            {label}
          </span>
        </div>
      )}

      {/* ── Delete button for leaf elements ── */}
      {editMode && !isGrid && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onDelete(node.id)}
          className="absolute top-1 right-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 rounded-full bg-background/90 backdrop-blur-sm border shadow-sm hover:bg-destructive hover:text-white flex items-center justify-center text-muted-foreground pointer-events-auto"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      {/* ── Content ── */}
      {isGrid ? (
        <DashboardGridNode
          node={node}
          editMode={editMode}
          overContainerId={overContainerId}
          overItemId={overItemId}
          activeDragId={activeDragId}
          onDelete={onDelete}
          onAddPage={onAddPage}
          onDeletePage={onDeletePage}
          onRenamePage={onRenamePage}
          depth={depth}
        />
      ) : (
        // pointer-events-none so the whole wrapper captures drag events
        // flex flex-col + flex-1 on inner ensures the card stretches to full height
        <div className={cn(
          'flex flex-col',
          isHorizontal && 'h-full',
          editMode && 'pointer-events-none select-none',
        )}>
          <div className="flex-1 flex flex-col">
            <DashboardElementNode type={node.type as any} />
          </div>
        </div>
      )}
    </div>
  );
}

