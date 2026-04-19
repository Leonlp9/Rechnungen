import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KPICard } from '@/components/dashboard/KPICard';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { CategoryDonut } from '@/components/dashboard/CategoryDonut';
import { SonderausgabenCard } from '@/components/dashboard/SonderausgabenCard';
import { ForecastList } from '@/components/dashboard/ForecastList';
import { Last28DaysChart } from '@/components/dashboard/Last28DaysChart';
import { RecentEmailsCard } from '@/components/dashboard/RecentEmailsCard';
import { useAppStore } from '@/store';
import { getAllInvoices } from '@/lib/db';
import { Euro, TrendingUp, TrendingDown, FileText, Calculator, CalendarDays, Sparkles } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { CATEGORY_LABELS, TYPE_LABELS, SONDERAUSGABEN_CATEGORIES, PRIVAT_CATEGORIES } from '@/types';
import type { Invoice, Category } from '@/types';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { fmtCurrency } from '@/lib/utils';
import { InvoiceContextMenu } from '@/components/invoices/InvoiceContextMenu';
import { detectPatterns, forecastCurrentMonth } from '@/lib/patternDetection';

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

  // Betriebsergebnis = Einnahmen minus NUR Betriebsausgaben (ohne Sonderausgaben & Privat)
  const nichtBetrieblich: Category[] = [...SONDERAUSGABEN_CATEGORIES, ...PRIVAT_CATEGORIES];
  const betriebsausgaben = yearInvoices
    .filter((i) => i.type === 'ausgabe' && !nichtBetrieblich.includes(i.category))
    .reduce((s, i) => s + i.brutto, 0);
  const betriebsergebnis = einnahmen - betriebsausgaben;
  const sonderausgabenGesamt = yearInvoices
    .filter((i) => i.type === 'ausgabe' && nichtBetrieblich.includes(i.category))
    .reduce((s, i) => s + i.brutto, 0);

  const prevEinnahmen = prevYearInvoices.filter((i) => i.type === 'einnahme').reduce((s, i) => s + i.brutto, 0);
  const prevAusgaben = prevYearInvoices.filter((i) => i.type === 'ausgabe').reduce((s, i) => s + i.brutto, 0);

  const deltaEin = prevEinnahmen ? ((einnahmen - prevEinnahmen) / prevEinnahmen) * 100 : 0;
  const deltaAus = prevAusgaben ? ((ausgaben - prevAusgaben) / prevAusgaben) * 100 : 0;
  const prevSaldo = prevEinnahmen - prevAusgaben;
  const deltaSaldo = prevSaldo ? ((saldo - prevSaldo) / Math.abs(prevSaldo)) * 100 : 0;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentCount = invoices.filter((i) => new Date(i.date) >= thirtyDaysAgo).length;

  const isCurrentYear = selectedYear === now.getFullYear();

  // ── Monatliche Kennzahlen (nur im aktuellen Jahr relevant) ──────────────────
  const thisMonth = now.getMonth() + 1;
  const prevMonthNum = thisMonth === 1 ? 12 : thisMonth - 1;
  const prevMonthYear = thisMonth === 1 ? selectedYear - 1 : selectedYear;

  const monthInvoices = useMemo(
    () => yearInvoices.filter((i) => i.month === thisMonth),
    [yearInvoices, thisMonth]
  );
  const prevMonthInvoices = useMemo(
    () => invoices.filter((i) => i.year === prevMonthYear && i.month === prevMonthNum),
    [invoices, prevMonthYear, prevMonthNum]
  );

  const monatEin = monthInvoices.filter((i) => i.type === 'einnahme').reduce((s, i) => s + i.brutto, 0);
  const monatAus = monthInvoices.filter((i) => i.type === 'ausgabe').reduce((s, i) => s + i.brutto, 0);
  const monatSaldo = monatEin - monatAus;

  const prevMonatEin = prevMonthInvoices.filter((i) => i.type === 'einnahme').reduce((s, i) => s + i.brutto, 0);
  const prevMonatAus = prevMonthInvoices.filter((i) => i.type === 'ausgabe').reduce((s, i) => s + i.brutto, 0);
  const prevMonatSaldo = prevMonatEin - prevMonatAus;

  const deltaMonatEin = prevMonatEin ? ((monatEin - prevMonatEin) / prevMonatEin) * 100 : 0;
  const deltaMonatAus = prevMonatAus ? ((monatAus - prevMonatAus) / prevMonatAus) * 100 : 0;
  const deltaMonatSaldo = prevMonatSaldo ? ((monatSaldo - prevMonatSaldo) / Math.abs(prevMonatSaldo)) * 100 : 0;

  // Prognose für Rest-Monat
  const forecastItems = useMemo(() => !loading ? forecastCurrentMonth(detectPatterns(invoices)) : [], [invoices, loading]);
  const forecastEin = forecastItems.filter((f) => f.pattern.type === 'einnahme').reduce((s, f) => s + f.expectedBrutto, 0);
  const forecastAus = forecastItems.filter((f) => f.pattern.type === 'ausgabe').reduce((s, f) => s + f.expectedBrutto, 0);
  const monatSaldoMitPrognose = monatSaldo + forecastEin - forecastAus;

  const lastTen = yearInvoices.slice(0, 10);

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

      {/* Stage 0 – KPI Jahres-Karten */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KPICard loading={loading} title="Einnahmen YTD" value={fmtCurrency(einnahmen, privacyMode)} delta={privacyMode ? undefined : deltaEin} icon={<TrendingUp className="h-4 w-4 text-green-600" />} />
        <KPICard loading={loading} title="Ausgaben YTD" value={fmtCurrency(ausgaben, privacyMode)} delta={privacyMode ? undefined : deltaAus} icon={<TrendingDown className="h-4 w-4 text-red-600" />} />
        <KPICard loading={loading} title="Saldo YTD" value={fmtCurrency(saldo, privacyMode)} delta={privacyMode ? undefined : deltaSaldo} icon={<Euro className="h-4 w-4 text-primary" />} tooltip="Tatsächlich verfügbares Geld: Einnahmen minus alle Ausgaben (inkl. Krankenkasse, Spenden, Privat)" />
        <KPICard loading={loading} title="Betriebsergebnis" value={fmtCurrency(betriebsergebnis, privacyMode)} icon={<Calculator className="h-4 w-4 text-violet-600" />} tooltip={`Steuerlich relevantes Ergebnis: nur Betriebsausgaben abgezogen. Sonderausgaben & Privat (${fmtCurrency(sonderausgabenGesamt, privacyMode)}) nicht enthalten.`} />
        <KPICard loading={loading} title="Belege (30 Tage)" value={String(recentCount)} icon={<FileText className="h-4 w-4 text-muted-foreground" />} />
      </div>

      {/* Stage 1 – Monatliche KPI-Karten */}
      {isCurrentYear && (
        <>
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            <CalendarDays className="h-4 w-4" />
            {format(now, 'MMMM yyyy', { locale: de })}
            <span className="text-[11px] font-normal normal-case text-muted-foreground/60">vs. Vormonat</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard loading={loading} title="Einnahmen (Monat)" value={fmtCurrency(monatEin, privacyMode)} delta={privacyMode ? undefined : deltaMonatEin} icon={<TrendingUp className="h-4 w-4 text-green-600" />} />
            <KPICard loading={loading} title="Ausgaben (Monat)" value={fmtCurrency(monatAus, privacyMode)} delta={privacyMode ? undefined : deltaMonatAus} icon={<TrendingDown className="h-4 w-4 text-red-600" />} />
            <KPICard loading={loading} title="Saldo (Monat)" value={fmtCurrency(monatSaldo, privacyMode)} delta={privacyMode ? undefined : deltaMonatSaldo} icon={<Euro className="h-4 w-4 text-primary" />} tooltip="Einnahmen minus Ausgaben im aktuellen Monat" />
            <KPICard loading={loading} title="Saldo inkl. Prognose" value={fmtCurrency(monatSaldoMitPrognose, privacyMode)} icon={<Sparkles className="h-4 w-4 text-violet-500" />} tooltip={`Aktueller Monatssaldo + erwartete Einnahmen (${fmtCurrency(forecastEin, privacyMode)}) − erwartete Ausgaben (${fmtCurrency(forecastAus, privacyMode)}) bis Monatsende`} />
          </div>
        </>
      )}

      {/* Stage 2 – Prognose */}
      {isCurrentYear && <ForecastList loading={loading} invoices={invoices} privacyMode={privacyMode} />}

      {/* Stage 3 – Jahres-Charts */}
      <div className={`grid grid-cols-1 gap-6 ${sonderausgabenGesamt > 0 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
        <RevenueChart loading={loading} invoices={yearInvoices} privacyMode={privacyMode} />
        <CategoryDonut loading={loading} invoices={yearInvoices} privacyMode={privacyMode} />
        <SonderausgabenCard loading={loading} invoices={yearInvoices} privacyMode={privacyMode} />
      </div>

      {/* Stage 4 – 28-Tage-Chart + E-Mails */}
      {isCurrentYear && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Last28DaysChart loading={loading} invoices={invoices} privacyMode={privacyMode} />
          <RecentEmailsCard />
        </div>
      )}

      {/* Stage 5 – Letzte 10 Belege */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Letzte 10 Belege</h2>
        {loading ? (
          <div className="space-y-2">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : lastTen.length === 0 ? (
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
