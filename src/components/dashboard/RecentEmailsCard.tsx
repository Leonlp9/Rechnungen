import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGmailStore } from '@/store/gmailStore';
import { fetchEmails, getValidToken } from '@/lib/gmail';
import { imapFetchEmails } from '@/lib/imap';
import type { GmailMessage } from '@/lib/gmail';
import { Settings, Mail, Paperclip } from 'lucide-react';
import { format as formatEmailDate } from '@/lib/emailDate';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DASHBOARD_EMAILS_ACCOUNT_KEY = 'dashboard_emails_account';

export interface RecentEmailsCardProps {
  editMode?: boolean;
}

export const RecentEmailsCard: React.FC<RecentEmailsCardProps> = ({ editMode = false }) => {
  const navigate = useNavigate();
  const accounts = useGmailStore((s) => s.accounts);
  const updateAccountToken = useGmailStore((s) => s.updateAccountToken);
  const updateAccountEmails = useGmailStore((s) => s.updateAccountEmails);

  const [selectedAccount, setSelectedAccount] = useState<string>(() => {
    return localStorage.getItem(DASHBOARD_EMAILS_ACCOUNT_KEY) ?? '__all__';
  });

  // Per-account loading + fetched emails (only for this widget, 5 per account)
  const [fetched, setFetched] = useState<Record<string, GmailMessage[]>>({});
  const [loadingAccounts, setLoadingAccounts] = useState<Set<string>>(new Set());

  const handleSelectAccount = (value: string) => {
    setSelectedAccount(value);
    localStorage.setItem(DASHBOARD_EMAILS_ACCOUNT_KEY, value);
  };

  // Fetch the 5 newest inbox mails for every account on mount
  useEffect(() => {
    if (accounts.length === 0) return;
    let cancelled = false;

    const fetchForAccount = async (acc: typeof accounts[0]) => {
      setLoadingAccounts((s) => new Set(s).add(acc.email));
      try {
        let messages: GmailMessage[] = [];
        if (acc.type === 'imap' && acc.imapConfig) {
          const res = await imapFetchEmails(acc.imapConfig, acc.email, 1, 'INBOX');
          messages = res.messages.slice(0, 5);
        } else if (acc.token) {
          const at = await getValidToken(acc.token, (t) => updateAccountToken(acc.email, t));
          const res = await fetchEmails(at, 5, undefined, undefined, 'inbox');
          messages = res.messages;
          // Also update the store so Gmail page stays fresh
          updateAccountEmails(acc.email, res.messages, res.nextPageToken);
        }
        if (!cancelled) {
          setFetched((prev) => ({ ...prev, [acc.email]: messages }));
        }
      } catch {
        if (!cancelled) setFetched((prev) => ({ ...prev, [acc.email]: [] }));
      } finally {
        if (!cancelled) setLoadingAccounts((s) => { const n = new Set(s); n.delete(acc.email); return n; });
      }
    };

    accounts.forEach(fetchForAccount);
    return () => { cancelled = true; };
  }, [accounts.map((a) => a.email).join(',')]);

  if (accounts.length === 0) return null;

  // Determine loading state for the current selection
  const isLoading = (() => {
    if (selectedAccount === '__all__') return accounts.some((a) => loadingAccounts.has(a.email));
    return loadingAccounts.has(selectedAccount);
  })();

  // Collect emails from fetched results (fall back to store cache while loading)
  const emails = (() => {
    const getForAccount = (email: string) =>
      fetched[email] ?? accounts.find((a) => a.email === email)?.emails ?? [];

    if (selectedAccount === '__all__') {
      const all = accounts.flatMap((a) =>
        getForAccount(a.email).map((e) => ({ ...e, _account: a.email }))
      );
      all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return all.slice(0, 5);
    }
    const acc = accounts.find((a) => a.email === selectedAccount);
    if (!acc) return [];
    return getForAccount(acc.email).slice(0, 5).map((e) => ({ ...e, _account: acc.email }));
  })();

  const selectedLabel = selectedAccount === '__all__' ? 'Alle Postfächer' : selectedAccount;

  const skeletonRows = (
    <div className="flex-1 divide-y divide-border">
      {[1,2,3,4,5].map(i => (
        <div key={i} className="px-4 py-2.5 flex gap-3">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-2.5 w-full" />
          </div>
          <Skeleton className="h-3 w-8 shrink-0 mt-0.5" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="rounded-xl border bg-card shadow-sm flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Letzte E-Mails</span>
          <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={selectedLabel}>
            · {selectedLabel}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className={cn('h-7 w-7', !editMode && 'hidden')}>
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Postfach wählen</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleSelectAccount('__all__')}
              className={cn(selectedAccount === '__all__' && 'font-semibold')}
            >
              Alle Postfächer
            </DropdownMenuItem>
            {accounts.map((a) => (
              <DropdownMenuItem
                key={a.email}
                onClick={() => handleSelectAccount(a.email)}
                className={cn(selectedAccount === a.email && 'font-semibold')}
              >
                {a.email}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Email list or skeleton */}
      {isLoading && emails.length === 0 ? skeletonRows : (
        <div className="flex-1 divide-y divide-border">
          {emails.length === 0 ? (
            <p className="text-xs text-muted-foreground px-4 py-3">Keine E-Mails vorhanden.</p>
          ) : (
            emails.map((email) => (
              <button
                key={`${email._account}-${email.id}`}
                className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors"
                onClick={() => navigate('/gmail')}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {email.isUnread && (
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-0.5" />
                      )}
                      <span className={cn('text-xs truncate', email.isUnread ? 'font-semibold' : 'text-muted-foreground')}>
                        {email.from.replace(/<.*>/, '').trim() || email.from}
                      </span>
                      {email.hasAttachment && (
                        <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                    <p className={cn('text-xs truncate', email.isUnread ? 'font-medium' : 'text-muted-foreground')}>
                      {email.subject || '(kein Betreff)'}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">
                      {email.snippet}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 flex-shrink-0 pt-0.5">
                    {formatEmailDate(email.date)}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Footer link */}
      <div className="px-4 py-2 border-t">
        <button
          className="text-xs text-primary hover:underline"
          onClick={() => navigate('/gmail')}
        >
          Alle E-Mails öffnen →
        </button>
      </div>
    </div>
  );
};

