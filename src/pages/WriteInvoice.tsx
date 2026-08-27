// ─── Rechnung schreiben ──────────────────────────────────────────────────────
//
// Die alte Fassung war ein Konfigurationsdialog, keine Rechnung: Alle Felder
// kamen generisch aus `template.variables` und standen als eine endlose Kolonne
// aus Beschriftung und Eingabe in einer 220 Pixel schmalen Spalte – Absender,
// Empfänger, Nummer und Steuerhinweis gleich gewichtet, ohne Reihenfolge und
// ohne Zusammenhang. Auf dem Handy gab es diese Fassung ebenfalls, nur eben auf
// 375 Pixeln, samt Vorschau daneben.
//
// Hier ist die Seite nach der Frage gebaut, in welcher Reihenfolge man eine
// Rechnung tatsächlich schreibt: erst an wen, dann die Eckdaten, dann was man
// geleistet hat, zuletzt die Texte. Vier Abschnitte, aufklappbar, mit dem
// Wichtigsten offen. Die Absenderangaben stehen gar nicht mehr im Formular –
// sie kommen aus den Einstellungen und sind nur noch ein Hinweis mit Verweis.
//
// Vorschau und PDF kommen aus demselben Layout (`layoutRechnung`), es kann also
// nichts auseinanderlaufen. Auf dem Handy ist die Vorschau bewusst nicht
// dauerhaft sichtbar: Auf 375 Pixeln bliebe sonst für die Eingabe nichts übrig.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  ChevronDown, ChevronLeft, ChevronRight, Eye, FileDown, FileText, GripVertical,
  Maximize2, Minus, Plus, Save, Settings2, Trash2, Users, Wand2,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ListGroup, ListRow } from '@/components/ui/list-group';
import { FIELD, FormFullRow, FormGroup, FormRow } from '@/components/ui/form-list';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/layout/PageHeader';
import { SaveInvoiceDialog } from '@/components/invoices/SaveInvoiceDialog';
import { Blattvorschau } from '@/components/rechnung/Blattvorschau';
import { useKneifzoom } from '@/components/rechnung/useKneifzoom';

import { useIsMobile } from '@/hooks/useIsMobile';
import { useAppStore } from '@/store';
import { useVorlagenStore } from '@/store/vorlagenStore';
import { fuelle, layoutRechnung, zeilenBetrag, type Seite } from '@/lib/rechnung/layout';
import { pdfBytes } from '@/lib/rechnung/pdf';
import { A4_BREITE, type PositionsSpalte, type Rechnungsvorlage } from '@/types/rechnungsvorlage';
import type { LineItem } from '@/types/template';
import { customers, generateInvoiceNumber, getSetting, type Customer } from '@/lib/db';
import { copyPdfToAppData } from '@/lib/pdf';
import { saveXRechnungToAppData } from '@/lib/xrechnung';
import { cn } from '@/lib/utils';

// ─── Kleinkram ───────────────────────────────────────────────────────────────

const euro = (n: number) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

/** Deutsche Zahleneingabe („1.234,50") in eine Zahl. */
function parseZahl(text: string): number {
  const n = Number.parseFloat(text.replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

const heute = () => format(new Date(), 'dd.MM.yyyy');

function inTagen(tage: number): string {
  const d = new Date();
  d.setDate(d.getDate() + tage);
  return format(d, 'dd.MM.yyyy');
}

/** „31.12.2026" → „2026-12-31". Fällt auf heute zurück, wenn nichts Gültiges dasteht. */
function isoDatum(deutsch: string): string {
  const t = (deutsch ?? '').split('.');
  if (t.length === 3 && t[2].length === 4) {
    return `${t[2]}-${t[1].padStart(2, '0')}-${t[0].padStart(2, '0')}`;
  }
  return new Date().toISOString().slice(0, 10);
}

function neuePosition(): LineItem {
  return {
    id: `pos-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description: '',
    quantity: 1,
    // Ohne Einheit, nicht mit „Std." vorbelegt: Die Spalte erscheint auf dem
    // Blatt nur, wenn wirklich eine dasteht – sonst trüge jede Rechnung eine
    // Einheit, die nie jemand gewollt hat. Als Platzhalter steht sie trotzdem
    // im Feld, damit man sieht, was dort hingehört.
    unit: '',
    unitPrice: 0,
    parentGroupId: null,
  };
}

/**
 * Ergänzt die Spalten der Positionstabelle um Einheit und Rabatt, sobald in den
 * Positionen etwas steht, das sonst unter den Tisch fiele. Die Reihenfolge ist
 * fest vorgegeben, damit die Einheit hinter der Menge landet und der Rabatt vor
 * dem Betrag – egal, in welcher Reihenfolge die Vorlage ihre Spalten führt.
 */
function mitSpalten(
  spalten: PositionsSpalte[],
  braucht: { einheit: boolean; rabatt: boolean },
): PositionsSpalte[] {
  const reihenfolge: PositionsSpalte[] = [
    'pos', 'beschreibung', 'menge', 'einheit', 'einzelpreis', 'rabatt', 'betrag',
  ];
  const gewuenscht = new Set(spalten);
  if (braucht.einheit) gewuenscht.add('einheit');
  if (braucht.rabatt) gewuenscht.add('rabatt');
  // Nur ergänzen, nie umsortieren, was die Vorlage schon hatte: Eine Vorlage
  // ohne Mengenspalte soll auch keine bekommen.
  return reihenfolge.filter((s) => gewuenscht.has(s));
}

/** Die Profilschlüssel aus der Tabelle `settings`, die auf der Rechnung landen. */
const PROFIL_SCHLUESSEL = [
  'profile_name', 'profile_address', 'profile_street', 'profile_zip', 'profile_city',
  'profile_country', 'profile_email', 'profile_phone', 'profile_tax_number',
  'profile_w_idnr', 'profile_vat_id', 'profile_finanzamt', 'profile_iban', 'profile_bic',
] as const;

/**
 * Aus dem Profil werden die `sender_*`-Felder, die das Layout kennt. Diese
 * Angaben stehen bewusst nicht mehr im Formular: Sie ändern sich einmal im Jahr,
 * standen aber als zehn Eingabefelder direkt neben dem Empfänger und haben den
 * Blick von dem weggezogen, was an dieser Rechnung neu ist.
 */
function absenderFelder(p: Record<string, string>): Record<string, string> {
  const anschrift =
    p.profile_address?.trim() ||
    [p.profile_street, [p.profile_zip, p.profile_city].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(', ');
  return {
    sender_name: p.profile_name ?? '',
    sender_address: anschrift,
    sender_email: p.profile_email ?? '',
    sender_phone: p.profile_phone ?? '',
    sender_tax_number: p.profile_tax_number ?? '',
    sender_w_idnr: p.profile_w_idnr ?? '',
    sender_vat_id: p.profile_vat_id ?? '',
    sender_finanzamt: p.profile_finanzamt ?? '',
    sender_iban: p.profile_iban ?? '',
    sender_bic: p.profile_bic ?? '',
  };
}

// ─── Zahlenfeld ──────────────────────────────────────────────────────────────
//
// Zahlen als Text zu führen, solange jemand tippt, ist der einzige Weg, bei dem
// „1," nicht sofort wieder zu „1" wird. Beim Verlassen des Feldes übernimmt
// wieder die formatierte Zahl.

interface ZahlFeldProps extends Omit<React.ComponentProps<'input'>, 'value' | 'onChange'> {
  wert: number;
  onWert: (n: number) => void;
  /** Feste Nachkommastellen in der Anzeige; ohne Angabe bis zu zwei. */
  nachkomma?: number;
}

function ZahlFeld({ wert, onWert, nachkomma, ...rest }: ZahlFeldProps) {
  const [roh, setRoh] = useState<string | null>(null);
  const anzeige =
    roh ??
    (wert === 0
      ? ''
      : wert.toLocaleString('de-DE', {
        minimumFractionDigits: nachkomma ?? 0,
        maximumFractionDigits: nachkomma ?? 2,
      }));

  return (
    <Input
      inputMode="decimal"
      {...rest}
      value={anzeige}
      onChange={(e) => { setRoh(e.target.value); onWert(parseZahl(e.target.value)); }}
      onFocus={(e) => { setRoh(e.target.value); e.currentTarget.select(); }}
      onBlur={() => setRoh(null)}
    />
  );
}

// ─── Positionstabelle (Desktop) ──────────────────────────────────────────────

/**
 * Spaltenraster – Kopfzeile und Zeilen teilen es sich, sonst verrutscht alles.
 *
 * Die Beschreibung ist `minmax(0,1fr)` und nicht `minmax(96px,1fr)`: Mit einer
 * festen Mindestbreite war die Tabelle breiter als die Eingabespalte und bekam
 * einen waagerechten Rollbalken – ausgerechnet der Betrag stand dann außerhalb
 * des Sichtfelds. Lieber schrumpft die Beschreibung, sie scrollt in sich selbst.
 *
 * Die festen Spalten sind so knapp bemessen, wie ihr längster zu erwartender
 * Wert es zulässt („12.500,00 €" im Betrag), damit für die Beschreibung möglichst
 * viel übrig bleibt – sie ist die einzige Spalte, in der man wirklich schreibt.
 */
const RASTER =
  'grid grid-cols-[16px_minmax(0,1fr)_40px_42px_60px_38px_72px_22px] items-center gap-0.5';

/** Zellen sehen erst dann nach Eingabefeld aus, wenn man sie anfasst. */
const ZELLE =
  'h-8 rounded-md border-transparent bg-transparent px-1 text-[13px] hover:border-input focus-visible:border-ring';

interface ZeileProps {
  position: LineItem;
  nummer: number;
  aendern: (patch: Partial<LineItem>) => void;
  loeschen: () => void;
  tasten: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

function PositionsZeile({ position, nummer, aendern, loeschen, tasten }: ZeileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: position.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        RASTER,
        'group border-b border-border/60 px-1 py-0.5 last:border-b-0',
        isDragging && 'relative z-10 rounded-md bg-accent/60 shadow-sm',
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        title={`Position ${nummer} verschieben`}
        className="flex h-8 w-4 cursor-grab items-center justify-center text-muted-foreground/30 transition-colors group-hover:text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <Input
        data-zelle
        value={position.description}
        onChange={(e) => aendern({ description: e.target.value })}
        onKeyDown={tasten}
        placeholder={nummer === 1 ? 'z. B. Konzeption und Umsetzung Website' : 'Weitere Leistung'}
        className={cn(ZELLE, 'font-medium')}
      />
      <ZahlFeld
        data-zelle
        wert={position.quantity}
        onWert={(n) => aendern({ quantity: n })}
        onKeyDown={tasten}
        placeholder="1"
        className={cn(ZELLE, 'text-right')}
      />
      <Input
        data-zelle
        value={position.unit ?? ''}
        onChange={(e) => aendern({ unit: e.target.value })}
        onKeyDown={tasten}
        placeholder="Std."
        className={cn(ZELLE, 'text-center')}
      />
      <ZahlFeld
        data-zelle
        wert={position.unitPrice}
        onWert={(n) => aendern({ unitPrice: n })}
        onKeyDown={tasten}
        nachkomma={2}
        placeholder="0,00"
        className={cn(ZELLE, 'text-right')}
      />
      <ZahlFeld
        data-zelle
        wert={position.discount ?? 0}
        onWert={(n) => aendern({ discount: n })}
        onKeyDown={tasten}
        placeholder="–"
        className={cn(ZELLE, 'text-right')}
      />
      <span className="truncate px-1 text-right text-[13px] tabular-nums text-muted-foreground">
        {euro(zeilenBetrag(position))}
      </span>
      <button
        type="button"
        onClick={loeschen}
        title="Position löschen"
        className="flex h-8 w-[22px] items-center justify-center rounded-md text-muted-foreground/0 transition-colors group-hover:text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Positionskarte (Handy) ──────────────────────────────────────────────────
//
// Eine Tabelle mit sieben Spalten ist auf einem Telefon nicht zu bedienen.
// Dieselbe Position hier als Karte: Beschreibung groß, darunter die Rechnung
// „Menge × Preis = Betrag" in einer Zeile, Einheit und Rabatt hinter einem
// Aufklapper – die braucht man selten.

function PositionsKarte({
  position, nummer, aendern, loeschen,
}: {
  position: LineItem;
  nummer: number;
  aendern: (patch: Partial<LineItem>) => void;
  loeschen: () => void;
}) {
  const [offen, setOffen] = useState(false);

  return (
    <div className="rounded-xl bg-card p-3">
      <div className="flex items-start gap-2">
        <span className="mt-1 w-5 shrink-0 text-[13px] tabular-nums text-muted-foreground">{nummer}.</span>
        <textarea
          rows={1}
          value={position.description}
          onChange={(e) => aendern({ description: e.target.value })}
          placeholder="Was hast du geleistet?"
          className="min-h-[26px] w-full resize-none bg-transparent text-[17px] leading-snug font-medium outline-none placeholder:text-muted-foreground/60"
        />
        <button
          type="button"
          onClick={loeschen}
          className="-mr-1 shrink-0 p-1 text-muted-foreground active:opacity-60"
          aria-label={`Position ${nummer} löschen`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-1.5 pl-7 text-[15px]">
        <ZahlFeld
          wert={position.quantity}
          onWert={(n) => aendern({ quantity: n })}
          placeholder="1"
          className="h-9 w-16 text-center text-[15px]"
        />
        <span className="text-muted-foreground">×</span>
        <ZahlFeld
          wert={position.unitPrice}
          onWert={(n) => aendern({ unitPrice: n })}
          nachkomma={2}
          placeholder="0,00"
          className="h-9 w-24 text-right text-[15px]"
        />
        <span className="ml-auto text-[17px] font-semibold tabular-nums">{euro(zeilenBetrag(position))}</span>
      </div>

      {offen && (
        <div className="mt-2 flex items-center gap-2 pl-7">
          <Label className="text-[13px] text-muted-foreground">Einheit</Label>
          <Input
            value={position.unit ?? ''}
            onChange={(e) => aendern({ unit: e.target.value })}
            placeholder="Std."
            className="h-9 w-24 text-[15px]"
          />
          <Label className="ml-2 text-[13px] text-muted-foreground">Rabatt</Label>
          <ZahlFeld
            wert={position.discount ?? 0}
            onWert={(n) => aendern({ discount: n })}
            placeholder="0"
            className="h-9 w-16 text-right text-[15px]"
          />
          <span className="text-[13px] text-muted-foreground">%</span>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOffen((v) => !v)}
        className="mt-1 pl-7 text-[13px] text-primary active:opacity-60"
      >
        {offen ? 'Weniger' : 'Einheit und Rabatt'}
      </button>
    </div>
  );
}

// ─── Aufklappbarer Abschnitt (Desktop) ───────────────────────────────────────

function Abschnitt({
  titel, kurzfassung, offen, umschalten, children, anker,
}: {
  titel: string;
  /** Was rechts in der Kopfzeile steht, solange der Abschnitt zu ist. */
  kurzfassung?: string;
  offen: boolean;
  umschalten: () => void;
  children: React.ReactNode;
  anker?: string;
}) {
  return (
    <section data-tutorial={anker} className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <button
        type="button"
        onClick={umschalten}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-accent/40"
      >
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', !offen && '-rotate-90')}
        />
        <span className="font-heading text-[15px] font-semibold">{titel}</span>
        {!offen && kurzfassung && (
          <span className="ml-auto truncate pl-3 text-[13px] text-muted-foreground">{kurzfassung}</span>
        )}
      </button>
      {offen && <div className="space-y-3 px-4 pb-4">{children}</div>}
    </section>
  );
}

// ─── Der Teiler zwischen Eingabe und Vorschau ────────────────────────────────
//
// Eingabe und Vorschau streiten sich um dieselbe Breite: Die Positionstabelle
// hat sieben Spalten und will Platz, das A4-Blatt will ihn genauso. Bei der
// Fensterbreite, mit der die App startet, geht beides nicht zugleich auf.
// Statt die Aufteilung zu erraten, darf sie der Nutzer verschieben – wer gerade
// tippt, zieht nach rechts, wer prüft, nach links.

const TEILER_MIN = 420;
const TEILER_REST = 320;

/** Hält die Breite in dem Bereich, in dem beide Seiten noch brauchbar sind. */
const einpassen = (roh: number, gesamt: number) =>
  Math.min(Math.max(TEILER_MIN, roh), Math.max(TEILER_MIN, gesamt - TEILER_REST));

function useTeiler(anfang: number) {
  const [breite, setBreite] = useState(anfang);
  const rahmen = useRef<HTMLDivElement | null>(null);
  // Der Rahmen kommt als Zustand und nicht nur als Ref: Zieht jemand das Fenster
  // unter die Handy-Grenze und wieder darüber, entsteht die Desktop-Fassung neu.
  // Eine Wirkung mit leerer Abhängigkeitsliste liefe dann nicht noch einmal, und
  // die Aufteilung bliebe für den Rest der Sitzung starr.
  const [gemessen, setGemessen] = useState<HTMLDivElement | null>(null);
  const rahmenRef = useCallback((el: HTMLDivElement | null) => {
    rahmen.current = el;
    setGemessen(el);
  }, []);

  // Wird das Fenster schmaler, muss die Eingabe nachgeben – sonst bliebe von
  // der Vorschau irgendwann nur noch ein Streifen übrig, ohne dass jemand den
  // Teiler angefasst hätte.
  useEffect(() => {
    if (!gemessen) return;
    const messen = () => setBreite((b) => einpassen(b, gemessen.clientWidth));
    messen();
    const beobachter = new ResizeObserver(messen);
    beobachter.observe(gemessen);
    return () => beobachter.disconnect();
  }, [gemessen]);

  const beginnen = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startBreite = rahmen.current
      ? (rahmen.current.firstElementChild as HTMLElement).getBoundingClientRect().width
      : anfang;
    const gesamt = rahmen.current?.getBoundingClientRect().width ?? 0;
    const startX = e.clientX;

    const bewegen = (ev: MouseEvent) => setBreite(einpassen(startBreite + ev.clientX - startX, gesamt));
    const loslassen = () => {
      window.removeEventListener('mousemove', bewegen);
      window.removeEventListener('mouseup', loslassen);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    // Ohne diese Sperre markiert das Ziehen den Text, über den die Maus fährt,
    // und die halbe Seite blaut ein, sobald man die Vorschau streift.
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', bewegen);
    window.addEventListener('mouseup', loslassen);
  }, [anfang]);

  return { rahmenRef, breite, beginnen };
}

// ─── Blattvorschau, die sich einpasst ────────────────────────────────────────

/** Pixel je Millimeter bei 96 dpi – der Maßstab, den „100 %" meint. */
const PIXEL_JE_MM = 3.78;

/** Misst die verfügbare Breite, damit „Anpassen" das Blatt genau einpasst. */
function useBlattBreite(rand: number) {
  // Der Knoten als Zustand statt als Ref: Am Handy steht die Vorschau in einem
  // Blatt, das auf- und zugeht. Nur so merken Messung und Fingergeste, dass es
  // den Bereich jetzt gibt.
  const [knoten, setKnoten] = useState<HTMLDivElement | null>(null);
  const [passend, setPassend] = useState(PIXEL_JE_MM);

  useLayoutEffect(() => {
    if (!knoten) return;
    const messen = () => setPassend(Math.max(0.6, (knoten.clientWidth - rand) / A4_BREITE));
    messen();
    const beobachter = new ResizeObserver(messen);
    beobachter.observe(knoten);
    return () => beobachter.disconnect();
  }, [knoten, rand]);

  return { knoten, setKnoten, passend };
}

// ─── Die Seite ───────────────────────────────────────────────────────────────

type AbschnittName = 'empfaenger' | 'eckdaten' | 'positionen' | 'texte';

interface Buchung {
  partner: string;
  date: string;
  description: string;
  netto: number;
  ust: number;
  brutto: number;
  xrechnungPath?: string;
  pdfPath?: string;
  deliveryDate?: string;
}

export default function WriteInvoice() {
  const isMobile = useIsMobile();
  const steuerregelung = useAppStore((s) => s.steuerregelung);
  const kleinunternehmer = steuerregelung === 'kleinunternehmer';

  const vorlagen = useVorlagenStore((s) => s.vorlagen);

  // Wer aus dem Vorlagen-Baukasten über „Rechnung damit schreiben" kommt, hat
  // sich dort schon für eine Vorlage entschieden. Die Kennung steht in der
  // Adresse; sie hier zu übergehen hieße, ihn zweimal dasselbe fragen.
  const [suchparameter] = useSearchParams();
  const [vorlageId, setVorlageId] = useState<string>(() => {
    const gewuenscht = suchparameter.get('vorlage');
    if (gewuenscht && vorlagen.some((v) => v.id === gewuenscht)) return gewuenscht;
    return vorlagen[0]?.id ?? '';
  });

  // ── Eingaben ──
  const [feld, setFeld] = useState<Record<string, string>>(() => ({
    doc_date: heute(),
    delivery_date: heute(),
    due_date: inTagen(14),
    payment_terms: 'Zahlbar innerhalb von 14 Tagen ohne Abzug.',
    legal_notice: kleinunternehmer
      ? 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.'
      : '',
  }));
  const setzeFeld = useCallback((schluessel: string, wert: string) => {
    setFeld((f) => ({ ...f, [schluessel]: wert }));
  }, []);

  const [positionen, setPositionen] = useState<LineItem[]>(() => [neuePosition()]);
  const [nachlass, setNachlass] = useState(0);
  const [mwstSatz, setMwstSatz] = useState(kleinunternehmer ? 0 : 19);

  const [profil, setProfil] = useState<Record<string, string>>({});
  const [kunden, setKunden] = useState<Customer[]>([]);
  const [kundenOffen, setKundenOffen] = useState(false);
  const [kundenSuche, setKundenSuche] = useState('');

  const [offen, setOffen] = useState<Record<AbschnittName, boolean>>({
    empfaenger: true,
    eckdaten: false,
    positionen: true,
    texte: false,
  });
  const umschalten = (name: AbschnittName) => setOffen((o) => ({ ...o, [name]: !o[name] }));

  // ── Vorschau ──
  const [zoom, setZoom] = useState<number | null>(null); // null = einpassen
  const [seiteIndex, setSeiteIndex] = useState(0);
  const [vorschauOffen, setVorschauOffen] = useState(false);

  const [arbeitet, setArbeitet] = useState<'pdf' | 'beleg' | null>(null);
  const [buchung, setBuchung] = useState<Buchung | null>(null);

  const tabelleRef = useRef<HTMLDivElement>(null);
  const teiler = useTeiler(520);
  const sensoren = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    Promise.all(PROFIL_SCHLUESSEL.map(async (k) => [k, (await getSetting(k)) ?? ''] as const))
      .then((paare) => setProfil(Object.fromEntries(paare)))
      .catch(console.error);
    customers.getAll().then(setKunden).catch(() => { /* Ohne Kundenliste tippt man den Namen eben. */ });
  }, []);

  // ── Vorlage samt Angaben, die zu dieser einen Rechnung gehören ──
  //
  // Der Steuersatz gehört zur einzelnen Rechnung, nicht zur Vorlage: Dieselbe
  // Vorlage trägt mal 19 %, mal eine Leistung ins Ausland ohne Steuer. Dasselbe
  // gilt für die Spalten Einheit und Rabatt – die mitgelieferten Vorlagen zeigen
  // sie nicht, wer sie hier aber ausfüllt, will sie auch auf dem Blatt sehen.
  // Ohne diese Ergänzung verschwand eine getippte Einheit spurlos und ein
  // Zeilenrabatt kürzte nur den Betrag, ohne sich zu erklären.
  //
  // Alles wird über die Vorlage gelegt, ohne sie zu ändern – gespeichert bleibt
  // sie so, wie der Nutzer sie im Baukasten eingestellt hat.
  const basisVorlage: Rechnungsvorlage | undefined =
    vorlagen.find((v) => v.id === vorlageId) ?? vorlagen[0];

  const braucht = useMemo(
    () => ({
      einheit: positionen.some((p) => (p.unit ?? '').trim() !== ''),
      rabatt: positionen.some((p) => (p.discount ?? 0) > 0),
    }),
    [positionen],
  );

  const vorlage = useMemo<Rechnungsvorlage | null>(() => {
    if (!basisVorlage) return null;
    return {
      ...basisVorlage,
      bausteine: basisVorlage.bausteine.map((b) => {
        if (b.typ === 'positionen') {
          return {
            ...b,
            mwstSatz,
            summenAusweisen: mwstSatz > 0,
            spalten: mitSpalten(b.spalten, braucht),
          };
        }
        // Ein eigener Betreff schlägt den der Vorlage; leer heißt: Vorlage gilt.
        if (b.typ === 'betreff' && feld.subject?.trim()) {
          return { ...b, inhalt: feld.subject };
        }
        return b;
      }),
    };
  }, [basisVorlage, mwstSatz, braucht, feld.subject]);

  const werte = useMemo(
    () => {
      const w = { ...absenderFelder(profil), ...feld };
      // Solange keine Nummer vergeben ist, stünde im Betreff „Rechnung" mit
      // einem Leerzeichen dahinter – das sieht nach einem Fehler aus. Die
      // Nummer wird bewusst nicht beim Öffnen vergeben: `generateInvoiceNumber`
      // zieht sie aus der lückenlosen Folge, und die darf nicht bei jedem
      // Seitenaufruf weiterzählen. Also sagt die Vorschau, dass sie fehlt.
      if (!w.doc_number?.trim()) w.doc_number = '(Nummer folgt)';
      return w;
    },
    [profil, feld],
  );

  /** Was ohne eigenen Betreff auf dem Blatt stünde – als Platzhalter im Feld. */
  const betreffVorgabe = useMemo(() => {
    const b = basisVorlage?.bausteine.find((x) => x.typ === 'betreff');
    return b && b.typ === 'betreff' ? fuelle(b.inhalt, werte).trim() : '';
  }, [basisVorlage, werte]);

  const { seiten, summen } = useMemo(() => {
    if (!vorlage) {
      return { seiten: [] as Seite[], summen: { netto: 0, steuer: 0, brutto: 0, rabatt: 0 } };
    }
    return layoutRechnung({ vorlage, werte, positionen, globalerRabatt: nachlass });
  }, [vorlage, werte, positionen, nachlass]);

  const zwischensumme = useMemo(
    () => positionen.reduce((s, p) => s + zeilenBetrag(p), 0),
    [positionen],
  );

  const aktiveSeite = Math.min(seiteIndex, Math.max(0, seiten.length - 1));
  useEffect(() => { if (seiteIndex > seiten.length - 1) setSeiteIndex(0); }, [seiten.length, seiteIndex]);

  // ── Positionen ──
  const positionAendern = useCallback((id: string, patch: Partial<LineItem>) => {
    setPositionen((liste) => liste.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const positionLoeschen = useCallback((id: string) => {
    // Eine Zeile bleibt immer stehen – ein leerer Positionsblock sieht aus wie
    // ein Fehler, und der erste Klick wäre ohnehin „Position hinzufügen".
    setPositionen((liste) => (liste.length <= 1 ? [neuePosition()] : liste.filter((p) => p.id !== id)));
  }, []);

  const positionAnhaengen = useCallback((fokussieren = false) => {
    const frisch = neuePosition();
    setPositionen((liste) => [...liste, frisch]);
    if (fokussieren) {
      requestAnimationFrame(() => {
        const felder = tabelleRef.current?.querySelectorAll<HTMLInputElement>('[data-zelle]');
        felder?.[felder.length - 5]?.focus();
      });
    }
  }, []);

  const beimZiehen = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setPositionen((liste) => {
      const von = liste.findIndex((p) => p.id === active.id);
      const nach = liste.findIndex((p) => p.id === over.id);
      return von < 0 || nach < 0 ? liste : arrayMove(liste, von, nach);
    });
  };

  /**
   * Eingabetaste und Tabulator springen ins nächste Feld – und am Ende der
   * letzten Zeile in eine neue Zeile. Vorher landete man mit der Eingabetaste
   * nirgendwo und musste zur Maus greifen, um weiterzuschreiben.
   */
  const zellenTasten = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' && !(e.key === 'Tab' && !e.shiftKey)) return;
    const felder = Array.from(tabelleRef.current?.querySelectorAll<HTMLInputElement>('[data-zelle]') ?? []);
    const stelle = felder.indexOf(e.currentTarget);
    const naechstes = felder[stelle + 1];
    if (naechstes) {
      if (e.key === 'Enter') { e.preventDefault(); naechstes.focus(); naechstes.select(); }
      return;
    }
    e.preventDefault();
    positionAnhaengen(true);
  }, [positionAnhaengen]);

  // ── Kunden ──
  const gefilterteKunden = kunden.filter((c) => {
    const q = kundenSuche.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || (c.customer_number ?? '').toLowerCase().includes(q);
  });

  const kundeUebernehmen = (c: Customer) => {
    const anschrift = [c.street, [c.zip, c.city].filter(Boolean).join(' ')].filter(Boolean).join('\n');
    setFeld((f) => ({
      ...f,
      receiver_name: c.name,
      receiver_address: anschrift,
      customer_number: c.customer_number ?? '',
      ...(c.payment_days
        ? {
          due_date: inTagen(c.payment_days),
          payment_terms: `Zahlbar innerhalb von ${c.payment_days} Tagen ohne Abzug.`,
        }
        : {}),
    }));
    setKundenOffen(false);
    setKundenSuche('');
  };

  const nummerVorschlagen = async () => {
    try {
      const naechste = await generateInvoiceNumber('R');
      setzeFeld('doc_number', naechste);
    } catch {
      toast.error('Konnte keine Rechnungsnummer vergeben');
    }
  };

  // ── Speichern ──

  /** Schreibt das PDF dorthin, wo der Nutzer es haben will. */
  const pdfSchreiben = async (): Promise<{ pfad: string; name: string } | null> => {
    if (!vorlage) return null;
    const bytes = await pdfBytes(seiten, vorlage.gestaltung.schriftart);
    const name = (feld.doc_number || 'Rechnung').replace(/[^a-zA-Z0-9_-]/g, '_');
    const pfad = await saveDialog({
      defaultPath: `${name}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (!pfad) return null;
    await writeFile(pfad, bytes);
    return { pfad, name };
  };

  /** Vor dem Speichern kurz zusammentragen, was fehlen könnte. */
  const pruefen = (): boolean => {
    if (!vorlage) { toast.error('Keine Vorlage ausgewählt'); return false; }
    if (positionen.every((p) => zeilenBetrag(p) === 0 && !p.description.trim())) {
      toast.error('Die Rechnung hat noch keine Positionen.');
      return false;
    }
    if (!feld.doc_number?.trim()) toast.warning('Ohne Rechnungsnummer ist die Rechnung nicht vollständig.');
    if (!feld.delivery_date?.trim()) toast.warning('Leistungszeitpunkt fehlt – Pflichtangabe nach § 14 Abs. 4 UStG.');
    return true;
  };

  const alsPdfSpeichern = async () => {
    if (!pruefen()) return;
    setArbeitet('pdf');
    try {
      const ergebnis = await pdfSchreiben();
      if (ergebnis) toast.success('PDF gespeichert.');
    } catch (e) {
      toast.error('Fehler beim Speichern: ' + String(e));
    } finally {
      setArbeitet(null);
    }
  };

  /**
   * Buchen heißt: PDF speichern, die XRechnung als eigentliches Original daneben
   * archivieren (E-Rechnungspflicht seit 2025) und dann den Beleg anlegen. Die
   * XML entsteht bewusst nur hier – wer nur schnell ein PDF verschickt, soll
   * keine verwaiste Datei im Archiv hinterlassen.
   */
  const alsBelegBuchen = async () => {
    if (!pruefen()) return;
    setArbeitet('beleg');
    try {
      const ergebnis = await pdfSchreiben();
      if (!ergebnis) return;

      const datum = isoDatum(feld.doc_date ?? '');
      let xrechnungPath = '';
      const absender = profil.profile_name ?? '';
      if (absender) {
        try {
          xrechnungPath = await saveXRechnungToAppData(
            {
              id: `inv-${Date.now()}`,
              date: datum,
              year: Number.parseInt(datum.slice(0, 4)),
              month: Number.parseInt(datum.slice(5, 7)),
              category: 'umsatz_pflichtig',
              description: feld.doc_number || ergebnis.name,
              partner: feld.receiver_name ?? '',
              netto: summen.netto,
              fee: 0,
              ust: summen.steuer,
              brutto: summen.brutto,
              type: 'einnahme',
              currency: 'EUR',
              pdf_path: '',
              note: feld.notes ?? '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              is_locked: false,
              pdf_sha256: '',
              delivery_date: isoDatum(feld.delivery_date ?? ''),
              storno_of: '',
              xrechnung_path: '',
            },
            {
              sellerName: absender,
              sellerStreet: profil.profile_street ?? '',
              sellerZip: profil.profile_zip ?? '',
              sellerCity: profil.profile_city ?? '',
              sellerCountry: profil.profile_country || 'DE',
              taxNumber: profil.profile_tax_number ?? '',
              vatId: profil.profile_vat_id ?? '',
              sellerEmail: profil.profile_email ?? '',
            },
          );
        } catch (fehler) {
          toast.warning('XRechnung nicht archiviert (Profil unvollständig?): ' + String(fehler));
        }
      } else {
        toast.info('Kein Profilname hinterlegt – die XRechnung wurde nicht archiviert.');
      }

      // Das PDF wandert zusätzlich ins Archiv, damit die Sicherung vollständig
      // ist, auch wenn der Nutzer seine Datei später verschiebt.
      let pdfPath = '';
      try {
        pdfPath = await copyPdfToAppData(ergebnis.pfad, `${ergebnis.name}-${Date.now()}.pdf`);
      } catch { /* Nicht kritisch – der Beleg steht auch ohne Kopie. */ }

      setBuchung({
        partner: feld.receiver_name ?? '',
        date: feld.doc_date ?? heute(),
        description: feld.doc_number || ergebnis.name,
        netto: summen.netto,
        ust: summen.steuer,
        brutto: summen.brutto,
        xrechnungPath,
        pdfPath,
        deliveryDate: isoDatum(feld.delivery_date ?? ''),
      });
    } catch (e) {
      toast.error('Fehler beim Buchen: ' + String(e));
    } finally {
      setArbeitet(null);
    }
  };

  // ── Gemeinsame Bausteine beider Fassungen ──

  const kundenwahl = (
    <ResponsiveModal
      open={kundenOffen}
      onClose={() => setKundenOffen(false)}
      title="Kunde wählen"
      description="Name, Anschrift und Zahlungsziel werden übernommen."
    >
      <div className="space-y-3">
        <Input
          autoFocus
          value={kundenSuche}
          onChange={(e) => setKundenSuche(e.target.value)}
          placeholder="Suchen…"
          className="h-10"
        />
        {gefilterteKunden.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-muted-foreground">
            {kunden.length === 0 ? 'Noch keine Kunden angelegt.' : 'Kein Kunde gefunden.'}
          </p>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto">
            <ListGroup>
              {gefilterteKunden.map((c) => (
                <ListRow
                  key={c.id}
                  label={c.name}
                  hint={[c.customer_number, c.city].filter(Boolean).join(' · ') || undefined}
                  onClick={() => kundeUebernehmen(c)}
                />
              ))}
            </ListGroup>
          </div>
        )}
      </div>
    </ResponsiveModal>
  );

  const buchungsdialog = buchung && (
    <SaveInvoiceDialog open onClose={() => setBuchung(null)} prefill={buchung} />
  );

  const steuerwahl = (
    <Select value={String(mwstSatz)} onValueChange={(v) => setMwstSatz(Number(v))}>
      <SelectTrigger className="h-8 w-[104px] text-[13px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="0">Keine USt</SelectItem>
        <SelectItem value="7">7 % USt</SelectItem>
        <SelectItem value="19">19 % USt</SelectItem>
      </SelectContent>
    </Select>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Handy
  // ─────────────────────────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-4 pb-6">
          <PageHeader
            title="Rechnung schreiben"
            startExpanded
            className="mb-4"
            actions={
              // Nur das Symbol: Mit Beschriftung daneben blieb für den großen
              // Titel zu wenig Platz, und er brach als „Rechnung schre…" ab.
              <Button variant="outline" size="icon" onClick={() => setVorschauOffen(true)} aria-label="Vorschau">
                <Eye className="h-4 w-4" />
              </Button>
            }
          />

          <FormGroup title="Vorlage" footer="Absender, Steuernummer und Bankverbindung kommen aus den Einstellungen.">
            <FormRow label="Gestaltung">
              <Select value={basisVorlage?.id ?? ''} onValueChange={setVorlageId}>
                <SelectTrigger className="h-9 w-auto max-w-52 min-w-32 border-0 bg-transparent shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {vorlagen.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormRow>
            <FormRow label="Absender">
              <Link to="/settings" className="text-[15px] text-primary">
                {profil.profile_name || 'In den Einstellungen ergänzen'}
              </Link>
            </FormRow>
          </FormGroup>

          <FormGroup title="Empfänger">
            <FormRow label="Aus Kunden">
              <button type="button" onClick={() => setKundenOffen(true)} className="text-[17px] text-primary active:opacity-60">
                Wählen
              </button>
            </FormRow>
            <FormRow label="Name">
              <input
                className={FIELD}
                value={feld.receiver_name ?? ''}
                onChange={(e) => setzeFeld('receiver_name', e.target.value)}
                placeholder="Firma oder Person"
              />
            </FormRow>
            <FormFullRow>
              <textarea
                rows={3}
                value={feld.receiver_address ?? ''}
                onChange={(e) => setzeFeld('receiver_address', e.target.value)}
                placeholder={'Straße und Hausnummer\nPLZ Ort'}
                className="w-full resize-none bg-transparent text-[17px] leading-snug outline-none placeholder:text-muted-foreground/60"
              />
            </FormFullRow>
          </FormGroup>

          <FormGroup title="Eckdaten">
            <FormRow label="Nummer">
              <input
                className={FIELD}
                value={feld.doc_number ?? ''}
                onChange={(e) => setzeFeld('doc_number', e.target.value)}
                placeholder="R-2026-001"
              />
              <button type="button" onClick={nummerVorschlagen} className="ml-2 shrink-0 text-primary active:opacity-60" aria-label="Nummer vorschlagen">
                <Wand2 className="h-4 w-4" />
              </button>
            </FormRow>
            <FormRow label="Datum">
              <input className={FIELD} value={feld.doc_date ?? ''} onChange={(e) => setzeFeld('doc_date', e.target.value)} placeholder="TT.MM.JJJJ" />
            </FormRow>
            <FormRow label="Leistung" hint="Pflichtangabe">
              <input className={FIELD} value={feld.delivery_date ?? ''} onChange={(e) => setzeFeld('delivery_date', e.target.value)} placeholder="TT.MM.JJJJ" />
            </FormRow>
            <FormRow label="Fällig bis">
              <input className={FIELD} value={feld.due_date ?? ''} onChange={(e) => setzeFeld('due_date', e.target.value)} placeholder="TT.MM.JJJJ" />
            </FormRow>
          </FormGroup>

          <section className="space-y-1.5">
            <h2 className="px-4 text-[13px] font-medium text-muted-foreground">Positionen</h2>
            <div className="space-y-2">
              {positionen.map((p, i) => (
                <PositionsKarte
                  key={p.id}
                  position={p}
                  nummer={i + 1}
                  aendern={(patch) => positionAendern(p.id, patch)}
                  loeschen={() => positionLoeschen(p.id)}
                />
              ))}
            </div>
            <Button variant="outline" className="w-full gap-1.5" onClick={() => positionAnhaengen()}>
              <Plus className="h-4 w-4" />
              Position hinzufügen
            </Button>
          </section>

          <FormGroup title="Summe">
            <FormRow label="Zwischensumme">
              <span className="text-[17px] tabular-nums text-muted-foreground">{euro(zwischensumme)}</span>
            </FormRow>
            <FormRow label="Nachlass">
              <ZahlFeld wert={nachlass} onWert={setNachlass} placeholder="0" className="h-9 w-16 text-right text-[17px]" />
              <span className="ml-1 text-[17px] text-muted-foreground">%</span>
            </FormRow>
            <FormRow label="Umsatzsteuer" hint={kleinunternehmer ? 'Kleinunternehmer' : undefined}>
              {steuerwahl}
            </FormRow>
            <FormRow label="Gesamt">
              <span className="text-[17px] font-semibold tabular-nums">{euro(summen.brutto)}</span>
            </FormRow>
          </FormGroup>

          <FormGroup title="Texte">
            <FormRow label="Betreff">
              <input
                className={FIELD}
                value={feld.subject ?? ''}
                onChange={(e) => setzeFeld('subject', e.target.value)}
                placeholder={betreffVorgabe || 'Rechnung'}
              />
            </FormRow>
            <FormFullRow>
              <Label className="mb-1 block text-[13px] text-muted-foreground">Anschreiben</Label>
              <textarea
                rows={3}
                value={feld.notes ?? ''}
                onChange={(e) => setzeFeld('notes', e.target.value)}
                placeholder="Vielen Dank für den Auftrag …"
                className="w-full resize-none bg-transparent text-[17px] leading-snug outline-none placeholder:text-muted-foreground/60"
              />
            </FormFullRow>
            <FormFullRow>
              <Label className="mb-1 block text-[13px] text-muted-foreground">Zahlungsbedingungen</Label>
              <input
                className="w-full bg-transparent text-[17px] outline-none placeholder:text-muted-foreground/60"
                value={feld.payment_terms ?? ''}
                onChange={(e) => setzeFeld('payment_terms', e.target.value)}
                placeholder="Zahlbar innerhalb von 14 Tagen"
              />
            </FormFullRow>
            <FormFullRow>
              <Label className="mb-1 block text-[13px] text-muted-foreground">Steuerhinweis</Label>
              <textarea
                rows={2}
                value={feld.legal_notice ?? ''}
                onChange={(e) => setzeFeld('legal_notice', e.target.value)}
                placeholder="z. B. Steuerschuldnerschaft des Leistungsempfängers (§ 13b UStG)"
                className="w-full resize-none bg-transparent text-[17px] leading-snug outline-none placeholder:text-muted-foreground/60"
              />
            </FormFullRow>
          </FormGroup>
        </div>

        {/* Feste Leiste: Was am Ende dasteht, und die zwei Wege hinaus.
            Ohne eigenen Abstand für die Safe-Area – die Leiste sitzt ÜBER der
            Navigationsleiste des Layouts, und die hält den unteren Rand des
            Geräts bereits frei. Beides zusammen ergäbe einen toten Streifen. */}
        <div className="shrink-0 border-t border-border bg-background px-4 pt-2.5 pb-2.5">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[13px] text-muted-foreground">
              {positionen.length} {positionen.length === 1 ? 'Position' : 'Positionen'}
            </span>
            <span className="text-[20px] font-bold tabular-nums">{euro(summen.brutto)}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-1.5" onClick={alsPdfSpeichern} disabled={arbeitet !== null}>
              <FileDown className="h-4 w-4" />
              PDF
            </Button>
            <Button className="flex-1 gap-1.5" onClick={alsBelegBuchen} disabled={arbeitet !== null}>
              <Save className="h-4 w-4" />
              {arbeitet === 'beleg' ? 'Moment…' : 'Buchen'}
            </Button>
          </div>
        </div>

        <ResponsiveModal open={vorschauOffen} onClose={() => setVorschauOffen(false)} title="Vorschau" closeLabel="Fertig">
          <VorschauBlatt seiten={seiten} schriftart={vorlage?.gestaltung.schriftart ?? 'Helvetica'} seiteIndex={aktiveSeite} onSeite={setSeiteIndex} rand={16} />
        </ResponsiveModal>

        {kundenwahl}
        {buchungsdialog}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Desktop
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Kopfleiste: links womit, in der Mitte wie groß, rechts wohin damit. */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2.5">
        <FileText className="h-4 w-4 shrink-0 text-primary" />
        {/* Ab etwa 1024 Pixeln Fensterbreite verschwindet der Titel: Darunter
            drängt er die beiden Aktionen rechts aus der Leiste, und welche
            Seite offen ist, sagt links ohnehin schon die Navigation. */}
        <span className="hidden shrink-0 whitespace-nowrap font-heading text-[15px] font-semibold lg:inline">
          Rechnung schreiben
        </span>

        <Select value={basisVorlage?.id ?? ''} onValueChange={setVorlageId}>
          <SelectTrigger className="h-8 w-[150px] shrink-0 text-[13px]">
            <SelectValue placeholder="Vorlage" />
          </SelectTrigger>
          <SelectContent>
            {vorlagen.map((v) => (
              <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="mx-1 h-5 w-px bg-border" />

        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Kleiner"
            onClick={() => setZoom((z) => Math.max(35, Math.round((z ?? 100) - 15)))}>
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span className="w-11 text-center text-[13px] tabular-nums text-muted-foreground">
            {zoom === null ? 'Auto' : `${zoom}%`}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Größer"
            onClick={() => setZoom((z) => Math.min(300, Math.round((z ?? 100) + 15)))}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={zoom === null ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            title="Ins Fenster einpassen"
            onClick={() => setZoom((z) => (z === null ? 100 : null))}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* In schmalen Fenstern schrumpfen die Beschriftungen auf ein Wort.
            Beide Wege müssen sichtbar bleiben – vorher schob sich „Als Beleg
            buchen", also ausgerechnet die Hauptaktion, aus der Leiste heraus. */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button variant="outline" className="gap-1.5" onClick={alsPdfSpeichern} disabled={arbeitet !== null}>
            <FileDown className="h-4 w-4" />
            {arbeitet === 'pdf' ? 'Speichere…' : (
              <>
                <span className="hidden xl:inline">Als PDF speichern</span>
                <span className="xl:hidden">PDF</span>
              </>
            )}
          </Button>
          <Button className="gap-1.5" onClick={alsBelegBuchen} disabled={arbeitet !== null}>
            <Save className="h-4 w-4" />
            {arbeitet === 'beleg' ? 'Moment…' : (
              <>
                <span className="hidden xl:inline">Als Beleg buchen</span>
                <span className="xl:hidden">Buchen</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <div ref={teiler.rahmenRef} className="flex min-h-0 flex-1">
        {/* ── Eingabe ── */}
        <div
          data-tutorial="write-invoice-sidebar"
          style={{ width: teiler.breite }}
          className="shrink-0 space-y-3 overflow-y-auto p-4"
        >
          <Abschnitt
            titel="Empfänger"
            offen={offen.empfaenger}
            umschalten={() => umschalten('empfaenger')}
            kurzfassung={feld.receiver_name || 'Noch niemand'}
          >
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setKundenOffen(true)}>
                <Users className="h-3.5 w-3.5" />
                Aus Kunden wählen
              </Button>
              <span className="text-[13px] text-muted-foreground">oder frei eintragen</span>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input
                value={feld.receiver_name ?? ''}
                onChange={(e) => setzeFeld('receiver_name', e.target.value)}
                placeholder="Firma oder Person"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Anschrift</Label>
              <textarea
                rows={3}
                value={feld.receiver_address ?? ''}
                onChange={(e) => setzeFeld('receiver_address', e.target.value)}
                placeholder={'Straße und Hausnummer\nPLZ Ort'}
                className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Kundennummer</Label>
              <Input
                value={feld.customer_number ?? ''}
                onChange={(e) => setzeFeld('customer_number', e.target.value)}
                placeholder="optional"
                className="h-9"
              />
            </div>
          </Abschnitt>

          <Abschnitt
            titel="Eckdaten"
            offen={offen.eckdaten}
            umschalten={() => umschalten('eckdaten')}
            kurzfassung={[feld.doc_number, feld.doc_date].filter(Boolean).join(' · ') || 'Ohne Nummer'}
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Rechnungsnummer</Label>
                <Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-[11px] text-primary" onClick={nummerVorschlagen}>
                  <Wand2 className="h-3 w-3" />
                  Vorschlagen
                </Button>
              </div>
              <Input
                value={feld.doc_number ?? ''}
                onChange={(e) => setzeFeld('doc_number', e.target.value)}
                placeholder="R-2026-001"
                className="h-9"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['doc_date', 'Datum'],
                ['delivery_date', 'Leistung'],
                ['due_date', 'Fällig bis'],
              ] as const).map(([schluessel, beschriftung]) => (
                <div key={schluessel} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{beschriftung}</Label>
                  <Input
                    value={feld[schluessel] ?? ''}
                    onChange={(e) => setzeFeld(schluessel, e.target.value)}
                    placeholder="TT.MM.JJJJ"
                    className="h-9"
                  />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Der Leistungszeitpunkt ist Pflicht (§ 14 Abs. 4 UStG). Ein Zeitraum wie „März 2026" ist erlaubt.
            </p>
          </Abschnitt>

          <Abschnitt
            titel="Positionen"
            anker="write-invoice-items"
            offen={offen.positionen}
            umschalten={() => umschalten('positionen')}
            kurzfassung={`${positionen.length} · ${euro(summen.brutto)}`}
          >
            <div>
              <div className={cn(RASTER, 'border-b border-border px-1 pb-1.5 text-[11px] font-medium text-muted-foreground')}>
                <span />
                {/* `truncate` an jeder Beschriftung: In einem schmalen Fenster
                    schrumpft die Beschreibungsspalte, und ohne Beschnitt lief
                    ihr Titel sichtbar in den der Mengenspalte hinein. */}
                <span className="truncate">Beschreibung</span>
                <span className="truncate text-right">Menge</span>
                <span className="truncate text-center">Einheit</span>
                {/* „Preis" statt „Einzelpreis": Der lange Titel passte nicht über
                    die Spalte und wurde beschnitten – neben „Betrag" ist ohnehin
                    klar, welcher Preis gemeint ist. */}
                <span className="truncate text-right">Preis</span>
                <span className="truncate text-right">Rabatt</span>
                <span className="truncate text-right">Betrag</span>
                <span />
              </div>

              <div ref={tabelleRef}>
                <DndContext sensors={sensoren} collisionDetection={closestCenter} onDragEnd={beimZiehen}>
                  <SortableContext items={positionen.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                    {positionen.map((p, i) => (
                      <PositionsZeile
                        key={p.id}
                        position={p}
                        nummer={i + 1}
                        aendern={(patch) => positionAendern(p.id, patch)}
                        loeschen={() => positionLoeschen(p.id)}
                        tasten={zellenTasten}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => positionAnhaengen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Zeile hinzufügen
              </Button>
              <span className="text-[11px] text-muted-foreground">
                Eingabetaste springt weiter, Tabulator am Ende legt eine Zeile an.
              </span>
            </div>

            {/* Summenblock – rechtsbündig, so wie er auch auf dem Blatt steht. */}
            <div className="flex justify-end pt-1">
              <div className="w-[260px] space-y-1.5 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Zwischensumme</span>
                  <span className="tabular-nums">{euro(zwischensumme)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    Nachlass
                    <ZahlFeld wert={nachlass} onWert={setNachlass} placeholder="0" className="h-7 w-12 text-right text-[13px]" />
                    %
                  </span>
                  <span className="tabular-nums">{summen.rabatt > 0 ? `− ${euro(summen.rabatt)}` : '–'}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  {steuerwahl}
                  <span className="tabular-nums">{euro(summen.steuer)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-1.5 text-[15px] font-semibold">
                  <span>Gesamt</span>
                  <span className="tabular-nums">{euro(summen.brutto)}</span>
                </div>
              </div>
            </div>
          </Abschnitt>

          <Abschnitt
            titel="Texte"
            offen={offen.texte}
            umschalten={() => umschalten('texte')}
            kurzfassung={feld.subject || (feld.notes ? 'Anschreiben gesetzt' : 'Ohne Anschreiben')}
          >
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Betreff</Label>
              <Input
                value={feld.subject ?? ''}
                onChange={(e) => setzeFeld('subject', e.target.value)}
                placeholder={betreffVorgabe || 'Rechnung'}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Anschreiben</Label>
              <textarea
                rows={3}
                value={feld.notes ?? ''}
                onChange={(e) => setzeFeld('notes', e.target.value)}
                placeholder="Vielen Dank für den Auftrag. Wie besprochen berechne ich …"
                className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Zahlungsbedingungen</Label>
              <Input
                value={feld.payment_terms ?? ''}
                onChange={(e) => setzeFeld('payment_terms', e.target.value)}
                placeholder="Zahlbar innerhalb von 14 Tagen ohne Abzug."
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Steuerhinweis</Label>
              <textarea
                rows={2}
                value={feld.legal_notice ?? ''}
                onChange={(e) => setzeFeld('legal_notice', e.target.value)}
                placeholder="z. B. Gemäß § 19 UStG wird keine Umsatzsteuer berechnet."
                className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring"
              />
            </div>
          </Abschnitt>

          {/* Der Absender – als Hinweis, nicht als zehn Eingabefelder. */}
          <div className="flex items-center gap-2 rounded-xl bg-muted/40 px-4 py-3 text-[13px] text-muted-foreground">
            <Settings2 className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              Absender: {profil.profile_name || 'noch nicht hinterlegt'}
              {profil.profile_iban ? ` · IBAN ${profil.profile_iban.slice(0, 8)}…` : ''}
            </span>
            <Link to="/settings" className="shrink-0 text-primary hover:underline">Einstellungen</Link>
          </div>
        </div>

        {/* ── Teiler ── */}
        <div
          onMouseDown={teiler.beginnen}
          title="Aufteilung verschieben"
          className="w-1.5 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-primary/40 active:bg-primary/60"
        />

        {/* ── Vorschau ── */}
        <div className="flex min-w-0 flex-1 flex-col bg-muted/30">
          <VorschauBlatt
            seiten={seiten}
            schriftart={vorlage?.gestaltung.schriftart ?? 'Helvetica'}
            seiteIndex={aktiveSeite}
            onSeite={setSeiteIndex}
            zoom={zoom}
            rand={40}
          />
        </div>
      </div>

      {kundenwahl}
      {buchungsdialog}
    </div>
  );
}

// ─── Vorschaufläche mit Blätterleiste ────────────────────────────────────────

function VorschauBlatt({
  seiten, schriftart, seiteIndex, onSeite, zoom = null, rand,
}: {
  seiten: Seite[];
  schriftart: string;
  seiteIndex: number;
  onSeite: (i: number) => void;
  /** Prozent, oder null zum Einpassen. */
  zoom?: number | null;
  rand: number;
}) {
  const { knoten, setKnoten, passend } = useBlattBreite(rand);
  const isMobile = useIsMobile();

  // Am Handy steht keine Zoomleiste zur Verfügung – dort passt das Blatt in die
  // Breite und der Fließtext ist gut vier Pixel groß. Lesbar wird das erst
  // dadurch, dass man wie in jedem Dokumentenbetrachter mit zwei Fingern
  // hineingehen kann; ein Doppeltipper bringt einen wieder aufs ganze Blatt.
  const [fingerZoom, setFingerZoom] = useState<number | null>(null);
  const massstab = fingerZoom !== null
    ? (PIXEL_JE_MM * fingerZoom) / 100
    : zoom === null ? passend : (PIXEL_JE_MM * zoom) / 100;

  const doppeltippen = useCallback(() => {
    setFingerZoom((v) => (v === null ? 100 : null));
  }, []);

  useKneifzoom({
    knoten,
    massstab,
    prozent: Math.round((massstab / PIXEL_JE_MM) * 100),
    setzeProzent: setFingerZoom,
    aufDoppeltippen: doppeltippen,
    min: 25,
    max: 300,
    aktiv: isMobile,
  });

  const gezeigt = seiten.length > 0 ? [seiten[Math.min(seiteIndex, seiten.length - 1)]] : [];

  return (
    <>
      {/* Der Innenabstand ist die Hälfte des Randes, den die Einpassung
          abzieht – so bleibt links und rechts genau so viel Luft, wie
          gerechnet wurde, und das Blatt scrollt nicht seitwärts. */}
      <div
        ref={setKnoten}
        className="min-h-0 flex-1 overflow-auto"
        style={{ padding: rand / 2, ...(isMobile ? { touchAction: 'pan-x pan-y' as const } : null) }}
      >
        <Blattvorschau seiten={gezeigt} schriftart={schriftart} massstab={massstab} />
      </div>
      {seiten.length > 1 && (
        <div className="flex shrink-0 items-center justify-center gap-2 border-t border-border bg-background/80 py-1.5">
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={seiteIndex === 0}
            onClick={() => onSeite(Math.max(0, seiteIndex - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Badge variant="secondary" className="tabular-nums">
            Seite {seiteIndex + 1} von {seiten.length}
          </Badge>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={seiteIndex >= seiten.length - 1}
            onClick={() => onSeite(Math.min(seiten.length - 1, seiteIndex + 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </>
  );
}
