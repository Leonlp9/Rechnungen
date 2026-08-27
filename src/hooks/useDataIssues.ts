// Prüft den Datenbestand auf Dinge, die noch erledigt werden müssen.
//
// Bis hierher steckte das alles in der Desktop-Anzeige (DataIssuesIndicator).
// Auf dem Handy gab es die Liste damit überhaupt nicht – dabei sind es genau
// die Punkte, die eine Buchhaltung unbrauchbar machen, wenn sie liegen
// bleiben. Also einmal als Hook, den sich beide Oberflächen teilen.

import { useCallback, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { useAppStore } from '@/store';
import { getAllInvoices, setPdfText } from '@/lib/db';
import { getAbsolutePdfPath } from '@/lib/pdf';
import { ensureCurrencyConversions } from '@/lib/currency';
import { isCategoryValidForType, CATEGORY_LABELS, TYPE_LABELS } from '@/types';
import type { Invoice } from '@/types';
import { istSelbstaendigNutzbar } from '@/lib/steuer/anlagen';
import { guessAssetType } from '@/lib/afa';

export interface DataIssue {
  id: string;
  invoiceId: string;
  severity: 'error' | 'warning';
  title: string;
  description: string;
  invoice: Invoice;
  fixFields: Array<'category' | 'type'>;
}

export function detectIssues(invoices: Invoice[]): DataIssue[] {
  const issues: DataIssue[] = [];
  for (const inv of invoices) {
    if (!isCategoryValidForType(inv.category, inv.type)) {
      issues.push({
        id: `cat-mismatch-${inv.id}`,
        invoiceId: inv.id,
        severity: 'error',
        title: 'Falsche Kategorie für Typ',
        description: `Typ „${TYPE_LABELS[inv.type]}" ist inkompatibel mit Kategorie „${CATEGORY_LABELS[inv.category] ?? inv.category}".`,
        invoice: inv,
        fixFields: ['category'],
      });
      continue;
    }
    if (inv.type === 'einnahme' && inv.category === 'einnahmen') {
      issues.push({
        id: `legacy-cat-${inv.id}`,
        invoiceId: inv.id,
        severity: 'warning',
        title: 'Kategorie veraltet',
        description: `Bitte die allgemeine Kategorie „Einnahmen" durch eine spezifischere ersetzen (z. B. „Umsatzerlöse (steuerpflichtig)").`,
        invoice: inv,
        fixFields: ['category'],
      });
    }
    // GWG/AfA Schwellen-Warnung
    if (inv.category === 'gwg' && inv.netto > 800) {
      issues.push({
        id: `gwg-too-high-${inv.id}`,
        invoiceId: inv.id,
        severity: 'warning',
        title: 'GWG-Grenze überschritten',
        description: `Netto ${inv.netto.toFixed(2)} € > 800 € – sollte als „Anlagevermögen / AfA" (lineare Abschreibung) kategorisiert werden, nicht als GWG.`,
        invoice: inv,
        fixFields: ['category'],
      });
    }
    // Der Vorschlag „das könnte ein GWG sein" gilt nur, wenn das Gut auch für
    // sich allein nutzbar ist. Ein Bildschirm ist es nicht (§ 6 Abs. 2 Satz 2
    // EStG) – ihn nach GWG umzubuchen wäre falsch, obwohl er unter der Grenze
    // liegt.
    if (
      inv.category === 'anlagevermoegen_afa'
      && inv.netto > 0
      && inv.netto <= 800
      && istSelbstaendigNutzbar(guessAssetType(inv.description, inv.partner))
    ) {
      issues.push({
        id: `afa-too-low-${inv.id}`,
        invoiceId: inv.id,
        severity: 'warning',
        title: 'AfA unter GWG-Grenze',
        description: `Netto ${inv.netto.toFixed(2)} € ≤ 800 € – kann als GWG sofort abgeschrieben werden statt über mehrere Jahre.`,
        invoice: inv,
        fixFields: ['category'],
      });
    }
    // Umgekehrt: Peripherie in der GWG-Kategorie gehört zum Anlagevermögen,
    // unabhängig vom Preis.
    if (inv.category === 'gwg' && !istSelbstaendigNutzbar(guessAssetType(inv.description, inv.partner))) {
      issues.push({
        id: `gwg-nicht-selbstaendig-${inv.id}`,
        invoiceId: inv.id,
        severity: 'warning',
        title: 'Kein geringwertiges Wirtschaftsgut',
        description: 'Bildschirme und Drucker lassen sich ohne Rechner nicht nutzen und sind deshalb kein GWG (§ 6 Abs. 2 Satz 2 EStG). Als „Anlagevermögen / AfA" gebucht dürfen sie als Computerhardware trotzdem über ein Jahr abgeschrieben werden – der Abzug bleibt derselbe.',
        invoice: inv,
        fixFields: ['category'],
      });
    }
  }
  return issues;
}

export interface IndexFailure {
  id: string;
  description: string;
  partner: string;
}

export function useDataIssues() {
  const invoices = useAppStore((s) => s.invoices);
  const setInvoices = useAppStore((s) => s.setInvoices);

  const [converting, setConverting] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [indexProgress, setIndexProgress] = useState<{ current: number; total: number } | null>(null);
  const [indexFailed, setIndexFailed] = useState<IndexFailure[]>([]);

  const issues = useMemo(() => detectIssues(invoices), [invoices]);
  const errors = useMemo(() => issues.filter((i) => i.severity === 'error'), [issues]);
  const warnings = useMemo(() => issues.filter((i) => i.severity === 'warning'), [issues]);

  // Fremdwährungsbelege, deren Umrechnung noch aussteht (offline erfasst oder
  // Altbestand ohne Kurs). Sie werden solange mit ihrem Fremdwährungsbetrag
  // gezählt – deshalb ein Fehler, kein bloßer Hinweis.
  const pendingFx = useMemo(() => invoices.filter((i) => i.fx_source === 'pending'), [invoices]);

  // Rechnungen mit PDF, aber ohne extrahierten Text
  const unindexedInvoices = useMemo(
    () => invoices.filter((inv) => inv.pdf_path && !inv.pdf_text),
    [invoices],
  );
  const withPdfCount = useMemo(() => invoices.filter((i) => i.pdf_path).length, [invoices]);

  const convertNow = useCallback(async () => {
    if (converting) return;
    setConverting(true);
    try {
      const result = await ensureCurrencyConversions();
      if (result.converted > 0) {
        toast.success(`${result.converted} Beleg${result.converted !== 1 ? 'e' : ''} umgerechnet`);
        setInvoices(await getAllInvoices());
      }
      if (result.failed > 0) {
        toast.error(
          `${result.failed} Beleg${result.failed !== 1 ? 'e' : ''} konnten nicht umgerechnet werden`,
          { description: result.errors[0] ?? 'Keine Verbindung zur Kursquelle.' },
        );
      }
    } finally {
      setConverting(false);
    }
  }, [converting, setInvoices]);

  const startIndexing = useCallback(async () => {
    if (indexing) return;
    setIndexing(true);
    setIndexFailed([]);
    setIndexProgress({ current: 0, total: unindexedInvoices.length });

    const failed: IndexFailure[] = [];

    for (let i = 0; i < unindexedInvoices.length; i++) {
      const inv = unindexedInvoices[i];
      setIndexProgress({ current: i, total: unindexedInvoices.length });
      try {
        const absPath = await getAbsolutePdfPath(inv.pdf_path);
        const text = await invoke<string>('extract_pdf_text', { path: absPath });
        // Leerer Text (z. B. gescannte Bilder ohne OCR) trotzdem als versucht markieren
        await setPdfText(inv.id, text || '[kein Text extrahierbar]');
      } catch {
        // PDF nicht lesbar (verschlüsselt, beschädigt) – als dauerhaft gescheitert merken
        await setPdfText(inv.id, '[PDF nicht lesbar]').catch(() => {});
        failed.push({ id: inv.id, description: inv.description, partner: inv.partner });
      }
    }

    setIndexFailed(failed);
    setIndexProgress({ current: unindexedInvoices.length, total: unindexedInvoices.length });

    try {
      setInvoices(await getAllInvoices());
    } catch { /* ignore */ }

    setTimeout(() => setIndexing(false), 500);
  }, [indexing, unindexedInvoices, setInvoices]);

  const unindexedCount = unindexedInvoices.length;
  const hasError = errors.length > 0 || pendingFx.length > 0;
  const badgeCount =
    issues.length +
    (unindexedCount > 0 ? 1 : 0) +
    (indexFailed.length > 0 && unindexedCount === 0 ? 1 : 0) +
    (pendingFx.length > 0 ? 1 : 0);
  const hasAnything = issues.length > 0 || unindexedCount > 0 || indexFailed.length > 0 || pendingFx.length > 0;

  return {
    invoices,
    issues,
    errors,
    warnings,
    pendingFx,
    unindexedInvoices,
    unindexedCount,
    withPdfCount,
    indexFailed,
    indexing,
    indexProgress,
    startIndexing,
    converting,
    convertNow,
    hasError,
    badgeCount,
    hasAnything,
  };
}
