// ─── Was ein einzelner Baustein kann ─────────────────────────────────────────
//
// Ein Baustein hat schnell zwanzig Stellschrauben. Alle nebeneinander zu
// zeigen hieße, dass man die zwei findet, die man sucht, nur noch durch Suchen.
// Deshalb dreistufig:
//
//   1. Offen: die zwei, drei Angaben, wegen derer man den Baustein anfasst.
//   2. „Mehr": alles Weitere, das dieser Baustein selbst mitbringt.
//   3. „Feineinstellung": das `stil`-Objekt, das jeder Baustein gleich hat.
//
// Darunter der Platz (Abstand darüber und darunter) und, wenn es sein muss,
// der Knopf zum Entfernen.

import { useRef } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Segmented } from '@/components/ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { kennung } from '@/lib/rechnung/baum';

import {
  Aufklapper, Farbzeile, Feldgruppe, Feldtitel, Feldzeile, Kurzfeld, Marke,
  Reglerzeile, Textfeld, Vollzeile, Wahlzeile, Zahlzeile, useHandy,
} from './Bedienelemente';
import { Feineinstellung } from './Feineinstellung';

import type {
  AnschriftBaustein, Baustein, BausteinStil, BetreffBaustein, BildBaustein, EckdatenBaustein,
  EckdatenFeld, EigeneZeile, FusszeileBaustein, Gestaltung, KopfBaustein, LinieBaustein,
  ListeBaustein, PositionenBaustein, PositionsSpalte, SpaltenBaustein, TextBaustein,
  UnterschriftBaustein, ZahlungBaustein,
} from '@/types/rechnungsvorlage';
import { ECKDATEN_LABELS, FUSS_LABELS, SPALTEN_LABELS } from '@/types/rechnungsvorlage';

// ─── Feste Reihenfolgen ──────────────────────────────────────────────────────

/** Reihenfolge der Eckdaten – unabhängig davon, wann man sie anhakt. */
const ECKDATEN_ORDER: EckdatenFeld[] = [
  'doc_number', 'doc_date', 'delivery_date', 'due_date', 'customer_number',
];

const SPALTEN_ORDER: PositionsSpalte[] = [
  'pos', 'beschreibung', 'menge', 'einheit', 'einzelpreis', 'rabatt', 'betrag',
];

const FUSS_ORDER = Object.keys(FUSS_LABELS) as Array<keyof typeof FUSS_LABELS>;

/** Ohne Beschreibung und Betrag ist die Tabelle keine Rechnung mehr. */
const PFLICHTSPALTEN: PositionsSpalte[] = ['beschreibung', 'betrag'];

/**
 * Dieselben Gewichte, mit denen `layout.ts` rechnet, wenn keine eigenen
 * Breiten gesetzt sind. Sie stehen hier noch einmal, damit die Regler beim
 * Einschalten genau dort stehen, wo die Tabelle gerade steht – und man nicht
 * mit einer plötzlich anderen Aufteilung anfängt.
 */
const SPALTEN_GEWICHT: Record<PositionsSpalte, number> = {
  pos: 0.6, beschreibung: 4.4, menge: 0.8, einheit: 0.8,
  einzelpreis: 1.2, rabatt: 0.8, betrag: 1.3,
};

function standardBreiten(spalten: PositionsSpalte[]): number[] {
  const summe = spalten.reduce((s, c) => s + SPALTEN_GEWICHT[c], 0) || 1;
  return spalten.map((c) => SPALTEN_GEWICHT[c] / summe);
}

// ─── Frei benannte Zeilen ────────────────────────────────────────────────────

/**
 * Beschriftung und Wert, beliebig oft. Genau dasselbe braucht die freie Liste
 * und brauchen die Zusatzzeilen der Eckdaten – deshalb einmal hier.
 */
function ZeilenListe({
  zeilen, setzen,
}: { zeilen: EigeneZeile[]; setzen: (z: EigeneZeile[]) => void }) {
  const handy = useHandy();

  const tausche = (i: number, richtung: -1 | 1) => {
    const ziel = i + richtung;
    if (ziel < 0 || ziel >= zeilen.length) return;
    const kopie = [...zeilen];
    [kopie[i], kopie[ziel]] = [kopie[ziel], kopie[i]];
    setzen(kopie);
  };

  return (
    <Vollzeile>
      <Feldtitel>Zeilen</Feldtitel>
      <div className="space-y-2">
        {zeilen.map((z, i) => (
          <div key={z.id} className={cn('flex gap-1.5', handy ? 'flex-col' : 'items-center')}>
            <div className={cn('flex min-w-0 gap-1.5', handy ? 'w-full' : 'flex-1')}>
              <Kurzfeld
                wert={z.beschriftung}
                platzhalter="Beschriftung"
                klasse="flex-1"
                setzen={(v) => setzen(zeilen.map((x) => (x.id === z.id ? { ...x, beschriftung: v } : x)))}
              />
              <Kurzfeld
                wert={z.wert}
                platzhalter="Wert oder {{platzhalter}}"
                klasse="flex-1"
                setzen={(v) => setzen(zeilen.map((x) => (x.id === z.id ? { ...x, wert: v } : x)))}
              />
            </div>
            {/* Ringsum staffelt diese Datei längst nach `handy` – diese drei
                blieben als Einzige auf Mausgröße stehen. 28 Pixel trifft man
                mit dem Finger nicht. */}
            <div className="flex shrink-0 items-center gap-0.5 self-end">
              <Button
                variant="ghost" size="icon-sm" aria-label="Nach oben"
                className={cn(handy && 'h-11 w-11')}
                disabled={i === 0} onClick={() => tausche(i, -1)}
              >
                <ArrowUp />
              </Button>
              <Button
                variant="ghost" size="icon-sm" aria-label="Nach unten"
                className={cn(handy && 'h-11 w-11')}
                disabled={i === zeilen.length - 1} onClick={() => tausche(i, 1)}
              >
                <ArrowDown />
              </Button>
              <Button
                variant="ghost" size="icon-sm" aria-label="Zeile löschen"
                className={cn(handy && 'h-11 w-11')}
                onClick={() => setzen(zeilen.filter((x) => x.id !== z.id))}
              >
                <Trash2 className="text-muted-foreground" />
              </Button>
            </div>
          </div>
        ))}
        {zeilen.length === 0 && (
          <p className={cn('text-muted-foreground', handy ? 'text-[15px]' : 'text-xs')}>Noch keine Zeile.</p>
        )}
        <Button
          variant="outline"
          size={handy ? 'default' : 'sm'}
          className="w-full"
          onClick={() => setzen([...zeilen, { id: kennung(), beschriftung: '', wert: '' }])}
        >
          <Plus /> Zeile hinzufügen
        </Button>
      </div>
    </Vollzeile>
  );
}

// ─── Die einzelnen Bausteine ─────────────────────────────────────────────────

function KopfFelder({ b, aendern, g }: { b: KopfBaustein; aendern: (p: Partial<KopfBaustein>) => void; g: Gestaltung }) {
  const handy = useHandy();
  return (
    <>
      <Feldgruppe titel="Kopfzeile" fuss={'Das Logo lädst du unter „Aussehen" hoch – es gilt für die ganze Vorlage.'}>
        <Vollzeile>
          <Feldtitel>Titel</Feldtitel>
          <Textfeld wert={b.titel} setzen={(v) => aendern({ titel: v })} platzhalter="Rechnung" />
        </Vollzeile>
        <Feldzeile label="Logo steht">
          <Segmented
            value={b.logoSeite}
            onChange={(v) => aendern({ logoSeite: v })}
            options={[{ value: 'links', label: 'Links' }, { value: 'rechts', label: 'Rechts' }]}
            className={handy ? 'w-44' : 'w-32'}
          />
        </Feldzeile>
        <Reglerzeile label="Logohöhe" wert={b.logoHoehe} min={6} max={40} einheit="mm" setzen={(v) => aendern({ logoHoehe: v })} />
        <Feldzeile label="Balken darunter">
          <Switch checked={b.trennlinie} onCheckedChange={(v) => aendern({ trennlinie: v })} />
        </Feldzeile>
      </Feldgruppe>

      <Aufklapper titel="Mehr zum Titel" hinweis="Größe, Farbe, Großbuchstaben, Stärke des Balkens">
        <Feldgruppe>
          <Zahlzeile
            label="Titelgröße" hinweis="Vielfaches der Grundschrift"
            wert={b.titelFaktor} setzen={(v) => aendern({ titelFaktor: v })}
            einheit="×" geerbt={2.2} min={0.8} max={6} schritt={0.1}
          />
          <Feldzeile label="Großbuchstaben">
            <Switch
              checked={b.titelGrossbuchstaben ?? true}
              onCheckedChange={(v) => aendern({ titelGrossbuchstaben: v })}
            />
          </Feldzeile>
          <Zahlzeile
            label="Stärke des Balkens"
            wert={b.linienDicke} setzen={(v) => aendern({ linienDicke: v })}
            einheit="mm" geerbt={0.8} min={0.1} max={5} schritt={0.1}
          />
          <Farbzeile
            wahlfrei label="Titel- und Balkenfarbe" wert={b.titelFarbe} geerbt={g.akzent}
            setzen={(v) => aendern({ titelFarbe: v || undefined })}
          />
        </Feldgruppe>
      </Aufklapper>
    </>
  );
}

function AnschriftFelder({ b, aendern }: { b: AnschriftBaustein; aendern: (p: Partial<AnschriftBaustein>) => void }) {
  return (
    <>
      <Feldgruppe
        titel="Anschriftfeld"
        fuss="Die kleine Zeile über der Anschrift zeigt deinen Absender – im Fensterumschlag steht sie über dem Sichtfenster."
      >
        <Feldzeile label="Absenderzeile">
          <Switch checked={b.absenderzeile} onCheckedChange={(v) => aendern({ absenderzeile: v })} />
        </Feldzeile>
      </Feldgruppe>

      <Aufklapper titel="Mehr" hinweis="Breite des Felds, Text darüber">
        <Feldgruppe fuss={'Der Vorspann steht klein über der Anschrift – etwa „An" oder eine Kundennummer. Platzhalter sind erlaubt.'}>
          <Zahlzeile
            label="Feldbreite" wert={b.feldBreite} setzen={(v) => aendern({ feldBreite: v })}
            einheit="mm" geerbt={85} min={30} max={140} schritt={1}
          />
          <Vollzeile>
            <Feldtitel>Vorspann</Feldtitel>
            <Textfeld
              wert={b.vorspann ?? ''}
              setzen={(v) => aendern({ vorspann: v || undefined })}
              platzhalter="Kundennummer {{customer_number}}"
            />
          </Vollzeile>
        </Feldgruppe>
      </Aufklapper>
    </>
  );
}

function EckdatenFelder({ b, aendern }: { b: EckdatenBaustein; aendern: (p: Partial<EckdatenBaustein>) => void }) {
  const handy = useHandy();
  return (
    <>
      <Feldgruppe
        titel="Eckdaten"
        fuss="Als Block stehen die Angaben rechts neben der Anschrift, als Zeile nebeneinander darunter, als Liste untereinander über die volle Breite."
      >
        <Feldzeile label="Form">
          <Segmented
            value={b.form}
            onChange={(v) => aendern({ form: v })}
            options={[
              { value: 'block', label: 'Block' },
              { value: 'zeile', label: 'Zeile' },
              { value: 'liste', label: 'Liste' },
            ]}
            className={handy ? 'w-56' : 'w-44'}
          />
        </Feldzeile>
        <Vollzeile>
          <Feldtitel>Angaben</Feldtitel>
          <div className="flex flex-wrap gap-1.5">
            {ECKDATEN_ORDER.map((feld) => {
              const an = b.felder.includes(feld);
              return (
                <Marke
                  key={feld}
                  label={ECKDATEN_LABELS[feld]}
                  an={an}
                  umschalten={() =>
                    aendern({ felder: ECKDATEN_ORDER.filter((f) => (f === feld ? !an : b.felder.includes(f))) })
                  }
                />
              );
            })}
          </div>
        </Vollzeile>
      </Feldgruppe>

      <Aufklapper titel="Eigene Beschriftungen" hinweis={'Statt „Fällig bis" etwa „Zahlbar bis"'}>
        <Feldgruppe fuss="Leer heißt: die vorgegebene Beschriftung.">
          <Vollzeile>
            <div className="space-y-2">
              {b.felder.length === 0 && (
                <p className={cn('text-muted-foreground', handy ? 'text-[15px]' : 'text-xs')}>
                  Erst eine Angabe anhaken.
                </p>
              )}
              {b.felder.map((feld) => (
                <div key={feld} className="flex items-center gap-2">
                  <span className={cn('min-w-0 flex-1 truncate text-muted-foreground', handy ? 'text-[15px]' : 'text-xs')}>
                    {ECKDATEN_LABELS[feld]}
                  </span>
                  <Kurzfeld
                    wert={b.beschriftungen?.[feld] ?? ''}
                    platzhalter={ECKDATEN_LABELS[feld]}
                    klasse={handy ? 'w-40' : 'w-36'}
                    setzen={(v) => aendern({ beschriftungen: { ...b.beschriftungen, [feld]: v || undefined } })}
                  />
                </div>
              ))}
            </div>
          </Vollzeile>
        </Feldgruppe>
      </Aufklapper>

      <Aufklapper titel="Zusatzzeilen" hinweis={'Frei benannte Zeilen, etwa „Bestellnummer"'}>
        <Feldgruppe fuss="Im Wert sind Platzhalter erlaubt, etwa {{doc_number}}.">
          <ZeilenListe zeilen={b.eigene ?? []} setzen={(z) => aendern({ eigene: z })} />
        </Feldgruppe>
      </Aufklapper>

      <Aufklapper titel="Maße" hinweis="Breite des Blocks, Anteil der Beschriftung">
        <Feldgruppe>
          <Zahlzeile
            label="Blockbreite" hinweis={'Nur in der Form „Block"'}
            wert={b.blockBreite} setzen={(v) => aendern({ blockBreite: v })}
            einheit="mm" geerbt={62} min={25} max={110} schritt={1}
          />
          <Zahlzeile
            label="Anteil der Beschriftung"
            wert={b.beschriftungsAnteil}
            setzen={(v) => aendern({ beschriftungsAnteil: v === undefined ? undefined : Math.min(0.9, Math.max(0.1, v)) })}
            einheit="%" geerbt={0.55} faktor={100} min={10} max={90} schritt={5}
          />
        </Feldgruppe>
      </Aufklapper>
    </>
  );
}

function BetreffFelder({ b, aendern }: { b: BetreffBaustein; aendern: (p: Partial<BetreffBaustein>) => void }) {
  return (
    <Feldgruppe titel="Betreff" fuss="In geschweiften Klammern stehen Platzhalter, etwa {{doc_number}} für die Rechnungsnummer.">
      <Vollzeile>
        <Textfeld wert={b.inhalt} setzen={(v) => aendern({ inhalt: v })} platzhalter="Rechnung {{doc_number}}" />
      </Vollzeile>
    </Feldgruppe>
  );
}

function TextFelder({ b, aendern }: { b: TextBaustein; aendern: (p: Partial<TextBaustein>) => void }) {
  const handy = useHandy();
  return (
    <Feldgruppe
      titel="Text"
      fuss={
        b.quelle === 'feld'
          ? 'Der Absatz zeigt, was beim Schreiben der Rechnung in diesem Feld steht.'
          : 'Fester Text erscheint auf jeder Rechnung gleich. Platzhalter wie {{doc_number}} sind erlaubt.'
      }
    >
      <Feldzeile label="Quelle">
        <Segmented
          value={b.quelle}
          onChange={(v) => aendern({ quelle: v, inhalt: v === 'feld' ? 'notes' : '' })}
          options={[{ value: 'fest', label: 'Fester Text' }, { value: 'feld', label: 'Feld' }]}
          className={handy ? 'w-52' : 'w-40'}
        />
      </Feldzeile>
      {b.quelle === 'feld' ? (
        <Feldzeile label="Feld">
          <Select value={b.inhalt} onValueChange={(v) => aendern({ inhalt: v })}>
            <SelectTrigger className={handy ? 'h-9 w-44' : 'h-8 w-40 text-xs'}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="notes">Anschreiben</SelectItem>
              <SelectItem value="legal_notice">Steuerhinweis</SelectItem>
              <SelectItem value="payment_terms">Zahlungsziel</SelectItem>
            </SelectContent>
          </Select>
        </Feldzeile>
      ) : (
        <Vollzeile>
          <Textfeld
            wert={b.inhalt}
            setzen={(v) => aendern({ inhalt: v })}
            platzhalter="Vielen Dank für Ihren Auftrag."
            mehrzeilig
          />
        </Vollzeile>
      )}
      <Feldzeile label="Größe">
        <Segmented
          value={b.groesse}
          onChange={(v) => aendern({ groesse: v })}
          options={[{ value: 'normal', label: 'Normal' }, { value: 'klein', label: 'Klein' }]}
          className={handy ? 'w-44' : 'w-32'}
        />
      </Feldzeile>
      <Feldzeile label="Fett">
        <Switch checked={b.betont} onCheckedChange={(v) => aendern({ betont: v })} />
      </Feldzeile>
    </Feldgruppe>
  );
}

function PositionenFelder({
  b, aendern, g,
}: { b: PositionenBaustein; aendern: (p: Partial<PositionenBaustein>) => void; g: Gestaltung }) {
  const handy = useHandy();
  const eigeneBreiten = !!b.spaltenBreiten && b.spaltenBreiten.length === b.spalten.length;
  const breiten = eigeneBreiten ? (b.spaltenBreiten as number[]) : standardBreiten(b.spalten);
  const summe = breiten.reduce((s, v) => s + Math.max(0, v), 0) || 1;

  /**
   * Eine Spalte an- oder abwählen. Eigene Breiten wandern mit: Sie wirken nur,
   * solange die Liste genauso lang ist wie die Spaltenliste – ohne das
   * Nachziehen fiele die Tabelle beim ersten Häkchen auf die Vorgabe zurück.
   */
  const spalteUmschalten = (spalte: PositionsSpalte) => {
    const an = b.spalten.includes(spalte);
    const neu = SPALTEN_ORDER.filter((s) => (s === spalte ? !an : b.spalten.includes(s)));
    if (!eigeneBreiten) { aendern({ spalten: neu }); return; }
    const vorher = new Map(b.spalten.map((s, i) => [s, breiten[i]]));
    const vorgabe = standardBreiten(neu);
    aendern({ spalten: neu, spaltenBreiten: neu.map((s, i) => vorher.get(s) ?? vorgabe[i]) });
  };

  return (
    <>
      <Feldgruppe titel="Positionen" fuss="Beschreibung und Betrag gehören auf jede Rechnung und lassen sich deshalb nicht abwählen.">
        <Vollzeile>
          <Feldtitel>Spalten</Feldtitel>
          <div className="flex flex-wrap gap-1.5">
            {SPALTEN_ORDER.map((spalte) => (
              <Marke
                key={spalte}
                label={SPALTEN_LABELS[spalte]}
                an={b.spalten.includes(spalte)}
                gesperrt={PFLICHTSPALTEN.includes(spalte)}
                umschalten={() => spalteUmschalten(spalte)}
              />
            ))}
          </div>
        </Vollzeile>
        <Vollzeile>
          <Feldtitel>Stil der Tabelle</Feldtitel>
          <Segmented
            value={b.stilVariante ?? 'linien'}
            onChange={(v) => aendern({ stilVariante: v })}
            options={[
              { value: 'linien', label: 'Balken' },
              { value: 'zebra', label: 'Zebra' },
              { value: 'schlicht', label: 'Schlicht' },
              { value: 'rahmen', label: 'Rahmen' },
            ]}
            className="w-full"
          />
        </Vollzeile>
        <Feldzeile label="Umsatzsteuer">
          <Select
            value={String(b.mwstSatz)}
            onValueChange={(v) => aendern({ mwstSatz: Number(v), summenAusweisen: Number(v) > 0 })}
          >
            <SelectTrigger className={handy ? 'h-9 w-44' : 'h-8 w-40 text-xs'}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Keine (§ 19 UStG)</SelectItem>
              <SelectItem value="7">7 %</SelectItem>
              <SelectItem value="19">19 %</SelectItem>
            </SelectContent>
          </Select>
        </Feldzeile>
        {b.mwstSatz > 0 && (
          <Feldzeile label="Netto und Steuer zeigen">
            <Switch checked={b.summenAusweisen} onCheckedChange={(v) => aendern({ summenAusweisen: v })} />
          </Feldzeile>
        )}
      </Feldgruppe>

      <Aufklapper titel="Spaltenbreiten und Überschriften">
        <Feldgruppe fuss="Die Regler teilen die Tabellenbreite im Verhältnis auf. Ohne eigene Breiten rechnet die App sie aus dem Inhalt.">
          <Feldzeile label="Eigene Breiten">
            <Switch
              checked={eigeneBreiten}
              onCheckedChange={(v) => aendern({ spaltenBreiten: v ? standardBreiten(b.spalten) : undefined })}
            />
          </Feldzeile>
          <Vollzeile>
            <div className="space-y-2">
              {b.spalten.map((spalte, i) => (
                <div key={spalte} className={cn('flex gap-2', handy ? 'flex-col' : 'items-center')}>
                  <span className={cn('shrink-0 truncate text-muted-foreground', handy ? 'text-[15px]' : 'w-20 text-xs')}>
                    {SPALTEN_LABELS[spalte]}
                  </span>
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <input
                      type="range"
                      min={1} max={100} step={1}
                      disabled={!eigeneBreiten}
                      value={Math.round((Math.max(0, breiten[i]) / summe) * 100)}
                      aria-label={`Breite ${SPALTEN_LABELS[spalte]}`}
                      onChange={(e) => {
                        const kopie = [...breiten];
                        kopie[i] = Number(e.target.value) / 100;
                        aendern({ spaltenBreiten: kopie });
                      }}
                      className={cn('h-1 min-w-0 flex-1 accent-primary', eigeneBreiten ? 'cursor-pointer' : 'opacity-40')}
                    />
                    <span className={cn('w-10 shrink-0 text-right tabular-nums text-muted-foreground', handy ? 'text-[13px]' : 'text-[11px]')}>
                      {Math.round((Math.max(0, breiten[i]) / summe) * 100)} %
                    </span>
                    <Kurzfeld
                      wert={b.spaltenLabels?.[spalte] ?? ''}
                      platzhalter={SPALTEN_LABELS[spalte]}
                      klasse={handy ? 'w-28' : 'w-24'}
                      setzen={(v) => aendern({ spaltenLabels: { ...b.spaltenLabels, [spalte]: v || undefined } })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Vollzeile>
          <Zahlzeile
            label="Zeilenhöhe" hinweis="Vielfaches der Zeilenhöhe der Schrift"
            wert={b.zeilenFaktor} setzen={(v) => aendern({ zeilenFaktor: v })}
            einheit="×" geerbt={1.45} min={0.8} max={4} schritt={0.05}
          />
        </Feldgruppe>
      </Aufklapper>

      <Aufklapper titel="Farben der Tabelle">
        <Feldgruppe>
          <Farbzeile wahlfrei label="Tabellenkopf" wert={b.kopfFarbe} geerbt={g.akzent} setzen={(v) => aendern({ kopfFarbe: v || undefined })} />
          <Farbzeile wahlfrei label="Schrift im Kopf" wert={b.kopfTextFarbe} geerbt="#ffffff" setzen={(v) => aendern({ kopfTextFarbe: v || undefined })} />
          <Farbzeile wahlfrei label="Zebrastreifen" wert={b.zebraFarbe} geerbt="#f8fafc" setzen={(v) => aendern({ zebraFarbe: v || undefined })} />
          <Farbzeile wahlfrei label="Trennlinien" wert={b.linienFarbe} geerbt="#e2e8f0" setzen={(v) => aendern({ linienFarbe: v || undefined })} />
        </Feldgruppe>
      </Aufklapper>

      <Aufklapper titel="Summenblock">
        <Feldgruppe>
          <Zahlzeile
            label="Breite" wert={b.summenBreite} setzen={(v) => aendern({ summenBreite: v })}
            einheit="mm" geerbt={72} min={30} max={160} schritt={1}
          />
          <Feldzeile label="Steht links">
            <Switch checked={b.summenLinks ?? false} onCheckedChange={(v) => aendern({ summenLinks: v || undefined })} />
          </Feldzeile>
          <Vollzeile>
            <Feldtitel>Beschriftung der Endsumme</Feldtitel>
            <Textfeld
              wert={b.summeLabel ?? ''}
              setzen={(v) => aendern({ summeLabel: v || undefined })}
              platzhalter={b.mwstSatz > 0 ? 'Gesamtbetrag' : 'Rechnungsbetrag'}
            />
          </Vollzeile>
        </Feldgruppe>
      </Aufklapper>
    </>
  );
}

function ZahlungFelder({ b, aendern }: { b: ZahlungBaustein; aendern: (p: Partial<ZahlungBaustein>) => void }) {
  return (
    <>
      <Feldgruppe titel="Zahlung" fuss="Den QR-Code lesen Banking-Apps ein und füllen die Überweisung damit aus.">
        <Feldzeile label="Bankverbindung">
          <Switch checked={b.bankverbindung} onCheckedChange={(v) => aendern({ bankverbindung: v })} />
        </Feldzeile>
        <Feldzeile label="QR-Code">
          <Switch checked={b.qrCode} onCheckedChange={(v) => aendern({ qrCode: v })} />
        </Feldzeile>
      </Feldgruppe>

      <Aufklapper titel="Mehr" hinweis="Größe und Seite des QR-Codes, Einleitung">
        <Feldgruppe fuss="Der Vorspann steht als erste Zeile über der Bankverbindung.">
          <Zahlzeile
            label="Größe des QR-Codes" wert={b.qrGroesse} setzen={(v) => aendern({ qrGroesse: v })}
            einheit="mm" geerbt={24} min={12} max={60} schritt={1}
          />
          <Feldzeile label="QR-Code links">
            <Switch checked={b.qrLinks ?? false} onCheckedChange={(v) => aendern({ qrLinks: v || undefined })} />
          </Feldzeile>
          <Vollzeile>
            <Feldtitel>Vorspann</Feldtitel>
            <Textfeld
              wert={b.vorspann ?? ''}
              setzen={(v) => aendern({ vorspann: v || undefined })}
              platzhalter="Bitte überweisen Sie auf folgendes Konto:"
            />
          </Vollzeile>
        </Feldgruppe>
      </Aufklapper>
    </>
  );
}

function FusszeileFelder({ b, aendern }: { b: FusszeileBaustein; aendern: (p: Partial<FusszeileBaustein>) => void }) {
  const handy = useHandy();
  const eigeneAuswahl = b.felder !== undefined;
  return (
    <>
      <Feldgruppe titel="Fußzeile" fuss="Die Fußzeile steht am unteren Rand und hält sich Platz frei – der Text darüber bricht rechtzeitig um.">
        <Feldzeile label="Spalten">
          <Segmented
            value={String(b.spalten)}
            onChange={(v) => aendern({ spalten: Number(v) as 2 | 3 | 4 })}
            options={[{ value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }]}
            className={handy ? 'w-36' : 'w-28'}
          />
        </Feldzeile>
        <Feldzeile label="Trennlinie">
          <Switch checked={b.trennlinie} onCheckedChange={(v) => aendern({ trennlinie: v })} />
        </Feldzeile>
      </Feldgruppe>

      <Aufklapper titel="Angaben und Seitenzahl">
        <Feldgruppe fuss="Ohne eigene Auswahl erscheint alles, was in den Einstellungen ausgefüllt ist.">
          <Feldzeile label="Angaben selbst wählen">
            <Switch
              checked={eigeneAuswahl}
              onCheckedChange={(v) => aendern({ felder: v ? [...FUSS_ORDER] : undefined })}
            />
          </Feldzeile>
          {eigeneAuswahl && (
            <Vollzeile>
              <div className="flex flex-wrap gap-1.5">
                {FUSS_ORDER.map((feld) => {
                  const an = (b.felder ?? []).includes(feld);
                  return (
                    <Marke
                      key={feld}
                      label={FUSS_LABELS[feld]}
                      an={an}
                      umschalten={() =>
                        aendern({ felder: FUSS_ORDER.filter((f) => (f === feld ? !an : (b.felder ?? []).includes(f))) })
                      }
                    />
                  );
                })}
              </div>
            </Vollzeile>
          )}
          <Feldzeile label="Seitenzahl" hinweis="Erscheint erst ab der zweiten Seite">
            <Switch checked={b.seitenzahl ?? true} onCheckedChange={(v) => aendern({ seitenzahl: v })} />
          </Feldzeile>
          <Feldzeile label="Nur auf der letzten Seite">
            <Switch checked={b.nurLetzteSeite ?? false} onCheckedChange={(v) => aendern({ nurLetzteSeite: v || undefined })} />
          </Feldzeile>
        </Feldgruppe>
      </Aufklapper>
    </>
  );
}

function LinieFelder({ b, aendern, g }: { b: LinieBaustein; aendern: (p: Partial<LinieBaustein>) => void; g: Gestaltung }) {
  return (
    <Feldgruppe titel="Linie" fuss={'Wo die Linie anschlägt, sagt die Ausrichtung in der Feineinstellung.'}>
      <Reglerzeile label="Stärke" wert={b.dicke} min={0.1} max={4} schritt={0.1} einheit="mm" setzen={(v) => aendern({ dicke: v })} />
      <Reglerzeile
        label="Breite"
        wert={Math.round((b.breite ?? 1) * 100)}
        min={5} max={100} einheit="%"
        setzen={(v) => aendern({ breite: v / 100 })}
      />
      <Farbzeile wahlfrei label="Farbe" wert={b.farbe} geerbt={g.gedaempft} setzen={(v) => aendern({ farbe: v })} />
    </Feldgruppe>
  );
}

function BildFelder({ b, aendern }: { b: BildBaustein; aendern: (p: Partial<BildBaustein>) => void }) {
  const handy = useHandy();
  const feld = useRef<HTMLInputElement>(null);

  const laden = (datei: File | undefined) => {
    if (!datei) return;
    if (datei.size > 2_000_000) {
      toast.error('Das Bild ist größer als 2 MB', {
        description: 'Ein kleineres Bild lädt schneller und druckt genauso gut.',
      });
      return;
    }
    const leser = new FileReader();
    leser.onload = () => aendern({ quelle: String(leser.result) });
    leser.onerror = () => toast.error('Das Bild konnte nicht gelesen werden');
    leser.readAsDataURL(datei);
  };

  return (
    <Feldgruppe titel="Bild" fuss="Ohne eigenes Bild erscheint das Logo der Vorlage – praktisch, um es ein zweites Mal zu setzen.">
      <Vollzeile>
        {b.quelle ? (
          <div className="space-y-2">
            <div className="flex items-center justify-center rounded-lg border border-border bg-white p-3">
              <img src={b.quelle} alt="Bild" className="max-h-24 max-w-full object-contain" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className={cn('flex-1', handy && 'h-11 text-[15px]')} onClick={() => feld.current?.click()}>
                Anderes Bild
              </Button>
              <Button variant="destructive" className={cn('flex-1', handy && 'h-11 text-[15px]')} onClick={() => aendern({ quelle: '' })}>
                Entfernen
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" className={cn('w-full', handy && 'h-12 text-[17px]')} onClick={() => feld.current?.click()}>
            <ImagePlus /> Bild wählen
          </Button>
        )}
        <input
          ref={feld}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          className="hidden"
          onChange={(e) => { laden(e.target.files?.[0]); e.target.value = ''; }}
        />
      </Vollzeile>
      <Reglerzeile label="Höhe" wert={b.hoehe} min={4} max={120} einheit="mm" setzen={(v) => aendern({ hoehe: v })} />
      <Zahlzeile
        label="Feste Breite" hinweis="Leer: aus dem Seitenverhältnis"
        wert={b.breiteMm && b.breiteMm > 0 ? b.breiteMm : undefined}
        setzen={(v) => aendern({ breiteMm: v })}
        einheit="mm" leerText="automatisch" min={4} max={180} schritt={1}
      />
    </Feldgruppe>
  );
}

function ListeFelder({ b, aendern }: { b: ListeBaustein; aendern: (p: Partial<ListeBaustein>) => void }) {
  return (
    <Feldgruppe titel="Freie Liste" fuss="Im Wert sind Platzhalter erlaubt, etwa {{doc_number}} oder {{sender_iban}}.">
      <ZeilenListe zeilen={b.zeilen} setzen={(z) => aendern({ zeilen: z })} />
      <Zahlzeile
        label="Anteil der Beschriftung"
        wert={b.beschriftungsAnteil}
        setzen={(v) => aendern({ beschriftungsAnteil: v === undefined ? undefined : Math.min(0.9, Math.max(0.1, v)) })}
        einheit="%" geerbt={0.4} faktor={100} min={10} max={90} schritt={5}
      />
      <Feldzeile label="Trennlinien">
        <Switch checked={b.trennlinien ?? false} onCheckedChange={(v) => aendern({ trennlinien: v || undefined })} />
      </Feldzeile>
    </Feldgruppe>
  );
}

function UnterschriftFelder({ b, aendern }: { b: UnterschriftBaustein; aendern: (p: Partial<UnterschriftBaustein>) => void }) {
  return (
    <Feldgruppe titel="Unterschrift" fuss={'Der Freiraum ist der Platz über der Linie – dort wird unterschrieben.'}>
      <Vollzeile>
        <Feldtitel>Beschriftung</Feldtitel>
        <Textfeld wert={b.beschriftung} setzen={(v) => aendern({ beschriftung: v })} platzhalter="Ort, Datum, Unterschrift" />
      </Vollzeile>
      <Reglerzeile label="Breite der Linie" wert={b.linienBreite} min={20} max={160} einheit="mm" setzen={(v) => aendern({ linienBreite: v })} />
      <Reglerzeile label="Freiraum darüber" wert={b.freiraum} min={0} max={50} einheit="mm" setzen={(v) => aendern({ freiraum: v })} />
    </Feldgruppe>
  );
}

function SpaltenFelder({ b, aendern }: { b: SpaltenBaustein; aendern: (p: Partial<SpaltenBaustein>) => void }) {
  return (
    <Feldgruppe
      titel="Spalten"
      fuss="Die Spalten selbst – Breite, Inhalt, hinzufügen und entfernen – stehen unten in der Bausteinliste."
    >
      <Reglerzeile
        label="Zwischenraum" wert={b.zwischenraum} min={0} max={30} einheit="mm"
        setzen={(v) => aendern({ zwischenraum: v })}
      />
      <Wahlzeile
        label="Ausrichtung"
        hinweis="Wenn die Spalten verschieden hoch sind"
        wert={b.ausrichtungSenkrecht ?? 'oben'}
        setzen={(v) => aendern({ ausrichtungSenkrecht: v as 'oben' | 'mitte' | 'unten' })}
        breite="w-44"
        optionen={[
          { value: 'oben', label: 'Oben' },
          { value: 'mitte', label: 'Mitte' },
          { value: 'unten', label: 'Unten' },
        ]}
      />
    </Feldgruppe>
  );
}

// ─── Der Rahmen um alles ─────────────────────────────────────────────────────

export function BausteinEinstellungen({
  baustein, aendern, g, entfernen,
}: {
  baustein: Baustein;
  aendern: (patch: Partial<Baustein>) => void;
  g: Gestaltung;
  entfernen?: () => void;
}) {
  const handy = useHandy();

  /** Setzt einzelne Felder des Stils, ohne die anderen zu verlieren. */
  const stilSetzen = (patch: Partial<BausteinStil>) => aendern({ stil: { ...baustein.stil, ...patch } });

  // Der Seitenumbruch zeichnet nichts – Stil, Fläche und Abstände liefen dort
  // ins Leere, also gibt es sie hier gar nicht erst.
  const zeichnet = baustein.typ !== 'seitenumbruch';

  return (
    <div className={cn(handy ? 'space-y-6' : 'space-y-3')}>
      {baustein.typ === 'kopf' && <KopfFelder b={baustein} aendern={aendern} g={g} />}
      {baustein.typ === 'anschrift' && <AnschriftFelder b={baustein} aendern={aendern} />}
      {baustein.typ === 'eckdaten' && <EckdatenFelder b={baustein} aendern={aendern} />}
      {baustein.typ === 'betreff' && <BetreffFelder b={baustein} aendern={aendern} />}
      {baustein.typ === 'text' && <TextFelder b={baustein} aendern={aendern} />}
      {baustein.typ === 'positionen' && <PositionenFelder b={baustein} aendern={aendern} g={g} />}
      {baustein.typ === 'zahlung' && <ZahlungFelder b={baustein} aendern={aendern} />}
      {baustein.typ === 'fusszeile' && <FusszeileFelder b={baustein} aendern={aendern} />}
      {baustein.typ === 'linie' && <LinieFelder b={baustein} aendern={aendern} g={g} />}
      {baustein.typ === 'bild' && <BildFelder b={baustein} aendern={aendern} />}
      {baustein.typ === 'liste' && <ListeFelder b={baustein} aendern={aendern} />}
      {baustein.typ === 'unterschrift' && <UnterschriftFelder b={baustein} aendern={aendern} />}
      {baustein.typ === 'spalten' && <SpaltenFelder b={baustein} aendern={aendern} />}

      {baustein.typ === 'abstand' && (
        <Feldgruppe titel="Abstand">
          <Reglerzeile label="Höhe" wert={baustein.hoehe} min={2} max={120} einheit="mm" setzen={(v) => aendern({ hoehe: v })} />
        </Feldgruppe>
      )}

      {baustein.typ === 'seitenumbruch' && (
        <Feldgruppe titel="Seitenumbruch" fuss="Hier gibt es nichts einzustellen: Was danach kommt, beginnt auf einer neuen Seite.">
          <Vollzeile>
            <span className={cn('block text-muted-foreground', handy ? 'text-[15px]' : 'text-xs')}>
              Ein Seitenumbruch am Anfang des Dokuments wird übersprungen – sonst bliebe die erste Seite leer.
            </span>
          </Vollzeile>
        </Feldgruppe>
      )}

      {zeichnet && (
        <Feldgruppe titel="Platz">
          <Reglerzeile
            label="Abstand darüber"
            wert={baustein.stil?.abstandOben ?? baustein.abstandOben ?? 0}
            min={0} max={60} einheit="mm"
            // Der Abstand stand früher direkt am Baustein. Neu gesetzt wird er
            // über den Stil, und das alte Feld wird dabei abgeräumt – sonst
            // stünden zwei Werte für dieselbe Sache in der Vorlage.
            setzen={(v) => aendern({ stil: { ...baustein.stil, abstandOben: v }, abstandOben: undefined })}
          />
          <Zahlzeile
            label="Abstand darunter"
            wert={baustein.stil?.abstandUnten}
            setzen={(v) => stilSetzen({ abstandUnten: v })}
            einheit="mm" geerbt={g.bausteinAbstand} min={0} max={80} schritt={0.5}
          />
        </Feldgruppe>
      )}

      {zeichnet && (
        <Aufklapper
          titel="Feineinstellung"
          hinweis="Schrift, Farbe, Ausrichtung, Fläche, Rahmen, Breite"
        >
          <Feineinstellung
            stil={baustein.stil}
            setzen={stilSetzen}
            g={g}
            fuss={
              baustein.typ === 'fusszeile'
                ? 'In der Fußzeile wirken Schriftgröße, Farbe und Ausrichtung; Fläche und Breite nicht – sie läuft immer über das ganze Blatt.'
                : undefined
            }
          />
        </Aufklapper>
      )}

      {entfernen && (
        <Button variant="destructive" className={handy ? 'h-[50px] w-full text-[17px]' : 'w-full'} onClick={entfernen}>
          <Trash2 /> Baustein entfernen
        </Button>
      )}
    </div>
  );
}

export { ECKDATEN_ORDER, SPALTEN_ORDER };
