import { Skeleton } from '@/components/ui/skeleton';
import { fmtCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { Invoice } from '@/types';

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

interface Props {
  loading: boolean;
  yearInvoices: Invoice[];
  prevYearInvoices: Invoice[];
  selectedYear: number;
  privacyMode: boolean;
}

export function JahresvergleichCard({ loading, yearInvoices, prevYearInvoices, selectedYear, privacyMode }: Props) {
  const rows = MONTHS.map((label, i) => {
    const m = i + 1;
    const einA = yearInvoices.filter((inv) => inv.month === m && inv.type === 'einnahme').reduce((s, inv) => s + inv.brutto, 0);
    const ausA = yearInvoices.filter((inv) => inv.month === m && inv.type === 'ausgabe').reduce((s, inv) => s + inv.brutto, 0);
    const einV = prevYearInvoices.filter((inv) => inv.month === m && inv.type === 'einnahme').reduce((s, inv) => s + inv.brutto, 0);
    const ausV = prevYearInvoices.filter((inv) => inv.month === m && inv.type === 'ausgabe').reduce((s, inv) => s + inv.brutto, 0);
    const saldoA = einA - ausA;
    const saldoV = einV - ausV;
    const delta = saldoV !== 0 ? ((saldoA - saldoV) / Math.abs(saldoV)) * 100 : null;
    return { label, saldoA, saldoV, delta };
  });

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm h-full flex flex-col">
      <h2 className="text-lg font-semibold mb-1">Jahresvergleich</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Monatssaldo {selectedYear} vs. {selectedYear - 1}
      </p>
      {loading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-1 font-medium">Monat</th>
                <th className="text-right py-1 font-medium">{selectedYear}</th>
                <th className="text-right py-1 font-medium">{selectedYear - 1}</th>
                <th className="text-right py-1 font-medium">Δ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ label, saldoA, saldoV, delta }) => (
                <tr key={label} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-1 text-muted-foreground">{label}</td>
                  <td className={cn('py-1 text-right font-medium tabular-nums',
                    saldoA > 0 ? 'text-green-600' : saldoA < 0 ? 'text-red-600' : 'text-muted-foreground'
                  )}>
                    {fmtCurrency(saldoA, privacyMode)}
                  </td>
                  <td className={cn('py-1 text-right tabular-nums text-muted-foreground',
                    saldoV > 0 ? 'text-green-600/60' : saldoV < 0 ? 'text-red-600/60' : ''
                  )}>
                    {fmtCurrency(saldoV, privacyMode)}
                  </td>
                  <td className={cn('py-1 text-right tabular-nums',
                    delta === null ? 'text-muted-foreground' :
                    delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-muted-foreground'
                  )}>
                    {delta === null ? '–' : `${delta > 0 ? '+' : ''}${delta.toFixed(0)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

