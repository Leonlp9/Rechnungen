import { useMemo } from 'react';
import { PieChart, Pie, Cell } from 'recharts';
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
import { CATEGORY_LABELS, SONDERAUSGABEN_CATEGORIES, type Category } from '@/types';

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316'];

const fmtEur = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

interface Props {
  invoices: Invoice[];
  privacyMode?: boolean;
}

export function CategoryDonut({ invoices, privacyMode }: Props) {
  const data = useMemo(() => {
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

  const chartConfig = useMemo(
    () =>
      Object.fromEntries(
        data.map((d, i) => [d.name, { label: d.name, color: COLORS[i % COLORS.length] }])
      ) as ChartConfig,
    [data]
  );

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Ausgaben nach Kategorie</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
            Keine Ausgaben vorhanden.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} strokeWidth={0} />
                ))}
              </Pie>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => (privacyMode ? '€€€€' : fmtEur(Number(value)))}
                    nameKey="name"
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
