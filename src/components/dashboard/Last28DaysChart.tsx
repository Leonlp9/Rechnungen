import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
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
import { format, subDays } from 'date-fns';
import { de } from 'date-fns/locale';

const fmtEur = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

const chartConfig = {
  Einnahmen: { label: 'Einnahmen', color: 'var(--color-emerald-500, #22c55e)' },
  Ausgaben:  { label: 'Ausgaben',  color: 'var(--color-red-500, #ef4444)' },
} satisfies ChartConfig;

interface Props {
  invoices: Invoice[];
  privacyMode?: boolean;
}

export function Last28DaysChart({ invoices, privacyMode }: Props) {
  const data = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return Array.from({ length: 28 }, (_, i) => {
      const day = subDays(today, 27 - i);
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayInvoices = invoices.filter((inv) => inv.date.startsWith(dayStr));
      return {
        name: (27 - i) % 7 === 0 ? format(day, 'dd.MM', { locale: de }) : '',
        fullDate: format(day, 'dd.MM.yyyy', { locale: de }),
        Einnahmen: dayInvoices.filter((i) => i.type === 'einnahme').reduce((s, i) => s + i.brutto, 0),
        Ausgaben:  dayInvoices.filter((i) => i.type === 'ausgabe').reduce((s, i) => s + i.brutto, 0),
      };
    });
  }, [invoices]);

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Letzte 28 Tage</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <BarChart data={data} barGap={2}>
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
                  labelKey="fullDate"
                  formatter={(value) => privacyMode ? '€€€€' : fmtEur(Number(value))}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="Einnahmen" fill="var(--color-Einnahmen)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Ausgaben"  fill="var(--color-Ausgaben)"  radius={[3, 3, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
