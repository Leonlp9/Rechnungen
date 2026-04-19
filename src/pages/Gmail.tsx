import { useState, useCallback, useRef } from 'react';
import { useGmailStore, selectActiveAccount } from '@/store/gmailStore';
import { GmailLogin } from '@/components/gmail/GmailLogin';
import { EmailList } from '@/components/gmail/EmailList';
import { EmailDetail } from '@/components/gmail/EmailDetail';
import { ComposeDialog } from '@/components/gmail/ComposeDialog';
import { AddMailboxDialog } from '@/components/gmail/AddMailboxDialog';
import { Button } from '@/components/ui/button';
import { LogOut, UserPlus, ChevronDown, Check, PenSquare, Layers } from 'lucide-react';
import { revokeToken } from '@/lib/gmail';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function GmailPage() {
  const accounts = useGmailStore((s) => s.accounts);
  const activeIndex = useGmailStore((s) => s.activeIndex);
  const activeAccount = useGmailStore(selectActiveAccount);
  const setActiveIndex = useGmailStore((s) => s.setActiveIndex);
  const removeAccount = useGmailStore((s) => s.removeAccount);
  const setSelectedEmail = useGmailStore((s) => s.setSelectedEmail);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  // Resizable list panel
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

  // No accounts at all → show login screen
  if (accounts.length === 0) {
    return <GmailLogin />;
  }

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

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
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
              {/* "Alle Postfächer" – nur wenn mehr als 1 Konto */}
              {accounts.length > 1 && (
                <>
                  <DropdownMenuItem
                    className="flex items-center gap-2 pr-2"
                    onSelect={() => { setActiveIndex(-1); setSelectedEmail(null); }}
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
                  onSelect={() => { setActiveIndex(i); setSelectedEmail(null); }}
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
              <DropdownMenuItem
                onSelect={() => setAddDialogOpen(true)}
                className="gap-2 text-sm"
              >
                <UserPlus className="h-4 w-4" />
                Postfach hinzufügen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 overflow-hidden select-none">
        <div style={{ width: listWidth }} className="shrink-0 overflow-hidden">
          <EmailList />
        </div>
        {/* Resize handle */}
        <div
          onMouseDown={onResizeStart}
          className="group relative w-2 shrink-0 cursor-col-resize bg-border hover:bg-primary/20 transition-colors"
          title="Breite anpassen"
        >
          {/* visible grip dots */}
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <span className="h-1 w-1 rounded-full bg-primary/70" />
            <span className="h-1 w-1 rounded-full bg-primary/70" />
            <span className="h-1 w-1 rounded-full bg-primary/70" />
            <span className="h-1 w-1 rounded-full bg-primary/70" />
            <span className="h-1 w-1 rounded-full bg-primary/70" />
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
