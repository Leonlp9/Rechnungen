import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Invoice } from '@/types';
import { CATEGORY_LABELS } from '@/types';
import { detectPatterns } from '@/lib/patternDetection';
import type { DetectedPattern } from '@/lib/patternDetection';
import { fmtCurrency } from '@/lib/utils';
import { ExternalLink, RefreshCw, XCircle } from 'lucide-react';

interface Props {
  invoices: Invoice[];
  privacyMode?: boolean;
  loading?: boolean;
}

const INTERVAL_LABELS: Record<string, string> = {
  weekly: 'Wöchentlich',
  monthly: 'Monatlich',
  quarterly: 'Quartalsweise',
  yearly: 'Jährlich',
};

const INTERVAL_ICON: Record<string, string> = {
  weekly: '📅',
  monthly: '🗓️',
  quarterly: '📆',
  yearly: '🗂️',
};

// Grace period in days before a subscription is considered "cancelled"
const GRACE_DAYS: Record<string, number> = {
  weekly: 3,
  monthly: 7,
  quarterly: 14,
  yearly: 14,
};

type AboStatus = 'active' | 'cancelled';

interface AboItem {
  pattern: DetectedPattern;
  status: AboStatus;
  cancelledDaysAgo: number; // only relevant for cancelled
}

function deriveAbos(invoices: Invoice[]): AboItem[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const patterns = detectPatterns(invoices).filter((p) => p.type === 'ausgabe');

  const items: AboItem[] = [];

  for (const p of patterns) {
    const grace = GRACE_DAYS[p.interval] ?? 7;
    const gracedDeadline = new Date(p.nextExpectedDate.getTime() + grace * 24 * 60 * 60 * 1000);
    const daysOverdue = Math.floor((today.getTime() - p.nextExpectedDate.getTime()) / (1000 * 60 * 60 * 24));

    if (gracedDeadline >= today) {
      // Due soon or in the future → active
      items.push({ pattern: p, status: 'active', cancelledDaysAgo: 0 });
    } else if (daysOverdue <= 30) {
      // Missed within the last 30 days → cancelled
      items.push({ pattern: p, status: 'cancelled', cancelledDaysAgo: daysOverdue });
    }
    // Older than 30 days past due → don't show
  }

  // Sort: active first (by next expected date asc), then cancelled (by cancelledDaysAgo asc)
  items.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    if (a.status === 'active') {
      return a.pattern.nextExpectedDate.getTime() - b.pattern.nextExpectedDate.getTime();
    }
    return a.cancelledDaysAgo - b.cancelledDaysAgo;
  });

  return items;
}

function StatusBadge({ status }: { status: AboStatus }) {
  if (status === 'cancelled') {
    return (
      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-xs flex items-center gap-1 shrink-0">
        <XCircle className="h-3 w-3" /> Gekündigt
      </Badge>
    );
  }
  return (
    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200 text-xs flex items-center gap-1 shrink-0">
      <RefreshCw className="h-3 w-3" /> Aktiv
    </Badge>
  );
}

function NextDateLabel({ pattern, status }: { pattern: DetectedPattern; status: AboStatus }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = pattern.nextExpectedDate;
  const diff = Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (status === 'cancelled') {
    return <span className="text-xs text-muted-foreground/60 italic">Zuletzt: {fmtDate(pattern.lastDate)}</span>;
  }
  if (diff < 0) return <span className="text-xs text-amber-600">fällig seit {-diff} Tag{-diff !== 1 ? 'en' : ''}</span>;
  if (diff === 0) return <span className="text-xs text-amber-600 font-medium">fällig heute</span>;
  if (diff <= 7) return <span className="text-xs text-amber-600">fällig in {diff} Tag{diff !== 1 ? 'en' : ''}</span>;
  return <span className="text-xs text-muted-foreground">nächste: {fmtDate(d)}</span>;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function AboList({ invoices, privacyMode, loading }: Props) {
  const navigate = useNavigate();

  const abos = useMemo(() => {
    if (loading || invoices.length === 0) return [];
    return deriveAbos(invoices);
  }, [invoices, loading]);

  const handleClick = (p: DetectedPattern) => {
    const params = new URLSearchParams();
    params.set('q', p.partner);
    params.set('cat', p.category);
    params.set('type', p.type);
    params.set('fyear', 'all');
    navigate(`/invoices?${params.toString()}`);
  };

  if (loading) {
    return (
      <Card className="rounded-xl shadow-sm h-full">
        <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <div className="flex gap-3 flex-1">
                <Skeleton className="h-4 w-16 shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const activeCount = abos.filter((a) => a.status === 'active').length;
  const cancelledCount = abos.filter((a) => a.status === 'cancelled').length;
  const monthlyTotal = abos
    .filter((a) => a.status === 'active')
    .reduce((s, a) => {
      const { interval, avgBrutto } = a.pattern;
      if (interval === 'weekly') return s + avgBrutto * 4.33;
      if (interval === 'monthly') return s + avgBrutto;
      if (interval === 'quarterly') return s + avgBrutto / 3;
      if (interval === 'yearly') return s + avgBrutto / 12;
      return s;
    }, 0);

  return (
    <Card className="rounded-xl shadow-sm h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            Aktive Abos
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="text-green-700 dark:text-green-400 font-medium">{activeCount} aktiv</span>
            {cancelledCount > 0 && (
              <span className="text-red-600 dark:text-red-400">{cancelledCount} gekündigt</span>
            )}
            <span className="text-muted-foreground/60">·</span>
            <span title="Hochgerechnete monatliche Kosten aller aktiven Abos">
              ~{fmtCurrency(monthlyTotal, privacyMode ?? false)}/Monat
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {abos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
            <RefreshCw className="h-10 w-10 text-muted-foreground/30" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Keine Abos erkannt</p>
              <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
                Wiederkehrende Ausgaben werden automatisch erkannt, sobald mind. 2 Buchungen vom
                gleichen Partner &amp; Kategorie vorliegen.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {abos.map((abo, idx) => {
              const { pattern, status } = abo;
              const isCancelled = status === 'cancelled';
              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between py-2.5 px-1 -mx-1 rounded-md transition-colors cursor-pointer group ${
                    isCancelled
                      ? 'opacity-50 hover:opacity-70 hover:bg-muted/30'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => handleClick(pattern)}
                  title="Quell-Rechnungen anzeigen"
                >
                  {/* Left: interval icon + info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg leading-none shrink-0" title={INTERVAL_LABELS[pattern.interval]}>
                      {INTERVAL_ICON[pattern.interval]}
                    </span>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate flex items-center gap-1 ${isCancelled ? 'line-through decoration-1' : ''}`}>
                        {pattern.partner}
                        <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {CATEGORY_LABELS[pattern.category]} · {INTERVAL_LABELS[pattern.interval]}
                        </span>
                        <NextDateLabel pattern={pattern} status={status} />
                      </div>
                    </div>
                  </div>

                  {/* Right: status + amount */}
                  <div className="flex flex-col items-end gap-0.5 shrink-0 ml-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={status} />
                      <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                        −{fmtCurrency(pattern.avgBrutto, privacyMode ?? false)}
                      </span>
                    </div>
                    <span
                      className="text-xs text-muted-foreground/70"
                      title={`${pattern.occurrences} Buchungen · Gesamtausgabe`}
                    >
                      Gesamt: {fmtCurrency(pattern.avgBrutto * pattern.occurrences, privacyMode ?? false)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

