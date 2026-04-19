import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { fmtCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { CATEGORY_LABELS } from '@/types';
import type { Invoice } from '@/types';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface Props {
  loading: boolean;
  invoices: Invoice[];
  privacyMode: boolean;
}

export function TopEinnahmenCard({ loading, invoices, privacyMode }: Props) {
  const navigate = useNavigate();

  const top = invoices
    .filter((i) => i.type === 'einnahme')
    .sort((a, b) => b.brutto - a.brutto)
    .slice(0, 5);

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm h-full flex flex-col">
      <h2 className="text-lg font-semibold mb-1">Top 5 Einnahmen</h2>
      <p className="text-xs text-muted-foreground mb-4">Größte Einzeleinnahmen im gewählten Jahr</p>
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
        </div>
      ) : top.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine Einnahmen vorhanden.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Datum</TableHead>
              <TableHead>Partner</TableHead>
              <TableHead>Kategorie</TableHead>
              <TableHead className="text-right">Brutto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {top.map((inv) => (
              <TableRow
                key={inv.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => navigate(`/invoices/${inv.id}`)}
              >
                <TableCell className="text-xs">{format(new Date(inv.date), 'dd.MM.yy', { locale: de })}</TableCell>
                <TableCell className="max-w-[120px] truncate">{inv.partner}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{CATEGORY_LABELS[inv.category]}</TableCell>
                <TableCell className="text-right font-medium text-green-600">
                  {fmtCurrency(inv.brutto, privacyMode)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

