import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CATEGORY_LABELS, TYPE_LABELS, CATEGORIES, INVOICE_TYPES } from '@/types';
import type { Invoice, Category, InvoiceType } from '@/types';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { ArrowUpDown, X } from 'lucide-react';

const fmt = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

type SortKey = 'date' | 'partner' | 'category' | 'brutto' | 'type';
type SortDir = 'asc' | 'desc';

interface Props {
  invoices: Invoice[];
  showSearch?: boolean;
  showFilters?: boolean;
}

export function InvoiceTable({ invoices, showSearch = true, showFilters = true }: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterYear, setFilterYear] = useState<number | null>(null);
  const [filterCategory, setFilterCategory] = useState<Category | null>(null);
  const [filterType, setFilterType] = useState<InvoiceType | null>(null);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const years = useMemo(() => {
    const s = new Set(invoices.map((i) => i.year));
    return Array.from(s).sort((a, b) => b - a);
  }, [invoices]);

  const filtered = useMemo(() => {
    let list = invoices;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.description.toLowerCase().includes(q) ||
          i.partner.toLowerCase().includes(q) ||
          i.note.toLowerCase().includes(q)
      );
    }
    if (filterYear) list = list.filter((i) => i.year === filterYear);
    if (filterCategory) list = list.filter((i) => i.category === filterCategory);
    if (filterType) list = list.filter((i) => i.type === filterType);

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') cmp = a.date.localeCompare(b.date);
      else if (sortKey === 'partner') cmp = a.partner.localeCompare(b.partner);
      else if (sortKey === 'category') cmp = a.category.localeCompare(b.category);
      else if (sortKey === 'brutto') cmp = a.brutto - b.brutto;
      else if (sortKey === 'type') cmp = a.type.localeCompare(b.type);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [invoices, search, sortKey, sortDir, filterYear, filterCategory, filterType]);

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(field)}>
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
      </div>
    </TableHead>
  );

  const hasFilters = filterYear || filterCategory || filterType;

  return (
    <div className="space-y-4">
      {showSearch && (
        <Input
          placeholder="Suche nach Beschreibung, Partner oder Notiz..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      )}

      {showFilters && (
        <div className="flex flex-wrap gap-2">
          {years.map((y) => (
            <Button
              key={y}
              size="sm"
              variant={filterYear === y ? 'default' : 'outline'}
              onClick={() => setFilterYear(filterYear === y ? null : y)}
            >
              {y}
            </Button>
          ))}
          {CATEGORIES.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={filterCategory === c ? 'default' : 'outline'}
              onClick={() => setFilterCategory(filterCategory === c ? null : c)}
            >
              {CATEGORY_LABELS[c]}
            </Button>
          ))}
          {INVOICE_TYPES.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={filterType === t ? 'default' : 'outline'}
              onClick={() => setFilterType(filterType === t ? null : t)}
            >
              {TYPE_LABELS[t]}
            </Button>
          ))}
          {hasFilters && (
            <Button size="sm" variant="ghost" onClick={() => { setFilterYear(null); setFilterCategory(null); setFilterType(null); }}>
              <X className="mr-1 h-3 w-3" /> Filter zurücksetzen
            </Button>
          )}
        </div>
      )}

      <div className="rounded-xl border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader label="Datum" field="date" />
              <SortHeader label="Partner" field="partner" />
              <TableHead>Beschreibung</TableHead>
              <SortHeader label="Kategorie" field="category" />
              <SortHeader label="Brutto" field="brutto" />
              <SortHeader label="Typ" field="type" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Keine Rechnungen gefunden.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((inv) => (
                <TableRow
                  key={inv.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/invoices/${inv.id}`)}
                >
                  <TableCell>{format(new Date(inv.date), 'dd.MM.yyyy', { locale: de })}</TableCell>
                  <TableCell>{inv.partner}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{inv.description}</TableCell>
                  <TableCell>{CATEGORY_LABELS[inv.category]}</TableCell>
                  <TableCell className={inv.type === 'einnahme' ? 'text-green-600' : inv.type === 'ausgabe' ? 'text-red-600' : ''}>
                    {fmt.format(inv.brutto)}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      inv.type === 'einnahme' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                      inv.type === 'ausgabe' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                      'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}>
                      {TYPE_LABELS[inv.type]}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

