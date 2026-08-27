// ─── Die Bedienelemente des Baukastens ───────────────────────────────────────
//
// Einstellungen sehen am Desktop und am Handy verschieden aus, sagen aber
// dasselbe. Statt jede Einstellung zweimal zu schreiben, entscheidet der
// Kontext, in welcher Hülle eine Zeile erscheint: am Handy die Gruppenliste
// mit 44-pt-Zeilen, am Desktop eine kompakte Reihe in einer Karte.
//
// Zwei Dinge tauchen im Baukasten überall auf und stehen deshalb hier:
//
//  1. Wahlfreie Werte. Fast jede Feineinstellung darf fehlen und wird dann
//     geerbt. Ein leeres Feld muss also sagen, was passiert, wenn man nichts
//     einträgt – deshalb steht der geerbte Wert im Platzhalter.
//  2. Farben. Ein Farbfeld allein ist auf dem Handy mühsam; die Vorschlagsreihe
//     daneben trifft man mit dem Finger.

import { createContext, useContext, useState } from 'react';
import { ChevronRight } from 'lucide-react';

import { FormFullRow, FormGroup, FormRow } from '@/components/ui/form-list';
import { Segmented } from '@/components/ui/segmented';
import { cn } from '@/lib/utils';

export const HandyKontext = createContext(false);
export const useHandy = () => useContext(HandyKontext);

/**
 * Farbvorschläge. Vorn die kräftigen Akzente, hinten die Grautöne – die
 * braucht man für Hintergründe, Linien und gedämpften Text.
 */
export const FARB_VORSCHLAEGE = [
  '#1d4ed8', '#0f766e', '#334155', '#b91c1c', '#c2410c',
  '#7c3aed', '#be185d', '#15803d', '#0e7490', '#a16207',
  '#111827', '#6b7280', '#cbd5e1', '#f1f5f9', '#ffffff',
];

// ─── Hüllen ──────────────────────────────────────────────────────────────────

export function Feldgruppe({
  titel, fuss, children,
}: { titel?: string; fuss?: string; children: React.ReactNode }) {
  const handy = useHandy();
  if (handy) return <FormGroup title={titel} footer={fuss}>{children}</FormGroup>;
  return (
    <section className="space-y-1.5">
      {titel && (
        <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{titel}</h3>
      )}
      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {children}
      </div>
      {fuss && <p className="px-1 text-[11px] leading-snug text-muted-foreground">{fuss}</p>}
    </section>
  );
}

export function Feldzeile({
  label, hinweis, children,
}: { label: string; hinweis?: string; children: React.ReactNode }) {
  const handy = useHandy();
  if (handy) return <FormRow label={label} hint={hinweis}>{children}</FormRow>;
  return (
    <div className="flex min-h-9 items-center gap-3 px-2.5 py-1.5">
      <span className="min-w-0 flex-1">
        <span className="block text-xs">{label}</span>
        {hinweis && <span className="block text-[11px] leading-snug text-muted-foreground">{hinweis}</span>}
      </span>
      <div className="flex shrink-0 items-center justify-end">{children}</div>
    </div>
  );
}

export function Vollzeile({ children }: { children: React.ReactNode }) {
  const handy = useHandy();
  if (handy) return <FormFullRow>{children}</FormFullRow>;
  return <div className="px-2.5 py-2">{children}</div>;
}

/** Kleine Überschrift innerhalb einer Vollzeile. */
export function Feldtitel({ children }: { children: React.ReactNode }) {
  const handy = useHandy();
  return (
    <span className={cn('mb-1.5 block text-muted-foreground', handy ? 'text-[13px]' : 'text-[11px]')}>
      {children}
    </span>
  );
}

/**
 * Aufklappbarer Abschnitt. Die zwei, drei Angaben, die man ständig braucht,
 * stehen offen da; alles andere liegt darunter, damit die Einstellungen eines
 * Bausteins nicht wie ein Cockpit wirken.
 */
export function Aufklapper({
  titel, hinweis, children,
}: { titel: string; hinweis?: string; children: React.ReactNode }) {
  const handy = useHandy();
  const [offen, setOffen] = useState(false);
  return (
    <div className={handy ? 'space-y-3' : 'space-y-2'}>
      <button
        type="button"
        onClick={() => setOffen(!offen)}
        aria-expanded={offen}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border border-border bg-card text-left transition-colors hover:bg-muted/50',
          handy ? 'min-h-[44px] px-4 py-2 text-[17px]' : 'min-h-8 px-2.5 py-1.5 text-xs',
        )}
      >
        <ChevronRight
          className={cn('shrink-0 text-muted-foreground transition-transform', handy ? 'h-4 w-4' : 'h-3.5 w-3.5', offen && 'rotate-90')}
        />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{titel}</span>
          {hinweis && (
            <span className={cn('block leading-snug text-muted-foreground', handy ? 'text-[13px]' : 'text-[11px]')}>
              {hinweis}
            </span>
          )}
        </span>
      </button>
      {offen && <div className={handy ? 'space-y-6' : 'space-y-3'}>{children}</div>}
    </div>
  );
}

// ─── Werte ───────────────────────────────────────────────────────────────────

/** Deutsche Schreibweise mit Komma, ohne unnötige Nachkommastellen. */
function zahlText(wert: number): string {
  return Number.isInteger(wert) ? String(wert) : String(Math.round(wert * 100) / 100).replace('.', ',');
}

/**
 * Regler mit Wertanzeige – für Werte, die immer gesetzt sind. Am Handy bekommt
 * er eine eigene Zeile: Neben einer Beschriftung wie „Zwischen Bausteinen"
 * bliebe von der Spur nichts übrig, das man noch treffen könnte.
 */
export function Reglerzeile({
  label, hinweis, wert, min, max, schritt = 1, einheit, setzen,
}: {
  label: string;
  hinweis?: string;
  wert: number; min: number; max: number; schritt?: number; einheit: string;
  setzen: (v: number) => void;
}) {
  const handy = useHandy();
  const anzeige = `${zahlText(wert)} ${einheit}`;
  const spur = (
    <input
      type="range"
      min={min}
      max={max}
      step={schritt}
      value={wert}
      onChange={(e) => setzen(Number(e.target.value))}
      aria-label={label}
      className={cn('cursor-pointer accent-primary', handy ? 'mt-2.5 h-1.5 w-full' : 'h-1 w-28')}
    />
  );

  if (handy) {
    return (
      <FormFullRow>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[17px]">{label}</span>
          <span className="shrink-0 text-[15px] tabular-nums text-muted-foreground">{anzeige}</span>
        </div>
        {hinweis && <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{hinweis}</span>}
        {spur}
      </FormFullRow>
    );
  }

  return (
    <Feldzeile label={label} hinweis={hinweis}>
      <div className="flex items-center gap-2">
        {spur}
        <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">{anzeige}</span>
      </div>
    </Feldzeile>
  );
}

/**
 * Zahlenfeld für einen wahlfreien Wert. Bleibt es leer, erbt der Baustein –
 * und damit das nicht geraten werden muss, steht der geerbte Wert als
 * Platzhalter darin („erbt (10 pt)").
 *
 * `faktor` rechnet für die Anzeige um: Anteile stehen im Modell als 0 bis 1,
 * gezeigt werden sie in Prozent.
 */
export function Zahlzeile({
  label, hinweis, wert, setzen, einheit, geerbt, leerText, min = 0, max, schritt = 1, faktor = 1,
}: {
  label: string;
  hinweis?: string;
  wert: number | undefined;
  setzen: (v: number | undefined) => void;
  einheit: string;
  /** Was gilt, solange das Feld leer bleibt. */
  geerbt?: number;
  /** Ersetzt den Platzhalter, wo nichts geerbt wird – etwa „kein Rahmen". */
  leerText?: string;
  min?: number; max?: number; schritt?: number; faktor?: number;
}) {
  const handy = useHandy();
  const platzhalter = leerText ?? (geerbt === undefined ? 'erbt' : `erbt (${zahlText(geerbt * faktor)})`);

  return (
    <Feldzeile label={label} hinweis={hinweis}>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={schritt}
          value={wert === undefined ? '' : Math.round(wert * faktor * 100) / 100}
          placeholder={platzhalter}
          aria-label={label}
          onChange={(e) => {
            const roh = e.target.value.trim();
            if (roh === '') { setzen(undefined); return; }
            const n = Number(roh.replace(',', '.'));
            if (Number.isFinite(n)) setzen(n / faktor);
          }}
          className={cn(
            'rounded-md border border-border bg-background text-right outline-none focus:border-ring',
            handy ? 'h-9 w-28 px-2 text-[15px]' : 'h-8 w-24 px-1.5 text-xs',
          )}
        />
        <span className={cn('w-6 shrink-0 text-muted-foreground', handy ? 'text-[15px]' : 'text-[11px]')}>
          {einheit}
        </span>
      </div>
    </Feldzeile>
  );
}

/**
 * Ein Schalter, der auch „nichts sagen" kann. Bei fett und kursiv ist das
 * nötig: Der Betreff ist von sich aus fett, und „Aus" ist etwas anderes als
 * „nicht festgelegt".
 */
export function Dreiwahl({
  label, hinweis, wert, setzen, geerbt,
}: {
  label: string;
  hinweis?: string;
  wert: boolean | undefined;
  setzen: (v: boolean | undefined) => void;
  /** Was gilt, solange nichts festgelegt ist. */
  geerbt?: boolean;
}) {
  return (
    <Wahlzeile
      label={label}
      hinweis={hinweis}
      wert={wert === undefined ? 'erbt' : wert ? 'an' : 'aus'}
      setzen={(v) => setzen(v === 'erbt' ? undefined : v === 'an')}
      breite="w-52"
      optionen={[
        { value: 'erbt', label: geerbt === undefined ? 'Erbt' : geerbt ? 'Erbt (an)' : 'Erbt (aus)' },
        { value: 'aus', label: 'Aus' },
        { value: 'an', label: 'An' },
      ]}
    />
  );
}

/** Waagerechte Ausrichtung, wahlweise mit „Erbt". */
export function Ausrichtungszeile({
  label = 'Ausrichtung', wert, setzen, wahlfrei,
}: {
  label?: string;
  wert: 'links' | 'mitte' | 'rechts' | undefined;
  setzen: (v: 'links' | 'mitte' | 'rechts' | undefined) => void;
  wahlfrei?: boolean;
}) {
  return (
    <Wahlzeile
      label={label}
      wert={wert ?? 'erbt'}
      setzen={(v) => setzen(v === 'erbt' ? undefined : (v as 'links' | 'mitte' | 'rechts'))}
      breite={wahlfrei ? 'w-60' : 'w-44'}
      optionen={[
        ...(wahlfrei ? [{ value: 'erbt', label: 'Erbt' }] : []),
        { value: 'links', label: 'Links' },
        { value: 'mitte', label: 'Mitte' },
        { value: 'rechts', label: 'Rechts' },
      ]}
    />
  );
}

/**
 * Segmentierte Auswahl in einer Zeile. Am Handy steht sie unter ihrer
 * Beschriftung und nimmt die volle Breite: Vier Möglichkeiten neben dem Wort
 * „Ausrichtung" schoben sich sonst gegenseitig aus dem Bild.
 */
export function Wahlzeile({
  label, hinweis, wert, setzen, optionen, breite,
}: {
  label: string;
  hinweis?: string;
  wert: string;
  setzen: (v: string) => void;
  optionen: ReadonlyArray<{ value: string; label: string }>;
  /** Breite am Desktop, wo die Auswahl rechts in der Zeile sitzt. */
  breite: string;
}) {
  const handy = useHandy();
  const auswahl = (
    <Segmented value={wert} onChange={setzen} options={optionen} className={handy ? 'w-full' : breite} />
  );

  if (handy) {
    return (
      <FormFullRow>
        <span className="mb-2 block text-[17px]">{label}</span>
        {hinweis && <span className="-mt-1.5 mb-2 block text-[13px] leading-snug text-muted-foreground">{hinweis}</span>}
        {auswahl}
      </FormFullRow>
    );
  }
  return <Feldzeile label={label} hinweis={hinweis}>{auswahl}</Feldzeile>;
}

/**
 * Farbfeld samt Vorschlagsreihe. Ein Farbfeld ist am Handy schwer zu treffen,
 * wenn es nur so hoch ist wie eine Zeile Text – die Maße sind deshalb am
 * Finger genommen, nicht am Schriftbild.
 *
 * Ist die Farbe wahlfrei, heißt ein leerer Wert „erben": Der Knopf rechts
 * räumt sie wieder ab, und der geerbte Ton steht solange im Farbfeld.
 */
export function Farbzeile({
  label, hinweis, wert, setzen, geerbt, wahlfrei, leerLabel = 'Erben',
}: {
  label: string;
  hinweis?: string;
  /** Leerer Text heißt bei wahlfreien Farben: erben. */
  wert: string | undefined;
  setzen: (v: string) => void;
  geerbt?: string;
  wahlfrei?: boolean;
  /** Beschriftung des Zurücksetzens – bei Flächen eher „Keine". */
  leerLabel?: string;
}) {
  const handy = useHandy();
  const gesetzt = !!wert;
  const angezeigt = gesetzt ? (wert as string) : (geerbt || '#000000');

  return (
    <Vollzeile>
      <div className="flex items-baseline justify-between gap-3">
        <span className={handy ? 'text-[17px]' : 'text-xs'}>{label}</span>
        {wahlfrei && (
          <button
            type="button"
            disabled={!gesetzt}
            onClick={() => setzen('')}
            className={cn(
              'shrink-0',
              handy ? 'text-[15px]' : 'text-[11px]',
              gesetzt ? 'text-primary' : 'cursor-default text-muted-foreground/60',
            )}
          >
            {gesetzt ? leerLabel : leerLabel === 'Erben' ? 'erbt' : 'keine'}
          </button>
        )}
      </div>
      {hinweis && (
        <span className={cn('mt-0.5 block leading-snug text-muted-foreground', handy ? 'text-[13px]' : 'text-[11px]')}>
          {hinweis}
        </span>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <input
          type="color"
          value={angezeigt}
          onChange={(e) => setzen(e.target.value)}
          aria-label={label}
          className={cn(
            'cursor-pointer rounded border border-border bg-transparent',
            handy ? 'mr-1 h-9 w-14' : 'mr-1 h-7 w-11',
          )}
        />
        {FARB_VORSCHLAEGE.map((farbe) => (
          <button
            key={farbe}
            type="button"
            onClick={() => setzen(farbe)}
            style={{ background: farbe }}
            aria-label={`${label} ${farbe}`}
            className={cn(
              'rounded-full border-2 transition-transform',
              handy ? 'h-7 w-7' : 'h-5 w-5',
              gesetzt && (wert as string).toLowerCase() === farbe ? 'border-foreground' : 'border-border/60',
            )}
          />
        ))}
      </div>
    </Vollzeile>
  );
}

/** Textfeld über die volle Breite – für Betreff, Absätze und Beschriftungen. */
export function Textfeld({
  wert, setzen, platzhalter, mehrzeilig,
}: {
  wert: string; setzen: (v: string) => void; platzhalter?: string; mehrzeilig?: boolean;
}) {
  const handy = useHandy();
  const gemeinsam = {
    value: wert,
    placeholder: platzhalter,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setzen(e.target.value),
  };
  const klasse = handy
    ? 'w-full resize-none bg-transparent text-[17px] outline-none placeholder:text-muted-foreground/60'
    : 'w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-ring';

  if (mehrzeilig) return <textarea rows={handy ? 4 : 3} {...gemeinsam} className={klasse} />;
  return <input {...gemeinsam} className={klasse} />;
}

/** Kleines Textfeld für eine Zeile in einer Tabelle aus Beschriftung und Wert. */
export function Kurzfeld({
  wert, setzen, platzhalter, klasse,
}: { wert: string; setzen: (v: string) => void; platzhalter?: string; klasse?: string }) {
  const handy = useHandy();
  return (
    <input
      value={wert}
      placeholder={platzhalter}
      onChange={(e) => setzen(e.target.value)}
      className={cn(
        'min-w-0 rounded-md border border-border bg-background outline-none focus:border-ring placeholder:text-muted-foreground/60',
        handy ? 'h-9 px-2 text-[15px]' : 'h-8 px-1.5 text-xs',
        klasse,
      )}
    />
  );
}

/**
 * An- und abwählbare Marke – für Eckdatenfelder, Tabellenspalten, Rahmenseiten.
 *
 * Eine gesperrte Marke bleibt sichtbar angehakt. Sie blass zu zeichnen hieße,
 * „Beschreibung" und „Betrag" wie abgewählte Spalten aussehen zu lassen,
 * obwohl sie auf jeder Rechnung gedruckt werden.
 */
export function Marke({
  label, an, gesperrt, titel, umschalten,
}: { label: string; an: boolean; gesperrt?: boolean; titel?: string; umschalten: () => void }) {
  const handy = useHandy();
  return (
    <button
      type="button"
      disabled={gesperrt}
      onClick={umschalten}
      title={titel ?? (gesperrt ? 'Gehört auf jede Rechnung und bleibt an.' : undefined)}
      className={cn(
        'rounded-full border transition-colors',
        handy ? 'px-3 py-1.5 text-[15px]' : 'px-2.5 py-1 text-xs',
        an ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground',
        gesperrt && 'cursor-default',
      )}
    >
      {label}
    </button>
  );
}
