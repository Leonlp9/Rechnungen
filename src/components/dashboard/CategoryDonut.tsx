import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  type ChartConfig,
} from '@/components/ui/chart';
import type { Invoice } from '@/types';
import { CATEGORY_LABELS, SONDERAUSGABEN_CATEGORIES, type Category } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ClickableLegend } from './ClickableLegend';

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316'];

const fmtEur = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

interface Props {
  invoices: Invoice[];
  privacyMode?: boolean;
  loading?: boolean;
}

export function CategoryDonut({ invoices, privacyMode, loading }: Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (key: string) => setHidden((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const allData = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of invoices) {
      if (inv.type !== 'ausgabe') continue;
      if (SONDERAUSGABEN_CATEGORIES.includes(inv.category as Category)) continue;
      map.set(inv.category, (map.get(inv.category) ?? 0) + inv.brutto);
    }
    return Array.from(map.entries())
      .map(([cat, value]) => ({ name: CATEGORY_LABELS[cat as Category] ?? cat, value, cat }))
      .sort((a, b) => b.value - a.value);
  }, [invoices]);

  const data = useMemo(() => allData.filter((d) => !hidden.has(d.name)), [allData, hidden]);

  const chartConfig = useMemo(
    () =>
      Object.fromEntries(
        allData.map((d, i) => [d.name, { label: d.name, color: COLORS[i % COLORS.length] }])
      ) as ChartConfig,
    [allData]
  );

  // Build legend payload from allData (so hidden items still show in legend, just faded)
  const legendPayload = useMemo(
    () => allData.map((d, i) => ({ value: d.name, color: COLORS[i % COLORS.length] })),
    [allData]
  );

  if (loading) {
    return (
      <Card className="rounded-xl shadow-sm h-full">
        <CardHeader><Skeleton className="h-5 w-44" /></CardHeader>
        <CardContent><Skeleton className="h-[280px] w-full rounded-full max-w-[280px] mx-auto" /></CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl shadow-sm h-full">
      <CardHeader>
        <CardTitle className="text-base">Ausgaben nach Kategorie</CardTitle>
      </CardHeader>
      <CardContent>
        {allData.length === 0 ? (
          <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
            Keine Ausgaben vorhanden.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%"
                innerRadius={60} outerRadius={100} paddingAngle={2}>
                {data.map((entry) => {
                  const idx = allData.findIndex((d) => d.name === entry.name);
                  return <Cell key={entry.name} fill={COLORS[idx % COLORS.length]} strokeWidth={0} />;
                })}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => (privacyMode ? '€€€€' : fmtEur(Number(value)))} nameKey="name" />} />
              <ChartLegend content={<ClickableLegend customPayload={legendPayload} hiddenKeys={hidden} onToggle={toggle} />} />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
