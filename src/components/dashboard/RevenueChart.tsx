import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Invoice } from '@/types';

const MONTH_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const fmtEur = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

interface Props {
  invoices: Invoice[];
}

export function RevenueChart({ invoices }: Props) {
  const data = useMemo(() => {
    return MONTH_SHORT.map((name, idx) => {
      const m = idx + 1;
      const mi = invoices.filter((i) => i.month === m);
      return {
        name,
        Einnahmen: mi.filter((i) => i.type === 'einnahme').reduce((s, i) => s + i.brutto, 0),
        Ausgaben: mi.filter((i) => i.type === 'ausgabe').reduce((s, i) => s + i.brutto, 0),
      };
    });
  }, [invoices]);

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Einnahmen vs. Ausgaben</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="name" className="text-xs" />
            <YAxis tickFormatter={(v) => fmtEur(v)} className="text-xs" width={80} />
            <Tooltip formatter={(v) => fmtEur(Number(v))} />
            <Legend />
            <Line type="monotone" dataKey="Einnahmen" stroke="#22c55e" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Ausgaben" stroke="#ef4444" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}


