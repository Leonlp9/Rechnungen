import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Invoice } from '@/types';
import { CATEGORY_LABELS } from '@/types';
import { detectPatterns, forecastCurrentMonth } from '@/lib/patternDetection';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { fmtCurrency } from '@/lib/utils';
import { TrendingUp, TrendingDown, CalendarClock, ExternalLink } from 'lucide-react';

interface Props {
  invoices: Invoice[];
  privacyMode?: boolean;
  loading?: boolean;
  selectedMonth?: number;
  selectedYear?: number;
}

const INTERVAL_LABELS = {
  weekly: 'Wöchentlich',
  monthly: 'Monatlich',
  quarterly: 'Quartalsweise',
  yearly: 'Jährlich',
};

function confidenceBadge(c: number) {
  if (c >= 0.7) return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">Hoch</Badge>;
  if (c >= 0.4) return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs">Mittel</Badge>;
  return <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 text-xs">Niedrig</Badge>;
}

export function ForecastList({ invoices, privacyMode, loading, selectedMonth, selectedYear }: Props) {
  const navigate = useNavigate();
  const forecasts = useMemo(() => {
    if (loading) return [];
    const patterns = detectPatterns(invoices);
    return forecastCurrentMonth(patterns, selectedYear, selectedMonth);
  }, [invoices, loading, selectedMonth, selectedYear]);

  const monthLabel = useMemo(() => {
    const y = selectedYear ?? new Date().getFullYear();
    const m = selectedMonth !== undefined ? selectedMonth - 1 : new Date().getMonth();
    return format(new Date(y, m, 1), 'MMMM yyyy', { locale: de });
  }, [selectedMonth, selectedYear]);

  if (loading) {
    return (
      <Card className="rounded-xl shadow-sm h-full">
        <CardHeader><Skeleton className="h-5 w-52" /></CardHeader>
        <CardContent className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="flex items-center justify-between py-1">
              <div className="flex gap-3 flex-1">
                <Skeleton className="h-4 w-20 shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (forecasts.length === 0) return null;

  const totalEin = forecasts
    .filter((f) => f.pattern.type === 'einnahme')
    .reduce((s, f) => s + f.expectedBrutto, 0);
  const totalAus = forecasts
    .filter((f) => f.pattern.type === 'ausgabe')
    .reduce((s, f) => s + f.expectedBrutto, 0);

  return (
    <Card className="rounded-xl shadow-sm h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            Prognose – {monthLabel}
          </CardTitle>
          {forecasts.length > 0 && (
            <div className="flex gap-3 text-sm">
              <span className="text-green-600 font-medium flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                +{fmtCurrency(totalEin, privacyMode ?? false)}
              </span>
              <span className="text-red-600 font-medium flex items-center gap-1">
                <TrendingDown className="h-3 w-3" />
                −{fmtCurrency(totalAus, privacyMode ?? false)}
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {forecasts.map((f, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between py-2 text-sm cursor-pointer rounded-md hover:bg-muted/50 px-1 -mx-1 transition-colors group"
              onClick={() => {
                const params = new URLSearchParams();
                params.set('q', f.pattern.partner);
                params.set('cat', f.pattern.category);
                params.set('type', f.pattern.type);
                params.set('fyear', 'all');
                navigate(`/invoices?${params.toString()}`);
              }}
              title="Quell-Rechnungen anzeigen"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-muted-foreground w-20 shrink-0">
                  {format(f.expectedDate, 'dd.MM.yyyy', { locale: de })}
                </span>
                <div className="min-w-0">
                    <p className="font-medium truncate flex items-center gap-1">
                      {f.pattern.partner}
                      <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {CATEGORY_LABELS[f.pattern.category]} · {INTERVAL_LABELS[f.pattern.interval]}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {confidenceBadge(f.pattern.confidence)}
                <span className={`font-semibold ${f.pattern.type === 'einnahme' ? 'text-green-600' : 'text-red-600'}`}>
                  {f.pattern.type === 'einnahme' ? '+' : '−'}
                  {fmtCurrency(f.expectedBrutto, privacyMode ?? false)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
