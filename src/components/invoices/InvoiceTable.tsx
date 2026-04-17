import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CATEGORY_LABELS, TYPE_LABELS, CATEGORIES, INVOICE_TYPES } from '@/types';
import type { Invoice, Category, InvoiceType } from '@/types';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { ArrowUpDown, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/store';
import { fmtCurrency } from '@/lib/utils';

type SortKey = 'date' | 'partner' | 'category' | 'brutto' | 'type';
type SortDir = 'asc' | 'desc';

interface Props {
  invoices: Invoice[];
  showSearch?: boolean;
  showFilters?: boolean;
  showYearFilter?: boolean;
}

export function InvoiceTable({ invoices, showSearch = true, showFilters = true, showYearFilter = true }: Props) {
  const navigate = useNavigate();
  const privacyMode = useAppStore((s) => s.privacyMode);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterCategory, setFilterCategory] = useState<Category | null>(null);
  const [filterType, setFilterType] = useState<InvoiceType | null>(null);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  const years = useMemo(() => {
    const s = new Set(invoices.map((i) => i.year));
    return Array.from(s).sort((a, b) => b - a);
  }, [invoices]);

  const [filterYear, setFilterYear] = useState<number | null>(null);

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Reset to page 1 when filters/search change
  const setFilter = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(field)}>
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
      </div>
    </TableHead>
  );

  const hasFilters = (showYearFilter && filterYear) || filterCategory || filterType;

  return (
    <div className="space-y-4">
      {showSearch && (
        <Input
          placeholder="Suche nach Beschreibung, Partner oder Notiz..."
          value={search}
          onChange={(e) => { setFilter(setSearch)(e.target.value); }}
          className="max-w-md"
        />
      )}

      {showFilters && (
        <div className="flex flex-wrap gap-2">
          {showYearFilter && years.map((y) => (
            <Button key={y} size="sm" variant={filterYear === y ? 'default' : 'outline'}
              onClick={() => setFilter(setFilterYear)(filterYear === y ? null : y)}>{y}</Button>
          ))}
          {CATEGORIES.map((c) => (
            <Button key={c} size="sm" variant={filterCategory === c ? 'default' : 'outline'}
              onClick={() => setFilter(setFilterCategory)(filterCategory === c ? null : c)}>
              {CATEGORY_LABELS[c]}
            </Button>
          ))}
          {INVOICE_TYPES.map((t) => (
            <Button key={t} size="sm" variant={filterType === t ? 'default' : 'outline'}
              onClick={() => setFilter(setFilterType)(filterType === t ? null : t)}>
              {TYPE_LABELS[t]}
            </Button>
          ))}
          {hasFilters && (
            <Button size="sm" variant="ghost" onClick={() => { if (showYearFilter) setFilterYear(null); setFilterCategory(null); setFilterType(null); setPage(1); }}>
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
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Keine Rechnungen gefunden.
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((inv) => (
                <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/invoices/${inv.id}`)}>
                  <TableCell>{format(new Date(inv.date), 'dd.MM.yyyy', { locale: de })}</TableCell>
                  <TableCell>{inv.partner}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{inv.description}</TableCell>
                  <TableCell>{CATEGORY_LABELS[inv.category]}</TableCell>
                  <TableCell className={inv.type === 'einnahme' ? 'text-green-600' : inv.type === 'ausgabe' ? 'text-red-600' : ''}>
                    {fmtCurrency(inv.brutto, privacyMode)}
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

      {/* Pagination */}
      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Zeilen pro Seite:</span>
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
            <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[15, 25, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <span>
          {filtered.length === 0 ? '0 Einträge' : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filtered.length)} von ${filtered.length}`}
        </span>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage <= 1} onClick={() => setPage(1)}>
            <ChevronLeft className="h-3 w-3" /><ChevronLeft className="h-3 w-3 -ml-2" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2">Seite {safePage} / {totalPages}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage >= totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage >= totalPages} onClick={() => setPage(totalPages)}>
            <ChevronRight className="h-3 w-3" /><ChevronRight className="h-3 w-3 -ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}

