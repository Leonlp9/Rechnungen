import { useMemo, useState, useEffect } from 'react';
import { useAppStore } from '@/store';
import { getAllInvoices, fahrtenbuch } from '@/lib/db';
import { detectPatterns, forecastCurrentMonth } from '@/lib/patternDetection';
import type { Invoice } from '@/types';
import { berechneEuer, kleinunternehmerStatus, type SteuerProfil } from '@/lib/steuer/gewinn';
import { berechneAnlagegueter, AFA_METHODE_LABELS } from '@/lib/steuer/anlagen';
import { steuerRuecklage, begrenzeSonderausgaben } from '@/lib/steuer/tarif';
import { istBetriebsausgabe, wirkungVon } from '@/lib/steuer/kategorien';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { getGwgKategorie } from '@/lib/afa';
import type { ProRataAfaResult } from '@/lib/afa';

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
  betriebsergebnisNachAfa: number;
  sonderausgabenGesamt: number;
  /** Die vollständige EÜR des Jahres – dieselbe Rechnung wie im Steuerbericht. */
  euer: import('@/lib/steuer/gewinn').EuerErgebnis;
  /** Empfohlene Steuerrücklage, gerechnet mit dem Tarif des § 32a EStG. */
  ruecklage: import('@/lib/steuer/tarif').RuecklageErgebnis;
  /** Stand der Kleinunternehmergrenze: Vorjahr und laufendes Jahr getrennt. */
  kuStatus: import('@/lib/steuer/gewinn').KleinunternehmerStatus;
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
  // AfA
  afaInvoices: Invoice[];
  gwgInvoices: Invoice[];
  afaGesamtNetto: number;
  gwgGesamtNetto: number;
  afaJahresAbschreibung: number;
  afaItems: AfaItem[];
  // Neue Metriken
  stilleReserven: number;
  topKunde: { partner: string; betrag: number; anteil: number } | null;
  mrc: number; // Monthly Recurring Costs (erkannte monatliche ausgaben)
  // Fahrtenbuch (Jahr)
  fahrtKmDienst: number;
  fahrtKmPrivat: number;
  fahrtKmGesamt: number;
  fahrtAbsetzbar: number;
  fahrtAnzahl: number;
  fahrtFahrten: import('@/lib/db').Fahrt[];
  // Fahrtenbuch (Monat)
  fahrtKmDienstMonat: number;
  fahrtKmPrivatMonat: number;
  fahrtKmGesamtMonat: number;
  fahrtAbsetzbarMonat: number;
  fahrtAnzahlMonat: number;
  fahrtFahrtenMonat: import('@/lib/db').Fahrt[];
}

export interface AfaItem {
  invoice: Invoice;
  assetType: string;
  gwkKategorie: string;
  empfohlen: string;
  jahresAfa: number;
  nutzungsdauer: number;
  proRata: ProRataAfaResult | null;
  /**
   * Der Betrag, der abgeschrieben wird. Beim Kleinunternehmer ist das der
   * Bruttobetrag – die nicht abziehbare Vorsteuer gehört zu den
   * Anschaffungskosten (§ 9b Abs. 1 EStG). Wer hier `invoice.netto` nimmt,
   * bekommt Restwerte, die nicht zum Kaufpreis passen.
   */
  bemessung: number;
}

export function useDashboardData(): DashboardData {
  const invoices = useAppStore((s) => s.invoices);
  const setInvoices = useAppStore((s) => s.setInvoices);
  const selectedYear = useAppStore((s) => s.selectedYear);
  const setSelectedYear = useAppStore((s) => s.setSelectedYear);
  const selectedMonth = useAppStore((s) => s.selectedMonth);
  const setSelectedMonth = useAppStore((s) => s.setSelectedMonth);
  const privacyMode = useAppStore((s) => s.privacyMode);
  const kmPauschale = useAppStore((s) => s.kmPauschale);
  const steuerregelung = useAppStore((s) => s.steuerregelung);
  const rechtsform = useAppStore((s) => s.rechtsform);
  const fahrzeugImBetriebsvermoegen = useAppStore((s) => s.fahrzeugImBetriebsvermoegen);
  const verheiratet = useAppStore((s) => s.verheiratet);
  const kirchensteuerSatz = useAppStore((s) => s.kirchensteuerSatz);
  const gewerbesteuerHebesatz = useAppStore((s) => s.gewerbesteuerHebesatz);
  const reiseTageVoll = useAppStore((s) => s.reiseTageVoll);
  const reiseTageTeil = useAppStore((s) => s.reiseTageTeil);
  const grundfreibetragManuell = useAppStore((s) => s.grundfreibetragManuell);
  const [loading, setLoading] = useState(invoices.length === 0);

  // Fahrtenbuch-Daten für das gewählte Jahr
  const [fahrtStats, setFahrtStats] = useState({ kmDienst: 0, kmPrivat: 0, kmGesamt: 0, absetzbar: 0, fahrten: [] as import('@/lib/db').Fahrt[] });
  // dataVersion: nach einem Cloud-Sync neu laden, ohne Seitenwechsel
  const dataVersion = useAppStore((s) => s.dataVersion);
  useEffect(() => {
    fahrtenbuch.getJahresauswertung(selectedYear, kmPauschale)
      .then((d) => setFahrtStats({ ...d }))
      .catch(console.error);
  }, [selectedYear, kmPauschale, dataVersion]);

  // Fahrtenbuch-Daten für den gewählten Monat
  const fahrtMonat = useMemo(() => {
    const monatFahrten = fahrtStats.fahrten.filter(f => {
      const d = new Date(f.datum);
      return d.getMonth() + 1 === selectedMonth;
    });
    const kmDienst = monatFahrten.filter(f => f.art === 'dienst').reduce((s, f) => s + f.km, 0);
    const kmPrivat = monatFahrten.filter(f => f.art === 'privat').reduce((s, f) => s + f.km, 0);
    return { kmDienst, kmPrivat, kmGesamt: kmDienst + kmPrivat, absetzbar: kmDienst * kmPauschale, fahrten: monatFahrten };
  }, [fahrtStats.fahrten, selectedMonth, kmPauschale]);

  useEffect(() => {
    // Daten nur laden wenn der Store noch leer ist (erster Mount oder nach Reset)
    if (invoices.length > 0) { setLoading(false); return; }
    getAllInvoices()
      .then(setInvoices)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [setInvoices, invoices.length]);

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

  const einnahmen = useMemo(() => yearInvoices.filter((i) => i.type === 'einnahme').reduce((s, i) => s + i.brutto, 0), [yearInvoices]);
  const ausgaben = useMemo(() => yearInvoices.filter((i) => i.type === 'ausgabe').reduce((s, i) => s + i.brutto, 0), [yearInvoices]);
  const saldo = einnahmen - ausgaben;

  // Betriebsausgaben sind nur die, die den Gewinn auch wirklich mindern.
  // Sonderausgaben (Krankenversicherung, Altersvorsorge, Spenden) tun das
  // nicht – sie wirken erst in der Einkommensteuererklärung.
  const betriebsausgaben = useMemo(() => yearInvoices
    .filter((i) => i.type === 'ausgabe' && istBetriebsausgabe(i.category))
    .reduce((s, i) => s + i.brutto, 0), [yearInvoices]);
  const betriebsergebnis = einnahmen - betriebsausgaben;
  const sonderausgabenGesamt = useMemo(() => yearInvoices
    .filter((i) => i.type === 'ausgabe' && wirkungVon(i.category) === 'sonderausgabe')
    .reduce((s, i) => s + i.brutto, 0), [yearInvoices]);

  const prevEinnahmen = useMemo(() => prevYearInvoices.filter((i) => i.type === 'einnahme').reduce((s, i) => s + i.brutto, 0), [prevYearInvoices]);
  const prevAusgaben = useMemo(() => prevYearInvoices.filter((i) => i.type === 'ausgabe').reduce((s, i) => s + i.brutto, 0), [prevYearInvoices]);

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

  const monatEin = useMemo(() => monthInvoices.filter((i) => i.type === 'einnahme').reduce((s, i) => s + i.brutto, 0), [monthInvoices]);
  const monatAus = useMemo(() => monthInvoices.filter((i) => i.type === 'ausgabe').reduce((s, i) => s + i.brutto, 0), [monthInvoices]);
  const monatSaldo = monatEin - monatAus;
  const prevMonatEin = useMemo(() => prevMonthInvoices.filter((i) => i.type === 'einnahme').reduce((s, i) => s + i.brutto, 0), [prevMonthInvoices]);
  const prevMonatAus = useMemo(() => prevMonthInvoices.filter((i) => i.type === 'ausgabe').reduce((s, i) => s + i.brutto, 0), [prevMonthInvoices]);
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

  // ── Wirtschaftsgüter ──────────────────────────────────────────────────────
  // Kommt aus derselben Rechnung wie der Steuerbericht. Vorher hatte das
  // Dashboard eine eigene: Bemessung immer netto, keine degressive AfA, und
  // ein Monitor galt als GWG, obwohl er dafür nicht selbständig nutzbar ist.
  const afaData = useMemo((): Pick<DashboardData, 'afaInvoices' | 'gwgInvoices' | 'afaGesamtNetto' | 'gwgGesamtNetto' | 'afaJahresAbschreibung' | 'afaItems'> => {
    const gueter = berechneAnlagegueter(invoices, selectedYear, steuerregelung);

    const afaInvoices = yearInvoices.filter((i) => i.category === 'anlagevermoegen_afa');
    const gwgInvoices = yearInvoices.filter((i) => i.category === 'gwg');
    // „Netto" heißt hier: die steuerliche Bemessungsgrundlage. Beim
    // Kleinunternehmer ist das der Bruttobetrag, weil die Umsatzsteuer mangels
    // Vorsteuerabzug zu den Anschaffungskosten gehört.
    const bemessungVon = (inv: Invoice) =>
      gueter.find((g) => g.invoice.id === inv.id)?.bemessung ?? inv.netto;
    const afaGesamtNetto = afaInvoices.reduce((sum, i) => sum + bemessungVon(i), 0);
    const gwgGesamtNetto = gwgInvoices.reduce((sum, i) => sum + bemessungVon(i), 0);

    const afaItems: DashboardData['afaItems'] = gueter.map((g) => ({
      invoice: g.invoice,
      assetType: g.assetType,
      bemessung: g.bemessung,
      gwkKategorie: g.selbstaendigNutzbar
        ? getGwgKategorie(g.pruefBetrag)
        : 'Nicht selbständig nutzbar – kein GWG',
      empfohlen: AFA_METHODE_LABELS[g.methode],
      jahresAfa: g.jahresAfa,
      nutzungsdauer: g.nutzungsdauer,
      // Die Karten zeigen daraus den Verlauf und die Formel. Der Plan liegt
      // im Wirtschaftsgut schon fertig vor, er wird hier nur umbenannt.
      proRata: g.nutzungsdauer > 1
        ? {
          afaBetragImJahr: g.jahresAfa,
          monateImJahr: g.plan.find((j) => j.jahr === selectedYear)?.monate ?? 0,
          volleJahresAfa: Math.round((g.bemessung / g.nutzungsdauer) * 100) / 100,
          monatsAfa: Math.round((g.bemessung / g.nutzungsdauer / 12) * 100) / 100,
          endeJahr: g.plan[g.plan.length - 1]?.jahr ?? new Date(g.invoice.date).getFullYear(),
          endeMonat: g.plan[g.plan.length - 1]?.monate ?? 12,
          restwertEndeJahr: g.restbuchwert,
          jahresplan: g.plan.map((j) => ({
            jahr: j.jahr,
            monate: j.monate,
            betrag: j.betrag,
            restwert: j.restwert,
          })),
        }
        : null,
    }));

    const afaJahresAbschreibung = Math.round(afaItems.reduce((sum, item) => sum + item.jahresAfa, 0) * 100) / 100;

    return { afaInvoices, gwgInvoices, afaGesamtNetto, gwgGesamtNetto, afaJahresAbschreibung, afaItems };
  }, [invoices, yearInvoices, selectedYear, steuerregelung]);

  // ── Steuerlicher Gewinn ──
  // Kommt aus derselben Funktion wie der Steuerbericht. Vorher rechnete das
  // Dashboard hier eine eigene Variante: netto auch für Kleinunternehmer,
  // ohne Zahlungsgebühren, mit Privateinlagen in den Einnahmen. Drei Zahlen
  // für denselben Gewinn – und die Krankenkassenseite hatte noch eine vierte.
  const profil: SteuerProfil = useMemo(() => ({
    steuerregelung,
    kmPauschale,
    fahrzeugImBetriebsvermoegen,
  }), [steuerregelung, kmPauschale, fahrzeugImBetriebsvermoegen]);

  const afaJahresbetrag = afaData.afaJahresAbschreibung;

  const euer = useMemo(
    () => berechneEuer({
      invoices,
      jahr: selectedYear,
      profil,
      dienstKm: fahrtStats.kmDienst,
      afaJahresbetrag,
      reiseTageVoll,
      reiseTageTeil,
    }),
    [invoices, selectedYear, profil, fahrtStats.kmDienst, afaJahresbetrag, reiseTageVoll, reiseTageTeil],
  );

  const betriebsergebnisNachAfa = euer.gewinn;

  const sonderausgabenGedeckelt = useMemo(
    () => begrenzeSonderausgaben(euer.sonderausgabenRoh, selectedYear, {
      selbstaendig: rechtsform !== 'angestellt',
      gesamtbetragDerEinkuenfte: euer.gewinn,
    }),
    [euer.sonderausgabenRoh, euer.gewinn, selectedYear, rechtsform],
  );

  const ruecklage = useMemo(
    () => steuerRuecklage({
      jahr: selectedYear,
      gewinn: euer.gewinn,
      sonderausgaben: sonderausgabenGedeckelt.abziehbar,
      grundfreibetragManuell,
      zusammenveranlagt: verheiratet,
      kirchensteuerSatz,
      gewerblich: rechtsform === 'gewerbetreibend',
      gewerbesteuerHebesatz,
    }),
    [selectedYear, euer.gewinn, sonderausgabenGedeckelt.abziehbar, grundfreibetragManuell, verheiratet, kirchensteuerSatz, rechtsform, gewerbesteuerHebesatz],
  );

  const kuStatus = useMemo(
    () => kleinunternehmerStatus(invoices, selectedYear),
    [invoices, selectedYear],
  );

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

  // ── Stille Reserven (Restwert aller AfA-Anlagen) ─────────────────────────
  const stilleReserven = useMemo(
    () =>
      afaData.afaItems
        .filter((item) => item.nutzungsdauer > 1 && item.proRata)
        .reduce((sum, item) => sum + (item.proRata?.restwertEndeJahr ?? 0), 0),
    [afaData.afaItems],
  );

  // ── Top-Kunde (Klumpenrisiko) ─────────────────────────────────────────────
  const topKunde = useMemo(() => {
    if (einnahmen === 0) return null;
    const map = new Map<string, number>();
    for (const inv of yearInvoices.filter((i) => i.type === 'einnahme')) {
      map.set(inv.partner, (map.get(inv.partner) ?? 0) + inv.brutto);
    }
    if (map.size === 0) return null;
    const [partner, betrag] = [...map.entries()].reduce((a, b) => (b[1] > a[1] ? b : a));
    return { partner, betrag, anteil: (betrag / einnahmen) * 100 };
  }, [yearInvoices, einnahmen]);

  // ── MRC – Monthly Recurring Costs ────────────────────────────────────────
  const mrc = useMemo(() => {
    if (loading) return 0;
    const patterns = detectPatterns(invoices);
    return patterns
      .filter((p) => p.type === 'ausgabe' && p.interval === 'monthly')
      .reduce((s, p) => s + p.avgBrutto, 0);
  }, [invoices, loading]);

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
    betriebsergebnisNachAfa,
    euer,
    ruecklage,
    kuStatus,
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
    ...afaData,
    stilleReserven,
    topKunde,
    mrc,
    fahrtKmDienst: fahrtStats.kmDienst,
    fahrtKmPrivat: fahrtStats.kmPrivat,
    fahrtKmGesamt: fahrtStats.kmGesamt,
    // Aus der EÜR, nicht roh aus dem Fahrtenbuch: Gehört das Fahrzeug zum
    // Betriebsvermögen, gibt es keine Kilometerpauschale, sondern die
    // tatsächlichen Kosten.
    fahrtAbsetzbar: euer.kmPauschaleBetrag,
    fahrtAnzahl: fahrtStats.fahrten.length,
    fahrtFahrten: fahrtStats.fahrten,
    fahrtKmDienstMonat: fahrtMonat.kmDienst,
    fahrtKmPrivatMonat: fahrtMonat.kmPrivat,
    fahrtKmGesamtMonat: fahrtMonat.kmGesamt,
    fahrtAbsetzbarMonat: fahrzeugImBetriebsvermoegen ? 0 : fahrtMonat.absetzbar,
    fahrtAnzahlMonat: fahrtMonat.fahrten.length,
    fahrtFahrtenMonat: fahrtMonat.fahrten,
  };
}

