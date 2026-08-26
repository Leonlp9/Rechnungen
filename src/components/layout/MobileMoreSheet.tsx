// „Mehr"-Menü für das Handy.
//
// Bündelt ALLE Seiten (auch die, für die unten in der Leiste kein Platz ist),
// den Sync-Status und die Schnellschalter. Damit ist auf dem Handy jede
// Funktion erreichbar, die es am Desktop gibt.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  AlertTriangle,
  Eye,
  EyeOff,
  Moon,
  Sun,
  SunMoon,
  Download,
  FileStack,
  Search,
  Bot,
  Plus,
  Coins,
  FileSearch,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { getVersion } from '@tauri-apps/api/app';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useSheetDrag, SheetGrabber } from '@/components/ui/sheet-drag';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store';
import { useChatStore } from '@/store/chatStore';
import { useSyncStatus, syncNow, PROVIDER_LABELS } from '@/lib/sync';
import { MOBILE_NAV_ITEMS, NAV_GROUPS } from './navItems';
import { ListGroup, ListRow } from '@/components/ui/list-group';
import { useDataIssues } from '@/hooks/useDataIssues';
import { normalizeCurrency } from '@/lib/currency';

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
  const themeMode = useAppStore((s) => s.themeMode);
  const cycleThemeMode = useAppStore((s) => s.cycleThemeMode);
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const draftsCount = useAppStore((s) => s.drafts?.length ?? 0);
  const showAiChat = useAppStore((s) => s.showAiChat);
  const setChatOpen = useChatStore((s) => s.setOpen);
  const sync = useSyncStatus();
  const issues = useDataIssues();
  const [allIssues, setAllIssues] = useState(false);
  const { contentRef, onGrabberMouseDown } = useSheetDrag(onClose);

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion('0.1.0'));
  }, []);

  // Ein Knopf mit drei Zuständen: hell → dunkel → automatisch. „Automatisch"
  // übernimmt, was das System gerade möchte – das wird dort oft nach
  // Tageszeit umgeschaltet.
  const cycleTheme = () => {
    cycleThemeMode();
    document.documentElement.classList.toggle('dark', useAppStore.getState().darkMode);
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
        className="max-h-[88dvh] gap-0 rounded-t-2xl p-0"
      >
        <SheetTitle className="sr-only">Menü</SheetTitle>
        {/* Der Griff liegt auf der Sheet-Fläche selbst – ein eigener
            Hintergrund darauf brach die Fläche sichtbar auf. Gescrollt wird
            der Bereich darunter. */}
        <SheetGrabber onMouseDown={onGrabberMouseDown} />

        <div
          className="min-h-0 flex-1 space-y-8 overflow-y-auto overscroll-contain px-4 pt-2"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
        >
          {/* ── Sync-Status als Listenzeile ── */}
          <ListGroup>
            <ListRow
              tint={syncTone === 'error' ? 'red' : syncTone === 'off' ? 'gray' : 'teal'}
              icon={
                <SyncIcon className={cn(syncTone === 'running' && 'animate-spin')} />
              }
              label={sync.kind === 'none' ? 'Cloud-Sync einrichten' : `Cloud-Sync · ${PROVIDER_LABELS[sync.kind]}`}
              hint={
                sync.kind === 'none'
                  ? 'Belege auf allen Geräten verfügbar machen'
                  : sync.running
                    ? sync.message || 'Synchronisiere …'
                    : sync.lastError
                      ? sync.lastError
                      : `Zuletzt ${lastSyncText}`
              }
              onClick={() => {
                if (sync.kind === 'none') {
                  onClose();
                  navigate('/settings?tab=sync');
                } else {
                  void syncNow();
                }
              }}
            />
          </ListGroup>

          {/* ── Offene Punkte ──
              Am Desktop steht diese Liste in der Kopfzeile. Auf dem Handy gab
              es sie gar nicht – man hätte also nie erfahren, dass Belege
              falsch kategorisiert sind oder noch in Fremdwährung gezählt
              werden. Dieselbe Prüfung, nur als Liste. */}
          {issues.hasAnything && (
            <ListGroup
              title="Hinweise"
              footer={
                issues.errors.length > 0 || issues.pendingFx.length > 0
                  ? 'Diese Punkte verfälschen die Auswertung, solange sie offen sind.'
                  : undefined
              }
            >
              {issues.pendingFx.length > 0 && (
                <ListRow
                  tint="red"
                  icon={issues.converting ? <RefreshCw className="animate-spin" /> : <Coins />}
                  label={issues.converting ? 'Rechne um …' : 'Jetzt in Euro umrechnen'}
                  hint={`${issues.pendingFx.length} Beleg${issues.pendingFx.length !== 1 ? 'e' : ''} in ${[...new Set(issues.pendingFx.map((i) => normalizeCurrency(i.currency)))].join(', ')} zählen noch mit dem Fremdwährungsbetrag`}
                  onClick={() => { void issues.convertNow(); }}
                  noChevron
                />
              )}

              {issues.unindexedCount > 0 && (
                <ListRow
                  tint="orange"
                  icon={issues.indexing ? <RefreshCw className="animate-spin" /> : <FileSearch />}
                  label={issues.indexing ? 'Indiziere …' : 'PDFs durchsuchbar machen'}
                  hint={
                    issues.indexProgress
                      ? `${issues.indexProgress.current} von ${issues.indexProgress.total} indiziert`
                      : `${issues.unindexedCount} von ${issues.withPdfCount} PDFs sind noch nicht im Volltext erfasst`
                  }
                  onClick={() => { void issues.startIndexing(); }}
                  noChevron
                />
              )}

              {(allIssues ? issues.issues : issues.issues.slice(0, 4)).map((issue) => (
                <ListRow
                  key={issue.id}
                  tint={issue.severity === 'error' ? 'red' : 'orange'}
                  icon={<AlertTriangle />}
                  label={issue.title}
                  hint={issue.invoice.partner || issue.invoice.description || 'Beleg öffnen'}
                  onClick={() => { onClose(); navigate(`/invoices/${issue.invoiceId}`); }}
                />
              ))}

              {!allIssues && issues.issues.length > 4 && (
                <ListRow
                  label={`Weitere ${issues.issues.length - 4} anzeigen`}
                  onClick={() => setAllIssues(true)}
                  noChevron
                />
              )}
            </ListGroup>
          )}

          {/* ── Schnellschalter ── */}
          <div className="grid grid-cols-4 gap-y-4">
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
              icon={
                themeMode === 'auto' ? <SunMoon className="h-5 w-5" />
                  : themeMode === 'dark' ? <Moon className="h-5 w-5" />
                    : <Sun className="h-5 w-5" />
              }
              label={themeMode === 'auto' ? 'System' : themeMode === 'dark' ? 'Dunkel' : 'Hell'}
              active={themeMode !== 'auto' && darkMode}
              onClick={cycleTheme}
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
            <ListGroup>
              <ListRow
                tint="orange"
                icon={<FileStack />}
                label="Entwürfe verarbeiten"
                value={String(draftsCount)}
                onClick={() => { onClose(); onDrafts(); }}
              />
            </ListGroup>
          )}

          {/* ── Alle Seiten als iOS-Gruppenliste ── */}
          {NAV_GROUPS.map((group) => {
            const groupItems = items.filter((i) => i.group === group);
            if (groupItems.length === 0) return null;
            return (
              <ListGroup key={group} title={group}>
                {groupItems.map(({ to, label, icon: Icon, hint, tint }) => (
                  <ListRow
                    key={to}
                    to={to}
                    tint={tint}
                    icon={<Icon />}
                    label={label}
                    hint={hint}
                  />
                ))}
              </ListGroup>
            );
          })}

          <p className="pt-1 text-center text-[11px] text-muted-foreground">Klevr v{version}</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Schnellschalter als runder Icon-Knopf mit Beschriftung darunter.
 * Rahmenlos – die umrandeten Kästen davor standen quer zu den flächigen
 * Listen darunter und wirkten wie Fremdkörper.
 */
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
    <button onClick={onClick} className="flex flex-col items-center gap-1.5">
      <span
        className={cn(
          'flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-full transition-colors active:opacity-70',
          active ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
        )}
      >
        {icon}
      </span>
      <span className="text-[11px] leading-tight text-muted-foreground">{label}</span>
    </button>
  );
}
