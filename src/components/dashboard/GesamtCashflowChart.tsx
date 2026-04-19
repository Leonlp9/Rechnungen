import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import type { Invoice } from '@/types';
import { ClickableLegend } from './ClickableLegend';

const MONTH_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const fmtEur = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

const chartConfig = {
  Kumuliert: { label: 'Kumulierter Saldo', color: '#6366f1' },
  Monatssaldo: { label: 'Monatssaldo', color: '#22c55e' },
} satisfies ChartConfig;

interface Props {
  loading: boolean;
  invoices: Invoice[];
  privacyMode: boolean;
}

export function GesamtCashflowChart({ loading, invoices, privacyMode }: Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (key: string) => setHidden((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const data = useMemo(() => {
    // Collect all unique year+month combos, sorted chronologically
    const keySet = new Set<string>();
    for (const inv of invoices) {
      keySet.add(`${inv.year}-${String(inv.month).padStart(2, '0')}`);
    }
    const keys = Array.from(keySet).sort();

    let cumulative = 0;
    return keys.map((key) => {
      const [yearStr, monthStr] = key.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);
      const ein = invoices
        .filter((i) => i.year === year && i.month === month && i.type === 'einnahme')
        .reduce((s, i) => s + i.brutto, 0);
      const aus = invoices
        .filter((i) => i.year === year && i.month === month && i.type === 'ausgabe')
        .reduce((s, i) => s + i.brutto, 0);
      cumulative += ein - aus;
      return {
        name: `${MONTH_SHORT[month - 1]} ${year}`,
        Monatssaldo: ein - aus,
        Kumuliert: cumulative,
      };
    });
  }, [invoices]);

  if (loading) {
    return (
      <Card className="rounded-xl shadow-sm h-full flex flex-col">
        <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent className="flex-1 min-h-0 pb-4">
          <Skeleton className="h-full min-h-[220px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasData = invoices.length > 0;

  return (
    <Card className="rounded-xl shadow-sm h-full">
      <CardHeader>
        <CardTitle className="text-base">Kumulierter Cashflow – alle Jahre</CardTitle>
        <CardDescription>Monatlicher und aufgelaufener Saldo über alle Jahre</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-sm text-muted-foreground">Keine Buchungen vorhanden.</p>
        ) : (
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <LineChart data={data}>
              <CartesianGrid vertical={false} className="stroke-border/50" />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
                width={80}
                tickFormatter={(v) => privacyMode ? '€ ***' : fmtEur(v)}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => privacyMode ? '€€€€' : fmtEur(Number(value))}
                  />
                }
              />
              <ChartLegend content={<ClickableLegend hiddenKeys={hidden} onToggle={toggle} />} />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 2" />
              <Line
                type="monotone"
                dataKey="Kumuliert"
                stroke="var(--color-Kumuliert)"
                strokeWidth={2}
                dot={false}
                hide={hidden.has('Kumuliert')}
              />
              <Line
                type="monotone"
                dataKey="Monatssaldo"
                stroke="var(--color-Monatssaldo)"
                strokeWidth={2}
                dot={false}
                strokeDasharray="4 2"
                hide={hidden.has('Monatssaldo')}
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

