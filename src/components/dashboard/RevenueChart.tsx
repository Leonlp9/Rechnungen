import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { Invoice } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';

const MONTH_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const fmtEur = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

const chartConfig = {
  Einnahmen: { label: 'Einnahmen', color: 'var(--color-emerald-500, #22c55e)' },
  Ausgaben:  { label: 'Ausgaben',  color: 'var(--color-red-500, #ef4444)' },
} satisfies ChartConfig;

interface Props {
  invoices: Invoice[];
  privacyMode?: boolean;
  loading?: boolean;
}

export function RevenueChart({ invoices, privacyMode, loading }: Props) {
  if (loading) {
    return (
      <Card className="rounded-xl shadow-sm">
        <CardHeader><Skeleton className="h-5 w-44" /></CardHeader>
        <CardContent><Skeleton className="h-[280px] w-full" /></CardContent>
      </Card>
    );
  }
  const data = useMemo(() =>
    MONTH_SHORT.map((name, idx) => {
      const m = idx + 1;
      const mi = invoices.filter((i) => i.month === m);
      return {
        name,
        Einnahmen: mi.filter((i) => i.type === 'einnahme').reduce((s, i) => s + i.brutto, 0),
        Ausgaben:  mi.filter((i) => i.type === 'ausgabe').reduce((s, i) => s + i.brutto, 0),
      };
    }), [invoices]);

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Einnahmen vs. Ausgaben</CardTitle>
      </CardHeader>
      <CardContent>
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
            <Line
              type="monotone"
              dataKey="Einnahmen"
              stroke="var(--color-Einnahmen)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="Ausgaben"
              stroke="var(--color-Ausgaben)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
