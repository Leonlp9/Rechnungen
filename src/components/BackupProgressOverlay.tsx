import { useEffect, useRef, useState } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

interface BackupProgress {
  step: string;
  current: number;
  total: number;
  bytes_done: number;
  bytes_total: number;
}

interface Props {
  open: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatEta(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '–';
  if (seconds < 60) return `${Math.ceil(seconds)} Sek.`;
  return `${Math.floor(seconds / 60)} Min. ${Math.ceil(seconds % 60)} Sek.`;
}

export function BackupProgressOverlay({ open }: Props) {
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const [eta, setEta] = useState<string>('–');

  useEffect(() => {
    if (!open) {
      setProgress(null);
      setEta('–');
      startTimeRef.current = null;
      return;
    }

    let unlisten: UnlistenFn | null = null;

    listen<BackupProgress>('backup-progress', (event) => {
      const p = event.payload;
      setProgress(p);

      // Start tracking time on first real progress
      if (startTimeRef.current === null && p.bytes_done > 0) {
        startTimeRef.current = performance.now();
      }

      if (startTimeRef.current !== null && p.bytes_total > 0 && p.bytes_done > 0) {
        const elapsed = (performance.now() - startTimeRef.current) / 1000;
        const rate = p.bytes_done / elapsed; // bytes per second
        const remaining = (p.bytes_total - p.bytes_done) / rate;
        setEta(formatEta(remaining));
      }
    }).then((fn) => { unlisten = fn; });

    return () => { unlisten?.(); };
  }, [open]);

  if (!open) return null;

  const pct = progress && progress.bytes_total > 0
    ? Math.min(100, Math.round((progress.bytes_done / progress.bytes_total) * 100))
    : progress
      ? Math.min(100, Math.round((progress.current / Math.max(progress.total, 1)) * 100))
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 animate-pulse">
            <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0v10l-8 4m-8-4V7m8 4v10" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-sm">Backup wird erstellt…</p>
            <p className="text-xs text-muted-foreground truncate max-w-56">
              {progress?.step ?? 'Starte…'}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{pct}%</span>
            <span>
              {progress && progress.bytes_total > 0
                ? `${formatBytes(progress.bytes_done)} / ${formatBytes(progress.bytes_total)}`
                : progress
                  ? `${progress.current} / ${progress.total} Dateien`
                  : ''}
            </span>
          </div>
        </div>

        {/* ETA */}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
          <span className="text-xs text-muted-foreground">Verbleibende Zeit</span>
          <span className="text-xs font-mono font-medium">{pct >= 100 ? 'Fertig ✓' : eta}</span>
        </div>
      </div>
    </div>
  );
}

