import { useMemo, useState, useCallback } from 'react';
import { useAppStore } from '@/store';
import { isCategoryValidForType, CATEGORY_LABELS, TYPE_LABELS } from '@/types';
import type { Invoice } from '@/types';
import { AlertTriangle, X, ExternalLink, CheckCircle2, Sparkles, FileSearch, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { invoke } from '@tauri-apps/api/core';
import { getAllInvoices, setPdfText } from '@/lib/db';
import { getAbsolutePdfPath } from '@/lib/pdf';

// ─── Fehler-Typen ─────────────────────────────────────────────────────────────

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
    if (inv.category === 'anlagevermoegen_afa' && inv.netto > 0 && inv.netto <= 800) {
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
  }
  return issues;
}

// ─── Komponente ───────────────────────────────────────────────────────────────

export function DataIssuesIndicator() {
  const invoices = useAppStore((s) => s.invoices);
  const setInvoices = useAppStore((s) => s.setInvoices);
  const setActiveAiFix = useAppStore((s) => s.setActiveAiFix);
  const activeAiFix = useAppStore((s) => s.activeAiFix);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // PDF-Indizierungsstatus
  const [indexing, setIndexing] = useState(false);
  const [indexProgress, setIndexProgress] = useState<{ current: number; total: number } | null>(null);
  const [indexFailed, setIndexFailed] = useState<{ id: string; description: string; partner: string }[]>([]);

  const issues = useMemo(() => detectIssues(invoices), [invoices]);
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  // Rechnungen mit PDF aber ohne extrahierten Text
  const unindexedInvoices = useMemo(
    () => invoices.filter((inv) => inv.pdf_path && !inv.pdf_text),
    [invoices]
  );
  const unindexedCount = unindexedInvoices.length;

  const total = issues.length;
  const showIndicator = total > 0 || unindexedCount > 0 || indexFailed.length > 0;

  const handleStartIndexing = useCallback(async () => {
    if (indexing) return;
    setIndexing(true);
    setIndexFailed([]);
    setIndexProgress({ current: 0, total: unindexedInvoices.length });

    const failed: typeof indexFailed = [];

    for (let i = 0; i < unindexedInvoices.length; i++) {
      const inv = unindexedInvoices[i];
      setIndexProgress({ current: i, total: unindexedInvoices.length });
      try {
        const absPath = await getAbsolutePdfPath(inv.pdf_path);
        const text = await invoke<string>('extract_pdf_text', { path: absPath });
        // Wenn der Text leer ist (z.B. gescannte Bilder ohne OCR), trotzdem als versucht markieren
        await setPdfText(inv.id, text || '[kein Text extrahierbar]');
      } catch {
        // PDF nicht lesbar (verschlüsselt, beschädigt, etc.) – als dauerhaft fehlgeschlagen markieren
        await setPdfText(inv.id, '[PDF nicht lesbar]').catch(() => {});
        failed.push({ id: inv.id, description: inv.description, partner: inv.partner });
      }
    }

    setIndexFailed(failed);
    setIndexProgress({ current: unindexedInvoices.length, total: unindexedInvoices.length });

    // Store aktualisieren
    try {
      const all = await getAllInvoices();
      setInvoices(all);
    } catch { /* ignore */ }

    setTimeout(() => {
      setIndexing(false);
    }, 500);
  }, [indexing, unindexedInvoices, setInvoices]);

  if (!showIndicator) return null;

  const primaryColor = errors.length > 0 ? 'text-destructive' : 'text-amber-500';
  const badgeBg = errors.length > 0 ? 'bg-destructive' : 'bg-amber-500';
  const badgeCount = total + (unindexedCount > 0 ? 1 : 0) + (indexFailed.length > 0 && unindexedCount === 0 ? 1 : 0);

  const handleAiFix = (issue: DataIssue, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveAiFix({ invoiceId: issue.invoiceId, fields: issue.fixFields, loading: true });
    setOpen(false);
    navigate(`/invoices/${issue.invoiceId}`);
  };

  const indexPercent = indexProgress && indexProgress.total > 0
    ? Math.round((indexProgress.current / indexProgress.total) * 100)
    : 0;

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        title={`${badgeCount} Hinweis${badgeCount !== 1 ? 'e' : ''}`}
        className={cn(
          'relative flex items-center justify-center h-9 w-9 rounded-md border border-border bg-background hover:bg-muted transition-colors',
          primaryColor,
        )}
      >
        <AlertTriangle className="h-4 w-4" />
        <span className={cn(
          'absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white',
          badgeBg,
        )}>
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      </button>

      {/* Dropdown Panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute right-0 top-11 z-50 w-[440px] max-h-[70vh] flex flex-col rounded-xl border border-border bg-background shadow-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
              <div>
                <h3 className="font-semibold text-sm">Hinweise</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {errors.length > 0 && <span className="text-destructive font-medium">{errors.length} Fehler</span>}
                  {errors.length > 0 && (warnings.length > 0 || unindexedCount > 0) && <span className="text-muted-foreground"> · </span>}
                  {warnings.length > 0 && <span className="text-amber-500 font-medium">{warnings.length} Warnung{warnings.length !== 1 ? 'en' : ''}</span>}
                  {warnings.length > 0 && unindexedCount > 0 && <span className="text-muted-foreground"> · </span>}
                  {unindexedCount > 0 && <span className="text-amber-500 font-medium">{unindexedCount} PDF{unindexedCount !== 1 ? 's' : ''} nicht indiziert</span>}
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1">
              {/* PDF-Indizierungshinweis */}
              {(unindexedCount > 0 || indexFailed.length > 0) && (
                <div className="px-4 py-3 border-b bg-amber-500/5">
                  <div className="flex items-start gap-3">
                    <FileSearch className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">PDF-Volltextsuche nicht vollständig</p>

                      {unindexedCount > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                          {unindexedCount} von {invoices.filter((i) => i.pdf_path).length} Rechnungen wurden noch nicht für die Volltext&shy;suche indiziert.
                        </p>
                      )}

                      {/* Fortschrittsbalken während der Indizierung */}
                      {indexProgress !== null && (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Loader2 className={cn('h-3 w-3', indexProgress.current < indexProgress.total && 'animate-spin')} />
                              {indexProgress.current < indexProgress.total
                                ? `Indiziere ${indexProgress.current + 1} / ${indexProgress.total}…`
                                : indexFailed.length > 0
                                  ? `${indexProgress.total - indexFailed.length} indiziert, ${indexFailed.length} fehlgeschlagen`
                                  : `Fertig – ${indexProgress.total} PDF${indexProgress.total !== 1 ? 's' : ''} indiziert`}
                            </span>
                            <span className="font-mono font-semibold text-primary">{indexPercent}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-amber-500 transition-all duration-200"
                              style={{ width: `${indexPercent}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Fehlerliste nach abgeschlossener Indizierung */}
                      {!indexing && indexFailed.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <p className="text-[10px] font-medium text-destructive">
                            {indexFailed.length} PDF{indexFailed.length !== 1 ? 's' : ''} konnten nicht gelesen werden (verschlüsselt oder beschädigt):
                          </p>
                          <div className="space-y-0.5">
                            {indexFailed.map((f) => (
                              <div
                                key={f.id}
                                className="text-[10px] text-muted-foreground truncate cursor-pointer hover:text-foreground transition-colors"
                                onClick={() => { setOpen(false); navigate(`/invoices/${f.id}`); }}
                                title="Rechnung öffnen"
                              >
                                · {f.partner ? `${f.partner} – ` : ''}{f.description || f.id}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {indexProgress === null && unindexedCount > 0 && (
                        <button
                          onClick={handleStartIndexing}
                          disabled={indexing}
                          className="mt-2 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-300/40 hover:bg-amber-500/25 transition-colors"
                        >
                          <FileSearch className="h-3 w-3" />
                          Jetzt alle indizieren
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {issues.length === 0 && unindexedCount === 0 && indexFailed.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                  <p className="text-sm">Keine Probleme gefunden</p>
                </div>
              ) : (
                issues.map((issue) => {
                  const hasPdf = !!issue.invoice.pdf_path;
                  const isThisLoading = activeAiFix?.invoiceId === issue.invoiceId && activeAiFix.loading;
                  return (
                    <div
                      key={issue.id}
                      className="flex items-start gap-3 px-4 py-3 border-b last:border-0 hover:bg-muted/40 cursor-pointer group transition-colors"
                      onClick={() => { setOpen(false); navigate(`/invoices/${issue.invoiceId}`); }}
                    >
                      {/* Severity icon */}
                      <div className={cn('flex-shrink-0 mt-0.5', issue.severity === 'error' ? 'text-destructive' : 'text-amber-500')}>
                        <AlertTriangle className="h-4 w-4" />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold truncate">{issue.invoice.partner || '(kein Partner)'}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {format(new Date(issue.invoice.date), 'dd.MM.yyyy', { locale: de })}
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-foreground mt-0.5">{issue.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{issue.description}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0 mt-0.5" onClick={(e) => e.stopPropagation()}>
                        {/* KI-Fix Button */}
                        <button
                          onClick={(e) => handleAiFix(issue, e)}
                          disabled={isThisLoading || !hasPdf}
                          title={hasPdf ? 'KI-Analyse starten und zu den Details navigieren' : 'Kein PDF – manuelle Korrektur in den Details'}
                          className={cn(
                            'flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors border',
                            hasPdf
                              ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-300/40 hover:bg-violet-500/20'
                              : 'bg-muted text-muted-foreground border-border cursor-not-allowed opacity-50',
                          )}
                        >
                          <Sparkles className="h-3 w-3" />
                          {isThisLoading ? 'Läuft…' : 'KI-Fix'}
                        </button>

                        {/* Open detail link */}
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpen(false); navigate(`/invoices/${issue.invoiceId}`); }}
                          title="In Details öffnen"
                          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t bg-muted/30 flex-shrink-0">
              <p className="text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3 text-violet-500" /> KI-Fix</span>
                {' '}navigiert zu den Details und korrigiert dort das fehlerhafte Feld automatisch.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
