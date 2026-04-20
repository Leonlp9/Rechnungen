import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  type ChartConfig,
} from '@/components/ui/chart';
import type { Invoice } from '@/types';
import { format, getDaysInMonth } from 'date-fns';
import { de } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { ClickableLegend } from './ClickableLegend';
import { ChartCustomTooltip } from './ChartCustomTooltip';
import { fmtEurChart as fmtEur } from '@/lib/utils';

const chartConfig = {
  Einnahmen: { label: 'Einnahmen', color: 'var(--color-emerald-500, #22c55e)' },
  Ausgaben:  { label: 'Ausgaben',  color: 'var(--color-red-500, #ef4444)' },
} satisfies ChartConfig;

interface Props {
  invoices: Invoice[];
  selectedMonth: number; // 1-based
  selectedYear: number;
  privacyMode?: boolean;
  loading?: boolean;
}


export function MonthChart({ invoices, selectedMonth, selectedYear, privacyMode, loading }: Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (key: string) => setHidden((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const data = useMemo(() => {
    const daysInMonth = getDaysInMonth(new Date(selectedYear, selectedMonth - 1, 1));
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = new Date(selectedYear, selectedMonth - 1, i + 1);
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayInvoices = invoices.filter((inv) => inv.date.startsWith(dayStr));
      return {
        fullDate: format(day, 'dd.MM.yyyy', { locale: de }),
        shortDate: format(day, 'd', { locale: de }),
        Einnahmen: dayInvoices.filter((inv) => inv.type === 'einnahme').reduce((s, inv) => s + inv.brutto, 0),
        Ausgaben:  dayInvoices.filter((inv) => inv.type === 'ausgabe').reduce((s, inv) => s + inv.brutto, 0),
      };
    });
  }, [invoices, selectedMonth, selectedYear]);

  if (loading) {
    return (
      <Card className="rounded-xl shadow-sm h-full flex flex-col">
        <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent className="flex-1 min-h-0 pb-4"><Skeleton className="h-full min-h-[220px] w-full" /></CardContent>
      </Card>
    );
  }

  const monthLabel = format(new Date(selectedYear, selectedMonth - 1, 1), 'MMMM yyyy', { locale: de });

  return (
    <Card className="rounded-xl shadow-sm h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-base">{monthLabel}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-[240px] pb-4 relative">
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <BarChart data={data} barGap={2}>
            <CartesianGrid vertical={false} className="stroke-border/50" />
            <XAxis dataKey="shortDate" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval={4} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={80}
              tickFormatter={(v) => (privacyMode ? '€ ***' : fmtEur(v))} />
            <Tooltip content={<ChartCustomTooltip privacyMode={privacyMode} />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
            <ChartLegend content={<ClickableLegend hiddenKeys={hidden} onToggle={toggle} />} />
            <Bar dataKey="Einnahmen" fill="var(--color-Einnahmen)" radius={[3, 3, 0, 0]} hide={hidden.has('Einnahmen')} />
            <Bar dataKey="Ausgaben"  fill="var(--color-Ausgaben)"  radius={[3, 3, 0, 0]} hide={hidden.has('Ausgaben')} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

