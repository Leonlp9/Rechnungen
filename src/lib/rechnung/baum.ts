// ─── Bausteine als Baum ──────────────────────────────────────────────────────
//
// Seit es den Spalten-Baustein gibt, ist eine Vorlage keine flache Liste mehr:
// In jeder Spalte steckt wieder eine Bausteinliste. Jede Änderung muss deshalb
// den Baum durchlaufen, statt nur `bausteine.map(...)` zu machen – sonst
// verschwindet alles, was eine Ebene tiefer liegt.
//
// Alle Funktionen hier bauen nur den betroffenen Ast neu und geben den Rest
// unverändert zurück. Damit bleibt der Vergleich in React billig und die
// Vorschau rechnet nur, wenn sich wirklich etwas geändert hat.

import type { Baustein, BausteinTyp } from '@/types/rechnungsvorlage';

/** Kurze, stabile Kennung – dieselbe Machart wie in `vorlagen.ts`. */
export function kennung(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Jeder Baustein der Vorlage, auch die in Spalten. */
export function alleBausteine(liste: Baustein[]): Baustein[] {
  const raus: Baustein[] = [];
  for (const b of liste) {
    raus.push(b);
    if (b.typ === 'spalten') {
      for (const s of b.spalten) raus.push(...alleBausteine(s.bausteine));
    }
  }
  return raus;
}

export function bausteinSuchen(liste: Baustein[], id: string): Baustein | null {
  return alleBausteine(liste).find((b) => b.id === id) ?? null;
}

/**
 * Welche Typen schon vergeben sind. Zählt Spalteninhalte mit, sonst ließe sich
 * eine zweite Positionstabelle anlegen, indem man die erste in eine Spalte
 * schiebt.
 */
export function belegteTypen(liste: Baustein[]): Set<BausteinTyp> {
  return new Set(alleBausteine(liste).map((b) => b.typ));
}

/** Ändert einen Baustein, egal wie tief er steckt. */
export function bausteinPatchen(liste: Baustein[], id: string, patch: Partial<Baustein>): Baustein[] {
  return liste.map((b) => {
    if (b.id === id) return { ...b, ...patch } as Baustein;
    if (b.typ === 'spalten') {
      return {
        ...b,
        spalten: b.spalten.map((s) => ({ ...s, bausteine: bausteinPatchen(s.bausteine, id, patch) })),
      };
    }
    return b;
  });
}

/**
 * Nimmt einen Baustein aus dem Baum heraus und reicht ihn mit zurück. Der
 * Fund liegt in einer Schachtel, weil TypeScript einer Zuweisung innerhalb
 * einer verschachtelten Funktion sonst nicht glaubt.
 */
export function bausteinEntnehmen(
  liste: Baustein[],
  id: string,
): { liste: Baustein[]; baustein: Baustein | null } {
  const fund: { treffer: Baustein | null } = { treffer: null };

  const gehe = (l: Baustein[]): Baustein[] =>
    l.flatMap((b): Baustein[] => {
      if (b.id === id) {
        fund.treffer = b;
        return [];
      }
      if (b.typ === 'spalten') {
        const neu: Baustein = { ...b, spalten: b.spalten.map((s) => ({ ...s, bausteine: gehe(s.bausteine) })) };
        return [neu];
      }
      return [b];
    });

  return { liste: gehe(liste), baustein: fund.treffer };
}

/** Setzt einen Baustein ein. `spalteId === null` heißt: in die Hauptliste. */
export function bausteinEinsetzen(
  liste: Baustein[],
  neu: Baustein,
  spalteId: string | null,
  index?: number,
): Baustein[] {
  const rein = (l: Baustein[]) => {
    const kopie = [...l];
    kopie.splice(index ?? kopie.length, 0, neu);
    return kopie;
  };

  if (spalteId === null) return rein(liste);

  return liste.map((b) => {
    if (b.typ !== 'spalten') return b;
    return {
      ...b,
      spalten: b.spalten.map((s) =>
        s.id === spalteId
          ? { ...s, bausteine: rein(s.bausteine) }
          : { ...s, bausteine: bausteinEinsetzen(s.bausteine, neu, spalteId, index) },
      ),
    };
  });
}

/** Sortiert innerhalb einer Liste um – der Hauptliste oder einer Spalte. */
export function bausteinSortieren(
  liste: Baustein[],
  spalteId: string | null,
  von: number,
  nach: number,
): Baustein[] {
  const um = (l: Baustein[]) => {
    const kopie = [...l];
    const [raus] = kopie.splice(von, 1);
    if (!raus) return l;
    kopie.splice(Math.max(0, Math.min(nach, kopie.length)), 0, raus);
    return kopie;
  };

  if (spalteId === null) return um(liste);

  return liste.map((b) => {
    if (b.typ !== 'spalten') return b;
    return {
      ...b,
      spalten: b.spalten.map((s) =>
        s.id === spalteId
          ? { ...s, bausteine: um(s.bausteine) }
          : { ...s, bausteine: bausteinSortieren(s.bausteine, spalteId, von, nach) },
      ),
    };
  });
}

/**
 * Hängt einen Baustein in eine andere Liste um, ans Ende. Ziehen über Ebenen
 * hinweg wäre wacklig und am Handy kaum zu treffen – deshalb macht das eine
 * Aktion im Menü.
 */
export function bausteinUmhaengen(liste: Baustein[], id: string, zielSpalte: string | null): Baustein[] {
  const { liste: ohne, baustein } = bausteinEntnehmen(liste, id);
  if (!baustein) return liste;
  return bausteinEinsetzen(ohne, baustein, zielSpalte);
}

/** Die Liste, in der ein Baustein liegt – für das Sortieren per Ziehen. */
export function listeVon(
  liste: Baustein[],
  id: string,
): { spalteId: string | null; bausteine: Baustein[] } | null {
  if (liste.some((b) => b.id === id)) return { spalteId: null, bausteine: liste };
  for (const b of liste) {
    if (b.typ !== 'spalten') continue;
    for (const s of b.spalten) {
      if (s.bausteine.some((x) => x.id === id)) return { spalteId: s.id, bausteine: s.bausteine };
      const tiefer = listeVon(s.bausteine, id);
      if (tiefer) return tiefer;
    }
  }
  return null;
}

// ─── Spalten ─────────────────────────────────────────────────────────────────

/** Hängt eine leere Spalte an. Sie bekommt denselben Anteil wie die letzte. */
export function spalteAnlegen(liste: Baustein[], spaltenId: string): Baustein[] {
  return liste.map((b) => {
    if (b.typ !== 'spalten') return b;
    if (b.id === spaltenId) {
      const anteil = b.spalten[b.spalten.length - 1]?.anteil ?? 1;
      return { ...b, spalten: [...b.spalten, { id: kennung(), anteil, bausteine: [] }] };
    }
    return {
      ...b,
      spalten: b.spalten.map((s) => ({ ...s, bausteine: spalteAnlegen(s.bausteine, spaltenId) })),
    };
  });
}

/**
 * Entfernt eine Spalte. Was darin stand, wandert in die Nachbarspalte – eine
 * gelöschte Spalte soll den Inhalt nicht stillschweigend mitnehmen. Die letzte
 * Spalte bleibt stehen; ohne sie wäre der Baustein sinnlos.
 */
export function spalteLoeschen(liste: Baustein[], spaltenId: string, spalteId: string): Baustein[] {
  return liste.map((b) => {
    if (b.typ !== 'spalten') return b;
    if (b.id === spaltenId) {
      if (b.spalten.length <= 1) return b;
      const index = b.spalten.findIndex((s) => s.id === spalteId);
      if (index < 0) return b;
      const inhalt = b.spalten[index].bausteine;
      const nachbar = index > 0 ? index - 1 : 1;
      const bleibt = b.spalten.map((s, i) =>
        i === nachbar ? { ...s, bausteine: [...s.bausteine, ...inhalt] } : s,
      );
      return { ...b, spalten: bleibt.filter((_, i) => i !== index) };
    }
    return {
      ...b,
      spalten: b.spalten.map((s) => ({ ...s, bausteine: spalteLoeschen(s.bausteine, spaltenId, spalteId) })),
    };
  });
}

/** Ein Ziel für „In Spalte verschieben". */
export interface Spaltenziel {
  spaltenId: string;
  spalteId: string;
  /** Der wievielte Spalten-Baustein der Vorlage – nur nötig, wenn es mehrere gibt. */
  bausteinNummer: number;
  /** Die wievielte Spalte darin. */
  nummer: number;
}

/** Alle Spalten der Vorlage, in der Reihenfolge, in der sie auf dem Blatt stehen. */
export function spaltenZiele(liste: Baustein[]): Spaltenziel[] {
  const ziele: Spaltenziel[] = [];
  let bausteinNummer = 0;
  const gehe = (l: Baustein[]) => {
    for (const b of l) {
      if (b.typ !== 'spalten') continue;
      bausteinNummer++;
      const meine = bausteinNummer;
      b.spalten.forEach((s, i) => {
        ziele.push({ spaltenId: b.id, spalteId: s.id, bausteinNummer: meine, nummer: i + 1 });
        gehe(s.bausteine);
      });
    }
  };
  gehe(liste);
  return ziele;
}
