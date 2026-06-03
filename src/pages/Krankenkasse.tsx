import { useState, useEffect, useMemo } from 'react';
import { krankenkasse, getAllInvoices, type KKSatz } from '@/lib/db';
import { SONDERAUSGABEN_CATEGORIES, PRIVAT_CATEGORIES } from '@/types';
import { useAppStore } from '@/store';
import { fmtCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  HeartPulse, Plus, Pencil, Trash2,
  ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Minus, Info,
} from 'lucide-react';

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

/**
 * Ausgaben-Kategorien, die den Gewinn NICHT mindern (Sonderausgaben + Privat).
 * KK-Beiträge sind Sonderausgaben → kein Betriebsausgaben-Abzug.
 */
const NICHT_BETRIEBSAUSGABEN = new Set<string>([
  ...SONDERAUSGABEN_CATEGORIES,
  ...PRIVAT_CATEGORIES,
]);

/** Aktueller Monat als "YYYY-MM" */
function getCurrentMonat(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Gibt den zuletzt gültigen Beitragssatz für einen Monat zurück. */
function getSatzForMonat(monat: string, saetze: KKSatz[]): KKSatz | null {
  const monthStart = `${monat}-01`;
  const applicable = [...saetze]
    .filter((s) => s.gueltig_ab <= monthStart)
    .sort((a, b) => b.gueltig_ab.localeCompare(a.gueltig_ab));
  return applicable[0] ?? null;
}

/** Berechnet den Soll-Beitrag aus Satz + explizitem Einkommen. */
function calcSollFromEinkommen(
  satz: KKSatz,
  einkommen: number,
): { kv: number; pv: number; gesamt: number } {
  const kv = (einkommen * (satz.kv_grundbeitrag_prozent + satz.kv_zusatzbeitrag_prozent)) / 100;
  const pv = (einkommen * satz.pv_prozent) / 100;
  return {
    kv: Math.round(kv * 100) / 100,
    pv: Math.round(pv * 100) / 100,
    gesamt: Math.round((kv + pv) * 100) / 100,
  };
}

interface MonthData {
  monat: string;
  monthName: string;
  satz: KKSatz | null;
  gewinn: number;
  istPrognose: boolean;
  /** Soll auf Basis des echten Gewinns (was KK am Jahresende berechnen wird) */
  soll: { kv: number; pv: number; gesamt: number };
  /** Vorläufiger Monatsbeitrag auf Basis des konfigurierten Prognose-Einkommens */
  sollVorlaeufig: { kv: number; pv: number; gesamt: number };
  /** Differenz: vorläufig − echt (positiv = Rückerstattung, negativ = Nachzahlung) */
  differenz: number;
}

function buildMonthData(
  year: number,
  saetze: KKSatz[],
  monthlyGewinn: Record<string, number>,
): MonthData[] {
  const currentMonat = getCurrentMonat();

  return Array.from({ length: 12 }, (_, i) => {
    const monat = `${year}-${String(i + 1).padStart(2, '0')}`;
    const satz = getSatzForMonat(monat, saetze);
    const istPrognose = monat > currentMonat;

    const gewinn = istPrognose
      ? (satz?.bemessungsgrundlage_monat ?? 0)
      : (monthlyGewinn[monat] ?? 0);

    const soll = satz
      ? calcSollFromEinkommen(satz, gewinn)
      : { kv: 0, pv: 0, gesamt: 0 };

    const sollVorlaeufig = satz && !istPrognose
      ? calcSollFromEinkommen(satz, satz.bemessungsgrundlage_monat)
      : soll;

    return {
      monat,
      monthName: MONTH_NAMES[i],
      satz,
      gewinn,
      istPrognose,
      soll,
      sollVorlaeufig,
      differenz: Math.round((sollVorlaeufig.gesamt - soll.gesamt) * 100) / 100,
    };
  });
}

// ─── Formular-State-Typen ────────────────────────────────────────────────────

interface SatzFormData {
  gueltig_ab: string;
  kv_grundbeitrag_prozent: string;
  kv_zusatzbeitrag_prozent: string;
  pv_prozent: string;
  bemessungsgrundlage_monat: string;
  notiz: string;
}


const DEFAULT_SATZ_FORM: SatzFormData = {
  gueltig_ab: '',
  kv_grundbeitrag_prozent: '14.0',
  kv_zusatzbeitrag_prozent: '3.65',
  pv_prozent: '3.6',
  bemessungsgrundlage_monat: '2000',
  notiz: '',
};

// ─── Seitenkomponente ────────────────────────────────────────────────────────

export default function KrankenkassePage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [saetze, setSaetze] = useState<KKSatz[]>([]);
  const [monthlyGewinn, setMonthlyGewinn] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const privacyMode = useAppStore((s) => s.privacyMode);

  // Satz-Dialog
  const [satzDialog, setSatzDialog] = useState<{ open: boolean; editing?: KKSatz }>({ open: false });
  const [satzForm, setSatzForm] = useState<SatzFormData>(DEFAULT_SATZ_FORM);

  // Lösch-Bestätigung
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id?: string }>({ open: false });

  // ── Datenladen ────────────────────────────────────────────────────────────

  async function load() {
    setLoading(true);
    try {
      const [s, allInvoices] = await Promise.all([
        krankenkasse.getAllSaetze(),
        getAllInvoices(),
      ]);

      // Monatlicher Gewinn = Einnahmen − Betriebsausgaben (ohne Sonderausgaben/Privat)
      const einnahmen: Record<string, number> = {};
      const ausgaben: Record<string, number> = {};
      for (const inv of allInvoices) {
        if (inv.year !== year) continue;
        const monat = `${inv.year}-${String(inv.month).padStart(2, '0')}`;
        if (inv.type === 'einnahme') {
          einnahmen[monat] = Math.round(((einnahmen[monat] ?? 0) + inv.netto) * 100) / 100;
        } else if (inv.type === 'ausgabe' && !NICHT_BETRIEBSAUSGABEN.has(inv.category)) {
          ausgaben[monat] = Math.round(((ausgaben[monat] ?? 0) + inv.netto) * 100) / 100;
        }
      }
      const gewinn: Record<string, number> = {};
      const allMonats = new Set([...Object.keys(einnahmen), ...Object.keys(ausgaben)]);
      for (const monat of allMonats) {
        gewinn[monat] = Math.round(((einnahmen[monat] ?? 0) - (ausgaben[monat] ?? 0)) * 100) / 100;
      }

      setSaetze(s);
      setMonthlyGewinn(gewinn);
    } catch (e) {
      toast.error('Fehler beim Laden: ' + String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Berechnungen ──────────────────────────────────────────────────────────

  const monthData = useMemo(
    () => buildMonthData(year, saetze, monthlyGewinn),
    [year, saetze, monthlyGewinn],
  );

  const summary = useMemo(() => {
    const vergangene = monthData.filter((m) => !m.istPrognose);
    const sollEcht    = vergangene.reduce((s, m) => s + m.soll.gesamt, 0);
    const sollVorl    = vergangene.reduce((s, m) => s + m.sollVorlaeufig.gesamt, 0);
    const differenz   = Math.round((sollVorl - sollEcht) * 100) / 100;
    const sollGesamt  = monthData.reduce((s, m) => s + m.soll.gesamt, 0);
    return {
      sollEcht:        Math.round(sollEcht * 100) / 100,
      sollVorl:        Math.round(sollVorl * 100) / 100,
      differenz,
      sollGesamt:      Math.round(sollGesamt * 100) / 100,
      anzahlVergangen: vergangene.length,
      anzahlPrognose:  monthData.filter((m) => m.istPrognose).length,
    };
  }, [monthData]);

  /** Vorschau-Berechnung im Satz-Formular */
  const satzPreview = useMemo(() => {
    const einkommen = parseFloat(satzForm.bemessungsgrundlage_monat) || 0;
    const kvGrund = parseFloat(satzForm.kv_grundbeitrag_prozent) || 0;
    const kvZusatz = parseFloat(satzForm.kv_zusatzbeitrag_prozent) || 0;
    const pv = parseFloat(satzForm.pv_prozent) || 0;
    const kv = (einkommen * (kvGrund + kvZusatz)) / 100;
    const pvBetrag = (einkommen * pv) / 100;
    return {
      kv: Math.round(kv * 100) / 100,
      pv: Math.round(pvBetrag * 100) / 100,
      gesamt: Math.round((kv + pvBetrag) * 100) / 100,
    };
  }, [satzForm]);

  // ── Satz CRUD ─────────────────────────────────────────────────────────────

  function openNewSatz() {
    setSatzForm({ ...DEFAULT_SATZ_FORM, gueltig_ab: `${year}-01-01` });
    setSatzDialog({ open: true });
  }

  function openEditSatz(satz: KKSatz) {
    setSatzForm({
      gueltig_ab: satz.gueltig_ab,
      kv_grundbeitrag_prozent: String(satz.kv_grundbeitrag_prozent),
      kv_zusatzbeitrag_prozent: String(satz.kv_zusatzbeitrag_prozent),
      pv_prozent: String(satz.pv_prozent),
      bemessungsgrundlage_monat: String(satz.bemessungsgrundlage_monat),
      notiz: satz.notiz,
    });
    setSatzDialog({ open: true, editing: satz });
  }

  async function saveSatz() {
    if (!satzForm.gueltig_ab) { toast.error('Bitte ein Gültigkeitsdatum angeben.'); return; }
    try {
      const data = {
        gueltig_ab: satzForm.gueltig_ab,
        kv_grundbeitrag_prozent: parseFloat(satzForm.kv_grundbeitrag_prozent) || 0,
        kv_zusatzbeitrag_prozent: parseFloat(satzForm.kv_zusatzbeitrag_prozent) || 0,
        pv_prozent: parseFloat(satzForm.pv_prozent) || 0,
        bemessungsgrundlage_monat: parseFloat(satzForm.bemessungsgrundlage_monat) || 0,
        notiz: satzForm.notiz,
      };
      if (satzDialog.editing) {
        await krankenkasse.updateSatz(satzDialog.editing.id, data);
        toast.success('Beitragssatz aktualisiert');
      } else {
        await krankenkasse.saveSatz(data);
        toast.success('Beitragssatz hinzugefügt');
      }
      setSatzDialog({ open: false });
      load();
    } catch (e) { toast.error('Fehler beim Speichern: ' + String(e)); }
  }

  async function confirmDeleteSatz() {
    if (!deleteConfirm.id) return;
    try {
      await krankenkasse.deleteSatz(deleteConfirm.id);
      toast.success('Beitragssatz gelöscht');
      setDeleteConfirm({ open: false });
      load();
    } catch (e) { toast.error('Fehler beim Löschen: ' + String(e)); }
  }

  // ── Hilfsfunktionen ───────────────────────────────────────────────────────

  function fmt(value: number) { return fmtCurrency(value, privacyMode); }
  function fmtProzent(value: number) {
    return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '\u00a0%';
  }
  const diffColor = (diff: number) => {
    if (diff > 0.005) return 'text-green-600 dark:text-green-400';
    if (diff < -0.005) return 'text-destructive';
    return 'text-muted-foreground';
  };

  // ── Rendering ─────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2">
            <HeartPulse className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Kranken- &amp; Pflegeversicherung</h1>
            <p className="text-sm text-muted-foreground">
              Soll wird aus deinen echten Einnahmen berechnet · Prognose für zukünftige Monate
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="icon" onClick={() => setYear((y) => y - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-semibold w-14 text-center tabular-nums">{year}</span>
          <Button variant="outline" size="icon" onClick={() => setYear((y) => y + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── KPI-Karten ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-normal uppercase tracking-wide">
                Soll auf Basis echter Einnahmen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{fmt(summary.sollEcht)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.anzahlVergangen} Monate · Gewinn × Beitragssatz
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-normal uppercase tracking-wide">
                Vorläufig abgebucht
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{fmt(summary.sollVorl)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Monatliche KK-Lastschriften (Prognose-Betrag)
              </p>
            </CardContent>
          </Card>

          <Card
            className={
              summary.differenz > 0.005
                ? 'border-green-500/40'
                : summary.differenz < -0.005
                  ? 'border-destructive/40'
                  : ''
            }
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-normal uppercase tracking-wide flex items-center gap-1.5">
                {summary.differenz > 0.005 ? (
                  <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                ) : summary.differenz < -0.005 ? (
                  <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                ) : (
                  <Minus className="h-3.5 w-3.5" />
                )}
                {summary.differenz >= 0 ? 'Voraussichtl. Rückerstattung' : 'Voraussichtl. Nachzahlung'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold tabular-nums ${diffColor(summary.differenz)}`}>
                {summary.differenz > 0 ? '+' : ''}{fmt(summary.differenz)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.anzahlPrognose > 0
                  ? `Noch ${summary.anzahlPrognose} Monate offen`
                  : 'Alle Monate erfasst'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Hinweis: Datenbasis */}
      {!loading && summary.anzahlVergangen > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Der <strong className="text-foreground">Soll-Beitrag (echt)</strong> basiert auf
            deinem monatlichen <strong className="text-foreground">Gewinn</strong> aus dem
            Rechnungs-Manager: Einnahmen − Betriebsausgaben (ohne Sonderausgaben wie KV/PV/Spenden
            und ohne Privatausgaben). Die Spalte{' '}
            <strong className="text-foreground">„Vorläufig abgebucht"</strong> zeigt, was die KK
            monatlich tatsächlich einzieht (Prognose-Einkommen × Satz). Die{' '}
            <strong className="text-foreground">Differenz</strong> ist deine voraussichtliche
            Nachzahlung oder Rückerstattung am Jahresende.
          </span>
        </div>
      )}

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="uebersicht">
        <TabsList>
          <TabsTrigger value="uebersicht">Monatsübersicht {year}</TabsTrigger>
          <TabsTrigger value="saetze">Beitragssätze</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Monatsübersicht ──────────────────────────────────────── */}
        <TabsContent value="uebersicht">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Monatliche Beiträge – Gewinn · Soll (echt) · Vorläufig abgebucht · Differenz
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-44">Monat</TableHead>
                      <TableHead className="text-right">Gewinn / Basis</TableHead>
                      <TableHead className="text-right font-semibold border-r border-border">
                        Soll (echt)
                      </TableHead>
                      <TableHead className="text-right border-r border-border">
                        Vorläufig abgebucht
                      </TableHead>
                      <TableHead className="text-right">Differenz</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthData.map((m) => (
                      <TableRow
                        key={m.monat}
                        className={m.istPrognose ? 'opacity-60' : ''}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span>{m.monthName}</span>
                            {m.istPrognose && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 font-normal">
                                Prognose
                              </Badge>
                            )}
                          </div>
                          {m.satz ? (
                            <div className="text-xs text-muted-foreground">
                              {fmtProzent(
                                m.satz.kv_grundbeitrag_prozent +
                                m.satz.kv_zusatzbeitrag_prozent +
                                m.satz.pv_prozent,
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-amber-500 dark:text-amber-400">
                              Kein Satz hinterlegt
                            </div>
                          )}
                        </TableCell>

                        {/* Gewinn */}
                        <TableCell className="text-right tabular-nums">
                          {m.satz ? (
                            <span className={m.istPrognose ? 'text-muted-foreground italic' : ''}>
                              {fmt(m.gewinn)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </TableCell>

                        {/* Soll echt */}
                        <TableCell className="text-right font-semibold tabular-nums border-r border-border">
                          {m.soll.gesamt > 0
                            ? fmt(m.soll.gesamt)
                            : <span className="text-muted-foreground font-normal">–</span>}
                        </TableCell>

                        {/* Vorläufig abgebucht */}
                        <TableCell className="text-right tabular-nums text-muted-foreground border-r border-border">
                          {!m.istPrognose && m.sollVorlaeufig.gesamt > 0
                            ? fmt(m.sollVorlaeufig.gesamt)
                            : <span>–</span>}
                        </TableCell>

                        {/* Differenz */}
                        <TableCell className="text-right tabular-nums">
                          {m.soll.gesamt > 0 && !m.istPrognose ? (
                            <span className={`font-medium ${diffColor(m.differenz)}`}>
                              {m.differenz > 0.005 ? '+' : ''}{fmt(m.differenz)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}

                    {/* Summenzeile */}
                    <TableRow className="bg-muted/30 font-semibold border-t-2 border-border">
                      <TableCell className="py-3">
                        <div>Gesamt {year}</div>
                        <div className="text-xs font-normal text-muted-foreground">
                          {summary.anzahlVergangen} echte / {summary.anzahlPrognose} Prognose
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmt(monthData.filter(m => !m.istPrognose).reduce((s, m) => s + m.gewinn, 0))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums border-r border-border">
                        {fmt(summary.sollEcht)}
                        {summary.anzahlPrognose > 0 && (
                          <div className="text-xs font-normal text-muted-foreground">
                            +{fmt(summary.sollGesamt - summary.sollEcht)} Progn.
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums border-r border-border text-muted-foreground">
                        {fmt(monthData.filter(m => !m.istPrognose).reduce((s, m) => s + m.sollVorlaeufig.gesamt, 0))}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums ${diffColor(summary.differenz)}`}>
                        {summary.differenz > 0.005 ? '+' : ''}{fmt(summary.differenz)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2: Beitragssätze ────────────────────────────────────────── */}
        <TabsContent value="saetze">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">Beitragssätze</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Das Prognose-Einkommen wird nur für zukünftige Monate verwendet. Vergangene Monate nutzen deine echten Einnahmen.
                </p>
              </div>
              <Button size="sm" onClick={openNewSatz}>
                <Plus className="h-4 w-4 mr-1" />
                Neuer Satz
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-2">
                  {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}
                </div>
              ) : saetze.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <HeartPulse className="h-12 w-12 mx-auto text-muted-foreground/30" />
                  <p className="text-muted-foreground">Noch keine Beitragssätze hinterlegt.</p>
                  <Button variant="outline" size="sm" onClick={openNewSatz}>
                    <Plus className="h-4 w-4 mr-1" />
                    Ersten Satz hinzufügen
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Gültig ab</TableHead>
                      <TableHead className="text-right">Prognose-Einkommen</TableHead>
                      <TableHead className="text-right">KV Grundbeitrag</TableHead>
                      <TableHead className="text-right">KV Zusatzbeitrag</TableHead>
                      <TableHead className="text-right">Pflegeversicherung</TableHead>
                      <TableHead className="text-right">Gesamtsatz</TableHead>
                      <TableHead>Notiz</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {saetze.map((s) => {
                      const gesamtProzent =
                        s.kv_grundbeitrag_prozent + s.kv_zusatzbeitrag_prozent + s.pv_prozent;
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-mono text-sm">
                            {new Date(s.gueltig_ab + 'T00:00:00').toLocaleDateString('de-DE')}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground italic">
                            {fmt(s.bemessungsgrundlage_monat)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtProzent(s.kv_grundbeitrag_prozent)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtProzent(s.kv_zusatzbeitrag_prozent)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtProzent(s.pv_prozent)}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {fmtProzent(gesamtProzent)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm max-w-[160px] truncate">
                            {s.notiz || '–'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditSatz(s)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteConfirm({ open: true, id: s.id })}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Dialog: Beitragssatz anlegen / bearbeiten ────────────────────── */}
      <Dialog open={satzDialog.open} onOpenChange={(o) => !o && setSatzDialog({ open: false })}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {satzDialog.editing ? 'Beitragssatz bearbeiten' : 'Neuen Beitragssatz hinzufügen'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Gültig ab</Label>
                <Input
                  type="date"
                  value={satzForm.gueltig_ab}
                  onChange={(e) => setSatzForm((f) => ({ ...f, gueltig_ab: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>
                  Prognose-Einkommen / Monat (€)
                  <span className="ml-1 font-normal text-muted-foreground">
                    – nur für zukünftige Monate
                  </span>
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={satzForm.bemessungsgrundlage_monat}
                  onChange={(e) =>
                    setSatzForm((f) => ({ ...f, bemessungsgrundlage_monat: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Für vergangene Monate werden automatisch deine echten Einnahmen verwendet.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>KV Grundbeitrag %</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={satzForm.kv_grundbeitrag_prozent}
                  onChange={(e) => setSatzForm((f) => ({ ...f, kv_grundbeitrag_prozent: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>KV Zusatzbeitrag %</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={satzForm.kv_zusatzbeitrag_prozent}
                  onChange={(e) => setSatzForm((f) => ({ ...f, kv_zusatzbeitrag_prozent: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Pflegeversicherung %</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={satzForm.pv_prozent}
                  onChange={(e) => setSatzForm((f) => ({ ...f, pv_prozent: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Notiz (optional)</Label>
                <Input
                  value={satzForm.notiz}
                  onChange={(e) => setSatzForm((f) => ({ ...f, notiz: e.target.value }))}
                  placeholder="z. B. Beitragsbescheid 2026"
                />
              </div>
            </div>
            {/* Live-Vorschau */}
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Vorschau mit Prognose-Einkommen (Zukunftsmonate)
              </p>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">KV</p>
                  <p className="font-semibold tabular-nums">
                    {satzPreview.kv.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">PV</p>
                  <p className="font-semibold tabular-nums">
                    {satzPreview.pv.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gesamt / Monat</p>
                  <p className="font-bold text-primary tabular-nums">
                    {satzPreview.gesamt.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSatzDialog({ open: false })}>Abbrechen</Button>
            <Button onClick={saveSatz}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AlertDialog: Satz löschen ────────────────────────────────────── */}
      <AlertDialog open={deleteConfirm.open} onOpenChange={(o) => !o && setDeleteConfirm({ open: false })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Beitragssatz löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieser Beitragssatz wird unwiderruflich gelöscht. Monate, für die er als
              Berechnungsgrundlage dient, zeigen danach keinen Soll-Betrag mehr an.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteSatz}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}





























