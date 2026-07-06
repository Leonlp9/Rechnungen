// Beleg-Scan für das Handy: Foto mit der Kamera aufnehmen (oder PDF wählen),
// als PDF in den Entwürfe-Ordner legen und über den Cloud-Sync an alle
// Geräte verteilen. Am Desktop taucht der Beleg im Entwürfe-Panel auf.

import { useRef, useState } from 'react';
import { Camera, FileUp, CheckCircle2, RefreshCw, CloudUpload } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { writeFile, mkdir, exists } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { insertDraftDb } from '@/lib/db';
import { useAppStore } from '@/store';
import { runSync, loadSyncConfig, useSyncStatus } from '@/lib/sync';

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

/** Foto → einseitiges A4-PDF (passend skaliert). */
async function photoToPdf(file: File): Promise<Uint8Array> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Foto konnte nicht gelesen werden'));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Bild ungültig'));
    el.src = dataUrl;
  });

  const pageW = 210;
  const pageH = 297;
  const margin = 8;
  const maxW = pageW - 2 * margin;
  const maxH = pageH - 2 * margin;
  const scale = Math.min(maxW / img.width, maxH / img.height);
  const w = img.width * scale;
  const h = img.height * scale;

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const format = /png$/i.test(file.type) ? 'PNG' : 'JPEG';
  pdf.addImage(dataUrl, format, (pageW - w) / 2, (pageH - h) / 2, w, h);
  return new Uint8Array(pdf.output('arraybuffer'));
}

export default function MobileScanPage() {
  const cameraRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const addDraft = useAppStore((s) => s.addDraft);
  const syncRunning = useSyncStatus((s) => s.running);

  const handleFiles = async (files: FileList | null, isPdf: boolean) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const id = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const bytes = isPdf ? new Uint8Array(await file.arrayBuffer()) : await photoToPdf(file);
        const fileName = `${id}.pdf`;
        const { abs, rel } = await saveDraftBytes(bytes, fileName);
        const addedAt = new Date().toISOString();
        const displayName = isPdf && file.name ? file.name : `Scan ${new Date().toLocaleString('de-DE')}.pdf`;
        await insertDraftDb(id, rel, displayName, addedAt);
        addDraft({ id, filePath: abs, relativePath: rel, fileName: displayName, addedAt });
        setLastSaved(displayName);
      }
      toast.success(
        files.length === 1 ? 'Beleg gespeichert!' : `${files.length} Belege gespeichert!`,
      );
      // Direkt hochsyncen, wenn ein Anbieter konfiguriert ist
      const config = await loadSyncConfig();
      if (config.kind !== 'none') {
        void runSync().catch(() => {});
      }
    } catch (e) {
      toast.error(`Speichern fehlgeschlagen: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = '';
      if (pdfRef.current) pdfRef.current.value = '';
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-2">
      <div>
        <h1 className="text-xl font-bold">Beleg scannen</h1>
        <p className="text-sm text-muted-foreground">
          Fotografiere eine Rechnung oder wähle ein PDF. Der Beleg landet in den
          Entwürfen und wird auf alle Geräte synchronisiert.
        </p>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files, false)}
      />
      <input
        ref={pdfRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files, true)}
      />

      <Card className="rounded-xl">
        <CardContent className="flex flex-col gap-3 p-4">
          <Button
            size="lg"
            className="h-16 text-base"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
          >
            <Camera className="mr-2 h-6 w-6" />
            {busy ? 'Verarbeite …' : 'Foto aufnehmen'}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-12"
            disabled={busy}
            onClick={() => pdfRef.current?.click()}
          >
            <FileUp className="mr-2 h-5 w-5" />
            PDF auswählen
          </Button>
        </CardContent>
      </Card>

      {lastSaved && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          <span className="min-w-0 truncate">Gespeichert: {lastSaved}</span>
          {syncRunning ? (
            <RefreshCw className="ml-auto h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <CloudUpload className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </div>
      )}
    </div>
  );
}
