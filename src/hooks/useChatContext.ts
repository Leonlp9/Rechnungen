import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useAppStore } from '@/store';
import { useChatStore } from '@/store/chatStore';
import { useTemplateStore } from '@/store/templateStore';
import { useListsStore } from '@/store/listsStore';
import { useGmailStore, selectActiveAccount } from '@/store/gmailStore';
import { CATEGORY_LABELS, TYPE_LABELS } from '@/types';
import type { Invoice } from '@/types';
import type { AppList, TodoListData, KanbanListData } from '@/store/listsStore';

function fmtEur(v: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
}

function invoiceSummary(inv: Invoice) {
  return `[ID:${inv.id}] ${inv.date} | ${inv.partner} | ${inv.description} | ${TYPE_LABELS[inv.type] ?? inv.type} | ${CATEGORY_LABELS[inv.category as keyof typeof CATEGORY_LABELS] ?? inv.category} | ${fmtEur(inv.brutto)}`;
}

function listSummary(list: AppList): string {
  if (list.type === 'todo') {
    const data = list.data as TodoListData;
    const done = data.items.filter((i) => i.done).length;
    const open = data.items.length - done;
    const items = data.items.slice(0, 10).map((i) => `    ${i.done ? '✓' : '○'} ${i.text}`).join('\n');
    return `  [Todo] "${list.name}" – ${open} offen, ${done} erledigt\n${items}`;
  }
  if (list.type === 'kanban') {
    const data = list.data as KanbanListData;
    const cols = data.columns.map((c) => `    ${c.title} (${c.cards.length}): ${c.cards.slice(0, 5).map((k) => k.title).join(', ')}`).join('\n');
    return `  [Kanban] "${list.name}"\n${cols}`;
  }
  return `  [Pinboard] "${list.name}"`;
}

export function useChatContext(): string {
  const { pathname } = useLocation();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const invoices = useAppStore((s) => s.invoices);
  const selectedYear = useAppStore((s) => s.selectedYear);
  const { visibleInvoiceIds, useAllInvoicesForContext } = useChatStore();
  const templates = useTemplateStore((s) => s.templates);
  const lists = useListsStore((s) => s.lists);
  const gmailAccounts = useGmailStore((s) => s.accounts);
  const activeAccount = useGmailStore(selectActiveAccount);
  const selectedEmail = useGmailStore((s) => s.selectedEmail);

  // Dashboard
  if (pathname === '/') {
    const yearly = invoices.filter((i) => i.year === selectedYear);
    const einnahmen = yearly.filter((i) => i.type === 'einnahme').reduce((s, i) => s + i.brutto, 0);
    const ausgaben = yearly.filter((i) => i.type === 'ausgabe').reduce((s, i) => s + i.brutto, 0);
    const recent = [...yearly].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map(invoiceSummary);
    return `Seite: Dashboard
Ausgewähltes Jahr: ${selectedYear}
Einnahmen: ${fmtEur(einnahmen)}
Ausgaben: ${fmtEur(ausgaben)}
Gewinn/Verlust: ${fmtEur(einnahmen - ausgaben)}
Anzahl Rechnungen: ${yearly.length}
Letzte 8 Rechnungen (Format: [ID:n] Datum | Partner | Beschreibung | Typ | Kategorie | Brutto):
${recent.map((r) => `  - ${r}`).join('\n')}
Hinweis: Verlinke einzelne Rechnungen mit /invoices/ID`;
  }

  // Invoice Detail
  if (pathname.startsWith('/invoices/') && id) {
    const inv = invoices.find((i) => String(i.id) === id);
    if (inv) {
      return `Seite: Rechnungsdetail
ID: ${inv.id}
Datum: ${inv.date}
Partner: ${inv.partner}
Beschreibung: ${inv.description}
Typ: ${TYPE_LABELS[inv.type] ?? inv.type}
Kategorie: ${CATEGORY_LABELS[inv.category as keyof typeof CATEGORY_LABELS] ?? inv.category}
Netto: ${fmtEur(inv.netto)}
USt.: ${fmtEur(inv.ust)}
Brutto: ${fmtEur(inv.brutto)}
Währung: ${inv.currency}
Notiz: ${inv.note ?? '(keine)'}
Hat PDF: ${inv.pdf_path ? 'Ja' : 'Nein'}`;
    }
    return 'Seite: Rechnungsdetail (Rechnung nicht gefunden)';
  }

  // All Invoices
  if (pathname === '/invoices') {
    const toShow = useAllInvoicesForContext
      ? invoices
      : invoices.filter((i) => visibleInvoiceIds.includes(String(i.id)));
    const total = toShow.length;
    const einnahmen = toShow.filter((i) => i.type === 'einnahme').reduce((s, i) => s + i.brutto, 0);
    const ausgaben = toShow.filter((i) => i.type === 'ausgabe').reduce((s, i) => s + i.brutto, 0);
    const rows = toShow.slice(0, 50).map(invoiceSummary);

    // Active filters from URL
    const activeFilters: string[] = [];
    if (searchParams.get('q')) activeFilters.push(`Suche: "${searchParams.get('q')}"`);
    if (searchParams.get('type')) activeFilters.push(`Typ: ${searchParams.get('type')}`);
    if (searchParams.get('cat')) activeFilters.push(`Kategorie: ${searchParams.get('cat')}`);
    if (searchParams.get('fyear')) activeFilters.push(`Jahr: ${searchParams.get('fyear')}`);

    return `Seite: Alle Rechnungen
Kontext: ${useAllInvoicesForContext ? 'Alle Rechnungen' : 'Aktuell sichtbare Rechnungen (paginiert)'}
Aktive Filter: ${activeFilters.length ? activeFilters.join(', ') : 'keine'}
Anzahl: ${total}
Einnahmen: ${fmtEur(einnahmen)}
Ausgaben: ${fmtEur(ausgaben)}
Rechnungen (Format: [ID:n] Datum | Partner | Beschreibung | Typ | Kategorie | Brutto, max. 50):
${rows.map((r) => `  - ${r}`).join('\n')}
Hinweis: Verlinke einzelne Rechnungen mit /invoices/ID, gefilterte Listen mit /invoices?cat=...&type=...&fyear=...`;
  }

  // Invoice Designer
  if (pathname.startsWith('/invoice-designer')) {
    const names = templates.map((t) => t.name).join(', ');
    return `Seite: Rechnungsvorlagen-Designer
Verfügbare Templates: ${names || '(keine)'}
Anzahl Templates: ${templates.length}`;
  }

  // Write Invoice
  if (pathname.startsWith('/write-invoice')) {
    return `Seite: Rechnung erstellen / schreiben
Hier kann der Nutzer eine neue druckfertige Rechnung aus einem Template erstellen.`;
  }

  // Settings
  if (pathname === '/settings') {
    return 'Seite: Einstellungen (Profildaten, API-Key, Design, Datensicherung)';
  }

  // Help
  if (pathname === '/help') {
    return 'Seite: Hilfe (der Nutzer liest gerade die Dokumentation)';
  }

  // Lists
  if (pathname === '/lists') {
    const todoLists = lists.filter((l) => l.type === 'todo');
    const kanbanLists = lists.filter((l) => l.type === 'kanban');
    const pinboards = lists.filter((l) => l.type === 'pinboard');
    const summaries = lists.slice(0, 10).map(listSummary).join('\n');
    return `Seite: Listen & Boards
Anzahl Listen gesamt: ${lists.length} (Todo: ${todoLists.length}, Kanban: ${kanbanLists.length}, Pinboard: ${pinboards.length})
${summaries || '(Keine Listen vorhanden)'}
Hinweis: Verlinke Listen nicht direkt, der Nutzer ist bereits auf der Seite.`;
  }

  // Gmail / Mail
  if (pathname === '/gmail') {
    const accountList = gmailAccounts.map((a) => `  - ${a.email} (${a.type ?? 'gmail'}, ${a.emails.length} E-Mails geladen, ${a.emails.filter((e) => e.isUnread).length} ungelesen)`).join('\n');
    let selectedCtx = '';
    if (selectedEmail) {
      selectedCtx = `\nGeöffnete E-Mail:
  Von: ${selectedEmail.from}
  Betreff: ${selectedEmail.subject}
  Datum: ${selectedEmail.date}
  Vorschau: ${selectedEmail.snippet ?? ''}`;
    }
    const recentEmails = activeAccount?.emails.slice(0, 10).map((e) =>
      `  ${e.isUnread ? '●' : '○'} [${e.date}] ${e.from} – ${e.subject}`
    ).join('\n') ?? '';
    return `Seite: E-Mail / Gmail
Verbundene Konten (${gmailAccounts.length}):
${accountList || '  (Keine Konten verbunden)'}
Aktives Konto: ${activeAccount?.email ?? '(keines)'}
Letzte E-Mails (aktives Konto, max. 10):
${recentEmails || '  (Keine E-Mails geladen)'}${selectedCtx}`;
  }

  return `Seite: ${pathname}`;
}

/** Returns true if current page is an invoice detail with a PDF */
export function useCurrentInvoiceHasPdf(): boolean {
  const { pathname } = useLocation();
  const { id } = useParams<{ id: string }>();
  const invoices = useAppStore((s) => s.invoices);
  if (!pathname.startsWith('/invoices/') || !id) return false;
  const inv = invoices.find((i) => String(i.id) === id);
  return !!(inv?.pdf_path);
}

/** Returns true if current page is the invoices list */
export function useIsInvoiceList(): boolean {
  const { pathname } = useLocation();
  return pathname === '/invoices';
}



