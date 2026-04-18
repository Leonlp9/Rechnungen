import { useState } from 'react';
import { useGmailStore, selectActiveAccount } from '@/store/gmailStore';
import { GmailLogin } from '@/components/gmail/GmailLogin';
import { EmailList } from '@/components/gmail/EmailList';
import { EmailDetail } from '@/components/gmail/EmailDetail';
import { Button } from '@/components/ui/button';
import { LogOut, UserPlus, ChevronDown, Check } from 'lucide-react';
import { startOAuthFlow, fetchUserEmail, revokeToken } from '@/lib/gmail';
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
  const addOrUpdateAccount = useGmailStore((s) => s.addOrUpdateAccount);
  const removeAccount = useGmailStore((s) => s.removeAccount);
  const setSelectedEmail = useGmailStore((s) => s.setSelectedEmail);
  const [addingAccount, setAddingAccount] = useState(false);

  // No accounts at all → show login screen
  if (accounts.length === 0) {
    return <GmailLogin />;
  }

  const handleAddAccount = async () => {
    setAddingAccount(true);
    try {
      const token = await startOAuthFlow();
      const email = await fetchUserEmail(token.access_token);
      addOrUpdateAccount({ email, token, emails: [] });
      toast.success(`${email} hinzugefügt!`);
    } catch (e: any) {
      toast.error('Anmeldung fehlgeschlagen: ' + (e?.message ?? String(e)));
    } finally {
      setAddingAccount(false);
    }
  };

  const handleLogout = async (email: string) => {
    const account = accounts.find((a) => a.email === email);
    if (account) await revokeToken(account.token).catch(() => {});
    removeAccount(email);
    setSelectedEmail(null);
    toast.info(`${email} getrennt.`);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h1 className="text-base font-semibold">Gmail</h1>

        <div className="flex items-center gap-2">
          {/* Account switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 max-w-[220px]">
                <span className="truncate text-xs">{activeAccount?.email ?? '–'}</span>
                <ChevronDown className="h-3 w-3 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {accounts.map((acc, i) => (
                <DropdownMenuItem
                  key={acc.email}
                  className="flex items-center justify-between gap-2 pr-2"
                  onSelect={() => { setActiveIndex(i); setSelectedEmail(null); }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {i === activeIndex && <Check className="h-3 w-3 shrink-0 text-primary" />}
                    {i !== activeIndex && <span className="w-3" />}
                    <span className="truncate text-sm">{acc.email}</span>
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
                onSelect={handleAddAccount}
                disabled={addingAccount}
                className="gap-2 text-sm"
              >
                <UserPlus className="h-4 w-4" />
                {addingAccount ? 'Warte auf Browser…' : 'Konto hinzufügen'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 shrink-0 overflow-hidden">
          <EmailList />
        </div>
        <div className="flex-1 overflow-hidden">
          <EmailDetail />
        </div>
      </div>
    </div>
  );
}
