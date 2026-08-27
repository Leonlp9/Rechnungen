import { useState, useEffect, useMemo } from 'react';
import { krankenkasse, getAllInvoices, fahrtenbuch, type KKSatz } from '@/lib/db';
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

import { berechneEuer, type SteuerProfil } from '@/lib/steuer/gewinn';
import { berechneAnlagegueter, afaJeKategorie } from '@/lib/steuer/anlagen';
import { werteFuer } from '@/lib/steuer/jahreswerte';

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

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

/**
 * Beitrag aus Satz und Einkommen.
 *
 * Vorher war das eine reine Multiplikation, ohne Boden und ohne Decke. Ein
 * Monat mit null Gewinn ergab null Beitrag – tatsächlich zahlt ein freiwillig
 * versicherter Selbständiger auch dann, weil die Kasse mindestens von der
 * Mindestbemessungsgrundlage ausgeht. Nach oben ist bei der
 * Beitragsbemessungsgrenze Schluss.
 */
function calcSollFromEinkommen(
  satz: KKSatz,
  einkommen: number,
  jahr: number,
): { kv: number; pv: number; gesamt: number; bemessung: number; amBoden: boolean; anDerDecke: boolean } {
  const w = werteFuer(jahr);
  const roh = Math.max(0, einkommen);
  const bemessung = Math.min(Math.max(roh, w.kvMindestbemessungMonat), w.kvBemessungsgrenzeMonat);
  const amBoden = roh < w.kvMindestbemessungMonat;
  const anDerDecke = roh > w.kvBemessungsgrenzeMonat;

  const kv = (bemessung * (satz.kv_grundbeitrag_prozent + satz.kv_zusatzbeitrag_prozent)) / 100;
  const pv = (bemessung * satz.pv_prozent) / 100;
  return {
    kv: Math.round(kv * 100) / 100,
    pv: Math.round(pv * 100) / 100,
    gesamt: Math.round((kv + pv) * 100) / 100,
    bemessung: Math.round(bemessung * 100) / 100,
    amBoden,
    anDerDecke,
  };
}

interface MonthData {
  monat: string;
  monthName: string;
  satz: KKSatz | null;
  gewinn: number;
  istPrognose: boolean;
  /** Soll auf Basis des echten Gewinns (was KK am Jahresende berechnen wird) */
  soll: ReturnType<typeof calcSollFromEinkommen>;
  /** Vorläufiger Monatsbeitrag auf Basis des konfigurierten Prognose-Einkommens */
  sollVorlaeufig: ReturnType<typeof calcSollFromEinkommen>;
  /** Differenz: vorläufig − echt (positiv = Rückerstattung, negativ = Nachzahlung) */
  differenz: number;
}

function buildMonthData(
  year: number,
  saetze: KKSatz[],
  monthlyGewinn: Record<string, number>,
  jahresGewinn: number,
): MonthData[] {
  const currentMonat = getCurrentMonat();

  // Die Kasse bemisst den Beitrag nicht am Gewinn des einzelnen Monats,
  // sondern am Jahresergebnis des Einkommensteuerbescheids, gleichmäßig auf
  // zwölf Monate verteilt. Ein starker März erhöht den Märzbeitrag also nicht.
  const bemessungProMonat = jahresGewinn / 12;

  return Array.from({ length: 12 }, (_, i) => {
    const monat = `${year}-${String(i + 1).padStart(2, '0')}`;
    const satz = getSatzForMonat(monat, saetze);
    const istPrognose = monat > currentMonat;

    // Was in diesem Monat tatsächlich verdient wurde – nur zur Einordnung.
    const gewinn = monthlyGewinn[monat] ?? 0;
    const bemessung = istPrognose && jahresGewinn === 0
      ? (satz?.bemessungsgrundlage_monat ?? 0)
      : bemessungProMonat;

    const leer = { kv: 0, pv: 0, gesamt: 0, bemessung: 0, amBoden: false, anDerDecke: false };
    const soll = satz
      ? calcSollFromEinkommen(satz, bemessung, year)
      : leer;

    const sollVorlaeufig = satz && !istPrognose
      ? calcSollFromEinkommen(satz, satz.bemessungsgrundlage_monat, year)
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


/**
 * Vorbelegung eines neuen Satzes.
 *
 * Vorher standen hier feste Zahlen (14,0 / 3,65 / 3,6), die niemand mehr
 * nachgezogen hat. Jetzt kommen sie aus der Jahrestabelle und richten sich
 * nach dem Profil: Der Grundbeitrag hängt davon ab, ob Krankengeld versichert
 * ist, der Pflegesatz davon, ob Kinder da sind. Der Zusatzbeitrag ist der
 * Durchschnitt – den legt jede Kasse selbst fest und muss überschrieben werden.
 */
function defaultSatzForm(jahr: number): SatzFormData {
  const w = werteFuer(jahr);
  const st = useAppStore.getState();
  return {
    gueltig_ab: '',
    kv_grundbeitrag_prozent: String(st.kvKrankengeld ? w.kvSatzAllgemein : w.kvSatzErmaessigt),
    kv_zusatzbeitrag_prozent: String(w.kvZusatzbeitragDurchschnitt),
    pv_prozent: String(st.kinder > 0 ? w.pvSatz : w.pvSatzKinderlos),
    bemessungsgrundlage_monat: String(w.kvMindestbemessungMonat.toFixed(2)),
    notiz: '',
  };
}

// ─── Seitenkomponente ────────────────────────────────────────────────────────

export default function KrankenkassePage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [saetze, setSaetze] = useState<KKSatz[]>([]);
  const [monthlyGewinn, setMonthlyGewinn] = useState<Record<string, number>>({});
  const [jahresGewinn, setJahresGewinn] = useState(0);
  const [loading, setLoading] = useState(true);
  const privacyMode = useAppStore((s) => s.privacyMode);

  // Satz-Dialog
  const [satzDialog, setSatzDialog] = useState<{ open: boolean; editing?: KKSatz }>({ open: false });
  const [satzForm, setSatzForm] = useState<SatzFormData>(() => defaultSatzForm(new Date().getFullYear()));

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

      // Der Beitrag bemisst sich am steuerlichen Gewinn aus dem
      // Einkommensteuerbescheid. Deshalb dieselbe Rechnung wie im
      // Steuerbericht – vorher rechnete diese Seite ihre eigene Variante ohne
      // Abschreibung, sodass ein Anlagenkauf den Gewinn hier zu stark drückte,
      // und beim Kleinunternehmer netto statt brutto.
      const st = useAppStore.getState();
      const profil: SteuerProfil = {
        steuerregelung: st.steuerregelung,
        kmPauschale: st.kmPauschale,
        fahrzeugImBetriebsvermoegen: st.fahrzeugImBetriebsvermoegen,
      };
      const anlagen = berechneAnlagegueter(allInvoices, year, profil.steuerregelung);
      const afaKategorien = afaJeKategorie(anlagen);
      const afaJahr = anlagen.reduce((sum, a) => sum + a.jahresAfa, 0);

      // Kilometerpauschale und Verpflegungsmehraufwand hängen an keinem Beleg
      // und würden sonst fehlen – der Steuerbericht rechnet sie mit, und
      // beide Seiten sollen dieselbe Zahl zeigen.
      const fahrt = await fahrtenbuch.getJahresauswertung(year, st.kmPauschale);
      const jahresEingaben = {
        invoices: allInvoices,
        jahr: year,
        profil,
        dienstKm: fahrt.kmDienst,
        afaJahresbetrag: afaJahr,
        afaJeKategorie: afaKategorien,
        reiseTageVoll: st.reiseTageVoll,
        reiseTageTeil: st.reiseTageTeil,
      };

      // Der Jahresgewinn ist die Bemessungsgrundlage – dieselbe Zahl, die auch
      // im Steuerbericht steht.
      const jahr = berechneEuer(jahresEingaben);

      // Die Monatswerte dienen nur der Einordnung. Was nicht an einem Beleg
      // hängt – Abschreibung, Kilometerpauschale, Verpflegung – wird
      // gleichmäßig verteilt, damit kein Monat grundlos ausreißt.
      const jahresUmlage = (afaJahr + jahr.kmPauschaleBetrag + jahr.verpflegungsmehraufwand) / 12;

      const gewinn: Record<string, number> = {};
      for (let m = 1; m <= 12; m++) {
        const monat = `${year}-${String(m).padStart(2, '0')}`;
        const monatsBelege = allInvoices.filter((i) => i.year === year && i.month === m);
        if (monatsBelege.length === 0 && jahresUmlage === 0) continue;
        const teil = berechneEuer({ invoices: monatsBelege, jahr: year, profil });
        gewinn[monat] = Math.round((teil.gewinn - jahresUmlage) * 100) / 100;
      }

      setSaetze(s);
      setMonthlyGewinn(gewinn);
      setJahresGewinn(Math.max(0, jahr.gewinn));
    } catch (e) {
      toast.error('Fehler beim Laden: ' + String(e));
    } finally {
      setLoading(false);
    }
  }

  // dataVersion: nach einem Cloud-Sync neu laden, ohne Seitenwechsel
  const dataVersion = useAppStore((s) => s.dataVersion);
  useEffect(() => {
    load();
  }, [year, dataVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Berechnungen ──────────────────────────────────────────────────────────

  const monthData = useMemo(
    () => buildMonthData(year, saetze, monthlyGewinn, jahresGewinn),
    [year, saetze, monthlyGewinn, jahresGewinn],
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
    setSatzForm({ ...defaultSatzForm(year), gueltig_ab: `${year}-01-01` });
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
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      {/* Der Titel darf umbrechen statt aus dem Bild zu laufen – auf dem Handy
          stand „Pflegeversicherung" zur Hälfte hinter dem rechten Rand. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0 rounded-xl bg-primary/10 p-2">
            <HeartPulse className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            {/* Kurzer Titel wie im Menü – „Kranken- & Pflegeversicherung"
                passte in der großen Titelgröße auf keinem Handy in eine Zeile.
                Die lange Form steht darunter. */}
            <h1 className="text-2xl leading-tight font-bold">Krankenkasse</h1>
            <p className="mt-1 text-[13px] leading-snug text-muted-foreground sm:text-sm">
              Kranken- &amp; Pflegeversicherung · Soll aus echten Einnahmen, Prognose für offene Monate
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
              <CardTitle className="text-xs font-normal text-muted-foreground">
                Soll auf Basis echter Einnahmen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{fmt(summary.sollEcht)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.anzahlVergangen} Monate · Jahresgewinn ÷ 12, mindestens die Mindestbemessung, mal Beitragssatz
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-normal text-muted-foreground">
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
              <CardTitle className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                {summary.differenz > 0.005 ? (
                  <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                ) : summary.differenz < -0.005 ? (
                  <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                ) : (
                  <Minus className="h-3.5 w-3.5" />
                )}
                {summary.differenz > 0.005 ? 'Voraussichtl. Rückerstattung' : 'Voraussichtl. Nachzahlung'}
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
            Der <strong className="text-foreground">Soll-Beitrag (echt)</strong> beruht auf dem
            steuerlichen Gewinn – derselben Rechnung wie im Steuerbericht, also inklusive
            Abschreibung und ohne Sonderausgaben. Die Beiträge zur Kranken- und Pflegeversicherung
            mindern diesen Gewinn selbst <strong className="text-foreground">nicht</strong>; sie sind
            Sonderausgaben und wirken erst in der Einkommensteuererklärung. Die Spalte{' '}
            <strong className="text-foreground">„Vorläufig abgebucht"</strong> zeigt, was die Kasse
            monatlich tatsächlich einzieht (Prognose-Einkommen × Satz). Die{' '}
            <strong className="text-foreground">Differenz</strong> ist deine voraussichtliche
            Nachzahlung oder Rückerstattung am Jahresende.
            <br /><br />
            Für {year} rechnet die App mit einer Mindestbemessungsgrundlage von{' '}
            <strong className="text-foreground">{fmtCurrency(werteFuer(year).kvMindestbemessungMonat, false)}</strong>{' '}
            und einer Beitragsbemessungsgrenze von{' '}
            <strong className="text-foreground">{fmtCurrency(werteFuer(year).kvBemessungsgrenzeMonat, false)}</strong>{' '}
            je Monat. In schwachen Monaten zahlst du deshalb trotzdem, in starken ist bei der Grenze
            Schluss. Verbindlich ist am Ende der Bescheid deiner Kasse, der sich am
            Einkommensteuerbescheid orientiert.
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
                      <TableHead className="text-right">Monatsgewinn</TableHead>
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





























