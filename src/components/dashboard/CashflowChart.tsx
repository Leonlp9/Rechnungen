import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import type { Invoice } from '@/types';
import { ClickableLegend } from './ClickableLegend';
import { ChartCustomTooltip } from './ChartCustomTooltip';
import { fmtEurChart as fmtEur, MONTH_SHORT as MONTHS } from '@/lib/utils';

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
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (key: string) => setHidden((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  // Build month-by-month cumulative cashflow
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
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={80}
                tickFormatter={(v) => privacyMode ? '€ ***' : fmtEur(v)} />
              <Tooltip content={<ChartCustomTooltip privacyMode={privacyMode} />} />
              <ChartLegend content={<ClickableLegend hiddenKeys={hidden} onToggle={toggle} />} />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 2" />
              <Line type="monotone" dataKey="Kumuliert" stroke="var(--color-Kumuliert)" strokeWidth={2} dot={false} hide={hidden.has('Kumuliert')} />
              <Line type="monotone" dataKey="Monatssaldo" stroke="var(--color-Monatssaldo)" strokeWidth={2} dot={false} strokeDasharray="4 2" hide={hidden.has('Monatssaldo')} />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

