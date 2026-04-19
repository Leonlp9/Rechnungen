import { useState, useCallback, useRef, useEffect } from 'react';
import { useGmailStore, selectActiveAccount } from '@/store/gmailStore';
import { GmailLogin } from '@/components/gmail/GmailLogin';
import { EmailList } from '@/components/gmail/EmailList';
import { EmailDetail } from '@/components/gmail/EmailDetail';
import { ComposeDialog } from '@/components/gmail/ComposeDialog';
import { AddMailboxDialog } from '@/components/gmail/AddMailboxDialog';
import { Button } from '@/components/ui/button';
import {
  LogOut, UserPlus, ChevronDown, Check, PenSquare, Layers,
  Settings2, Inbox, Send, FileEdit, Star, ShoppingBag, ShieldAlert, Archive, ArrowLeft,
} from 'lucide-react';
import { revokeToken, getValidToken, fetchLabelUnreadCounts } from '@/lib/gmail';
import type { FolderUnreadCounts } from '@/lib/gmail';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type LayoutMode = 'apple' | 'gmail';

const GMAIL_FOLDERS_NAV = [
  { id: 'inbox',     label: 'Posteingang', icon: Inbox },
  { id: 'sent',      label: 'Gesendet',    icon: Send },
  { id: 'drafts',    label: 'Entwürfe',    icon: FileEdit },
  { id: 'starred',   label: 'Markiert',    icon: Star },
  { id: 'purchases', label: 'Käufe',       icon: ShoppingBag },
  { id: 'archive',   label: 'Archiv',      icon: Archive },
  { id: 'spam',      label: 'Spam',        icon: ShieldAlert },
];

const IMAP_FOLDERS_NAV = [
  { id: 'INBOX',   label: 'Posteingang', icon: Inbox },
  { id: 'Sent',    label: 'Gesendet',    icon: Send },
  { id: 'Drafts',  label: 'Entwürfe',    icon: FileEdit },
  { id: 'FLAGGED', label: 'Markiert',    icon: Star },
  { id: 'Junk',    label: 'Spam',        icon: ShieldAlert },
];

function getStoredLayout(): LayoutMode {
  try {
    const v = localStorage.getItem('mail-layout');
    if (v === 'apple' || v === 'gmail') return v;
  } catch {}
  return 'apple';
}

type MainTab = 'mail';

export default function GmailPage() {
  const [mainTab] = useState<MainTab>('mail');
  const accounts = useGmailStore((s) => s.accounts);
  const activeIndex = useGmailStore((s) => s.activeIndex);
  const activeAccount = useGmailStore(selectActiveAccount);
  const setActiveIndex = useGmailStore((s) => s.setActiveIndex);
  const removeAccount = useGmailStore((s) => s.removeAccount);
  const setSelectedEmail = useGmailStore((s) => s.setSelectedEmail);
  const selectedEmail = useGmailStore((s) => s.selectedEmail);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  // Layout
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(getStoredLayout);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Gmail layout: view state
  const [gmailView, setGmailView] = useState<'list' | 'detail'>('list');

  // Gmail layout: folder controlled from sidebar
  const [sidebarFolder, setSidebarFolder] = useState<string>('inbox');

  // Unread counts fetched from Gmail API (per folder, per account)
  const [unreadCounts, setUnreadCounts] = useState<FolderUnreadCounts>({});
  const updateAccountToken = useGmailStore((s) => s.updateAccountToken);

  useEffect(() => {
    if (!activeAccount || activeAccount.type === 'imap' || !activeAccount.token) return;
    let cancelled = false;
    getValidToken(activeAccount.token, (t) => updateAccountToken(activeAccount.email, t))
      .then((at) => fetchLabelUnreadCounts(at))
      .then((counts) => { if (!cancelled) setUnreadCounts(counts); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [activeAccount?.email]);

  const handleEmailRead = (folder: string) => {
    setUnreadCounts((prev) => {
      const current = prev[folder] ?? 0;
      if (current <= 0) return prev;
      return { ...prev, [folder]: current - 1 };
    });
  };

  // Resizable list panel (Apple layout)
  const [listWidth, setListWidth] = useState(320);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = listWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = ev.clientX - startX.current;
      setListWidth(Math.min(600, Math.max(200, startWidth.current + delta)));
    };
    const onUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [listWidth]);

  const isAllMode = activeIndex === -1;
  const isImap = activeAccount?.type === 'imap';
  const navFolders = isImap ? IMAP_FOLDERS_NAV : GMAIL_FOLDERS_NAV;

  if (accounts.length === 0 && mainTab === 'mail') return <GmailLogin />;

  const handleLogout = async (email: string) => {
    const account = accounts.find((a) => a.email === email);
    if (account?.type !== 'imap' && account?.token) {
      await revokeToken(account.token).catch(() => {});
    }
    removeAccount(email);
    setSelectedEmail(null);
    toast.info(`${email} getrennt.`);
  };

  const accountTypeLabel = (type?: string) => type === 'imap' ? 'IMAP' : 'Gmail';

  const switchLayout = (mode: LayoutMode) => {
    setLayoutMode(mode);
    try { localStorage.setItem('mail-layout', mode); } catch {}
    setSettingsOpen(false);
    // Reset gmail view when switching
    setGmailView('list');
    setSelectedEmail(null);
  };

  const handleBackToList = () => {
    setGmailView('list');
    setSelectedEmail(null);
  };

  // ── Shared toolbar ────────────────────────────────────────────────────────
  const toolbar = (
    <div className="flex items-center justify-between border-b border-border px-4 py-2.5 shrink-0">
      <div className="flex items-center gap-2">
        <h1 className="text-base font-semibold">Mail</h1>
        <Button size="sm" onClick={() => setComposeOpen(true)} className="gap-1.5">
          <PenSquare className="h-3.5 w-3.5" />
          Schreiben
        </Button>
      </div>

      <div className="flex items-center gap-2">
        {/* Account switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 max-w-[240px]">
              {isAllMode && <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              <span className="truncate text-xs">
                {isAllMode ? 'Alle Postfächer' : (activeAccount?.email ?? '–')}
              </span>
              {!isAllMode && activeAccount && (
                <span className="shrink-0 text-[10px] text-muted-foreground bg-muted rounded px-1">
                  {accountTypeLabel(activeAccount.type)}
                </span>
              )}
              <ChevronDown className="h-3 w-3 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            {accounts.length > 1 && (
              <>
                <DropdownMenuItem
                  className="flex items-center gap-2 pr-2"
                  onSelect={() => { setActiveIndex(-1); setSelectedEmail(null); setGmailView('list'); }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isAllMode ? <Check className="h-3 w-3 shrink-0 text-primary" /> : <span className="w-3" />}
                    <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">Alle Postfächer</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {accounts.map((acc, i) => (
              <DropdownMenuItem
                key={acc.email}
                className="flex items-center justify-between gap-2 pr-2"
                onSelect={() => { setActiveIndex(i); setSelectedEmail(null); setGmailView('list'); }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {!isAllMode && i === activeIndex
                    ? <Check className="h-3 w-3 shrink-0 text-primary" />
                    : <span className="w-3" />}
                  <span className="truncate text-sm">{acc.email}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground bg-muted rounded px-1">
                    {accountTypeLabel(acc.type)}
                  </span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleLogout(acc.email); }}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
                  title="Konto entfernen"
                >
                  <LogOut className="h-3 w-3" />
                </button>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setAddDialogOpen(true)} className="gap-2 text-sm">
              <UserPlus className="h-4 w-4" />
              Postfach hinzufügen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Settings */}
        <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" title="Mail-Einstellungen">
              <Settings2 className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-4 space-y-4">
            <p className="text-sm font-semibold">Mail-Einstellungen</p>

            {/* Layout toggle */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Layout</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => switchLayout('apple')}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all text-left',
                    layoutMode === 'apple'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/40'
                  )}
                >
                  {/* Apple layout preview */}
                  <div className="flex gap-1 w-full h-10 rounded overflow-hidden bg-muted/60">
                    <div className="w-2/5 bg-muted-foreground/20 flex flex-col gap-0.5 p-0.5">
                      {[1,2,3].map(i => <div key={i} className="h-1.5 rounded bg-muted-foreground/30" />)}
                    </div>
                    <div className="flex-1 bg-muted-foreground/10 p-1">
                      <div className="h-1.5 rounded bg-muted-foreground/20 mb-1" />
                      <div className="h-1 rounded bg-muted-foreground/15" />
                    </div>
                  </div>
                  <div className="w-full">
                    <p className={cn('text-xs font-medium', layoutMode === 'apple' ? 'text-primary' : '')}>Kompakt</p>
                    <p className="text-[10px] text-muted-foreground">Liste links, Detail rechts</p>
                  </div>
                </button>

                <button
                  onClick={() => switchLayout('gmail')}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all text-left',
                    layoutMode === 'gmail'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/40'
                  )}
                >
                  {/* Gmail layout preview */}
                  <div className="flex gap-1 w-full h-10 rounded overflow-hidden bg-muted/60">
                    <div className="w-1/4 bg-muted-foreground/20 flex flex-col gap-0.5 p-0.5">
                      {[1,2,3,4].map(i => <div key={i} className="h-1 rounded bg-muted-foreground/30" />)}
                    </div>
                    <div className="flex-1 bg-muted-foreground/10 flex flex-col gap-0.5 p-0.5">
                      {[1,2,3].map(i => <div key={i} className="h-2 rounded bg-muted-foreground/20" />)}
                    </div>
                  </div>
                  <div className="w-full">
                    <p className={cn('text-xs font-medium', layoutMode === 'gmail' ? 'text-primary' : '')}>Klassisch</p>
                    <p className="text-[10px] text-muted-foreground">Sidebar + breite Liste</p>
                  </div>
                </button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );

  // ── Apple layout ──────────────────────────────────────────────────────────
  if (layoutMode === 'apple') {
    return (
      <div className="flex h-full flex-col">
        {toolbar}
        <div className="flex flex-1 overflow-hidden select-none">
          <div style={{ width: listWidth }} className="shrink-0 overflow-hidden">
            <EmailList unreadCounts={unreadCounts} onEmailRead={handleEmailRead} />
          </div>
          <div
            onMouseDown={onResizeStart}
            className="group relative w-2 shrink-0 cursor-col-resize bg-border hover:bg-primary/20 transition-colors"
            title="Breite anpassen"
          >
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {[1,2,3,4,5].map(i => <span key={i} className="h-1 w-1 rounded-full bg-primary/70" />)}
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <EmailDetail onReply={() => setComposeOpen(true)} />
          </div>
        </div>
        <ComposeDialog open={composeOpen} onClose={() => setComposeOpen(false)} />
        <AddMailboxDialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} />
      </div>
    );
  }

  // ── Gmail layout ──────────────────────────────────────────────────────────
  const activeFolderLabel = navFolders.find((f) => f.id === sidebarFolder)?.label ?? 'Posteingang';

  return (
    <div className="flex h-full flex-col">
      {toolbar}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar – folder navigation */}
        <aside className="w-52 shrink-0 flex flex-col border-r border-border bg-muted/20 overflow-y-auto py-2">
          {navFolders.map(({ id, label, icon: Icon }) => {
            const count = unreadCounts[id] ?? 0;
            return (
            <button
              key={id}
              onClick={() => {
                setSidebarFolder(id);
                setGmailView('list');
                setSelectedEmail(null);
              }}
              className={cn(
                'flex items-center gap-3 px-4 py-2 text-sm rounded-r-full mr-3 transition-colors text-left',
                sidebarFolder === id
                  ? 'bg-primary/15 text-primary font-semibold'
                  : 'text-foreground/80 hover:bg-muted/60'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', sidebarFolder === id ? 'text-primary' : 'text-muted-foreground')} />
              <span className="flex-1">{label}</span>
              {count > 0 && (
                <span className={cn(
                  'shrink-0 text-xs font-bold tabular-nums',
                  sidebarFolder === id ? 'text-primary' : 'text-muted-foreground'
                )}>
                  {count > 9999 ? '9999+' : count}
                </span>
              )}
            </button>
            );
          })}
        </aside>

        {/* Main area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {gmailView === 'list' ? (
            /* Wide email list */
            <EmailList
              controlledFolder={sidebarFolder}
              onFolderChange={setSidebarFolder}
              hideFolderDropdown
              onEmailSelected={() => setGmailView('detail')}
              onEmailRead={handleEmailRead}
              unreadCounts={unreadCounts}
            />
          ) : (
            /* Email detail with back button */
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Back bar */}
              <div className="flex items-center gap-2 border-b border-border px-4 py-2 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 -ml-2"
                  onClick={handleBackToList}
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="text-sm">{activeFolderLabel}</span>
                </Button>
                {selectedEmail && (
                  <span className="truncate text-sm text-muted-foreground ml-1">
                    – {selectedEmail.subject || '(kein Betreff)'}
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <EmailDetail onReply={() => setComposeOpen(true)} />
              </div>
            </div>
          )}
        </div>
      </div>

      <ComposeDialog open={composeOpen} onClose={() => setComposeOpen(false)} />
      <AddMailboxDialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} />
    </div>
  );
}
