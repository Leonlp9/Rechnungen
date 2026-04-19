import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import type { Invoice } from '@/types';

const fmtEur = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

const COLORS = [
  '#6366f1',
  '#22c55e',
  '#f59e0b',
  '#ec4899',
  '#14b8a6',
];

interface Props {
  loading: boolean;
  invoices: Invoice[];
  privacyMode: boolean;
}

export function TopPartnerCard({ loading, invoices, privacyMode }: Props) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const data = useMemo(() => {
    const byPartner = invoices
      .filter((i) => i.type === 'einnahme')
      .reduce<Record<string, number>>((acc, inv) => {
        const key = inv.partner || 'Unbekannt';
        acc[key] = (acc[key] ?? 0) + inv.brutto;
        return acc;
      }, {});
    return Object.entries(byPartner)
      .map(([name, Umsatz]) => ({ name, Umsatz }))
      .sort((a, b) => b.Umsatz - a.Umsatz)
      .slice(0, 5);
  }, [invoices]);

  const chartConfig = useMemo(() =>
    Object.fromEntries(
      data.map((d, i) => [d.name, { label: d.name, color: COLORS[i % COLORS.length] }])
    ) as ChartConfig,
    [data],
  );

  return (
    <Card className="rounded-xl shadow-sm h-full">
      <CardHeader>
        <CardTitle className="text-base">Top Kunden</CardTitle>
        <CardDescription>Top 5 Partner nach Umsatz im gewählten Jahr</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Einnahmen vorhanden.</p>
        ) : (
          <ChartContainer config={chartConfig} className="h-[240px] w-full">
            <BarChart data={data} layout="vertical">
              <CartesianGrid horizontal={false} className="stroke-border/50" />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => privacyMode ? '€ ***' : fmtEur(v)}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
                tickFormatter={(v: string) => v.length > 13 ? v.slice(0, 13) + '…' : v}
              />
              <ChartTooltip
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                content={
                  <ChartTooltipContent
                    formatter={(value) => privacyMode ? '€€€€' : fmtEur(Number(value))}
                  />
                }
              />
              <Bar dataKey="Umsatz" radius={[0, 4, 4, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

