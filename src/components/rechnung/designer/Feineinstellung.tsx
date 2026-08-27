// ─── Die Feineinstellung eines Bausteins ─────────────────────────────────────
//
// Jeder Baustein trägt ein wahlfreies `stil`-Objekt. Damit lassen sich Schrift,
// Farbe, Ausrichtung, Fläche, Rahmen und Breite einzeln übersteuern, ohne die
// Gestaltung des ganzen Dokuments anzufassen.
//
// Weil hier alles wahlfrei ist, zeigt jedes Feld den geerbten Wert als
// Platzhalter: Ein leeres Feld heißt nicht „null", sondern „so wie die
// Vorlage es sagt". Genau diese Unterscheidung fehlte im alten Pixel-Editor,
// wo jede Schriftgröße an jedem Element einzeln stand und deshalb überall
// leicht abwich.

import {
  Ausrichtungszeile, Dreiwahl, Farbzeile, Feldgruppe, Feldtitel, Marke, Vollzeile, Zahlzeile,
} from './Bedienelemente';

import type { BausteinStil, Gestaltung, RahmenSeite } from '@/types/rechnungsvorlage';

const RAHMEN_SEITEN: Array<{ wert: RahmenSeite; label: string }> = [
  { wert: 'oben', label: 'Oben' },
  { wert: 'rechts', label: 'Rechts' },
  { wert: 'unten', label: 'Unten' },
  { wert: 'links', label: 'Links' },
];

export function Feineinstellung({
  stil, setzen, g, fuss,
}: {
  stil: BausteinStil | undefined;
  /** Setzt einzelne Felder des Stils; `undefined` heißt wieder erben. */
  setzen: (patch: Partial<BausteinStil>) => void;
  /** Die Gestaltung der Vorlage – aus ihr stammen die geerbten Werte. */
  g: Gestaltung;
  /** Ein Satz darüber, was bei diesem Baustein davon wirkt. */
  fuss?: string;
}) {
  const s = stil ?? {};
  const seiten = s.rahmenSeiten ?? [];

  const seiteUmschalten = (seite: RahmenSeite) => {
    const an = seiten.includes(seite);
    const neu = RAHMEN_SEITEN
      .map((r) => r.wert)
      .filter((w) => (w === seite ? !an : seiten.includes(w)));
    // Ohne Seiten wäre eine Rahmenstärke wirkungslos – dann lieber ganz weg.
    setzen({ rahmenSeiten: neu.length ? neu : undefined });
  };

  return (
    <>
      <Feldgruppe titel="Schrift" fuss={fuss}>
        <Zahlzeile
          label="Schriftgröße"
          wert={s.schriftgroesse}
          setzen={(v) => setzen({ schriftgroesse: v })}
          einheit="pt" geerbt={g.schriftgroesse} min={4} max={72} schritt={0.5}
        />
        <Zahlzeile
          label="Zeilenabstand"
          hinweis="Vielfaches der Schriftgröße"
          wert={s.zeilenabstand}
          setzen={(v) => setzen({ zeilenabstand: v })}
          einheit="×" geerbt={g.zeilenabstand ?? 1.35} min={0.8} max={3} schritt={0.05}
        />
        <Dreiwahl label="Fett" wert={s.fett} setzen={(v) => setzen({ fett: v })} />
        <Dreiwahl label="Kursiv" wert={s.kursiv} setzen={(v) => setzen({ kursiv: v })} />
        <Ausrichtungszeile
          wahlfrei
          wert={s.ausrichtung}
          setzen={(v) => setzen({ ausrichtung: v })}
        />
        <Farbzeile
          wahlfrei
          label="Textfarbe"
          wert={s.farbe}
          geerbt={g.text}
          setzen={(v) => setzen({ farbe: v || undefined })}
        />
      </Feldgruppe>

      <Feldgruppe
        titel="Fläche und Rahmen"
        fuss="Der Innenabstand wirkt nur, wenn es eine Fläche oder einen Rahmen gibt."
      >
        <Farbzeile
          wahlfrei
          leerLabel="Keine"
          label="Hintergrund"
          wert={s.hintergrund}
          setzen={(v) => setzen({ hintergrund: v || undefined })}
        />
        <Vollzeile>
          <Feldtitel>Rahmen an diesen Seiten</Feldtitel>
          <div className="flex flex-wrap gap-1.5">
            {RAHMEN_SEITEN.map((r) => (
              <Marke
                key={r.wert}
                label={r.label}
                an={seiten.includes(r.wert)}
                umschalten={() => seiteUmschalten(r.wert)}
              />
            ))}
          </div>
        </Vollzeile>
        <Zahlzeile
          label="Rahmenstärke"
          wert={s.rahmenDicke}
          setzen={(v) => setzen({ rahmenDicke: v })}
          einheit="mm" leerText="kein Rahmen" min={0} max={3} schritt={0.1}
        />
        <Farbzeile
          wahlfrei
          label="Rahmenfarbe"
          wert={s.rahmenFarbe}
          geerbt={g.gedaempft}
          setzen={(v) => setzen({ rahmenFarbe: v || undefined })}
        />
        <Zahlzeile
          label="Innenabstand"
          wert={s.innenabstand}
          setzen={(v) => setzen({ innenabstand: v })}
          einheit="mm" leerText="0" min={0} max={30} schritt={0.5}
        />
      </Feldgruppe>

      <Feldgruppe
        titel="Breite"
        fuss="Unter 100 % rückt der Baustein dorthin, wo die Ausrichtung ihn hinstellt – so wird er auch ohne Spalten schmal und schlägt rechts an."
      >
        <Zahlzeile
          label="Breite"
          wert={s.breite}
          setzen={(v) => setzen({ breite: v === undefined ? undefined : Math.min(1, Math.max(0.05, v)) })}
          einheit="%" geerbt={1} faktor={100} min={5} max={100} schritt={1}
        />
      </Feldgruppe>
    </>
  );
}
