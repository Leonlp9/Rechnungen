import { useState } from 'react';
import {
  useListsStore,
  newListId,
  defaultTodoData,
  defaultKanbanData,
  defaultPinboardData,
  type AppList,
  type ListType,
  type TodoListData,
  type KanbanListData,
  type PinboardData,
} from '@/store/listsStore';
import { NewListDialog } from '@/components/lists/NewListDialog';
import { TodoList } from '@/components/lists/TodoList';
import { KanbanBoard } from '@/components/lists/KanbanBoard';
import { Pinboard } from '@/components/lists/Pinboard';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, CheckSquare, Kanban, StickyNote, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useIsMobile';
import { ListGroup, ListRow } from '@/components/ui/list-group';

const TYPE_ICON: Record<ListType, React.ReactNode> = {
  todo: <CheckSquare className="h-4 w-4 shrink-0" />,
  kanban: <Kanban className="h-4 w-4 shrink-0" />,
  pinboard: <StickyNote className="h-4 w-4 shrink-0" />,
};

const TYPE_LABEL: Record<ListType, string> = {
  todo: 'To-Do',
  kanban: 'Kanban',
  pinboard: 'Pinnboard',
};

export default function ListsPage() {
  const { lists, addList, updateList, deleteList, renameList } = useListsStore();
  const [selectedId, setSelectedId] = useState<string | null>(lists[0]?.id ?? null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const isMobile = useIsMobile();

  const selected = lists.find((l) => l.id === selectedId) ?? null;

  const handleCreate = (name: string, type: ListType) => {
    const dataMap = {
      todo: defaultTodoData(),
      kanban: defaultKanbanData(),
      pinboard: defaultPinboardData(),
    };
    const list: AppList = {
      id: newListId(),
      name,
      type,
      createdAt: new Date().toISOString(),
      data: dataMap[type],
    };
    addList(list);
    setSelectedId(list.id);
    setDialogOpen(false);
  };

  const handleDataChange = (id: string, newData: TodoListData | KanbanListData | PinboardData) => {
    updateList(id, { data: newData });
  };

  const listBody = selected && (
    selected.type === 'todo' ? (
      <TodoList
        data={selected.data as TodoListData}
        onChange={(d) => handleDataChange(selected.id, d)}
        listName={selected.name}
      />
    ) : selected.type === 'kanban' ? (
      <KanbanBoard
        data={selected.data as KanbanListData}
        onChange={(d) => handleDataChange(selected.id, d)}
        listName={selected.name}
      />
    ) : (
      <Pinboard
        data={selected.data as PinboardData}
        onChange={(d) => handleDataChange(selected.id, d)}
        listName={selected.name}
      />
    )
  );

  // ── Handy ──
  // Eine 208 px breite Seitenspalte neben dem Inhalt lässt auf einem Handy
  // für beides zu wenig Platz. Deshalb wie in den Einstellungen: erst die
  // Übersicht, dann die Liste selbst über die volle Breite.
  if (isMobile) {
    if (!selectedId || !selected) {
      return (
        <div
          className="h-full overflow-y-auto px-4 pt-3"
          style={{ paddingBottom: 'var(--app-main-pb, 2rem)' }}
        >
          <div className="mb-5 flex items-start gap-3">
            <h1 className="min-w-0 flex-1 truncate text-[34px] leading-tight font-bold tracking-tight">Listen</h1>
            <Button size="icon" className="mt-1 shrink-0" onClick={() => setDialogOpen(true)} aria-label="Neue Liste">
              <Plus className="h-5 w-5" />
            </Button>
          </div>

          {lists.length === 0 ? (
            <ListGroup footer="To-do-Listen, Kanban-Boards und Pinnwände liegen nur auf diesem Gerät.">
              <ListRow icon={<CheckSquare />} label="Noch keine Listen" hint="Mit + oben rechts anlegen" noChevron />
            </ListGroup>
          ) : (
            <ListGroup>
              {lists.map((l) => (
                <div key={l.id} className="flex w-full items-stretch">
                  <button
                    type="button"
                    onClick={() => setSelectedId(l.id)}
                    className="flex min-w-0 flex-1 items-stretch text-left active:bg-accent"
                  >
                    <span
                      data-tint={l.type === 'todo' ? 'blue' : l.type === 'kanban' ? 'purple' : 'orange'}
                      className="my-[7px] ml-4 flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-[8px] bg-muted text-muted-foreground"
                    >
                      {TYPE_ICON[l.type]}
                    </span>
                    <span data-row-body className="ml-3 flex min-h-[44px] min-w-0 flex-1 items-center gap-2 border-b border-border py-2 pr-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[17px] leading-tight">{l.name}</span>
                        <span className="mt-0.5 block text-[13px] text-muted-foreground">{TYPE_LABEL[l.type]}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteList(l.id)}
                    aria-label={`${l.name} löschen`}
                    className="flex shrink-0 items-center active:opacity-60"
                  >
                    <span data-row-body className="flex h-full items-center border-b border-border pr-4 pl-1 text-destructive">
                      <Trash2 className="h-[18px] w-[18px]" />
                    </span>
                  </button>
                </div>
              ))}
            </ListGroup>
          )}

          <NewListDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreate={handleCreate} />
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-2">
          <button
            onClick={() => setSelectedId(null)}
            className="-ml-1 flex h-9 shrink-0 items-center gap-0.5 rounded-md pr-2 pl-1 text-[17px] text-primary active:opacity-60"
          >
            <ChevronLeft className="h-5 w-5" />
            Listen
          </button>
          <span className="min-w-0 flex-1 truncate px-1 text-center text-[17px] font-semibold">{selected.name}</span>
          <span className="w-[5.5rem] shrink-0" aria-hidden />
        </div>
        {/* Das Board endet über der schwebenden Leiste, statt darunter
            weiterzulaufen – sonst liegen Karten und Notizen dahinter. */}
        <div
          className="min-h-0 flex-1 overflow-hidden"
          style={{ paddingBottom: 'var(--app-main-pb, 0px)' }}
        >
          {listBody}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-muted/30">
      {/* ── Left panel ── */}
      <div
        className={cn(
          'border-r border-border bg-background flex flex-col shrink-0 transition-all duration-200 overflow-hidden',
          panelOpen ? 'w-52' : 'w-8'
        )}
      >
        {/* Header */}
        <div
          className={cn(
            'flex items-center border-b border-border shrink-0',
            panelOpen ? 'p-3 gap-2' : 'p-1 justify-center'
          )}
        >
          {panelOpen && (
            <Button
              size="sm"
              className="flex-1 text-xs"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Neue Liste
            </Button>
          )}
          <button
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
            title={panelOpen ? 'Panel zuklappen' : 'Panel aufklappen'}
            onClick={() => setPanelOpen((o) => !o)}
          >
            {panelOpen ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* List items */}
        <div className={cn('flex-1 overflow-y-auto p-2 space-y-1', !panelOpen && 'hidden')}>
          {lists.length === 0 && (
            <p className="text-xs text-muted-foreground text-center pt-6 px-2">
              Noch keine Listen. Erstelle eine!
            </p>
          )}
          {lists.map((l) => (
            <div
              key={l.id}
              className={cn(
                'group flex items-center gap-1 rounded-lg px-2 py-2 cursor-pointer transition-colors text-xs',
                selectedId === l.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'hover:bg-muted text-foreground/70'
              )}
              onClick={() => setSelectedId(l.id)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setRenamingId(l.id);
                setRenameValue(l.name);
              }}
            >
              <span className="opacity-60 shrink-0">{TYPE_ICON[l.type]}</span>
              {renamingId === l.id ? (
                <input
                  autoFocus
                  className="flex-1 text-xs bg-background border border-primary rounded px-1 py-0 outline-none min-w-0"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { renameList(l.id, renameValue.trim() || l.name); setRenamingId(null); }
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onBlur={() => { renameList(l.id, renameValue.trim() || l.name); setRenamingId(null); }}
                />
              ) : (
                <span className="flex-1 truncate" title="Doppelklick zum Umbenennen">{l.name}</span>
              )}
              <span className="text-[10px] px-1 rounded bg-muted text-muted-foreground shrink-0">
                {TYPE_LABEL[l.type]}
              </span>
              <button
                className="hidden group-hover:flex p-0.5 text-muted-foreground hover:text-destructive shrink-0"
                title="Liste löschen"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteList(l.id);
                  if (selectedId === l.id) setSelectedId(lists.find((x) => x.id !== l.id)?.id ?? null);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
            <div className="flex gap-4 opacity-30">
              <CheckSquare className="h-10 w-10" />
              <Kanban className="h-10 w-10" />
              <StickyNote className="h-10 w-10" />
            </div>
            <p className="text-sm">Wähle eine Liste oder erstelle eine neue.</p>
            <Button variant="outline" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Neue Liste
            </Button>
          </div>
        ) : selected.type === 'todo' ? (
          <TodoList
            data={selected.data as TodoListData}
            onChange={(d) => handleDataChange(selected.id, d)}
            listName={selected.name}
          />
        ) : selected.type === 'kanban' ? (
          <KanbanBoard
            data={selected.data as KanbanListData}
            onChange={(d) => handleDataChange(selected.id, d)}
            listName={selected.name}
          />
        ) : (
          <Pinboard
            data={selected.data as PinboardData}
            onChange={(d) => handleDataChange(selected.id, d)}
            listName={selected.name}
          />
        )}
      </div>

      <NewListDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}


