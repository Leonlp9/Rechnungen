import { useEffect, useRef, useState } from 'react';
import { useGmailStore, selectActiveAccount } from '@/store/gmailStore';
import { fetchEmails, getValidToken, markMessageAsRead } from '@/lib/gmail';
import { imapFetchEmails, imapMarkRead } from '@/lib/imap';
import { toast } from 'sonner';
import { Loader2, Paperclip, RefreshCw, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from '@/lib/emailDate';

interface AdvancedFilter {
  keyword: string;
  from: string;
  subject: string;
  hasAttachment: boolean;
  onlyUnread: boolean;
  dateFrom: string;
  dateTo: string;
}

const emptyFilter = (): AdvancedFilter => ({
  keyword: '',
  from: '',
  subject: '',
  hasAttachment: false,
  onlyUnread: false,
  dateFrom: '',
  dateTo: '',
});

function buildQuery(f: AdvancedFilter): string {
  const parts: string[] = [];
  if (f.keyword) parts.push(f.keyword);
  if (f.from) parts.push(`from:${f.from}`);
  if (f.subject) parts.push(`subject:${f.subject}`);
  if (f.hasAttachment) parts.push('has:attachment');
  if (f.onlyUnread) parts.push('is:unread');
  if (f.dateFrom) {
    // Gmail expects YYYY/MM/DD
    parts.push(`after:${f.dateFrom.replace(/-/g, '/')}`);
  }
  if (f.dateTo) {
    parts.push(`before:${f.dateTo.replace(/-/g, '/')}`);
  }
  return parts.join(' ');
}

function isFilterActive(f: AdvancedFilter): boolean {
  return !!(f.keyword || f.from || f.subject || f.hasAttachment || f.onlyUnread || f.dateFrom || f.dateTo);
}

export function EmailList() {
  const activeAccount = useGmailStore(selectActiveAccount);
  const updateAccountToken = useGmailStore((s) => s.updateAccountToken);
  const updateAccountEmails = useGmailStore((s) => s.updateAccountEmails);
  const selectedEmail = useGmailStore((s) => s.selectedEmail);
  const setSelectedEmail = useGmailStore((s) => s.setSelectedEmail);
  const isLoading = useGmailStore((s) => s.isLoading);
  const setLoading = useGmailStore((s) => s.setLoading);
  const setFetchingDetail = useGmailStore((s) => s.setFetchingDetail);
  const markEmailAsRead = useGmailStore((s) => s.markEmailAsRead);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [filter, setFilter] = useState<AdvancedFilter>(emptyFilter());
  const [draftFilter, setDraftFilter] = useState<AdvancedFilter>(emptyFilter());
  const [popoverOpen, setPopoverOpen] = useState(false);

  if (!activeAccount) return null;

  const emails = activeAccount.emails;
  const nextPageToken = activeAccount.nextPageToken;
  const readEmailIds = activeAccount.readEmailIds ?? [];

  const isEmailUnread = (id: string, gmailUnread: boolean | undefined) =>
    (gmailUnread !== false) && !readEmailIds.includes(id);

  const unreadCount = emails.filter((e) => isEmailUnread(e.id, e.isUnread)).length;

  const getAT = () =>
    getValidToken(activeAccount.token!, (t) => updateAccountToken(activeAccount.email, t));

  const isImap = activeAccount.type === 'imap';

  const load = async (silent = false, customFilter?: AdvancedFilter) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      if (isImap && activeAccount.imapConfig) {
        const { messages, hasMore } = await imapFetchEmails(activeAccount.imapConfig, activeAccount.email, 1);
        updateAccountEmails(activeAccount.email, messages, undefined);
        // store hasMore in account
        useGmailStore.setState((s) => ({
          accounts: s.accounts.map((a) =>
            a.email === activeAccount.email ? { ...a, imapPage: 1, imapHasMore: hasMore } : a
          ),
        }));
      } else {
        const at = await getAT();
        const q = buildQuery(customFilter ?? filter);
        const { messages, nextPageToken } = await fetchEmails(at, 30, undefined, q || undefined);
        updateAccountEmails(activeAccount.email, messages, nextPageToken);
      }
    } catch (e: any) {
      if (!silent)
        toast.error('E-Mails konnten nicht geladen werden: ' + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Beim ersten Anzeigen: Cache sofort zeigen, im Hintergrund aktualisieren
  useEffect(() => {
    load(emails.length > 0);
  }, [activeAccount.email]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const hasMore = isImap ? activeAccount.imapHasMore : !!nextPageToken;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [nextPageToken, activeAccount.imapHasMore, loadingMore, activeAccount.email]);

  const loadMore = async () => {
    if (!nextPageToken && !activeAccount.imapHasMore) return;
    setLoadingMore(true);
    try {
      if (isImap && activeAccount.imapConfig) {
        const nextPage = (activeAccount.imapPage ?? 1) + 1;
        const { messages, hasMore } = await imapFetchEmails(activeAccount.imapConfig, activeAccount.email, nextPage);
        updateAccountEmails(activeAccount.email, [...emails, ...messages], undefined);
        useGmailStore.setState((s) => ({
          accounts: s.accounts.map((a) =>
            a.email === activeAccount.email ? { ...a, imapPage: nextPage, imapHasMore: hasMore } : a
          ),
        }));
      } else {
        const at = await getAT();
        const q = buildQuery(filter);
        const { messages, nextPageToken: newToken } = await fetchEmails(at, 30, nextPageToken, q || undefined);
        updateAccountEmails(activeAccount.email, [...emails, ...messages], newToken);
      }
    } catch (e: any) {
      toast.error('Fehler beim Laden: ' + (e?.message ?? String(e)));
    } finally {
      setLoadingMore(false);
    }
  };

  const applyFilter = () => {
    setFilter(draftFilter);
    setPopoverOpen(false);
    load(false, draftFilter);
  };

  const resetFilter = () => {
    const empty = emptyFilter();
    setFilter(empty);
    setDraftFilter(empty);
    setPopoverOpen(false);
    load(false, empty);
  };

  const selectEmail = (email: (typeof emails)[0]) => {
    setSelectedEmail(email);
    setFetchingDetail(true);
    markEmailAsRead(activeAccount.email, email.id);
    if (email.isUnread !== false) {
      if (isImap && activeAccount.imapConfig) {
        imapMarkRead(activeAccount.imapConfig, activeAccount.email, email.id).catch(() => {});
      } else {
        getAT().then((at) => markMessageAsRead(at, email.id)).catch(() => {});
      }
    }
  };

  const senderName = (from: string) => {
    const match = from.match(/^"?([^"<]+)"?\s*</);
    return match ? match[1].trim() : from.replace(/<.*>/, '').trim() || from;
  };

  const active = isFilterActive(filter);

  return (
    <div className="flex h-full flex-col border-r border-border">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Posteingang</h2>
          {unreadCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
              {unreadCount}
            </span>
          )}
          {refreshing && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-1">
          {active && (
            <Button size="icon" variant="ghost" onClick={resetFilter} title="Filter zurücksetzen">
              <X className="h-4 w-4 text-destructive" />
            </Button>
          )}
          <Popover open={popoverOpen} onOpenChange={(o) => { setPopoverOpen(o); if (o) setDraftFilter(filter); }}>
            <PopoverTrigger asChild>
              <Button size="icon" variant={active ? 'default' : 'ghost'} title="Erweiterte Suche" disabled={isImap}>
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4 space-y-3" align="end">
              <p className="text-sm font-semibold">Erweiterte Suche</p>

              <div className="space-y-1">
                <Label className="text-xs">Stichwort</Label>
                <Input
                  placeholder="z.B. Rechnung"
                  value={draftFilter.keyword}
                  onChange={(e) => setDraftFilter((f) => ({ ...f, keyword: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Absender (von)</Label>
                <Input
                  placeholder="z.B. info@beispiel.de"
                  value={draftFilter.from}
                  onChange={(e) => setDraftFilter((f) => ({ ...f, from: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Betreff</Label>
                <Input
                  placeholder="z.B. Angebot"
                  value={draftFilter.subject}
                  onChange={(e) => setDraftFilter((f) => ({ ...f, subject: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Datum von</Label>
                  <Input
                    type="date"
                    value={draftFilter.dateFrom}
                    onChange={(e) => setDraftFilter((f) => ({ ...f, dateFrom: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Datum bis</Label>
                  <Input
                    type="date"
                    value={draftFilter.dateTo}
                    onChange={(e) => setDraftFilter((f) => ({ ...f, dateTo: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="hasAttachment"
                    checked={draftFilter.hasAttachment}
                    onCheckedChange={(v) => setDraftFilter((f) => ({ ...f, hasAttachment: !!v }))}
                  />
                  <Label htmlFor="hasAttachment" className="text-sm cursor-pointer">Nur mit Anhängen</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="onlyUnread"
                    checked={draftFilter.onlyUnread}
                    onCheckedChange={(v) => setDraftFilter((f) => ({ ...f, onlyUnread: !!v }))}
                  />
                  <Label htmlFor="onlyUnread" className="text-sm cursor-pointer">Nur ungelesene</Label>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button className="flex-1" onClick={applyFilter}>Suchen</Button>
                <Button variant="outline" onClick={resetFilter}>Zurücksetzen</Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => load(false)}
            disabled={isLoading || refreshing}
            title="Aktualisieren"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Active filter badge */}
      {active && (
        <div className="flex flex-wrap gap-1 px-4 py-2 border-b border-border bg-muted/30">
          {filter.keyword && <span className="text-xs bg-primary/10 text-primary rounded px-2 py-0.5">"{filter.keyword}"</span>}
          {filter.from && <span className="text-xs bg-primary/10 text-primary rounded px-2 py-0.5">von: {filter.from}</span>}
          {filter.subject && <span className="text-xs bg-primary/10 text-primary rounded px-2 py-0.5">Betreff: {filter.subject}</span>}
          {filter.hasAttachment && <span className="text-xs bg-primary/10 text-primary rounded px-2 py-0.5">📎 Mit Anhang</span>}
          {filter.onlyUnread && <span className="text-xs bg-primary/10 text-primary rounded px-2 py-0.5">Ungelesen</span>}
          {filter.dateFrom && <span className="text-xs bg-primary/10 text-primary rounded px-2 py-0.5">ab {filter.dateFrom}</span>}
          {filter.dateTo && <span className="text-xs bg-primary/10 text-primary rounded px-2 py-0.5">bis {filter.dateTo}</span>}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {emails.length === 0 && isLoading && (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {emails.length === 0 && !isLoading && (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">Keine E-Mails gefunden</div>
        )}

        {emails.map((email) => {
          const unread = isEmailUnread(email.id, email.isUnread);
          return (
          <button
            key={email.id}
            onClick={() => selectEmail(email)}
            className={cn(
              'w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/50',
              selectedEmail?.id === email.id && 'bg-muted'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                {unread && (
                  <span className="shrink-0 h-2 w-2 rounded-full bg-primary" />
                )}
                <span className={cn('truncate text-sm', unread ? 'font-bold' : 'font-medium')}>
                  {senderName(email.from)}
                </span>
              </div>
              <span className={cn('shrink-0 text-xs', unread ? 'text-foreground font-semibold' : 'text-muted-foreground')}>
                {format(email.date)}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <p className={cn('truncate text-sm flex-1', unread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80')}>
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
          );
        })}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="py-3 flex justify-center">
          {loadingMore && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {!nextPageToken && !activeAccount.imapHasMore && emails.length > 0 && (
            <p className="text-xs text-muted-foreground">Keine weiteren E-Mails</p>
          )}
        </div>
      </div>
    </div>
  );
}
