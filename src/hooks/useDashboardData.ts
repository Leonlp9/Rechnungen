import { useMemo, useState, useEffect } from 'react';
import { useAppStore } from '@/store';
import { getAllInvoices } from '@/lib/db';
import { detectPatterns, forecastCurrentMonth } from '@/lib/patternDetection';
import { SONDERAUSGABEN_CATEGORIES, PRIVAT_CATEGORIES } from '@/types';
import type { Category, Invoice } from '@/types';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export interface DashboardData {
  loading: boolean;
  invoices: Invoice[];
  yearInvoices: Invoice[];
  prevYearInvoices: Invoice[];
  selectedYear: number;
  setSelectedYear: (y: number) => void;
  selectedMonth: number;
  setSelectedMonth: (m: number) => void;
  years: number[];
  privacyMode: boolean;
  // YTD
  einnahmen: number;
  ausgaben: number;
  saldo: number;
  betriebsergebnis: number;
  sonderausgabenGesamt: number;
  recentCount: number;
  deltaEin: number;
  deltaAus: number;
  deltaSaldo: number;
  // Monthly
  isCurrentYear: boolean;
  thisMonthLabel: string;
  monatEin: number;
  monatAus: number;
  monatSaldo: number;
  deltaMonatEin: number;
  deltaMonatAus: number;
  deltaMonatSaldo: number;
  monatSaldoMitPrognose: number;
  forecastEin: number;
  forecastAus: number;
  forecastItems: ReturnType<typeof forecastCurrentMonth>;
  lastTen: Invoice[];
  // Gesamt (alle Jahre)
  gesamtEinnahmen: number;
  gesamtAusgaben: number;
  gesamtSaldo: number;
  gesamtBelege: number;
  gesamtBestesJahr: { year: number; einnahmen: number } | null;
  gesamtAvgYearlyEinnahmen: number;
  gesamtAvgYearlyAusgaben: number;
  gesamtMarge: number;
  gesamtByYear: { year: number; einnahmen: number; ausgaben: number }[];
}

export function useDashboardData(): DashboardData {
  const invoices = useAppStore((s) => s.invoices);
  const setInvoices = useAppStore((s) => s.setInvoices);
  const selectedYear = useAppStore((s) => s.selectedYear);
  const setSelectedYear = useAppStore((s) => s.setSelectedYear);
  const privacyMode = useAppStore((s) => s.privacyMode);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    getAllInvoices()
      .then(setInvoices)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [setInvoices]);

  const years = useMemo(() => {
    const s = new Set(invoices.map((i) => i.year));
    s.add(new Date().getFullYear());
    return Array.from(s).sort((a, b) => b - a);
  }, [invoices]);

  const yearInvoices = useMemo(
    () => invoices.filter((i) => i.year === selectedYear),
    [invoices, selectedYear],
  );
  const prevYearInvoices = useMemo(
    () => invoices.filter((i) => i.year === selectedYear - 1),
    [invoices, selectedYear],
  );

  const einnahmen = yearInvoices.filter((i) => i.type === 'einnahme').reduce((s, i) => s + i.brutto, 0);
  const ausgaben = yearInvoices.filter((i) => i.type === 'ausgabe').reduce((s, i) => s + i.brutto, 0);
  const saldo = einnahmen - ausgaben;

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
  const thisMonthLabel = format(new Date(selectedYear, selectedMonth - 1, 1), 'MMMM yyyy', { locale: de });

  const thisMonth = selectedMonth;
  const prevMonthNum = thisMonth === 1 ? 12 : thisMonth - 1;
  const prevMonthYear = thisMonth === 1 ? selectedYear - 1 : selectedYear;

  const monthInvoices = useMemo(
    () => yearInvoices.filter((i) => i.month === thisMonth),
    [yearInvoices, thisMonth],
  );
  const prevMonthInvoices = useMemo(
    () => invoices.filter((i) => i.year === prevMonthYear && i.month === prevMonthNum),
    [invoices, prevMonthYear, prevMonthNum],
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

  const forecastItems = useMemo(
    () => (!loading ? forecastCurrentMonth(detectPatterns(invoices), selectedYear, selectedMonth) : []),
    [invoices, loading, selectedYear, selectedMonth],
  );
  const forecastEin = forecastItems.filter((f) => f.pattern.type === 'einnahme').reduce((s, f) => s + f.expectedBrutto, 0);
  const forecastAus = forecastItems.filter((f) => f.pattern.type === 'ausgabe').reduce((s, f) => s + f.expectedBrutto, 0);
  const monatSaldoMitPrognose = monatSaldo + forecastEin - forecastAus;

  const lastTen = yearInvoices.slice(0, 10);

  // ── Gesamt-Kennzahlen (alle Jahre) ───────────────────────────────────────
  const gesamtData = useMemo(() => {
    const gesamtEinnahmen = invoices.filter((i) => i.type === 'einnahme').reduce((s, i) => s + i.brutto, 0);
    const gesamtAusgaben = invoices.filter((i) => i.type === 'ausgabe').reduce((s, i) => s + i.brutto, 0);
    const gesamtSaldo = gesamtEinnahmen - gesamtAusgaben;
    const gesamtBelege = invoices.length;

    // Per-year aggregates
    const yearMap = new Map<number, { einnahmen: number; ausgaben: number }>();
    for (const inv of invoices) {
      if (!yearMap.has(inv.year)) yearMap.set(inv.year, { einnahmen: 0, ausgaben: 0 });
      const entry = yearMap.get(inv.year)!;
      if (inv.type === 'einnahme') entry.einnahmen += inv.brutto;
      else entry.ausgaben += inv.brutto;
    }
    const gesamtByYear = Array.from(yearMap.entries())
      .map(([year, v]) => ({ year, ...v }))
      .sort((a, b) => a.year - b.year);

    const numYears = gesamtByYear.length || 1;
    const gesamtAvgYearlyEinnahmen = gesamtEinnahmen / numYears;
    const gesamtAvgYearlyAusgaben = gesamtAusgaben / numYears;

    const gesamtBestesJahr = gesamtByYear.length
      ? gesamtByYear.reduce((best, cur) => cur.einnahmen > best.einnahmen ? cur : best)
      : null;

    const gesamtMarge = gesamtEinnahmen > 0 ? ((gesamtEinnahmen - gesamtAusgaben) / gesamtEinnahmen) * 100 : 0;

    return {
      gesamtEinnahmen, gesamtAusgaben, gesamtSaldo, gesamtBelege,
      gesamtBestesJahr, gesamtAvgYearlyEinnahmen, gesamtAvgYearlyAusgaben,
      gesamtMarge, gesamtByYear,
    };
  }, [invoices]);

  return {
    loading,
    invoices,
    yearInvoices,
    prevYearInvoices,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    years,
    privacyMode,
    einnahmen,
    ausgaben,
    saldo,
    betriebsergebnis,
    sonderausgabenGesamt,
    recentCount,
    deltaEin,
    deltaAus,
    deltaSaldo,
    isCurrentYear,
    thisMonthLabel,
    monatEin,
    monatAus,
    monatSaldo,
    deltaMonatEin,
    deltaMonatAus,
    deltaMonatSaldo,
    monatSaldoMitPrognose,
    forecastEin,
    forecastAus,
    forecastItems,
    lastTen,
    ...gesamtData,
  };
}

