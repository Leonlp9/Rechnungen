import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { CATEGORY_LABELS, TYPE_LABELS, CATEGORIES, INVOICE_TYPES } from '@/types';
import type { Invoice, Category, InvoiceType } from '@/types';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { ArrowUpDown, ArrowUp, ArrowDown, X, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { useAppStore } from '@/store';
import { fmtCurrency } from '@/lib/utils';
import { InvoiceContextMenu } from './InvoiceContextMenu';
import { useState } from 'react';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [ctxMenu, setCtxMenu] = useState<{ invoice: Invoice; x: number; y: number } | null>(null);

  // Read state from URL
  const search = searchParams.get('q') ?? '';
  const sortKey = (searchParams.get('sort') as SortKey) ?? 'date';
  const sortDir = (searchParams.get('dir') as SortDir) ?? 'desc';
  const filterCategories: Category[] = searchParams.get('cat') ? (searchParams.get('cat')!.split(',') as Category[]) : [];
  const filterTypes: InvoiceType[] = searchParams.get('type') ? (searchParams.get('type')!.split(',') as InvoiceType[]) : [];
  const pageSize = Number(searchParams.get('size') ?? 25);
  const page = Number(searchParams.get('page') ?? 1);
  const fyearParam = searchParams.get('fyear');
  const currentYear = new Date().getFullYear();
  // kein Param → aktuelles Jahr; "all" → alle Jahre; sonst kommagetrennte Jahre
  const filterYears: number[] = fyearParam === 'all'
    ? []
    : fyearParam
      ? fyearParam.split(',').map(Number)
      : [currentYear];

  const setParam = (key: string, value: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value == null || value === '') next.delete(key);
      else next.set(key, value);
      if (key !== 'page') next.delete('page');
      return next;
    }, { replace: true });
  };

  const toggleMultiParam = (key: string, value: string, current: string[]) => {
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    setParam(key, next.length ? next.join(',') : null);
  };

  const toggleSort = (key: SortKey) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (sortKey === key) next.set('dir', sortDir === 'asc' ? 'desc' : 'asc');
      else { next.set('sort', key); next.set('dir', 'asc'); }
      next.delete('page');
      return next;
    }, { replace: true });
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
    if (filterYears.length) list = list.filter((i) => filterYears.includes(i.year));
    if (filterCategories.length) list = list.filter((i) => filterCategories.includes(i.category as Category));
    if (filterTypes.length) list = list.filter((i) => filterTypes.includes(i.type as InvoiceType));
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
  }, [invoices, search, sortKey, sortDir, filterYears, filterCategories, filterTypes]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => {
    const active = sortKey === field;
    const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(field)}>
        <div className="flex items-center gap-1">
          {label}
          <Icon className={`h-3 w-3 ${active ? 'text-foreground' : 'text-muted-foreground'}`} />
        </div>
      </TableHead>
    );
  };

  const hasFilters = (showYearFilter && fyearParam != null) || filterCategories.length > 0 || filterTypes.length > 0;

  const yearLabel = fyearParam === 'all'
    ? 'Alle Jahre'
    : filterYears.length === 1
      ? String(filterYears[0])
      : `${filterYears.length} Jahre`;

  const catLabel = filterCategories.length === 0
    ? 'Kategorie'
    : filterCategories.length === 1
      ? CATEGORY_LABELS[filterCategories[0]]
      : `${filterCategories.length} Kategorien`;

  const typeLabel = filterTypes.length === 0
    ? 'Typ'
    : filterTypes.length === 1
      ? TYPE_LABELS[filterTypes[0]]
      : `${filterTypes.length} Typen`;

  return (
    <div className="space-y-4">
      {showSearch && (
        <Input
          placeholder="Suche nach Beschreibung, Partner oder Notiz..."
          value={search}
          onChange={(e) => { setParam('q', e.target.value || null); }}
          className="max-w-md"
        />
      )}

      {showFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Jahr Dropdown */}
          {showYearFilter && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant={filterYears.length > 0 ? 'default' : 'outline'} className="gap-1">
                  {yearLabel} <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuCheckboxItem
                  checked={fyearParam === 'all'}
                  onCheckedChange={() => setParam('fyear', 'all')}
                  onSelect={(e) => e.preventDefault()}
                >
                  Alle Jahre
                </DropdownMenuCheckboxItem>
                {years.map((y) => (
                  <DropdownMenuCheckboxItem
                    key={y}
                    checked={filterYears.includes(y)}
                    onCheckedChange={() => {
                      const next = filterYears.includes(y)
                        ? filterYears.filter((v) => v !== y)
                        : [...filterYears, y];
                      setParam('fyear', next.length ? next.join(',') : null);
                    }}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {y}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Kategorie Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant={filterCategories.length > 0 ? 'default' : 'outline'} className="gap-1">
                {catLabel} <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 w-64 overflow-y-auto">
              {CATEGORIES.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c}
                  checked={filterCategories.includes(c)}
                  onCheckedChange={() => toggleMultiParam('cat', c, filterCategories)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {CATEGORY_LABELS[c]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Typ Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant={filterTypes.length > 0 ? 'default' : 'outline'} className="gap-1">
                {typeLabel} <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {INVOICE_TYPES.map((t) => (
                <DropdownMenuCheckboxItem
                  key={t}
                  checked={filterTypes.includes(t)}
                  onCheckedChange={() => toggleMultiParam('type', t, filterTypes)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {TYPE_LABELS[t]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {hasFilters && (
            <Button size="sm" variant="ghost" onClick={() => {
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete('fyear');
                next.delete('cat'); next.delete('type'); next.delete('page');
                return next;
              }, { replace: true });
            }}>
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
                  onClick={() => navigate(`/invoices/${inv.id}`)}
                  onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ invoice: inv, x: e.clientX, y: e.clientY }); }}>
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
          <Select value={String(pageSize)} onValueChange={(v) => { setParam('size', v); }}>
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
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage <= 1} onClick={() => setParam('page', '1')}>
            <ChevronLeft className="h-3 w-3" /><ChevronLeft className="h-3 w-3 -ml-2" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage <= 1} onClick={() => setParam('page', String(safePage - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2">Seite {safePage} / {totalPages}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage >= totalPages} onClick={() => setParam('page', String(safePage + 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage >= totalPages} onClick={() => setParam('page', String(totalPages))}>
            <ChevronRight className="h-3 w-3" /><ChevronRight className="h-3 w-3 -ml-2" />
          </Button>
        </div>
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

