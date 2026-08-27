// ─── Speicher für die Baukasten-Vorlagen ─────────────────────────────────────
//
// Bewusst getrennt vom alten `templateStore`: Der hält die frei platzierten
// Vorlagen, und solange jemand eine davon benutzt, soll sie weiter
// funktionieren. Neue Vorlagen entstehen hier.
//
// Die mitgelieferten Vorlagen werden bei jedem Start abgeglichen: Wer sie nicht
// angefasst hat, bekommt Verbesserungen mit; eine eigene Kopie bleibt
// unberührt, weil sie `mitgeliefert: false` trägt.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Baustein, Gestaltung, PositionenBaustein, Rechnungsvorlage } from '@/types/rechnungsvorlage';
import { mitgelieferteVorlagen } from '@/lib/rechnung/vorlagen';
import {
  bausteinEinsetzen, bausteinEntnehmen, bausteinPatchen, bausteinSortieren, bausteinUmhaengen,
  spalteAnlegen, spalteLoeschen,
} from '@/lib/rechnung/baum';

interface VorlagenState {
  vorlagen: Rechnungsvorlage[];
  /** Welche Vorlage im Designer offen ist. */
  offeneVorlage: string | null;
  setOffeneVorlage: (id: string | null) => void;

  hinzufuegen: (v: Rechnungsvorlage) => void;
  aendern: (id: string, patch: Partial<Rechnungsvorlage>) => void;
  loeschen: (id: string) => void;
  /** Setzt eine mitgelieferte Vorlage auf den Auslieferungszustand zurück. */
  zuruecksetzen: (id: string) => void;

  gestaltungAendern: (id: string, patch: Partial<Gestaltung>) => void;

  // Die folgenden Änderungen laufen durch den ganzen Baum: Ein Baustein kann
  // auch in einer Spalte stecken, und dort muss er sich genauso einstellen,
  // sortieren und löschen lassen wie in der Hauptliste.

  bausteinAendern: (vorlageId: string, bausteinId: string, patch: Partial<Baustein>) => void;
  /** `spalteId === null` heißt: ans Ende der Hauptliste. */
  bausteinHinzufuegen: (vorlageId: string, baustein: Baustein, spalteId?: string | null) => void;
  bausteinLoeschen: (vorlageId: string, bausteinId: string) => void;
  bausteinVerschieben: (vorlageId: string, spalteId: string | null, von: number, nach: number) => void;
  /** Holt einen Baustein in eine Spalte oder aus ihr heraus (`null`). */
  bausteinUmhaengenIn: (vorlageId: string, bausteinId: string, spalteId: string | null) => void;

  spalteHinzufuegen: (vorlageId: string, spaltenId: string) => void;
  spalteEntfernen: (vorlageId: string, spaltenId: string, spalteId: string) => void;
}

/** Setzt `geaendertAm` – sonst müsste man daran an zwölf Stellen denken. */
function berührt(v: Rechnungsvorlage): Rechnungsvorlage {
  return { ...v, geaendertAm: new Date().toISOString() };
}

/**
 * Wendet eine Änderung auf die Bausteinliste einer Vorlage an. Alle
 * Baustein-Aktionen sehen dadurch gleich aus und keine vergisst `geaendertAm`.
 */
function amBaum(
  s: { vorlagen: Rechnungsvorlage[] },
  vorlageId: string,
  aendern: (liste: Baustein[]) => Baustein[],
): { vorlagen: Rechnungsvorlage[] } {
  return {
    vorlagen: s.vorlagen.map((v) =>
      v.id === vorlageId ? berührt({ ...v, bausteine: aendern(v.bausteine) }) : v,
    ),
  };
}

/**
 * Bringt gespeicherte Bausteine auf den aktuellen Stand. Läuft auch in
 * Spalten hinein, weil dort dieselben Bausteine stecken können.
 */
function nachziehen(bausteine: Baustein[]): Baustein[] {
  return bausteine.map((b) => {
    const alt = b as Baustein & { stil?: unknown };
    let neu: Baustein = b;

    // Früher trug die Positionstabelle ihren Tabellenstil unter `stil`.
    if (b.typ === 'positionen' && typeof alt.stil === 'string') {
      const { stil: _weg, ...rest } = alt as PositionenBaustein & { stil: string };
      neu = { ...rest, stilVariante: alt.stil as 'linien' | 'zebra' | 'schlicht' | 'rahmen' };
    }

    if (neu.typ === 'spalten') {
      neu = { ...neu, spalten: neu.spalten.map((s) => ({ ...s, bausteine: nachziehen(s.bausteine ?? []) })) };
    }
    return neu;
  });
}

export const useVorlagenStore = create<VorlagenState>()(
  persist(
    (set) => ({
      vorlagen: mitgelieferteVorlagen(),
      offeneVorlage: null,
      setOffeneVorlage: (offeneVorlage) => set({ offeneVorlage }),

      hinzufuegen: (v) => set((s) => ({ vorlagen: [...s.vorlagen, v] })),

      aendern: (id, patch) =>
        set((s) => ({
          vorlagen: s.vorlagen.map((v) => (v.id === id ? berührt({ ...v, ...patch }) : v)),
        })),

      loeschen: (id) =>
        set((s) => ({ vorlagen: s.vorlagen.filter((v) => v.id !== id || v.mitgeliefert) })),

      zuruecksetzen: (id) =>
        set((s) => {
          const frisch = mitgelieferteVorlagen().find((v) => v.id === id);
          if (!frisch) return s;
          return { vorlagen: s.vorlagen.map((v) => (v.id === id ? frisch : v)) };
        }),

      gestaltungAendern: (id, patch) =>
        set((s) => ({
          vorlagen: s.vorlagen.map((v) =>
            v.id === id ? berührt({ ...v, gestaltung: { ...v.gestaltung, ...patch } }) : v,
          ),
        })),

      bausteinAendern: (vorlageId, bausteinId, patch) =>
        set((s) => amBaum(s, vorlageId, (l) => bausteinPatchen(l, bausteinId, patch))),

      bausteinHinzufuegen: (vorlageId, baustein, spalteId = null) =>
        set((s) => amBaum(s, vorlageId, (l) => bausteinEinsetzen(l, baustein, spalteId))),

      bausteinLoeschen: (vorlageId, bausteinId) =>
        set((s) => amBaum(s, vorlageId, (l) => bausteinEntnehmen(l, bausteinId).liste)),

      bausteinVerschieben: (vorlageId, spalteId, von, nach) =>
        set((s) => amBaum(s, vorlageId, (l) => bausteinSortieren(l, spalteId, von, nach))),

      bausteinUmhaengenIn: (vorlageId, bausteinId, spalteId) =>
        set((s) => amBaum(s, vorlageId, (l) => bausteinUmhaengen(l, bausteinId, spalteId))),

      spalteHinzufuegen: (vorlageId, spaltenId) =>
        set((s) => amBaum(s, vorlageId, (l) => spalteAnlegen(l, spaltenId))),

      spalteEntfernen: (vorlageId, spaltenId, spalteId) =>
        set((s) => amBaum(s, vorlageId, (l) => spalteLoeschen(l, spaltenId, spalteId))),
    }),
    {
      name: 'Klevr-rechnungsvorlagen',
      merge: (persisted, current) => {
        const p = persisted as Partial<VorlagenState> | undefined;
        if (!p?.vorlagen?.length) return { ...current, ...p } as VorlagenState;

        // Der Tabellenstil hieß früher `stil`. Der Name ist an das neue
        // Stil-Objekt gefallen, das jeder Baustein tragen kann – gespeicherte
        // Vorlagen werden hier nachgezogen, sonst verlören sie ihren
        // Tabellenkopf. Auch die Gestaltung bekommt fehlende Neuzugänge.
        p.vorlagen = p.vorlagen.map((v) => ({
          ...v,
          gestaltung: { ...v.gestaltung, zeilenabstand: v.gestaltung?.zeilenabstand ?? 1.35 },
          bausteine: nachziehen(v.bausteine ?? []),
        }));

        // Mitgelieferte Vorlagen aus dem Auslieferungsstand nachziehen, eigene
        // unverändert lassen. Neu hinzugekommene mitgelieferte ergänzen.
        const frisch = mitgelieferteVorlagen();
        const eigene = p.vorlagen.filter((v) => !v.mitgeliefert);
        const bekannt = new Set(p.vorlagen.map((v) => v.id));
        const ergaenzt = frisch.filter((v) => !bekannt.has(v.id));

        return {
          ...current,
          ...p,
          vorlagen: [...frisch, ...ergaenzt.filter((v) => !frisch.some((f) => f.id === v.id)), ...eigene],
        } as VorlagenState;
      },
    },
  ),
);
