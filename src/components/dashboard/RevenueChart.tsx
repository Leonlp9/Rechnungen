import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
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
import type { Invoice } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ClickableLegend } from './ClickableLegend';
import { ChartCustomTooltip } from './ChartCustomTooltip';

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
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (key: string) => setHidden((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

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

  if (loading) {
    return (
      <Card className="rounded-xl shadow-sm h-full">
        <CardHeader><Skeleton className="h-5 w-44" /></CardHeader>
        <CardContent><Skeleton className="h-[280px] w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl shadow-sm h-full">
      <CardHeader>
        <CardTitle className="text-base">Einnahmen vs. Ausgaben</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <LineChart data={data}>
            <CartesianGrid vertical={false} className="stroke-border/50" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={80}
              tickFormatter={(v) => privacyMode ? '€ ***' : fmtEur(v)} />
            <Tooltip content={<ChartCustomTooltip privacyMode={privacyMode} />} />
            <ChartLegend content={<ClickableLegend hiddenKeys={hidden} onToggle={toggle} />} />
            <Line type="monotone" dataKey="Einnahmen" stroke="var(--color-Einnahmen)" strokeWidth={2} dot={false} hide={hidden.has('Einnahmen')} />
            <Line type="monotone" dataKey="Ausgaben"  stroke="var(--color-Ausgaben)"  strokeWidth={2} dot={false} hide={hidden.has('Ausgaben')} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
