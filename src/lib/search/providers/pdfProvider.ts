import { FileSearch } from 'lucide-react';
import type { Invoice } from '@/types';
import { getAllInvoices } from '@/lib/db';
import { invoke } from '@tauri-apps/api/core';
import type { SearchProvider, SearchResult, ProgressCallback } from '../types';

async function extractPdfText(pdfPath: string): Promise<string> {
  // Rust-Command: liest die Datei nativ und extrahiert den Text zuverlässig
  const text = await invoke<string>('extract_pdf_text', { path: pdfPath });

  if (import.meta.env.DEV) {
    console.debug(`[PDF] ${pdfPath} → ${text.length} Zeichen`);
    console.debug(`[PDF] Vorschau:`, text.slice(0, 300));
  }

  return text;
}

export function createPdfProvider(
  navigate: (path: string) => void,
  getInvoices: () => Invoice[]
): SearchProvider {
  return {
    id: 'pdf',
    label: 'PDF-Inhalte',
    defaultEnabled: false,
    slow: true,
    search: async (query, signal, onProgress?: ProgressCallback) => {
      const q = query.toLowerCase().trim();
      if (!q) return [];

      let invoices = getInvoices();
      if (invoices.length === 0) {
        invoices = await getAllInvoices();
      }

      const withPdf = invoices.filter((inv) => inv.pdf_path?.trim());
      const total = withPdf.length;
      const results: SearchResult[] = [];

      for (let i = 0; i < withPdf.length; i++) {
        if (signal?.aborted) break;

        const inv = withPdf[i];
        onProgress?.({ current: i, total, label: inv.description || inv.pdf_path });

        try {
          const text = await extractPdfText(inv.pdf_path);
          if (signal?.aborted) break;

          // Suche: Whitespace im Text normalisieren damit "DE63 4405" und "DE634405" beide gefunden werden
          const textNorm = text.replace(/\s+/g, '');
          const qNorm = q.replace(/\s+/g, '');

          const matchRaw = text.toLowerCase().includes(q);
          const matchNorm = textNorm.toLowerCase().includes(qNorm);

          if (matchRaw || matchNorm) {
            // Snippet aus dem Originaltext um die Fundstelle herum
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
              category: 'PDF-Inhalte',
              categoryColor: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
              onSelect: () => navigate(`/invoices/${inv.id}`),
            });
          }
        } catch (err) {
          console.warn(`[PDF] Fehler bei ${inv.pdf_path}:`, err);
        }

        onProgress?.({ current: i + 1, total, label: inv.description || inv.pdf_path });
      }

      return results;
    },
  };
}
