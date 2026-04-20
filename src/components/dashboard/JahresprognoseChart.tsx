import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartLegend, type ChartConfig } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import type { Invoice } from '@/types';
import { detectPatterns } from '@/lib/patternDetection';
import { ClickableLegend } from './ClickableLegend';
import { ChartCustomTooltip } from './ChartCustomTooltip';
import { fmtEurChart as fmtEur, MONTH_SHORT } from '@/lib/utils';

const DAY_MS = 24 * 60 * 60 * 1000;
const INTERVAL_DAYS_MAP: Record<string, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 91,
  yearly: 365,
};


const chartConfig = {
  MonatIst:      { label: 'Monatssaldo (Ist)',      color: '#22c55e' },
  MonatPrognose: { label: 'Monatssaldo (Prognose)',  color: '#86efac' },
  KumIst:        { label: 'Kumuliert (Ist)',          color: '#6366f1' },
  KumPrognose:   { label: 'Kumuliert (Prognose)',     color: '#a5b4fc' },
} satisfies ChartConfig;

interface Props {
  loading: boolean;
  invoices: Invoice[];
  selectedYear?: number;
  privacyMode: boolean;
}

export function JahresprognoseChart({ loading, invoices, selectedYear, privacyMode }: Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setHidden((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const today = new Date();
  const year = selectedYear ?? today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1-based
  const isCurrentYear = year === today.getFullYear();

  const data = useMemo(() => {
    // ── Tatsächlicher Monatssaldo ───────────────────────────────────────────
    const actualMonthly: number[] = Array(12).fill(0);
    for (const inv of invoices) {
      if (inv.year !== year || inv.type === 'info') continue;
      const m = inv.month - 1;
      actualMonthly[m] += inv.type === 'einnahme' ? inv.brutto : -inv.brutto;
    }

    // ── Prognosebetrag je Monat aus wiederkehrenden Mustern ─────────────────
    // Muster aus ALLEN Buchungen ableiten (mehr Datenbasis)
    const patterns = detectPatterns(invoices);
    const forecastMonthly: number[] = Array(12).fill(0);

    for (const p of patterns) {
      const netAmount = p.type === 'einnahme' ? p.avgBrutto : -p.avgBrutto;
      const intervalMs = INTERVAL_DAYS_MAP[p.interval] * DAY_MS;

      if (p.interval === 'monthly' || p.interval === 'weekly') {
        // Monatlich / wöchentlich: für jeden Zukunftsmonat pauschal einrechnen
        const timesPerMonth = p.interval === 'weekly' ? 4 : 1;
        for (let m = 0; m < 12; m++) {
          if (isCurrentYear && m + 1 <= currentMonth) continue; // Vergangenheit = Ist-Daten
          if (!isCurrentYear && year < today.getFullYear()) continue; // kein Forecast für vergangene Jahre
          forecastMonthly[m] += netAmount * timesPerMonth;
        }
      } else {
        // Quartalsweise / jährlich: Einzeltermine anhand des Intervalls projizieren
        // Startpunkt: nextExpectedDate des Musters
        let cur = new Date(p.nextExpectedDate);

        // Falls nextExpectedDate schon vor diesem Jahr liegt → vorwärts wandern
        while (cur.getFullYear() < year) cur = new Date(cur.getTime() + intervalMs);

        // Alle Termine im gewünschten Jahr einsammeln
        while (cur.getFullYear() === year) {
          const m = cur.getMonth(); // 0-based
          const monthNum = m + 1;
          const isFutureMonth = !isCurrentYear || monthNum > currentMonth;
          if (isFutureMonth) {
            forecastMonthly[m] += netAmount;
          }
          cur = new Date(cur.getTime() + intervalMs);
        }
      }
    }

    // ── Kumulierte Serien aufbauen ──────────────────────────────────────────
    let cumIst = 0;
    let cumPrognose = 0;

    return MONTH_SHORT.map((label, m) => {
      const monthNum = m + 1;
      // Ist-Monate: vergangene Jahre vollständig; aktuelles Jahr bis currentMonth
      const isActual = !isCurrentYear || monthNum <= currentMonth;
      const isFuture = isCurrentYear && monthNum > currentMonth;

      const point: Record<string, string | number | null> = { name: label };

      if (isActual) {
        cumIst += actualMonthly[m];
        point['MonatIst']      = Math.round(actualMonthly[m]);
        point['KumIst']        = Math.round(cumIst);
        point['MonatPrognose'] = null;
        point['KumPrognose']   = null;
        // Übergabepunkt: letzter Ist-Monat bekommt auch den Prognose-Startwert
        if (isCurrentYear && monthNum === currentMonth) {
          cumPrognose = cumIst;
          point['KumPrognose']   = Math.round(cumPrognose);
          point['MonatPrognose'] = Math.round(actualMonthly[m]);
        }
      } else if (isFuture) {
        cumPrognose += forecastMonthly[m];
        point['MonatIst']      = null;
        point['KumIst']        = null;
        point['MonatPrognose'] = Math.round(forecastMonthly[m]);
        point['KumPrognose']   = Math.round(cumPrognose);
      } else {
        point['MonatIst'] = point['KumIst'] = point['MonatPrognose'] = point['KumPrognose'] = null;
      }

      return point;
    });
  }, [invoices, year, currentMonth, isCurrentYear, today]);

  if (loading) {
    return (
      <Card className="rounded-xl shadow-sm h-full flex flex-col">
        <CardHeader><Skeleton className="h-5 w-52" /></CardHeader>
        <CardContent className="flex-1 min-h-0 pb-4">
          <Skeleton className="h-full min-h-[220px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const yearInvoicesExist = invoices.some((i) => i.year === year);

  return (
    <Card className="rounded-xl shadow-sm h-full">
      <CardHeader>
        <CardTitle className="text-base">Jahresprognose {year} – Abo-Cashflow</CardTitle>
        <CardDescription>
          Monatssaldo &amp; kumulierter Cashflow – Ist (durchgezogen) + Abo-Prognose (gestrichelt)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!yearInvoicesExist ? (
          <p className="text-sm text-muted-foreground">Keine Buchungen für {year} vorhanden.</p>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <LineChart data={data}>
              <CartesianGrid vertical={false} className="stroke-border/50" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
                width={80}
                tickFormatter={(v) => privacyMode ? '€ ***' : fmtEur(v)}
              />
              <Tooltip content={<ChartCustomTooltip privacyMode={privacyMode} />} />
              <ChartLegend content={<ClickableLegend hiddenKeys={hidden} onToggle={toggle} />} />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 2" />

              {/* Ist-Monatssaldo */}
              <Line type="monotone" dataKey="MonatIst"
                stroke="var(--color-MonatIst)" strokeWidth={2} dot={false}
                connectNulls={false} hide={hidden.has('MonatIst')} />
              {/* Prognose-Monatssaldo */}
              <Line type="monotone" dataKey="MonatPrognose"
                stroke="var(--color-MonatPrognose)" strokeWidth={2} dot={false}
                strokeDasharray="5 3" connectNulls={false} hide={hidden.has('MonatPrognose')} />
              {/* Kumuliert Ist */}
              <Line type="monotone" dataKey="KumIst"
                stroke="var(--color-KumIst)" strokeWidth={2} dot={false}
                connectNulls={false} hide={hidden.has('KumIst')} />
              {/* Kumuliert Prognose */}
              <Line type="monotone" dataKey="KumPrognose"
                stroke="var(--color-KumPrognose)" strokeWidth={2} dot={false}
                strokeDasharray="5 3" connectNulls={false} hide={hidden.has('KumPrognose')} />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

