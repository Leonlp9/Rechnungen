import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { projects } from '@/lib/db';
import { queryKeys } from '@/lib/queryKeys';
import type { Project } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DialogFooter } from '@/components/ui/dialog';
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
import { useIsMobile } from '@/hooks/useIsMobile';
import { PageHeader } from '@/components/layout/PageHeader';
import { ListGroup, ListRow } from '@/components/ui/list-group';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { FormGroup, FormFullRow } from '@/components/ui/form-list';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const invoices = useAppStore((s) => s.invoices);
  const privacyMode = useAppStore((s) => s.privacyMode);
  const isMobile = useIsMobile();

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

  // Beschreibung kommt als HTML aus dem Editor – für die Listenzeile reicht
  // der reine Text, sonst stünden dort Auszeichnungen mitten im Satz.
  const plainText = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  const createModal = (
    <ResponsiveModal
      open={createOpen}
      onClose={() => setCreateOpen(false)}
      title="Neues Projekt"
      desktopClassName="max-w-sm"
    >
      {isMobile ? (
        <div className="space-y-6">
          <FormGroup footer="Rechnungen lassen sich später einem Projekt zuordnen.">
            <FormFullRow>
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="z. B. Website-Relaunch 2026"
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                className="w-full bg-transparent text-[17px] outline-none placeholder:text-muted-foreground"
              />
            </FormFullRow>
          </FormGroup>
          <Button
            onClick={handleCreate}
            disabled={creating || !newTitle.trim()}
            className="h-[50px] w-full text-[17px] font-semibold"
          >
            Projekt erstellen
          </Button>
        </div>
      ) : (
        <>
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
        </>
      )}
    </ResponsiveModal>
  );

  const deleteConfirm = (
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
  );

  // ── Handy ──
  if (isMobile) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Projekte"
          subtitle={projectList.length > 0 ? `${projectList.length} angelegt` : undefined}
          actions={
            <Button size="icon" onClick={() => { setNewTitle(''); setCreateOpen(true); }} aria-label="Neues Projekt">
              <Plus className="h-5 w-5" />
            </Button>
          }
        />

        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Lade …</p>
        ) : projectList.length === 0 ? (
          <ListGroup footer="Projekte bündeln Rechnungen, damit die Gesamtkosten sichtbar bleiben.">
            <ListRow
              icon={<FolderKanban />}
              label="Noch keine Projekte"
              hint="Mit + oben rechts anlegen"
              noChevron
            />
          </ListGroup>
        ) : (
          <ListGroup>
            {projectList.map((project) => {
              const stats = statsById[project.id] ?? { count: 0, total: 0 };
              const desc = project.description ? plainText(project.description) : '';
              return (
                <div key={project.id} className="flex w-full items-stretch">
                  <button
                    type="button"
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="flex min-w-0 flex-1 items-stretch text-left active:bg-accent"
                  >
                    <span
                      data-tint="yellow"
                      className="my-[7px] ml-4 flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-[8px] bg-muted text-muted-foreground"
                    >
                      <FolderKanban className="h-4 w-4" />
                    </span>
                    <span data-row-body className="ml-3 flex min-h-[44px] min-w-0 flex-1 items-center gap-3 border-b border-border py-2 pr-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[17px] leading-tight">{project.title}</span>
                        <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
                          {stats.count} Rechnung{stats.count !== 1 ? 'en' : ''}{desc ? ` · ${desc}` : ''}
                        </span>
                      </span>
                      {stats.total !== 0 && (
                        <span className={`shrink-0 text-[17px] ${stats.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {fmtCurrency(stats.total, privacyMode)}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingId(project.id)}
                    aria-label={`${project.title} löschen`}
                    className="flex shrink-0 items-center active:opacity-60"
                  >
                    <span data-row-body className="flex h-full items-center border-b border-border pr-4 pl-1 text-destructive">
                      <Trash2 className="h-[18px] w-[18px]" />
                    </span>
                  </button>
                </div>
              );
            })}
          </ListGroup>
        )}

        {createModal}
        {deleteConfirm}
      </div>
    );
  }

  return (
      <div className="space-y-6">
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

        {createModal}
        {deleteConfirm}
      </div>
  );
}