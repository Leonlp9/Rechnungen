// ─── Die Einnahmen-Überschuss-Rechnung ───────────────────────────────────────
//
// Eine einzige Stelle, an der der Gewinn entsteht. Vorher gab es drei:
// das Dashboard rechnete brutto ohne AfA, der Steuerbericht netto mit AfA, die
// Krankenkassenseite netto ohne AfA. Drei Zahlen für dieselbe Sache, und die
// Krankenkasse bemisst ihren Beitrag ausgerechnet an der Zahl, die dort nicht
// stand.

import type { Invoice } from '@/types';
import {
  abzugsQuote,
  istBetriebsausgabe,
  istBetriebseinnahme,
  istVorsteuerfaehig,
  laeuftUeberAfa,
  wirkungVon,
  zaehltZumUmsatz,
} from './kategorien';
import { werteFuer } from './jahreswerte';

export type Steuerregelung = 'kleinunternehmer' | 'regelbesteuerung';

/**
 * Was die App über den Nutzer wissen muss, um richtig zu rechnen. Alles
 * davon steht in den Einstellungen – nichts ist geraten.
 */
export interface SteuerProfil {
  steuerregelung: Steuerregelung;
  /** Kilometerpauschale für Dienstfahrten (Voreinstellung 0,30 €). */
  kmPauschale: number;
  /**
   * Gehört das Fahrzeug zum Betriebsvermögen? Dann werden die tatsächlichen
   * Kosten abgezogen und die Kilometerpauschale entfällt – beides zusammen
   * wäre ein doppelter Abzug.
   */
  fahrzeugImBetriebsvermoegen: boolean;
}

export const STANDARD_PROFIL: SteuerProfil = {
  steuerregelung: 'kleinunternehmer',
  kmPauschale: 0.30,
  fahrzeugImBetriebsvermoegen: false,
};

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Mit welchem Betrag ein Beleg in die Gewinnermittlung eingeht.
 *
 * Der springende Punkt: Wer die Vorsteuer nicht ziehen darf, für den ist sie
 * Teil der Kosten (§ 9b Abs. 1 EStG). Ein Kleinunternehmer setzt seine
 * Ausgaben deshalb **brutto** an – die amtliche Ausfüllhilfe zur Anlage EÜR
 * sagt das ausdrücklich. Vorher rechnete die App auch für ihn netto und ließ
 * damit rund 16 % der Betriebsausgaben unter den Tisch fallen.
 */
export function euerBetrag(inv: Invoice, regelung: Steuerregelung): number {
  const darfVorsteuerZiehen =
    regelung === 'regelbesteuerung' &&
    (inv.type === 'einnahme' || istVorsteuerfaehig(inv.category));
  return darfVorsteuerZiehen ? inv.netto : inv.brutto;
}

/**
 * Betrag zur Prüfung der GWG-Grenzen. Der bleibt immer netto: Die Grenzen des
 * § 6 Abs. 2 EStG werden ohne Umsatzsteuer gemessen, auch wenn die Vorsteuer
 * nicht abziehbar ist. Ein Monitor für 755,46 € netto / 899 € brutto bleibt
 * damit ein GWG – abgeschrieben werden aber die vollen 899 €.
 */
export function gwgPruefBetrag(inv: Invoice): number {
  return inv.netto;
}

export interface KategorieSumme {
  category: string;
  /** Der tatsächlich geflossene Betrag. */
  betrag: number;
  /** Was davon steuerlich wirkt – bei der Bewirtung 70 %, bei AfA der Jahresbetrag. */
  steuerlich: number;
  wirkung: ReturnType<typeof wirkungVon>;
  anzahl: number;
}

export interface EuerErgebnis {
  jahr: number;
  /** Betriebseinnahmen ohne Privateinlagen und durchlaufende Posten. */
  betriebseinnahmen: number;
  /** Alle Betriebsausgaben inklusive AfA, Kilometerpauschale und Gebühren. */
  betriebsausgaben: number;
  /** Betriebseinnahmen minus Betriebsausgaben – die Zahl für Anlage EÜR. */
  gewinn: number;

  /** Tatsächlicher Geldfluss, ohne AfA-Korrektur – für die Liquiditätssicht. */
  cashEinnahmen: number;
  cashAusgaben: number;
  cashSaldo: number;

  /** Aufteilungen für die Tabellen. */
  einnahmenNachKategorie: KategorieSumme[];
  ausgabenNachKategorie: KategorieSumme[];

  /** Abschreibung des Jahres über alle Wirtschaftsgüter. */
  afaJahresbetrag: number;
  /** Was im Jahr für Anlagevermögen ausgegeben wurde (Kaufpreis, nicht AfA). */
  anlagenZugang: number;
  /** Kilometerpauschale aus dem Fahrtenbuch. */
  kmPauschaleBetrag: number;
  /** Verpflegungsmehraufwand nach § 9 Abs. 4a EStG. */
  verpflegungsmehraufwand: number;
  /** Einbehaltene Gebühren der Zahlungsanbieter – ebenfalls Betriebsausgabe. */
  zahlungsgebuehren: number;
  /** Nicht abziehbarer Teil der Bewirtung (30 %). */
  nichtAbziehbareBewirtung: number;

  /** Umsatzsteuer – nur bei Regelbesteuerung befüllt. */
  umsatzsteuer: number;
  vorsteuer: number;
  zahllast: number;

  /** Gesamtumsatz nach § 19 Abs. 2 UStG für die Kleinunternehmergrenze. */
  gesamtumsatz: number;

  /** Privat abziehbar – mindert das Einkommen, nicht den Gewinn. */
  sonderausgaben: number;
  /**
   * Dieselben Beträge nach Art getrennt. Die Höchstbeträge des § 10 EStG
   * greifen je Topf verschieden, deshalb reicht eine Summe nicht.
   */
  sonderausgabenRoh: {
    krankenPflege: number;
    altersvorsorge: number;
    sonstigeVorsorge: number;
    spenden: number;
  };
  aussergewoehnlicheBelastungen: number;
  haushaltsnaheKosten: number;
  handwerkerKosten: number;

  /** Steuerlich wirkungslose Belege (privat). */
  privat: number;

  /** Belege, die in beiden Wegen zugleich abgezogen würden. */
  warnungen: string[];
}

export interface EuerEingaben {
  invoices: Invoice[];
  jahr: number;
  profil: SteuerProfil;
  /** Dienstkilometer aus dem Fahrtenbuch. */
  dienstKm?: number;
  /** Jahres-AfA, extern berechnet (braucht alle Jahre, nicht nur dieses). */
  afaJahresbetrag?: number;
  /** Verpflegungsmehraufwand: volle Reisetage und An-/Abreise- bzw. 8-Stunden-Tage. */
  reiseTageVoll?: number;
  reiseTageTeil?: number;
  /**
   * Abschreibung des Jahres, aufgeteilt nach Kategorie. Ohne diese Aufteilung
   * stünde in der Ausgabentabelle bei „GWG" und „Anlagevermögen" jeweils die
   * Gesamtabschreibung – oder eine Null.
   */
  afaJeKategorie?: Record<string, number>;
}

/**
 * Rechnet die EÜR für ein Jahr.
 *
 * `afaJahresbetrag` kommt von außen, weil die Abschreibung Belege aus früheren
 * Jahren braucht – die Funktion bekommt aber nur die Belege eines Jahres zu
 * sehen. `berechneAfaFuerJahr` liefert den Wert.
 */
export function berechneEuer({
  invoices,
  jahr,
  profil,
  dienstKm = 0,
  afaJahresbetrag = 0,
  reiseTageVoll = 0,
  reiseTageTeil = 0,
  afaJeKategorie = {},
}: EuerEingaben): EuerErgebnis {
  const jahreswerte = werteFuer(jahr);
  const jahresBelege = invoices.filter((i) => i.year === jahr);
  const regelung = profil.steuerregelung;

  const einnahmenMap = new Map<string, KategorieSumme>();
  const ausgabenMap = new Map<string, KategorieSumme>();

  let betriebseinnahmen = 0;
  let cashEinnahmen = 0;
  let cashAusgaben = 0;
  let umsatzsteuer = 0;
  let vorsteuer = 0;
  let gesamtumsatz = 0;
  let zahlungsgebuehren = 0;
  let sonderausgaben = 0;
  let saKrankenPflege = 0;
  let saAltersvorsorge = 0;
  let saSonstigeVorsorge = 0;
  let saSpenden = 0;
  let aussergewoehnlicheBelastungen = 0;
  let haushaltsnaheKosten = 0;
  let handwerkerKosten = 0;
  let privat = 0;
  let anlagenZugang = 0;
  let laufendeAusgaben = 0;
  let nichtAbziehbareBewirtung = 0;
  let hatFahrzeugkosten = false;

  const erfasse = (
    map: Map<string, KategorieSumme>,
    inv: Invoice,
    betrag: number,
    steuerlich: number,
  ) => {
    const eintrag = map.get(inv.category) ?? {
      category: inv.category,
      betrag: 0,
      steuerlich: 0,
      wirkung: wirkungVon(inv.category),
      anzahl: 0,
    };
    eintrag.betrag = round2(eintrag.betrag + betrag);
    eintrag.steuerlich = round2(eintrag.steuerlich + steuerlich);
    eintrag.anzahl += 1;
    map.set(inv.category, eintrag);
  };

  for (const inv of jahresBelege) {
    if (inv.type === 'info') continue;
    const betrag = euerBetrag(inv, regelung);

    if (inv.type === 'einnahme') {
      cashEinnahmen = round2(cashEinnahmen + inv.brutto);

      if (zaehltZumUmsatz(inv.category)) {
        // Der Gesamtumsatz nach § 19 Abs. 2 UStG bemisst sich am Entgelt,
        // nicht am Gewinn – Gebühren der Plattform mindern ihn nicht. Seit
        // der Neufassung zum 01.01.2025 ist es ein Nettowert; der frühere
        // Zuschlag „zuzüglich der darauf entfallenden Steuer" ist entfallen.
        // Beim Kleinunternehmer sind netto und brutto ohnehin dasselbe.
        gesamtumsatz = round2(gesamtumsatz + inv.netto);
      }

      if (istBetriebseinnahme(inv.category)) {
        betriebseinnahmen = round2(betriebseinnahmen + betrag);
        umsatzsteuer = round2(umsatzsteuer + (inv.ust ?? 0));
        erfasse(einnahmenMap, inv, betrag, betrag);
      } else {
        // Privateinlage, USt-Erstattung, durchlaufender Posten: kein Gewinn.
        erfasse(einnahmenMap, inv, betrag, 0);
      }

      // Was der Zahlungsanbieter einbehält, ist Aufwand – es floss zwar nie
      // aufs Konto, ist aber trotzdem verdient und ausgegeben worden.
      if ((inv.fee ?? 0) > 0) {
        zahlungsgebuehren = round2(zahlungsgebuehren + inv.fee);
      }
      continue;
    }

    // Auch auf Ausgabebelegen steht manchmal eine Gebühr (etwa bei einer
    // Auslandsüberweisung). Sie steckt dort schon im Bruttobetrag und wird
    // deshalb nur mitgezählt, wenn die Kategorie keine Betriebsausgabe ist –
    // sonst wäre sie doppelt abgezogen.
    if (inv.type === 'ausgabe' && (inv.fee ?? 0) > 0 && !istBetriebsausgabe(inv.category)) {
      zahlungsgebuehren = round2(zahlungsgebuehren + inv.fee);
    }

    // ── Ausgaben ──
    cashAusgaben = round2(cashAusgaben + inv.brutto);
    const wirkung = wirkungVon(inv.category);

    if (istBetriebsausgabe(inv.category)) {
      if (regelung === 'regelbesteuerung' && istVorsteuerfaehig(inv.category)) {
        vorsteuer = round2(vorsteuer + (inv.ust ?? 0));
      }
      if (inv.category === 'fahrzeugkosten') hatFahrzeugkosten = true;

      if (laeuftUeberAfa(inv.category)) {
        // Der Kaufpreis fließt nicht in den Gewinn; das erledigt die
        // Abschreibung. Wie viel davon in diesem Jahr wirkt, weiß nur das
        // Wirtschaftsgut-Modul – deshalb wird die Zeile unten nachgetragen.
        anlagenZugang = round2(anlagenZugang + betrag);
        erfasse(ausgabenMap, inv, betrag, 0);
      } else {
        const quote = abzugsQuote(inv.category);
        const wirksam = round2(betrag * quote);
        if (quote < 1) nichtAbziehbareBewirtung = round2(nichtAbziehbareBewirtung + (betrag - wirksam));
        laufendeAusgaben = round2(laufendeAusgaben + wirksam);
        erfasse(ausgabenMap, inv, betrag, wirksam);
      }
      continue;
    }

    // Alles Übrige mindert den Gewinn nicht – aber es ist ein Unterschied,
    // ob es privat abziehbar ist oder gar nicht.
    if (wirkung === 'sonderausgabe') {
      sonderausgaben = round2(sonderausgaben + inv.brutto);
      // Nach Topf sortieren – jeder hat seinen eigenen Höchstbetrag.
      if (inv.category === 'krankenkasse' || inv.category === 'sa_vorsorge') {
        saKrankenPflege = round2(saKrankenPflege + inv.brutto);
      } else if (inv.category === 'sozialversicherung') {
        saAltersvorsorge = round2(saAltersvorsorge + inv.brutto);
      } else if (inv.category === 'sa_versicherungen') {
        saSonstigeVorsorge = round2(saSonstigeVorsorge + inv.brutto);
      } else if (inv.category === 'spenden') {
        saSpenden = round2(saSpenden + inv.brutto);
      }
      // Kinderbetreuung folgt eigenen Regeln (80 %, höchstens 4.800 € je Kind)
      // und wird dort begrenzt, wo sie angezeigt wird – sie bleibt hier nur in
      // der Gesamtsumme.
    }
    else if (wirkung === 'aussergewoehnlich') aussergewoehnlicheBelastungen = round2(aussergewoehnlicheBelastungen + inv.brutto);
    else if (wirkung === 'haushaltsnah') {
      if (inv.category === 'hh_handwerker') handwerkerKosten = round2(handwerkerKosten + inv.brutto);
      else haushaltsnaheKosten = round2(haushaltsnaheKosten + inv.brutto);
    } else privat = round2(privat + inv.brutto);

    erfasse(ausgabenMap, inv, inv.brutto, 0);
  }

  // Die abschreibungspflichtigen Kategorien bekommen jetzt ihren Jahresbetrag
  // in die Spalte „mindert den Gewinn" – der Kaufpreis steht daneben.
  for (const [category, betrag] of Object.entries(afaJeKategorie)) {
    const eintrag = ausgabenMap.get(category);
    if (eintrag) eintrag.steuerlich = round2(betrag);
  }

  // Die Kilometerpauschale gibt es nur für ein Fahrzeug im Privatvermögen.
  // Gehört der Wagen zum Betrieb, zählen die tatsächlichen Kosten.
  const kmPauschaleBetrag = profil.fahrzeugImBetriebsvermoegen
    ? 0
    : round2(dienstKm * profil.kmPauschale);

  const warnungen: string[] = [];
  if (!profil.fahrzeugImBetriebsvermoegen && kmPauschaleBetrag > 0 && hatFahrzeugkosten) {
    warnungen.push(
      'Kilometerpauschale und Fahrzeugkosten sind beide gebucht. Steuerlich geht nur eines von beidem – '
      + 'entweder 0,30 € je Dienstkilometer bei einem Fahrzeug im Privatvermögen oder die tatsächlichen '
      + 'Kosten bei einem Fahrzeug im Betriebsvermögen.',
    );
  }
  if (profil.fahrzeugImBetriebsvermoegen && dienstKm > 0) {
    warnungen.push(
      'Das Fahrzeug steht laut Einstellungen im Betriebsvermögen. Die Kilometerpauschale bleibt deshalb außen vor – '
      + 'abgezogen werden die tatsächlichen Fahrzeugkosten, und die Privatnutzung ist zu versteuern.',
    );
  }

  // Verpflegungspauschalen sind Betriebsausgaben, auch wenn ihnen kein Beleg
  // gegenübersteht (§ 9 Abs. 4a EStG). Die App hat sie bisher nur in der Hilfe
  // erwähnt und nie gerechnet.
  const verpflegungsmehraufwand = round2(
    reiseTageVoll * jahreswerte.verpflegungVollerTag
    + reiseTageTeil * jahreswerte.verpflegungTeilTag,
  );

  const betriebsausgaben = round2(
    laufendeAusgaben + afaJahresbetrag + kmPauschaleBetrag + zahlungsgebuehren
    + verpflegungsmehraufwand,
  );
  const gewinn = round2(betriebseinnahmen - betriebsausgaben);

  // Die Gebühren stecken schon im Bruttobetrag der Einnahme, deshalb sind sie
  // im Cash-Saldo bereits berücksichtigt.
  const cashSaldo = round2(cashEinnahmen - cashAusgaben - zahlungsgebuehren);

  const sortiert = (m: Map<string, KategorieSumme>) =>
    [...m.values()].sort((a, b) => b.betrag - a.betrag);

  return {
    jahr,
    betriebseinnahmen,
    betriebsausgaben,
    gewinn,
    cashEinnahmen,
    cashAusgaben,
    cashSaldo,
    einnahmenNachKategorie: sortiert(einnahmenMap),
    ausgabenNachKategorie: sortiert(ausgabenMap),
    afaJahresbetrag: round2(afaJahresbetrag),
    anlagenZugang,
    kmPauschaleBetrag,
    verpflegungsmehraufwand,
    zahlungsgebuehren,
    nichtAbziehbareBewirtung,
    umsatzsteuer: regelung === 'regelbesteuerung' ? umsatzsteuer : 0,
    vorsteuer: regelung === 'regelbesteuerung' ? vorsteuer : 0,
    zahllast: regelung === 'regelbesteuerung' ? round2(umsatzsteuer - vorsteuer) : 0,
    gesamtumsatz,
    sonderausgaben,
    sonderausgabenRoh: {
      krankenPflege: saKrankenPflege,
      altersvorsorge: saAltersvorsorge,
      sonstigeVorsorge: saSonstigeVorsorge,
      spenden: saSpenden,
    },
    aussergewoehnlicheBelastungen,
    haushaltsnaheKosten,
    handwerkerKosten,
    privat,
    warnungen,
  };
}

/**
 * Monatsgewinne eines Jahres – für die Krankenkassenseite und die
 * Monatsübersicht. Die Abschreibung wird gleichmäßig auf zwölf Monate
 * verteilt, weil sie kein Ereignis eines einzelnen Monats ist.
 */
export function monatsGewinne(
  invoices: Invoice[],
  jahr: number,
  profil: SteuerProfil,
  afaJahresbetrag = 0,
  /**
   * Was nicht an einem Beleg hängt: Kilometerpauschale und
   * Verpflegungsmehraufwand. Ohne diese Umlage wäre die Summe der Monate
   * systematisch höher als der Jahresgewinn.
   */
  belegloseAusgaben = 0,
): Array<{ monat: number; einnahmen: number; ausgaben: number; gewinn: number }> {
  const afaProMonat = (afaJahresbetrag + belegloseAusgaben) / 12;
  return Array.from({ length: 12 }, (_, i) => {
    const monat = i + 1;
    const belege = invoices.filter((inv) => inv.year === jahr && inv.month === monat);
    const teil = berechneEuer({ invoices: belege, jahr, profil });
    const einnahmen = teil.betriebseinnahmen;
    const ausgaben = round2(teil.betriebsausgaben + afaProMonat);
    return { monat, einnahmen, ausgaben, gewinn: round2(einnahmen - ausgaben) };
  });
}

/**
 * Status der Kleinunternehmerregelung. Die 25.000 € gelten für das **Vorjahr**;
 * im laufenden Jahr sind es 100.000 €. Die alte Karte verglich das laufende
 * Jahr mit den 25.000 € und warnte damit zum falschen Zeitpunkt.
 */
export interface KleinunternehmerStatus {
  jahr: number;
  umsatzVorjahr: number;
  umsatzLaufend: number;
  grenzeVorjahr: number;
  grenzeLaufend: number;
  /** War der Vorjahresumsatz zu hoch? Dann gilt in diesem Jahr Regelbesteuerung. */
  vorjahrUeberschritten: boolean;
  /** Ist die laufende Grenze gerissen? Ab 2025 endet der Status sofort. */
  laufendUeberschritten: boolean;
  /** Ab wann die Regelbesteuerung greift. */
  folge: 'bleibt' | 'ab_folgejahr' | 'sofort';
  /** Was bis zur jeweils maßgeblichen Grenze noch frei ist. */
  verbleibendLaufend: number;
}

export function kleinunternehmerStatus(
  invoices: Invoice[],
  jahr: number,
): KleinunternehmerStatus {
  const w = werteFuer(jahr);
  const umsatz = (j: number) =>
    invoices
      .filter((i) => i.year === j && i.type === 'einnahme' && zaehltZumUmsatz(i.category))
      .reduce((s, i) => round2(s + i.netto), 0);

  const umsatzVorjahr = umsatz(jahr - 1);
  const umsatzLaufend = umsatz(jahr);
  const vorjahrUeberschritten = umsatzVorjahr > w.kleinunternehmerVorjahr;
  const laufendUeberschritten = umsatzLaufend > w.kleinunternehmerLaufend;

  let folge: KleinunternehmerStatus['folge'] = 'bleibt';
  if (laufendUeberschritten && w.kleinunternehmerSofortverlust) folge = 'sofort';
  else if (umsatzLaufend > w.kleinunternehmerVorjahr) folge = 'ab_folgejahr';

  return {
    jahr,
    umsatzVorjahr,
    umsatzLaufend,
    grenzeVorjahr: w.kleinunternehmerVorjahr,
    grenzeLaufend: w.kleinunternehmerLaufend,
    vorjahrUeberschritten,
    laufendUeberschritten,
    folge,
    verbleibendLaufend: Math.max(0, round2(w.kleinunternehmerLaufend - umsatzLaufend)),
  };
}

/**
 * Belege, für die trotz § 19 UStG eine Umsatzsteuer-Voranmeldung fällig wird.
 * Die Kleinunternehmerregelung schützt nicht vor § 13b UStG: Wer Leistungen
 * aus dem Ausland bezieht, schuldet die Steuer selbst und darf sie mangels
 * Vorsteuerabzug nicht gegenrechnen.
 */
export function reverseChargePflichten(invoices: Invoice[], jahr: number): Invoice[] {
  return invoices.filter((i) => i.year === jahr && i.category === 'reverse_charge');
}
