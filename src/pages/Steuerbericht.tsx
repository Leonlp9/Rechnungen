import { useEffect, useState, useMemo } from 'react';
import { getAllInvoices } from '@/lib/db';
import type { Invoice } from '@/types';
import { CATEGORY_LABELS, SONDERAUSGABEN_CATEGORIES } from '@/types';
import { useAppStore } from '@/store';
import { fmtCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FileText, TrendingUp, TrendingDown, Download, Calculator, PiggyBank, Receipt, Info } from 'lucide-react';
import { exportToDatev, exportToXlsx } from '@/lib/export';
import {
  berechneAfaOptionen, empfohlenAfaMethode, guessAssetType,
  berechneProRataAfa, getNutzungsdauer, NUTZUNGSDAUER_LABELS,
} from '@/lib/afa';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

// Betriebsausgaben-Kategorien (absetzbar), ohne AfA (die separat behandelt wird)
const BETRIEBSAUSGABEN_CATS_OHNE_AFA = [
  'gwg', 'buerobedarf', 'fahrzeugkosten', 'fremdleistungen',
  'marketing', 'miete', 'reisekosten', 'bewirtungskosten', 'software_abos',
  'kommunikation', 'versicherungen_betrieb', 'weiterbildung', 'sonstiges',
];
const BETRIEBSAUSGABEN_CATS = [...BETRIEBSAUSGABEN_CATS_OHNE_AFA, 'anlagevermoegen_afa'];

interface AfaItem {
  invoice: Invoice;
  assetType: string;
  jahresAfa: number;
  nutzungsdauer: number;
  methode: string;
  kaufPreis: number;
}

function berechneAfaItems(invoices: Invoice[], year: number): AfaItem[] {
  return invoices
    .filter((i) => i.category === 'anlagevermoegen_afa')
    .map((inv) => {
      const assetType = guessAssetType(inv.description, inv.partner);
      const optionen = berechneAfaOptionen(inv.netto, assetType);
      const empf = empfohlenAfaMethode(inv.netto);
      const empfOption = optionen.find((o) => o.methode === empf);
      const nutzungsdauer = empfOption?.nutzungsdauer ?? getNutzungsdauer(assetType);

      let jahresAfa: number;
      if (nutzungsdauer <= 1) {
        const kaufJahr = new Date(inv.date).getFullYear();
        jahresAfa = kaufJahr === year ? inv.netto : 0;
      } else {
        const proRata = berechneProRataAfa(inv.netto, inv.date, nutzungsdauer, year);
        jahresAfa = proRata.afaBetragImJahr;
      }

      return {
        invoice: inv,
        assetType,
        jahresAfa,
        nutzungsdauer,
        methode: empfOption?.label ?? 'Lineare AfA',
        kaufPreis: inv.netto,
      };
    });
}

export default function SteuerbrichtPage() {
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const selectedYear = useAppStore((s) => s.selectedYear);
  const setSelectedYear = useAppStore((s) => s.setSelectedYear);
  const privacyMode = useAppStore((s) => s.privacyMode);
  const steuerregelung = useAppStore((s) => s.steuerregelung);
  const grundfreibetrag = useAppStore((s) => s.grundfreibetrag);

  useEffect(() => {
    getAllInvoices()
      .then(setAllInvoices)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const invoices = useMemo(
    () => allInvoices.filter((i) => i.year === selectedYear && i.type !== 'info'),
    [allInvoices, selectedYear]
  );

  const years = useMemo(() => {
    const ys = [...new Set(allInvoices.map((i) => i.year))].sort((a, b) => b - a);
    if (!ys.includes(new Date().getFullYear())) ys.unshift(new Date().getFullYear());
    return ys;
  }, [allInvoices]);

  // --- EÜR-Berechnungen ---
  const einnahmen = useMemo(() =>
    invoices.filter((i) => i.type === 'einnahme').reduce((s, i) => s + i.netto, 0), [invoices]);

  // Reguläre Betriebsausgaben (ohne Anlagevermögen/AfA)
  const betriebsausgabenOhneAfa = useMemo(() =>
    invoices
      .filter((i) => i.type === 'ausgabe' && BETRIEBSAUSGABEN_CATS_OHNE_AFA.includes(i.category))
      .reduce((s, i) => s + i.netto, 0), [invoices]);

  // Kaufpreis Anlagevermögen (wie cash-Flow)
  const anlagevermoegen_kaufpreis = useMemo(() =>
    invoices
      .filter((i) => i.type === 'ausgabe' && i.category === 'anlagevermoegen_afa')
      .reduce((s, i) => s + i.netto, 0), [invoices]);

  // AfA-Berechnung
  const afaItems = useMemo(() => {
    // Auch Vorjahres-Anlagen einbeziehen (aus allen Jahren)
    const alleAfaInvoices = allInvoices.filter((i) => i.category === 'anlagevermoegen_afa');
    return berechneAfaItems(alleAfaInvoices, selectedYear);
  }, [allInvoices, selectedYear]);

  const afaJahresgesamt = useMemo(() => afaItems.reduce((s, a) => s + a.jahresAfa, 0), [afaItems]);

  // Steuerliche Betriebsausgaben: reguläre + AfA statt vollem Kaufpreis
  const betriebsausgabenSteuerlich = betriebsausgabenOhneAfa + afaJahresgesamt;
  // Cash-Betriebsausgaben: reguläre + voller Kaufpreis
  const betriebsausgabenCash = betriebsausgabenOhneAfa + anlagevermoegen_kaufpreis;

  const sonderausgaben = useMemo(() =>
    invoices
      .filter((i) => i.type === 'ausgabe' && (SONDERAUSGABEN_CATEGORIES as readonly string[]).includes(i.category))
      .reduce((s, i) => s + i.netto, 0), [invoices]);

  // Steuerlicher Gewinn (EÜR) = Einnahmen - steuerliche Betriebsausgaben
  const gewinnSteuerlich = einnahmen - betriebsausgabenSteuerlich;
  // Cash-Gewinn = Einnahmen - tatsächliche Ausgaben
  const gewinnCash = einnahmen - betriebsausgabenCash;

  const steuerruecklage = Math.max(0, (gewinnSteuerlich - grundfreibetrag) * 0.30);

  const ustEinnahmen = invoices.filter((i) => i.type === 'einnahme').reduce((s, i) => s + (i.ust ?? 0), 0);
  const vorsteuer = invoices.filter((i) => i.type === 'ausgabe').reduce((s, i) => s + (i.ust ?? 0), 0);
  const ustZahllast = ustEinnahmen - vorsteuer;

  // Einnahmen nach Kategorie
  const einnahmenByKat = useMemo(() => {
    const map = new Map<string, number>();
    invoices.filter((i) => i.type === 'einnahme')
      .forEach((i) => map.set(i.category, (map.get(i.category) ?? 0) + i.netto));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [invoices]);

  // Ausgaben nach Kategorie (mit AfA-Hinweis)
  const ausgabenByKat = useMemo(() => {
    const map = new Map<string, number>();
    invoices.filter((i) => i.type === 'ausgabe')
      .forEach((i) => map.set(i.category, (map.get(i.category) ?? 0) + i.netto));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [invoices]);

  // Monatliche Übersicht
  const monthly = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      const mi = invoices.filter((i) => i.month === m + 1);
      const ein = mi.filter((i) => i.type === 'einnahme').reduce((s, i) => s + i.netto, 0);
      const aus = mi.filter((i) => i.type === 'ausgabe').reduce((s, i) => s + i.netto, 0);
      return { label: MONTH_NAMES[m], einnahmen: ein, ausgaben: aus, saldo: ein - aus };
    });
  }, [invoices]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" /> Steuerbericht {selectedYear}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Einnahmen-Überschuss-Rechnung (EÜR) – steuerliche Basis inkl. AfA-Korrektur
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex gap-1">
            {years.slice(0, 5).map((y) => (
              <Button key={y} variant={y === selectedYear ? 'default' : 'outline'} size="sm" onClick={() => setSelectedYear(y)}>{y}</Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={async () => {
            try { await exportToXlsx(invoices, selectedYear); toast.success('Excel-Export erstellt'); }
            catch (e) { toast.error('Export fehlgeschlagen: ' + (e as Error).message); }
          }}>
            <Download className="mr-2 h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={async () => {
            try { await exportToDatev(invoices, selectedYear); toast.success('DATEV-Export erstellt'); }
            catch (e) { toast.error('Export fehlgeschlagen: ' + (e as Error).message); }
          }}>
            <Download className="mr-2 h-4 w-4" /> DATEV
          </Button>
        </div>
      </div>

      {/* Haupt-KPIs: EÜR (steuerlich) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><TrendingUp className="h-3.5 w-3.5 text-green-600" /> Betriebseinnahmen (Netto)</div>
            <p className="text-xl font-bold text-green-600">{fmtCurrency(einnahmen, privacyMode)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <TrendingDown className="h-3.5 w-3.5 text-red-600" /> Betriebsausgaben (steuerlich)
              <Tooltip>
                <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent className="max-w-xs">Inkl. zeitanteiliger AfA statt vollem Kaufpreis. Reguläre Ausgaben: {fmtCurrency(betriebsausgabenOhneAfa, privacyMode)} + Jahres-AfA: {fmtCurrency(afaJahresgesamt, privacyMode)}</TooltipContent>
              </Tooltip>
            </div>
            <p className="text-xl font-bold text-red-600">{fmtCurrency(betriebsausgabenSteuerlich, privacyMode)}</p>
            {anlagevermoegen_kaufpreis > 0 && (
              <p className="text-[10px] text-muted-foreground">Cash-Basis: {fmtCurrency(betriebsausgabenCash, privacyMode)}</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-violet-200 dark:border-violet-800">
          <CardContent className="pt-5 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Calculator className="h-3.5 w-3.5 text-violet-600" /> Steuerlicher Gewinn (EÜR)
              <Tooltip>
                <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent className="max-w-xs">Einnahmen minus steuerliche Betriebsausgaben (mit AfA). Dies ist die Basis für die Einkommensteuer. Cash-Gewinn: {fmtCurrency(gewinnCash, privacyMode)}</TooltipContent>
              </Tooltip>
            </div>
            <p className={`text-xl font-bold ${gewinnSteuerlich >= 0 ? 'text-violet-600' : 'text-red-600'}`}>{fmtCurrency(gewinnSteuerlich, privacyMode)}</p>
            {anlagevermoegen_kaufpreis > 0 && (
              <p className="text-[10px] text-muted-foreground">AfA-Differenz: +{fmtCurrency(anlagevermoegen_kaufpreis - afaJahresgesamt, privacyMode)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><PiggyBank className="h-3.5 w-3.5 text-amber-500" /> Steuerrücklage (30 %)</div>
            <p className="text-xl font-bold text-amber-600">{fmtCurrency(steuerruecklage, privacyMode)}</p>
            <p className="text-[10px] text-muted-foreground">nach GFB {fmtCurrency(grundfreibetrag, privacyMode)}</p>
          </CardContent>
        </Card>
      </div>

      {/* AfA-Übersicht */}
      {afaItems.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calculator className="h-4 w-4 text-violet-600" /> AfA-Plan {selectedYear}
              <Badge variant="outline" className="text-[10px]">
                Jahres-AfA gesamt: {fmtCurrency(afaJahresgesamt, privacyMode)}
              </Badge>
              {anlagevermoegen_kaufpreis > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  Kaufpreise: {fmtCurrency(anlagevermoegen_kaufpreis, privacyMode)} → nur {fmtCurrency(afaJahresgesamt, privacyMode)} steuerlich absetzbar
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Wirtschaftsgut</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead className="text-right">Kaufpreis</TableHead>
                  <TableHead>Methode</TableHead>
                  <TableHead className="text-right">ND (Jahre)</TableHead>
                  <TableHead className="text-right">AfA {selectedYear}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {afaItems.map((item) => (
                  <TableRow key={item.invoice.id}>
                    <TableCell className="text-xs">
                      <div className="font-medium">{item.invoice.description || '—'}</div>
                      <div className="text-muted-foreground">{item.invoice.partner} · {item.invoice.date.slice(0, 10)}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {NUTZUNGSDAUER_LABELS[item.assetType] ?? item.assetType}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono">{fmtCurrency(item.kaufPreis, privacyMode)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.methode}</TableCell>
                    <TableCell className="text-right text-xs">{item.nutzungsdauer}</TableCell>
                    <TableCell className="text-right text-xs font-mono font-semibold text-violet-600">
                      {item.jahresAfa > 0 ? fmtCurrency(item.jahresAfa, privacyMode) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground mt-2">
              * Es werden alle Anlagevermögen-Positionen aus allen Jahren berücksichtigt, die noch nicht vollständig abgeschrieben sind.
            </p>
          </CardContent>
        </Card>
      )}

      {/* USt-Zusammenfassung (nur Regelbesteuerung) */}
      {steuerregelung === 'regelbesteuerung' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Receipt className="h-4 w-4" /> Umsatzsteuer-Zusammenfassung
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">USt aus Einnahmen</p>
                <p className="font-semibold text-green-600">{fmtCurrency(ustEinnahmen, privacyMode)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Vorsteuer aus Ausgaben</p>
                <p className="font-semibold text-red-600">{fmtCurrency(vorsteuer, privacyMode)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">USt-Zahllast ans Finanzamt</p>
                <p className={`font-bold ${ustZahllast >= 0 ? 'text-orange-600' : 'text-green-600'}`}>{fmtCurrency(ustZahllast, privacyMode)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Einnahmen nach Kategorie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" /> Einnahmen nach Kategorie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategorie</TableHead>
                  <TableHead className="text-right">Netto</TableHead>
                  <TableHead className="text-right">Anteil</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {einnahmenByKat.map(([cat, betrag]) => (
                  <TableRow key={cat}>
                    <TableCell className="text-xs">{CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat}</TableCell>
                    <TableCell className="text-right text-xs font-mono">{fmtCurrency(betrag, privacyMode)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {einnahmen > 0 ? ((betrag / einnahmen) * 100).toFixed(1) + ' %' : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {einnahmenByKat.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground text-xs py-4">Keine Einnahmen</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Ausgaben nach Kategorie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" /> Ausgaben nach Kategorie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategorie</TableHead>
                  <TableHead className="text-right">Netto (Cash)</TableHead>
                  <TableHead className="text-right">Steuerlich</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ausgabenByKat.map(([cat, betrag]) => {
                  const isAfaCat = cat === 'anlagevermoegen_afa';
                  const isAbsetzbar = BETRIEBSAUSGABEN_CATS.includes(cat) || (SONDERAUSGABEN_CATEGORIES as readonly string[]).includes(cat);
                  // Für AfA: zeige die steuerliche AfA statt dem Kaufpreis
                  const steuerlichBetrag = isAfaCat
                    ? afaJahresgesamt
                    : betrag;
                  return (
                    <TableRow key={cat}>
                      <TableCell className="text-xs">
                        {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat}
                        {isAfaCat && <Badge variant="outline" className="ml-1 text-[9px]">AfA-korrigiert</Badge>}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono text-muted-foreground">{fmtCurrency(betrag, privacyMode)}</TableCell>
                      <TableCell className="text-right text-xs font-mono font-semibold">
                        {isAbsetzbar
                          ? <span className={isAfaCat && steuerlichBetrag !== betrag ? 'text-violet-600' : ''}>{fmtCurrency(steuerlichBetrag, privacyMode)}</span>
                          : <Badge variant="secondary" className="text-[10px]">nicht absetzbar</Badge>
                        }
                      </TableCell>
                    </TableRow>
                  );
                })}
                {ausgabenByKat.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground text-xs py-4">Keine Ausgaben</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Sonderausgaben */}
      {sonderausgaben > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sonderausgaben (privat absetzbar)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">Summe: <span className="font-bold">{fmtCurrency(sonderausgaben, privacyMode)}</span></p>
            <p className="text-xs text-muted-foreground mt-1">Kranken- und Pflegeversicherung, Altersvorsorge, Spenden – werden in der Einkommensteuererklärung (Anlage Vorsorgeaufwand / Sonderausgaben) geltend gemacht.</p>
          </CardContent>
        </Card>
      )}

      {/* Monatliche Übersicht */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Monatliche Übersicht {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Monat</TableHead>
                <TableHead className="text-right">Einnahmen</TableHead>
                <TableHead className="text-right">Ausgaben (Cash)</TableHead>
                <TableHead className="text-right">Saldo (Cash)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthly.map((m) => (
                <TableRow key={m.label}>
                  <TableCell className="text-xs font-medium">{m.label}</TableCell>
                  <TableCell className="text-right text-xs text-green-600 font-mono">{m.einnahmen > 0 ? fmtCurrency(m.einnahmen, privacyMode) : '—'}</TableCell>
                  <TableCell className="text-right text-xs text-red-600 font-mono">{m.ausgaben > 0 ? fmtCurrency(m.ausgaben, privacyMode) : '—'}</TableCell>
                  <TableCell className={`text-right text-xs font-mono font-semibold ${m.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(m.einnahmen > 0 || m.ausgaben > 0) ? fmtCurrency(m.saldo, privacyMode) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-3 pt-3 border-t flex flex-wrap justify-end gap-4 text-sm">
            <span>Einnahmen: <strong className="text-green-600">{fmtCurrency(einnahmen, privacyMode)}</strong></span>
            <span>Ausgaben (Cash): <strong className="text-red-600">{fmtCurrency(betriebsausgabenCash + sonderausgaben, privacyMode)}</strong></span>
            <span>Steuerl. Gewinn: <strong className={gewinnSteuerlich >= 0 ? 'text-violet-600' : 'text-red-600'}>{fmtCurrency(gewinnSteuerlich, privacyMode)}</strong></span>
          </div>
        </CardContent>
      </Card>

      {/* Steuerlicher Hinweis */}
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
        <CardContent className="pt-4">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            ⚠️ <strong>Hinweis:</strong> Diese Auswertung dient nur zur Orientierung und ersetzt keine Steuerberatung. Die AfA-Berechnung basiert auf automatisch erkannten Wirtschaftsgut-Typen und typischen Nutzungsdauern – bitte mit deinem Steuerberater abstimmen. Weitere Korrekturen (Bewirtungskosten-Kürzung 30 %, Privatanteile, tatsächliche Abschreibungsmethode) können erforderlich sein.
          </p>
        </CardContent>
      </Card>
    </div>
    </TooltipProvider>
  );
}
