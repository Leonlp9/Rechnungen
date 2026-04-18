import { useGmailStore, selectActiveAccount } from '@/store/gmailStore';
import { fetchEmails, getValidToken } from '@/lib/gmail';
import { toast } from 'sonner';
import { Loader2, Paperclip, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from '@/lib/emailDate';
import { useState } from 'react';

export function EmailList() {
  const activeAccount = useGmailStore(selectActiveAccount);
  const updateAccountToken = useGmailStore((s) => s.updateAccountToken);
  const updateAccountEmails = useGmailStore((s) => s.updateAccountEmails);
  const selectedEmail = useGmailStore((s) => s.selectedEmail);
  const setSelectedEmail = useGmailStore((s) => s.setSelectedEmail);
  const isLoading = useGmailStore((s) => s.isLoading);
  const setLoading = useGmailStore((s) => s.setLoading);
  const setFetchingDetail = useGmailStore((s) => s.setFetchingDetail);
  const [loadingMore, setLoadingMore] = useState(false);

  if (!activeAccount) return null;

  const emails = activeAccount.emails;
  const nextPageToken = activeAccount.nextPageToken;

  const getAT = () =>
    getValidToken(activeAccount.token, (t) => updateAccountToken(activeAccount.email, t));

  const load = async () => {
    setLoading(true);
    try {
      const at = await getAT();
      const { messages, nextPageToken } = await fetchEmails(at);
      updateAccountEmails(activeAccount.email, messages, nextPageToken);
    } catch (e: any) {
      toast.error('E-Mails konnten nicht geladen werden: ' + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!nextPageToken) return;
    setLoadingMore(true);
    try {
      const at = await getAT();
      const { messages, nextPageToken: newToken } = await fetchEmails(at, 30, nextPageToken);
      updateAccountEmails(
        activeAccount.email,
        [...emails, ...messages],
        newToken
      );
    } catch (e: any) {
      toast.error('Fehler beim Laden: ' + (e?.message ?? String(e)));
    } finally {
      setLoadingMore(false);
    }
  };

  const selectEmail = (email: (typeof emails)[0]) => {
    setSelectedEmail(email);
    setFetchingDetail(true);
  };

  const senderName = (from: string) => {
    const match = from.match(/^"?([^"<]+)"?\s*</);
    return match ? match[1].trim() : from.replace(/<.*>/, '').trim() || from;
  };

  return (
    <div className="flex h-full flex-col border-r border-border">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-semibold">Posteingang</h2>
        <Button variant="ghost" size="icon" onClick={load} disabled={isLoading} title="Aktualisieren">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {emails.length === 0 && !isLoading && (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
            <p className="text-sm">Noch keine E-Mails geladen.</p>
            <Button variant="outline" size="sm" onClick={load}>
              Jetzt laden
            </Button>
          </div>
        )}

        {emails.map((email) => (
          <button
            key={email.id}
            onClick={() => selectEmail(email)}
            className={cn(
              'w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/50',
              selectedEmail?.id === email.id && 'bg-muted'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="truncate text-sm font-medium">{senderName(email.from)}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{format(email.date)}</span>
            </div>

            <div className="mt-0.5 flex items-center gap-1.5">
              <p className="truncate text-sm font-medium text-foreground/80 flex-1">
                {email.subject || '(kein Betreff)'}
              </p>
              {email.hasAttachment && (
                <span className="shrink-0 flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                  <Paperclip className="h-3 w-3" />
                  Anhang
                </span>
              )}
            </div>

            <p className="mt-0.5 truncate text-xs text-muted-foreground">{email.snippet}</p>
          </button>
        ))}

        {/* Mehr laden */}
        {emails.length > 0 && (
          <div className="p-3">
            {nextPageToken ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Lade…</>
                ) : (
                  'Mehr laden'
                )}
              </Button>
            ) : (
              <p className="text-center text-xs text-muted-foreground">Keine weiteren E-Mails</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

