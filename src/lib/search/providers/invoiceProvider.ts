import { FileText } from 'lucide-react';
import type { Invoice } from '@/types';
import { CATEGORY_LABELS, TYPE_LABELS } from '@/types';
import { getAllInvoices } from '@/lib/db';
import type { SearchProvider, SearchResult } from '../types';

function formatAmount(inv: Invoice): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: inv.currency || 'EUR',
  }).format(inv.brutto);
}

export function createInvoiceProvider(
  navigate: (path: string) => void,
  getInvoices: () => Invoice[]
): SearchProvider {
  return {
    id: 'invoices',
    label: 'Rechnungen',
    defaultEnabled: true,
    search: async (query, signal) => {
      const q = query.toLowerCase();

      // Erst Zustand-Store, dann DB-Fallback für jahresübergreifende Suche
      let invoices = getInvoices();
      if (invoices.length === 0) {
        invoices = await getAllInvoices();
      }

      if (signal?.aborted) return [];

      return invoices
        .filter((inv) => {
          return (
            inv.description?.toLowerCase().includes(q) ||
            inv.partner?.toLowerCase().includes(q) ||
            inv.note?.toLowerCase().includes(q) ||
            inv.id?.toLowerCase().includes(q) ||
            CATEGORY_LABELS[inv.category]?.toLowerCase().includes(q) ||
            TYPE_LABELS[inv.type]?.toLowerCase().includes(q) ||
            inv.date?.includes(q) ||
            String(inv.brutto).includes(q)
          );
        })
        .slice(0, 15)
        .map<SearchResult>((inv) => ({
          id: `invoice-${inv.id}`,
          title: inv.description || '(Keine Beschreibung)',
          subtitle: `${inv.partner ? inv.partner + ' · ' : ''}${formatAmount(inv)} · ${inv.date}`,
          icon: FileText,
          category: 'Rechnungen',
          categoryColor: 'bg-green-500/15 text-green-600 dark:text-green-400',
          onSelect: () => navigate(`/invoices/${inv.id}`),
        }));
    },
  };
}

