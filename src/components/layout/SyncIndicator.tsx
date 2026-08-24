// Geräteübergreifender Sync-Indikator.
//
// Sichtbar auf JEDER Seite (Desktop-Topbar und Mobile-Topbar), damit jederzeit
// erkennbar ist, ob der Cloud-Sync läuft, wann zuletzt Daten von anderen
// Geräten kamen und ob etwas schiefgegangen ist.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowDownToLine,
  ArrowUpFromLine,
  MonitorSmartphone,
  Settings,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useSyncStatus, syncNow, PROVIDER_LABELS } from '@/lib/sync';

/** „vor 3 Minuten" – aktualisiert sich selbst, solange der Indikator sichtbar ist. */
function useRelativeTime(iso: string | null): string | null {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!iso) return;
    const id = setInterval(() => tick((v) => v + 1), 60_000);
    return () => clearInterval(id);
  }, [iso]);
  if (!iso) return null;
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  if (ms < 45_000) return 'gerade eben';
  return `vor ${formatDistanceToNow(new Date(iso), { locale: de })}`;
}

type Tone = 'off' | 'running' | 'error' | 'fresh' | 'ok';

function useTone(): Tone {
  const { kind, running, lastError, lastIncoming } = useSyncStatus();
  const [, tick] = useState(0);
  // Der „gerade empfangen"-Zustand läuft nach 20 s ab. Nur dafür wird kurz
  // getickt – kein Dauer-Timer, der sonst permanent neu rendern würde.
  useEffect(() => {
    if (!lastIncoming) return;
    const age = Date.now() - Date.parse(lastIncoming);
    if (age > 20_000) return;
    const id = setTimeout(() => tick((v) => v + 1), 20_000 - age + 500);
    return () => clearTimeout(id);
  }, [lastIncoming]);
  if (running) return 'running';
  if (kind === 'none') return 'off';
  if (lastError) return 'error';
  if (lastIncoming && Date.now() - Date.parse(lastIncoming) < 20_000) return 'fresh';
  return 'ok';
}

interface Props {
  /** Kompakt = nur Icon (Mobile-Topbar) */
  compact?: boolean;
  className?: string;
}

export function SyncIndicator({ compact = false, className }: Props) {
  const status = useSyncStatus();
  const tone = useTone();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const lastSyncRel = useRelativeTime(status.lastSync);
  const lastIncomingRel = useRelativeTime(status.lastIncoming);

  const Icon =
    tone === 'running' ? RefreshCw
    : tone === 'off' ? CloudOff
    : tone === 'error' ? AlertTriangle
    : tone === 'fresh' ? ArrowDownToLine
    : Cloud;

  const toneClass =
    tone === 'running' ? 'text-primary'
    : tone === 'off' ? 'text-muted-foreground/60'
    : tone === 'error' ? 'text-destructive'
    : tone === 'fresh' ? 'text-emerald-500'
    : 'text-muted-foreground';

  const shortLabel =
    tone === 'running' ? (status.message || 'Synchronisiere …')
    : tone === 'off' ? 'Sync aus'
    : tone === 'error' ? 'Sync-Fehler'
    : tone === 'fresh' ? 'Neue Daten'
    : lastSyncRel ?? 'Bereit';

  const title =
    tone === 'off'
      ? 'Cloud-Sync ist nicht eingerichtet – tippen zum Einrichten'
      : `Cloud-Sync (${PROVIDER_LABELS[status.kind]}) – ${shortLabel}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          title={title}
          aria-label={title}
          className={cn(
            'relative flex shrink-0 items-center gap-2 rounded-md border border-border bg-background px-2 transition-colors hover:bg-muted',
            compact ? 'h-9 w-9 justify-center px-0' : 'h-9',
            className,
          )}
        >
          <Icon
            className={cn(
              'h-4 w-4 shrink-0',
              toneClass,
              tone === 'running' && 'animate-spin',
              tone === 'fresh' && 'animate-bounce',
            )}
          />
          {!compact && (
            <span className="hidden max-w-[9rem] truncate text-xs text-muted-foreground lg:inline">
              {shortLabel}
            </span>
          )}
          {/* Statuspunkt – auch im Kompaktmodus sofort erkennbar */}
          <span
            className={cn(
              'absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-background',
              tone === 'running' && 'bg-primary animate-pulse',
              tone === 'error' && 'bg-destructive',
              tone === 'fresh' && 'bg-emerald-500 animate-pulse',
              (tone === 'ok' || tone === 'off') && 'hidden',
            )}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-start gap-3 border-b px-4 py-3">
          <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', toneClass, tone === 'running' && 'animate-spin')} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {status.kind === 'none' ? 'Cloud-Sync ist aus' : 'Cloud-Sync'}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              {status.kind === 'none'
                ? 'Richte den Sync ein, um Rechnungen, Belege und Einstellungen auf allen Geräten zu haben.'
                : `${PROVIDER_LABELS[status.kind]}${status.encrypted ? ' · Ende-zu-Ende-verschlüsselt' : ''}`}
            </p>
          </div>
        </div>

        {status.kind !== 'none' && (
          <div className="space-y-2.5 px-4 py-3 text-xs">
            <Row
              icon={<CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />}
              label="Zuletzt synchronisiert"
              value={status.running ? (status.message || 'läuft …') : (lastSyncRel ?? 'noch nie')}
            />
            <Row
              icon={<ArrowDownToLine className="h-3.5 w-3.5 text-emerald-500" />}
              label="Von anderen Geräten"
              value={
                status.lastIncoming
                  ? `${status.lastIncomingCount} Änderungen · ${lastIncomingRel}`
                  : 'nichts empfangen'
              }
            />
            {status.lastResult && (
              <Row
                icon={<ArrowUpFromLine className="h-3.5 w-3.5 text-blue-500" />}
                label="Letzter Lauf"
                value={`${status.lastResult.pulledRows + status.lastResult.pulledFiles} empfangen · ${
                  status.lastResult.pushedRows + status.lastResult.pushedFiles
                } gesendet`}
              />
            )}
            <Row
              icon={<RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />}
              label="Automatisch"
              value={status.autoSync ? `alle ${status.intervalMin} Min.` : 'aus'}
            />
            {status.encrypted && (
              <Row
                icon={<Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                label="Verschlüsselung"
                value="AES-256 (E2E)"
              />
            )}
            {status.deviceId && (
              <Row
                icon={<MonitorSmartphone className="h-3.5 w-3.5 text-muted-foreground" />}
                label="Dieses Gerät"
                value={status.deviceId.slice(0, 12)}
                mono
              />
            )}

            {status.lastError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-[11px] text-destructive">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 break-words">{status.lastError}</span>
              </div>
            )}
            {status.lastResult && status.lastResult.conflicts > 0 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                {status.lastResult.conflicts} Einträge konnten nicht automatisch zusammengeführt
                werden – nichts ist verloren, Details in den Einstellungen.
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2 border-t px-3 py-2.5">
          {status.kind !== 'none' && (
            <Button
              size="sm"
              className="flex-1 gap-1.5"
              disabled={status.running}
              onClick={() => void syncNow()}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', status.running && 'animate-spin')} />
              {status.running ? 'Läuft …' : 'Jetzt syncen'}
            </Button>
          )}
          <Button
            size="sm"
            variant={status.kind === 'none' ? 'default' : 'outline'}
            className={cn('gap-1.5', status.kind === 'none' && 'flex-1')}
            onClick={() => {
              setOpen(false);
              navigate('/settings?tab=sync');
            }}
          >
            <Settings className="h-3.5 w-3.5" />
            {status.kind === 'none' ? 'Sync einrichten' : 'Einstellungen'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Row({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('ml-auto truncate text-right font-medium', mono && 'font-mono text-[10px]')}>
        {value}
      </span>
    </div>
  );
}
