import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { projects } from '@/lib/db';
import { queryKeys } from '@/lib/queryKeys';
import type { Project } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { FolderKanban, Plus, Trash2, ChevronRight, Receipt } from 'lucide-react';
import { useAppStore } from '@/store';
import { fmtCurrency } from '@/lib/utils';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const invoices = useAppStore((s) => s.invoices);
  const privacyMode = useAppStore((s) => s.privacyMode);

  const { data: projectList = [], isLoading } = useQuery<Project[]>({
    queryKey: queryKeys.projects.all,
    queryFn: () => projects.getAll(),
    staleTime: 30_000,
  });

  const statsById = projectList.reduce<Record<string, { count: number; total: number }>>(
      (acc, p) => {
        const projectInvoices = invoices.filter((inv) => inv.project_id === p.id);
        acc[p.id] = {
          count: projectInvoices.length,
          total: projectInvoices.reduce((s, inv) => {
            if (inv.type === 'ausgabe') return s - inv.brutto;
            if (inv.type === 'einnahme') return s + inv.brutto;
            return s;
          }, 0),
        };
        return acc;
      },
      {},
  );

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      const project = await projects.create(title);
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      toast.success(`Projekt „${title}" erstellt`);
      setCreateOpen(false);
      navigate(`/projects/${project.id}`);
    } catch (e) {
      toast.error('Fehler beim Erstellen: ' + String(e));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await projects.delete(deletingId);
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      toast.success('Projekt gelöscht');
    } catch (e) {
      toast.error('Fehler beim Löschen: ' + String(e));
    } finally {
      setDeletingId(null);
    }
  };

  return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderKanban className="h-6 w-6" />
            Projekte
          </h1>
          <Button onClick={() => { setNewTitle(''); setCreateOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Neues Projekt
          </Button>
        </div>

        {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-16">Lade…</p>
        ) : projectList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <FolderKanban className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold">Noch keine Projekte</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Erstelle ein Projekt, um Rechnungen zu gruppieren und die Gesamtkosten im Blick zu behalten.
                </p>
              </div>
              <Button onClick={() => { setNewTitle(''); setCreateOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                Erstes Projekt erstellen
              </Button>
            </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projectList.map((project) => {
                const stats = statsById[project.id] ?? { count: 0, total: 0 };
                return (
                    <div
                        key={project.id}
                        className="group relative rounded-xl border bg-card hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                        onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      <div className="p-5 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                              <FolderKanban className="h-5 w-5 text-primary" />
                            </div>
                            <h2 className="font-semibold truncate text-sm leading-tight">{project.title}</h2>
                          </div>
                          <button
                              className="shrink-0 rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                              onClick={(e) => { e.stopPropagation(); setDeletingId(project.id); }}
                              title="Projekt löschen"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Beschreibung: HTML aus dem Rich-Text-Editor korrekt rendern */}
                        {project.description && (
                            <div
                                className={[
                                  'text-xs text-muted-foreground line-clamp-2',
                                  '[&_ul]:list-disc [&_ul]:pl-4',
                                  '[&_ol]:list-decimal [&_ol]:pl-4',
                                  '[&_b]:font-bold [&_strong]:font-bold',
                                  '[&_i]:italic [&_em]:italic',
                                  '[&_u]:underline',
                                ].join(' ')}
                                dangerouslySetInnerHTML={{ __html: project.description }}
                            />
                        )}

                        <div className="flex items-center justify-between pt-1 border-t">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Receipt className="h-3.5 w-3.5" />
                            <span>{stats.count} Rechnung{stats.count !== 1 ? 'en' : ''}</span>
                          </div>
                          <div className={`text-sm font-semibold ${stats.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {stats.total !== 0 && (stats.total >= 0 ? '+' : '')}
                            {fmtCurrency(stats.total, privacyMode)}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                );
              })}
            </div>
        )}

        {/* Create Dialog */}
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

        {/* Delete Confirm */}
        <AlertDialog open={!!deletingId} onOpenChange={(o) => { if (!o) setDeletingId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Projekt löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Das Projekt wird gelöscht. Die verknüpften Rechnungen bleiben erhalten, verlieren aber die Projektzuordnung.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Löschen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
  );
}