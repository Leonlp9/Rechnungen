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

/** Erstellt immer vorhandenen globalen Finanz-Kontext aus allen Belegen */
function buildGlobalContext(invoices: Invoice[], steuerregelung: string, branchenprofil: string, selectedYear: number): string {
  if (invoices.length === 0) {
    return `═══ GLOBALE ÜBERSICHT ═══
Steuerregelung: ${steuerregelung === 'kleinunternehmer' ? 'Kleinunternehmer (§19 UStG)' : 'Regelbesteuerung'}
Branchenprofil: ${branchenprofil}
Keine Belege vorhanden.`;
  }

  // Jahre ermitteln
  const years = [...new Set(invoices.map((i) => i.year))].sort((a, b) => b - a);
  const currentYear = selectedYear;
  const thisYear = invoices.filter((i) => i.year === currentYear);
  const einnahmenY = thisYear.filter((i) => i.type === 'einnahme').reduce((s, i) => s + i.brutto, 0);
  const ausgabenY = thisYear.filter((i) => i.type === 'ausgabe').reduce((s, i) => s + i.brutto, 0);
  const nettoEinnahmenY = thisYear.filter((i) => i.type === 'einnahme').reduce((s, i) => s + i.netto, 0);
  const nettoAusgabenY = thisYear.filter((i) => i.type === 'ausgabe').reduce((s, i) => s + i.netto, 0);

  // Jahresvergleich (letzte 3 Jahre)
  const yearSummary = years.slice(0, 4).map((y) => {
    const yInv = invoices.filter((i) => i.year === y);
    const e = yInv.filter((i) => i.type === 'einnahme').reduce((s, i) => s + i.brutto, 0);
    const a = yInv.filter((i) => i.type === 'ausgabe').reduce((s, i) => s + i.brutto, 0);
    return `  ${y}: Einnahmen ${fmtEur(e)} | Ausgaben ${fmtEur(a)} | Saldo ${fmtEur(e - a)} | Belege: ${yInv.length}`;
  }).join('\n');

  // Top-Partner (alle Zeit)
  const partnerMap = new Map<string, number>();
  invoices.filter((i) => i.type === 'einnahme' && i.partner).forEach((i) => {
    partnerMap.set(i.partner, (partnerMap.get(i.partner) ?? 0) + i.brutto);
  });
  const topPartner = [...partnerMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, sum]) => `  ${name}: ${fmtEur(sum)}`)
    .join('\n');

  // Top Ausgabenkategorien (aktuelles Jahr)
  const catMap = new Map<string, number>();
  thisYear.filter((i) => i.type === 'ausgabe').forEach((i) => {
    const label = CATEGORY_LABELS[i.category as keyof typeof CATEGORY_LABELS] ?? i.category;
    catMap.set(label, (catMap.get(label) ?? 0) + i.brutto);
  });
  const topCats = [...catMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, sum]) => `  ${cat}: ${fmtEur(sum)}`)
    .join('\n');

  // Aktueller Monat
  const now = new Date();
  const thisMonth = thisYear.filter((i) => i.month === now.getMonth() + 1);
  const einnahmenM = thisMonth.filter((i) => i.type === 'einnahme').reduce((s, i) => s + i.brutto, 0);
  const ausgabenM = thisMonth.filter((i) => i.type === 'ausgabe').reduce((s, i) => s + i.brutto, 0);

  return `═══ GLOBALE ÜBERSICHT (immer aktuell) ═══
Steuerregelung: ${steuerregelung === 'kleinunternehmer' ? 'Kleinunternehmer (§19 UStG)' : 'Regelbesteuerung'}
Branchenprofil: ${branchenprofil}
Ausgewähltes Jahr: ${currentYear}
Gesamtbelege (alle Zeit): ${invoices.length}
Verfügbare Jahre: ${years.join(', ')}

── ${currentYear} im Überblick ──
  Einnahmen (brutto): ${fmtEur(einnahmenY)}
  Ausgaben (brutto): ${fmtEur(ausgabenY)}
  Gewinn/Verlust (brutto): ${fmtEur(einnahmenY - ausgabenY)}
  Netto-Einnahmen: ${fmtEur(nettoEinnahmenY)}
  Netto-Ausgaben: ${fmtEur(nettoAusgabenY)}
  Netto-Saldo: ${fmtEur(nettoEinnahmenY - nettoAusgabenY)}
  Belege ${currentYear}: ${thisYear.length}

── Aktueller Monat (${now.toLocaleString('de-DE', { month: 'long' })} ${now.getFullYear()}) ──
  Einnahmen: ${fmtEur(einnahmenM)}
  Ausgaben: ${fmtEur(ausgabenM)}
  Belege: ${thisMonth.length}

── Jahresvergleich ──
${yearSummary || '  (keine Daten)'}

── Top 5 Einnahme-Partner (alle Zeit) ──
${topPartner || '  (keine Einnahmen)'}

── Top 5 Ausgabenkategorien (${currentYear}) ──
${topCats || '  (keine Ausgaben)'}
═══════════════════════════════════════════`;
}

export function useChatContext(): string {
  const { pathname } = useLocation();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const invoices = useAppStore((s) => s.invoices);
  const selectedYear = useAppStore((s) => s.selectedYear);
  const steuerregelung = useAppStore((s) => s.steuerregelung);
  const branchenprofil = useAppStore((s) => s.branchenprofil);
  const { visibleInvoiceIds, useAllInvoicesForContext } = useChatStore();
  const templates = useTemplateStore((s) => s.templates);
  const lists = useListsStore((s) => s.lists);
  const gmailAccounts = useGmailStore((s) => s.accounts);
  const activeAccount = useGmailStore(selectActiveAccount);
  const selectedEmail = useGmailStore((s) => s.selectedEmail);

  const globalCtx = buildGlobalContext(invoices, steuerregelung, branchenprofil, selectedYear);

  // Dashboard
  if (pathname === '/') {
    const yearly = invoices.filter((i) => i.year === selectedYear);
    const recent = [...yearly].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map(invoiceSummary);
    return `${globalCtx}

Seite: Dashboard
Letzte 8 Rechnungen (Format: [ID:n] Datum | Partner | Beschreibung | Typ | Kategorie | Brutto):
${recent.map((r) => `  - ${r}`).join('\n')}
Hinweis: Verlinke einzelne Rechnungen mit /invoices/ID`;
  }

  // Invoice Detail
  if (pathname.startsWith('/invoices/') && id) {
    const inv = invoices.find((i) => String(i.id) === id);
    if (inv) {
      return `${globalCtx}

Seite: Rechnungsdetail
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
    return `${globalCtx}\n\nSeite: Rechnungsdetail (Rechnung nicht gefunden)`;
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

    return `${globalCtx}

Seite: Alle Rechnungen
Kontext: ${useAllInvoicesForContext ? 'Alle Rechnungen' : 'Aktuell sichtbare Rechnungen (paginiert)'}
Aktive Filter: ${activeFilters.length ? activeFilters.join(', ') : 'keine'}
Anzahl (gefiltert): ${total}
Einnahmen (gefiltert): ${fmtEur(einnahmen)}
Ausgaben (gefiltert): ${fmtEur(ausgaben)}
Rechnungen (Format: [ID:n] Datum | Partner | Beschreibung | Typ | Kategorie | Brutto, max. 50):
${rows.map((r) => `  - ${r}`).join('\n')}
Hinweis: Verlinke einzelne Rechnungen mit /invoices/ID, gefilterte Listen mit /invoices?cat=...&type=...&fyear=...`;
  }

  // Invoice Designer
  if (pathname.startsWith('/invoice-designer')) {
    const names = templates.map((t) => t.name).join(', ');
    return `${globalCtx}

Seite: Rechnungsvorlagen-Designer
Verfügbare Templates: ${names || '(keine)'}
Anzahl Templates: ${templates.length}`;
  }

  // Write Invoice
  if (pathname.startsWith('/write-invoice')) {
    return `${globalCtx}

Seite: Rechnung erstellen / schreiben
Hier kann der Nutzer eine neue druckfertige Rechnung aus einem Template erstellen.`;
  }

  // Settings
  if (pathname === '/settings') {
    return `${globalCtx}

Seite: Einstellungen (Profildaten, API-Key, Design, Datensicherung)`;
  }

  // Help
  if (pathname === '/help') {
    return `${globalCtx}

Seite: Hilfe (der Nutzer liest gerade die Dokumentation)`;
  }

  // Lists
  if (pathname === '/lists') {
    const todoLists = lists.filter((l) => l.type === 'todo');
    const kanbanLists = lists.filter((l) => l.type === 'kanban');
    const pinboards = lists.filter((l) => l.type === 'pinboard');
    const summaries = lists.slice(0, 10).map(listSummary).join('\n');
    return `${globalCtx}

Seite: Listen & Boards
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
    return `${globalCtx}

Seite: E-Mail / Gmail
Verbundene Konten (${gmailAccounts.length}):
${accountList || '  (Keine Konten verbunden)'}
Aktives Konto: ${activeAccount?.email ?? '(keines)'}
Letzte E-Mails (aktives Konto, max. 10):
${recentEmails || '  (Keine E-Mails geladen)'}${selectedCtx}`;
  }

  // Steuerbericht
  if (pathname === '/steuerbericht' || pathname === '/tax-report') {
    const yearly = invoices.filter((i) => i.year === selectedYear);
    const einnahmen = yearly.filter((i) => i.type === 'einnahme').reduce((s, i) => s + i.netto, 0);
    const ausgaben = yearly.filter((i) => i.type === 'ausgabe').reduce((s, i) => s + i.netto, 0);
    const ust = yearly.filter((i) => i.type === 'einnahme').reduce((s, i) => s + i.ust, 0);
    return `${globalCtx}

Seite: Steuerbericht / Steuerauswertung
Jahr: ${selectedYear}
Netto-Einnahmen: ${fmtEur(einnahmen)}
Netto-Ausgaben: ${fmtEur(ausgaben)}
Netto-Gewinn: ${fmtEur(einnahmen - ausgaben)}
Umsatzsteuer (Einnahmen): ${fmtEur(ust)}`;
  }

  // Kunden / Customers
  if (pathname === '/customers') {
    const partners = [...new Set(invoices.map((i) => i.partner).filter(Boolean))];
    const topByRevenue = partners
      .map((p) => ({
        name: p,
        sum: invoices.filter((i) => i.type === 'einnahme' && i.partner === p).reduce((s, i) => s + i.brutto, 0),
        count: invoices.filter((i) => i.partner === p).length,
      }))
      .sort((a, b) => b.sum - a.sum)
      .slice(0, 10);
    return `${globalCtx}

Seite: Kunden / Partner
Anzahl einzigartiger Partner: ${partners.length}
Top 10 Kunden nach Umsatz:
${topByRevenue.map((p) => `  ${p.name}: ${fmtEur(p.sum)} (${p.count} Belege)`).join('\n') || '  (keine)'}`;
  }

  // Kalender
  if (pathname === '/calendar') {
    return `${globalCtx}

Seite: Kalender
Hier sieht der Nutzer Termine, Fälligkeiten und Buchhaltungsereignisse in einer Kalenderansicht.`;
  }

  // Bank-Import
  if (pathname === '/bank-import') {
    return `${globalCtx}

Seite: Bank-Import
Hier kann der Nutzer Kontoauszüge (CSV/MT940) importieren und Transaktionen automatisch als Belege erfassen.`;
  }

  // Fahrtenbuch
  if (pathname === '/fahrtenbuch') {
    return `${globalCtx}

Seite: Fahrtenbuch
Hier verwaltet der Nutzer Fahrtenbucheinträge für die steuerliche Geltendmachung von KFZ-Kosten.`;
  }

  return `${globalCtx}

Seite: ${pathname}`;
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

