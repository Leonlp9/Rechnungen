// ─── Wirtschaftsgüter: GWG, lineare und degressive Abschreibung ──────────────
//
// Drei Dinge fehlten oder waren falsch:
//
//  1. Die Bemessungsgrundlage. Wer keine Vorsteuer ziehen darf, schreibt den
//     Bruttobetrag ab (§ 9b Abs. 1 EStG). Die App nahm immer netto.
//  2. Die selbständige Nutzungsfähigkeit. Ein Monitor ist kein geringwertiges
//     Wirtschaftsgut – er lässt sich ohne Rechner nicht nutzen (§ 6 Abs. 2
//     Satz 2 EStG). Bildschirme, Drucker und Tastaturen fallen deshalb aus der
//     GWG-Regel heraus, auch wenn sie unter 800 € liegen.
//  3. Die degressive Abschreibung. Für bewegliche Wirtschaftsgüter, die
//     zwischen dem 01.07.2025 und dem 31.12.2027 angeschafft werden, sind
//     30 % vom Restbuchwert erlaubt (§ 7 Abs. 2 EStG in der Fassung des
//     Investitionssofortprogramms). Im ersten Jahr ist das oft das Doppelte
//     der linearen Abschreibung.

import type { Invoice } from '@/types';
import { guessAssetType, getNutzungsdauer, NUTZUNGSDAUER_LABELS } from '@/lib/afa';
import { euerBetrag, gwgPruefBetrag, type Steuerregelung } from './gewinn';
import { werteFuer } from './jahreswerte';

export type AfaMethode = 'sofort' | 'gwg' | 'pool' | 'linear' | 'degressiv' | 'einjaehrig';

export const AFA_METHODE_LABELS: Record<AfaMethode, string> = {
  sofort: 'Sofortabzug',
  gwg: 'GWG-Sofortabschreibung',
  pool: 'Sammelposten über 5 Jahre',
  linear: 'Lineare AfA',
  degressiv: 'Degressive AfA (30 %)',
  einjaehrig: 'Nutzungsdauer 1 Jahr',
};

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Wirtschaftsgüter, die nur zusammen mit einem anderen Gerät nutzbar und
 * technisch darauf abgestimmt sind, sind nicht selbständig nutzungsfähig
 * (§ 6 Abs. 2 Satz 2 EStG). Der BFH zählt Bildschirm, Drucker und Tastatur
 * ausdrücklich dazu – sie können deshalb weder GWG sein noch in einen
 * Sammelposten.
 */
export function istSelbstaendigNutzbar(assetType: string): boolean {
  return !['monitor', 'drucker'].includes(assetType);
}

/**
 * Computerhardware samt Peripherie und Software darf mit einer
 * betriebsgewöhnlichen Nutzungsdauer von einem Jahr angesetzt werden
 * (BMF-Schreiben vom 22.02.2022). Dabei entfällt die monatsgenaue Aufteilung:
 * Der volle Betrag wirkt im Anschaffungsjahr.
 */
export function istDigitalesWirtschaftsgut(assetType: string): boolean {
  return ['computer', 'monitor', 'drucker', 'software'].includes(assetType);
}

/**
 * Zeitfenster der degressiven Abschreibung. Software und andere immaterielle
 * Wirtschaftsgüter sind ausgenommen – begünstigt sind nur bewegliche
 * Wirtschaftsgüter des Anlagevermögens.
 */
export function degressivZulaessig(datum: string, assetType: string): boolean {
  if (assetType === 'software') return false;
  const d = new Date(datum);
  if (Number.isNaN(d.getTime())) return false;
  return d >= new Date('2025-07-01') && d < new Date('2028-01-01');
}

export interface AfaJahr {
  jahr: number;
  betrag: number;
  restwert: number;
  methode: AfaMethode;
  /** Monate, die im Jahr angesetzt wurden – 12 außer im ersten und letzten. */
  monate: number;
}

/**
 * Abschreibungsplan über die gesamte Nutzungsdauer.
 *
 * Bei der degressiven Abschreibung wird zur linearen gewechselt, sobald das
 * mehr bringt – ohne diesen Wechsel würde der Restbuchwert rechnerisch nie
 * null erreichen. Der Wechsel ist nach § 7 Abs. 3 EStG erlaubt, der Rückweg
 * nicht.
 */
export function abschreibungsplan(
  kosten: number,
  kaufdatum: string,
  nutzungsdauer: number,
  methode: AfaMethode,
  /** Wirtschaftsgut-Typ – entscheidet, ob degressiv überhaupt zulässig ist. */
  assetType = 'sonstiges',
): AfaJahr[] {
  const kauf = new Date(kaufdatum);
  const kaufJahr = kauf.getFullYear();
  const kaufMonat = kauf.getMonth() + 1;
  const monateErstesJahr = 13 - kaufMonat;
  const w = werteFuer(kaufJahr);

  // Eine gespeicherte Methodenwahl darf das Zeitfenster des § 7 Abs. 2 EStG
  // nicht aushebeln: Wer ein Gerät vor dem 01.07.2025 gekauft hat, bekommt
  // die lineare Abschreibung, auch wenn „degressiv" gespeichert war.
  if (methode === 'degressiv' && !degressivZulaessig(kaufdatum, assetType)) {
    methode = 'linear';
  }

  if (methode === 'sofort' || methode === 'gwg' || methode === 'einjaehrig') {
    // Voller Abzug im Anschaffungsjahr, keine Zwölftelung.
    return [{ jahr: kaufJahr, betrag: round2(kosten), restwert: 0, methode, monate: 12 }];
  }

  if (methode === 'pool') {
    // Der Sammelposten kennt keine zeitanteilige Aufteilung.
    const jahre = w.sammelpostenJahre;
    const rate = round2(kosten / jahre);
    const plan: AfaJahr[] = [];
    let rest = kosten;
    for (let i = 0; i < jahre; i++) {
      const betrag = i < jahre - 1 ? rate : round2(rest);
      rest = round2(rest - betrag);
      plan.push({ jahr: kaufJahr + i, betrag, restwert: rest, methode, monate: 12 });
    }
    return plan;
  }

  if (methode === 'degressiv') {
    const satz = Math.min(3 / nutzungsdauer, 0.30);
    const plan: AfaJahr[] = [];
    let rest = kosten;
    // Gesamte Abschreibungsdauer in Monaten, ab dem Anschaffungsmonat.
    let restMonate = nutzungsdauer * 12;
    let gewechselt = false;
    let lineareRate = 0;

    for (let i = 0; restMonate > 0 && rest > 0.005; i++) {
      const monate = i === 0 ? monateErstesJahr : Math.min(12, restMonate);

      if (!gewechselt) {
        // Wechseln, sobald die lineare Verteilung des Restbuchwerts über die
        // Restnutzungsdauer mehr ergibt als der degressive Satz.
        const degressiv = rest * satz * (monate / 12);
        const linear = rest * (monate / restMonate);
        if (linear > degressiv) {
          gewechselt = true;
          lineareRate = rest / restMonate; // je Monat
        }
      }

      let betrag = gewechselt
        ? round2(lineareRate * monate)
        : round2(rest * satz * (monate / 12));
      if (betrag > rest || restMonate - monate <= 0) betrag = round2(rest);

      rest = round2(rest - betrag);
      plan.push({
        jahr: kaufJahr + i,
        betrag,
        restwert: rest,
        methode: gewechselt ? 'linear' : 'degressiv',
        monate,
      });
      restMonate -= monate;
    }
    return plan;
  }

  // Lineare AfA, monatsgenau im ersten Jahr (§ 7 Abs. 1 Satz 4 EStG).
  const monatsAfa = kosten / (nutzungsdauer * 12);
  const plan: AfaJahr[] = [];
  let rest = kosten;
  let restMonate = nutzungsdauer * 12;
  for (let i = 0; restMonate > 0 && rest > 0.005; i++) {
    const monate = i === 0 ? monateErstesJahr : Math.min(12, restMonate);
    let betrag = round2(monatsAfa * monate);
    if (betrag > rest || restMonate - monate <= 0) betrag = round2(rest);
    rest = round2(rest - betrag);
    plan.push({ jahr: kaufJahr + i, betrag, restwert: rest, methode: 'linear', monate });
    restMonate -= monate;
  }
  return plan;
}

export interface AnlageGut {
  invoice: Invoice;
  assetType: string;
  assetLabel: string;
  /** Betrag, der abgeschrieben wird – brutto ohne Vorsteuerabzug. */
  bemessung: number;
  /** Nettobetrag, an dem die Wertgrenzen gemessen werden. */
  pruefBetrag: number;
  selbstaendigNutzbar: boolean;
  nutzungsdauer: number;
  methode: AfaMethode;
  /** Wäre die degressive Abschreibung wählbar? */
  degressivMoeglich: boolean;
  /** Was die degressive Abschreibung im gewählten Jahr brächte. */
  degressivImJahr: number;
  /** Was die lineare Abschreibung im gewählten Jahr brächte. */
  linearImJahr: number;
  jahresAfa: number;
  restbuchwert: number;
  plan: AfaJahr[];
  /** Erklärt die Einordnung, wenn sie nicht selbsterklärend ist. */
  hinweis?: string;
}

/**
 * Empfohlene Methode. Ausschlaggebend ist, was im Anschaffungsjahr am meisten
 * abzieht – bei kleinen Beträgen der Sofortabzug, sonst degressiv, solange das
 * Zeitfenster offen ist.
 */
export function empfohleneMethode(
  pruefBetrag: number,
  datum: string,
  assetType: string,
  jahr: number,
): AfaMethode {
  const w = werteFuer(jahr);
  if (istDigitalesWirtschaftsgut(assetType)) return 'einjaehrig';
  if (pruefBetrag <= w.gwgDirektGrenze) return 'sofort';
  if (pruefBetrag <= w.gwgSofortGrenze && istSelbstaendigNutzbar(assetType)) return 'gwg';
  if (degressivZulaessig(datum, assetType)) return 'degressiv';
  return 'linear';
}

/** Erlaubte Methoden für ein Wirtschaftsgut – für die Auswahl in der Oberfläche. */
export function moeglicheMethoden(
  pruefBetrag: number,
  datum: string,
  assetType: string,
  jahr: number,
): AfaMethode[] {
  const w = werteFuer(jahr);
  const methoden: AfaMethode[] = [];
  if (istDigitalesWirtschaftsgut(assetType)) methoden.push('einjaehrig');
  if (pruefBetrag <= w.gwgDirektGrenze) methoden.push('sofort');
  else if (pruefBetrag <= w.gwgSofortGrenze && istSelbstaendigNutzbar(assetType)) methoden.push('gwg');
  if (
    pruefBetrag > w.gwgDirektGrenze
    && pruefBetrag <= w.sammelpostenGrenze
    && istSelbstaendigNutzbar(assetType)
  ) methoden.push('pool');
  if (degressivZulaessig(datum, assetType)) methoden.push('degressiv');
  methoden.push('linear');
  return [...new Set(methoden)];
}

function hinweisFuer(selbstaendig: boolean, methode: AfaMethode): string | undefined {
  if (!selbstaendig && methode === 'einjaehrig') {
    return 'Bildschirme und Drucker sind ohne Rechner nicht nutzbar und damit kein GWG. Als Computerhardware dürfen sie aber über ein Jahr abgeschrieben werden – das wirkt sich genauso aus.';
  }
  if (!selbstaendig) {
    return 'Nicht selbständig nutzungsfähig (§ 6 Abs. 2 Satz 2 EStG) – weder GWG noch Sammelposten möglich.';
  }
  if (methode === 'degressiv') {
    return 'Degressive Abschreibung nach § 7 Abs. 2 EStG, möglich für Anschaffungen vom 01.07.2025 bis 31.12.2027. Der Wechsel zur linearen Abschreibung erfolgt automatisch, sobald er mehr bringt.';
  }
  if (methode === 'einjaehrig') {
    return 'Computerhardware und Software dürfen über ein Jahr abgeschrieben werden (BMF vom 22.02.2022) – ohne monatsgenaue Aufteilung.';
  }
  return undefined;
}

/**
 * Wertet alle abschreibungspflichtigen Belege aus. Es müssen ALLE Jahre
 * übergeben werden, nicht nur das ausgewertete – ein Gerät aus 2024 wird 2026
 * noch abgeschrieben.
 */
export function berechneAnlagegueter(
  alleInvoices: Invoice[],
  jahr: number,
  regelung: Steuerregelung,
  methodenWahl: Record<string, AfaMethode> = {},
): AnlageGut[] {
  return alleInvoices
    .filter((i) => i.type === 'ausgabe' && (i.category === 'anlagevermoegen_afa' || i.category === 'gwg'))
    .map((inv) => {
      const assetType = guessAssetType(inv.description, inv.partner);
      const bemessung = euerBetrag(inv, regelung);
      const pruefBetrag = gwgPruefBetrag(inv);
      const selbstaendig = istSelbstaendigNutzbar(assetType);
      const nutzungsdauer = istDigitalesWirtschaftsgut(assetType) ? 1 : getNutzungsdauer(assetType);

      const kaufJahr = new Date(inv.date).getFullYear();
      const gewaehlt = methodenWahl[inv.id];
      const methode = gewaehlt ?? empfohleneMethode(pruefBetrag, inv.date, assetType, kaufJahr);

      const plan = abschreibungsplan(bemessung, inv.date, nutzungsdauer, methode, assetType);
      const eintrag = plan.find((p) => p.jahr === jahr);

      const imJahr = (m: AfaMethode) =>
        abschreibungsplan(bemessung, inv.date, nutzungsdauer, m, assetType)
          .find((p) => p.jahr === jahr)?.betrag ?? 0;

      const degressivMoeglich = degressivZulaessig(inv.date, assetType) && nutzungsdauer > 1;

      return {
        invoice: inv,
        assetType,
        assetLabel: NUTZUNGSDAUER_LABELS[assetType] ?? assetType,
        bemessung,
        pruefBetrag,
        selbstaendigNutzbar: selbstaendig,
        nutzungsdauer,
        methode,
        degressivMoeglich,
        degressivImJahr: degressivMoeglich ? imJahr('degressiv') : 0,
        linearImJahr: nutzungsdauer > 1 ? imJahr('linear') : 0,
        jahresAfa: eintrag?.betrag ?? 0,
        // Vor der Anschaffung gibt es kein Wirtschaftsgut und damit auch
        // keinen Buchwert – erst danach ist der Restwert die volle Bemessung
        // abzüglich dessen, was bereits abgeschrieben wurde.
        restbuchwert: eintrag?.restwert
          ?? (jahr < kaufJahr ? 0 : plan[plan.length - 1]?.restwert ?? 0),
        plan,
        hinweis: hinweisFuer(selbstaendig, methode),
      };
    })
    .sort((a, b) => (a.invoice.date < b.invoice.date ? 1 : -1));
}

/**
 * Abschreibung des Jahres, aufgeteilt nach Belegkategorie. Die
 * Ausgabentabelle braucht das, um bei „GWG" und „Anlagevermögen" jeweils den
 * eigenen Jahresbetrag zu zeigen statt der Gesamtsumme.
 */
export function afaJeKategorie(gueter: AnlageGut[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const a of gueter) {
    map[a.invoice.category] = round2((map[a.invoice.category] ?? 0) + a.jahresAfa);
  }
  return map;
}

/** Abschreibungsbetrag eines Jahres über alle Wirtschaftsgüter. */
export function afaSummeFuerJahr(
  alleInvoices: Invoice[],
  jahr: number,
  regelung: Steuerregelung,
  methodenWahl: Record<string, AfaMethode> = {},
): number {
  return round2(
    berechneAnlagegueter(alleInvoices, jahr, regelung, methodenWahl)
      .reduce((s, a) => s + a.jahresAfa, 0),
  );
}

/**
 * Stille Reserven: Was noch in den Büchern steht. Grobe Kennzahl fürs
 * Dashboard, keine Bewertung.
 */
export function restbuchwertSumme(
  alleInvoices: Invoice[],
  jahr: number,
  regelung: Steuerregelung,
): number {
  return round2(
    berechneAnlagegueter(alleInvoices, jahr, regelung).reduce((s, a) => s + a.restbuchwert, 0),
  );
}
