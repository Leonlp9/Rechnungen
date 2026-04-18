import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useAppStore } from '@/store';
import { useChatStore } from '@/store/chatStore';
import { useTemplateStore } from '@/store/templateStore';
import { CATEGORY_LABELS, TYPE_LABELS } from '@/types';
import type { Invoice } from '@/types';

function fmtEur(v: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
}

function invoiceSummary(inv: Invoice) {
  return `[ID:${inv.id}] ${inv.date} | ${inv.partner} | ${inv.description} | ${TYPE_LABELS[inv.type] ?? inv.type} | ${CATEGORY_LABELS[inv.category as keyof typeof CATEGORY_LABELS] ?? inv.category} | ${fmtEur(inv.brutto)}`;
}

export function useChatContext(): string {
  const { pathname } = useLocation();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const invoices = useAppStore((s) => s.invoices);
  const selectedYear = useAppStore((s) => s.selectedYear);
  const { visibleInvoiceIds, useAllInvoicesForContext } = useChatStore();
  const templates = useTemplateStore((s) => s.templates);

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



