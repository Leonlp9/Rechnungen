// ─── Der Vorlagen-Baukasten ──────────────────────────────────────────────────
//
// Vorher stand hier ein Pixel-Editor: jedes Element mit eigenem x, y, Breite und
// Höhe auf einer A4-Fläche, dazu drei Spalten nebeneinander. Wer eine Zeile
// einfügte, musste alles darunter von Hand nachschieben, und bei 800 Pixeln
// Fensterbreite blieben für das Blatt noch neunzig übrig. Auf dem Handy gab es
// die Seite gar nicht erst. Ergebnis: in Monaten keine einzige eigene Vorlage.
//
// Deshalb hier das Gegenteil. Eine Vorlage ist eine Reihenfolge von Bausteinen –
// Kopfzeile, Anschriftfeld, Positionen, Fußzeile –, die man sortiert, ein- und
// ausschaltet. Wo etwas landet, rechnet `layoutRechnung` aus. Das Aussehen wird
// an einer einzigen Stelle eingestellt und gilt für das ganze Dokument. Damit
// kann man nichts krumm hinstellen, und es sieht von sich aus ordentlich aus.
//
// Die Vorschau ist die Hauptsache und bekommt den meisten Platz: Sie zeigt die
// eigenen Absenderdaten aus den Einstellungen, damit man die eigene Rechnung
// sieht und nicht ein Muster.

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronDown, ChevronsUpDown, Copy, FilePlus2, GripVertical, ImagePlus, Minus,
  Pencil, Plus, RotateCcw, Trash2, ZoomIn,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Segmented } from '@/components/ui/segmented';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ListGroup, ListRow } from '@/components/ui/list-group';
import { FormGroup, FormRow, FormFullRow } from '@/components/ui/form-list';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/layout/PageHeader';
import { Blattvorschau } from '@/components/rechnung/Blattvorschau';

import { useIsMobile } from '@/hooks/useIsMobile';
import { useAppStore } from '@/store';
import { useVorlagenStore } from '@/store/vorlagenStore';
import { layoutRechnung } from '@/lib/rechnung/layout';
import { kopiere, leereVorlage, neuerBaustein } from '@/lib/rechnung/vorlagen';
import { getSetting } from '@/lib/db';
import { cn } from '@/lib/utils';

import type {
  Baustein, BausteinTyp, EckdatenFeld, PositionsSpalte, Rechnungsvorlage,
} from '@/types/rechnungsvorlage';
import {
  A4_BREITE, A4_HOEHE, BAUSTEIN_BESCHREIBUNG, BAUSTEIN_LABELS,
  ECKDATEN_LABELS, NUR_EINMAL, SPALTEN_LABELS,
} from '@/types/rechnungsvorlage';
import type { LineItem } from '@/types/template';

// ─── Feste Größen ────────────────────────────────────────────────────────────

/** Pixel je Millimeter bei 96 dpi – der Maßstab, den „100 %" meint. */
const PIXEL_JE_MM = 3.78;

const AKZENT_VORSCHLAEGE = [
  '#1d4ed8', '#0f766e', '#334155', '#b91c1c', '#c2410c',
  '#7c3aed', '#be185d', '#15803d', '#0e7490', '#a16207',
];

const SCHRIFTEN = [
  { wert: 'Helvetica, Arial, sans-serif', label: 'Serifenlos' },
  { wert: 'Georgia, "Times New Roman", serif', label: 'Serif' },
  { wert: '"Courier New", Courier, monospace', label: 'Schreibmaschine' },
];

/** Reihenfolge, in der Eckdaten erscheinen – unabhängig davon, wann man sie anhakt. */
const ECKDATEN_ORDER: EckdatenFeld[] = [
  'doc_number', 'doc_date', 'delivery_date', 'due_date', 'customer_number',
];

const SPALTEN_ORDER: PositionsSpalte[] = [
  'pos', 'beschreibung', 'menge', 'einheit', 'einzelpreis', 'rabatt', 'betrag',
];

/** Ohne Beschreibung und Betrag ist die Tabelle keine Rechnung mehr. */
const PFLICHTSPALTEN: PositionsSpalte[] = ['beschreibung', 'betrag'];

const ALLE_TYPEN: BausteinTyp[] = [
  'kopf', 'anschrift', 'eckdaten', 'betreff', 'text', 'positionen', 'zahlung', 'fusszeile', 'abstand',
];

/** Die drei Beispielleistungen der Vorschau – eine kurz, eine lang, eine pauschal. */
const BEISPIEL_POSITIONEN: LineItem[] = [
  { id: 'beispiel-1', description: 'Konzeption und Beratung', quantity: 4, unit: 'Std.', unitPrice: 95 },
  {
    id: 'beispiel-2',
    description: 'Umsetzung der Startseite inklusive Bildauswahl und einer Korrekturschleife',
    quantity: 12, unit: 'Std.', unitPrice: 85,
  },
  { id: 'beispiel-3', description: 'Einrichtung und Übergabe', quantity: 1, unit: 'Pausch.', unitPrice: 240 },
];

const PROFIL_SCHLUESSEL = [
  'profile_name', 'profile_address', 'profile_street', 'profile_zip', 'profile_city',
  'profile_email', 'profile_phone', 'profile_tax_number', 'profile_w_idnr', 'profile_vat_id',
  'profile_finanzamt', 'profile_iban', 'profile_bic',
];

// ─── Kleine Bausteine der Oberfläche ─────────────────────────────────────────
//
// Einstellungen sehen am Desktop und am Handy verschieden aus, sagen aber
// dasselbe. Statt jede Einstellung zweimal zu schreiben, entscheidet der
// Kontext, in welcher Hülle eine Zeile erscheint: am Handy die Gruppenliste,
// am Desktop eine kompakte Reihe.

const HandyKontext = createContext(false);
const useHandy = () => useContext(HandyKontext);

function Feldgruppe({ titel, fuss, children }: { titel?: string; fuss?: string; children: React.ReactNode }) {
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

function Feldzeile({ label, hinweis, children }: { label: string; hinweis?: string; children: React.ReactNode }) {
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

function Vollzeile({ children }: { children: React.ReactNode }) {
  const handy = useHandy();
  if (handy) return <FormFullRow>{children}</FormFullRow>;
  return <div className="px-2.5 py-2">{children}</div>;
}

/**
 * Regler mit Wertanzeige. Am Handy bekommt er eine eigene Zeile: Neben einer
 * Beschriftung wie „Zwischen Bausteinen" bliebe von der Spur nichts übrig, das
 * man noch treffen könnte.
 */
function Reglerzeile({
  label, hinweis, wert, min, max, schritt = 1, einheit, setzen,
}: {
  label: string;
  hinweis?: string;
  wert: number; min: number; max: number; schritt?: number; einheit: string;
  setzen: (v: number) => void;
}) {
  const handy = useHandy();
  const anzeige = `${Number.isInteger(wert) ? wert : wert.toFixed(1).replace('.', ',')} ${einheit}`;
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
        <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{anzeige}</span>
      </div>
    </Feldzeile>
  );
}

/** Textfeld über die volle Breite – für Betreff und Absätze. */
function Textfeld({
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

/**
 * An- und abwählbare Marke – für Eckdatenfelder und Tabellenspalten.
 *
 * Eine gesperrte Marke bleibt sichtbar angehakt. Sie blass zu zeichnen hieße,
 * „Beschreibung" und „Betrag" wie abgewählte Spalten aussehen zu lassen,
 * obwohl sie auf jeder Rechnung gedruckt werden.
 */
function Marke({
  label, an, gesperrt, umschalten,
}: { label: string; an: boolean; gesperrt?: boolean; umschalten: () => void }) {
  const handy = useHandy();
  return (
    <button
      type="button"
      disabled={gesperrt}
      onClick={umschalten}
      title={gesperrt ? 'Gehört auf jede Rechnung und bleibt an.' : undefined}
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

// ─── Einstellungen eines Bausteins ───────────────────────────────────────────

function BausteinEinstellungen({
  baustein, aendern, entfernen,
}: {
  baustein: Baustein;
  aendern: (patch: Partial<Baustein>) => void;
  entfernen?: () => void;
}) {
  const handy = useHandy();

  const abstand = (
    <Feldgruppe titel="Platz">
      <Reglerzeile
        label="Abstand darüber"
        wert={baustein.abstandOben ?? 0}
        min={0} max={40} einheit="mm"
        setzen={(v) => aendern({ abstandOben: v })}
      />
    </Feldgruppe>
  );

  return (
    <div className={cn(handy ? 'space-y-6' : 'space-y-3')}>
      {baustein.typ === 'kopf' && (
        <Feldgruppe titel="Kopfzeile" fuss={'Das Logo lädst du unter „Aussehen" hoch – es gilt für die ganze Vorlage.'}>
          <Vollzeile>
            <span className={cn('mb-1 block text-muted-foreground', handy ? 'text-[13px]' : 'text-[11px]')}>Titel</span>
            <Textfeld
              wert={baustein.titel}
              setzen={(v) => aendern({ titel: v })}
              platzhalter="Rechnung"
            />
          </Vollzeile>
          <Feldzeile label="Logo steht">
            <Segmented
              value={baustein.logoSeite}
              onChange={(v) => aendern({ logoSeite: v })}
              options={[{ value: 'links', label: 'Links' }, { value: 'rechts', label: 'Rechts' }]}
              className={handy ? 'w-44' : 'w-32'}
            />
          </Feldzeile>
          <Reglerzeile
            label="Logohöhe" wert={baustein.logoHoehe} min={6} max={40} einheit="mm"
            setzen={(v) => aendern({ logoHoehe: v })}
          />
          <Feldzeile label="Balken darunter">
            <Switch checked={baustein.trennlinie} onCheckedChange={(v) => aendern({ trennlinie: v })} />
          </Feldzeile>
        </Feldgruppe>
      )}

      {baustein.typ === 'anschrift' && (
        <Feldgruppe titel="Anschriftfeld" fuss="Die kleine Zeile über der Anschrift zeigt deinen Absender – im Fensterumschlag steht sie über dem Sichtfenster.">
          <Feldzeile label="Absenderzeile">
            <Switch checked={baustein.absenderzeile} onCheckedChange={(v) => aendern({ absenderzeile: v })} />
          </Feldzeile>
        </Feldgruppe>
      )}

      {baustein.typ === 'eckdaten' && (
        <Feldgruppe titel="Eckdaten" fuss="Als Block stehen die Angaben rechts neben der Anschrift, als Zeile darunter.">
          <Feldzeile label="Form">
            <Segmented
              value={baustein.form}
              onChange={(v) => aendern({ form: v })}
              options={[{ value: 'block', label: 'Block' }, { value: 'zeile', label: 'Zeile' }]}
              className={handy ? 'w-44' : 'w-32'}
            />
          </Feldzeile>
          <Vollzeile>
            <span className={cn('mb-2 block text-muted-foreground', handy ? 'text-[13px]' : 'text-[11px]')}>Angaben</span>
            <div className="flex flex-wrap gap-1.5">
              {ECKDATEN_ORDER.map((feld) => {
                const an = baustein.felder.includes(feld);
                return (
                  <Marke
                    key={feld}
                    label={ECKDATEN_LABELS[feld]}
                    an={an}
                    umschalten={() =>
                      aendern({
                        felder: ECKDATEN_ORDER.filter((f) => (f === feld ? !an : baustein.felder.includes(f))),
                      })
                    }
                  />
                );
              })}
            </div>
          </Vollzeile>
        </Feldgruppe>
      )}

      {baustein.typ === 'betreff' && (
        <Feldgruppe titel="Betreff" fuss="In geschweiften Klammern stehen Platzhalter, etwa {{doc_number}} für die Rechnungsnummer.">
          <Vollzeile>
            <Textfeld
              wert={baustein.inhalt}
              setzen={(v) => aendern({ inhalt: v })}
              platzhalter="Rechnung {{doc_number}}"
            />
          </Vollzeile>
        </Feldgruppe>
      )}

      {baustein.typ === 'text' && (
        <Feldgruppe
          titel="Text"
          fuss={
            baustein.quelle === 'feld'
              ? 'Der Absatz zeigt, was beim Schreiben der Rechnung in diesem Feld steht.'
              : 'Fester Text erscheint auf jeder Rechnung gleich.'
          }
        >
          <Feldzeile label="Quelle">
            <Segmented
              value={baustein.quelle}
              onChange={(v) => aendern({ quelle: v, inhalt: v === 'feld' ? 'notes' : '' })}
              options={[{ value: 'fest', label: 'Fester Text' }, { value: 'feld', label: 'Feld' }]}
              className={handy ? 'w-52' : 'w-40'}
            />
          </Feldzeile>
          {baustein.quelle === 'feld' ? (
            <Feldzeile label="Feld">
              <Select value={baustein.inhalt} onValueChange={(v) => aendern({ inhalt: v })}>
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
                wert={baustein.inhalt}
                setzen={(v) => aendern({ inhalt: v })}
                platzhalter="Vielen Dank für Ihren Auftrag."
                mehrzeilig
              />
            </Vollzeile>
          )}
          <Feldzeile label="Größe">
            <Segmented
              value={baustein.groesse}
              onChange={(v) => aendern({ groesse: v })}
              options={[{ value: 'normal', label: 'Normal' }, { value: 'klein', label: 'Klein' }]}
              className={handy ? 'w-44' : 'w-32'}
            />
          </Feldzeile>
          <Feldzeile label="Fett">
            <Switch checked={baustein.betont} onCheckedChange={(v) => aendern({ betont: v })} />
          </Feldzeile>
        </Feldgruppe>
      )}

      {baustein.typ === 'positionen' && (
        <Feldgruppe titel="Positionen" fuss="Beschreibung und Betrag gehören auf jede Rechnung und lassen sich deshalb nicht abwählen.">
          <Vollzeile>
            <span className={cn('mb-2 block text-muted-foreground', handy ? 'text-[13px]' : 'text-[11px]')}>Spalten</span>
            <div className="flex flex-wrap gap-1.5">
              {SPALTEN_ORDER.map((spalte) => {
                const an = baustein.spalten.includes(spalte);
                const gesperrt = PFLICHTSPALTEN.includes(spalte);
                return (
                  <Marke
                    key={spalte}
                    label={SPALTEN_LABELS[spalte]}
                    an={an}
                    gesperrt={gesperrt}
                    umschalten={() =>
                      aendern({
                        spalten: SPALTEN_ORDER.filter((s) => (s === spalte ? !an : baustein.spalten.includes(s))),
                      })
                    }
                  />
                );
              })}
            </div>
          </Vollzeile>
          <Feldzeile label="Stil">
            <Segmented
              value={baustein.stil}
              onChange={(v) => aendern({ stil: v })}
              options={[
                { value: 'linien', label: 'Balken' },
                { value: 'zebra', label: 'Zebra' },
                { value: 'schlicht', label: 'Schlicht' },
              ]}
              className={handy ? 'w-60' : 'w-52'}
            />
          </Feldzeile>
          <Feldzeile label="Umsatzsteuer">
            <Select
              value={String(baustein.mwstSatz)}
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
          {baustein.mwstSatz > 0 && (
            <Feldzeile label="Netto und Steuer zeigen">
              <Switch checked={baustein.summenAusweisen} onCheckedChange={(v) => aendern({ summenAusweisen: v })} />
            </Feldzeile>
          )}
        </Feldgruppe>
      )}

      {baustein.typ === 'zahlung' && (
        <Feldgruppe titel="Zahlung" fuss="Den QR-Code lesen Banking-Apps ein und füllen die Überweisung damit aus.">
          <Feldzeile label="Bankverbindung">
            <Switch checked={baustein.bankverbindung} onCheckedChange={(v) => aendern({ bankverbindung: v })} />
          </Feldzeile>
          <Feldzeile label="QR-Code">
            <Switch checked={baustein.qrCode} onCheckedChange={(v) => aendern({ qrCode: v })} />
          </Feldzeile>
        </Feldgruppe>
      )}

      {baustein.typ === 'fusszeile' && (
        <Feldgruppe titel="Fußzeile" fuss="Die Fußzeile steht auf jeder Seite am unteren Rand.">
          <Feldzeile label="Spalten">
            <Segmented
              value={String(baustein.spalten)}
              onChange={(v) => aendern({ spalten: Number(v) as 2 | 3 | 4 })}
              options={[{ value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }]}
              className={handy ? 'w-36' : 'w-28'}
            />
          </Feldzeile>
          <Feldzeile label="Trennlinie">
            <Switch checked={baustein.trennlinie} onCheckedChange={(v) => aendern({ trennlinie: v })} />
          </Feldzeile>
        </Feldgruppe>
      )}

      {baustein.typ === 'abstand' && (
        <Feldgruppe titel="Abstand">
          <Reglerzeile
            label="Höhe" wert={baustein.hoehe} min={2} max={80} einheit="mm"
            setzen={(v) => aendern({ hoehe: v })}
          />
        </Feldgruppe>
      )}

      {baustein.typ !== 'abstand' && abstand}

      {entfernen && (
        <Button variant="destructive" className={handy ? 'h-[50px] w-full text-[17px]' : 'w-full'} onClick={entfernen}>
          <Trash2 /> Baustein entfernen
        </Button>
      )}
    </div>
  );
}

// ─── Eine Zeile der Bausteinliste ────────────────────────────────────────────

function BausteinZeile({
  baustein, aktiv, waehlen, schalten, loeschen, kinder,
}: {
  baustein: Baustein;
  aktiv: boolean;
  waehlen: () => void;
  schalten: (an: boolean) => void;
  loeschen: () => void;
  /** Die aufgeklappten Einstellungen – am Desktop stehen sie unter der Zeile. */
  kinder?: React.ReactNode;
}) {
  const handy = useHandy();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: baustein.id });

  const stil: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
  };

  const aus = baustein.aus === true;
  const label = BAUSTEIN_LABELS[baustein.typ];
  const beschreibung = BAUSTEIN_BESCHREIBUNG[baustein.typ];

  if (handy) {
    return (
      <div ref={setNodeRef} style={stil} data-list-row className="flex w-full items-stretch bg-card">
        <span
          {...attributes}
          {...listeners}
          className="flex shrink-0 touch-none cursor-grab items-center pl-3 pr-1 text-muted-foreground/50 active:cursor-grabbing"
          aria-label="Baustein verschieben"
        >
          <GripVertical className="h-5 w-5" />
        </span>
        <span
          data-row-body
          className="ml-2 flex min-h-[56px] min-w-0 flex-1 items-center gap-3 border-b border-border py-2 pr-4"
        >
          <button type="button" onClick={waehlen} className="min-w-0 flex-1 text-left">
            <span className={cn('block truncate text-[17px] leading-tight', aus && 'text-muted-foreground line-through')}>
              {label}
            </span>
            <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{beschreibung}</span>
          </button>
          <Switch checked={!aus} onCheckedChange={(an) => schalten(an)} aria-label="Baustein anzeigen" />
        </span>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={stil}
      className={cn(
        'overflow-hidden rounded-lg border bg-card transition-colors',
        aktiv ? 'border-primary/50 ring-1 ring-primary/30' : 'border-border',
      )}
    >
      <div className="flex items-center gap-1.5 px-1.5 py-1.5">
        <span
          {...attributes}
          {...listeners}
          className="flex cursor-grab items-center px-0.5 text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
          aria-label="Baustein verschieben"
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <button type="button" onClick={waehlen} className="min-w-0 flex-1 py-0.5 text-left">
          <span className={cn('block truncate text-sm font-medium', aus && 'text-muted-foreground line-through')}>
            {label}
          </span>
          <span className="block truncate text-[11px] leading-snug text-muted-foreground">{beschreibung}</span>
        </button>
        <ChevronDown
          className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform', aktiv && 'rotate-180')}
        />
        <Switch checked={!aus} onCheckedChange={(an) => schalten(an)} aria-label="Baustein anzeigen" />
        <Button variant="ghost" size="icon-sm" onClick={loeschen} title="Baustein löschen">
          <Trash2 className="text-muted-foreground" />
        </Button>
      </div>
      {aktiv && kinder && <div className="border-t border-border bg-muted/30 px-2.5 py-2.5">{kinder}</div>}
    </div>
  );
}

// ─── Die Seite ───────────────────────────────────────────────────────────────

type Reiter = 'aufbau' | 'aussehen' | 'vorschau';

export default function InvoiceDesigner() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const steuerregelung = useAppStore((s) => s.steuerregelung);

  const {
    vorlagen, offeneVorlage, setOffeneVorlage,
    hinzufuegen, aendern, loeschen, zuruecksetzen,
    gestaltungAendern, bausteinAendern, bausteinHinzufuegen, bausteinLoeschen, bausteinVerschieben,
  } = useVorlagenStore();

  const vorlage = vorlagen.find((v) => v.id === offeneVorlage) ?? vorlagen[0] ?? null;

  const [reiter, setReiter] = useState<Reiter>('aufbau');
  const [gewaehlterBaustein, setGewaehlterBaustein] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number | 'passend'>('passend');

  const [neuOffen, setNeuOffen] = useState(false);
  const [neuName, setNeuName] = useState('');
  const [neuArt, setNeuArt] = useState<'rechnung' | 'gutschrift'>('rechnung');
  const [umbenennenOffen, setUmbenennenOffen] = useState(false);
  const [neuerTitel, setNeuerTitel] = useState('');
  const [loeschenOffen, setLoeschenOffen] = useState(false);
  const [auswahlOffen, setAuswahlOffen] = useState(false);
  const [vorlagenlisteOffen, setVorlagenlisteOffen] = useState(false);

  const logoFeld = useRef<HTMLInputElement>(null);
  const blattbereich = useRef<HTMLDivElement>(null);
  const rahmen = useRef<HTMLDivElement>(null);
  const [bereich, setBereich] = useState({ breite: 0, hoehe: 0 });
  const [rahmenBreite, setRahmenBreite] = useState(0);

  // Zwei Spalten lohnen sich erst ab einer gewissen Breite. Genau daran ist der
  // alte Designer gescheitert: In einem schmalen Fenster blieben für das Blatt
  // neunzig Pixel übrig. Wird es eng, steht deshalb immer nur eine Sache da –
  // Aufbau, Aussehen oder Vorschau –, dafür in voller Breite.
  const eng = !isMobile && rahmenBreite > 0 && rahmenBreite < 880;

  // Wird das Fenster wieder breit, gibt es die Ansicht „Vorschau" nicht mehr –
  // sie steht dann ohnehin dauerhaft daneben.
  useEffect(() => {
    if (!isMobile && !eng && reiter === 'vorschau') setReiter('aufbau');
  }, [isMobile, eng, reiter]);

  // ── Absenderdaten aus den Einstellungen ──
  // Die Vorschau zeigt die eigene Rechnung, nicht die eines erfundenen Betriebs.
  const [profil, setProfil] = useState<Record<string, string>>({});
  useEffect(() => {
    let abgebrochen = false;
    Promise.all(PROFIL_SCHLUESSEL.map(async (k) => [k, (await getSetting(k)) ?? ''] as const))
      .then((paare) => {
        if (!abgebrochen) setProfil(Object.fromEntries(paare));
      })
      .catch(() => { /* Ohne Profil zeigt die Vorschau leere Absenderzeilen – kein Grund abzubrechen. */ });
    return () => { abgebrochen = true; };
  }, []);

  // ── Die Größe des Vorschaubereichs ──
  useEffect(() => {
    const knoten = blattbereich.current;
    if (!knoten) return;
    const messen = () => setBereich({ breite: knoten.clientWidth, hoehe: knoten.clientHeight });
    messen();
    const beobachter = new ResizeObserver(messen);
    beobachter.observe(knoten);
    return () => beobachter.disconnect();
  }, [reiter, isMobile, eng]);

  // ── Die Größe der Seite selbst ──
  useEffect(() => {
    const knoten = rahmen.current;
    if (!knoten) return;
    const messen = () => setRahmenBreite(knoten.clientWidth);
    messen();
    const beobachter = new ResizeObserver(messen);
    beobachter.observe(knoten);
    return () => beobachter.disconnect();
  }, [isMobile]);

  const beispielwerte = useMemo(() => {
    const heute = new Date();
    const spaeter = new Date(heute.getTime() + 14 * 86_400_000);
    // Mit führenden Nullen: Auf einer Rechnung steht 27.08.2026, nicht 27.8.2026.
    const datum = (d: Date) =>
      d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const anschrift = [profil.profile_street, [profil.profile_zip, profil.profile_city].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(', ');
    const gutschrift = vorlage?.art === 'gutschrift';

    return {
      sender_name: profil.profile_name || 'Dein Name',
      // Einzeilig: Diese Angabe steht auch in der schmalen Absenderzeile über
      // dem Anschriftfeld, und dort ist für einen Umbruch kein Platz.
      sender_address: anschrift || profil.profile_address || 'Musterstraße 1, 12345 Musterstadt',
      sender_email: profil.profile_email,
      sender_phone: profil.profile_phone,
      sender_tax_number: profil.profile_tax_number,
      sender_w_idnr: profil.profile_w_idnr,
      sender_vat_id: profil.profile_vat_id,
      sender_finanzamt: profil.profile_finanzamt,
      sender_iban: profil.profile_iban || 'DE02 1203 0000 0000 2020 51',
      sender_bic: profil.profile_bic || 'BYLADEM1001',
      receiver_name: 'Muster & Partner GmbH',
      receiver_address: 'Frau Anna Beispiel\nLindenstraße 14\n10115 Berlin',
      customer_number: 'K-1042',
      doc_number: gutschrift ? 'GS-2026-0007' : 'RE-2026-0042',
      doc_date: datum(heute),
      due_date: datum(spaeter),
      delivery_date: datum(heute),
      payment_terms: `Zahlbar ohne Abzug bis zum ${datum(spaeter)}.`,
      legal_notice:
        steuerregelung === 'kleinunternehmer'
          ? 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.'
          : 'Es gilt das Leistungsdatum als Zeitpunkt der Lieferung bzw. Leistung.',
      notes:
        'Sehr geehrte Frau Beispiel,\n\nvielen Dank für Ihren Auftrag. Wie besprochen stelle ich Ihnen die folgenden Leistungen in Rechnung.',
    } as Record<string, string>;
  }, [profil, steuerregelung, vorlage?.art]);

  const layout = useMemo(() => {
    if (!vorlage) return null;
    return layoutRechnung({ vorlage, werte: beispielwerte, positionen: BEISPIEL_POSITIONEN });
  }, [vorlage, beispielwerte]);

  // ── Maßstab der Vorschau ──
  const rand = isMobile ? 24 : 64;
  const passendermassstab = useMemo(() => {
    if (bereich.breite === 0) return PIXEL_JE_MM;
    const nachBreite = (bereich.breite - rand) / A4_BREITE;
    // Am Desktop soll zu Beginn eine ganze Seite zu sehen sein, am Handy zählt
    // die Breite – dort scrollt man ohnehin.
    if (isMobile) return Math.max(0.5, nachBreite);
    const nachHoehe = (bereich.hoehe - rand) / A4_HOEHE;
    return Math.max(0.5, Math.min(nachBreite, nachHoehe));
  }, [bereich, isMobile, rand]);

  const massstab = zoom === 'passend' ? passendermassstab : (zoom / 100) * PIXEL_JE_MM;
  const zoomProzent = Math.round((massstab / PIXEL_JE_MM) * 100);

  const zoomen = (richtung: 1 | -1) => {
    const naechster = Math.min(300, Math.max(30, zoomProzent + richtung * 10));
    setZoom(naechster);
  };

  // ── Änderungen ──
  //
  // Es gibt keinen Speichern-Knopf: Jede Änderung geht sofort in den Speicher.
  // Nur mitgelieferte Vorlagen sind geschützt – die erste Änderung legt still
  // eine eigene Kopie an und arbeitet darin weiter.
  const eigeneVorlage = (): string | null => {
    if (!vorlage) return null;
    if (!vorlage.mitgeliefert) return vorlage.id;

    // Bewusst nicht `kopiere`: Das vergibt neue Kennungen für die Bausteine,
    // und dann zeigte das gerade offene Einstellfeld ins Leere.
    const jetzt = new Date().toISOString();
    const gabelung: Rechnungsvorlage = {
      ...vorlage,
      id: Math.random().toString(36).slice(2, 10),
      name: `${vorlage.name} (Kopie)`,
      mitgeliefert: false,
      gestaltung: { ...vorlage.gestaltung },
      bausteine: vorlage.bausteine.map((b) => ({ ...b })),
      erstelltAm: jetzt,
      geaendertAm: jetzt,
    };
    hinzufuegen(gabelung);
    setOffeneVorlage(gabelung.id);
    toast.info(`„${vorlage.name}" ist mitgeliefert`, {
      description: `Deine Änderungen laufen ab jetzt in „${gabelung.name}" – die Vorlage bleibt unangetastet.`,
    });
    return gabelung.id;
  };

  const mitZiel = (tun: (id: string) => void) => {
    const id = eigeneVorlage();
    if (id) tun(id);
  };

  const sensoren = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortiert = (ereignis: DragEndEvent) => {
    const { active, over } = ereignis;
    if (!vorlage || !over || active.id === over.id) return;
    const von = vorlage.bausteine.findIndex((b) => b.id === active.id);
    const nach = vorlage.bausteine.findIndex((b) => b.id === over.id);
    if (von < 0 || nach < 0) return;
    mitZiel((id) => bausteinVerschieben(id, von, nach));
  };

  const logoLaden = (datei: File | undefined) => {
    if (!datei) return;
    if (datei.size > 2_000_000) {
      toast.error('Das Logo ist größer als 2 MB', { description: 'Ein kleineres Bild lädt schneller und druckt genauso gut.' });
      return;
    }
    const leser = new FileReader();
    leser.onload = () => mitZiel((id) => gestaltungAendern(id, { logo: String(leser.result) }));
    leser.onerror = () => toast.error('Das Bild konnte nicht gelesen werden');
    leser.readAsDataURL(datei);
  };

  const bausteinEinfuegen = (typ: BausteinTyp) => {
    mitZiel((id) => {
      const neuer = neuerBaustein(typ);
      bausteinHinzufuegen(id, neuer);
      setGewaehlterBaustein(neuer.id);
    });
    setAuswahlOffen(false);
  };

  const vorlageAnlegen = () => {
    const name = neuName.trim() || (neuArt === 'rechnung' ? 'Meine Rechnung' : 'Meine Gutschrift');
    const neu = leereVorlage(name, neuArt);
    hinzufuegen(neu);
    setOffeneVorlage(neu.id);
    setGewaehlterBaustein(null);
    setNeuOffen(false);
    setNeuName('');
    toast.success(`„${name}" angelegt`);
  };

  const vorlageKopieren = () => {
    if (!vorlage) return;
    const kopie = kopiere(vorlage, `${vorlage.name} (Kopie)`);
    hinzufuegen(kopie);
    setOffeneVorlage(kopie.id);
    setGewaehlterBaustein(null);
    toast.success(`„${kopie.name}" angelegt`);
  };

  // Eine eigene Vorlage ist Arbeit, und gelöscht ist sie endgültig – dafür
  // reicht ein einzelner Klick auf ein Mülleimer-Symbol nicht.
  const vorlageLoeschen = () => {
    if (!vorlage || vorlage.mitgeliefert) return;
    const name = vorlage.name;
    loeschen(vorlage.id);
    setOffeneVorlage(vorlagen.find((v) => v.id !== vorlage.id)?.id ?? null);
    setGewaehlterBaustein(null);
    setLoeschenOffen(false);
    toast.success(`„${name}" gelöscht`);
  };

  const vorlageZuruecksetzen = () => {
    if (!vorlage) return;
    zuruecksetzen(vorlage.id);
    setGewaehlterBaustein(null);
    toast.success(`„${vorlage.name}" auf den Auslieferungsstand zurückgesetzt`);
  };

  // Eine mitgelieferte Vorlage trägt ihren Namen fest. Statt sie über die
  // automatische Kopie umzubenennen – wobei der Nutzer eine Meldung über
  // „Klar (Kopie)" läse, die einen Wimpernschlag später nicht mehr stimmt –
  // entsteht sie hier gleich unter dem gewünschten Namen als eigene Vorlage.
  const umbenennen = () => {
    const name = neuerTitel.trim();
    if (!vorlage || !name) return;
    if (vorlage.mitgeliefert) {
      const kopie = kopiere(vorlage, name);
      hinzufuegen(kopie);
      setOffeneVorlage(kopie.id);
      setGewaehlterBaustein(null);
      toast.success(`„${name}" angelegt`, {
        description: `„${vorlage.name}" ist mitgeliefert und bleibt unverändert daneben stehen.`,
      });
    } else {
      aendern(vorlage.id, { name });
    }
    setUmbenennenOffen(false);
  };

  // Die Kennung steht in der Adresse, damit „Rechnung schreiben" mit genau
  // dieser Vorlage aufgeht. Merken tut sich der Speicher sie zusätzlich, damit
  // der Baukasten beim Zurückkommen wieder dort steht, wo man ihn verlassen hat.
  const rechnungSchreiben = () => {
    if (!vorlage) return;
    setOffeneVorlage(vorlage.id);
    navigate(`/write-invoice?vorlage=${encodeURIComponent(vorlage.id)}`);
  };

  // ── Bausteine, die es schon gibt ──
  const vorhandeneTypen = new Set(vorlage?.bausteine.map((b) => b.typ) ?? []);
  const offenerBaustein = vorlage?.bausteine.find((b) => b.id === gewaehlterBaustein) ?? null;

  if (!vorlage) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Keine Vorlage vorhanden.
      </div>
    );
  }

  const g = vorlage.gestaltung;

  // Ein Farbfeld ist am Handy schwer zu treffen, wenn es nur so hoch ist wie
  // eine Zeile Text – am Finger gemessen, nicht am Schriftbild.
  const farbfeld = cn(
    'cursor-pointer rounded border border-border bg-transparent',
    isMobile ? 'h-9 w-16' : 'h-7 w-12',
  );

  // ── Aufbau: die Liste der Bausteine ──
  const aufbau = (
    <div className="space-y-4">
      <DndContext sensors={sensoren} collisionDetection={closestCenter} onDragEnd={sortiert}>
        <SortableContext items={vorlage.bausteine.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {isMobile ? (
            <ListGroup footer="Am Griff links ziehst du einen Baustein an eine andere Stelle. Antippen öffnet seine Einstellungen.">
              {vorlage.bausteine.map((b) => (
                <BausteinZeile
                  key={b.id}
                  baustein={b}
                  aktiv={b.id === gewaehlterBaustein}
                  waehlen={() => setGewaehlterBaustein(b.id)}
                  schalten={(an) => mitZiel((id) => bausteinAendern(id, b.id, { aus: !an }))}
                  loeschen={() => mitZiel((id) => bausteinLoeschen(id, b.id))}
                />
              ))}
            </ListGroup>
          ) : (
            <div className="space-y-1.5">
              {vorlage.bausteine.map((b) => (
                <BausteinZeile
                  key={b.id}
                  baustein={b}
                  aktiv={b.id === gewaehlterBaustein}
                  waehlen={() => setGewaehlterBaustein(b.id === gewaehlterBaustein ? null : b.id)}
                  schalten={(an) => mitZiel((id) => bausteinAendern(id, b.id, { aus: !an }))}
                  loeschen={() => {
                    mitZiel((id) => bausteinLoeschen(id, b.id));
                    if (gewaehlterBaustein === b.id) setGewaehlterBaustein(null);
                  }}
                  kinder={
                    <BausteinEinstellungen
                      baustein={b}
                      aendern={(patch) => mitZiel((id) => bausteinAendern(id, b.id, patch))}
                    />
                  }
                />
              ))}
            </div>
          )}
        </SortableContext>
      </DndContext>

      <Button
        variant="outline"
        className={isMobile ? 'h-[50px] w-full text-[17px]' : 'w-full'}
        onClick={() => setAuswahlOffen(true)}
      >
        <Plus /> Baustein hinzufügen
      </Button>
    </div>
  );

  // ── Aussehen: was für das ganze Blatt gilt ──
  const aussehen = (
    <div className={isMobile ? 'space-y-6' : 'space-y-3'}>
      <Feldgruppe titel="Farben">
        <Feldzeile label="Akzent" hinweis="Titel, Tabellenkopf und Linien">
          <input
            type="color"
            value={g.akzent}
            onChange={(e) => mitZiel((id) => gestaltungAendern(id, { akzent: e.target.value }))}
            className={farbfeld}
            aria-label="Akzentfarbe"
          />
        </Feldzeile>
        <Vollzeile>
          <div className="flex flex-wrap gap-1.5">
            {AKZENT_VORSCHLAEGE.map((farbe) => (
              <button
                key={farbe}
                type="button"
                onClick={() => mitZiel((id) => gestaltungAendern(id, { akzent: farbe }))}
                style={{ background: farbe }}
                aria-label={`Akzentfarbe ${farbe}`}
                className={cn(
                  'rounded-full border-2 transition-transform',
                  isMobile ? 'h-8 w-8' : 'h-6 w-6',
                  g.akzent.toLowerCase() === farbe ? 'border-foreground' : 'border-transparent',
                )}
              />
            ))}
          </div>
        </Vollzeile>
        <Feldzeile label="Text">
          <input
            type="color"
            value={g.text}
            onChange={(e) => mitZiel((id) => gestaltungAendern(id, { text: e.target.value }))}
            className={farbfeld}
            aria-label="Textfarbe"
          />
        </Feldzeile>
        <Feldzeile label="Gedämpft" hinweis="Beschriftungen und Fußzeile">
          <input
            type="color"
            value={g.gedaempft}
            onChange={(e) => mitZiel((id) => gestaltungAendern(id, { gedaempft: e.target.value }))}
            className={farbfeld}
            aria-label="Gedämpfte Farbe"
          />
        </Feldzeile>
      </Feldgruppe>

      <Feldgruppe titel="Schrift" fuss="Alle anderen Größen leiten sich hiervon ab – Überschriften größer, Beschriftungen kleiner.">
        <Feldzeile label="Schriftart">
          <Select
            value={g.schriftart}
            onValueChange={(v) => mitZiel((id) => gestaltungAendern(id, { schriftart: v }))}
          >
            <SelectTrigger className={isMobile ? 'h-9 w-44' : 'h-8 w-40 text-xs'}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCHRIFTEN.map((s) => (
                <SelectItem key={s.wert} value={s.wert}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Feldzeile>
        <Reglerzeile
          label="Grundgröße"
          wert={g.schriftgroesse}
          min={8} max={12} schritt={0.5} einheit="pt"
          setzen={(v) => mitZiel((id) => gestaltungAendern(id, { schriftgroesse: v }))}
        />
      </Feldgruppe>

      <Feldgruppe titel="Seitenränder" fuss="Für Fensterumschläge sind 25 mm links und 20 mm rechts üblich (DIN 5008).">
        <Vollzeile>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: 'Eng', werte: { randOben: 15, randUnten: 12, randLinks: 18, randRechts: 15 } },
              { label: 'Normal', werte: { randOben: 20, randUnten: 18, randLinks: 25, randRechts: 20 } },
              { label: 'Weit', werte: { randOben: 28, randUnten: 24, randLinks: 30, randRechts: 28 } },
            ].map((satz) => (
              <Marke
                key={satz.label}
                label={satz.label}
                an={
                  g.randOben === satz.werte.randOben && g.randUnten === satz.werte.randUnten &&
                  g.randLinks === satz.werte.randLinks && g.randRechts === satz.werte.randRechts
                }
                umschalten={() => mitZiel((id) => gestaltungAendern(id, satz.werte))}
              />
            ))}
          </div>
        </Vollzeile>
        <Reglerzeile label="Oben" wert={g.randOben} min={5} max={45} einheit="mm" setzen={(v) => mitZiel((id) => gestaltungAendern(id, { randOben: v }))} />
        <Reglerzeile label="Unten" wert={g.randUnten} min={5} max={45} einheit="mm" setzen={(v) => mitZiel((id) => gestaltungAendern(id, { randUnten: v }))} />
        <Reglerzeile label="Links" wert={g.randLinks} min={5} max={45} einheit="mm" setzen={(v) => mitZiel((id) => gestaltungAendern(id, { randLinks: v }))} />
        <Reglerzeile label="Rechts" wert={g.randRechts} min={5} max={45} einheit="mm" setzen={(v) => mitZiel((id) => gestaltungAendern(id, { randRechts: v }))} />
      </Feldgruppe>

      <Feldgruppe titel="Abstände">
        <Reglerzeile
          label="Zwischen Bausteinen"
          wert={g.bausteinAbstand}
          min={0} max={20} einheit="mm"
          setzen={(v) => mitZiel((id) => gestaltungAendern(id, { bausteinAbstand: v }))}
        />
      </Feldgruppe>

      <Feldgruppe titel="Logo" fuss="PNG mit durchsichtigem Hintergrund sieht auf dem Ausdruck am besten aus.">
        <Vollzeile>
          {g.logo ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center rounded-lg border border-border bg-white p-3">
                <img src={g.logo} alt="Logo" className="max-h-20 max-w-full object-contain" />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className={cn('flex-1', isMobile && 'h-11 text-[15px]')}
                  onClick={() => logoFeld.current?.click()}
                >
                  Anderes Logo
                </Button>
                <Button
                  variant="destructive"
                  className={cn('flex-1', isMobile && 'h-11 text-[15px]')}
                  onClick={() => mitZiel((id) => gestaltungAendern(id, { logo: '' }))}
                >
                  Entfernen
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className={cn('w-full', isMobile && 'h-12 text-[17px]')}
              onClick={() => logoFeld.current?.click()}
            >
              <ImagePlus /> Logo hochladen
            </Button>
          )}
          <input
            ref={logoFeld}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            className="hidden"
            onChange={(e) => { logoLaden(e.target.files?.[0]); e.target.value = ''; }}
          />
        </Vollzeile>
      </Feldgruppe>
    </div>
  );

  // ── Die Vorschau ──
  const zoomleiste = (
    // Rechts bleibt Platz: Dort schwebt der Knopf für den KI-Assistenten und
    // deckte sonst die Zoomstufe zu.
    <div className="flex shrink-0 items-center gap-1.5 border-t border-border bg-background py-1.5 pl-3 pr-16">
      <span className="mr-auto truncate text-xs text-muted-foreground">
        DIN A4 · {layout?.seiten.length ?? 1} {(layout?.seiten.length ?? 1) === 1 ? 'Seite' : 'Seiten'}
      </span>
      <Button variant="ghost" size="icon-sm" onClick={() => zoomen(-1)} aria-label="Kleiner">
        <Minus />
      </Button>
      <span className="w-11 text-center text-xs tabular-nums">{zoomProzent} %</span>
      <Button variant="ghost" size="icon-sm" onClick={() => zoomen(1)} aria-label="Größer">
        <Plus />
      </Button>
      <Button
        variant={zoom === 'passend' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => setZoom('passend')}
      >
        <ZoomIn /> Passend
      </Button>
    </div>
  );

  const vorschau = (
    <>
      <div ref={blattbereich} className="min-h-0 flex-1 overflow-auto bg-muted/40">
        <div className={cn('flex min-h-full w-fit min-w-full justify-center', isMobile ? 'p-3' : 'p-8')}>
          {/*
            Kein `aktiverBaustein`: Die fertigen Kästen tragen keine Kennung
            mehr, aus der sich ihr Baustein ablesen ließe. Hervorgehoben wird
            deshalb in der Liste, nicht auf dem Blatt.
          */}
          <Blattvorschau
            seiten={layout?.seiten ?? []}
            schriftart={g.schriftart}
            massstab={massstab}
          />
        </div>
      </div>
      {zoomleiste}
    </>
  );

  // ── Die Vorlagenwahl ──
  const vorlagenzeilen = (
    <ListGroup title="Vorlagen">
      {vorlagen.map((v) => (
        <ListRow
          key={v.id}
          label={v.name}
          hint={v.art === 'gutschrift' ? 'Gutschrift' : 'Rechnung'}
          active={v.id === vorlage.id}
          onClick={() => {
            setOffeneVorlage(v.id);
            setGewaehlterBaustein(null);
            setVorlagenlisteOffen(false);
          }}
        />
      ))}
    </ListGroup>
  );

  const vorlagenaktionen = (
    <ListGroup title="Diese Vorlage">
      <ListRow icon={<Plus />} tint="blue" label="Neue Vorlage" noChevron onClick={() => { setVorlagenlisteOffen(false); setNeuOffen(true); }} />
      <ListRow icon={<Copy />} tint="teal" label="Kopieren" noChevron onClick={() => { vorlageKopieren(); setVorlagenlisteOffen(false); }} />
      <ListRow
        icon={<Pencil />} tint="gray" label="Umbenennen" noChevron
        onClick={() => { setNeuerTitel(vorlage.name); setVorlagenlisteOffen(false); setUmbenennenOffen(true); }}
      />
      {vorlage.mitgeliefert ? (
        <ListRow icon={<RotateCcw />} tint="orange" label="Auf Auslieferungsstand zurücksetzen" noChevron onClick={() => { vorlageZuruecksetzen(); setVorlagenlisteOffen(false); }} />
      ) : (
        <ListRow icon={<Trash2 />} tint="red" label="Löschen" destructive noChevron onClick={() => { setVorlagenlisteOffen(false); setLoeschenOffen(true); }} />
      )}
    </ListGroup>
  );

  // ── Dialoge, die beide Fassungen teilen ──
  const dialoge = (
    <>
      <ConfirmDialog
        open={loeschenOffen}
        title={`„${vorlage.name}" löschen?`}
        description="Die Vorlage ist danach weg. Rechnungen, die du damit geschrieben hast, bleiben erhalten."
        confirmLabel="Löschen"
        destructive
        onConfirm={vorlageLoeschen}
        onCancel={() => setLoeschenOffen(false)}
      />

      <ResponsiveModal
        open={auswahlOffen}
        onClose={() => setAuswahlOffen(false)}
        title="Baustein hinzufügen"
        description="Der neue Baustein kommt ans Ende – ziehen kannst du ihn danach."
        desktopClassName="max-w-md"
      >
        <div className="space-y-1.5">
          {ALLE_TYPEN.map((typ) => {
            const belegt = NUR_EINMAL.includes(typ) && vorhandeneTypen.has(typ);
            return (
              <button
                key={typ}
                type="button"
                disabled={belegt}
                onClick={() => bausteinEinfuegen(typ)}
                className={cn(
                  'w-full rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors',
                  belegt ? 'opacity-40' : 'hover:border-primary/40 hover:bg-muted',
                )}
              >
                <span className="block text-[15px] font-medium">{BAUSTEIN_LABELS[typ]}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
                  {belegt ? 'Kommt nur einmal vor und ist schon da.' : BAUSTEIN_BESCHREIBUNG[typ]}
                </span>
              </button>
            );
          })}
        </div>
      </ResponsiveModal>

      <ResponsiveModal
        open={neuOffen}
        onClose={() => setNeuOffen(false)}
        title="Neue Vorlage"
        description="Du beginnst mit dem üblichen Aufbau einer deutschen Rechnung und änderst ihn danach."
      >
        <div className="space-y-4">
          <FormGroup>
            <FormFullRow>
              <span className="mb-1 block text-[13px] text-muted-foreground">Name</span>
              <input
                autoFocus
                value={neuName}
                onChange={(e) => setNeuName(e.target.value)}
                placeholder="Meine Rechnung"
                className="w-full bg-transparent text-[17px] outline-none placeholder:text-muted-foreground/60"
              />
            </FormFullRow>
            <FormFullRow>
              <Segmented
                value={neuArt}
                onChange={setNeuArt}
                options={[{ value: 'rechnung', label: 'Rechnung' }, { value: 'gutschrift', label: 'Gutschrift' }]}
              />
            </FormFullRow>
          </FormGroup>
          <Button className="h-[50px] w-full text-[17px] font-semibold" onClick={vorlageAnlegen}>Anlegen</Button>
        </div>
      </ResponsiveModal>

      <ResponsiveModal open={umbenennenOffen} onClose={() => setUmbenennenOffen(false)} title="Vorlage umbenennen">
        <div className="space-y-4">
          <FormGroup>
            <FormFullRow>
              <input
                autoFocus
                value={neuerTitel}
                onChange={(e) => setNeuerTitel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') umbenennen(); }}
                className="w-full bg-transparent text-[17px] outline-none"
              />
            </FormFullRow>
          </FormGroup>
          <Button className="h-[50px] w-full text-[17px] font-semibold" onClick={umbenennen}>Übernehmen</Button>
        </div>
      </ResponsiveModal>

      <ResponsiveModal open={vorlagenlisteOffen} onClose={() => setVorlagenlisteOffen(false)} title="Vorlage">
        <div className="space-y-6">
          {vorlagenzeilen}
          {vorlagenaktionen}
        </div>
      </ResponsiveModal>

      <ResponsiveModal
        open={isMobile && offenerBaustein !== null}
        onClose={() => setGewaehlterBaustein(null)}
        title={offenerBaustein ? BAUSTEIN_LABELS[offenerBaustein.typ] : ''}
        description={offenerBaustein ? BAUSTEIN_BESCHREIBUNG[offenerBaustein.typ] : undefined}
        closeLabel="Fertig"
      >
        {offenerBaustein && (
          <BausteinEinstellungen
            baustein={offenerBaustein}
            aendern={(patch) => mitZiel((id) => bausteinAendern(id, offenerBaustein.id, patch))}
            entfernen={() => {
              mitZiel((id) => bausteinLoeschen(id, offenerBaustein.id));
              setGewaehlterBaustein(null);
            }}
          />
        )}
      </ResponsiveModal>
    </>
  );

  // ── Handy ──
  //
  // Drei Ansichten hintereinander statt drei Spalten nebeneinander. Der
  // Umschalter oben ist die einzige Navigation, die es dafür braucht.
  if (isMobile) {
    return (
      <HandyKontext.Provider value>
        <div className="flex h-full flex-col overflow-hidden">
          <div className="shrink-0 space-y-3 px-4 pb-3">
            <PageHeader
              title="Vorlagen"
              subtitle={vorlage.name}
              actions={
                // Ein Stift verspricht „umbenennen". Hier wird gewechselt, und
                // dafür ist das Zeichen der Auswahlfelder das richtige.
                <Button size="icon" variant="outline" onClick={() => setVorlagenlisteOffen(true)} aria-label="Vorlage wechseln">
                  <ChevronsUpDown className="h-4 w-4" />
                </Button>
              }
            />
            {vorlage.mitgeliefert && (
              <p className="text-[13px] leading-snug text-muted-foreground">
                Mitgelieferte Vorlage – die erste Änderung legt automatisch eine eigene Kopie an.
              </p>
            )}
            <Segmented
              value={reiter}
              onChange={setReiter}
              options={[
                { value: 'aufbau', label: 'Aufbau' },
                { value: 'aussehen', label: 'Aussehen' },
                { value: 'vorschau', label: 'Vorschau' },
              ]}
            />
          </div>

          {reiter === 'vorschau' ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{vorschau}</div>
          ) : (
            <div
              className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4"
              style={{ paddingBottom: 'var(--app-main-pb, 2rem)' }}
            >
              {reiter === 'aufbau' ? aufbau : aussehen}
              <Button variant="secondary" className="h-[50px] w-full text-[17px]" onClick={rechnungSchreiben}>
                <FilePlus2 /> Rechnung damit schreiben
              </Button>
            </div>
          )}

          {dialoge}
        </div>
      </HandyKontext.Provider>
    );
  }

  // ── Desktop ──
  //
  // Zwei Spalten: links gebaut, rechts gesehen. Die Vorschau bekommt alles,
  // was übrig bleibt – vorher war es genau andersherum.
  return (
    <HandyKontext.Provider value={false}>
      <div ref={rahmen} className="flex h-full overflow-hidden">
        <aside
          className={cn(
            'flex flex-col overflow-hidden border-border bg-background',
            eng
              ? reiter === 'vorschau' ? 'hidden' : 'min-w-0 flex-1'
              : 'w-[360px] shrink-0 border-r',
          )}
        >
          <div data-tutorial="designer-template-list" className="shrink-0 space-y-2 border-b border-border p-3">
            <Select
              value={vorlage.id}
              onValueChange={(v) => { setOffeneVorlage(v); setGewaehlterBaustein(null); }}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {vorlagen.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}{v.art === 'gutschrift' ? ' · Gutschrift' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setNeuOffen(true)} title="Neue Vorlage anlegen">
                <Plus /> Neu
              </Button>
              <Button variant="outline" size="icon-sm" onClick={vorlageKopieren} title="Vorlage kopieren">
                <Copy />
              </Button>
              <Button
                variant="outline" size="icon-sm" title="Vorlage umbenennen"
                onClick={() => { setNeuerTitel(vorlage.name); setUmbenennenOffen(true); }}
              >
                <Pencil />
              </Button>
              {vorlage.mitgeliefert ? (
                <Button variant="outline" size="icon-sm" onClick={vorlageZuruecksetzen} title="Auf Auslieferungsstand zurücksetzen">
                  <RotateCcw />
                </Button>
              ) : (
                <Button variant="outline" size="icon-sm" onClick={() => setLoeschenOffen(true)} title="Vorlage löschen">
                  <Trash2 className="text-destructive" />
                </Button>
              )}
            </div>

            <Button variant="secondary" size="sm" className="w-full" onClick={rechnungSchreiben}>
              <FilePlus2 /> Rechnung damit schreiben
            </Button>

            {vorlage.mitgeliefert && (
              <p className="px-0.5 text-[11px] leading-snug text-muted-foreground">
                Mitgelieferte Vorlage – die erste Änderung legt automatisch eine eigene Kopie an.
              </p>
            )}
          </div>

          <div className="shrink-0 px-3 pt-3">
            <Segmented
              value={reiter}
              onChange={setReiter}
              options={
                eng
                  ? [
                    { value: 'aufbau', label: 'Aufbau' },
                    { value: 'aussehen', label: 'Aussehen' },
                    { value: 'vorschau', label: 'Vorschau' },
                  ]
                  : [{ value: 'aufbau', label: 'Aufbau' }, { value: 'aussehen', label: 'Aussehen' }]
              }
            />
          </div>

          <div data-tutorial="designer-toolbar" className="min-h-0 flex-1 overflow-y-auto p-3">
            {reiter === 'aussehen' ? aussehen : aufbau}
          </div>
        </aside>

        <main
          data-tutorial="designer-canvas"
          className={cn(
            'flex min-w-0 flex-1 flex-col overflow-hidden',
            eng && reiter !== 'vorschau' && 'hidden',
          )}
        >
          {eng && (
            // Im schmalen Fenster ist die Vorschau eine eigene Ansicht – der
            // Weg zurück zum Aufbau muss dann sichtbar sein.
            <div className="shrink-0 border-b border-border bg-background p-3">
              <Segmented
                value={reiter}
                onChange={setReiter}
                options={[
                  { value: 'aufbau', label: 'Aufbau' },
                  { value: 'aussehen', label: 'Aussehen' },
                  { value: 'vorschau', label: 'Vorschau' },
                ]}
              />
            </div>
          )}
          {vorschau}
        </main>

        {dialoge}
      </div>
    </HandyKontext.Provider>
  );
}
