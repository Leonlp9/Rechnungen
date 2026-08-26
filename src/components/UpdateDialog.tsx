// Update-Dialog.
//
// Am Desktop lädt und installiert der Updater selbst, danach folgt ein
// Neustart. Auf dem Handy wird die APK geladen und ans System übergeben – die
// letzte Bestätigung macht der Paket-Installer, deshalb heißen die Knöpfe dort
// anders und es gibt einen Weg, die fertige Datei erneut zu öffnen, ohne sie
// noch einmal zu laden.
//
// Die Hülle kommt von `ResponsiveModal`: am Desktop ein Dialog, am Handy ein
// Blatt von unten – vorher war es auch auf dem Handy ein Kasten mit kleinen
// Knöpfen in der Ecke.

import { useState } from 'react';
import { relaunch } from '@tauri-apps/plugin-process';
import { Button } from '@/components/ui/button';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { useIsMobile } from '@/hooks/useIsMobile';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Download, RefreshCw } from 'lucide-react';

export type UpdatePhase = 'confirm' | 'downloading' | 'done';

interface Props {
  version: string;
  releaseNotes?: string;
  phase: UpdatePhase;
  progress: number; // 0–100
  /** Android-Ablauf: herunterladen und an den Paket-Installer übergeben */
  mobile?: boolean;
  /** Datei liegt bereits vollständig vor – es wird nichts erneut geladen */
  cached?: boolean;
  /** Fehler aus dem letzten Versuch */
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Fertige Datei erneut öffnen (Android) */
  onInstall?: () => void;
}

export function UpdateDialog({
  version,
  releaseNotes,
  phase,
  progress,
  mobile,
  cached,
  error,
  onConfirm,
  onCancel,
  onInstall,
}: Props) {
  const isMobile = useIsMobile();
  const [relaunching, setRelaunching] = useState(false);

  // Während des Downloads nicht schließen – sonst läuft er unsichtbar weiter.
  const allowClose = phase !== 'downloading';

  const handleRelaunch = async () => {
    setRelaunching(true);
    await relaunch();
  };

  const title =
    phase === 'confirm' ? 'Update verfügbar'
    : phase === 'downloading' ? 'Wird geladen …'
    : mobile ? 'Bereit zur Installation'
    : 'Update bereit';

  const bigButton = cn(isMobile && 'h-[50px] w-full text-[17px] font-semibold');

  return (
    <ResponsiveModal
      open
      onClose={() => { if (allowClose) onCancel(); }}
      title={title}
      closeLabel={allowClose ? 'Später' : ''}
      dismissible={allowClose}
      desktopClassName="max-w-sm"
    >
      {phase === 'confirm' && (
        <div className="space-y-4">
          <p className="text-[15px] leading-snug text-muted-foreground">
            Version <span className="font-semibold text-foreground">{version}</span> ist verfügbar.
            {mobile
              ? cached
                ? ' Sie wurde bereits heruntergeladen und kann installiert werden.'
                : ' Sie wird heruntergeladen und danach vom System installiert.'
              : ' Möchtest du das Update jetzt herunterladen und installieren?'}
          </p>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Letzter Versuch: {error}</span>
            </div>
          )}

          {releaseNotes && (
            <div className="max-h-40 overflow-y-auto rounded-xl bg-muted/50 p-3">
              <p className="mb-1 text-[13px] font-semibold text-foreground">Was ist neu?</p>
              {/* Changelogs enthalten lange Links – die müssen umbrechen,
                  sonst schiebt sich der Kasten seitwärts auf. */}
              <p className="text-[13px] break-words whitespace-pre-wrap text-muted-foreground">
                {releaseNotes}
              </p>
            </div>
          )}

          {mobile && !cached && (
            <p className="text-[13px] leading-snug text-muted-foreground">
              Android fragt am Ende selbst nach, ob installiert werden darf – das ist normal.
            </p>
          )}

          <div className={cn('flex gap-2', isMobile ? 'flex-col-reverse' : 'justify-end')}>
            {!isMobile && <Button variant="outline" onClick={onCancel}>Später</Button>}
            <Button onClick={onConfirm} className={bigButton}>
              <Download className="mr-2 h-4 w-4" />
              {cached ? 'Jetzt installieren' : 'Jetzt aktualisieren'}
            </Button>
          </div>
        </div>
      )}

      {phase === 'downloading' && (
        <div className="space-y-4">
          <p className="text-[15px] text-muted-foreground">
            {mobile ? 'Die Installationsdatei wird geladen …' : 'Bitte warten – Update wird heruntergeladen …'}
          </p>
          <div className="space-y-1.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-right text-[13px] text-muted-foreground tabular-nums">{progress}%</p>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="space-y-4">
          {mobile ? (
            <>
              <div className="flex items-start gap-2 text-[15px] leading-snug text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                <span>
                  Die Installation wurde geöffnet. Bestätige dort „Aktualisieren" – deine Daten
                  bleiben dabei erhalten.
                </span>
              </div>
              <p className="text-[13px] leading-snug text-muted-foreground">
                Nichts passiert? Dann hat Android die Installation aus dieser Quelle noch nicht
                erlaubt. Die Datei bleibt gespeichert und wird nicht erneut geladen.
              </p>
              <div className={cn('flex gap-2', isMobile ? 'flex-col-reverse' : 'justify-end')}>
                {!isMobile && <Button variant="outline" onClick={onCancel}>Schließen</Button>}
                <Button onClick={onInstall} className={bigButton}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Installation erneut öffnen
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-[15px] text-muted-foreground">
                Das Update wurde erfolgreich installiert. Möchtest du die App jetzt neu starten?
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onCancel}>Später neu starten</Button>
                <Button onClick={handleRelaunch} disabled={relaunching}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${relaunching ? 'animate-spin' : ''}`} />
                  Jetzt neu starten
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </ResponsiveModal>
  );
}
