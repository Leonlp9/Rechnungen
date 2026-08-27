// Steuerbericht für Angestellte.
//
// Für einen Betrieb rechnet die App eine EÜR: Einnahmen minus Ausgaben, dazu
// Umsatzsteuer. Nichts davon trifft auf ein Arbeitsverhältnis zu. Was zählt,
// steht in der Steuererklärung an vier Stellen – und danach ist diese Seite
// gebaut:
//
//   Werbungskosten (Anlage N)   Alles rund um den Job. Wirkt erst über dem
//                               Arbeitnehmer-Pauschbetrag von 1.230 €, den
//                               das Finanzamt ohnehin abzieht.
//   Sonderausgaben              Vorsorge, Versicherungen, Spenden.
//   Außergewöhnliche Belastungen  Krankheit, Pflege – wirken erst über der
//                               zumutbaren Belastung (1–7 % der Einkünfte).
//   § 35a EStG                  Haushaltsnahe Dienstleistungen und
//                               Handwerker: 20 % gehen direkt von der Steuer
//                               ab, nicht bloß vom Einkommen.
//
// Die Zahlenwerte stehen nicht mehr hier, sondern in src/lib/steuer/jahreswerte
// – je Veranlagungszeitraum. Vorher war 0,38 €/km fest verdrahtet, obwohl der
// Satz erst ab 2026 ab dem ersten Kilometer gilt; für 2025 rechnete die Seite
// damit rund ein Viertel zu viel.

import { useEffect, useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListGroup, ListRow } from '@/components/ui/list-group';
import { FormGroup, FormRow, FIELD } from '@/components/ui/form-list';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAllInvoices, salaries as salaryDb, salaryExtras as extraDb } from '@/lib/db';
import { salaryYear } from '@/lib/salary';
import { fmtCurrency } from '@/lib/utils';
import { useAppStore } from '@/store';
import { useIsMobile } from '@/hooks/useIsMobile';
import {
  WERBUNGSKOSTEN_CATEGORIES,
  EMPLOYEE_SONDERAUSGABEN_CATEGORIES,
  AUSSERGEWOEHNLICHE_CATEGORIES,
  CATEGORY_LABELS,
} from '@/types';
import { werteFuer, entfernungspauschale, istFortgeschrieben } from '@/lib/steuer/jahreswerte';
import { zumutbareBelastung } from '@/lib/steuer/tarif';
import type { Invoice, Salary, SalaryExtra } from '@/types';



export default function SteuerberichtAngestellt() {
  const isMobile = useIsMobile();
  const selectedYear = useAppStore((s) => s.selectedYear);
  const setSelectedYear = useAppStore((s) => s.setSelectedYear);
  const privacyMode = useAppStore((s) => s.privacyMode);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const pendlerKm = useAppStore((s) => s.pendlerKm);
  const setPendlerKm = useAppStore((s) => s.setPendlerKm);
  const pendlerTage = useAppStore((s) => s.pendlerTage);
  const setPendlerTage = useAppStore((s) => s.setPendlerTage);
  const homeofficeTage = useAppStore((s) => s.homeofficeTage);
  const setHomeofficeTage = useAppStore((s) => s.setHomeofficeTage);
  const kinder = useAppStore((s) => s.kinder);
  const verheiratet = useAppStore((s) => s.verheiratet);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [salaryList, setSalaryList] = useState<Salary[]>([]);
  const [extras, setExtras] = useState<SalaryExtra[]>([]);

  useEffect(() => {
    getAllInvoices().then(setInvoices).catch(console.error);
    salaryDb.getAll().then(setSalaryList).catch(console.error);
    extraDb.getAll().then(setExtras).catch(console.error);
  }, [dataVersion]);

  const jahresBelege = useMemo(
    () => invoices.filter((i) => i.year === selectedYear && i.type === 'ausgabe'),
    [invoices, selectedYear],
  );

  const years = useMemo(() => {
    const ys = [...new Set(invoices.map((i) => i.year))].sort((a, b) => b - a);
    if (!ys.includes(new Date().getFullYear())) ys.unshift(new Date().getFullYear());
    return ys;
  }, [invoices]);

  /** Summe der Bruttobeträge einer Kategoriengruppe. */
  const summe = (cats: readonly string[]) =>
    jahresBelege.filter((i) => cats.includes(i.category)).reduce((s, i) => s + i.brutto, 0);

  const gehalt = useMemo(
    () => salaryYear(salaryList, extras, selectedYear),
    [salaryList, extras, selectedYear],
  );

  // Alle Beträge kommen aus der Jahrestabelle – für das Jahr, das oben
  // gewählt ist, nicht für das laufende.
  const w = werteFuer(selectedYear);
  const ARBEITNEHMER_PAUSCHBETRAG = w.arbeitnehmerPauschbetrag;

  // ── Werbungskosten ──
  // Die Entfernungspauschale ist gestaffelt, solange das Jahr die Staffel
  // kennt: bis 2025 waren es 0,30 € für die ersten 20 Kilometer und erst ab
  // dem 21. 0,38 €. Seit 2026 gilt einheitlich 0,38 € ab dem ersten.
  const pendlerRoh = entfernungspauschale(selectedYear, pendlerKm, pendlerTage);
  const pendlerGedeckelt = Math.min(pendlerRoh, w.entfernungHoechstbetrag);
  const pendlerpauschale = pendlerGedeckelt;
  const homeofficeTageWirksam = Math.min(homeofficeTage, w.homeofficeMaxTage);
  const homeofficePauschale = homeofficeTageWirksam * w.homeofficeSatz;
  const werbungskostenBelege = summe(WERBUNGSKOSTEN_CATEGORIES);
  const werbungskosten = werbungskostenBelege + pendlerpauschale + homeofficePauschale;
  const ueberPauschbetrag = werbungskosten - ARBEITNEHMER_PAUSCHBETRAG;

  // Für einen Tag gibt es entweder die Entfernungspauschale oder die
  // Homeoffice-Pauschale, nicht beides. Gerechnet wird stur addiert – deshalb
  // hier wenigstens der Hinweis, wenn die Tageszahlen nicht zusammenpassen.
  const tageZusammen = pendlerTage + homeofficeTageWirksam;
  const tageUnplausibel = tageZusammen > 230;

  // ── § 35a ──
  const haushaltKosten = summe(['hh_dienstleistung']);
  const handwerkerKosten = summe(['hh_handwerker']);
  const haushaltAbzug = Math.min(haushaltKosten, w.haushaltsnahMax) * w.paragraf35aSatz;
  const handwerkerAbzug = Math.min(handwerkerKosten, w.handwerkerMax) * w.paragraf35aSatz;

  // ── Sonderausgaben & außergewöhnliche Belastungen ──
  // Kinderbetreuung wirkt nur zu 80 %, höchstens 4.800 € je Kind (seit 2025;
  // davor zwei Drittel und 4.000 €). Vorher zählte die App den vollen Betrag.
  const kinderbetreuungRoh = summe(['sa_kinderbetreuung']);
  const kinderbetreuungWirksam = Math.min(
    kinderbetreuungRoh * w.kinderbetreuungQuote,
    w.kinderbetreuungMax * Math.max(1, kinder),
  );
  const sonstigeVorsorgeRoh = summe(['sa_versicherungen']);
  const uebrigeSonderausgaben = summe(
    EMPLOYEE_SONDERAUSGABEN_CATEGORIES.filter(
      (c) => c !== 'sa_kinderbetreuung' && c !== 'sa_versicherungen',
    ),
  );
  const sonderausgaben = uebrigeSonderausgaben + kinderbetreuungWirksam + sonstigeVorsorgeRoh;

  const agbKosten = summe(AUSSERGEWOEHNLICHE_CATEGORIES);
  // Bemessungsgrundlage ist der Gesamtbetrag der Einkünfte, also der Bruttolohn
  // abzüglich der Werbungskosten – mindestens des Pauschbetrags.
  const gesamtbetragEinkuenfte = Math.max(0, gehalt.gross - Math.max(werbungskosten, ARBEITNEHMER_PAUSCHBETRAG));
  const grenze = zumutbareBelastung(gesamtbetragEinkuenfte, { kinder, zusammenveranlagt: verheiratet });
  const agbWirksam = Math.max(0, agbKosten - grenze);

  /** Einzelposten einer Gruppe, nach Höhe sortiert – für die Aufschlüsselung. */
  /**
   * Was von einem Rohbetrag tatsächlich wirkt. Nur die Kinderbetreuung wird
   * gekürzt – ohne diesen Hinweis stünde in der Aufschlüsselung ein anderer
   * Betrag als in der Summe darüber.
   */
  const wirksamerAnteil = (cat: string, roh: number): string | null => {
    if (cat !== 'sa_kinderbetreuung') return null;
    const wirksam = Math.min(roh * w.kinderbetreuungQuote, w.kinderbetreuungMax * Math.max(1, kinder));
    if (Math.abs(wirksam - roh) < 0.005) return null;
    return `${Math.round(w.kinderbetreuungQuote * 100)} % wirken, höchstens ${euro(w.kinderbetreuungMax)} je Kind – hier ${euro(wirksam)}`;
  };

  const posten = (cats: readonly string[]) => {
    const map = new Map<string, number>();
    for (const beleg of jahresBelege) {
      if (!cats.includes(beleg.category)) continue;
      map.set(beleg.category, (map.get(beleg.category) ?? 0) + beleg.brutto);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  };

  const euro = (v: number) => fmtCurrency(v, privacyMode);

  /** „einzeln veranlagt, ohne Kinder" – die Angaben, mit denen gerechnet wird. */
  const veranlagung = `${verheiratet ? 'zusammenveranlagt' : 'einzeln veranlagt'}, ${
    kinder === 0 ? 'ohne Kinder' : kinder === 1 ? '1 Kind' : `${kinder} Kinder`
  }`;

  const jahrWahl = (
    <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
      <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
      <SelectContent>
        {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  // ─── Handy ───────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="space-y-8 pb-6">
        <PageHeader title="Steuerbericht" subtitle={`Angestellt · ${selectedYear}`} actions={jahrWahl} />

        <ListGroup
          title="Einkommen"
          footer="Aus den Gehaltsstufen und Einmalzahlungen – nicht aus Belegen."
        >
          <ListRow label="Bruttolohn" value={euro(gehalt.gross)} noChevron />
          {gehalt.net > 0 && <ListRow label="Netto" value={euro(gehalt.net)} noChevron />}
        </ListGroup>

        <ListGroup
          title="Werbungskosten"
          footer={
            ueberPauschbetrag > 0
              ? `Du liegst ${euro(ueberPauschbetrag)} über dem Pauschbetrag von ${euro(ARBEITNEHMER_PAUSCHBETRAG)} – nur dieser Teil senkt die Steuer zusätzlich.`
              : `Noch ${euro(-ueberPauschbetrag)} bis zum Pauschbetrag von ${euro(ARBEITNEHMER_PAUSCHBETRAG)}. Bis dahin zieht das Finanzamt ihn ohnehin ab.`
          }
        >
          <ListRow label="Belege" value={euro(werbungskostenBelege)} noChevron />
          <ListRow
            label="Pendlerpauschale"
            hint={`${pendlerKm} km × ${pendlerTage} Tage${w.entfernungBis20 === w.entfernungAb21 ? ` × ${w.entfernungBis20.toFixed(2).replace('.', ',')} €` : ` · ${w.entfernungBis20.toFixed(2).replace('.', ',')} € bis km 20, dann ${w.entfernungAb21.toFixed(2).replace('.', ',')} €`}`}
            value={euro(pendlerpauschale)}
            noChevron
          />
          <ListRow
            label="Homeoffice"
            hint={`${homeofficeTageWirksam} Tage × ${w.homeofficeSatz} €`}
            value={euro(homeofficePauschale)}
            noChevron
          />
          <ListRow label="Zusammen" value={euro(werbungskosten)} noChevron />
        </ListGroup>

        <FormGroup
          title="Angaben zur Fahrt"
          footer={`Einfache Entfernung zur Arbeit und die Tage, an denen du dort warst. Homeoffice-Tage zählen getrennt – am selben Tag geht nur eines von beidem.${
            tageUnplausibel
              ? ` Zusammen sind das ${tageZusammen} Tage; ein Arbeitsjahr hat etwa 220 bis 230. Prüf die Aufteilung, sonst wird doppelt gezählt.`
              : ''
          }${
            pendlerRoh > pendlerGedeckelt
              ? ` Die Entfernungspauschale ist auf ${euro(w.entfernungHoechstbetrag)} gedeckelt, wenn du kein eigenes Auto nutzt – aus ${euro(pendlerRoh)} werden dann ${euro(pendlerGedeckelt)}.`
              : ''
          }${istFortgeschrieben(selectedYear) ? ` Für ${selectedYear} liegen noch keine amtlichen Werte vor; gerechnet wird mit dem letzten bekannten Stand.` : ''}`}
        >
          <FormRow label="Entfernung (km)">
            <input
              type="number"
              inputMode="decimal"
              className={FIELD}
              value={pendlerKm || ''}
              onChange={(e) => setPendlerKm(Number(e.target.value) || 0)}
              placeholder="0"
            />
          </FormRow>
          <FormRow label="Arbeitstage">
            <input
              type="number"
              inputMode="numeric"
              className={FIELD}
              value={pendlerTage || ''}
              onChange={(e) => setPendlerTage(Number(e.target.value) || 0)}
              placeholder="0"
            />
          </FormRow>
          <FormRow label="Homeoffice-Tage">
            <input
              type="number"
              inputMode="numeric"
              className={FIELD}
              value={homeofficeTage || ''}
              onChange={(e) => setHomeofficeTage(Number(e.target.value) || 0)}
              placeholder="0"
            />
          </FormRow>
        </FormGroup>

        <ListGroup
          title="Haushalt (§ 35a)"
          footer="20 % der Arbeitskosten gehen direkt von der Steuer ab – nicht nur vom Einkommen. Materialkosten zählen nicht mit, und bezahlt sein muss per Überweisung."
        >
          <ListRow label="Dienstleistungen" hint={`von ${euro(haushaltKosten)}`} value={euro(haushaltAbzug)} noChevron />
          <ListRow label="Handwerker" hint={`von ${euro(handwerkerKosten)}`} value={euro(handwerkerAbzug)} noChevron />
          <ListRow label="Steuerabzug" value={euro(haushaltAbzug + handwerkerAbzug)} noChevron />
        </ListGroup>

        <ListGroup
          title="Sonderausgaben"
          footer={`Vorsorge, Versicherungen, Kinderbetreuung und Spenden.${
            kinderbetreuungRoh > 0
              ? ` Von ${euro(kinderbetreuungRoh)} Kinderbetreuung wirken ${Math.round(w.kinderbetreuungQuote * 100)} %, höchstens ${euro(w.kinderbetreuungMax)} je Kind – hier ${euro(kinderbetreuungWirksam)}.`
              : ''
          }${
            sonstigeVorsorgeRoh > 0
              ? ` Haftpflicht, Unfall und Berufsunfähigkeit teilen sich einen Höchstbetrag von ${euro(w.sonstigeVorsorgeArbeitnehmer)}, der durch die Krankenversicherung meist schon ausgeschöpft ist – dann wirken sie sich nicht mehr aus.`
              : ''
          }`}
        >
          {posten(EMPLOYEE_SONDERAUSGABEN_CATEGORIES).map(([cat, betrag]) => (
            <ListRow
              key={cat}
              label={CATEGORY_LABELS[cat as never]}
              hint={wirksamerAnteil(cat, betrag) ?? undefined}
              value={euro(betrag)}
              noChevron
            />
          ))}
          <ListRow label="Zusammen" value={euro(sonderausgaben)} noChevron />
        </ListGroup>

        <ListGroup
          title="Außergewöhnliche Belastungen"
          footer={`Wirken erst über der zumutbaren Belastung – geschätzt ${euro(grenze)} bei deinem Einkommen (${veranlagung}).`}
        >
          <ListRow label="Gesammelt" value={euro(agbKosten)} noChevron />
          <ListRow label="Davon wirksam" value={euro(agbWirksam)} noChevron />
        </ListGroup>

        <p className="px-4 text-[13px] leading-snug text-muted-foreground">
          Alle Angaben sind Anhaltspunkte, keine Steuerberatung. Was am Ende zählt, entscheidet dein Finanzamt.
        </p>
      </div>
    );
  }

  // ─── Rechner ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Steuerbericht</h1>
          <p className="text-sm text-muted-foreground">Angestellt · Steuerjahr {selectedYear}</p>
        </div>
        {jahrWahl}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="space-y-1 pt-5">
            <p className="text-xs text-muted-foreground">Bruttolohn</p>
            <p className="text-2xl font-bold">{euro(gehalt.gross)}</p>
            <p className="text-xs text-muted-foreground">aus Gehalt und Sonderzahlungen</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 pt-5">
            <p className="text-xs text-muted-foreground">Werbungskosten</p>
            <p className="text-2xl font-bold">{euro(werbungskosten)}</p>
            <p className="text-xs text-muted-foreground">
              {ueberPauschbetrag > 0
                ? `${euro(ueberPauschbetrag)} über dem Pauschbetrag`
                : `${euro(-ueberPauschbetrag)} bis zum Pauschbetrag`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 pt-5">
            <p className="text-xs text-muted-foreground">§ 35a Steuerabzug</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {euro(haushaltAbzug + handwerkerAbzug)}
            </p>
            <p className="text-xs text-muted-foreground">direkt von der Steuer</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 pt-5">
            <p className="text-xs text-muted-foreground">Sonderausgaben</p>
            <p className="text-2xl font-bold">{euro(sonderausgaben)}</p>
            <p className="text-xs text-muted-foreground">Vorsorge, Spenden &amp; Co.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Werbungskosten im Einzelnen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {posten(WERBUNGSKOSTEN_CATEGORIES).map(([cat, betrag]) => (
              <div key={cat} className="flex justify-between gap-3 border-b border-border/60 pb-1">
                <span className="text-muted-foreground">{CATEGORY_LABELS[cat as never]}</span>
                <span className="font-medium">{euro(betrag)}</span>
              </div>
            ))}
            <div className="flex justify-between gap-3 border-b border-border/60 pb-1">
              <span className="text-muted-foreground">
                Pendlerpauschale ({pendlerKm} km × {pendlerTage} Tage{w.entfernungBis20 === w.entfernungAb21 ? ` × ${w.entfernungBis20.toFixed(2).replace('.', ',')} €` : ` · ${w.entfernungBis20.toFixed(2).replace('.', ',')} € bis km 20, dann ${w.entfernungAb21.toFixed(2).replace('.', ',')} €`})
                {pendlerRoh > pendlerGedeckelt && (
                  <span className="block text-[11px] text-muted-foreground">
                    aus {euro(pendlerRoh)} gedeckelt auf {euro(w.entfernungHoechstbetrag)} – der Höchstbetrag gilt, wenn du keinen eigenen Pkw nutzt
                  </span>
                )}
              </span>
              <span className="font-medium">{euro(pendlerpauschale)}</span>
            </div>
            <div className="flex justify-between gap-3 border-b border-border/60 pb-1">
              <span className="text-muted-foreground">
                Homeoffice ({homeofficeTageWirksam} × {w.homeofficeSatz} €)
              </span>
              <span className="font-medium">{euro(homeofficePauschale)}</span>
            </div>
            <div className="flex justify-between gap-3 pt-1 font-semibold">
              <span>Zusammen</span>
              <span>{euro(werbungskosten)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Fahrt & Homeoffice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <label className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Einfache Entfernung (km)</span>
              <input
                type="number"
                className="w-28 rounded-md border border-input bg-background px-2 py-1 text-right"
                value={pendlerKm || ''}
                onChange={(e) => setPendlerKm(Number(e.target.value) || 0)}
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Tage im Büro</span>
              <input
                type="number"
                className="w-28 rounded-md border border-input bg-background px-2 py-1 text-right"
                value={pendlerTage || ''}
                onChange={(e) => setPendlerTage(Number(e.target.value) || 0)}
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Tage im Homeoffice</span>
              <input
                type="number"
                className="w-28 rounded-md border border-input bg-background px-2 py-1 text-right"
                value={homeofficeTage || ''}
                onChange={(e) => setHomeofficeTage(Number(e.target.value) || 0)}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              0,38 € je Entfernungskilometer ab dem ersten Kilometer, 6 € je Homeoffice-Tag (höchstens
              210 Tage). Am selben Tag zählt nur eines von beidem.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Haushalt (§ 35a EStG)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Dienstleistungen (max. {euro(w.haushaltsnahMax)})</span>
              <span className="font-medium">{euro(haushaltKosten)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Handwerker (max. {euro(w.handwerkerMax)})</span>
              <span className="font-medium">{euro(handwerkerKosten)}</span>
            </div>
            <div className="flex justify-between gap-3 border-t border-border pt-2 font-semibold">
              <span>20 % gehen von der Steuer ab</span>
              <span className="text-emerald-600 dark:text-emerald-400">
                {euro(haushaltAbzug + handwerkerAbzug)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Nur der Arbeitsanteil zählt – Material nicht. Und die Rechnung muss überwiesen sein, bar
              erkennt das Finanzamt sie nicht an.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sonderausgaben & außergewöhnliche Belastungen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {posten(EMPLOYEE_SONDERAUSGABEN_CATEGORIES).map(([cat, betrag]) => (
              <div key={cat} className="flex justify-between gap-3">
                <span className="text-muted-foreground">
                  {CATEGORY_LABELS[cat as never]}
                  {wirksamerAnteil(cat, betrag) && (
                    <span className="block text-[11px]">{wirksamerAnteil(cat, betrag)}</span>
                  )}
                </span>
                <span className="font-medium">{euro(betrag)}</span>
              </div>
            ))}
            <div className="flex justify-between gap-3 border-t border-border pt-2">
              <span className="text-muted-foreground">Außergewöhnliche Belastungen</span>
              <span className="font-medium">{euro(agbKosten)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">davon wirksam (über {euro(grenze)})</span>
              <span className="font-medium">{euro(agbWirksam)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
        <CardContent className="flex gap-2 pt-4 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="text-muted-foreground">
            Anhaltspunkte, keine Steuerberatung. Die zumutbare Belastung ist nach deinen Angaben unter
            Profil und Steuer gerechnet ({veranlagung}).
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
