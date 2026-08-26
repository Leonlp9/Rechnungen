// Beleg-Scan für das Handy:
// 1. Foto(s) mit der Kamera aufnehmen, jedes zuschneiden/drehen,
//    beliebig viele Seiten sammeln → EIN PDF in den Entwürfen.
// 2. Entwürfe direkt am Handy öffnen und mit KI-Erfassung als Rechnung
//    übernehmen (derselbe Dialog wie am Desktop).

import { useRef, useState } from 'react';
import {
  Camera,
  ImagePlus,
  FileUp,
  Trash2,
  Pencil,
  FileCheck2,
  FileText,
  Plus,
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import { writeFile, mkdir, exists } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { ListGroup, ListRow } from '@/components/ui/list-group';
import { DraftListGroup } from '@/components/invoices/DraftListGroup';
import { toast } from 'sonner';
import { insertDraftDb, deleteDraftDb } from '@/lib/db';
import { deleteDraftFile } from '@/lib/pdf';
import { useAppStore, type InvoiceDraft } from '@/store';
import { runSync, loadSyncConfig } from '@/lib/sync';
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
  const galleryRef = useRef<HTMLInputElement>(null);
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

  /**
   * Bilder aus der Galerie. Ein einzelnes geht durch den Zuschnitt wie ein
   * frisches Foto; mehrere landen direkt als Seiten – sonst müsste man sich
   * durch einen Zuschnitt nach dem anderen tippen.
   */
  const handleGalleryFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const liste = Array.from(files);
    try {
      if (liste.length === 1) {
        const dataUrl = await fileToDataUrl(liste[0]);
        setEditor({ dataUrl, replaceIndex: null });
        return;
      }
      const urls = await Promise.all(liste.map(fileToDataUrl));
      setPages((prev) => [...prev, ...urls]);
      toast.success(`${urls.length} Bilder als Seiten übernommen`);
    } catch (e) {
      toast.error(`Bild konnte nicht geladen werden: ${e instanceof Error ? e.message : e}`);
    } finally {
      if (galleryRef.current) galleryRef.current.value = '';
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
    <div className="mx-auto flex max-w-md flex-col gap-7">
      <PageHeader
        title="Beleg scannen"
        subtitle="Foto machen, Bild auswählen oder PDF – landet als Entwurf hier und auf allen Geräten."
      />

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void handleCameraFile(e.target.files)}
      />
      {/* Ohne `capture`: Damit öffnet sich die Galerie statt der Kamera. */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void handleGalleryFiles(e.target.files)}
      />
      <input
        ref={pdfRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => void handlePdfFiles(e.target.files)}
      />

      {/* ── Aufnehmen ──
          Ohne Karte drumherum: Zwei Knöpfe brauchen keinen eigenen Kasten,
          und übereinander gestapelte Flächen wirkten unruhig. */}
      {pages.length === 0 ? (
        <div className="space-y-2.5">
          <Button
            className="h-[50px] w-full text-[17px] font-semibold"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
          >
            <Camera className="mr-2 h-5 w-5" />
            Foto aufnehmen
          </Button>
          <Button
            variant="secondary"
            className="h-[50px] w-full text-[17px]"
            disabled={busy}
            onClick={() => galleryRef.current?.click()}
          >
            <ImagePlus className="mr-2 h-5 w-5" />
            Foto auswählen
          </Button>
          <Button
            variant="secondary"
            className="h-[50px] w-full text-[17px]"
            disabled={busy}
            onClick={() => pdfRef.current?.click()}
          >
            <FileUp className="mr-2 h-5 w-5" />
            PDF auswählen
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Gesammelte Seiten */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {pages.map((p, i) => (
              <div key={i} className="relative shrink-0">
                <img src={p} alt={`Seite ${i + 1}`} className="h-28 w-20 rounded-xl object-cover" />
                <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] font-medium text-white">
                  {i + 1}
                </span>
                <div className="absolute -right-1 -top-1 flex gap-0.5">
                  <button
                    type="button"
                    className="rounded-full border bg-background p-1 shadow"
                    aria-label={`Seite ${i + 1} bearbeiten`}
                    onClick={() => setEditor({ dataUrl: p, replaceIndex: i })}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className="rounded-full border bg-background p-1 text-destructive shadow"
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
              className="flex h-28 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-muted-foreground"
              onClick={() => cameraRef.current?.click()}
            >
              <Plus className="h-5 w-5" />
              <span className="text-[11px]">Foto</span>
            </button>
            {/* Auch eine weitere Seite darf aus der Galerie kommen – nicht
                jeder Beleg liegt noch auf dem Tisch. */}
            <button
              type="button"
              className="flex h-28 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-muted-foreground"
              onClick={() => galleryRef.current?.click()}
            >
              <ImagePlus className="h-5 w-5" />
              <span className="text-[11px]">Auswählen</span>
            </button>
          </div>
          <Button
            className="h-[50px] w-full text-[17px] font-semibold"
            disabled={busy}
            onClick={handleSavePagesAsDraft}
          >
            <FileCheck2 className="mr-2 h-5 w-5" />
            {busy ? 'Speichere …' : `Als PDF speichern (${pages.length} Seite${pages.length > 1 ? 'n' : ''})`}
          </Button>
          <Button
            variant="ghost"
            className="h-11 w-full text-[17px]"
            disabled={busy}
            onClick={() => pdfRef.current?.click()}
          >
            Stattdessen PDF auswählen
          </Button>
        </div>
      )}

      {/* ── Entwürfe ── */}
      {drafts.length === 0 ? (
        <ListGroup title="Entwürfe" footer="Entwürfe gleichen sich mit deinen anderen Geräten ab.">
          <ListRow
            icon={<FileText />}
            label="Noch keine Entwürfe"
            hint="Gescannte Belege landen hier"
            noChevron
          />
        </ListGroup>
      ) : (
        <DraftListGroup
          title={`Entwürfe (${drafts.length})`}
          footer="Tippe einen Entwurf an, um ihn als Beleg zu erfassen."
          drafts={drafts}
          onOpen={setActiveDraft}
          onDelete={setConfirmDeleteDraft}
        />
      )}

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
