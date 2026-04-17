import { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Invoice } from '@/types';
import { format, subDays } from 'date-fns';
import { de } from 'date-fns/locale';

const fmtEur = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

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
        Ausgaben: dayInvoices.filter((i) => i.type === 'ausgabe').reduce((s, i) => s + i.brutto, 0),
      };
    });
  }, [invoices]);

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Letzte 28 Tage</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} barGap={1}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="name" className="text-xs" />
            <YAxis tickFormatter={(v) => privacyMode ? '••••' : fmtEur(v)} className="text-xs" width={80} />
            <Tooltip
              labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate ?? ''}
              formatter={(v) => privacyMode ? '••••' : fmtEur(Number(v))}
            />
            <Legend />
            <Bar dataKey="Einnahmen" fill="#22c55e" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Ausgaben" fill="#ef4444" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

