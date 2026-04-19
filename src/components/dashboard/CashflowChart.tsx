import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import type { Invoice } from '@/types';

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

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

export function CashflowChart({ loading, invoices, privacyMode }: Props) {
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

  // Build month-by-month cumulative cashflow
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const data = useMemo(() => {
    let cumulative = 0;
    return MONTHS.map((name, i) => {
      const month = i + 1;
      const ein = invoices.filter((inv) => inv.month === month && inv.type === 'einnahme').reduce((s, inv) => s + inv.brutto, 0);
      const aus = invoices.filter((inv) => inv.month === month && inv.type === 'ausgabe').reduce((s, inv) => s + inv.brutto, 0);
      cumulative += ein - aus;
      return { name, Monatssaldo: ein - aus, Kumuliert: cumulative };
    });
  }, [invoices]);

  const hasData = invoices.length > 0;

  return (
    <Card className="rounded-xl shadow-sm h-full">
      <CardHeader>
        <CardTitle className="text-base">Kumulierter Cashflow</CardTitle>
        <CardDescription>Aufgelaufener Saldo über das Jahr</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-sm text-muted-foreground">Keine Buchungen für dieses Jahr vorhanden.</p>
        ) : (
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <LineChart data={data}>
              <CartesianGrid vertical={false} className="stroke-border/50" />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
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
              <ChartLegend content={<ChartLegendContent />} />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 2" />
              <Line
                type="monotone"
                dataKey="Kumuliert"
                stroke="var(--color-Kumuliert)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="Monatssaldo"
                stroke="var(--color-Monatssaldo)"
                strokeWidth={2}
                dot={false}
                strokeDasharray="4 2"
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

