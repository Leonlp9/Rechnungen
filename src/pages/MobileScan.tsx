// Beleg-Scan für das Handy:
// 1. Foto(s) mit der Kamera aufnehmen, jedes zuschneiden/drehen,
//    beliebig viele Seiten sammeln → EIN PDF in den Entwürfen.
// 2. Entwürfe direkt am Handy öffnen und mit KI-Erfassung als Rechnung
//    übernehmen (derselbe Dialog wie am Desktop).

import { useRef, useState } from 'react';
import {
  Camera,
  FileUp,
  RefreshCw,
  CloudUpload,
  Trash2,
  Pencil,
  FileCheck2,
  FileText,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import { writeFile, mkdir, exists } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { insertDraftDb, deleteDraftDb } from '@/lib/db';
import { deleteDraftFile } from '@/lib/pdf';
import { useAppStore, type InvoiceDraft } from '@/store';
import { runSync, loadSyncConfig, useSyncStatus } from '@/lib/sync';
import { PhotoEditor } from '@/components/scan/PhotoEditor';
import { NewInvoiceDialog } from '@/components/invoices/NewInvoiceDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

const DRAFTS_FOLDER = 'entwuerfe';

async function saveDraftBytes(bytes: Uint8Array, fileName: string): Promise<{ abs: string; rel: string }> {
  const base = await appDataDir();
  const dir = await join(base, DRAFTS_FOLDER);
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
  const abs = await join(dir, fileName);
  await writeFile(abs, bytes);
  return { abs, rel: `${DRAFTS_FOLDER}/${fileName}` };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Bild ungültig'));
    img.src = src;
  });
}

/** Mehrere Fotos → ein PDF, jede Seite passend auf A4 skaliert. */
async function photosToPdf(dataUrls: string[]): Promise<Uint8Array> {
  const pageW = 210;
  const pageH = 297;
  const margin = 8;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });

  for (let i = 0; i < dataUrls.length; i++) {
    if (i > 0) pdf.addPage();
    const img = await loadImage(dataUrls[i]);
    const scale = Math.min((pageW - 2 * margin) / img.width, (pageH - 2 * margin) / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const format = dataUrls[i].startsWith('data:image/png') ? 'PNG' : 'JPEG';
    pdf.addImage(dataUrls[i], format, (pageW - w) / 2, (pageH - h) / 2, w, h);
  }
  return new Uint8Array(pdf.output('arraybuffer'));
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Foto konnte nicht gelesen werden'));
    reader.readAsDataURL(file);
  });
}

export default function MobileScanPage() {
  const cameraRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  /** Fertig bearbeitete Seiten (Data-URLs) für das nächste PDF */
  const [pages, setPages] = useState<string[]>([]);
  /** Editor-Zustand: neues Foto oder erneutes Bearbeiten einer Seite */
  const [editor, setEditor] = useState<{ dataUrl: string; replaceIndex: number | null } | null>(null);
  const [activeDraft, setActiveDraft] = useState<InvoiceDraft | null>(null);
  const [confirmDeleteDraft, setConfirmDeleteDraft] = useState<InvoiceDraft | null>(null);

  const drafts = useAppStore((s) => s.drafts ?? []);
  const addDraft = useAppStore((s) => s.addDraft);
  const removeDraft = useAppStore((s) => s.removeDraft);
  const syncRunning = useSyncStatus((s) => s.running);

  const triggerSync = async () => {
    const config = await loadSyncConfig();
    if (config.kind !== 'none') void runSync().catch(() => {});
  };

  const handleCameraFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const dataUrl = await fileToDataUrl(files[0]);
      setEditor({ dataUrl, replaceIndex: null });
    } catch (e) {
      toast.error(`Foto konnte nicht geladen werden: ${e instanceof Error ? e.message : e}`);
    } finally {
      if (cameraRef.current) cameraRef.current.value = '';
    }
  };

  const handlePdfFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const id = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const bytes = new Uint8Array(await file.arrayBuffer());
        const { abs, rel } = await saveDraftBytes(bytes, `${id}.pdf`);
        const addedAt = new Date().toISOString();
        const name = file.name || `Dokument ${new Date().toLocaleString('de-DE')}.pdf`;
        await insertDraftDb(id, rel, name, addedAt);
        addDraft({ id, filePath: abs, relativePath: rel, fileName: name, addedAt });
      }
      toast.success(files.length === 1 ? 'PDF als Entwurf gespeichert!' : `${files.length} PDFs als Entwürfe gespeichert!`);
      void triggerSync();
    } catch (e) {
      toast.error(`Speichern fehlgeschlagen: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
      if (pdfRef.current) pdfRef.current.value = '';
    }
  };

  const handleEditorApply = (dataUrl: string) => {
    setPages((prev) => {
      if (editor?.replaceIndex !== null && editor?.replaceIndex !== undefined) {
        const next = [...prev];
        next[editor.replaceIndex] = dataUrl;
        return next;
      }
      return [...prev, dataUrl];
    });
    setEditor(null);
  };

  const handleSavePagesAsDraft = async () => {
    if (pages.length === 0) return;
    setBusy(true);
    try {
      const id = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const bytes = await photosToPdf(pages);
      const { abs, rel } = await saveDraftBytes(bytes, `${id}.pdf`);
      const addedAt = new Date().toISOString();
      const name = `Scan ${format(new Date(), 'dd.MM.yyyy HH:mm', { locale: de })} (${pages.length} Seite${pages.length > 1 ? 'n' : ''}).pdf`;
      await insertDraftDb(id, rel, name, addedAt);
      addDraft({ id, filePath: abs, relativePath: rel, fileName: name, addedAt });
      setPages([]);
      toast.success('Beleg gespeichert – unten in den Entwürfen erfassen.');
      void triggerSync();
    } catch (e) {
      toast.error(`Speichern fehlgeschlagen: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteDraft = async (draft: InvoiceDraft) => {
    await deleteDraftDb(draft.id).catch(() => {});
    if (draft.relativePath) await deleteDraftFile(draft.relativePath).catch(() => {});
    removeDraft(draft.id);
    setConfirmDeleteDraft(null);
    void triggerSync();
  };

  /** Nach dem Erfassen (gespeichert) den Entwurf entfernen – wie im Desktop-Panel */
  const handleDraftDialogClose = (saved?: boolean) => {
    if (saved && activeDraft) {
      deleteDraftDb(activeDraft.id).catch(() => {});
      if (activeDraft.relativePath) deleteDraftFile(activeDraft.relativePath).catch(() => {});
      removeDraft(activeDraft.id);
      void triggerSync();
    }
    setActiveDraft(null);
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">Beleg scannen</h1>
        <p className="text-sm text-muted-foreground">
          Fotografiere eine Rechnung (mehrere Seiten möglich), schneide sie zu und
          speichere sie als Entwurf – oder erfasse sie direkt mit KI.
        </p>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void handleCameraFile(e.target.files)}
      />
      <input
        ref={pdfRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => void handlePdfFiles(e.target.files)}
      />

      <Card className="rounded-xl">
        <CardContent className="flex flex-col gap-3 p-4">
          {pages.length === 0 ? (
            <Button size="lg" className="h-16 text-base" disabled={busy} onClick={() => cameraRef.current?.click()}>
              <Camera className="mr-2 h-6 w-6" />
              Foto aufnehmen
            </Button>
          ) : (
            <>
              {/* Gesammelte Seiten */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {pages.map((p, i) => (
                  <div key={i} className="relative shrink-0">
                    <img src={p} alt={`Seite ${i + 1}`} className="h-28 w-20 rounded-lg border object-cover" />
                    <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] font-medium text-white">
                      {i + 1}
                    </span>
                    <div className="absolute -right-1 -top-1 flex gap-0.5">
                      <button
                        type="button"
                        className="rounded-full bg-background border p-1 shadow"
                        aria-label={`Seite ${i + 1} bearbeiten`}
                        onClick={() => setEditor({ dataUrl: p, replaceIndex: i })}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        className="rounded-full bg-background border p-1 shadow text-destructive"
                        aria-label={`Seite ${i + 1} entfernen`}
                        onClick={() => setPages((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="flex h-28 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-muted-foreground"
                  onClick={() => cameraRef.current?.click()}
                >
                  <Plus className="h-5 w-5" />
                  <span className="text-[11px]">Seite</span>
                </button>
              </div>
              <Button size="lg" className="h-12" disabled={busy} onClick={handleSavePagesAsDraft}>
                <FileCheck2 className="mr-2 h-5 w-5" />
                {busy ? 'Speichere …' : `Als PDF speichern (${pages.length} Seite${pages.length > 1 ? 'n' : ''})`}
              </Button>
            </>
          )}
          <Button variant="outline" size="lg" className="h-12" disabled={busy} onClick={() => pdfRef.current?.click()}>
            <FileUp className="mr-2 h-5 w-5" />
            PDF auswählen
          </Button>
        </CardContent>
      </Card>

      {/* Entwürfe: direkt am Handy erfassen (inkl. KI-Analyse) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Entwürfe ({drafts.length})</h2>
          {syncRunning ? (
            <RefreshCw className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <CloudUpload className="ml-auto h-4 w-4 text-muted-foreground" />
          )}
        </div>
        {drafts.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            Keine Entwürfe. Gescannte Belege landen hier – auf allen Geräten.
          </p>
        ) : (
          <div className="space-y-1.5">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="flex items-center gap-3 rounded-xl border bg-card p-3"
                onClick={() => setActiveDraft(draft)}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{draft.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(draft.addedAt), 'dd.MM.yyyy, HH:mm', { locale: de })}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-muted-foreground"
                  aria-label="Entwurf löschen"
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteDraft(draft); }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
            ))}
          </div>
        )}
      </div>

      {editor && (
        <PhotoEditor
          dataUrl={editor.dataUrl}
          onCancel={() => setEditor(null)}
          onApply={handleEditorApply}
        />
      )}

      {activeDraft && (
        <NewInvoiceDialog
          open={!!activeDraft}
          onClose={handleDraftDialogClose}
          initialPdfPath={activeDraft.filePath}
          initialPdfName={activeDraft.fileName}
        />
      )}

      <ConfirmDialog
        open={!!confirmDeleteDraft}
        title="Entwurf löschen?"
        description={`„${confirmDeleteDraft?.fileName}" wird unwiderruflich gelöscht.`}
        confirmLabel="Löschen"
        destructive
        onConfirm={() => confirmDeleteDraft && void handleDeleteDraft(confirmDeleteDraft)}
        onCancel={() => setConfirmDeleteDraft(null)}
      />
    </div>
  );
}
