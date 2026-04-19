import { useMemo, useState } from 'react';
import { useAppStore } from '@/store';
import { isCategoryValidForType, CATEGORY_LABELS, TYPE_LABELS } from '@/types';
import type { Invoice } from '@/types';
import { AlertTriangle, X, ExternalLink, CheckCircle2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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
  }
  return issues;
}

// ─── Komponente ───────────────────────────────────────────────────────────────

export function DataIssuesIndicator() {
  const invoices = useAppStore((s) => s.invoices);
  const setActiveAiFix = useAppStore((s) => s.setActiveAiFix);
  const activeAiFix = useAppStore((s) => s.activeAiFix);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const issues = useMemo(() => detectIssues(invoices), [invoices]);
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const total = issues.length;

  if (total === 0) return null;

  const primaryColor = errors.length > 0 ? 'text-destructive' : 'text-amber-500';
  const badgeBg = errors.length > 0 ? 'bg-destructive' : 'bg-amber-500';

  const handleAiFix = (issue: DataIssue, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveAiFix({ invoiceId: issue.invoiceId, fields: issue.fixFields, loading: true });
    setOpen(false);
    navigate(`/invoices/${issue.invoiceId}`);
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        title={`${total} Datenproblem${total !== 1 ? 'e' : ''} gefunden`}
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
          {total > 99 ? '99+' : total}
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
                <h3 className="font-semibold text-sm">Datenprobleme</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {errors.length > 0 && <span className="text-destructive font-medium">{errors.length} Fehler</span>}
                  {errors.length > 0 && warnings.length > 0 && <span className="text-muted-foreground"> · </span>}
                  {warnings.length > 0 && <span className="text-amber-500 font-medium">{warnings.length} Warnung{warnings.length !== 1 ? 'en' : ''}</span>}
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1">
              {issues.length === 0 ? (
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

