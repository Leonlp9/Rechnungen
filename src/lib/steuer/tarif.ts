// ─── Einkommensteuertarif, Soli, Kirchensteuer, Gewerbesteuer ────────────────
//
// Die Steuerrücklage war vorher eine Faustregel: 30 % von allem über dem
// Grundfreibetrag. Das ist unterhalb von etwa 20.000 € Gewinn deutlich zu
// hoch (der Eingangssteuersatz liegt bei 14 %) und oberhalb von 70.000 € zu
// niedrig. Vor allem aber ignorierte die Regel, dass Kranken- und
// Pflegeversicherung als Sonderausgaben das zu versteuernde Einkommen senken –
// bei einem Selbständigen ist das der größte Abzugsposten überhaupt.
//
// Hier steht der Tarif des § 32a EStG so, wie er im Gesetz steht.

import { werteFuer } from './jahreswerte';

interface TarifZonen {
  grundfreibetrag: number;
  /** Obergrenze und Koeffizienten der ersten Progressionszone. */
  zone2Bis: number;
  zone2A: number;
  /** Zweite Progressionszone. */
  zone3Bis: number;
  zone3A: number;
  zone3B: number;
  zone3C: number;
  /** Proportionalzone 42 %. */
  zone4Bis: number;
  zone4Abzug: number;
  /** Zone 5: 45 %. */
  zone5Abzug: number;
}

/**
 * Die Tarifkonstanten je Veranlagungszeitraum. Der Faktor 1400 der zweiten
 * Zone und die 2397 der dritten sind seit Jahren unverändert; angepasst
 * werden Grundfreibetrag, Zonengrenzen und die daraus folgenden Abzüge.
 */
const TARIFE: Record<number, TarifZonen> = {
  2025: {
    grundfreibetrag: 12_096,
    zone2Bis: 17_443,
    zone2A: 932.30,
    zone3Bis: 68_480,
    zone3A: 176.64,
    zone3B: 2_397,
    zone3C: 1_015.13,
    zone4Bis: 277_825,
    zone4Abzug: 10_911.92,
    zone5Abzug: 19_246.67,
  },
  2026: {
    grundfreibetrag: 12_348,
    zone2Bis: 17_799,
    zone2A: 914.51,
    zone3Bis: 69_878,
    zone3A: 173.10,
    zone3B: 2_397,
    zone3C: 1_034.87,
    zone4Bis: 277_825,
    zone4Abzug: 11_135.63,
    zone5Abzug: 19_470.38,
  },
};

const JAHRE_MIT_TARIF = Object.keys(TARIFE).map(Number).sort((a, b) => a - b);

function tarifFuer(jahr: number): TarifZonen {
  if (TARIFE[jahr]) return TARIFE[jahr];
  // Vor dem ersten und nach dem letzten gepflegten Jahr mit dem jeweils
  // nächstgelegenen rechnen, statt gar nichts zu liefern.
  const naechstes = jahr < JAHRE_MIT_TARIF[0]
    ? JAHRE_MIT_TARIF[0]
    : JAHRE_MIT_TARIF[JAHRE_MIT_TARIF.length - 1];
  return TARIFE[naechstes];
}

/** Ob für dieses Jahr echte Tarifwerte vorliegen. */
export function tarifIstGepflegt(jahr: number): boolean {
  return TARIFE[jahr] !== undefined;
}

/**
 * Tarifliche Einkommensteuer nach § 32a Abs. 1 EStG (Grundtarif).
 * Das zu versteuernde Einkommen wird auf volle Euro abgerundet, das Ergebnis
 * ebenso.
 */
export function einkommensteuerGrundtarif(zvE: number, jahr: number): number {
  const t = tarifFuer(jahr);
  const x = Math.floor(Math.max(0, zvE));

  if (x <= t.grundfreibetrag) return 0;

  let steuer: number;
  if (x <= t.zone2Bis) {
    const y = (x - t.grundfreibetrag) / 10_000;
    steuer = (t.zone2A * y + 1_400) * y;
  } else if (x <= t.zone3Bis) {
    const z = (x - t.zone2Bis) / 10_000;
    steuer = (t.zone3A * z + t.zone3B) * z + t.zone3C;
  } else if (x <= t.zone4Bis) {
    steuer = 0.42 * x - t.zone4Abzug;
  } else {
    steuer = 0.45 * x - t.zone5Abzug;
  }

  return Math.floor(steuer);
}

/**
 * Einkommensteuer mit Berücksichtigung des Splittingverfahrens
 * (§ 32a Abs. 5 EStG): Das gemeinsame Einkommen wird halbiert, darauf der
 * Grundtarif angewendet und das Ergebnis verdoppelt.
 */
export function einkommensteuer(zvE: number, jahr: number, zusammenveranlagt = false): number {
  if (!zusammenveranlagt) return einkommensteuerGrundtarif(zvE, jahr);
  return 2 * einkommensteuerGrundtarif(Math.floor(Math.max(0, zvE) / 2), jahr);
}

/**
 * Solidaritätszuschlag. Seit 2021 fällt er erst oberhalb einer Freigrenze an
 * und steigt dann in einer Milderungszone auf 5,5 % zu.
 */
export function solidaritaetszuschlag(
  einkommensteuerBetrag: number,
  jahr: number,
  zusammenveranlagt = false,
): number {
  const freigrenzeEinzel = jahr >= 2026 ? 20_350 : 19_950;
  const freigrenze = zusammenveranlagt ? freigrenzeEinzel * 2 : freigrenzeEinzel;

  if (einkommensteuerBetrag <= freigrenze) return 0;

  // In der Milderungszone: 11,9 % des die Freigrenze übersteigenden Betrags,
  // gedeckelt auf den Regelsatz von 5,5 %.
  const milderung = (einkommensteuerBetrag - freigrenze) * 0.119;
  const regel = einkommensteuerBetrag * 0.055;
  return Math.round(Math.min(milderung, regel) * 100) / 100;
}

/** Kirchensteuer als Prozentsatz der Einkommensteuer (8 % oder 9 %). */
export function kirchensteuer(einkommensteuerBetrag: number, satzProzent: number): number {
  if (satzProzent <= 0) return 0;
  return Math.round(einkommensteuerBetrag * (satzProzent / 100) * 100) / 100;
}

export interface GewerbesteuerErgebnis {
  /** Gewerbeertrag nach Abzug des Freibetrags, auf volle 100 € abgerundet. */
  bemessungsgrundlage: number;
  messbetrag: number;
  steuer: number;
  /** Anrechenbar auf die Einkommensteuer (§ 35 EStG). */
  anrechnung: number;
  /** Was nach der Anrechnung tatsächlich Belastung bleibt. */
  verbleibt: number;
}

/**
 * Gewerbesteuer für einen Einzelunternehmer.
 *
 * Der Gewerbeertrag wird auf volle 100 € abgerundet, um den Freibetrag von
 * 24.500 € gekürzt und mit der Steuermesszahl von 3,5 % multipliziert. Der
 * Messbetrag mal Hebesatz ergibt die Steuer. Über § 35 EStG wird das
 * Vierfache des Messbetrags auf die Einkommensteuer angerechnet – bis zu
 * einem Hebesatz von 400 % bleibt damit rechnerisch nichts hängen.
 */
export function gewerbesteuer(
  gewerbeertrag: number,
  hebesatzProzent: number,
  jahr: number,
  einkommensteuerBetrag = Number.POSITIVE_INFINITY,
): GewerbesteuerErgebnis {
  const w = werteFuer(jahr);
  // Die Reihenfolge der Rundungen ist vorgegeben: erst den Gewerbeertrag auf
  // volle 100 € abrunden, dann den Freibetrag abziehen, dann die Messzahl
  // anwenden und den Messbetrag auf volle Euro abrunden. Vertauscht man das,
  // weicht das Ergebnis vom Bescheid ab.
  const abgerundet = Math.floor(Math.max(0, gewerbeertrag) / 100) * 100;
  const bemessungsgrundlage = Math.max(0, abgerundet - w.gewerbesteuerFreibetrag);
  const messbetrag = Math.floor(bemessungsgrundlage * w.gewerbesteuerMesszahl);
  const steuer = Math.round(messbetrag * (hebesatzProzent / 100) * 100) / 100;

  // Drei Deckel gleichzeitig (§ 35 Abs. 1 EStG): das Vierfache des
  // Messbetrags, die tatsächlich gezahlte Gewerbesteuer und der
  // Ermäßigungshöchstbetrag – also der Anteil der Einkommensteuer, der auf die
  // gewerblichen Einkünfte entfällt. Bei einem reinen Gewerbebetrieb ist das
  // die ganze Einkommensteuer; wer daneben andere Einkünfte hat, bekommt
  // entsprechend weniger angerechnet. Ein Überhang verfällt.
  const anrechnung = Math.round(
    Math.min(messbetrag * w.gewerbesteuerAnrechnungsfaktor, steuer, einkommensteuerBetrag) * 100,
  ) / 100;

  return {
    bemessungsgrundlage,
    messbetrag,
    steuer,
    anrechnung,
    verbleibt: Math.round(Math.max(0, steuer - anrechnung) * 100) / 100,
  };
}

export interface RuecklageEingaben {
  jahr: number;
  /** Gewinn aus der EÜR. */
  gewinn: number;
  /**
   * Sonderausgaben, die das Einkommen mindern. Sie werden hier bereits
   * gedeckelt erwartet – `begrenzeSonderausgaben` erledigt das.
   */
  sonderausgaben: number;
  /**
   * Abweichender Grundfreibetrag. 0 heißt: der amtliche des Jahres. Ein
   * eigener Wert verschiebt den gesamten Tarif, statt nur eine Schwelle zu
   * verändern – sonst stünde in den Einstellungen eine Zahl, die nichts tut.
   */
  grundfreibetragManuell?: number;
  /** Weitere Einkünfte, z. B. aus einem Anstellungsverhältnis. */
  weitereEinkuenfte?: number;
  zusammenveranlagt: boolean;
  kirchensteuerSatz: number;
  /** Nur für Gewerbetreibende. */
  gewerblich: boolean;
  gewerbesteuerHebesatz: number;
}

export interface RuecklageErgebnis {
  /** Zu versteuerndes Einkommen nach Abzug der Sonderausgaben. */
  zvE: number;
  einkommensteuer: number;
  soli: number;
  kirchensteuer: number;
  gewerbesteuer: GewerbesteuerErgebnis | null;
  /** Summe, die zurückgelegt werden sollte. */
  ruecklage: number;
  /** Anteil der Rücklage am Gewinn – die ehrliche Fassung der alten „30 %". */
  quote: number;
  /** Steuersatz auf den nächsten verdienten Euro. */
  grenzsteuersatz: number;
  /** Ob die Berechnung auf gepflegten Tarifwerten beruht. */
  belastbar: boolean;
}

/**
 * Was zurückgelegt werden sollte. Rechnet den echten Tarif, statt pauschal
 * 30 % zu nehmen – und zieht die Sonderausgaben ab, die vorher gar nicht
 * berücksichtigt wurden.
 */
export function steuerRuecklage(e: RuecklageEingaben): RuecklageErgebnis {
  const einkuenfte = e.gewinn + (e.weitereEinkuenfte ?? 0);
  const zvE = Math.max(0, einkuenfte - Math.max(0, e.sonderausgaben));

  // Ein eigener Grundfreibetrag verschiebt den Tarif: Liegt er höher als der
  // amtliche, bleibt entsprechend mehr steuerfrei.
  const amtlich = tarifFuer(e.jahr).grundfreibetrag;
  const eigener = e.grundfreibetragManuell && e.grundfreibetragManuell > 0
    ? e.grundfreibetragManuell
    : amtlich;
  const verschiebung = eigener - amtlich;
  const est = einkommensteuer(Math.max(0, zvE - verschiebung), e.jahr, e.zusammenveranlagt);
  const soli = solidaritaetszuschlag(est, e.jahr, e.zusammenveranlagt);
  const kist = kirchensteuer(est, e.kirchensteuerSatz);

  const gewst = e.gewerblich
    ? gewerbesteuer(e.gewinn, e.gewerbesteuerHebesatz, e.jahr, est)
    : null;

  const ruecklage = Math.round((est + soli + kist + (gewst?.verbleibt ?? 0)) * 100) / 100;

  // Grenzsteuersatz: was der nächste verdiente Euro kostet.
  const estPlus = einkommensteuer(Math.max(0, zvE + 100 - verschiebung), e.jahr, e.zusammenveranlagt);
  const grenzsteuersatz = Math.round(((estPlus - est) / 100) * 1000) / 10;

  return {
    zvE,
    einkommensteuer: est,
    soli,
    kirchensteuer: kist,
    gewerbesteuer: gewst,
    ruecklage,
    quote: e.gewinn > 0 ? Math.round((ruecklage / e.gewinn) * 1000) / 10 : 0,
    grenzsteuersatz,
    belastbar: tarifIstGepflegt(e.jahr),
  };
}

export interface SonderausgabenRoh {
  /** Basisbeiträge zur Kranken- und Pflegeversicherung. */
  krankenPflege: number;
  /** Altersvorsorge: gesetzliche Rente, Versorgungswerk, Rürup. */
  altersvorsorge: number;
  /** Sonstige Vorsorge: Haftpflicht, Unfall, Berufsunfähigkeit. */
  sonstigeVorsorge: number;
  /** Spenden an begünstigte Zwecke. */
  spenden: number;
}

export interface SonderausgabenErgebnis {
  abziehbar: number;
  /** Was durch einen Höchstbetrag verloren geht – für einen ehrlichen Hinweis. */
  gekuerzt: number;
  hinweise: string[];
}

/**
 * Wendet die Höchstbeträge des § 10 EStG an.
 *
 * Vorher wurden Kranken-, Pflege- und Altersvorsorge samt Spenden roh addiert
 * und in voller Höhe vom Einkommen abgezogen. Drei Grenzen fehlten dabei: der
 * Spendenabzug ist auf 20 % des Gesamtbetrags der Einkünfte begrenzt, die
 * Altersvorsorge hat einen Jahreshöchstbetrag, und die sonstigen
 * Vorsorgeaufwendungen teilen sich einen kleinen Topf, der durch die
 * Krankenversicherung fast immer schon ausgeschöpft ist.
 */
export function begrenzeSonderausgaben(
  roh: SonderausgabenRoh,
  jahr: number,
  optionen: { selbstaendig: boolean; gesamtbetragDerEinkuenfte: number },
): SonderausgabenErgebnis {
  const w = werteFuer(jahr);
  const hinweise: string[] = [];
  let gekuerzt = 0;

  // Basisabsicherung: in voller Höhe abziehbar (§ 10 Abs. 1 Nr. 3 EStG).
  const basis = Math.max(0, roh.krankenPflege);

  // Altersvorsorge bis zum Jahreshöchstbetrag.
  const altersMax = w.altersvorsorgeHoechstbetrag * (optionen.selbstaendig ? 1 : 1);
  const alters = Math.min(Math.max(0, roh.altersvorsorge), altersMax);
  if (roh.altersvorsorge > altersMax) {
    gekuerzt += roh.altersvorsorge - alters;
    hinweise.push(`Altersvorsorge ist auf ${altersMax.toLocaleString('de-DE')} € begrenzt.`);
  }

  // Sonstige Vorsorge: eigener Topf, den die Basisabsicherung meist füllt.
  const sonstigeMax = optionen.selbstaendig
    ? w.sonstigeVorsorgeSelbstaendig
    : w.sonstigeVorsorgeArbeitnehmer;
  const sonstigeRest = Math.max(0, sonstigeMax - basis);
  const sonstige = Math.min(Math.max(0, roh.sonstigeVorsorge), sonstigeRest);
  if (roh.sonstigeVorsorge > sonstige) {
    gekuerzt += roh.sonstigeVorsorge - sonstige;
    hinweise.push(
      `Haftpflicht, Unfall und Berufsunfähigkeit teilen sich einen Höchstbetrag von `
      + `${sonstigeMax.toLocaleString('de-DE')} €. Er ist durch die Krankenversicherung bereits `
      + `${basis >= sonstigeMax ? 'vollständig' : 'weitgehend'} ausgeschöpft – von `
      + `${roh.sonstigeVorsorge.toLocaleString('de-DE')} € wirken ${sonstige.toLocaleString('de-DE')} €.`,
    );
  }

  // Spenden bis 20 % des Gesamtbetrags der Einkünfte (§ 10b Abs. 1 EStG).
  const spendenMax = Math.max(0, optionen.gesamtbetragDerEinkuenfte) * w.spendenQuote;
  const spenden = Math.min(Math.max(0, roh.spenden), spendenMax);
  if (roh.spenden > spenden) {
    gekuerzt += roh.spenden - spenden;
    hinweise.push(
      `Spenden wirken höchstens bis ${Math.round(w.spendenQuote * 100)} % des Gesamtbetrags der `
      + `Einkünfte. Der Rest ist nicht verloren – er lässt sich zeitlich unbegrenzt vortragen.`,
    );
  }

  return {
    abziehbar: Math.round((basis + alters + sonstige + spenden) * 100) / 100,
    gekuerzt: Math.round(gekuerzt * 100) / 100,
    hinweise,
  };
}

/**
 * Zumutbare Belastung nach § 33 Abs. 3 EStG.
 *
 * Seit dem BFH-Urteil vom 19.01.2017 (VI R 75/14) wird stufenweise gerechnet:
 * Nur der Teil der Einkünfte, der eine Stufengrenze übersteigt, wird mit dem
 * höheren Satz belastet. Die alte Fassung kannte nur die Sätze für
 * Alleinstehende ohne Kinder.
 */
export function zumutbareBelastung(
  gesamtbetragDerEinkuenfte: number,
  optionen: { kinder: number; zusammenveranlagt: boolean },
): number {
  const STUFE_1 = 15_340;
  const STUFE_2 = 51_130;

  const saetze: [number, number, number] =
    optionen.kinder >= 3 ? [0.01, 0.01, 0.02]
      : optionen.kinder >= 1 ? [0.02, 0.03, 0.04]
        : optionen.zusammenveranlagt ? [0.04, 0.05, 0.06]
          : [0.05, 0.06, 0.07];

  const g = Math.max(0, gesamtbetragDerEinkuenfte);
  const teil1 = Math.min(g, STUFE_1);
  const teil2 = Math.max(0, Math.min(g, STUFE_2) - STUFE_1);
  const teil3 = Math.max(0, g - STUFE_2);

  return Math.round((teil1 * saetze[0] + teil2 * saetze[1] + teil3 * saetze[2]) * 100) / 100;
}
