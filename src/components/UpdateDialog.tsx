import { useState } from 'react';
import { relaunch } from '@tauri-apps/plugin-process';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, RefreshCw } from 'lucide-react';

export type UpdatePhase = 'confirm' | 'downloading' | 'done';

interface Props {
  version: string;
  releaseNotes?: string;
  phase: UpdatePhase;
  progress: number; // 0–100
  onConfirm: () => void;
  onCancel: () => void;
}

export function UpdateDialog({ version, releaseNotes, phase, progress, onConfirm, onCancel }: Props) {
  const [relaunching, setRelaunching] = useState(false);

  // prevent closing during download
  const allowClose = phase === 'confirm';

  const handleRelaunch = async () => {
    setRelaunching(true);
    await relaunch();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && allowClose) onCancel(); }}>
      <DialogContent className="max-w-sm" onInteractOutside={(e) => { if (!allowClose) e.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            {phase === 'confirm' && 'Update verfügbar'}
            {phase === 'downloading' && 'Update wird heruntergeladen…'}
            {phase === 'done' && 'Update bereit'}
          </DialogTitle>
        </DialogHeader>

        {phase === 'confirm' && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Version <span className="font-semibold text-foreground">{version}</span> ist verfügbar.
              Möchtest du das Update jetzt herunterladen und installieren?
            </p>
            {releaseNotes && (
              <div className="rounded-md border bg-muted/50 p-3 max-h-40 overflow-y-auto">
                <p className="text-xs font-semibold text-foreground mb-1">Was ist neu?</p>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{releaseNotes}</p>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onCancel}>Später</Button>
              <Button onClick={onConfirm}>Jetzt aktualisieren</Button>
            </div>
          </div>
        )}

        {phase === 'downloading' && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Bitte warten – Update wird heruntergeladen…
            </p>
            <div className="space-y-1.5">
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-right text-muted-foreground">{progress}%</p>
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Das Update wurde erfolgreich installiert. Möchtest du die App jetzt neu starten?
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onCancel}>Später neu starten</Button>
              <Button onClick={handleRelaunch} disabled={relaunching}>
                <RefreshCw className={`mr-2 h-4 w-4 ${relaunching ? 'animate-spin' : ''}`} />
                Jetzt neu starten
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


