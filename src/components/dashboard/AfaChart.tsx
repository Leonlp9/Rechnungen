import { useState } from 'react';
import { useDashboardContext } from './DashboardContext';
import { fmtCurrency } from '@/lib/utils';
import { NUTZUNGSDAUER_LABELS } from '@/lib/afa';
import { Skeleton } from '@/components/ui/skeleton';
import { Calculator, Package } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  AreaChart, Area, CartesianGrid,
} from 'recharts';

const COLORS = [
  '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444',
  '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#84cc16',
  '#a855f7',
];

function groupByType(afaItems: { assetType: string; jahresAfa: number }[]) {
  const byType = new Map<string, number>();
  for (const item of afaItems) {
    if (item.jahresAfa <= 0) continue;
    const label = NUTZUNGSDAUER_LABELS[item.assetType] ?? item.assetType;
    byType.set(label, (byType.get(label) ?? 0) + item.jahresAfa);
  }
  return Array.from(byType.entries())
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value);
}

/** AfA-Balkendiagramm nach Wirtschaftsgut-Typ */
export function AfaBarChart() {
  const { loading, privacyMode, afaItems, selectedYear } = useDashboardContext();

  if (loading) return <Skeleton className="h-64 rounded-xl" />;

  const data = groupByType(afaItems);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-sm h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <Package className="h-8 w-8 opacity-40" />
        <p className="text-xs">Keine AfA-Daten in {selectedYear}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <Calculator className="h-4 w-4 text-violet-500" />
        <span className="text-sm font-semibold">AfA nach Typ – {selectedYear}</span>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%" minHeight={180}>
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
            <XAxis
              type="number"
              tickFormatter={(v) => privacyMode ? '••••' : `${Number(v).toLocaleString('de-DE')} €`}
              fontSize={10}
            />
            <YAxis type="category" dataKey="name" width={110} fontSize={10} />
            <Tooltip
              formatter={(v) => [fmtCurrency(Number(v), privacyMode), 'AfA']}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** AfA-Donut – Verteilung nach Typ */
export function AfaDonutChart() {
  const { loading, privacyMode, afaItems, selectedYear } = useDashboardContext();

  if (loading) return <Skeleton className="h-64 rounded-xl" />;

  const data = groupByType(afaItems);
  const total = data.reduce((s, d) => s + d.value, 0);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-sm h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <Package className="h-8 w-8 opacity-40" />
        <p className="text-xs">Keine AfA-Daten in {selectedYear}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm h-full flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <Calculator className="h-4 w-4 text-violet-500" />
        <span className="text-sm font-semibold">AfA-Verteilung – {selectedYear}</span>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%" minHeight={180}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="50%"
              outerRadius="80%"
              paddingAngle={2}
              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              fontSize={10}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => [fmtCurrency(Number(v), privacyMode), 'AfA']}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="text-center text-xs text-muted-foreground mt-1">
        Gesamt: {fmtCurrency(total, privacyMode)}
      </div>
    </div>
  );
}

type TimelineMode = 'yearly' | 'monthly';

/** AfA-Zeitverlauf – alle Geräte über die Jahre/Monate */
export function AfaTimelineChart() {
  const { loading, privacyMode, afaItems } = useDashboardContext();
  const [mode, setMode] = useState<TimelineMode>('yearly');

  if (loading) return <Skeleton className="h-72 rounded-xl" />;

  // Nur Geräte mit linearer AfA (nutzungsdauer > 1)
  const linearItems = afaItems.filter((item) => item.nutzungsdauer > 1 && item.proRata);

  if (linearItems.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-sm h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <Package className="h-8 w-8 opacity-40" />
        <p className="text-xs">Keine linearen AfA-Posten vorhanden</p>
      </div>
    );
  }

  // Farben für jedes Gerät
  const itemColors = linearItems.map((_, i) => COLORS[i % COLORS.length]);
  const itemLabels = linearItems.map((item) => {
    const label = item.invoice.partner || item.invoice.description;
    return label.length > 20 ? label.slice(0, 18) + '…' : label;
  });
  const itemKeys = linearItems.map((_, i) => `asset_${i}`);

  if (mode === 'yearly') {
    // Jahresansicht: Pro Jahr den AfA-Betrag jedes Geräts
    const allYears = new Set<number>();
    for (const item of linearItems) {
      if (item.proRata) {
        for (const row of item.proRata.jahresplan) allYears.add(row.jahr);
      }
    }
    const sortedYears = Array.from(allYears).sort((a, b) => a - b);

    const data = sortedYears.map((jahr) => {
      const entry: Record<string, number | string> = { label: String(jahr) };
      let total = 0;
      for (let i = 0; i < linearItems.length; i++) {
        const row = linearItems[i].proRata?.jahresplan.find((r) => r.jahr === jahr);
        const val = row?.betrag ?? 0;
        entry[itemKeys[i]] = Math.round(val * 100) / 100;
        total += val;
      }
      entry.total = Math.round(total * 100) / 100;
      return entry;
    });

    return renderChart(data, itemKeys, itemLabels, itemColors, privacyMode, mode, setMode);
  } else {
    // Monatsansicht: Monats-AfA für jeden Monat aufschlüsseln
    // Bestimme den Zeitraum (frühestes Kaufdatum bis letztes Ende)
    let minDate = Infinity;
    let maxDate = -Infinity;
    for (const item of linearItems) {
      if (item.proRata) {
        const plan = item.proRata.jahresplan;
        if (plan.length > 0) {
          const kaufDate = new Date(item.invoice.date);
          const startMonth = kaufDate.getFullYear() * 12 + kaufDate.getMonth();
          const lastEntry = plan[plan.length - 1];
          const endMonth = lastEntry.jahr * 12 + (lastEntry.monate - 1);
          if (startMonth < minDate) minDate = startMonth;
          if (endMonth > maxDate) maxDate = endMonth;
        }
      }
    }

    // Begrenze auf max 120 Monate (10 Jahre) für Performance
    if (maxDate - minDate > 120) maxDate = minDate + 120;

    const data: Record<string, number | string>[] = [];
    for (let m = minDate; m <= maxDate; m++) {
      const year = Math.floor(m / 12);
      const month = (m % 12) + 1;
      const label = `${String(month).padStart(2, '0')}/${year}`;
      const entry: Record<string, number | string> = { label };
      let total = 0;

      for (let i = 0; i < linearItems.length; i++) {
        const item = linearItems[i];
        const monatsAfa = item.proRata?.monatsAfa ?? 0;
        // Prüfen ob dieses Gerät in diesem Monat noch abgeschrieben wird
        const kaufDate = new Date(item.invoice.date);
        const kaufMonthAbs = kaufDate.getFullYear() * 12 + kaufDate.getMonth();
        const plan = item.proRata?.jahresplan ?? [];
        const lastEntry = plan[plan.length - 1];
        const endeMonthAbs = lastEntry
          ? lastEntry.jahr * 12 + (lastEntry.monate - 1)
          : kaufMonthAbs;

        const val = (m >= kaufMonthAbs && m <= endeMonthAbs) ? monatsAfa : 0;
        entry[itemKeys[i]] = Math.round(val * 100) / 100;
        total += val;
      }
      entry.total = Math.round(total * 100) / 100;
      data.push(entry);
    }

    return renderChart(data, itemKeys, itemLabels, itemColors, privacyMode, mode, setMode);
  }
}

function renderChart(
  data: Record<string, number | string>[],
  itemKeys: string[],
  itemLabels: string[],
  itemColors: string[],
  privacyMode: boolean,
  mode: TimelineMode,
  setMode: (m: TimelineMode) => void,
) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-semibold">AfA-Zeitverlauf</span>
        </div>
        <div className="flex rounded-md border text-[10px] overflow-hidden">
          <button
            type="button"
            onClick={() => setMode('yearly')}
            className={`px-2.5 py-1 transition-colors ${mode === 'yearly' ? 'bg-violet-500 text-white' : 'hover:bg-muted'}`}
          >
            Jährlich
          </button>
          <button
            type="button"
            onClick={() => setMode('monthly')}
            className={`px-2.5 py-1 transition-colors border-l ${mode === 'monthly' ? 'bg-violet-500 text-white' : 'hover:bg-muted'}`}
          >
            Monatlich
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%" minHeight={200}>
          <AreaChart data={data} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="label"
              fontSize={9}
              interval={mode === 'monthly' ? Math.max(0, Math.floor(data.length / 8) - 1) : 0}
              angle={mode === 'monthly' ? -45 : 0}
              textAnchor={mode === 'monthly' ? 'end' : 'middle'}
              height={mode === 'monthly' ? 45 : 25}
            />
            <YAxis
              fontSize={9}
              tickFormatter={(v) => privacyMode ? '••••' : `${Number(v).toLocaleString('de-DE')} €`}
              width={70}
            />
            <Tooltip
              formatter={(v, name) => {
                const idx = itemKeys.indexOf(name as string);
                const label = idx >= 0 ? itemLabels[idx] : 'Gesamt';
                return [fmtCurrency(Number(v), privacyMode), label];
              }}
              labelStyle={{ fontSize: 11, fontWeight: 600 }}
              contentStyle={{ fontSize: 11, borderRadius: 8 }}
            />
            {itemKeys.map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                name={key}
                stackId="1"
                fill={itemColors[i]}
                stroke={itemColors[i]}
                fillOpacity={0.6}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {/* Legende */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 px-1">
        {itemLabels.map((label, i) => (
          <div key={i} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: itemColors[i] }} />
            <span className="truncate max-w-[120px]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
