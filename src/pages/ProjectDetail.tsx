import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { projects } from '@/lib/db';
import { queryKeys } from '@/lib/queryKeys';
import type { Project, ProjectLink, Invoice } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  FolderKanban,
  ArrowLeft,
  Pencil,
  Check,
  X,
  Plus,
  Trash2,
  ExternalLink,
  PlayCircle,
  Receipt,
  TrendingUp,
  TrendingDown,
  Link2,
} from 'lucide-react';
import { fmtCurrency } from '@/lib/utils';
import { useAppStore } from '@/store';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { CATEGORY_LABELS, TYPE_LABELS } from '@/types';

function getYoutubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    let videoId = '';
    if (u.hostname.includes('youtu.be')) {
      videoId = u.pathname.slice(1);
    } else if (u.hostname.includes('youtube.com')) {
      videoId = u.searchParams.get('v') ?? '';
    }
    if (!videoId) return null;
    return `https://www.youtube.com/embed/${videoId}`;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Rich Text Editor
// ---------------------------------------------------------------------------
function RichTextEditor({
                          initialValue,
                          onSave,
                          onCancel,
                          saving,
                        }: {
  initialValue: string;
  onSave: (html: string) => void;
  onCancel: () => void;
  saving?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = initialValue || '';
      // Move cursor to end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(ref.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
      ref.current.focus();
    }
  }, []);

  const exec = (cmd: string) => {
    document.execCommand(cmd, false, undefined);
    ref.current?.focus();
  };

  type ToolDef = { cmd: string; label: string; cls?: string };
  const tools: ToolDef[] = [
    { cmd: 'bold', label: 'B', cls: 'font-bold' },
    { cmd: 'italic', label: 'I', cls: 'italic' },
    { cmd: 'underline', label: 'U', cls: 'underline' },
  ];

  return (
      <div className="border rounded-lg overflow-hidden bg-background shadow-sm">
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b bg-muted/40">
          {tools.map(({ cmd, label, cls }) => (
              <button
                  key={cmd}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    exec(cmd);
                  }}
                  className={`w-7 h-7 rounded text-xs hover:bg-muted transition-colors ${cls ?? ''}`}
                  title={cmd}
              >
                {label}
              </button>
          ))}
          <div className="w-px h-4 bg-border mx-1.5" />
          <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                exec('insertUnorderedList');
              }}
              className="px-2 h-7 rounded text-xs hover:bg-muted transition-colors"
              title="Aufzählung"
          >
            • Liste
          </button>
          <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                exec('insertOrderedList');
              }}
              className="px-2 h-7 rounded text-xs hover:bg-muted transition-colors"
              title="Nummerierte Liste"
          >
            1. Liste
          </button>
        </div>

        {/* Editable Area */}
        <div
            ref={ref}
            contentEditable
            suppressContentEditableWarning
            className={[
              'min-h-[100px] max-h-[320px] overflow-y-auto p-3 text-sm focus:outline-none',
              '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-0.5',
              '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-0.5',
              '[&_b]:font-bold [&_strong]:font-bold',
              '[&_i]:italic [&_em]:italic',
              '[&_u]:underline',
              '[&_p]:mb-1 last:[&_p]:mb-0',
            ].join(' ')}
            style={{ lineHeight: '1.6' }}
            data-placeholder="Projektbeschreibung…"
            onKeyDown={(e) => {
              if (e.key === 'Escape') onCancel();
            }}
        />

        {/* Actions */}
        <div className="flex gap-2 justify-end p-2 border-t bg-muted/20">
          <Button size="sm" variant="outline" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button
              size="sm"
              onClick={() => onSave(ref.current?.innerHTML ?? '')}
              disabled={saving}
          >
            Speichern
          </Button>
        </div>
      </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const privacyMode = useAppStore((s) => s.privacyMode);

  const { data: project, isLoading } = useQuery<Project | null>({
    queryKey: queryKeys.projects.detail(id!),
    queryFn: () => projects.getById(id!),
    enabled: !!id,
    staleTime: 30_000,
  });

  const [projectInvoices, setProjectInvoices] = useState<Invoice[]>([]);
  useEffect(() => {
    if (id) projects.getInvoices(id).then(setProjectInvoices).catch(() => {});
  }, [id]);

  // Editing state
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);

  // Add link / media
  type AddMode = 'link' | 'youtube' | null;
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [youtubeDraft, setYoutubeDraft] = useState('');

  const [saving, setSaving] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const save = async (fields: Partial<Omit<Project, 'id' | 'created_at'>>) => {
    if (!id) return;
    setSaving(true);
    try {
      await projects.update(id, fields);
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    } catch (e) {
      toast.error('Fehler: ' + String(e));
    } finally {
      setSaving(false);
    }
  };

  const cancelAdd = () => {
    setAddMode(null);
    setNewLinkUrl('');
    setNewLinkLabel('');
    setYoutubeDraft('');
  };

  const submitLink = () => {
    if (!newLinkUrl.trim()) return;
    const newLinks: ProjectLink[] = [
      ...project!.links,
      { url: newLinkUrl.trim(), label: newLinkLabel.trim() },
    ];
    save({ links: newLinks });
    cancelAdd();
  };

  const submitYoutube = () => {
    save({ youtube_url: youtubeDraft.trim() });
    cancelAdd();
  };

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Lade…</div>;
  }
  if (!project) {
    return (
        <div className="p-6 space-y-4">
          <p className="text-muted-foreground">Projekt nicht gefunden.</p>
          <Button variant="outline" onClick={() => navigate('/projects')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Zurück
          </Button>
        </div>
    );
  }

  const totalBrutto = projectInvoices.reduce((s, inv) => {
    if (inv.type === 'ausgabe') return s - inv.brutto;
    if (inv.type === 'einnahme') return s + inv.brutto;
    return s;
  }, 0);
  const totalExpenses = projectInvoices
      .filter((i) => i.type === 'ausgabe')
      .reduce((s, i) => s + i.brutto, 0);
  const totalIncome = projectInvoices
      .filter((i) => i.type === 'einnahme')
      .reduce((s, i) => s + i.brutto, 0);

  const embedUrl = getYoutubeEmbedUrl(project.youtube_url);
  const hasLinksOrMedia = project.links.length > 0 || !!project.youtube_url;

  return (
      <div className="p-6 max-w-4xl space-y-6">
        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <FolderKanban className="h-5 w-5 text-primary" />
          </div>
          {editingTitle ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                    autoFocus
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    className="text-xl font-bold h-9 max-w-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        save({ title: titleDraft.trim() || project.title });
                        setEditingTitle(false);
                      } else if (e.key === 'Escape') {
                        setEditingTitle(false);
                      }
                    }}
                />
                <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      save({ title: titleDraft.trim() || project.title });
                      setEditingTitle(false);
                    }}
                    disabled={saving}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setEditingTitle(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
          ) : (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <h1 className="text-2xl font-bold truncate">{project.title}</h1>
                <button
                    className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                    onClick={() => {
                      setTitleDraft(project.title);
                      setEditingTitle(true);
                    }}
                    title="Titel bearbeiten"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
          )}
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border bg-card p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Rechnungen</p>
            <p className="text-2xl font-bold">{projectInvoices.length}</p>
          </div>
          <div className="rounded-xl border bg-card p-4 space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingDown className="h-3 w-3 text-red-500" />
              Ausgaben
            </div>
            <p className="text-2xl font-bold text-red-600">
              {fmtCurrency(totalExpenses, privacyMode)}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4 space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 text-green-500" />
              Einnahmen
            </div>
            <p className="text-2xl font-bold text-green-600">
              {fmtCurrency(totalIncome, privacyMode)}
            </p>
          </div>
        </div>

        {/* ── Description ── */}
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">Beschreibung</h2>
            {!editingDesc && (
                <button
                    className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    onClick={() => setEditingDesc(true)}
                    title="Beschreibung bearbeiten"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
            )}
          </div>

          {editingDesc ? (
              <RichTextEditor
                  initialValue={project.description}
                  onSave={(html) => {
                    save({ description: html });
                    setEditingDesc(false);
                  }}
                  onCancel={() => setEditingDesc(false)}
                  saving={saving}
              />
          ) : project.description ? (
              <div
                  className={[
                    'text-sm text-muted-foreground',
                    '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-0.5',
                    '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-0.5',
                    '[&_b]:font-bold [&_strong]:font-bold',
                    '[&_i]:italic [&_em]:italic',
                    '[&_u]:underline',
                  ].join(' ')}
                  dangerouslySetInnerHTML={{ __html: project.description }}
              />
          ) : (
              <p className="text-sm text-muted-foreground italic">
                Keine Beschreibung. Klicke auf den Stift, um eine hinzuzufügen.
              </p>
          )}
        </div>

        {/* ── Links & Medien (nur wenn Inhalt vorhanden) ── */}
        {hasLinksOrMedia && (
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <h2 className="font-semibold text-sm">Links & Medien</h2>

              {/* Web-Links */}
              {project.links.length > 0 && (
                  <div className="space-y-1.5">
                    {project.links.map((link, i) => (
                        <div key={i} className="flex items-center gap-2 group rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors -mx-2">
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline flex-1 truncate"
                              onClick={(e) => e.stopPropagation()}
                          >
                            {link.label || link.url}
                          </a>
                          <button
                              className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
                              onClick={() => {
                                const newLinks = project.links.filter((_, idx) => idx !== i);
                                save({ links: newLinks });
                              }}
                              title="Link entfernen"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                    ))}
                  </div>
              )}

              {/* Trennlinie wenn beides vorhanden */}
              {project.links.length > 0 && embedUrl && (
                  <div className="border-t" />
              )}

              {/* YouTube-Embed */}
              {embedUrl && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <PlayCircle className="h-3.5 w-3.5 text-red-500" />
                        YouTube-Video
                      </div>
                      <button
                          className="rounded p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                          onClick={() => save({ youtube_url: '' })}
                          title="Video entfernen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="aspect-video rounded-lg overflow-hidden bg-black">
                      <iframe
                          src={embedUrl}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          title="YouTube-Video"
                      />
                    </div>
                  </div>
              )}
            </div>
        )}

        {/* ── Hinzufügen-Bereich ── */}
        {addMode === 'link' ? (
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <h2 className="font-semibold text-sm flex items-center gap-1.5">
                <Link2 className="h-4 w-4" />
                Web-Link hinzufügen
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">URL</Label>
                  <Input
                      autoFocus
                      placeholder="https://…"
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                      className="h-8 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitLink();
                        if (e.key === 'Escape') cancelAdd();
                      }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Bezeichnung (optional)</Label>
                  <Input
                      placeholder="z. B. Briefing-Dokument"
                      value={newLinkLabel}
                      onChange={(e) => setNewLinkLabel(e.target.value)}
                      className="h-8 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitLink();
                        if (e.key === 'Escape') cancelAdd();
                      }}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={cancelAdd}>
                  Abbrechen
                </Button>
                <Button size="sm" disabled={!newLinkUrl.trim() || saving} onClick={submitLink}>
                  Hinzufügen
                </Button>
              </div>
            </div>
        ) : addMode === 'youtube' ? (
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <h2 className="font-semibold text-sm flex items-center gap-1.5">
                <PlayCircle className="h-4 w-4 text-red-500" />
                YouTube-Video hinzufügen
              </h2>
              <Input
                  autoFocus
                  placeholder="https://www.youtube.com/watch?v=…"
                  value={youtubeDraft}
                  onChange={(e) => setYoutubeDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitYoutube();
                    if (e.key === 'Escape') cancelAdd();
                  }}
              />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={cancelAdd}>
                  Abbrechen
                </Button>
                <Button size="sm" disabled={saving || !youtubeDraft.trim()} onClick={submitYoutube}>
                  Speichern
                </Button>
              </div>
            </div>
        ) : (
            /* Dropdown-Button zum Hinzufügen */
            <div className="relative" ref={addMenuRef}>
              <button
                  onClick={() => setShowAddMenu((v) => !v)}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors py-0.5 select-none"
              >
                <Plus className="h-4 w-4" />
                Hinzufügen
              </button>

              {showAddMenu && (
                  <div className="absolute left-0 top-8 z-20 bg-popover border rounded-lg shadow-lg p-1 min-w-[190px] animate-in fade-in-0 zoom-in-95 duration-100">
                    <button
                        onClick={() => {
                          setAddMode('link');
                          setShowAddMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted flex items-center gap-2.5 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      Web-Link
                    </button>
                    <button
                        onClick={() => {
                          setAddMode('youtube');
                          setShowAddMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted flex items-center gap-2.5 transition-colors"
                    >
                      <PlayCircle className="h-3.5 w-3.5 text-red-500" />
                      YouTube-Video
                    </button>
                  </div>
              )}
            </div>
        )}

        {/* ── Rechnungen ── */}
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <h2 className="font-semibold text-sm flex items-center gap-1.5">
            <Receipt className="h-4 w-4" />
            Rechnungen ({projectInvoices.length})
          </h2>
          {projectInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Noch keine Rechnungen zugeordnet. Weise beim Erstellen oder Bearbeiten einer
                Rechnung dieses Projekt zu.
              </p>
          ) : (
              <div className="divide-y rounded-lg border overflow-hidden">
                {projectInvoices.map((inv) => (
                    <Link
                        key={inv.id}
                        to={`/invoices/${inv.id}`}
                        className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors group"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Badge
                              variant={inv.type === 'einnahme' ? 'default' : 'secondary'}
                              className="text-[10px] px-1.5 py-0"
                          >
                            {TYPE_LABELS[inv.type]}
                          </Badge>
                          <p className="font-medium text-sm truncate">
                            {inv.description || inv.partner}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {inv.partner} ·{' '}
                          {format(new Date(inv.date), 'dd.MM.yyyy', { locale: de })} ·{' '}
                          {CATEGORY_LABELS[inv.category] ?? inv.category}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span
                      className={`font-semibold text-sm ${
                          inv.type === 'einnahme'
                              ? 'text-green-600'
                              : inv.type === 'ausgabe'
                                  ? 'text-red-600'
                                  : 'text-muted-foreground'
                      }`}
                  >
                    {inv.type === 'einnahme' ? '+' : inv.type === 'ausgabe' ? '−' : ''}
                    {fmtCurrency(inv.brutto, privacyMode)}
                  </span>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                ))}
              </div>
          )}
          {totalBrutto !== 0 && (
              <div className="flex justify-end pt-1">
                <p className="text-sm font-semibold">
                  Gesamt:{' '}
                  <span className={totalBrutto >= 0 ? 'text-green-600' : 'text-red-600'}>
                {totalBrutto >= 0 ? '+' : ''}
                    {fmtCurrency(totalBrutto, privacyMode)}
              </span>
                </p>
              </div>
          )}
        </div>
      </div>
  );
}