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


