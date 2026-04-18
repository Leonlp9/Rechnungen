import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { ListType } from '@/store/listsStore';
import { CheckSquare, Kanban, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, type: ListType) => void;
}

const TYPES: { type: ListType; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    type: 'todo',
    label: 'To-Do-Liste',
    desc: 'Einfache Liste zum Abhaken',
    icon: <CheckSquare className="h-6 w-6" />,
  },
  {
    type: 'kanban',
    label: 'Kanban-Board',
    desc: 'Spalten mit Karten, Drag & Drop',
    icon: <Kanban className="h-6 w-6" />,
  },
  {
    type: 'pinboard',
    label: 'Pinnboard',
    desc: 'Freies Board mit Haftnotizen',
    icon: <StickyNote className="h-6 w-6" />,
  },
];

export function NewListDialog({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ListType>('todo');

  const handleCreate = () => {
    const n = name.trim();
    if (!n) return;
    onCreate(n, type);
    setName('');
    setType('todo');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Neue Liste erstellen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Meine Liste…"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Typ</label>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map(({ type: t, label, desc, icon }) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all',
                    type === t
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  )}
                >
                  {icon}
                  <span className="text-xs font-medium">{label}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
            <Button onClick={handleCreate} disabled={!name.trim()}>Erstellen</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

