import { useEffect, useState, useMemo } from 'react';
import { getAllInvoices, fahrtenbuch } from '@/lib/db';
import type { Invoice } from '@/types';
import { CATEGORY_LABELS } from '@/types';
import { useAppStore } from '@/store';
import { fmtCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FileText, TrendingUp, TrendingDown, Download, Calculator, PiggyBank, Receipt } from 'lucide-react';
import { exportToSteuerberaterCsv, exportToXlsx } from '@/lib/export';
import { berechneEuer, type SteuerProfil } from '@/lib/steuer/gewinn';
import { berechneAnlagegueter, afaJeKategorie, AFA_METHODE_LABELS } from '@/lib/steuer/anlagen';
import { steuerRuecklage, begrenzeSonderausgaben, tarifIstGepflegt } from '@/lib/steuer/tarif';
import { werteFuer, istFortgeschrieben } from '@/lib/steuer/jahreswerte';
import { WIRKUNG_KURZ, WIRKUNG_ERKLAERUNG, regelFuer } from '@/lib/steuer/kategorien';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { useIsMobile } from '@/hooks/useIsMobile';
import { PageHeader } from '@/components/layout/PageHeader';
import { ListGroup, ListRow } from '@/components/ui/list-group';
import { FormGroup, FormRow, FIELD } from '@/components/ui/form-list';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';

const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

export default function SteuerbrichtPage() {
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const selectedYear = useAppStore((s) => s.selectedYear);
  const setSelectedYear = useAppStore((s) => s.setSelectedYear);
  const privacyMode = useAppStore((s) => s.privacyMode);
  const isMobile = useIsMobile();
  const steuerregelung = useAppStore((s) => s.steuerregelung);
  const kmPauschale = useAppStore((s) => s.kmPauschale);
  const rechtsform = useAppStore((s) => s.rechtsform);
  const fahrzeugImBetriebsvermoegen = useAppStore((s) => s.fahrzeugImBetriebsvermoegen);
  const verheiratet = useAppStore((s) => s.verheiratet);
  const kirchensteuerSatz = useAppStore((s) => s.kirchensteuerSatz);
  const gewerbesteuerHebesatz = useAppStore((s) => s.gewerbesteuerHebesatz);
  const grundfreibetragManuell = useAppStore((s) => s.grundfreibetragManuell);
  const reiseTageVoll = useAppStore((s) => s.reiseTageVoll);
  const setReiseTageVoll = useAppStore((s) => s.setReiseTageVoll);
  const reiseTageTeil = useAppStore((s) => s.reiseTageTeil);
  const setReiseTageTeil = useAppStore((s) => s.setReiseTageTeil);

  // Fahrtenbuch km-Pauschale für das gewählte Jahr
  const [fahrtKmDienst, setFahrtKmDienst] = useState(0);

  // dataVersion: nach einem Cloud-Sync neu laden, ohne Seitenwechsel
  const dataVersion = useAppStore((s) => s.dataVersion);

  useEffect(() => {
    getAllInvoices()
      .then(setAllInvoices)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [dataVersion]);

  useEffect(() => {
    fahrtenbuch.getJahresauswertung(selectedYear, kmPauschale)
      .then((d) => setFahrtKmDienst(d.kmDienst))
      .catch(console.error);
  }, [selectedYear, kmPauschale, dataVersion]);

  const invoices = useMemo(
    () => allInvoices.filter((i) => i.year === selectedYear && i.type !== 'info'),
    [allInvoices, selectedYear]
  );

  const years = useMemo(() => {
    const ys = [...new Set(allInvoices.map((i) => i.year))].sort((a, b) => b - a);
    if (!ys.includes(new Date().getFullYear())) ys.unshift(new Date().getFullYear());
    return ys;
  }, [allInvoices]);

  // ── Die Rechnung ──
  // Alles kommt aus src/lib/steuer. Vorher stand die EÜR hier als eine Reihe
  // handgepflegter Kategorienlisten, und Dashboard und Krankenkassenseite
  // führten ihre eigenen – drei Zahlen für denselben Gewinn.
  const profil: SteuerProfil = useMemo(() => ({
    steuerregelung,
    kmPauschale,
    fahrzeugImBetriebsvermoegen,
  }), [steuerregelung, kmPauschale, fahrzeugImBetriebsvermoegen]);

  // Die Abschreibung braucht alle Jahre: Ein Gerät aus 2024 wird 2026 noch
  // abgeschrieben. Deshalb `allInvoices`, nicht die Belege des Jahres.
  const anlagegueter = useMemo(
    () => berechneAnlagegueter(allInvoices, selectedYear, steuerregelung),
    [allInvoices, selectedYear, steuerregelung],
  );
  const afaJahresgesamt = useMemo(
    () => Math.round(anlagegueter.reduce((sum, a) => sum + a.jahresAfa, 0) * 100) / 100,
    [anlagegueter],
  );
  const afaKategorien = useMemo(() => afaJeKategorie(anlagegueter), [anlagegueter]);

  const euer = useMemo(
    () => berechneEuer({
      invoices: allInvoices,
      jahr: selectedYear,
      profil,
      dienstKm: fahrtKmDienst,
      afaJahresbetrag: afaJahresgesamt,
      reiseTageVoll,
      reiseTageTeil,
      afaJeKategorie: afaKategorien,
    }),
    [allInvoices, selectedYear, profil, fahrtKmDienst, afaJahresgesamt, reiseTageVoll, reiseTageTeil, afaKategorien],
  );

  const jahreswerte = werteFuer(selectedYear);
  const grundfreibetrag = grundfreibetragManuell > 0 ? grundfreibetragManuell : jahreswerte.grundfreibetrag;

  // Die Rücklage rechnet jetzt den Tarif des § 32a EStG statt pauschaler 30 %
  // – und zieht die Sonderausgaben ab, die vorher gar nicht vorkamen.
  // Die Höchstbeträge des § 10 EStG anwenden, bevor die Rücklage gerechnet
  // wird. Roh addiert wären Spenden und sonstige Vorsorge in voller Höhe
  // abgezogen worden, obwohl beide gedeckelt sind.
  const sonderausgabenGedeckelt = useMemo(
    () => begrenzeSonderausgaben(euer.sonderausgabenRoh, selectedYear, {
      selbstaendig: true,
      gesamtbetragDerEinkuenfte: euer.gewinn,
    }),
    [euer.sonderausgabenRoh, euer.gewinn, selectedYear],
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

  // Namen, die der Rest der Seite schon benutzt.
  const fahrtAbsetzbar = euer.kmPauschaleBetrag;
  const einnahmen = euer.betriebseinnahmen;
  const betriebsausgabenSteuerlich = euer.betriebsausgaben;
  const betriebsausgabenCash = Math.round((
    euer.cashAusgaben - euer.sonderausgaben - euer.privat
    - euer.aussergewoehnlicheBelastungen - euer.haushaltsnaheKosten - euer.handwerkerKosten
  ) * 100) / 100;
  const gewinnSteuerlich = euer.gewinn;
  const gewinnCash = Math.round((euer.cashEinnahmen - betriebsausgabenCash) * 100) / 100;
  const steuerruecklage = ruecklage.ruecklage;
  const ustEinnahmen = euer.umsatzsteuer;
  const vorsteuer = euer.vorsteuer;
  const ustZahllast = euer.zahllast;
  const sonderausgaben = euer.sonderausgaben;
  const anlagevermoegen_kaufpreis = euer.anlagenZugang;
  const einnahmenByKat = euer.einnahmenNachKategorie;
  const ausgabenByKat = euer.ausgabenNachKategorie;

  // Monatliche Übersicht – Cash, damit sie zum Kontoauszug passt.
  const monthly = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      const mi = invoices.filter((i) => i.month === m + 1);
      const ein = mi.filter((i) => i.type === 'einnahme').reduce((sum, i) => sum + i.brutto, 0);
      const aus = mi.filter((i) => i.type === 'ausgabe').reduce((sum, i) => sum + i.brutto, 0);
      return { label: MONTH_NAMES[m], einnahmen: ein, ausgaben: aus, saldo: ein - aus };
    });
  }, [invoices]);

  // Reverse Charge trifft auch Kleinunternehmer: § 19 UStG befreit nicht von
  // § 13b UStG. Wer solche Belege hat, muss für den Zeitraum eine
  // Voranmeldung abgeben – ohne Vorsteuerabzug, also aus eigener Tasche.
  const reverseCharge = useMemo(
    () => invoices.filter((i) => i.category === 'reverse_charge'),
    [invoices],
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // ── Handy ──
  // Vier Tabellen mit je drei bis sechs Spalten passen auf ein Handy nicht:
  // Man las Zahlenkolonnen, die zur Hälfte abgeschnitten waren. Dieselben
  // Werte hier als Gruppenlisten – Bezeichnung links, Betrag rechts, Details
  // in der zweiten Zeile.
  if (isMobile) {
    const amount = (value: number, tone?: string) => (
      <span className={tone}>{fmtCurrency(value, privacyMode)}</span>
    );

    return (
      <div className="space-y-7">
        <PageHeader
          title="Steuerbericht"
          subtitle={`Einnahmen-Überschuss-Rechnung ${selectedYear}`}
          actions={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  {selectedYear}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {years.map((y) => (
                  <DropdownMenuItem key={y} onSelect={() => setSelectedYear(y)}>
                    {y}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />

        {euer.warnungen.length > 0 && (
          <ListGroup title="Prüfen">
            {euer.warnungen.map((w, i) => (
              <ListRow key={i} label={w} noChevron />
            ))}
          </ListGroup>
        )}

        {steuerregelung === 'kleinunternehmer' && reverseCharge.length > 0 && (
          <ListGroup
            title="Umsatzsteuer trotz § 19 UStG"
            footer="Die Kleinunternehmerregelung befreit nicht von § 13b UStG. Für die betroffenen Zeiträume ist eine Umsatzsteuer-Voranmeldung abzugeben, und die Steuer ist ohne Vorsteuerabzug selbst zu tragen."
          >
            <ListRow
              label="Reverse-Charge-Belege"
              hint={`${reverseCharge.length} Beleg${reverseCharge.length === 1 ? '' : 'e'} im Jahr ${selectedYear}`}
              value={amount(reverseCharge.reduce((sum, i) => sum + i.brutto, 0))}
              noChevron
            />
          </ListGroup>
        )}

        <ListGroup
          title="Ergebnis"
          footer={`Der steuerliche Gewinn ist die Zahl für die Anlage EÜR. Sonderausgaben wie die Krankenversicherung sind hier bewusst nicht abgezogen – sie mindern erst in der Einkommensteuererklärung das Einkommen.${
            istFortgeschrieben(selectedYear) ? ` Für ${selectedYear} liegen noch keine amtlichen Werte vor; gerechnet wird mit dem letzten bekannten Stand.` : ''
          }`}
        >
          <ListRow
            label="Betriebseinnahmen"
            hint={steuerregelung === 'kleinunternehmer' ? 'Ohne Umsatzsteuer – als Kleinunternehmer weist du keine aus' : 'Netto, ohne Umsatzsteuer'}
            value={amount(einnahmen, 'text-green-600')}
            noChevron
          />
          <ListRow
            label="Betriebsausgaben"
            hint={
              steuerregelung === 'kleinunternehmer'
                ? `Brutto, weil kein Vorsteuerabzug besteht${anlagevermoegen_kaufpreis > 0 ? ` · Cash ${fmtCurrency(betriebsausgabenCash, privacyMode)}` : ''}`
                : anlagevermoegen_kaufpreis > 0 || fahrtAbsetzbar > 0
                  ? `Steuerlich · Cash ${fmtCurrency(betriebsausgabenCash, privacyMode)}`
                  : 'Steuerlich absetzbar'
            }
            value={amount(betriebsausgabenSteuerlich, 'text-red-600')}
            noChevron
          />
          <ListRow
            label="Steuerlicher Gewinn"
            hint="Grundlage der Einkommensteuer"
            value={amount(gewinnSteuerlich, gewinnSteuerlich >= 0 ? 'text-violet-600' : 'text-red-600')}
            noChevron
          />
          <ListRow
            label="Steuerrücklage"
            hint={
              ruecklage.ruecklage > 0
                ? `${ruecklage.quote.toFixed(1)} % des Gewinns · Einkommensteuer nach § 32a EStG auf ${fmtCurrency(ruecklage.zvE, privacyMode)} zu versteuerndes Einkommen`
                : `Bei diesem Gewinn fällt nach Abzug der Sonderausgaben keine Einkommensteuer an (Grundfreibetrag ${fmtCurrency(grundfreibetrag, privacyMode)})`
            }
            value={amount(steuerruecklage, 'text-amber-600')}
            noChevron
          />
          {ruecklage.gewerbesteuer && ruecklage.gewerbesteuer.steuer > 0 && (
            <ListRow
              label="davon Gewerbesteuer"
              hint={`${fmtCurrency(ruecklage.gewerbesteuer.steuer, privacyMode)} bei Hebesatz ${gewerbesteuerHebesatz} %, davon ${fmtCurrency(ruecklage.gewerbesteuer.anrechnung, privacyMode)} auf die Einkommensteuer angerechnet (§ 35 EStG)`}
              value={amount(ruecklage.gewerbesteuer.verbleibt)}
              noChevron
            />
          )}
        </ListGroup>

        {steuerregelung === 'regelbesteuerung' && (
          <ListGroup title="Umsatzsteuer" footer="Die Zahllast wird per Umsatzsteuervoranmeldung ans Finanzamt abgeführt.">
            <ListRow label="USt aus Einnahmen" value={amount(ustEinnahmen, 'text-green-600')} noChevron />
            <ListRow label="Vorsteuer aus Ausgaben" value={amount(vorsteuer, 'text-red-600')} noChevron />
            <ListRow
              label="Zahllast"
              value={amount(ustZahllast, ustZahllast >= 0 ? 'text-orange-600' : 'text-green-600')}
              noChevron
            />
          </ListGroup>
        )}

        <ListGroup title="Einnahmen nach Kategorie">
          {einnahmenByKat.length === 0 ? (
            <ListRow label="Keine Einnahmen" noChevron />
          ) : (
            einnahmenByKat.map((k) => (
              <ListRow
                key={k.category}
                label={CATEGORY_LABELS[k.category as keyof typeof CATEGORY_LABELS] ?? k.category}
                hint={
                  k.steuerlich === 0
                    ? regelFuer(k.category).hinweis ?? 'Kein steuerpflichtiger Gewinn'
                    : einnahmen > 0 ? `${((k.betrag / einnahmen) * 100).toFixed(1)} % der Einnahmen` : undefined
                }
                value={k.steuerlich === 0
                  ? <span className="text-[15px] text-muted-foreground">{fmtCurrency(k.betrag, privacyMode)}</span>
                  : amount(k.betrag)}
                noChevron
              />
            ))
          )}
        </ListGroup>

        {/* Drei Zustände statt zwei: Was den Gewinn mindert, was privat
            abziehbar ist, und was gar nicht wirkt. Vorher standen die
            Sonderausgaben mit vollem Betrag in derselben Spalte wie die
            Miete – als würden sie den Gewinn genauso mindern. */}
        <ListGroup
          title="Ausgaben nach Kategorie"
          footer="Rechts steht, was den Gewinn mindert. Sonderausgaben wirken erst in der Einkommensteuererklärung und stehen deshalb grau."
        >
          {ausgabenByKat.length === 0 && fahrtAbsetzbar === 0 ? (
            <ListRow label="Keine Ausgaben" noChevron />
          ) : (
            <>
              {ausgabenByKat.map((k) => {
                const isAfaCat = regelFuer(k.category).ueberAfa === true;
                const mindertGewinn = k.wirkung === 'betriebsausgabe';
                const steuerlichBetrag = k.steuerlich;
                const gekuerzt = mindertGewinn && !isAfaCat && Math.abs(k.steuerlich - k.betrag) > 0.005;
                return (
                  <ListRow
                    key={k.category}
                    label={CATEGORY_LABELS[k.category as keyof typeof CATEGORY_LABELS] ?? k.category}
                    hint={
                      isAfaCat
                        ? `Zugang ${fmtCurrency(k.betrag, privacyMode)} · rechts steht die Abschreibung ${selectedYear}`
                        : gekuerzt
                          ? `Gezahlt ${fmtCurrency(k.betrag, privacyMode)} · nur 70 % mindern den Gewinn`
                          : mindertGewinn ? undefined : WIRKUNG_ERKLAERUNG[k.wirkung]
                    }
                    value={
                      mindertGewinn
                        ? amount(steuerlichBetrag, isAfaCat || gekuerzt ? 'text-violet-600' : undefined)
                        : (
                          <span className="text-[15px] text-muted-foreground">
                            {WIRKUNG_KURZ[k.wirkung]}
                          </span>
                        )
                    }
                    noChevron
                  />
                );
              })}
              {fahrtAbsetzbar > 0 && (
                <ListRow
                  label="km-Pauschale"
                  hint={`${fahrtKmDienst.toFixed(0)} km × ${kmPauschale.toFixed(2).replace('.', ',')} € aus dem Fahrtenbuch`}
                  value={amount(fahrtAbsetzbar, 'text-blue-600 dark:text-blue-400')}
                  noChevron
                />
              )}
              {euer.zahlungsgebuehren > 0 && (
                <ListRow
                  label="Gebühren der Zahlungsanbieter"
                  hint="Einbehalten, bevor das Geld ankam – trotzdem Betriebsausgabe"
                  value={amount(euer.zahlungsgebuehren, 'text-blue-600 dark:text-blue-400')}
                  noChevron
                />
              )}
              {euer.verpflegungsmehraufwand > 0 && (
                <ListRow
                  label="Verpflegungsmehraufwand"
                  hint={`${reiseTageVoll} volle Tage × ${jahreswerte.verpflegungVollerTag} € · ${reiseTageTeil} Tage × ${jahreswerte.verpflegungTeilTag} €`}
                  value={amount(euer.verpflegungsmehraufwand, 'text-blue-600 dark:text-blue-400')}
                  noChevron
                />
              )}
            </>
          )}
        </ListGroup>

        <FormGroup
          title="Reisetage"
          footer={`Verpflegungspauschalen nach § 9 Abs. 4a EStG: ${jahreswerte.verpflegungVollerTag} € für einen vollen Tag, ${jahreswerte.verpflegungTeilTag} € für An- und Abreisetage sowie für Tage mit mehr als acht Stunden Abwesenheit. Sie gelten ohne Beleg – die Kilometer aus dem Fahrtenbuch reichen dafür nicht, weil dort keine Uhrzeiten stehen. Nach drei Monaten an derselben Stelle entfällt die Pauschale.`}
        >
          <FormRow label="Volle Tage (24 h)">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              className={FIELD}
              value={reiseTageVoll || ''}
              onChange={(e) => setReiseTageVoll(Number(e.target.value) || 0)}
              placeholder="0"
            />
          </FormRow>
          <FormRow label="An-/Abreise, über 8 h">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              className={FIELD}
              value={reiseTageTeil || ''}
              onChange={(e) => setReiseTageTeil(Number(e.target.value) || 0)}
              placeholder="0"
            />
          </FormRow>
        </FormGroup>

        {anlagegueter.length > 0 && (
          <ListGroup
            title={`Wirtschaftsgüter ${selectedYear}`}
            footer={`Abschreibung im Jahr zusammen ${fmtCurrency(afaJahresgesamt, privacyMode)}.${
              steuerregelung === 'kleinunternehmer'
                ? ' Als Kleinunternehmer wird der Bruttobetrag abgeschrieben – die Umsatzsteuer gehört zu den Anschaffungskosten.'
                : ''
            }`}
          >
            {anlagegueter.map((a) => (
              <ListRow
                key={a.invoice.id}
                label={a.invoice.description || a.invoice.partner || 'Wirtschaftsgut'}
                hint={`${a.assetLabel} · ${AFA_METHODE_LABELS[a.methode]}${a.nutzungsdauer > 1 ? ` · ${a.nutzungsdauer} Jahre` : ''}${
                  a.degressivMoeglich && a.methode === 'degressiv' ? ` · linear wären ${fmtCurrency(a.linearImJahr, privacyMode)}` : ''
                }`}
                value={a.jahresAfa > 0 ? amount(a.jahresAfa, 'text-violet-600') : <span>—</span>}
                noChevron
              />
            ))}
          </ListGroup>
        )}

        {(euer.haushaltsnaheKosten > 0 || euer.handwerkerKosten > 0 || euer.aussergewoehnlicheBelastungen > 0) && (
          <ListGroup
            title="Privat abziehbar"
            footer="Diese Posten hängen am privaten Einkommen und stehen jedem zu – auch Selbständigen. Sie mindern nicht den Gewinn, sondern die Steuer selbst (§ 35a) beziehungsweise das Einkommen (§ 33)."
          >
            {euer.haushaltsnaheKosten > 0 && (
              <ListRow
                label="Haushaltsnahe Dienstleistungen"
                hint={`20 % davon gehen direkt von der Steuer ab, höchstens ${fmtCurrency(jahreswerte.haushaltsnahMax * jahreswerte.paragraf35aSatz, privacyMode)}`}
                value={amount(Math.min(euer.haushaltsnaheKosten, jahreswerte.haushaltsnahMax) * jahreswerte.paragraf35aSatz, 'text-emerald-600')}
                noChevron
              />
            )}
            {euer.handwerkerKosten > 0 && (
              <ListRow
                label="Handwerkerleistungen"
                hint={`Nur der Arbeitsanteil, höchstens ${fmtCurrency(jahreswerte.handwerkerMax * jahreswerte.paragraf35aSatz, privacyMode)} Ermäßigung`}
                value={amount(Math.min(euer.handwerkerKosten, jahreswerte.handwerkerMax) * jahreswerte.paragraf35aSatz, 'text-emerald-600')}
                noChevron
              />
            )}
            {euer.aussergewoehnlicheBelastungen > 0 && (
              <ListRow
                label="Außergewöhnliche Belastungen"
                hint="Wirken erst über der zumutbaren Belastung (§ 33 EStG)"
                value={amount(euer.aussergewoehnlicheBelastungen)}
                noChevron
              />
            )}
          </ListGroup>
        )}

        {sonderausgaben > 0 && (
          <ListGroup
            title="Sonderausgaben"
            footer="Kranken- und Pflegeversicherung, Altersvorsorge und Spenden mindern nicht den Gewinn, sondern erst in der Einkommensteuererklärung das zu versteuernde Einkommen."
          >
            <ListRow label="Privat absetzbar" value={amount(sonderausgaben)} noChevron />
          </ListGroup>
        )}

        <ListGroup title={`Monatlich ${selectedYear}`}>
          {monthly.map((m) => {
            const leer = m.einnahmen === 0 && m.ausgaben === 0;
            return (
              <ListRow
                key={m.label}
                label={m.label}
                hint={
                  leer
                    ? 'Keine Buchungen'
                    : `+${fmtCurrency(m.einnahmen, privacyMode)} · −${fmtCurrency(m.ausgaben, privacyMode)}`
                }
                value={leer ? <span>—</span> : amount(m.saldo, m.saldo >= 0 ? 'text-green-600' : 'text-red-600')}
                noChevron
              />
            );
          })}
        </ListGroup>

        <ListGroup title="Export">
          <ListRow
            tint="green"
            icon={<Download />}
            label="Als Excel-Datei"
            hint="Alle Buchungen des Jahres"
            noChevron
            onClick={async () => {
              try { await exportToXlsx(invoices, selectedYear); toast.success('Excel-Export erstellt'); }
              catch (e) { toast.error('Export fehlgeschlagen: ' + (e as Error).message); }
            }}
          />
          <ListRow
            tint="blue"
            icon={<Download />}
            label="Buchungen als CSV"
            hint="Für die Steuerkanzlei – kein fertiger DATEV-Stapel"
            noChevron
            onClick={async () => {
              try { await exportToSteuerberaterCsv(invoices, selectedYear); toast.success('Buchungs-CSV erstellt'); }
              catch (e) { toast.error('Export fehlgeschlagen: ' + (e as Error).message); }
            }}
          />
        </ListGroup>

        <p className="px-4 text-[13px] leading-snug text-muted-foreground">
          Diese Auswertung dient der Orientierung und ersetzt keine Steuerberatung. Die Abschreibung beruht
          auf automatisch erkannten Wirtschaftsgut-Typen und typischen Nutzungsdauern. Die EÜR ist eine
          Anlage zur Einkommensteuererklärung und muss elektronisch übermittelt werden.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" /> Steuerbericht {selectedYear}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Einnahmen-Überschuss-Rechnung nach § 4 Abs. 3 EStG – Anlage zur Einkommensteuererklärung
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
          <Button variant="outline" size="sm" title="Buchungs-CSV für die Steuerkanzlei – kein fertiger DATEV-Buchungsstapel" onClick={async () => {
            try { await exportToSteuerberaterCsv(invoices, selectedYear); toast.success('Buchungs-CSV erstellt'); }
            catch (e) { toast.error('Export fehlgeschlagen: ' + (e as Error).message); }
          }}>
            <Download className="mr-2 h-4 w-4" /> Buchungen (CSV)
          </Button>
        </div>
      </div>

      {/* Haupt-KPIs: EÜR (steuerlich) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <TrendingUp className="h-3.5 w-3.5 text-green-600" />
              Betriebseinnahmen
              <InfoTooltip text={steuerregelung === 'kleinunternehmer' ? "Summe der Betriebseinnahmen. Als Kleinunternehmer weist du keine Umsatzsteuer aus, netto und brutto sind dasselbe. Privateinlagen zählen nicht mit." : "Nettobetrag der Betriebseinnahmen, ohne Umsatzsteuer. Privateinlagen und Umsatzsteuererstattungen zählen nicht mit."} side="top" />
            </div>
            <p className="text-xl font-bold text-green-600">{fmtCurrency(einnahmen, privacyMode)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <TrendingDown className="h-3.5 w-3.5 text-red-600" /> Betriebsausgaben (steuerlich)
              <InfoTooltip text={`Laufende Ausgaben plus Abschreibung statt vollem Kaufpreis: ${fmtCurrency(afaJahresgesamt, privacyMode)} AfA${fahrtAbsetzbar > 0 ? `, ${fmtCurrency(fahrtAbsetzbar, privacyMode)} km-Pauschale` : ''}${euer.zahlungsgebuehren > 0 ? `, ${fmtCurrency(euer.zahlungsgebuehren, privacyMode)} einbehaltene Gebühren` : ''}. Kranken- und Pflegeversicherung sind nicht enthalten – sie sind Sonderausgaben und mindern den Gewinn nicht.`} side="top" />
            </div>
            <p className="text-xl font-bold text-red-600">{fmtCurrency(betriebsausgabenSteuerlich, privacyMode)}</p>
            {anlagevermoegen_kaufpreis > 0 && (
              <p className="text-[10px] text-muted-foreground">Cash-Basis: {fmtCurrency(betriebsausgabenCash, privacyMode)}</p>
            )}
            {fahrtAbsetzbar > 0 && (
              <p className="text-[10px] text-blue-600 dark:text-blue-400">🚗 inkl. {fmtCurrency(fahrtAbsetzbar, privacyMode)} km-Pauschale ({fahrtKmDienst.toFixed(0)} km)</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-violet-200 dark:border-violet-800">
          <CardContent className="pt-5 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Calculator className="h-3.5 w-3.5 text-violet-600" /> Steuerlicher Gewinn (EÜR)
              <InfoTooltip text={`EÜR = Einnahmen-Überschuss-Rechnung: Einnahmen minus steuerliche Betriebsausgaben (mit AfA${fahrtAbsetzbar > 0 ? ' + km-Pauschale Fahrtenbuch' : ''}). Dies ist die Basis für die Einkommensteuer. Cash-Gewinn: ${fmtCurrency(gewinnCash, privacyMode)}`} side="top" />
            </div>
            <p className={`text-xl font-bold ${gewinnSteuerlich >= 0 ? 'text-violet-600' : 'text-red-600'}`}>{fmtCurrency(gewinnSteuerlich, privacyMode)}</p>
            {anlagevermoegen_kaufpreis > 0 && (
              <p className="text-[10px] text-muted-foreground">AfA-Differenz: {anlagevermoegen_kaufpreis - afaJahresgesamt >= 0 ? '+' : ''}{fmtCurrency(anlagevermoegen_kaufpreis - afaJahresgesamt, privacyMode)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <PiggyBank className="h-3.5 w-3.5 text-amber-500" /> Steuerrücklage
              <InfoTooltip text={`Gerechnet mit dem Einkommensteuertarif des § 32a EStG für ${selectedYear}, zuzüglich Solidaritätszuschlag${kirchensteuerSatz > 0 ? ' und Kirchensteuer' : ''}${rechtsform === 'gewerbetreibend' ? ' und der nach § 35 EStG verbleibenden Gewerbesteuer' : ''}. Vom Gewinn abgezogen sind die Sonderausgaben – bei Selbständigen vor allem die Krankenversicherung. Andere Einkünfte kennt die App nicht; wer welche hat, liegt höher.`} side="top" />
            </div>
            <p className="text-xl font-bold text-amber-600">{fmtCurrency(steuerruecklage, privacyMode)}</p>
            <p className="text-[10px] text-muted-foreground">
              {ruecklage.ruecklage > 0
                ? `${ruecklage.quote.toFixed(1)} % vom Gewinn · Grenzsteuersatz ${ruecklage.grenzsteuersatz.toFixed(1)} %`
                : `unter dem Grundfreibetrag von ${fmtCurrency(grundfreibetrag, privacyMode)}`}
            </p>
            {!tarifIstGepflegt(selectedYear) && (
              <p className="text-[10px] text-amber-600">
                Für {selectedYear} liegt noch kein amtlicher Tarif vor – gerechnet mit dem letzten bekannten.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Was der Nutzer wissen muss, bevor er die Zahlen weiterreicht. */}
      {(euer.warnungen.length > 0 || (steuerregelung === 'kleinunternehmer' && reverseCharge.length > 0)) && (
        <Card className="border-amber-300 dark:border-amber-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Receipt className="h-4 w-4 text-amber-600" /> Zu prüfen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            {euer.warnungen.map((w, i) => (
              <p key={i}>{w}</p>
            ))}
            {steuerregelung === 'kleinunternehmer' && reverseCharge.length > 0 && (
              <p>
                <strong className="text-foreground">
                  {reverseCharge.length} Beleg{reverseCharge.length === 1 ? '' : 'e'} mit Reverse Charge
                  ({fmtCurrency(reverseCharge.reduce((sum, i) => sum + i.brutto, 0), privacyMode)}).
                </strong>{' '}
                Die Kleinunternehmerregelung befreit nicht von § 13b UStG: Die Umsatzsteuer schuldest du
                selbst, musst für diese Zeiträume eine Umsatzsteuer-Voranmeldung abgeben und kannst sie
                mangels Vorsteuerabzug nicht gegenrechnen. Dafür brauchst du eine USt-IdNr.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Verpflegungsmehraufwand – ohne Beleg, deshalb von Hand gezählt. */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Receipt className="h-4 w-4 text-blue-600" /> Reisetage {selectedYear}
            <InfoTooltip text={`Verpflegungspauschalen nach § 9 Abs. 4a EStG. Sie gelten ohne Beleg, setzen aber eine Auswärtstätigkeit voraus. Nach drei Monaten an derselben Tätigkeitsstätte entfallen sie. Stellt jemand anderes eine Mahlzeit, wird gekürzt: Frühstück 20 %, Mittag- und Abendessen je 40 % von ${jahreswerte.verpflegungVollerTag} €.`} side="right" />
            {euer.verpflegungsmehraufwand > 0 && (
              <Badge variant="outline" className="text-[10px]">
                {fmtCurrency(euer.verpflegungsmehraufwand, privacyMode)} als Betriebsausgabe
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-6">
          <div className="space-y-1.5">
            <label className="block text-xs text-muted-foreground">Volle Tage (24 Stunden)</label>
            <input
              type="number"
              min={0}
              className="h-9 w-28 rounded-md border border-input bg-background px-3 text-sm"
              value={reiseTageVoll || ''}
              onChange={(e) => setReiseTageVoll(Number(e.target.value) || 0)}
              placeholder="0"
            />
            <p className="text-[10px] text-muted-foreground">je {jahreswerte.verpflegungVollerTag} €</p>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs text-muted-foreground">An-/Abreisetage, über 8 Stunden</label>
            <input
              type="number"
              min={0}
              className="h-9 w-28 rounded-md border border-input bg-background px-3 text-sm"
              value={reiseTageTeil || ''}
              onChange={(e) => setReiseTageTeil(Number(e.target.value) || 0)}
              placeholder="0"
            />
            <p className="text-[10px] text-muted-foreground">je {jahreswerte.verpflegungTeilTag} €</p>
          </div>
          <p className="text-xs text-muted-foreground max-w-md">
            Das Fahrtenbuch hält nur Kilometer fest, keine Uhrzeiten – deshalb werden die Tage hier
            gezählt. Ohne diese Angabe bleibt die Pauschale liegen.
          </p>
        </CardContent>
      </Card>

      {/* Wirtschaftsgüter */}
      {anlagegueter.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex flex-wrap items-center gap-2">
              <Calculator className="h-4 w-4 text-violet-600" /> Wirtschaftsgüter {selectedYear}
              <InfoTooltip text={`Wirtschaftsgüter über ${jahreswerte.gwgSofortGrenze} € netto werden über die Nutzungsdauer abgeschrieben. Bis ${jahreswerte.gwgSofortGrenze} € netto ist ein Sofortabzug möglich – aber nur, wenn das Gut für sich allein nutzbar ist. Bildschirme und Drucker sind das nicht.`} side="right" />
              <Badge variant="outline" className="text-[10px]">
                Abschreibung {selectedYear}: {fmtCurrency(afaJahresgesamt, privacyMode)}
              </Badge>
              {anlagevermoegen_kaufpreis > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  Zugänge {fmtCurrency(anlagevermoegen_kaufpreis, privacyMode)} → davon {fmtCurrency(afaJahresgesamt, privacyMode)} in diesem Jahr
                </Badge>
              )}
              {steuerregelung === 'kleinunternehmer' && (
                <Badge variant="secondary" className="text-[10px]">
                  Bemessung brutto (§ 9b EStG)
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
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      Bemessung
                      <InfoTooltip text={`Der Betrag, der abgeschrieben wird. Wer keine Vorsteuer ziehen darf, schreibt brutto ab – die Umsatzsteuer gehört dann zu den Anschaffungskosten (§ 9b Abs. 1 EStG). Die ${jahreswerte.gwgSofortGrenze}-€-Grenze wird davon unabhängig immer am Nettobetrag gemessen.`} side="top" />
                    </span>
                  </TableHead>
                  <TableHead>
                    <span className="flex items-center gap-1">
                      Methode
                      <InfoTooltip text={`Sofortabzug bis ${jahreswerte.gwgSofortGrenze} € netto. Degressive AfA: 30 % vom Restbuchwert, möglich für Anschaffungen vom 01.07.2025 bis 31.12.2027; die App wechselt automatisch zur linearen AfA, sobald das mehr bringt. Computerhardware darf über ein Jahr abgeschrieben werden.`} side="top" />
                    </span>
                  </TableHead>
                  <TableHead className="text-right">ND (Jahre)</TableHead>
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      AfA {selectedYear}
                      <InfoTooltip text="Abschreibungsbetrag im gewählten Jahr. Er mindert als Betriebsausgabe den Gewinn." side="top" />
                    </span>
                  </TableHead>
                  <TableHead className="text-right">Restbuchwert</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {anlagegueter.map((a) => (
                  <TableRow key={a.invoice.id}>
                    <TableCell className="text-xs">
                      <div className="font-medium">{a.invoice.description || '—'}</div>
                      <div className="text-muted-foreground">{a.invoice.partner} · {a.invoice.date.slice(0, 10)}</div>
                      {a.hinweis && (
                        <div className="text-[10px] text-muted-foreground mt-0.5 max-w-md">{a.hinweis}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.assetLabel}</TableCell>
                    <TableCell className="text-right text-xs font-mono">
                      {fmtCurrency(a.bemessung, privacyMode)}
                      {Math.abs(a.bemessung - a.pruefBetrag) > 0.005 && (
                        <div className="text-[10px] text-muted-foreground">netto {fmtCurrency(a.pruefBetrag, privacyMode)}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {AFA_METHODE_LABELS[a.methode]}
                      {a.methode === 'degressiv' && a.linearImJahr > 0 && (
                        <div className="text-[10px]">linear wären {fmtCurrency(a.linearImJahr, privacyMode)}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs">{a.nutzungsdauer}</TableCell>
                    <TableCell className="text-right text-xs font-mono font-semibold text-violet-600">
                      {a.jahresAfa > 0 ? fmtCurrency(a.jahresAfa, privacyMode) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono text-muted-foreground">
                      {fmtCurrency(a.restbuchwert, privacyMode)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground mt-2">
              * Aufgeführt sind alle Wirtschaftsgüter aus allen Jahren. Vollständig abgeschriebene stehen mit 0 € in der Jahresspalte und einem Restbuchwert von 0 €.
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
                <p className="text-muted-foreground text-xs flex items-center gap-1">
                  USt aus Einnahmen
                  <InfoTooltip text="Umsatzsteuer, die du von deinen Kunden eingenommen und ans Finanzamt weiterzuleiten hast." side="top" />
                </p>
                <p className="font-semibold text-green-600">{fmtCurrency(ustEinnahmen, privacyMode)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs flex items-center gap-1">
                  Vorsteuer aus Ausgaben
                  <InfoTooltip text="Vorsteuer: Die USt, die du in deinen eigenen Einkäufen bezahlt hast. Als Regelbesteuerer kannst du diese vom Finanzamt zurückfordern (Vorsteuerabzug)." side="top" />
                </p>
                <p className="font-semibold text-red-600">{fmtCurrency(vorsteuer, privacyMode)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs flex items-center gap-1">
                  USt-Zahllast ans Finanzamt
                  <InfoTooltip text="USt-Zahllast = Eingenommene USt − Vorsteuer. Dieser Betrag wird per UVA (Umsatzsteuervoranmeldung) ans Finanzamt abgeführt." side="top" />
                </p>
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
                {einnahmenByKat.map((k) => (
                  <TableRow key={k.category}>
                    <TableCell className="text-xs">
                      {CATEGORY_LABELS[k.category as keyof typeof CATEGORY_LABELS] ?? k.category}
                      {k.steuerlich === 0 && (
                        <Badge variant="secondary" className="ml-1 text-[9px]">kein Gewinn</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono">{fmtCurrency(k.betrag, privacyMode)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {k.steuerlich === 0
                        ? '—'
                        : einnahmen > 0 ? ((k.betrag / einnahmen) * 100).toFixed(1) + ' %' : '—'}
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
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      {steuerregelung === 'kleinunternehmer' ? 'Gezahlt' : 'Netto'}
                      <InfoTooltip
                        text={steuerregelung === 'kleinunternehmer'
                          ? 'Der volle Rechnungsbetrag. Ohne Vorsteuerabzug ist die Umsatzsteuer Teil deiner Kosten.'
                          : 'Nettobetrag ohne Umsatzsteuer – die ziehst du als Vorsteuer. Bei Kategorien ohne Vorsteuerabzug steht hier der Bruttobetrag.'}
                        side="top"
                      />
                    </span>
                  </TableHead>
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      Mindert den Gewinn
                      <InfoTooltip text="Nur Betriebsausgaben mindern den Gewinn der EÜR. Kranken- und Pflegeversicherung, Altersvorsorge und Spenden sind Sonderausgaben – sie wirken erst in der Einkommensteuererklärung und stehen deshalb nicht in dieser Spalte." side="top" />
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ausgabenByKat.map((k) => {
                  const isAfaCat = regelFuer(k.category).ueberAfa === true;
                  const mindertGewinn = k.wirkung === 'betriebsausgabe';
                  const steuerlichBetrag = k.steuerlich;
                  const gekuerzt = mindertGewinn && !isAfaCat && Math.abs(k.steuerlich - k.betrag) > 0.005;
                  return (
                    <TableRow key={k.category}>
                      <TableCell className="text-xs">
                        {CATEGORY_LABELS[k.category as keyof typeof CATEGORY_LABELS] ?? k.category}
                        {isAfaCat && <Badge variant="outline" className="ml-1 text-[9px]">über die Nutzungsdauer</Badge>}
                        {gekuerzt && <Badge variant="outline" className="ml-1 text-[9px]">70 %</Badge>}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono text-muted-foreground">{fmtCurrency(k.betrag, privacyMode)}</TableCell>
                      <TableCell className="text-right text-xs font-mono font-semibold">
                        {mindertGewinn
                          ? <span className={isAfaCat || gekuerzt ? 'text-violet-600' : ''}>{fmtCurrency(steuerlichBetrag, privacyMode)}</span>
                          : (
                            <span title={WIRKUNG_ERKLAERUNG[k.wirkung]}>
                              <Badge variant="secondary" className="text-[10px] font-normal">{WIRKUNG_KURZ[k.wirkung]}</Badge>
                            </span>
                          )
                        }
                      </TableCell>
                    </TableRow>
                  );
                })}
                {ausgabenByKat.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground text-xs py-4">Keine Ausgaben</TableCell></TableRow>
                )}
                {euer.zahlungsgebuehren > 0 && (
                  <TableRow className="border-t-2">
                    <TableCell className="text-xs">
                      Einbehaltene Gebühren der Zahlungsanbieter
                      <Badge variant="outline" className="ml-1 text-[9px] text-blue-600 border-blue-300">ohne eigenen Beleg</Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono text-muted-foreground">—</TableCell>
                    <TableCell className="text-right text-xs font-mono font-semibold text-blue-600 dark:text-blue-400">{fmtCurrency(euer.zahlungsgebuehren, privacyMode)}</TableCell>
                  </TableRow>
                )}
                {euer.verpflegungsmehraufwand > 0 && (
                  <TableRow className="border-t-2">
                    <TableCell className="text-xs">
                      Verpflegungsmehraufwand ({reiseTageVoll} × {jahreswerte.verpflegungVollerTag} €, {reiseTageTeil} × {jahreswerte.verpflegungTeilTag} €)
                      <Badge variant="outline" className="ml-1 text-[9px] text-blue-600 border-blue-300">Pauschale</Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono text-muted-foreground">—</TableCell>
                    <TableCell className="text-right text-xs font-mono font-semibold text-blue-600 dark:text-blue-400">{fmtCurrency(euer.verpflegungsmehraufwand, privacyMode)}</TableCell>
                  </TableRow>
                )}
                {/* km-Pauschale aus Fahrtenbuch als eigene Zeile */}
                {fahrtAbsetzbar > 0 && (
                  <TableRow className="border-t-2">
                    <TableCell className="text-xs">
                      🚗 km-Pauschale Fahrtenbuch ({fahrtKmDienst.toFixed(0)} km × {kmPauschale.toFixed(2).replace('.', ',')} €)
                      <Badge variant="outline" className="ml-1 text-[9px] text-blue-600 border-blue-300">Fahrtenbuch</Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono text-muted-foreground">—</TableCell>
                    <TableCell className="text-right text-xs font-mono font-semibold text-blue-600 dark:text-blue-400">{fmtCurrency(fahrtAbsetzbar, privacyMode)}</TableCell>
                  </TableRow>
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
            <p className="text-xs text-muted-foreground mt-1">
              Kranken- und Pflegeversicherung, Altersvorsorge und Spenden mindern <strong>nicht</strong> den
              Gewinn deiner EÜR – sie gehören in die Einkommensteuererklärung (Anlage Vorsorgeaufwand bzw.
              Sonderausgaben) und senken dort das zu versteuernde Einkommen. Wer sie als Betriebsausgabe
              bucht, dem streicht das Finanzamt sie wieder heraus.
            </p>
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
            <span>Ausgaben (Cash): <strong className="text-red-600">{fmtCurrency(euer.cashAusgaben, privacyMode)}</strong></span>
            <span>Steuerl. Gewinn: <strong className={gewinnSteuerlich >= 0 ? 'text-violet-600' : 'text-red-600'}>{fmtCurrency(gewinnSteuerlich, privacyMode)}</strong></span>
          </div>
        </CardContent>
      </Card>

      {/* Steuerlicher Hinweis */}
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
        <CardContent className="pt-4">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            ⚠️ <strong>Hinweis:</strong> Diese Auswertung dient nur zur Orientierung und ersetzt keine Steuerberatung. Die AfA-Berechnung basiert auf automatisch erkannten Wirtschaftsgut-Typen und typischen Nutzungsdauern – bitte mit deinem Steuerberater abstimmen. Die 30-%-Kürzung bei der Bewirtung nimmt die App bereits vor. Was sie nicht wissen kann: private Nutzungsanteile bei Telefon, Internet und Fahrzeug sowie eine abweichende Abschreibungsmethode.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
