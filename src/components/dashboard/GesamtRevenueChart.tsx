import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { ClickableLegend } from './ClickableLegend';
import { ChartCustomTooltip } from './ChartCustomTooltip';

const fmtEur = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

const chartConfig = {
  Einnahmen: { label: 'Einnahmen', color: 'var(--color-emerald-500, #22c55e)' },
  Ausgaben:  { label: 'Ausgaben',  color: 'var(--color-red-500, #ef4444)' },
} satisfies ChartConfig;

interface Props {
  data: { year: number; einnahmen: number; ausgaben: number }[];
  privacyMode?: boolean;
  loading?: boolean;
}

export function GesamtRevenueChart({ data, privacyMode, loading }: Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (key: string) => setHidden((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  if (loading) {
    return (
      <Card className="rounded-xl shadow-sm h-full">
        <CardHeader><Skeleton className="h-5 w-44" /></CardHeader>
        <CardContent><Skeleton className="h-[280px] w-full" /></CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    name: String(d.year),
    Einnahmen: d.einnahmen,
    Ausgaben: d.ausgaben,
  }));

  return (
    <Card className="rounded-xl shadow-sm h-full">
      <CardHeader>
        <CardTitle className="text-base">Einnahmen vs. Ausgaben – alle Jahre</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <BarChart data={chartData}>
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
            <Tooltip content={<ChartCustomTooltip privacyMode={privacyMode} />} />
            <ChartLegend content={<ClickableLegend hiddenKeys={hidden} onToggle={toggle} />} />
            <Bar dataKey="Einnahmen" fill="var(--color-Einnahmen)" radius={[4, 4, 0, 0]} hide={hidden.has('Einnahmen')} />
            <Bar dataKey="Ausgaben"  fill="var(--color-Ausgaben)"  radius={[4, 4, 0, 0]} hide={hidden.has('Ausgaben')} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
