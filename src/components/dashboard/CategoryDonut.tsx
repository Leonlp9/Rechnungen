import { useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Invoice } from '@/types';
import { CATEGORY_LABELS, type Category } from '@/types';

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316'];

const fmtEur = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

interface Props {
  invoices: Invoice[];
}

export function CategoryDonut({ invoices }: Props) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of invoices) {
      if (inv.type !== 'ausgabe') continue;
      map.set(inv.category, (map.get(inv.category) ?? 0) + inv.brutto);
    }
    return Array.from(map.entries())
      .map(([cat, value]) => ({
        name: CATEGORY_LABELS[cat as Category] ?? cat,
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [invoices]);

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
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                dataKey="value"
                paddingAngle={2}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => fmtEur(Number(v))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}


