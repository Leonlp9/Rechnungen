// „Mehr"-Menü für das Handy.
//
// Bündelt ALLE Seiten (auch die, für die unten in der Leiste kein Platz ist),
// den Sync-Status und die Schnellschalter. Damit ist auf dem Handy jede
// Funktion erreichbar, die es am Desktop gibt.

import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  AlertTriangle,
  Eye,
  EyeOff,
  Moon,
  Sun,
  Download,
  FileStack,
  Search,
  Bot,
  Plus,
  ChevronRight,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { getVersion } from '@tauri-apps/api/app';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useSheetDrag, SheetGrabber } from '@/components/ui/sheet-drag';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store';
import { useChatStore } from '@/store/chatStore';
import { useSyncStatus, syncNow, PROVIDER_LABELS } from '@/lib/sync';
import { MOBILE_NAV_ITEMS, NAV_GROUPS } from './navItems';

interface Props {
  open: boolean;
  onClose: () => void;
  onNewInvoice: () => void;
  onDrafts: () => void;
  onExport: () => void;
}

export function MobileMoreSheet({ open, onClose, onNewInvoice, onDrafts, onExport }: Props) {
  const navigate = useNavigate();
  const [version, setVersion] = useState('');
  const hiddenNavItems = useAppStore((s) => s.hiddenNavItems);
  const privacyMode = useAppStore((s) => s.privacyMode);
  const togglePrivacyMode = useAppStore((s) => s.togglePrivacyMode);
  const darkMode = useAppStore((s) => s.darkMode);
  const setDarkMode = useAppStore((s) => s.setDarkMode);
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const draftsCount = useAppStore((s) => s.drafts?.length ?? 0);
  const showAiChat = useAppStore((s) => s.showAiChat);
  const setChatOpen = useChatStore((s) => s.setOpen);
  const sync = useSyncStatus();
  const { contentRef, onGrabberMouseDown } = useSheetDrag(onClose);

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion('0.1.0'));
  }, []);

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
  };

  const items = MOBILE_NAV_ITEMS.filter((i) => !hiddenNavItems.includes(i.to));

  const syncTone = sync.running ? 'running' : sync.kind === 'none' ? 'off' : sync.lastError ? 'error' : 'ok';
  const SyncIcon = syncTone === 'off' ? CloudOff : syncTone === 'error' ? AlertTriangle : syncTone === 'running' ? RefreshCw : Cloud;
  const lastSyncText = sync.lastSync
    ? `vor ${formatDistanceToNow(new Date(sync.lastSync), { locale: de })}`
    : 'noch nie';

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        ref={contentRef}
        side="bottom"
        showCloseButton={false}
        aria-describedby={undefined}
        className="max-h-[88dvh] gap-0 overflow-y-auto overscroll-contain rounded-t-2xl p-0"
      >
        <SheetTitle className="sr-only">Menü</SheetTitle>
        <SheetGrabber onMouseDown={onGrabberMouseDown} className="sticky top-0 z-10 bg-popover" />

        <div
          className="space-y-5 px-4 pb-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
        >
          {/* ── Sync-Status ── */}
          <button
            onClick={() => {
              if (sync.kind === 'none') {
                onClose();
                navigate('/settings?tab=sync');
              } else {
                void syncNow();
              }
            }}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors active:bg-muted',
              syncTone === 'error' ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-muted/30',
            )}
          >
            <SyncIcon
              className={cn(
                'h-5 w-5 shrink-0',
                syncTone === 'running' && 'animate-spin text-primary',
                syncTone === 'error' && 'text-destructive',
                syncTone === 'off' && 'text-muted-foreground/60',
                syncTone === 'ok' && 'text-emerald-500',
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {sync.kind === 'none' ? 'Cloud-Sync einrichten' : `Cloud-Sync · ${PROVIDER_LABELS[sync.kind]}`}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {sync.kind === 'none'
                  ? 'Belege auf allen Geräten verfügbar machen'
                  : sync.running
                    ? sync.message || 'Synchronisiere …'
                    : sync.lastError
                      ? sync.lastError
                      : `Zuletzt ${lastSyncText}${sync.autoSync ? ` · automatisch alle ${sync.intervalMin} Min.` : ''}`}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>

          {/* ── Schnellschalter ── */}
          <div className="grid grid-cols-4 gap-2">
            {showAiChat && (
              <QuickAction
                icon={<Bot className="h-5 w-5" />}
                label="KI-Chat"
                onClick={() => { onClose(); setChatOpen(true); }}
              />
            )}
            <QuickAction
              icon={<Search className="h-5 w-5" />}
              label="Suche"
              onClick={() => { onClose(); setSearchOpen(true); }}
            />
            <QuickAction
              icon={privacyMode ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              label={privacyMode ? 'Beträge an' : 'Beträge aus'}
              active={privacyMode}
              onClick={togglePrivacyMode}
            />
            <QuickAction
              icon={darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              label={darkMode ? 'Hell' : 'Dunkel'}
              active={darkMode}
              onClick={toggleDark}
            />
            <QuickAction
              icon={<Download className="h-5 w-5" />}
              label="Export"
              onClick={() => { onClose(); onExport(); }}
            />
            <QuickAction
              icon={<Plus className="h-5 w-5" />}
              label="Beleg (PDF)"
              onClick={() => { onClose(); onNewInvoice(); }}
            />
          </div>

          {draftsCount > 0 && (
            <button
              onClick={() => { onClose(); onDrafts(); }}
              className="flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-left active:bg-primary/10"
            >
              <FileStack className="h-5 w-5 shrink-0 text-primary" />
              <span className="flex-1 text-sm font-medium">Entwürfe verarbeiten</span>
              <Badge className="shrink-0">{draftsCount}</Badge>
            </button>
          )}

          {/* ── Alle Seiten ── */}
          {NAV_GROUPS.map((group) => {
            const groupItems = items.filter((i) => i.group === group);
            if (groupItems.length === 0) return null;
            return (
              <div key={group} className="space-y-1.5">
                <p className="px-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {group}
                </p>
                <div className="overflow-hidden rounded-xl border">
                  {groupItems.map(({ to, label, icon: Icon, hint }, idx) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={to === '/'}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 px-3 py-3 transition-colors active:bg-muted',
                          idx > 0 && 'border-t',
                          isActive && 'bg-primary/5',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon className={cn('h-5 w-5 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                          <span className="min-w-0 flex-1">
                            <span className={cn('block text-sm', isActive && 'font-semibold text-primary')}>{label}</span>
                            {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}

          <p className="pt-1 text-center text-[11px] text-muted-foreground">Klevr v{version}</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors active:bg-muted',
        active ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border text-muted-foreground',
      )}
    >
      {icon}
      <span className="text-[10px] leading-tight font-medium">{label}</span>
    </button>
  );
}
