// ─── Rechnungsprüfung ────────────────────────────────────────────────────────
//
// Zwei Dinge prüft dieses Modul, und die Trennung ist Absicht.
//
// Erstens die harten Regeln: Fehlt die Steuernummer? Liegt die Fälligkeit vor
// dem Rechnungsdatum? Weist ein Kleinunternehmer Umsatzsteuer aus? Das sind
// Ja-Nein-Fragen, die ein Programm sicher beantworten kann – und genau deshalb
// gehören sie NICHT an eine KI. Eine Sprachmaschine, die zu 95 Prozent merkt,
// dass die Steuernummer fehlt, ist für eine Pflichtangabe zu wenig. Diese
// Regeln laufen offline, sofort und immer, auch ohne Schlüssel und ohne
// Zustimmung zur Datenübertragung.
//
// Zweitens das, was Sprachverständnis braucht: Ist „Beratung" als
// Leistungsbeschreibung bestimmt genug? Passt „1 Monat" zu einem einzelnen
// Stichtag als Leistungszeitpunkt? Das macht die KI – aber als Ergänzung, nicht
// als Ersatz.
//
// ── Warum gegen das gesetzte Blatt geprüft wird ──
//
// Die Prüfung sieht sich nicht nur die Eingabefelder an, sondern den Text, der
// am Ende wirklich auf dem Papier steht. Der Grund ist der Baukasten: Eine
// Steuernummer kann im Profil gepflegt sein, während der Baustein, der sie
// druckt, in der Vorlage abgeschaltet ist. Wer nur die Felder prüft, meldet
// dann „alles da", und auf der Rechnung fehlt sie trotzdem.

import type { LineItem } from '@/types/template';
import type { Seite, Summen } from './layout';

export type Schwere = 'fehler' | 'warnung' | 'hinweis';

export interface Befund {
  schwere: Schwere;
  /** Das betroffene Eingabefeld, soweit es eines gibt. */
  feld?: string;
  titel: string;
  text: string;
  /** Die Fundstelle, damit man nachschlagen kann, warum das verlangt wird. */
  fundstelle?: string;
  /** Woher der Befund stammt – die Oberfläche kennzeichnet das. */
  quelle: 'regel' | 'ki';
}

export interface PruefEingabe {
  /** Die zusammengesetzten Werte, wie das Layout sie bekommt. */
  werte: Record<string, string>;
  positionen: LineItem[];
  summen: Summen;
  kleinunternehmer: boolean;
  mitUst: boolean;
  ustSatz: number;
  /** Die fertig gesetzten Seiten – das, was gedruckt wird. */
  seiten: Seite[];
  art: 'rechnung' | 'gutschrift';
  /** Ländercode des Absenders; bestimmt, ob eine fünfstellige PLZ erwartet wird. */
  land?: string;
}

// ─── Hilfen ──────────────────────────────────────────────────────────────────

/** Sammelt allen Text der gesetzten Seiten – das, was der Empfänger liest. */
export function blatttext(seiten: Seite[]): string {
  const teile: string[] = [];
  for (const s of seiten) {
    for (const k of s.kaesten) {
      if (k.art === 'text') teile.push(...k.zeilen);
    }
  }
  return teile.join('\n');
}

const leer = (v?: string) => !v || !v.trim();

/** Deutsche Postleitzahlen haben fünf Ziffern. */
const hatPlz = (v: string) => /\b\d{5}\b/.test(v);

/**
 * Ein einzelnes Wort oder ein sehr kurzer Text beschreibt selten eine Leistung.
 * Die Zeichenzahl allein taugt nicht als Maß: „Trockenbauarbeiten" ist lang und
 * trotzdem nichtssagend, „Logo Klevr" kurz und eindeutig. Deshalb zählt hier
 * zuerst die Zahl der Wörter.
 */
function knappBeschrieben(text: string): boolean {
  const t = text.trim();
  const woerter = t.split(/\s+/).filter(Boolean);
  return woerter.length < 2 || t.length < 12;
}

/**
 * Wandelt ein deutsches oder ISO-Datum in ein Date. Gibt null zurück, wenn
 * daraus kein sinnvoller Tag wird – dann meldet die Regel „unlesbar" statt
 * stillschweigend zu rechnen.
 */
function alsDatum(v?: string): Date | null {
  if (leer(v)) return null;
  const t = v!.trim();
  const de = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t);
  if (de) {
    const d = new Date(Number(de[3]), Number(de[2]) - 1, Number(de[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Tage zwischen zwei Tagen, auf den Kalendertag gerundet. */
function tage(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

// ── Welcher Katalog gilt? ────────────────────────────────────────────────────
//
// Das ist der wichtigste Punkt dieser Datei, und er ist noch jung: Seit dem
// 01.01.2025 richtet sich die Rechnung eines Kleinunternehmers NICHT mehr nach
// § 14 Abs. 4 UStG, sondern nach dem neu eingefügten § 34a UStDV. Die
// Finanzverwaltung sagt das wörtlich – solche Rechnungen „müssen abweichend von
// §§ 14, 14a UStG nur die in § 34a UStDV aufgeführten Angaben enthalten"
// (Abschn. 14.7a Abs. 1 Satz 2 UStAE, BMF-Schreiben vom 18.03.2025).
//
// Übrig bleiben sechs Angaben. Damit sind für den Kleinunternehmer
// umsatzsteuerlich WEGGEFALLEN: die fortlaufende Rechnungsnummer, der
// Leistungszeitpunkt und der Hinweis auf die Aufbewahrungspflicht. Wer hier
// weiter stur nach § 14 Abs. 4 prüft, meldet Pflichten, die es nicht gibt – und
// das ist schlimmer als eine übersehene Kleinigkeit, weil es den Nutzer dazu
// bringt, an einer richtigen Rechnung herumzubessern.
//
// Sinnvoll bleiben die drei trotzdem, nur eben als Empfehlung.

/** Fundstellen für die Regelbesteuerung. */
const F = {
  anschrift: '§ 14 Abs. 4 Satz 1 Nr. 1 UStG',
  steuernummer: '§ 14 Abs. 4 Satz 1 Nr. 2 UStG',
  datum: '§ 14 Abs. 4 Satz 1 Nr. 3 UStG',
  nummer: '§ 14 Abs. 4 Satz 1 Nr. 4 UStG',
  leistung: '§ 14 Abs. 4 Satz 1 Nr. 5 UStG',
  zeitpunkt: '§ 14 Abs. 4 Satz 1 Nr. 6 UStG, § 31 Abs. 4 UStDV',
  entgelt: '§ 14 Abs. 4 Satz 1 Nr. 7 UStG',
  steuer: '§ 14 Abs. 4 Satz 1 Nr. 8 UStG',
  gutschrift: '§ 14 Abs. 4 Satz 1 Nr. 10 i. V. m. § 14 Abs. 2 Satz 5 UStG',
  kleinbetrag: '§ 33 UStDV',
  // Seit 2025 schuldet ein Kleinunternehmer zu Unrecht ausgewiesene Steuer nach
  // ABSATZ 1 (unrichtiger Ausweis), nicht mehr nach Absatz 2 – Folge davon, dass
  // § 19 UStG jetzt eine echte Steuerbefreiung ist.
  falschausweis: '§ 14c Abs. 1 UStG (BMF vom 18.03.2025, Rn. 5)',
  verzug: '§ 286 Abs. 3 BGB',
  gob: '§ 146 AO, GoBD',
} as const;

/** Fundstellen für den Kleinunternehmer nach § 19 UStG. */
const K = {
  anschrift: '§ 34a Satz 1 Nr. 1 UStDV',
  steuernummer: '§ 34a Satz 1 Nr. 2 UStDV',
  datum: '§ 34a Satz 1 Nr. 3 UStDV',
  leistung: '§ 34a Satz 1 Nr. 4 UStDV',
  steuer: '§ 34a Satz 1 Nr. 5 UStDV',
  gutschrift: '§ 34a Satz 1 Nr. 6 UStDV',
} as const;

// ─── Die Regeln ──────────────────────────────────────────────────────────────

export function pruefeRechnung(e: PruefEingabe): Befund[] {
  const b: Befund[] = [];
  const w = e.werte;
  const blatt = blatttext(e.seiten);
  const inlandsadresse = (e.land ?? 'DE').toUpperCase() === 'DE';
  const ku = e.kleinunternehmer;
  /** Bis 250 Euro brutto darf einiges entfallen (§ 33 UStDV). */
  const kleinbetrag = e.summen.brutto > 0 && e.summen.brutto <= 250;

  /** Steht der Wert auch wirklich auf dem Blatt? */
  const gedruckt = (v?: string) => !leer(v) && blatt.includes(v!.trim());

  // ── Absender ──
  if (leer(w.sender_name)) {
    b.push({
      schwere: 'fehler', feld: 'sender_name', quelle: 'regel', fundstelle: ku ? K.anschrift : F.anschrift,
      titel: 'Dein Name fehlt',
      text: 'Ohne vollständigen Namen des Rechnungsstellers ist die Rechnung unvollständig. Trage ihn unter Einstellungen → Profil ein.',
    });
  }
  if (leer(w.sender_address)) {
    b.push({
      schwere: 'fehler', feld: 'sender_address', quelle: 'regel', fundstelle: ku ? K.anschrift : F.anschrift,
      titel: 'Deine Anschrift fehlt',
      text: 'Verlangt ist die vollständige Anschrift. Trage Straße, Postleitzahl und Stadt unter Einstellungen → Profil ein.',
    });
  } else if (inlandsadresse && !hatPlz(w.sender_address)) {
    b.push({
      schwere: 'fehler', feld: 'sender_address', quelle: 'regel', fundstelle: ku ? K.anschrift : F.anschrift,
      titel: 'In deiner Anschrift fehlt die Postleitzahl',
      text: `Auf der Rechnung steht „${w.sender_address.trim()}". Verlangt ist die vollständige Anschrift – ohne Postleitzahl ist sie das nicht. Ergänze sie unter Einstellungen → Profil.`,
    });
  }

  if (leer(w.sender_tax_number) && leer(w.sender_vat_id)) {
    b.push({
      schwere: 'fehler', feld: 'sender_tax_number', quelle: 'regel', fundstelle: ku ? K.steuernummer : F.steuernummer,
      titel: 'Steuernummer oder USt-IdNr. fehlt',
      text: 'Eine von beiden muss auf der Rechnung stehen. Für Kleinunternehmer ist das in aller Regel die Steuernummer.',
    });
  } else if (!gedruckt(w.sender_tax_number) && !gedruckt(w.sender_vat_id)) {
    // Gepflegt, aber nicht gedruckt: der klassische Fall eines abgeschalteten
    // Bausteins in der Vorlage.
    b.push({
      schwere: 'fehler', feld: 'sender_tax_number', quelle: 'regel', fundstelle: ku ? K.steuernummer : F.steuernummer,
      titel: 'Steuernummer ist hinterlegt, steht aber nicht auf der Rechnung',
      text: 'Im Profil ist sie gepflegt, auf dem gesetzten Blatt taucht sie nicht auf. Vermutlich fehlt sie in der Vorlage – prüfe unter Rechnungsvorlagen die Fußzeile oder die Eckdaten.',
    });
  }

  // ── Empfänger ──
  if (leer(w.receiver_name)) {
    b.push({
      schwere: 'fehler', feld: 'receiver_name', quelle: 'regel', fundstelle: ku ? K.anschrift : F.anschrift,
      titel: 'Der Empfänger fehlt',
      text: 'Name des Leistungsempfängers ist Pflichtangabe.',
    });
  }
  if (leer(w.receiver_address)) {
    b.push({
      // Bis 250 Euro brutto darf der Empfänger ganz entfallen (§ 33 UStDV);
      // über § 34a Satz 2 UStDV gilt das auch für den Kleinunternehmer.
      schwere: kleinbetrag ? 'hinweis' : 'fehler',
      feld: 'receiver_address', quelle: 'regel',
      fundstelle: kleinbetrag ? F.kleinbetrag : ku ? K.anschrift : F.anschrift,
      titel: 'Die Anschrift des Empfängers fehlt',
      text: kleinbetrag
        ? 'Bei einem Bruttobetrag bis 250 Euro darf sie entfallen. Vollständiger ist die Rechnung mit Anschrift trotzdem.'
        : 'Auch beim Empfänger verlangt das Gesetz die vollständige Anschrift.',
    });
  } else if (!hatPlz(w.receiver_address)) {
    b.push({
      schwere: 'warnung', feld: 'receiver_address', quelle: 'regel', fundstelle: ku ? K.anschrift : F.anschrift,
      titel: 'In der Empfängeranschrift fehlt eine Postleitzahl',
      text: 'Bei einer deutschen Anschrift gehört sie dazu. Bei einer Auslandsanschrift kann das in Ordnung sein.',
    });
  }

  // ── Nummer und Daten ──
  if (leer(w.doc_number)) {
    // Umsatzsteuerlich braucht eine Kleinunternehmerrechnung seit 2025 gar
    // keine Nummer mehr – § 34a UStDV zählt sie nicht auf. Für die Buchführung
    // bleibt sie trotzdem richtig, deshalb hier eine Warnung statt eines
    // erfundenen Pflichtverstoßes.
    b.push({
      schwere: ku ? 'warnung' : 'fehler',
      feld: 'doc_number', quelle: 'regel', fundstelle: ku ? F.gob : F.nummer,
      titel: 'Die Rechnungsnummer fehlt',
      text: ku
        ? 'Für eine Kleinunternehmerrechnung ist sie seit 2025 keine Pflichtangabe mehr. Ohne Nummer lässt sich der Beleg aber kaum zuordnen, und deine Buchführung soll nachvollziehbar sein – vergib sie besser.'
        : 'Verlangt ist eine einmalig vergebene, fortlaufende Nummer. Lücken sind unschädlich, doppelte Nummern nicht.',
    });
  }

  const rechnungsdatum = alsDatum(w.doc_date);
  if (leer(w.doc_date)) {
    b.push({
      schwere: 'fehler', feld: 'doc_date', quelle: 'regel', fundstelle: ku ? K.datum : F.datum,
      titel: 'Das Rechnungsdatum fehlt',
      text: 'Das Ausstellungsdatum ist Pflichtangabe.',
    });
  } else if (!rechnungsdatum) {
    b.push({
      schwere: 'fehler', feld: 'doc_date', quelle: 'regel', fundstelle: ku ? K.datum : F.datum,
      titel: 'Das Rechnungsdatum ist unlesbar',
      text: `„${w.doc_date}" ergibt kein gültiges Datum.`,
    });
  }

  if (leer(w.delivery_date)) {
    // Auch der Leistungszeitpunkt ist für den Kleinunternehmer seit 2025 keine
    // Pflichtangabe mehr. Er bleibt nützlich – der Kunde ordnet die Leistung
    // damit zu, und für die eigene Gewinnermittlung ist er ohnehin gebraucht.
    b.push({
      schwere: ku ? 'hinweis' : 'fehler',
      feld: 'delivery_date', quelle: 'regel', fundstelle: ku ? K.leistung : F.zeitpunkt,
      titel: ku ? 'Kein Leistungszeitpunkt angegeben' : 'Der Leistungszeitpunkt fehlt',
      text: ku
        ? 'Nach § 34a UStDV musst du ihn nicht angeben. Üblich und hilfreich ist er trotzdem – statt eines Tages darf auch der Kalendermonat dastehen, etwa „Juli 2026".'
        : 'Wann die Leistung erbracht wurde, ist Pflichtangabe – auch dann, wenn es derselbe Tag ist wie das Rechnungsdatum. Statt eines Tages darf der Kalendermonat angegeben werden (§ 31 Abs. 4 UStDV); bei Gleichlauf genügt der Satz „Leistungsdatum entspricht Rechnungsdatum".',
    });
  }

  const faellig = alsDatum(w.due_date);
  if (rechnungsdatum && faellig && tage(rechnungsdatum, faellig) < 0) {
    b.push({
      schwere: 'fehler', feld: 'due_date', quelle: 'regel',
      titel: 'Die Rechnung ist fällig, bevor sie geschrieben wurde',
      text: `Fällig am ${w.due_date}, ausgestellt am ${w.doc_date}. Eines der beiden Daten stimmt nicht.`,
    });
  }
  if (rechnungsdatum && tage(new Date(), rechnungsdatum) > 1) {
    b.push({
      schwere: 'warnung', feld: 'doc_date', quelle: 'regel',
      titel: 'Das Rechnungsdatum liegt in der Zukunft',
      text: 'Vordatierte Rechnungen fallen bei einer Prüfung auf. Gewollt?',
    });
  }
  if (leer(w.due_date) && leer(w.payment_terms)) {
    b.push({
      schwere: 'hinweis', feld: 'due_date', quelle: 'regel', fundstelle: F.verzug,
      titel: 'Kein Zahlungsziel angegeben',
      text: 'Pflicht ist es nicht. Ohne Angabe tritt Verzug bei einem Unternehmer erst 30 Tage nach Zugang der Rechnung ein – mit Zahlungsziel bist du schneller.',
    });
  }

  // ── Positionen ──
  const echte = e.positionen.filter((p) => !p.isGroupHeader);
  if (echte.length === 0) {
    b.push({
      schwere: 'fehler', feld: 'positionen', quelle: 'regel', fundstelle: ku ? K.leistung : F.leistung,
      titel: 'Die Rechnung hat keine Position',
      text: 'Menge und Art der Leistung sind Pflichtangabe.',
    });
  }
  echte.forEach((p, i) => {
    const nr = i + 1;
    if (leer(p.description)) {
      b.push({
        schwere: 'fehler', feld: `position-${p.id}`, quelle: 'regel', fundstelle: ku ? K.leistung : F.leistung,
        titel: `Position ${nr} hat keine Beschreibung`,
        text: 'Ohne Bezeichnung der Leistung ist die Rechnung unvollständig.',
      });
    } else if (knappBeschrieben(p.description)) {
      b.push({
        schwere: 'warnung', feld: `position-${p.id}`, quelle: 'regel', fundstelle: ku ? K.leistung : F.leistung,
        titel: `Position ${nr} ist sehr knapp beschrieben`,
        text: `„${p.description.trim()}" – verlangt ist eine handelsübliche Bezeichnung, aus der sich die Leistung eindeutig ergibt.`,
      });
    }
    if (p.quantity === 0) {
      b.push({
        schwere: 'warnung', feld: `position-${p.id}`, quelle: 'regel', fundstelle: ku ? K.leistung : F.leistung,
        titel: `Position ${nr} hat die Menge 0`,
        text: 'Die Zeile bringt so keinen Betrag. Gewollt?',
      });
    }
  });

  // ── Beträge und Steuer ──
  if (e.summen.netto <= 0 && echte.length > 0) {
    b.push({
      schwere: 'warnung', feld: 'summe', quelle: 'regel', fundstelle: ku ? K.steuer : F.entgelt,
      titel: 'Der Rechnungsbetrag ist null',
      text: 'Eine Rechnung über 0 Euro ist ungewöhnlich. Prüfe Mengen und Einzelpreise.',
    });
  }

  if (e.kleinunternehmer) {
    // Der teuerste Fehler, den ein Kleinunternehmer machen kann: Wer Steuer
    // ausweist, schuldet sie dem Finanzamt – obwohl er sie gar nicht erheben
    // darf und sie vom Kunden meist nie bekommen hat.
    if (e.mitUst || e.summen.steuer > 0) {
      b.push({
        schwere: 'fehler', feld: 'ust', quelle: 'regel', fundstelle: F.falschausweis,
        titel: 'Als Kleinunternehmer weist du hier Umsatzsteuer aus',
        text: 'Diese Steuer schuldest du dem Finanzamt allein deshalb, weil sie auf der Rechnung steht – auch wenn du sie gar nicht erheben darfst. Schalte den Ausweis ab, bevor du die Rechnung herausgibst.',
      });
    }
    const hinweisDa = /§\s*19|kleinunternehm|keine\s+umsatzsteuer|steuerbefrei/i.test(blatt);
    if (!hinweisDa) {
      b.push({
        schwere: 'fehler', feld: 'legal_notice', quelle: 'regel', fundstelle: K.steuer,
        titel: 'Der Hinweis auf die Steuerbefreiung fehlt',
        text: 'Statt Steuersatz und Steuerbetrag muss ein Hinweis darauf stehen, dass keine Umsatzsteuer berechnet wird. Eine feste Formulierung ist nicht vorgeschrieben; üblich ist der Verweis auf § 19 UStG.',
      });
    }
  } else if (!e.mitUst && e.summen.steuer === 0) {
    // Kein Kleinunternehmer, trotzdem keine Steuer: Dann muss ein Grund dastehen.
    const grundDa = /§\s*(13b|4|19|25)|reverse\s*charge|steuerfrei|steuerschuldnerschaft/i.test(blatt);
    if (!grundDa) {
      b.push({
        schwere: 'fehler', feld: 'legal_notice', quelle: 'regel', fundstelle: F.steuer,
        titel: 'Keine Umsatzsteuer, aber kein Grund genannt',
        text: 'Wer Steuer weglässt, muss auf den Grund hinweisen – Steuerbefreiung, Reverse-Charge oder Ähnliches. Sonst fehlt eine Pflichtangabe.',
      });
    }
  }

  // ── Art des Belegs ──
  if (e.art === 'gutschrift' && !/gutschrift/i.test(blatt)) {
    b.push({
      schwere: 'fehler', feld: 'art', quelle: 'regel', fundstelle: ku ? K.gutschrift : F.gutschrift,
      titel: 'Das Wort „Gutschrift" fehlt',
      text: 'Rechnet der Leistungsempfänger ab, muss der Beleg ausdrücklich „Gutschrift" heißen. Achtung: Gemeint ist die Abrechnung durch den Empfänger, nicht die Korrektur einer früheren Rechnung.',
    });
  }

  // ── Verweise ins Leere ──
  if (/laut\s+anlage|siehe\s+anlage|gem[äa]ß\s+anlage/i.test(blatt)) {
    b.push({
      schwere: 'warnung', feld: 'notes', quelle: 'regel',
      titel: 'Die Rechnung verweist auf eine Anlage',
      text: 'Ein Verweis ist zulässig, aber nur wenn die Anlage dem Empfänger auch zugeht und die Leistung darin eindeutig bezeichnet ist. Geht sie nicht mit, streiche den Verweis.',
    });
  }

  return sortiere(b);
}

/** Fehler zuerst, danach Warnungen, dann Hinweise. */
export function sortiere(b: Befund[]): Befund[] {
  const rang: Record<Schwere, number> = { fehler: 0, warnung: 1, hinweis: 2 };
  return [...b].sort((x, y) => rang[x.schwere] - rang[y.schwere]);
}

export function zaehle(b: Befund[]) {
  return {
    fehler: b.filter((x) => x.schwere === 'fehler').length,
    warnungen: b.filter((x) => x.schwere === 'warnung').length,
    hinweise: b.filter((x) => x.schwere === 'hinweis').length,
  };
}
