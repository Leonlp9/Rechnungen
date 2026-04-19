import { useState } from 'react';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { useDroppable, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { DashboardNode } from '@/types/dashboard';
import { isGridType } from '@/types/dashboard';
import { DashboardElementNode, ELEMENT_LABELS } from './DashboardElementNode';
import { cn } from '@/lib/utils';
import {
  GripVertical, X, Plus, BookOpen, Columns2, Rows2, Settings,
  PanelLeft, LayoutGrid, LayoutDashboard, AlignJustify,
  ChevronDown, ChevronRight,
} from 'lucide-react';

// Element types that expose a settings panel
const ELEMENTS_WITH_SETTINGS = new Set(['list-recent-emails']);

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
  onReorderPages: (gridId: string, newPageIds: string[]) => void;
  onUpdateNodeProps: (nodeId: string, props: Record<string, unknown>) => void;
  depth?: number;
}

export function DashboardGridNode({
  node, editMode, overContainerId, overItemId, activeDragId,
  onDelete, onAddPage, onDeletePage, onRenamePage, onReorderPages, onUpdateNodeProps, depth = 0,
}: GridNodeProps) {
  const [activePageId, setActivePageId] = useState<string | undefined>(
    node.type === 'grid-pages' ? node.pages?.[0]?.id : undefined,
  );
  const [openAccordionIds, setOpenAccordionIds] = useState<Set<string>>(new Set());

  const isRoot = node.id === 'root';
  const isHorizontal = node.type === 'grid-horizontal';
  const isPages = node.type === 'grid-pages';
  const isMasonry = node.type === 'grid-masonry';
  const isAccordion = node.type === 'grid-accordion';
  const isSidebar = node.type === 'grid-sidebar';
  const isBento = node.type === 'grid-bento';

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

  const isTargeted = overContainerId === node.id;
  const showEndLine = editMode && isTargeted && !overItemId && children.length > 0;
  const showEmptyHint = editMode && children.length === 0;

  const gridLabel =
    isHorizontal ? 'Horizontal'
    : isPages ? 'Seiten'
    : isMasonry ? 'Masonry'
    : isAccordion ? 'Akkordeon'
    : isSidebar ? 'Sidebar'
    : isBento ? 'Bento'
    : 'Vertikal';

  const GridIcon =
    isHorizontal ? Columns2
    : isPages ? BookOpen
    : isMasonry ? LayoutGrid
    : isAccordion ? AlignJustify
    : isSidebar ? PanelLeft
    : isBento ? LayoutDashboard
    : Rows2;

  const sortingStrategy =
    isHorizontal || isSidebar ? horizontalListSortingStrategy : verticalListSortingStrategy;

  const containerClass = cn(
    'relative transition-all',
    isHorizontal || isSidebar
      ? 'flex flex-row gap-3 items-stretch'
      : isBento
        ? 'grid gap-3'
        : isMasonry
          ? 'columns-2 gap-3'
          : 'flex flex-col gap-3',
    editMode && [
      'rounded-xl border-2 border-dashed p-3',
      isTargeted
        ? 'border-primary bg-primary/5'
        : 'border-muted-foreground/30 bg-muted/20',
      showEmptyHint && 'min-h-[80px]',
    ],
  );

  // Bento columns from props (default 3)
  const bentoColumns = isBento ? (node.props?.columns as number ?? 3) : undefined;

  return (
    <div className="w-full">
      {/* Grid header (non-root) */}
      {editMode && !isRoot && (
        <div className="flex items-center gap-1 mb-1.5 select-none">
          <GridIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            {gridLabel}
          </span>
          {isBento && (
            <div className="flex items-center gap-1 ml-2">
              {[2, 3, 4].map((cols) => (
                <button
                  key={cols}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onUpdateNodeProps(node.id, { ...node.props, columns: cols }); }}
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded border transition-colors',
                    bentoColumns === cols
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'text-muted-foreground border-muted hover:bg-muted',
                  )}
                  title={`${cols} Spalten`}
                >
                  {cols}
                </button>
              ))}
            </div>
          )}
          {isSidebar && (
            <span className="text-[10px] text-muted-foreground/60 ml-1">(1. Kind = Seitenleiste)</span>
          )}
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
        <PageTabs
          node={node}
          editMode={editMode}
          activePageId={activePageId ?? node.pages[0]?.id}
          onSetActivePageId={setActivePageId}
          onAddPage={onAddPage}
          onDeletePage={onDeletePage}
          onRenamePage={onRenamePage}
          onReorderPages={onReorderPages}
        />
      )}

      <SortableContext items={childIds} strategy={sortingStrategy}>
        <div
          ref={setDropRef}
          className={containerClass}
          style={isBento ? { gridTemplateColumns: `repeat(${bentoColumns ?? 3}, 1fr)` } : undefined}
        >
          {/* Empty hint */}
          {showEmptyHint && (
            <div className={cn(
              'flex items-center justify-center h-16 text-xs rounded-lg border-2 border-dashed transition-colors pointer-events-none',
              isBento && 'col-span-3',
              isTargeted ? 'border-primary/60 text-primary' : 'border-muted-foreground/20 text-muted-foreground/40',
            )}>
              Element hierher ziehen
            </div>
          )}

          {children.map((child, index) => {
            const showLineBefore =
              editMode && overItemId === child.id && activeDragId !== child.id;

            const accordionOpen = openAccordionIds.has(child.id);
            const toggleAccordion = () => {
              setOpenAccordionIds((prev) => {
                const next = new Set(prev);
                next.has(child.id) ? next.delete(child.id) : next.add(child.id);
                return next;
              });
            };

            return (
              <>
                {showLineBefore && (
                  <InsertionLine key={`line-${child.id}`} horizontal={isHorizontal || isSidebar} />
                )}
                <SortableItem
                  key={child.id}
                  node={child}
                  editMode={editMode}
                  isHorizontal={isHorizontal || isSidebar}
                  itemIndex={index}
                  isSidebar={isSidebar}
                  isBento={isBento}
                  isMasonry={isMasonry}
                  isAccordion={isAccordion}
                  accordionOpen={accordionOpen}
                  onAccordionToggle={toggleAccordion}
                  overContainerId={overContainerId}
                  overItemId={overItemId}
                  activeDragId={activeDragId}
                  onDelete={onDelete}
                  onAddPage={onAddPage}
                  onDeletePage={onDeletePage}
                  onRenamePage={onRenamePage}
                  onReorderPages={onReorderPages}
                  onUpdateNodeProps={onUpdateNodeProps}
                  depth={depth + 1}
                />
              </>
            );
          })}

          {/* End-of-container insertion line */}
          {showEndLine && <InsertionLine horizontal={isHorizontal || isSidebar} />}
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
  itemIndex: number;
  isSidebar: boolean;
  isBento: boolean;
  isMasonry: boolean;
  isAccordion: boolean;
  accordionOpen: boolean;
  onAccordionToggle: () => void;
  overContainerId: string | null;
  overItemId: string | null;
  activeDragId: string | null;
  onDelete: (id: string) => void;
  onAddPage: (gridId: string) => void;
  onDeletePage: (gridId: string, pageId: string) => void;
  onRenamePage: (gridId: string, pageId: string, label: string) => void;
  onReorderPages: (gridId: string, newPageIds: string[]) => void;
  onUpdateNodeProps: (nodeId: string, props: Record<string, unknown>) => void;
  depth: number;
}

function SortableItem({
  node, editMode, isHorizontal, itemIndex,
  isSidebar, isBento, isMasonry, isAccordion, accordionOpen, onAccordionToggle,
  overContainerId, overItemId, activeDragId,
  onDelete, onAddPage, onDeletePage, onRenamePage, onReorderPages, onUpdateNodeProps, depth,
}: SortableItemProps) {
  const isGrid = isGridType(node.type);
  const hasSettings = !isGrid && ELEMENTS_WITH_SETTINGS.has(node.type);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({
    id: node.id,
    data: { source: 'layout', nodeId: node.id, nodeType: node.type },
    disabled: !editMode,
  });

  // Compute the per-item style based on layout context
  let itemFlexStyle: React.CSSProperties = {};
  if (isSidebar) {
    itemFlexStyle = itemIndex === 0
      ? { flex: '0 0 240px', minWidth: 0 }
      : { flex: '1 1 0', minWidth: 0 };
  } else if (isBento) {
    const colSpan = (node.props?.colSpan as number) ?? 1;
    itemFlexStyle = { gridColumn: `span ${colSpan}` };
  } else if (isHorizontal) {
    itemFlexStyle = { flex: '1 1 0', minWidth: 0 };
  }

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.2 : 1,
    alignSelf: isHorizontal ? 'stretch' : undefined,
    ...itemFlexStyle,
  };

  const label = isGrid
    ? ''
    : ELEMENT_LABELS[node.type as keyof typeof ELEMENT_LABELS] ?? node.type;

  const accordionLabel = isGrid
    ? node.type.replace('grid-', '').charAt(0).toUpperCase() + node.type.replace('grid-', '').slice(1)
    : label;

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
        isHorizontal && !isSidebar && !isBento && 'flex-1 min-w-0',
        // Propagate full height via flex-col so h-full works on all descendants
        // (except masonry where natural content height is desired)
        !isMasonry && 'flex flex-col',
        isMasonry && 'break-inside-avoid mb-3',
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

      {/* ── Settings + Delete buttons for leaf elements ── */}
      {editMode && !isGrid && (
        <div className="absolute top-1 right-1 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
          {hasSettings && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setSettingsOpen((v) => !v); }}
              className="h-6 w-6 rounded-full bg-background/90 backdrop-blur-sm border shadow-sm hover:bg-muted flex items-center justify-center text-muted-foreground"
              title="Einstellungen"
            >
              <Settings className="h-3 w-3" />
            </button>
          )}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onDelete(node.id)}
            className="h-6 w-6 rounded-full bg-background/90 backdrop-blur-sm border shadow-sm hover:bg-destructive hover:text-white flex items-center justify-center text-muted-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* ── Accordion toggle header ── */}
      {isAccordion && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onAccordionToggle(); }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/60 hover:bg-muted mb-1 text-left transition-colors select-none"
        >
          {accordionOpen
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          }
          <span className="text-xs font-medium flex-1 truncate">{accordionLabel}</span>
        </button>
      )}

      {/* ── Content (hidden when accordion collapsed) ── */}
      <div className={cn(
        !isMasonry && 'flex-1 flex flex-col',
        isAccordion && !accordionOpen && 'hidden',
      )}>
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
            onReorderPages={onReorderPages}
            onUpdateNodeProps={onUpdateNodeProps}
            depth={depth}
          />
        ) : (
          <div className={cn(
            'flex flex-col flex-1',
            editMode && 'pointer-events-none select-none',
          )}>
            <div className="flex-1 flex flex-col">
              <DashboardElementNode
                type={node.type as any}
                settingsOpen={settingsOpen}
                onSettingsClose={() => setSettingsOpen(false)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sortable Page Tab ────────────────────────────────────────────────────────

function SortablePageTab({
  page,
  isActive,
  editMode,
  canDelete,
  onSetActive,
  onDelete,
  onRename,
}: {
  page: { id: string; label: string };
  isActive: boolean;
  editMode: boolean;
  nodeId: string;
  canDelete: boolean;
  onSetActive: () => void;
  onDelete: () => void;
  onRename: (label: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
    disabled: !editMode,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center">
      {editMode && (
        <button
          {...attributes}
          {...listeners}
          onPointerDown={(e) => {
            e.stopPropagation();
            (listeners as any)?.onPointerDown?.(e);
          }}
          className="cursor-grab active:cursor-grabbing p-0.5 mr-0.5 rounded text-muted-foreground/40 hover:text-muted-foreground touch-none"
        >
          <GripVertical className="h-3 w-3" />
        </button>
      )}
      <button
        onClick={() => { onSetActive(); }}
        onDoubleClick={(e) => { if (editMode) { e.stopPropagation(); setRenaming(true); } }}
        className={cn(
          'px-3 py-1 text-xs rounded-t border-b-2 transition-colors',
          isActive
            ? 'border-primary text-primary font-medium'
            : 'border-transparent text-muted-foreground hover:text-foreground',
        )}
      >
        {renaming ? (
          <input
            autoFocus
            value={page.label}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onRename(e.target.value)}
            onBlur={() => setRenaming(false)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setRenaming(false); }}
            className="bg-transparent w-20 outline-none text-xs"
          />
        ) : (
          page.label
        )}
      </button>
      {editMode && canDelete && (
        <button
          onClick={onDelete}
          className="h-4 w-4 ml-0.5 rounded hover:bg-destructive/10 hover:text-destructive flex items-center justify-center text-muted-foreground/50 transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ─── PageTabs ─────────────────────────────────────────────────────────────────

function PageTabs({
  node, editMode, activePageId,
  onSetActivePageId, onAddPage, onDeletePage, onRenamePage, onReorderPages,
}: {
  node: DashboardNode;
  editMode: boolean;
  activePageId: string;
  onSetActivePageId: (id: string) => void;
  onAddPage: (gridId: string) => void;
  onDeletePage: (gridId: string, pageId: string) => void;
  onRenamePage: (gridId: string, pageId: string, label: string) => void;
  onReorderPages: (gridId: string, newPageIds: string[]) => void;
}) {
  const pages = node.pages ?? [];
  const pageIds = pages.map((p) => p.id);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = pageIds.indexOf(active.id as string);
    const newIndex = pageIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorderPages(node.id, arrayMove(pageIds, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext items={pageIds} strategy={horizontalListSortingStrategy}>
        <div className="flex items-center gap-1 mb-2 flex-wrap border-b pb-1">
          {pages.map((page) => (
            <SortablePageTab
              key={page.id}
              page={page}
              isActive={activePageId === page.id}
              editMode={editMode}
              nodeId={node.id}
              canDelete={pages.length > 1}
              onSetActive={() => onSetActivePageId(page.id)}
              onDelete={() => onDeletePage(node.id, page.id)}
              onRename={(label) => onRenamePage(node.id, page.id, label)}
            />
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
      </SortableContext>
    </DndContext>
  );
}
