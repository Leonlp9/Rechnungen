import { Skeleton } from '@/components/ui/skeleton';
import { fmtCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { Invoice } from '@/types';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

interface Props {
  loading: boolean;
  invoices: Invoice[];
  selectedYear: number;
  privacyMode: boolean;
}

export function MonatsuebersichtCard({ loading, invoices, selectedYear, privacyMode }: Props) {
  const rows = MONTHS.map((label, i) => {
    const month = i + 1;
    const monthInv = invoices.filter((inv) => inv.month === month);
    const ein = monthInv.filter((inv) => inv.type === 'einnahme').reduce((s, inv) => s + inv.brutto, 0);
    const aus = monthInv.filter((inv) => inv.type === 'ausgabe').reduce((s, inv) => s + inv.brutto, 0);
    const saldo = ein - aus;
    return { label, ein, aus, saldo };
  });

  const totalEin = rows.reduce((s, r) => s + r.ein, 0);
  const totalAus = rows.reduce((s, r) => s + r.aus, 0);
  const totalSaldo = totalEin - totalAus;

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm h-full flex flex-col">
      <h2 className="text-lg font-semibold mb-1">Monatsübersicht {selectedYear}</h2>
      <p className="text-xs text-muted-foreground mb-4">Einnahmen, Ausgaben und Saldo pro Monat</p>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
      ) : (
        <div className="overflow-auto flex-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Monat</TableHead>
                <TableHead className="text-right">Einnahmen</TableHead>
                <TableHead className="text-right">Ausgaben</TableHead>
                <TableHead className="text-right">
                  <span className="flex items-center justify-end gap-1">
                    Saldo
                    <InfoTooltip text="Saldo = Einnahmen − Ausgaben dieses Monats (Brutto). Positiv = Gewinn, negativ = Verlust im Monat." side="top" />
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.label} className={row.ein === 0 && row.aus === 0 ? 'opacity-40' : ''}>
                  <TableCell className="font-medium text-xs">{row.label}</TableCell>
                  <TableCell className="text-right text-xs text-green-600">
                    {row.ein > 0 ? fmtCurrency(row.ein, privacyMode) : '—'}
                  </TableCell>
                  <TableCell className="text-right text-xs text-red-600">
                    {row.aus > 0 ? fmtCurrency(row.aus, privacyMode) : '—'}
                  </TableCell>
                  <TableCell className={cn('text-right text-xs font-medium', row.saldo >= 0 ? 'text-green-700' : 'text-red-600')}>
                    {row.ein === 0 && row.aus === 0 ? '—' : fmtCurrency(row.saldo, privacyMode)}
                  </TableCell>
                </TableRow>
              ))}
              {/* Total row */}
              <TableRow className="border-t-2 font-semibold">
                <TableCell className="text-xs font-bold">Gesamt</TableCell>
                <TableCell className="text-right text-xs text-green-600 font-bold">
                  {fmtCurrency(totalEin, privacyMode)}
                </TableCell>
                <TableCell className="text-right text-xs text-red-600 font-bold">
                  {fmtCurrency(totalAus, privacyMode)}
                </TableCell>
                <TableCell className={cn('text-right text-xs font-bold', totalSaldo >= 0 ? 'text-green-700' : 'text-red-600')}>
                  {fmtCurrency(totalSaldo, privacyMode)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

