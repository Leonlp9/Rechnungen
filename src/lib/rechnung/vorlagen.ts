// ─── Mitgelieferte Vorlagen ──────────────────────────────────────────────────
//
// Drei Ausgangspunkte, die sich in der Haltung unterscheiden, nicht nur in der
// Farbe. Jede ist so eingestellt, dass sie ohne eine einzige Änderung als
// Rechnung durchgeht – wer will, ändert danach Akzentfarbe, Schrift und
// Reihenfolge der Bausteine.
//
// Die Maße folgen DIN 5008: Anschriftfeld links oben, damit es im Fensterbrief
// sichtbar ist, Seitenränder bei 25 mm links und 20 mm rechts.

import type {
  Baustein, EckdatenBaustein, Gestaltung, PositionsSpalte,
  Rechnungsvorlage, SpaltenBaustein,
} from '@/types/rechnungsvorlage';

/** Kurze, stabile Kennung – reicht hier, echte Eindeutigkeit macht die Zeit. */
function kennung(): string {
  return Math.random().toString(36).slice(2, 10);
}

const GRUND_GESTALTUNG: Gestaltung = {
  akzent: '#1d4ed8',
  text: '#111827',
  gedaempft: '#6b7280',
  schriftart: 'Helvetica, Arial, sans-serif',
  schriftgroesse: 10,
  zeilenabstand: 1.35,
  randOben: 20,
  randUnten: 18,
  randLinks: 25,
  randRechts: 20,
  bausteinAbstand: 7,
  logo: '',
};

/**
 * Die Reihenfolge, die auf einer deutschen Rechnung erwartet wird. Alle drei
 * Vorlagen teilen sie – der Unterschied liegt in der Gestaltung, nicht darin,
 * wo der Empfänger steht.
 */
function grundBausteine(titel: string, mwstSatz: number): Baustein[] {
  return [
    {
      id: kennung(),
      typ: 'kopf',
      logoSeite: 'links',
      titel,
      logoHoehe: 16,
      trennlinie: true,
    },
    {
      id: kennung(),
      typ: 'anschrift',
      absenderzeile: true,
      abstandOben: 6,
    },
    {
      id: kennung(),
      typ: 'eckdaten',
      form: 'block',
      felder: ['doc_number', 'doc_date', 'delivery_date', 'due_date'],
    },
    {
      id: kennung(),
      typ: 'betreff',
      inhalt: `${titel} {{doc_number}}`,
      abstandOben: 10,
    },
    {
      id: kennung(),
      typ: 'text',
      quelle: 'feld',
      inhalt: 'notes',
      groesse: 'normal',
      betont: false,
    },
    {
      id: kennung(),
      typ: 'positionen',
      spalten: ['pos', 'beschreibung', 'menge', 'einzelpreis', 'betrag'],
      stilVariante: 'linien',
      mwstSatz,
      summenAusweisen: mwstSatz > 0,
      abstandOben: 4,
    },
    {
      id: kennung(),
      typ: 'text',
      quelle: 'feld',
      inhalt: 'legal_notice',
      groesse: 'klein',
      betont: false,
      abstandOben: 6,
    },
    {
      id: kennung(),
      typ: 'zahlung',
      qrCode: true,
      bankverbindung: true,
      abstandOben: 4,
    },
    {
      id: kennung(),
      typ: 'fusszeile',
      spalten: 3,
      trennlinie: true,
    },
  ];
}

function vorlage(
  id: string,
  name: string,
  art: 'rechnung' | 'gutschrift',
  gestaltung: Partial<Gestaltung>,
  anpassung?: (b: Baustein[]) => Baustein[],
): Rechnungsvorlage {
  const titel = art === 'rechnung' ? 'Rechnung' : 'Gutschrift';
  const basis = grundBausteine(titel, 0);
  const jetzt = new Date().toISOString();
  return {
    id,
    name,
    art,
    mitgeliefert: true,
    gestaltung: { ...GRUND_GESTALTUNG, ...gestaltung },
    bausteine: anpassung ? anpassung(basis) : basis,
    erstelltAm: jetzt,
    geaendertAm: jetzt,
  };
}

/**
 * „Klar" – ruhige Linien, kräftiger Titel, Tabelle mit Kopfbalken. Das ist der
 * Stil, den die meisten erwarten, wenn sie an eine Rechnung denken.
 */
function klar(art: 'rechnung' | 'gutschrift'): Rechnungsvorlage {
  return vorlage(
    `mitgeliefert-klar-${art}`,
    art === 'rechnung' ? 'Klar' : 'Klar (Gutschrift)',
    art,
    { akzent: '#1d4ed8', schriftgroesse: 10 },
  );
}

/**
 * „Ruhig" – kein farbiger Balken, dünne Linien, viel Weißraum. Wirkt
 * zurückhaltend und altert gut.
 */
function ruhig(art: 'rechnung' | 'gutschrift'): Rechnungsvorlage {
  return vorlage(
    `mitgeliefert-ruhig-${art}`,
    art === 'rechnung' ? 'Ruhig' : 'Ruhig (Gutschrift)',
    art,
    {
      akzent: '#334155',
      gedaempft: '#94a3b8',
      schriftgroesse: 10,
      bausteinAbstand: 9,
    },
    (b) => b.map((baustein) => {
      if (baustein.typ === 'kopf') return { ...baustein, trennlinie: false, logoSeite: 'rechts' as const };
      if (baustein.typ === 'positionen') return { ...baustein, stilVariante: 'schlicht' as const };
      if (baustein.typ === 'fusszeile') return { ...baustein, spalten: 4 };
      return baustein;
    }),
  );
}

/**
 * „Kompakt" – kleinere Schrift, engere Abstände, Zebrastreifen in der Tabelle.
 * Für Rechnungen mit vielen Positionen, die sonst auf zwei Seiten laufen.
 */
function kompakt(art: 'rechnung' | 'gutschrift'): Rechnungsvorlage {
  return vorlage(
    `mitgeliefert-kompakt-${art}`,
    art === 'rechnung' ? 'Kompakt' : 'Kompakt (Gutschrift)',
    art,
    {
      akzent: '#0f766e',
      schriftgroesse: 9,
      bausteinAbstand: 5,
      randOben: 16,
      randUnten: 14,
    },
    (b) => b.map((baustein) => {
      if (baustein.typ === 'positionen') {
        return { ...baustein, stilVariante: 'zebra' as const, spalten: ['pos', 'beschreibung', 'menge', 'einheit', 'einzelpreis', 'betrag'] as PositionsSpalte[] };
      }
      if (baustein.typ === 'eckdaten') return { ...baustein, form: 'zeile' as const };
      return baustein;
    }),
  );
}

/**
 * „Zweispaltig" – zeigt, wozu der Spalten-Baustein da ist: Anschrift und
 * Eckdaten stehen nicht mehr automatisch nebeneinander, sondern weil jemand
 * sie in eine Spaltenreihe gelegt hat. Unter der Tabelle stehen Hinweis und
 * Zahlung nebeneinander statt untereinander, was das Blatt kürzer macht.
 *
 * Wer eine eigene Vorlage bauen will, kommt hiermit am schnellsten voran:
 * kopieren, Spalten verschieben, fertig.
 */
function zweispaltig(): Rechnungsvorlage {
  const basis = grundBausteine('Rechnung', 0);
  const nimm = (typ: Baustein['typ']) => basis.find((b) => b.typ === typ)!;

  const kopfBaustein = nimm('kopf');
  const anschriftBaustein = { ...nimm('anschrift'), abstandOben: 0 };
  const eckdatenBaustein = { ...(nimm('eckdaten') as EckdatenBaustein), form: 'liste' as const };
  const betreffBaustein = nimm('betreff');
  const positionenBaustein = nimm('positionen');
  const hinweisBaustein = basis.filter((b) => b.typ === 'text')[1] ?? nimm('text');
  const zahlungBaustein = nimm('zahlung');
  const fussBaustein = nimm('fusszeile');

  const oben: SpaltenBaustein = {
    id: kennung(),
    typ: 'spalten',
    zwischenraum: 8,
    ausrichtungSenkrecht: 'oben',
    abstandOben: 6,
    spalten: [
      { id: kennung(), anteil: 3, bausteine: [anschriftBaustein] },
      { id: kennung(), anteil: 2, bausteine: [eckdatenBaustein] },
    ],
  };

  const unten: SpaltenBaustein = {
    id: kennung(),
    typ: 'spalten',
    zwischenraum: 8,
    ausrichtungSenkrecht: 'oben',
    abstandOben: 6,
    spalten: [
      { id: kennung(), anteil: 1, bausteine: [{ ...hinweisBaustein, abstandOben: 0 }] },
      { id: kennung(), anteil: 1, bausteine: [{ ...zahlungBaustein, abstandOben: 0 }] },
    ],
  };

  const jetzt = new Date().toISOString();
  return {
    id: 'mitgeliefert-zweispaltig-rechnung',
    name: 'Zweispaltig',
    art: 'rechnung',
    mitgeliefert: true,
    gestaltung: { ...GRUND_GESTALTUNG, akzent: '#7c3aed', bausteinAbstand: 6 },
    bausteine: [kopfBaustein, oben, betreffBaustein, positionenBaustein, unten, fussBaustein],
    erstelltAm: jetzt,
    geaendertAm: jetzt,
  };
}

/** Alle mitgelieferten Vorlagen. */
export function mitgelieferteVorlagen(): Rechnungsvorlage[] {
  return [
    klar('rechnung'),
    ruhig('rechnung'),
    kompakt('rechnung'),
    zweispaltig(),
    klar('gutschrift'),
  ];
}

/** Eine leere Vorlage zum Selbstbauen. */
export function leereVorlage(name: string, art: 'rechnung' | 'gutschrift'): Rechnungsvorlage {
  const jetzt = new Date().toISOString();
  return {
    id: kennung(),
    name,
    art,
    mitgeliefert: false,
    gestaltung: { ...GRUND_GESTALTUNG },
    bausteine: grundBausteine(art === 'rechnung' ? 'Rechnung' : 'Gutschrift', 0),
    erstelltAm: jetzt,
    geaendertAm: jetzt,
  };
}

/** Kopie einer Vorlage, die sich bearbeiten lässt. */
export function kopiere(v: Rechnungsvorlage, neuerName: string): Rechnungsvorlage {
  const jetzt = new Date().toISOString();
  return {
    ...v,
    id: kennung(),
    name: neuerName,
    mitgeliefert: false,
    // Bausteine bekommen eigene Kennungen, sonst zeigen beide Vorlagen auf
    // dieselben Einträge, und die Auswahl im Designer verwechselt sie.
    bausteine: v.bausteine.map((b) => ({ ...b, id: kennung() })),
    gestaltung: { ...v.gestaltung },
    erstelltAm: jetzt,
    geaendertAm: jetzt,
  };
}

/** Ein neuer Baustein mit brauchbaren Voreinstellungen. */
export function neuerBaustein(typ: Baustein['typ']): Baustein {
  const id = kennung();
  switch (typ) {
    case 'kopf':
      return { id, typ, logoSeite: 'links', titel: 'Rechnung', logoHoehe: 16, trennlinie: true };
    case 'anschrift':
      return { id, typ, absenderzeile: true };
    case 'eckdaten':
      return { id, typ, form: 'block', felder: ['doc_number', 'doc_date', 'delivery_date'] };
    case 'betreff':
      return { id, typ, inhalt: 'Rechnung {{doc_number}}' };
    case 'text':
      return { id, typ, quelle: 'fest', inhalt: 'Neuer Absatz', groesse: 'normal', betont: false };
    case 'positionen':
      return {
        id, typ,
        spalten: ['pos', 'beschreibung', 'menge', 'einzelpreis', 'betrag'],
        stilVariante: 'linien',
        mwstSatz: 0,
        summenAusweisen: false,
      };
    case 'zahlung':
      return { id, typ, qrCode: true, bankverbindung: true };
    case 'fusszeile':
      return { id, typ, spalten: 3, trennlinie: true };
    case 'linie':
      return { id, typ, dicke: 0.3, farbe: '', breite: 1 };
    case 'bild':
      return { id, typ, quelle: '', hoehe: 20 };
    case 'liste':
      return {
        id, typ,
        zeilen: [{ id: kennung(), beschriftung: 'Beschriftung', wert: 'Wert' }],
        beschriftungsAnteil: 0.4,
      };
    case 'unterschrift':
      return { id, typ, beschriftung: 'Ort, Datum, Unterschrift', linienBreite: 70, freiraum: 14 };
    case 'seitenumbruch':
      return { id, typ };
    case 'spalten':
      return {
        id, typ,
        zwischenraum: 6,
        ausrichtungSenkrecht: 'oben',
        spalten: [
          { id: kennung(), anteil: 1, bausteine: [] },
          { id: kennung(), anteil: 1, bausteine: [] },
        ],
      };
    case 'abstand':
      return { id, typ, hoehe: 10 };
  }
}
