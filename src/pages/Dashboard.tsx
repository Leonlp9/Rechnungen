import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KPICard } from '@/components/dashboard/KPICard';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { CategoryDonut } from '@/components/dashboard/CategoryDonut';
import { useAppStore } from '@/store';
import { getAllInvoices } from '@/lib/db';
import { Euro, TrendingUp, TrendingDown, FileText } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { CATEGORY_LABELS, TYPE_LABELS } from '@/types';
import type { Invoice } from '@/types';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { fmtCurrency } from '@/lib/utils';
import { InvoiceContextMenu } from '@/components/invoices/InvoiceContextMenu';

export default function Dashboard() {
  const invoices = useAppStore((s) => s.invoices);
  const setInvoices = useAppStore((s) => s.setInvoices);
  const selectedYear = useAppStore((s) => s.selectedYear);
  const setSelectedYear = useAppStore((s) => s.setSelectedYear);
  const privacyMode = useAppStore((s) => s.privacyMode);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [ctxMenu, setCtxMenu] = useState<{ invoice: Invoice; x: number; y: number } | null>(null);

  useEffect(() => {
    getAllInvoices()
      .then(setInvoices)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [setInvoices]);

  const years = useMemo(() => {
    const ySet = new Set(invoices.map((i) => i.year));
    ySet.add(new Date().getFullYear());
    return Array.from(ySet).sort((a, b) => b - a);
  }, [invoices]);

  const yearInvoices = useMemo(
    () => invoices.filter((i) => i.year === selectedYear),
    [invoices, selectedYear]
  );

  const prevYearInvoices = useMemo(
    () => invoices.filter((i) => i.year === selectedYear - 1),
    [invoices, selectedYear]
  );

  const einnahmen = yearInvoices.filter((i) => i.type === 'einnahme').reduce((s, i) => s + i.brutto, 0);
  const ausgaben = yearInvoices.filter((i) => i.type === 'ausgabe').reduce((s, i) => s + i.brutto, 0);
  const saldo = einnahmen - ausgaben;

  const prevEinnahmen = prevYearInvoices.filter((i) => i.type === 'einnahme').reduce((s, i) => s + i.brutto, 0);
  const prevAusgaben = prevYearInvoices.filter((i) => i.type === 'ausgabe').reduce((s, i) => s + i.brutto, 0);

  const deltaEin = prevEinnahmen ? ((einnahmen - prevEinnahmen) / prevEinnahmen) * 100 : 0;
  const deltaAus = prevAusgaben ? ((ausgaben - prevAusgaben) / prevAusgaben) * 100 : 0;
  const prevSaldo = prevEinnahmen - prevAusgaben;
  const deltaSaldo = prevSaldo ? ((saldo - prevSaldo) / Math.abs(prevSaldo)) * 100 : 0;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentCount = invoices.filter((i) => new Date(i.date) >= thirtyDaysAgo).length;

  const lastTen = yearInvoices.slice(0, 10);

  if (loading) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Lade...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Einnahmen YTD" value={fmtCurrency(einnahmen, privacyMode)} delta={privacyMode ? undefined : deltaEin} icon={<TrendingUp className="h-4 w-4 text-green-600" />} />
        <KPICard title="Ausgaben YTD" value={fmtCurrency(ausgaben, privacyMode)} delta={privacyMode ? undefined : deltaAus} icon={<TrendingDown className="h-4 w-4 text-red-600" />} />
        <KPICard title="Saldo YTD" value={fmtCurrency(saldo, privacyMode)} delta={privacyMode ? undefined : deltaSaldo} icon={<Euro className="h-4 w-4 text-primary" />} />
        <KPICard title="Belege (30 Tage)" value={String(recentCount)} icon={<FileText className="h-4 w-4 text-muted-foreground" />} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RevenueChart invoices={yearInvoices} privacyMode={privacyMode} />
        <CategoryDonut invoices={yearInvoices} privacyMode={privacyMode} />
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Letzte 10 Belege</h2>
        {lastTen.length === 0 ? (
          <p className="text-muted-foreground text-sm">Noch keine Rechnungen vorhanden.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead>Brutto</TableHead>
                <TableHead>Typ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lastTen.map((inv) => (
                <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/invoices/${inv.id}`)}
                  onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ invoice: inv, x: e.clientX, y: e.clientY }); }}>
                  <TableCell>{format(new Date(inv.date), 'dd.MM.yyyy', { locale: de })}</TableCell>
                  <TableCell>{inv.partner}</TableCell>
                  <TableCell>{CATEGORY_LABELS[inv.category]}</TableCell>
                  <TableCell className={inv.type === 'einnahme' ? 'text-green-600' : inv.type === 'ausgabe' ? 'text-red-600' : ''}>
                    {fmtCurrency(inv.brutto, privacyMode)}
                  </TableCell>
                  <TableCell>{TYPE_LABELS[inv.type]}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {ctxMenu && (
        <InvoiceContextMenu
          invoice={ctxMenu.invoice}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}
