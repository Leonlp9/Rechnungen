// ─── Mitgelieferte Vorlagen ──────────────────────────────────────────────────
//
// Drei Ausgangspunkte, die sich in der Haltung unterscheiden, nicht nur in der
// Farbe. Jede ist so eingestellt, dass sie ohne eine einzige Änderung als
// Rechnung durchgeht – wer will, ändert danach Akzentfarbe, Schrift und
// Reihenfolge der Bausteine.
//
// Die Maße folgen DIN 5008: Anschriftfeld links oben, damit es im Fensterbrief
// sichtbar ist, Seitenränder bei 25 mm links und 20 mm rechts.

import type { Baustein, Gestaltung, Rechnungsvorlage } from '@/types/rechnungsvorlage';

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
      stil: 'linien',
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
      if (baustein.typ === 'kopf') return { ...baustein, trennlinie: false, logoSeite: 'rechts' };
      if (baustein.typ === 'positionen') return { ...baustein, stil: 'schlicht' };
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
        return { ...baustein, stil: 'zebra', spalten: ['pos', 'beschreibung', 'menge', 'einheit', 'einzelpreis', 'betrag'] };
      }
      if (baustein.typ === 'eckdaten') return { ...baustein, form: 'zeile' };
      return baustein;
    }),
  );
}

/** Alle mitgelieferten Vorlagen. */
export function mitgelieferteVorlagen(): Rechnungsvorlage[] {
  return [
    klar('rechnung'),
    ruhig('rechnung'),
    kompakt('rechnung'),
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
        stil: 'linien',
        mwstSatz: 0,
        summenAusweisen: false,
      };
    case 'zahlung':
      return { id, typ, qrCode: true, bankverbindung: true };
    case 'fusszeile':
      return { id, typ, spalten: 3, trennlinie: true };
    case 'abstand':
      return { id, typ, hoehe: 10 };
  }
}
