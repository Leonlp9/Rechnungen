import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  type ChartConfig,
} from '@/components/ui/chart';
import type { Invoice } from '@/types';
import { format, subDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { ClickableLegend } from './ClickableLegend';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, privacyMode }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-xs space-y-1">
      <p className="font-semibold text-foreground mb-1">{d.fullDate}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">{privacyMode ? '€€€€' : fmtEur(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function Last28DaysChart({ invoices, privacyMode, loading }: Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (key: string) => setHidden((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const data = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return Array.from({ length: 28 }, (_, i) => {
      const day = subDays(today, 27 - i);
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayInvoices = invoices.filter((inv) => inv.date.startsWith(dayStr));
      return {
        fullDate: format(day, 'dd.MM.yyyy', { locale: de }),
        shortDate: format(day, 'dd.MM', { locale: de }),
        dayIndex: i,
        Einnahmen: dayInvoices.filter((inv) => inv.type === 'einnahme').reduce((s, inv) => s + inv.brutto, 0),
        Ausgaben:  dayInvoices.filter((inv) => inv.type === 'ausgabe').reduce((s, inv) => s + inv.brutto, 0),
      };
    });
  }, [invoices]);

  if (loading) {
    return (
      <Card className="rounded-xl shadow-sm h-full flex flex-col">
        <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
        <CardContent className="flex-1 min-h-0 pb-4"><Skeleton className="h-full min-h-[220px] w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl shadow-sm h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-base">Letzte 28 Tage</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-[240px] pb-4 relative">
        <ChartContainer config={chartConfig} className="min-h-[260px] h-full w-full">
          <BarChart data={data} barGap={2}>
            <CartesianGrid vertical={false} className="stroke-border/50" />
            <XAxis dataKey="fullDate" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval={0}
              tickFormatter={(_, index) => (index % 7 === 0 ? data[index]?.shortDate ?? '' : '')} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={80}
              tickFormatter={(v) => (privacyMode ? '€ ***' : fmtEur(v))} />
            <Tooltip content={<CustomTooltip privacyMode={privacyMode} />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
            <ChartLegend content={<ClickableLegend hiddenKeys={hidden} onToggle={toggle} />} />
            <Bar dataKey="Einnahmen" fill="var(--color-Einnahmen)" radius={[3, 3, 0, 0]} hide={hidden.has('Einnahmen')} />
            <Bar dataKey="Ausgaben"  fill="var(--color-Ausgaben)"  radius={[3, 3, 0, 0]} hide={hidden.has('Ausgaben')} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
