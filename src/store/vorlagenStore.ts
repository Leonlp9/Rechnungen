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
import type { Baustein, Gestaltung, Rechnungsvorlage } from '@/types/rechnungsvorlage';
import { mitgelieferteVorlagen } from '@/lib/rechnung/vorlagen';

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
  bausteinAendern: (vorlageId: string, bausteinId: string, patch: Partial<Baustein>) => void;
  bausteinHinzufuegen: (vorlageId: string, baustein: Baustein, position?: number) => void;
  bausteinLoeschen: (vorlageId: string, bausteinId: string) => void;
  bausteinVerschieben: (vorlageId: string, von: number, nach: number) => void;
}

/** Setzt `geaendertAm` – sonst müsste man daran an zwölf Stellen denken. */
function berührt(v: Rechnungsvorlage): Rechnungsvorlage {
  return { ...v, geaendertAm: new Date().toISOString() };
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
        set((s) => ({
          vorlagen: s.vorlagen.map((v) =>
            v.id !== vorlageId
              ? v
              : berührt({
                ...v,
                bausteine: v.bausteine.map((b) =>
                  b.id === bausteinId ? ({ ...b, ...patch } as Baustein) : b,
                ),
              }),
          ),
        })),

      bausteinHinzufuegen: (vorlageId, baustein, position) =>
        set((s) => ({
          vorlagen: s.vorlagen.map((v) => {
            if (v.id !== vorlageId) return v;
            const liste = [...v.bausteine];
            liste.splice(position ?? liste.length, 0, baustein);
            return berührt({ ...v, bausteine: liste });
          }),
        })),

      bausteinLoeschen: (vorlageId, bausteinId) =>
        set((s) => ({
          vorlagen: s.vorlagen.map((v) =>
            v.id !== vorlageId
              ? v
              : berührt({ ...v, bausteine: v.bausteine.filter((b) => b.id !== bausteinId) }),
          ),
        })),

      bausteinVerschieben: (vorlageId, von, nach) =>
        set((s) => ({
          vorlagen: s.vorlagen.map((v) => {
            if (v.id !== vorlageId) return v;
            const liste = [...v.bausteine];
            const [raus] = liste.splice(von, 1);
            if (!raus) return v;
            liste.splice(Math.max(0, Math.min(nach, liste.length)), 0, raus);
            return berührt({ ...v, bausteine: liste });
          }),
        })),
    }),
    {
      name: 'Klevr-rechnungsvorlagen',
      merge: (persisted, current) => {
        const p = persisted as Partial<VorlagenState> | undefined;
        if (!p?.vorlagen?.length) return { ...current, ...p } as VorlagenState;

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
