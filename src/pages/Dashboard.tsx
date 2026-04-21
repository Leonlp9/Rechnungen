import { useState, useCallback } from 'react';
import { Settings2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  rectIntersection,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useDashboardStore } from '@/store/dashboardStore';
import { DashboardContext } from '@/components/dashboard/DashboardContext';
import { DashboardGridNode } from '@/components/dashboard/DashboardGridNode';
import { DashboardEditSidebar } from '@/components/dashboard/DashboardEditSidebar';
import { ELEMENT_LABELS } from '@/components/dashboard/DashboardElementNode';
import {
  isGridType,
  findNodeById,
  findParentInfo,
  createNode,
  insertNodeIntoContainer,
  moveNode,
  removeNodeById,
  isAncestor,
  genId,
} from '@/types/dashboard';
import type { DashboardNode, NodeType } from '@/types/dashboard';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Drag overlay preview ────────────────────────────────────────────────────

function DragPreview({ type }: { type: NodeType }) {
  const isGrid = isGridType(type);
  const label = isGrid
    ? (type === 'grid-horizontal' ? 'Horizontal' : type === 'grid-pages' ? 'Seiten' : 'Vertikal')
    : (ELEMENT_LABELS[type as keyof typeof ELEMENT_LABELS] ?? type);
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card shadow-xl ring-2 ring-primary opacity-90 cursor-grabbing">
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const data = useDashboardData();
  const { layout, setLayout, resetLayout } = useDashboardStore();
  const [editMode, setEditMode] = useState(false);
  const [activeDrag, setActiveDrag] = useState<{ type: NodeType; id: string } | null>(null);
  const [overContainerId, setOverContainerId] = useState<string | null>(null);
  const [overItemId, setOverItemId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null); // node id to delete
  const [confirmReset, setConfirmReset] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const onDragStart = useCallback(({ active }: DragStartEvent) => {
    const d = active.data.current as any;
    setActiveDrag({ type: d.elementType ?? d.nodeType, id: active.id as string });
  }, []);

  const onDragOver = useCallback(({ over }: DragOverEvent) => {
    if (!over) { setOverContainerId(null); setOverItemId(null); return; }
    const overId = over.id as string;

    if (overId.endsWith('__drop')) {
      // Hovering over a grid's droppable zone (empty space in the grid)
      const containerId = overId.replace('__drop', '');
      setOverContainerId(containerId);
      setOverItemId(null);
    } else {
      // Hovering over a sortable item (element or grid-as-item)
      const parentInfo = findParentInfo(layout, overId);
      setOverContainerId(parentInfo?.container.id ?? null);
      setOverItemId(overId);
    }
  }, [layout]);

  const onDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    setActiveDrag(null);
    setOverContainerId(null);
    setOverItemId(null);
    if (!over) return;

    const activeData = active.data.current as any;
    const overId = over.id as string;

    // Determine if we're dropping onto a container (__drop suffix) or onto a sortable item
    const isContainerDrop = overId.endsWith('__drop');
    const resolvedOverId = isContainerDrop ? overId.replace('__drop', '') : overId;
    const overNode = findNodeById(layout, resolvedOverId);

    // Determine target container + page + index
    let targetContainerId: string;
    let targetPageId: string | undefined;
    let targetIndex: number;

    if (isContainerDrop) {
      // Pointer was over the grid's own droppable zone (empty space) → insert at end of container
      targetContainerId = resolvedOverId;
      const overData = over.data.current as any;
      targetPageId = overData?.pageId;
      if (targetPageId && overNode!.pages) {
        const page = overNode!.pages.find((p) => p.id === targetPageId);
        targetIndex = page ? page.children.length : 0;
      } else {
        targetIndex = overNode!.children?.length ?? 0;
      }
    } else {
      // Pointer was over a sortable item (could be an element OR a grid-as-item)
      // → insert before/at that item's position in its parent container
      const parentInfo = findParentInfo(layout, resolvedOverId);
      if (!parentInfo) return;
      targetContainerId = parentInfo.container.id;
      targetPageId = parentInfo.pageId;
      targetIndex = parentInfo.index;
    }

    if (activeData.source === 'sidebar') {
      const newNode = createNode(activeData.elementType as NodeType);
      setLayout(insertNodeIntoContainer(layout, targetContainerId, targetPageId, targetIndex, newNode));
      return;
    }

    // Moving existing layout node
    const sourceNodeId = active.id as string;
    if (sourceNodeId === resolvedOverId) return;
    if (isAncestor(layout, sourceNodeId, targetContainerId)) return;

    // Check if same container → use arrayMove for smooth animation
    const sourceParentInfo = findParentInfo(layout, sourceNodeId);
    if (
      sourceParentInfo &&
      sourceParentInfo.container.id === targetContainerId &&
      sourceParentInfo.pageId === targetPageId &&
      !isContainerDrop
    ) {
      const container = findNodeById(layout, targetContainerId)!;
      let children: DashboardNode[];
      if (targetPageId && container.pages) {
        children = container.pages.find((p) => p.id === targetPageId)!.children;
      } else {
        children = container.children!;
      }
      const oldIndex = children.findIndex((c) => c.id === sourceNodeId);
      const newIndex = children.findIndex((c) => c.id === resolvedOverId);
      if (oldIndex === -1 || newIndex === -1) return;
      const newChildren = arrayMove(children, oldIndex, newIndex);
      const newLayout = JSON.parse(JSON.stringify(layout));
      function applyReorder(node: DashboardNode): boolean {
        if (node.id === targetContainerId) {
          if (targetPageId && node.pages) {
            const page = node.pages.find((p) => p.id === targetPageId);
            if (page) { page.children = newChildren; return true; }
          } else if (node.children) {
            node.children = newChildren; return true;
          }
        }
        if (node.children) for (const c of node.children) if (applyReorder(c)) return true;
        if (node.pages) for (const p of node.pages) for (const c of p.children) if (applyReorder(c)) return true;
        return false;
      }
      applyReorder(newLayout);
      setLayout(newLayout);
    } else {
      setLayout(moveNode(layout, sourceNodeId, targetContainerId, targetPageId, targetIndex));
    }
  }, [layout, setLayout]);

  const handleDeleteNode = useCallback((id: string) => {
    setConfirmDelete(id);
  }, []);

  const doDeleteNode = useCallback((id: string) => {
    const [newLayout] = removeNodeById(layout, id);
    setLayout(newLayout);
  }, [layout, setLayout]);

  const handleAddPage = useCallback((gridId: string) => {
    const newLayout = JSON.parse(JSON.stringify(layout));
    function doAdd(node: DashboardNode): boolean {
      if (node.id === gridId && node.pages) {
        node.pages.push({ id: genId(), label: `Seite ${node.pages.length + 1}`, children: [] });
        return true;
      }
      if (node.children) for (const c of node.children) if (doAdd(c)) return true;
      if (node.pages) for (const p of node.pages) for (const c of p.children) if (doAdd(c)) return true;
      return false;
    }
    doAdd(newLayout); setLayout(newLayout);
  }, [layout, setLayout]);

  const handleDeletePage = useCallback((gridId: string, pageId: string) => {
    const newLayout = JSON.parse(JSON.stringify(layout));
    function doDelete(node: DashboardNode): boolean {
      if (node.id === gridId && node.pages) {
        node.pages = node.pages.filter((p) => p.id !== pageId);
        if (node.pages.length === 0) node.pages.push({ id: genId(), label: 'Seite 1', children: [] });
        return true;
      }
      if (node.children) for (const c of node.children) if (doDelete(c)) return true;
      if (node.pages) for (const p of node.pages) for (const c of p.children) if (doDelete(c)) return true;
      return false;
    }
    doDelete(newLayout); setLayout(newLayout);
  }, [layout, setLayout]);

  const handleRenamePage = useCallback((gridId: string, pageId: string, label: string) => {
    const newLayout = JSON.parse(JSON.stringify(layout));
    function doRename(node: DashboardNode): boolean {
      if (node.id === gridId && node.pages) {
        const page = node.pages.find((p) => p.id === pageId);
        if (page) { page.label = label; return true; }
      }
      if (node.children) for (const c of node.children) if (doRename(c)) return true;
      if (node.pages) for (const p of node.pages) for (const c of p.children) if (doRename(c)) return true;
      return false;
    }
    doRename(newLayout); setLayout(newLayout);
  }, [layout, setLayout]);

  const handleReorderPages = useCallback((gridId: string, newPageIds: string[]) => {
    const newLayout = JSON.parse(JSON.stringify(layout));
    function doReorder(node: DashboardNode): boolean {
      if (node.id === gridId && node.pages) {
        node.pages = newPageIds.map((id) => node.pages!.find((p) => p.id === id)!).filter(Boolean);
        return true;
      }
      if (node.children) for (const c of node.children) if (doReorder(c)) return true;
      if (node.pages) for (const p of node.pages) for (const c of p.children) if (doReorder(c)) return true;
      return false;
    }
    doReorder(newLayout); setLayout(newLayout);
  }, [layout, setLayout]);

  const handleUpdateNodeProps = useCallback((nodeId: string, props: Record<string, unknown>) => {
    const newLayout = JSON.parse(JSON.stringify(layout));
    function doUpdate(node: DashboardNode): boolean {
      if (node.id === nodeId) { node.props = props; return true; }
      if (node.children) for (const c of node.children) if (doUpdate(c)) return true;
      if (node.pages) for (const p of node.pages) for (const c of p.children) if (doUpdate(c)) return true;
      return false;
    }
    doUpdate(newLayout); setLayout(newLayout);
  }, [layout, setLayout]);

  const handleReset = () => {
    setConfirmReset(true);
  };

  return (
    <DashboardContext.Provider value={{ ...data, editMode }}>
      {/*
        -m-6 breaks out of the parent <main>'s p-6 so we can own the full area
        and create our own flex layout: [content] [sidebar]
      */}
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="flex -m-6 h-[calc(100%+3rem)]">
          {/* ── Main scrollable content ── */}
          <div data-tutorial="dashboard-kpis" className="flex-1 min-w-0 overflow-y-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">Dashboard</h1>
              <div className="flex items-center gap-2">
                <Select
                  value={String(data.selectedMonth)}
                  onValueChange={(v) => data.setSelectedMonth(Number(v))}
                >
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[
                      'Januar','Februar','März','April','Mai','Juni',
                      'Juli','August','September','Oktober','November','Dezember',
                    ].map((name, i) => {
                      const isCurrentMonth = i + 1 === new Date().getMonth() + 1 && data.selectedYear === new Date().getFullYear();
                      return (
                        <SelectItem key={i + 1} value={String(i + 1)}>
                          <span className="flex items-center gap-2">
                            {name}
                            {isCurrentMonth && (
                              <span className="text-[10px] bg-primary/15 text-primary rounded px-1 py-0.5 leading-none font-medium">
                                aktuell
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Select
                  value={String(data.selectedYear)}
                  onValueChange={(v) => data.setSelectedYear(Number(v))}
                >
                  <SelectTrigger className="w-32" data-tutorial="dashboard-year-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {data.years.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant={editMode ? 'default' : 'outline'}
                  size="sm"
                  className="gap-2"
                  onClick={() => setEditMode((v) => !v)}
                >
                  <Settings2 className="h-4 w-4" />
                  {editMode ? 'Fertig' : 'Anpassen'}
                </Button>
              </div>
            </div>

            {/* Grid */}
            <DashboardGridNode
              node={layout}
              editMode={editMode}
              overContainerId={overContainerId}
              overItemId={overItemId}
              activeDragId={activeDrag?.id ?? null}
              onDelete={handleDeleteNode}
              onAddPage={handleAddPage}
              onDeletePage={handleDeletePage}
              onRenamePage={handleRenamePage}
              onReorderPages={handleReorderPages}
              onUpdateNodeProps={handleUpdateNodeProps}
            />
          </div>

          {/* ── Edit sidebar – flex panel, no overlay ── */}
          <div className={cn(
            'flex-shrink-0 border-l bg-background transition-all duration-300 overflow-hidden',
            editMode ? 'w-72' : 'w-0',
          )}>
            {/* inner div keeps w-72 even when outer collapses to w-0 */}
            <DashboardEditSidebar
              onClose={() => setEditMode(false)}
              onReset={handleReset}
            />
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDrag ? <DragPreview type={activeDrag.type} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Confirm: delete node */}
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Element entfernen?"
        description="Soll dieses Element wirklich aus dem Dashboard entfernt werden?"
        confirmLabel="Entfernen"
        cancelLabel="Abbrechen"
        destructive
        onConfirm={() => { if (confirmDelete) doDeleteNode(confirmDelete); setConfirmDelete(null); }}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Confirm: reset layout */}
      <ConfirmDialog
        open={confirmReset}
        title="Layout zurücksetzen?"
        description="Das Layout wird auf die Standardansicht zurückgesetzt. Alle Anpassungen gehen verloren."
        confirmLabel="Zurücksetzen"
        cancelLabel="Abbrechen"
        destructive
        onConfirm={() => { resetLayout(); setConfirmReset(false); }}
        onCancel={() => setConfirmReset(false)}
      />


    </DashboardContext.Provider>
  );
}
