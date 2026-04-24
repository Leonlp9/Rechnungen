import { FileSearch } from 'lucide-react';
import type { Invoice } from '@/types';
import { getAllInvoices } from '@/lib/db';
import type { SearchProvider, SearchResult } from '../types';

export function createPdfProvider(
  navigate: (path: string) => void,
  getInvoices: () => Invoice[]
): SearchProvider {
  return {
    id: 'pdf',
    label: 'PDF-Volltextsuche',
    defaultEnabled: false,
    search: async (query, signal) => {
      const q = query.toLowerCase().trim();
      if (!q) return [];

      let invoices = getInvoices();
      if (invoices.length === 0) {
        invoices = await getAllInvoices();
      }

      if (signal?.aborted) return [];

      const qNorm = q.replace(/\s+/g, '');
      const results: SearchResult[] = [];

      for (const inv of invoices) {
        if (signal?.aborted) break;

        const text = inv.pdf_text;
        if (!text) continue;

        // Suche mit und ohne Whitespace – "DE63 4405" findet auch "DE634405"
        const textNorm = text.replace(/\s+/g, '');
        const matchRaw = text.toLowerCase().includes(q);
        const matchNorm = textNorm.toLowerCase().includes(qNorm);

        if (matchRaw || matchNorm) {
          const searchIn = matchRaw ? text : textNorm;
          const searchQ = matchRaw ? q : qNorm;
          const idx = searchIn.toLowerCase().indexOf(searchQ);
          const start = Math.max(0, idx - 80);
          const end = Math.min(searchIn.length, idx + searchQ.length + 80);
          const snippet =
            (start > 0 ? '…' : '') +
            searchIn.slice(start, end).replace(/\s+/g, ' ').trim() +
            (end < searchIn.length ? '…' : '');

          results.push({
            id: `pdf-${inv.id}`,
            title: inv.description || inv.partner || '(Keine Beschreibung)',
            subtitle: `📄 ${snippet}`,
            icon: FileSearch,
            category: 'PDF-Volltextsuche',
            categoryColor: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
            onSelect: () => navigate(`/invoices/${inv.id}`),
          });
        }
      }

      return results;
    },
  };
}
