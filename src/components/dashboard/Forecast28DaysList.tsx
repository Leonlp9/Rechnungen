import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Invoice } from '@/types';
import { CATEGORY_LABELS } from '@/types';
import { detectPatterns, forecast28Days } from '@/lib/patternDetection';
import { format, differenceInDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { fmtCurrency } from '@/lib/utils';
import { TrendingUp, TrendingDown, CalendarRange, ExternalLink } from 'lucide-react';
import { confidenceBadge } from './ForecastList';

interface Props {
  invoices: Invoice[];
  privacyMode?: boolean;
  loading?: boolean;
}

const INTERVAL_LABELS = {
  weekly: 'Wöchentlich',
  monthly: 'Monatlich',
  quarterly: 'Quartalsweise',
  yearly: 'Jährlich',
};


function daysLabel(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = differenceInDays(date, today);
  if (diff === 0) return <span className="text-orange-500 font-medium text-xs">Heute</span>;
  if (diff === 1) return <span className="text-orange-400 text-xs">Morgen</span>;
  return <span className="text-muted-foreground text-xs">in {diff} Tagen</span>;
}

export function Forecast28DaysList({ invoices, privacyMode, loading }: Props) {
  const navigate = useNavigate();

  const forecasts = useMemo(() => {
    if (loading) return [];
    const patterns = detectPatterns(invoices);
    return forecast28Days(patterns);
  }, [invoices, loading]);

  if (loading) {
    return (
      <Card className="rounded-xl shadow-sm h-full">
        <CardHeader><Skeleton className="h-5 w-52" /></CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
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

  const totalEin = forecasts.filter((f) => f.pattern.type === 'einnahme').reduce((s, f) => s + f.expectedBrutto, 0);
  const totalAus = forecasts.filter((f) => f.pattern.type === 'ausgabe').reduce((s, f) => s + f.expectedBrutto, 0);

  return (
    <Card className="rounded-xl shadow-sm h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-muted-foreground" />
            Prognose – nächste 28 Tage
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
        {forecasts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
            <CalendarRange className="h-10 w-10 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Keine Prognose verfügbar</p>
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
                In den nächsten 28 Tagen wurden keine erwarteten Zahlungen erkannt. Mögliche Gründe:
              </p>
              <ul className="text-xs text-muted-foreground/70 mt-2 space-y-1 text-left list-disc list-inside max-w-xs">
                <li>Zu wenige Belege mit gleichem Partner &amp; Kategorie (mind. 2 nötig)</li>
                <li>Zahlungsabstände sind unregelmäßig oder unbekannt</li>
                <li>Nächste erwartete Zahlungen liegen mehr als 28 Tage in der Zukunft</li>
              </ul>
            </div>
          </div>
        ) : (
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
                  <div className="w-20 shrink-0 flex flex-col items-start gap-0.5">
                    <span className="text-muted-foreground text-xs leading-tight">
                      {format(f.expectedDate, 'dd.MM.yyyy', { locale: de })}
                    </span>
                    {daysLabel(f.expectedDate)}
                  </div>
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
        )}
      </CardContent>
    </Card>
  );
}

