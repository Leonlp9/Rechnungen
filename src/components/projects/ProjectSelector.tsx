import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { projects } from '@/lib/db';
import { queryKeys } from '@/lib/queryKeys';
import { toast } from 'sonner';
import { FolderPlus } from 'lucide-react';
import type { Project } from '@/types';

interface Props {
  value: string; // '' = kein Projekt
  onChange: (projectId: string) => void;
  className?: string;
  size?: 'sm' | 'default';
}

const NEW_PROJECT_SENTINEL = '__new__';
const NO_PROJECT_SENTINEL = '__none__';

export function ProjectSelector({ value, onChange, className, size = 'default' }: Props) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const { data: projectList = [] } = useQuery<Project[]>({
    queryKey: queryKeys.projects.all,
    queryFn: () => projects.getAll(),
    staleTime: 30_000,
  });

  const handleSelectChange = (v: string) => {
    if (v === NEW_PROJECT_SENTINEL) {
      setNewTitle('');
      setCreateOpen(true);
    } else if (v === NO_PROJECT_SENTINEL) {
      onChange('');
    } else {
      onChange(v);
    }
  };

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      const project = await projects.create(title);
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      onChange(project.id);
      setCreateOpen(false);
      toast.success(`Projekt „${title}" erstellt`);
    } catch (e) {
      toast.error('Fehler beim Erstellen: ' + String(e));
    } finally {
      setCreating(false);
    }
  };

  const triggerClass = size === 'sm' ? 'h-8 text-xs' : '';

  return (
    <>
      <Select value={value || NO_PROJECT_SENTINEL} onValueChange={handleSelectChange}>
        <SelectTrigger className={`${triggerClass} ${className ?? ''}`}>
          <SelectValue placeholder="Kein Projekt" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_PROJECT_SENTINEL}>Kein Projekt</SelectItem>
          {projectList.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.title}
            </SelectItem>
          ))}
          <SelectItem value={NEW_PROJECT_SENTINEL}>
            <span className="flex items-center gap-1.5 text-primary font-medium">
              <FolderPlus className="h-3.5 w-3.5" />
              Neues Projekt erstellen…
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) setCreateOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Neues Projekt</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label>Projektname</Label>
            <Input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="z. B. Website-Relaunch 2026"
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Abbrechen
            </Button>
            <Button onClick={handleCreate} disabled={creating || !newTitle.trim()}>
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
