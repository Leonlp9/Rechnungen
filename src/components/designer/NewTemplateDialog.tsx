import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, PenLine, Upload, FileImage, Loader2, AlertCircle } from 'lucide-react';
import { analyzeInvoiceLayoutWithAI, type AiTemplateResult } from '@/lib/gemini';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreateFromScratch: () => void;
  onCreateFromAI: (result: AiTemplateResult) => void;
}

export function NewTemplateDialog({ open, onClose, onCreateFromScratch, onCreateFromAI }: Props) {
  const [mode, setMode] = useState<'choose' | 'ai'>('choose');
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setMode('choose');
    setFile(null);
    setPreview(null);
    setLoading(false);
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleFileSelect(f: File) {
    if (!f.type.startsWith('image/') && f.type !== 'application/pdf') {
      setError('Bitte nur Bilder (JPG, PNG) oder PDF-Dateien auswählen.');
      return;
    }
    setError(null);
    setFile(f);
    if (f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileSelect(f);
  }

  async function handleAnalyze() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = (e) => {
          const result = e.target?.result as string;
          // Strip data URL prefix
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await analyzeInvoiceLayoutWithAI(base64, file.type);
      reset();
      onCreateFromAI(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Neues Template erstellen</DialogTitle>
        </DialogHeader>

        {mode === 'choose' && (
          <div className="flex flex-col gap-3 pt-2">
            <p className="text-sm text-muted-foreground">Wie möchtest du das Template erstellen?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                className="flex flex-col items-center gap-3 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 p-6 transition-colors text-left"
                onClick={() => { reset(); onCreateFromScratch(); }}
              >
                <PenLine className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-semibold text-sm">Von Scratch</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Leere Vorlage, alles selbst gestalten</p>
                </div>
              </button>
              <button
                className="flex flex-col items-center gap-3 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 p-6 transition-colors text-left"
                onClick={() => setMode('ai')}
              >
                <Sparkles className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="font-semibold text-sm">Mit KI</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Bild oder PDF hochladen, KI baut das Layout nach</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {mode === 'ai' && (
          <div className="flex flex-col gap-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Lade eine Rechnung als <strong>Bild (JPG/PNG)</strong> oder <strong>PDF</strong> hoch.
              Die KI analysiert das Layout und baut alle Elemente automatisch nach.
              <br />
              <span className="text-xs mt-1 block text-amber-600">Hinweis: Bildplatzhalter (z.B. Logos) werden als leere Bildfelder eingefügt – du kannst dort anschließend dein eigenes Bild hinterlegen.</span>
            </p>

            {/* Drop zone */}
            <div
              className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors cursor-pointer
                ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}
                ${file ? 'border-green-400 bg-green-50/30' : ''}
              `}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
              />
              {file ? (
                <>
                  {preview ? (
                    <img src={preview} className="max-h-32 max-w-full object-contain rounded" alt="Vorschau" />
                  ) : (
                    <FileImage className="h-10 w-10 text-green-500" />
                  )}
                  <div className="text-center">
                    <p className="text-sm font-medium text-green-700">{file.name}</p>
                    <p className="text-xs text-muted-foreground">Klicken zum Ändern</p>
                  </div>
                </>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Datei hier ablegen oder klicken</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG oder PDF</p>
                  </div>
                </>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setMode('choose')} disabled={loading}>
                Zurück
              </Button>
              <Button onClick={handleAnalyze} disabled={!file || loading} className="gap-2">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    KI analysiert...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Template generieren
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

