import { useEffect, useRef, useState } from 'react';
import { useGmailStore, selectActiveAccount } from '@/store/gmailStore';
import type { GmailAccount } from '@/store/gmailStore';
import { fetchEmails, getValidToken, markMessageAsRead, markMessageAsUnread, deleteEmail, archiveEmail, toggleStar, markAsSpam, markAsNotSpam } from '@/lib/gmail';
import type { GmailMessage } from '@/lib/gmail';
import { imapFetchEmails, imapMarkRead, imapMarkUnread, imapDeleteEmail, imapToggleFlag } from '@/lib/imap';
import { toast } from 'sonner';
import { Inbox, Send, FileEdit, Star, ShoppingBag, ShieldAlert, Loader2, Paperclip, RefreshCw, SlidersHorizontal, X, ChevronDown, Layers, Archive } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { format } from '@/lib/emailDate';

type GmailFolder = 'inbox' | 'sent' | 'drafts' | 'starred' | 'purchases' | 'spam' | 'archive';
type ImapFolder = 'INBOX' | 'Sent' | 'Drafts' | 'Junk' | 'FLAGGED';

const GMAIL_FOLDERS: { id: GmailFolder; label: string; icon: React.ElementType }[] = [
  { id: 'inbox',     label: 'Posteingang', icon: Inbox },
  { id: 'sent',      label: 'Gesendet',    icon: Send },
  { id: 'drafts',    label: 'Entwürfe',    icon: FileEdit },
  { id: 'starred',   label: 'Markiert',    icon: Star },
  { id: 'purchases', label: 'Käufe',       icon: ShoppingBag },
  { id: 'archive',   label: 'Archiv',      icon: Archive },
  { id: 'spam',      label: 'Spam',        icon: ShieldAlert },
];

const IMAP_FOLDERS: { id: ImapFolder; label: string; icon: React.ElementType }[] = [
  { id: 'INBOX',   label: 'Posteingang', icon: Inbox },
  { id: 'Sent',    label: 'Gesendet',    icon: Send },
  { id: 'Drafts',  label: 'Entwürfe',    icon: FileEdit },
  { id: 'FLAGGED', label: 'Markiert',    icon: Star },
  { id: 'Junk',    label: 'Spam',        icon: ShieldAlert },
];

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
  if (f.dateFrom) parts.push(`after:${f.dateFrom.replace(/-/g, '/')}`);
  if (f.dateTo) parts.push(`before:${f.dateTo.replace(/-/g, '/')}`);
  return parts.join(' ');
}

function isFilterActive(f: AdvancedFilter): boolean {
  return !!(f.keyword || f.from || f.subject || f.hasAttachment || f.onlyUnread || f.dateFrom || f.dateTo);
}

// ── helpers ────────────────────────────────────────────────────────────────

// Returns messages + pagination info for one account (first page)
async function loadAccountEmailsPage(
  acc: GmailAccount,
  gmailFolder: GmailFolder,
  updateToken: (email: string, t: any) => void,
  imapPage = 1,
  gmailPageToken?: string,
): Promise<{ messages: GmailMessage[]; nextPageToken?: string; imapPage: number; hasMore: boolean }> {
  try {
    if (acc.type === 'imap' && acc.imapConfig) {
      const { messages, hasMore } = await imapFetchEmails(acc.imapConfig, acc.email, imapPage, 'INBOX');
      return { messages, imapPage, hasMore };
    } else if (acc.token) {
      const at = await getValidToken(acc.token, (t) => updateToken(acc.email, t));
      const { messages, nextPageToken } = await fetchEmails(at, 30, gmailPageToken, undefined, gmailFolder);
      return { messages, nextPageToken, imapPage: 1, hasMore: !!nextPageToken };
    }
  } catch { /* ignore per-account errors */ }
  return { messages: [], imapPage: 1, hasMore: false };
}



function parseDateMs(dateStr: string): number {
  try { return new Date(dateStr).getTime() || 0; } catch { return 0; }
}

// ── Component ──────────────────────────────────────────────────────────────

interface EmailListProps {
  /** When provided, the folder is controlled externally (Gmail layout sidebar) */
  controlledFolder?: string;
  onFolderChange?: (id: string) => void;
  /** Hide the folder dropdown bar (used in Gmail layout where sidebar handles it) */
  hideFolderDropdown?: boolean;
  /** Called after an email is selected (used to switch view in Gmail layout) */
  onEmailSelected?: () => void;
  /** Called when an unread email is opened so the parent can decrement its count */
  onEmailRead?: (folder: string) => void;
  /** Real unread counts per folder fetched from the API */
  unreadCounts?: Record<string, number>;
}

export function EmailList({
  controlledFolder,
  onFolderChange,
  hideFolderDropdown,
  onEmailSelected,
  onEmailRead,
  unreadCounts,
}: EmailListProps = {}) {
  const accounts = useGmailStore((s) => s.accounts);
  const activeIndex = useGmailStore((s) => s.activeIndex);
  const activeAccount = useGmailStore(selectActiveAccount);
  const updateAccountToken = useGmailStore((s) => s.updateAccountToken);
  const updateAccountEmails = useGmailStore((s) => s.updateAccountEmails);
  const selectedEmail = useGmailStore((s) => s.selectedEmail);
  const setSelectedEmail = useGmailStore((s) => s.setSelectedEmail);
  const setDetailAccountEmail = useGmailStore((s) => s.setDetailAccountEmail);
  const isLoading = useGmailStore((s) => s.isLoading);
  const setLoading = useGmailStore((s) => s.setLoading);
  const setFetchingDetail = useGmailStore((s) => s.setFetchingDetail);
  const markEmailAsRead = useGmailStore((s) => s.markEmailAsRead);
  const markEmailAsUnreadInStore = useGmailStore((s) => s.markEmailAsUnread);
  const removeEmailFromList = useGmailStore((s) => s.removeEmailFromList);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [filter, setFilter] = useState<AdvancedFilter>(emptyFilter());
  const [draftFilter, setDraftFilter] = useState<AdvancedFilter>(emptyFilter());
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [gmailFolder, setGmailFolder] = useState<GmailFolder>('inbox');
  const [imapFolder, setImapFolder] = useState<ImapFolder>('INBOX');

  // Sync controlled folder from parent (Gmail-layout sidebar)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!controlledFolder) return;
    if (activeAccount?.type === 'imap') {
      if (controlledFolder !== imapFolder) setImapFolder(controlledFolder as ImapFolder);
    } else {
      if (controlledFolder !== gmailFolder) setGmailFolder(controlledFolder as GmailFolder);
    }
  }, [controlledFolder]);

  // All-mode: merged list with account info + per-account pagination state
  const [allEmails, setAllEmails] = useState<{ email: GmailMessage; accountEmail: string }[]>([]);
  const [allLoading, setAllLoading] = useState(false);
  const [allLoadingMore, setAllLoadingMore] = useState(false);
  // per-account pagination: accountEmail → { nextPageToken, imapPage, hasMore }
  const [allPaging, setAllPaging] = useState<Record<string, { nextPageToken?: string; imapPage: number; hasMore: boolean }>>({});
  const allSentinelRef = useRef<HTMLDivElement>(null);

  const isAllMode = activeIndex === -1 && accounts.length > 1;
  const allHasMore = Object.values(allPaging).some((p) => p.hasMore);

  // ── All-mode loading ──────────────────────────────────────────────────────

  const loadAll = async () => {
    setAllLoading(true);
    try {
      const results = await Promise.all(
        accounts.map(async (acc) => {
          const r = await loadAccountEmailsPage(acc, gmailFolder, updateAccountToken);
          return { acc, r };
        })
      );
      const newPaging: typeof allPaging = {};
      const merged: { email: GmailMessage; accountEmail: string }[] = [];
      for (const { acc, r } of results) {
        newPaging[acc.email] = { nextPageToken: r.nextPageToken, imapPage: r.imapPage, hasMore: r.hasMore };
        merged.push(...r.messages.map((email) => ({ email, accountEmail: acc.email })));
      }
      merged.sort((a, b) => parseDateMs(b.email.date) - parseDateMs(a.email.date));
      setAllEmails(merged);
      setAllPaging(newPaging);
    } catch (e: any) {
      toast.error('Fehler beim Laden: ' + (e?.message ?? String(e)));
    } finally {
      setAllLoading(false);
    }
  };

  const loadAllMore = async () => {
    if (allLoadingMore || !allHasMore) return;
    setAllLoadingMore(true);
    try {
      const results = await Promise.all(
        accounts
          .filter((acc) => allPaging[acc.email]?.hasMore)
          .map(async (acc) => {
            const paging = allPaging[acc.email];
            const r = await loadAccountEmailsPage(
              acc, gmailFolder, updateAccountToken,
              (paging?.imapPage ?? 1) + (acc.type === 'imap' ? 1 : 0),
              acc.type !== 'imap' ? paging?.nextPageToken : undefined,
            );
            return { acc, r };
          })
      );
      const newPaging = { ...allPaging };
      const newMsgs: { email: GmailMessage; accountEmail: string }[] = [];
      for (const { acc, r } of results) {
        newPaging[acc.email] = { nextPageToken: r.nextPageToken, imapPage: r.imapPage, hasMore: r.hasMore };
        newMsgs.push(...r.messages.map((email) => ({ email, accountEmail: acc.email })));
      }
      setAllPaging(newPaging);
      setAllEmails((prev) => {
        const combined = [...prev, ...newMsgs];
        combined.sort((a, b) => parseDateMs(b.email.date) - parseDateMs(a.email.date));
        return combined;
      });
    } catch (e: any) {
      toast.error('Fehler beim Laden: ' + (e?.message ?? String(e)));
    } finally {
      setAllLoadingMore(false);
    }
  };

  useEffect(() => {
    if (isAllMode) {
      setAllEmails([]);
      setAllPaging({});
      loadAll();
    }
  }, [isAllMode, gmailFolder]);

  useEffect(() => {
    if (isAllMode) {
      setAllEmails([]);
      setAllPaging({});
      loadAll();
    }
  }, [accounts.length]);

  // Infinite scroll for all-mode
  useEffect(() => {
    if (!isAllMode) return;
    const el = allSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && allHasMore && !allLoadingMore) {
          loadAllMore();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isAllMode, allHasMore, allLoadingMore, allPaging]);

  // ── Single-account mode ───────────────────────────────────────────────────

  if (!isAllMode && !activeAccount) return null;

  const emails = activeAccount?.emails ?? [];
  const nextPageToken = activeAccount?.nextPageToken;
  const readEmailIds = activeAccount?.readEmailIds ?? [];
  const isImap = activeAccount?.type === 'imap';

  const isEmailUnread = (id: string, gmailUnread: boolean | undefined) =>
    (gmailUnread !== false) && !readEmailIds.includes(id);

  const getAT = () =>
    getValidToken(activeAccount!.token!, (t) => updateAccountToken(activeAccount!.email, t));

  const load = async (silent = false, customFilter?: AdvancedFilter, overrideGmailFolder?: GmailFolder, overrideImapFolder?: ImapFolder) => {
    if (!activeAccount) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      if (isImap && activeAccount.imapConfig) {
        const folder = overrideImapFolder ?? imapFolder;
        const { messages, hasMore } = await imapFetchEmails(activeAccount.imapConfig, activeAccount.email, 1, folder);
        updateAccountEmails(activeAccount.email, messages, undefined);
        useGmailStore.setState((s) => ({
          accounts: s.accounts.map((a) =>
            a.email === activeAccount.email ? { ...a, imapPage: 1, imapHasMore: hasMore } : a
          ),
        }));
      } else {
        const at = await getAT();
        const q = buildQuery(customFilter ?? filter);
        const folder = overrideGmailFolder ?? gmailFolder;
        const { messages, nextPageToken } = await fetchEmails(at, 30, undefined, q || undefined, folder);
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

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!isAllMode) load(emails.length > 0);
  }, [activeAccount?.email]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!isAllMode) {
      setSelectedEmail(null);
      load(false);
    }
  }, [gmailFolder, imapFolder]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (isAllMode) return;
    const el = sentinelRef.current;
    if (!el) return;
    const hasMore = isImap ? activeAccount?.imapHasMore : !!nextPageToken;
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
  }, [nextPageToken, activeAccount?.imapHasMore, loadingMore, activeAccount?.email, isAllMode]);

  const loadMore = async () => {
    if (!activeAccount) return;
    if (!nextPageToken && !activeAccount.imapHasMore) return;
    setLoadingMore(true);
    try {
      if (isImap && activeAccount.imapConfig) {
        const nextPage = (activeAccount.imapPage ?? 1) + 1;
        const { messages, hasMore } = await imapFetchEmails(activeAccount.imapConfig, activeAccount.email, nextPage, imapFolder);
        updateAccountEmails(activeAccount.email, [...emails, ...messages], undefined);
        useGmailStore.setState((s) => ({
          accounts: s.accounts.map((a) =>
            a.email === activeAccount.email ? { ...a, imapPage: nextPage, imapHasMore: hasMore } : a
          ),
        }));
      } else {
        const at = await getAT();
        const q = buildQuery(filter);
        const { messages, nextPageToken: newToken } = await fetchEmails(at, 30, nextPageToken, q || undefined, gmailFolder);
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

  const selectEmail = (email: GmailMessage, ownerAccountEmail?: string) => {
    // In all-mode: set the detail account WITHOUT switching activeIndex
    if (isAllMode && ownerAccountEmail) {
      setDetailAccountEmail(ownerAccountEmail);
    } else {
      setDetailAccountEmail(null);
    }
    const wasUnread = email.isUnread !== false && !readEmailIds.includes(email.id);
    setSelectedEmail(email);
    setFetchingDetail(true);
    const ownerEmail = ownerAccountEmail ?? activeAccount?.email ?? '';
    markEmailAsRead(ownerEmail, email.id);
    // Notify parent to decrement API unread count
    if (wasUnread) {
      const folder = (!isAllMode && isImap) ? imapFolder : gmailFolder;
      onEmailRead?.(folder);
    }
    // Also update all-mode local state so the unread dot/bold disappears immediately
    if (isAllMode) {
      setAllEmails((prev) =>
        prev.map((item) =>
          item.email.id === email.id && item.accountEmail === ownerEmail
            ? { ...item, email: { ...item.email, isUnread: false } }
            : item
        )
      );
    }
    if (email.isUnread !== false) {
      const ownerAcc = accounts.find((a) => a.email === ownerEmail) ?? activeAccount;
      if (ownerAcc?.type === 'imap' && ownerAcc.imapConfig) {
        imapMarkRead(ownerAcc.imapConfig, ownerAcc.email, email.id, imapFolder).catch(() => {});
      } else if (ownerAcc?.token) {
        getValidToken(ownerAcc.token, (t) => updateAccountToken(ownerAcc.email, t))
          .then((at) => markMessageAsRead(at, email.id))
          .catch(() => {});
      }
    }
    onEmailSelected?.();
  };

  const senderName = (from: string) => {
    const match = from.match(/^"?([^"<]+)"?\s*</);
    return match ? match[1].trim() : from.replace(/<.*>/, '').trim() || from;
  };

  // ── Context menu actions ───────────────────────────────────────────────────

  const handleContextAction = async (
    action: string,
    email: GmailMessage,
    ownerAccountEmail: string,
  ) => {
    const ownerAcc = accounts.find((a) => a.email === ownerAccountEmail) ?? activeAccount;
    if (!ownerAcc) return;
    const isOwnerImap = ownerAcc.type === 'imap';
    const currentFolder = isOwnerImap ? imapFolder : gmailFolder;

    try {
      if (isOwnerImap && ownerAcc.imapConfig) {
        switch (action) {
          case 'delete':
            await imapDeleteEmail(ownerAcc.imapConfig, ownerAcc.email, email.id, currentFolder);
            removeEmailFromList(ownerAcc.email, email.id);
            toast.success('E-Mail gelöscht');
            break;
          case 'mark_unread':
            await imapMarkUnread(ownerAcc.imapConfig, ownerAcc.email, email.id, currentFolder);
            markEmailAsUnreadInStore(ownerAcc.email, email.id);
            if (isAllMode) setAllEmails((prev) => prev.map((item) => item.email.id === email.id && item.accountEmail === ownerAccountEmail ? { ...item, email: { ...item.email, isUnread: true } } : item));
            toast.success('Als ungelesen markiert');
            break;
          case 'mark_read':
            await imapMarkRead(ownerAcc.imapConfig, ownerAcc.email, email.id, currentFolder);
            markEmailAsRead(ownerAcc.email, email.id);
            if (isAllMode) setAllEmails((prev) => prev.map((item) => item.email.id === email.id && item.accountEmail === ownerAccountEmail ? { ...item, email: { ...item.email, isUnread: false } } : item));
            toast.success('Als gelesen markiert');
            break;
          case 'flag':
            await imapToggleFlag(ownerAcc.imapConfig, ownerAcc.email, email.id, true, currentFolder);
            toast.success('Markiert');
            break;
          case 'unflag':
            await imapToggleFlag(ownerAcc.imapConfig, ownerAcc.email, email.id, false, currentFolder);
            toast.success('Markierung entfernt');
            break;
        }
      } else if (ownerAcc.token) {
        const at = await getValidToken(ownerAcc.token, (t) => updateAccountToken(ownerAcc.email, t));
        switch (action) {
          case 'delete':
            await deleteEmail(at, email.id);
            removeEmailFromList(ownerAcc.email, email.id);
            toast.success('E-Mail in den Papierkorb verschoben');
            break;
          case 'archive':
            await archiveEmail(at, email.id);
            removeEmailFromList(ownerAcc.email, email.id);
            toast.success('E-Mail archiviert');
            break;
          case 'unarchive':
            await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.id}/modify`,
              {
                method: 'POST',
                headers: { Authorization: `Bearer ${at}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ addLabelIds: ['INBOX'] }),
              }
            );
            removeEmailFromList(ownerAcc.email, email.id);
            toast.success('In Posteingang verschoben');
            break;
          case 'mark_unread':
            await markMessageAsUnread(at, email.id);
            markEmailAsUnreadInStore(ownerAcc.email, email.id);
            if (isAllMode) setAllEmails((prev) => prev.map((item) => item.email.id === email.id && item.accountEmail === ownerAccountEmail ? { ...item, email: { ...item.email, isUnread: true } } : item));
            toast.success('Als ungelesen markiert');
            break;
          case 'mark_read':
            await markMessageAsRead(at, email.id);
            markEmailAsRead(ownerAcc.email, email.id);
            if (isAllMode) setAllEmails((prev) => prev.map((item) => item.email.id === email.id && item.accountEmail === ownerAccountEmail ? { ...item, email: { ...item.email, isUnread: false } } : item));
            toast.success('Als gelesen markiert');
            break;
          case 'star':
            await toggleStar(at, email.id, true);
            useGmailStore.setState((s) => ({
              accounts: s.accounts.map((a) =>
                a.email === ownerAcc.email
                  ? { ...a, emails: a.emails.map((e) => e.id === email.id ? { ...e, isStarred: true } : e) }
                  : a
              ),
            }));
            if (isAllMode) setAllEmails((prev) => prev.map((item) => item.email.id === email.id && item.accountEmail === ownerAccountEmail ? { ...item, email: { ...item.email, isStarred: true } } : item));
            toast.success('Stern hinzugefügt');
            break;
          case 'unstar':
            await toggleStar(at, email.id, false);
            useGmailStore.setState((s) => ({
              accounts: s.accounts.map((a) =>
                a.email === ownerAcc.email
                  ? { ...a, emails: a.emails.map((e) => e.id === email.id ? { ...e, isStarred: false } : e) }
                  : a
              ),
            }));
            if (isAllMode) setAllEmails((prev) => prev.map((item) => item.email.id === email.id && item.accountEmail === ownerAccountEmail ? { ...item, email: { ...item.email, isStarred: false } } : item));
            toast.success('Stern entfernt');
            break;
          case 'spam':
            await markAsSpam(at, email.id);
            removeEmailFromList(ownerAcc.email, email.id);
            toast.success('Als Spam markiert');
            break;
          case 'not_spam':
            await markAsNotSpam(at, email.id);
            removeEmailFromList(ownerAcc.email, email.id);
            toast.success('Als kein Spam markiert');
            break;
        }
      }
    } catch (e: any) {
      toast.error('Aktion fehlgeschlagen: ' + (e?.message ?? String(e)));
    }
  };

  // Folder UI: in all-mode only show Gmail folders (inbox etc.) since mixed accounts
  const folders = (!isAllMode && isImap) ? IMAP_FOLDERS : GMAIL_FOLDERS;
  const activeFolder = (!isAllMode && isImap) ? imapFolder : gmailFolder;
  const activeFolderLabel = folders.find((f) => f.id === activeFolder)?.label ?? 'Posteingang';

  const handleFolderChange = (id: string) => {
    if (!isAllMode && isImap) setImapFolder(id as ImapFolder);
    else setGmailFolder(id as GmailFolder);
    onFolderChange?.(id);
  };

  const active = isFilterActive(filter);

  // Displayed list
  const displayEmails = isAllMode
    ? allEmails
    : emails.map((e) => ({ email: e, accountEmail: activeAccount?.email ?? '' }));

  const isDisplayLoading = isAllMode ? allLoading : isLoading;

  return (
    <div className="flex h-full flex-col border-r border-border">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          {isAllMode
              ? <><Layers className="h-4 w-4 text-muted-foreground" /><h2 className="font-semibold">Alle Postfächer</h2></>
              : <h2 className="font-semibold">{activeFolderLabel}</h2>
            }
        </div>
        <div className="flex items-center gap-1">
          {active && !isAllMode && (
            <Button size="icon" variant="ghost" onClick={resetFilter} title="Filter zurücksetzen">
              <X className="h-4 w-4 text-destructive" />
            </Button>
          )}
          {!isAllMode && (
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
                  <Input placeholder="z.B. Rechnung" value={draftFilter.keyword} onChange={(e) => setDraftFilter((f) => ({ ...f, keyword: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Absender (von)</Label>
                  <Input placeholder="z.B. info@beispiel.de" value={draftFilter.from} onChange={(e) => setDraftFilter((f) => ({ ...f, from: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Betreff</Label>
                  <Input placeholder="z.B. Angebot" value={draftFilter.subject} onChange={(e) => setDraftFilter((f) => ({ ...f, subject: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Datum von</Label>
                    <Input type="date" value={draftFilter.dateFrom} onChange={(e) => setDraftFilter((f) => ({ ...f, dateFrom: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Datum bis</Label>
                    <Input type="date" value={draftFilter.dateTo} onChange={(e) => setDraftFilter((f) => ({ ...f, dateTo: e.target.value }))} />
                  </div>
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <Checkbox id="hasAttachment" checked={draftFilter.hasAttachment} onCheckedChange={(v) => setDraftFilter((f) => ({ ...f, hasAttachment: !!v }))} />
                    <Label htmlFor="hasAttachment" className="text-sm cursor-pointer">Nur mit Anhängen</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="onlyUnread" checked={draftFilter.onlyUnread} onCheckedChange={(v) => setDraftFilter((f) => ({ ...f, onlyUnread: !!v }))} />
                    <Label htmlFor="onlyUnread" className="text-sm cursor-pointer">Nur ungelesene</Label>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button className="flex-1" onClick={applyFilter}>Suchen</Button>
                  <Button variant="outline" onClick={resetFilter}>Zurücksetzen</Button>
                </div>
              </PopoverContent>
            </Popover>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => isAllMode ? loadAll() : load(false)}
            disabled={isDisplayLoading || refreshing}
            title="Aktualisieren"
          >
            {isDisplayLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Folder dropdown – only in Apple layout */}
      {!hideFolderDropdown && (
      <div className="border-b border-border px-3 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 w-full justify-between">
              <span className="flex items-center gap-1.5">
                {(() => { const f = folders.find((f) => f.id === activeFolder); const Icon = f?.icon ?? Inbox; return <Icon className="h-3.5 w-3.5 text-muted-foreground" />; })()}
                <span className="text-sm">{activeFolderLabel}</span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48">
            {folders.map(({ id, label, icon: Icon }) => {
              const count = unreadCounts?.[id] ?? 0;
              return (
              <DropdownMenuItem
                key={id}
                onSelect={() => handleFolderChange(id)}
                className="flex items-center gap-2"
              >
                <Icon className={cn('h-4 w-4', activeFolder === id ? 'text-primary' : 'text-muted-foreground')} />
                <span className={cn('flex-1', activeFolder === id && 'font-semibold text-primary')}>{label}</span>
                {count > 0 && (
                  <span className="shrink-0 text-xs font-semibold text-primary tabular-nums">{count > 9999 ? '9999+' : count}</span>
                )}
                {activeFolder === id && count === 0 && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
              </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      )}

      {/* Active filter badge */}
      {active && !isAllMode && (
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
        {displayEmails.length === 0 && isDisplayLoading && (
          <div className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-10" />
                </div>
                <Skeleton className="h-3.5 w-48" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        )}
        {displayEmails.length === 0 && !isDisplayLoading && (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">Keine E-Mails gefunden</div>
        )}

        {displayEmails.map(({ email, accountEmail }) => {
          const unread = isEmailUnread(email.id, email.isUnread);
          const ownerAcc = accounts.find((a) => a.email === accountEmail);
          const ownerIsImap = ownerAcc?.type === 'imap';
          const inSpam = !ownerIsImap && gmailFolder === 'spam';
          const inArchive = !ownerIsImap && gmailFolder === 'archive';
          const isStarred = !ownerIsImap && !!email.isStarred;
          return (
            <ContextMenu key={`${accountEmail}-${email.id}`}>
              <ContextMenuTrigger asChild>
                <button
                  onClick={() => selectEmail(email, accountEmail)}
                  className={cn(
                    'w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/50',
                    selectedEmail?.id === email.id && 'bg-muted'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {unread && <span className="shrink-0 h-2 w-2 rounded-full bg-primary" />}
                      <span className={cn('truncate text-sm', unread ? 'font-bold' : 'font-medium')}>
                        {senderName(email.from)}
                      </span>
                    </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isStarred && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />}
                    <span className={cn('text-xs', unread ? 'text-foreground font-semibold' : 'text-muted-foreground')}>
                      {format(email.date)}
                    </span>
                  </div>
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
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-muted-foreground flex-1">{email.snippet}</p>
                    {isAllMode && (
                      <span className="shrink-0 text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5 max-w-[100px] truncate">
                        {accountEmail}
                      </span>
                    )}
                  </div>
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-52">
                {unread
                  ? <ContextMenuItem onSelect={() => handleContextAction('mark_read', email, accountEmail)}>✅ Als gelesen markieren</ContextMenuItem>
                  : <ContextMenuItem onSelect={() => handleContextAction('mark_unread', email, accountEmail)}>🔵 Als ungelesen markieren</ContextMenuItem>
                }
                {ownerIsImap ? (
                  <>
                    <ContextMenuItem onSelect={() => handleContextAction('flag', email, accountEmail)}>🚩 Markieren (Flag)</ContextMenuItem>
                    <ContextMenuItem onSelect={() => handleContextAction('unflag', email, accountEmail)}>🏳 Markierung entfernen</ContextMenuItem>
                  </>
                ) : (
                  <>
                    {isStarred
                      ? <ContextMenuItem onSelect={() => handleContextAction('unstar', email, accountEmail)}>★ Stern entfernen</ContextMenuItem>
                      : <ContextMenuItem onSelect={() => handleContextAction('star', email, accountEmail)}>⭐ Mit Stern markieren</ContextMenuItem>
                    }
                  </>
                )}
                <ContextMenuSeparator />
                {!ownerIsImap && !inArchive && (
                  <ContextMenuItem onSelect={() => handleContextAction('archive', email, accountEmail)}>📦 Archivieren</ContextMenuItem>
                )}
                {!ownerIsImap && inArchive && (
                  <ContextMenuItem onSelect={() => handleContextAction('unarchive', email, accountEmail)}>📥 In Posteingang</ContextMenuItem>
                )}
                {!ownerIsImap && !inSpam && (
                  <ContextMenuItem onSelect={() => handleContextAction('spam', email, accountEmail)}>🛡 Als Spam markieren</ContextMenuItem>
                )}
                {!ownerIsImap && inSpam && (
                  <ContextMenuItem onSelect={() => handleContextAction('not_spam', email, accountEmail)}>✅ Kein Spam</ContextMenuItem>
                )}
                <ContextMenuSeparator />
                <ContextMenuItem
                  onSelect={() => handleContextAction('delete', email, accountEmail)}
                  className="text-destructive focus:text-destructive"
                >
                  🗑 Löschen
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}

        {/* Infinite scroll sentinel – only in single-account mode */}
        {!isAllMode && (
          <div ref={sentinelRef} className="py-3 flex justify-center">
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {!nextPageToken && !activeAccount?.imapHasMore && emails.length > 0 && (
              <p className="text-xs text-muted-foreground">Keine weiteren E-Mails</p>
            )}
          </div>
        )}

        {/* Infinite scroll sentinel – all-mode */}
        {isAllMode && (
          <div ref={allSentinelRef} className="py-3 flex justify-center">
            {allLoadingMore && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {!allHasMore && allEmails.length > 0 && !allLoading && (
              <p className="text-xs text-muted-foreground">Keine weiteren E-Mails</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
