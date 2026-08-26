// Neue Liste anlegen – am Desktop ein Dialog, am Handy ein Blatt von unten.
//
// Die drei Listenarten standen als Kacheln nebeneinander: Auf dem Handy blieb
// pro Kachel ein Streifen von gut hundert Pixeln, in dem Name und Erklärung
// vierzeilig umbrachen. Untereinander als Auswahlliste ist jede Art in einer
// Zeile lesbar, und die getroffene Wahl zeigt ein Häkchen – so macht es iOS
// bei Auswahlen auch.

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { ListGroup, ListRow } from '@/components/ui/list-group';
import { FormGroup, FormFullRow } from '@/components/ui/form-list';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { ListType } from '@/store/listsStore';
import type { ListTint } from '@/components/ui/list-group';
import { Check, CheckSquare, Kanban, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, type: ListType) => void;
}

const TYPES: {
  type: ListType;
  label: string;
  desc: string;
  tint: ListTint;
  icon: React.ReactNode;
}[] = [
  {
    type: 'todo',
    label: 'To-Do-Liste',
    desc: 'Einfache Liste zum Abhaken',
    tint: 'blue',
    icon: <CheckSquare className="h-6 w-6" />,
  },
  {
    type: 'kanban',
    label: 'Kanban-Board',
    desc: 'Spalten mit Karten, Drag & Drop',
    tint: 'purple',
    icon: <Kanban className="h-6 w-6" />,
  },
  {
    type: 'pinboard',
    label: 'Pinnboard',
    desc: 'Freies Board mit Haftnotizen',
    tint: 'orange',
    icon: <StickyNote className="h-6 w-6" />,
  },
];

export function NewListDialog({ open, onClose, onCreate }: Props) {
  const isMobile = useIsMobile();
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
    <ResponsiveModal
      open={open}
      onClose={onClose}
      title="Neue Liste"
      desktopClassName="max-w-md"
    >
      {isMobile ? (
        <div className="space-y-6">
          <FormGroup title="Name">
            <FormFullRow>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Meine Liste"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="w-full bg-transparent text-[17px] outline-none placeholder:text-muted-foreground"
              />
            </FormFullRow>
          </FormGroup>

          <ListGroup title="Art">
            {TYPES.map(({ type: t, label, desc, tint, icon }) => (
              <ListRow
                key={t}
                tint={tint}
                icon={icon}
                label={label}
                hint={desc}
                onClick={() => setType(t)}
                noChevron
                // Nur das Häkchen markiert die Wahl – eine zusätzlich
                // eingefärbte Zeile wäre in iOS-Listen doppelt gemoppelt.
                trailing={
                  type === t ? <Check className="h-[18px] w-[18px] shrink-0 text-primary" /> : undefined
                }
              />
            ))}
          </ListGroup>

          <Button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="h-[50px] w-full text-[17px] font-semibold"
          >
            Liste erstellen
          </Button>
        </div>
      ) : (
        <div className="space-y-4 pt-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Meine Liste…"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Typ</label>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map(({ type: t, label, desc, icon }) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all',
                    type === t
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50',
                  )}
                >
                  {icon}
                  <span className="text-xs font-medium">{label}</span>
                  <span className="text-[10px] leading-tight text-muted-foreground">{desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
            <Button onClick={handleCreate} disabled={!name.trim()}>Erstellen</Button>
          </div>
        </div>
      )}
    </ResponsiveModal>
  );
}
