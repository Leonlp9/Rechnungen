// ─── Die Bausteinliste ───────────────────────────────────────────────────────
//
// Die Liste ist verschachtelt, seit es den Spalten-Baustein gibt: Unter einer
// Spalten-Zeile stehen eingerückt ihre Spalten, jede mit eigenem Regler für die
// Breite und eigener Bausteinliste darin.
//
// Gezogen wird nur innerhalb einer Liste. Ein Baustein von der Hauptliste in
// eine Spalte zu ziehen wäre über zwei Ebenen hinweg wacklig und am Handy kaum
// zu treffen – dafür gibt es im Menü der Zeile „In Spalte verschieben".

import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, Columns3, CornerUpLeft, GripVertical, MoreVertical, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

import { useHandy } from './Bedienelemente';

import type { Baustein, Spalte, SpaltenBaustein } from '@/types/rechnungsvorlage';
import { BAUSTEIN_BESCHREIBUNG, BAUSTEIN_LABELS, NICHT_IN_SPALTEN } from '@/types/rechnungsvorlage';
import type { Spaltenziel } from '@/lib/rechnung/baum';

export interface ListenAktionen {
  /** Welcher Baustein gerade offen ist. */
  gewaehlt: string | null;
  waehlen: (id: string | null) => void;
  schalten: (id: string, an: boolean) => void;
  loeschen: (id: string) => void;
  /** `null` holt den Baustein zurück in die Hauptliste. */
  umhaengen: (id: string, spalteId: string | null) => void;
  /** Öffnet die Auswahl „Baustein hinzufügen" für diese Liste. */
  hinzufuegen: (spalteId: string | null) => void;
  /** Ändert einen Baustein – hier gebraucht, um alle Spaltenanteile auf einmal zu setzen. */
  aendern: (id: string, patch: Partial<Baustein>) => void;
  spalteHinzufuegen: (spaltenId: string) => void;
  spalteEntfernen: (spaltenId: string, spalteId: string) => void;
  /** Alle Spalten der Vorlage – die Ziele für „In Spalte verschieben". */
  ziele: Spaltenziel[];
  /** Wie viele Spalten-Bausteine es gibt; ab zwei muss die Zeile sie benennen. */
  spaltenBausteine: number;
  /** Die Einstellungen, die am Desktop unter der Zeile aufgehen. */
  einstellungen: (b: Baustein) => React.ReactNode;
}

/** Beschriftung eines Ziels: „Spalte 2" reicht, solange es nur eine Reihe gibt. */
function zielName(ziel: Spaltenziel, mehrere: boolean): string {
  return mehrere ? `Spalten ${ziel.bausteinNummer} · Spalte ${ziel.nummer}` : `Spalte ${ziel.nummer}`;
}

// ─── Eine Zeile ──────────────────────────────────────────────────────────────

function Zeile({
  baustein, spalteId, aktionen,
}: { baustein: Baustein; spalteId: string | null; aktionen: ListenAktionen }) {
  const handy = useHandy();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: baustein.id });

  const aktiv = baustein.id === aktionen.gewaehlt;
  const aus = baustein.aus === true;
  const inSpalte = spalteId !== null;
  const darfInSpalte = !NICHT_IN_SPALTEN.includes(baustein.typ);
  const mehrereReihen = aktionen.spaltenBausteine > 1;

  const stil: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
  };

  const menue = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={handy ? 'icon' : 'icon-sm'} aria-label="Weitere Aktionen">
          <MoreVertical className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>{BAUSTEIN_LABELS[baustein.typ]}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {inSpalte && (
          <DropdownMenuItem onSelect={() => aktionen.umhaengen(baustein.id, null)}>
            <CornerUpLeft /> Aus der Spalte holen
          </DropdownMenuItem>
        )}
        {aktionen.ziele.length > 0 && (
          <>
            <DropdownMenuLabel className="text-muted-foreground">In Spalte verschieben</DropdownMenuLabel>
            {aktionen.ziele.map((ziel) => (
              <DropdownMenuItem
                key={ziel.spalteId}
                disabled={!darfInSpalte || ziel.spalteId === spalteId}
                title={darfInSpalte ? undefined : 'Dieser Baustein braucht die volle Seitenbreite.'}
                onSelect={() => aktionen.umhaengen(baustein.id, ziel.spalteId)}
              >
                <Columns3 /> {zielName(ziel, mehrereReihen)}
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => aktionen.loeschen(baustein.id)}>
          <Trash2 /> Baustein löschen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Am Handy ist die oberste Ebene eine Gruppenliste mit 56-pt-Zeilen; in einer
  // Spalte und am Desktop wird es kompakt, sonst frisst die Einrückung die
  // Zeile auf.
  const gross = handy && !inSpalte;

  const kopf = (
    <div className={cn('flex items-center', gross ? 'gap-2 pl-2 pr-2' : 'gap-1.5 px-1.5 py-1.5')}>
      <span
        {...attributes}
        {...listeners}
        aria-label="Baustein verschieben"
        className={cn(
          'flex shrink-0 cursor-grab touch-none items-center text-muted-foreground/50 active:cursor-grabbing',
          gross ? 'px-1 py-3' : 'px-0.5',
        )}
      >
        <GripVertical className={gross ? 'h-5 w-5' : 'h-4 w-4'} />
      </span>
      <button
        type="button"
        onClick={() => aktionen.waehlen(aktiv && !handy ? null : baustein.id)}
        className={cn('min-w-0 flex-1 text-left', gross ? 'py-2.5' : 'py-0.5')}
      >
        <span
          className={cn(
            'block truncate',
            gross ? 'text-[17px] leading-tight' : 'text-sm font-medium',
            aus && 'text-muted-foreground line-through',
          )}
        >
          {BAUSTEIN_LABELS[baustein.typ]}
        </span>
        <span
          className={cn(
            'mt-0.5 block truncate text-muted-foreground',
            gross ? 'text-[13px]' : 'text-[11px] leading-snug',
          )}
        >
          {BAUSTEIN_BESCHREIBUNG[baustein.typ]}
        </span>
      </button>
      {!handy && (
        <ChevronDown
          className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform', aktiv && 'rotate-180')}
        />
      )}
      <Switch checked={!aus} onCheckedChange={(an) => aktionen.schalten(baustein.id, an)} aria-label="Baustein anzeigen" />
      {menue}
    </div>
  );

  return (
    <div
      ref={setNodeRef}
      style={stil}
      className={cn(
        'overflow-hidden bg-card transition-colors',
        gross
          ? 'border-b border-border last:border-b-0'
          : cn('rounded-lg border', aktiv ? 'border-primary/50 ring-1 ring-primary/30' : 'border-border'),
      )}
    >
      {kopf}
      {aktiv && !handy && (
        <div className="border-t border-border bg-muted/30 px-2.5 py-2.5">{aktionen.einstellungen(baustein)}</div>
      )}
      {baustein.typ === 'spalten' && <Spaltenbereich b={baustein} aktionen={aktionen} />}
    </div>
  );
}

// ─── Die Spalten eines Spalten-Bausteins ─────────────────────────────────────

function Spaltenbereich({ b, aktionen }: { b: SpaltenBaustein; aktionen: ListenAktionen }) {
  const handy = useHandy();
  const gesamt = b.spalten.reduce((s, c) => s + Math.max(0.01, c.anteil), 0) || 1;
  const einzeln = b.spalten.length <= 1;

  /**
   * Der Regler zeigt den Prozentsatz, den die Spalte einnimmt, und setzt ihn
   * auch so. Die übrigen Spalten teilen sich den Rest in ihrem bisherigen
   * Verhältnis – sonst stünde der Griff bei einer Angabe wie „Anteil 1" an
   * einer Stelle, die mit den angezeigten Prozenten nichts zu tun hat.
   */
  const anteilSetzen = (index: number, prozent: number) => {
    const teil = Math.min(0.95, Math.max(0.05, prozent / 100));
    const rest = b.spalten.reduce((s, c, j) => (j === index ? s : s + Math.max(0.01, c.anteil)), 0);
    const rund = (v: number) => Math.round(v * 1000) / 1000;
    const neu: Spalte[] = b.spalten.map((s, j) => {
      if (j === index) return { ...s, anteil: rund(teil) };
      const imRest = rest > 0 ? Math.max(0.01, s.anteil) / rest : 1 / (b.spalten.length - 1);
      return { ...s, anteil: rund((1 - teil) * imRest) };
    });
    aktionen.aendern(b.id, { spalten: neu });
  };

  return (
    <div className={cn('space-y-2 border-t border-border bg-muted/30', handy ? 'p-3 pl-5' : 'p-2 pl-4')}>
      {b.spalten.map((spalte, i) => {
        const prozent = Math.round((Math.max(0.01, spalte.anteil) / gesamt) * 100);
        return (
          <div key={spalte.id} className="space-y-2 rounded-lg border border-dashed border-border bg-background/60 p-2">
            <div className="flex items-center gap-2">
              <span className={cn('font-medium', handy ? 'text-[15px]' : 'text-xs')}>Spalte {i + 1}</span>
              <span className={cn('tabular-nums text-muted-foreground', handy ? 'text-[13px]' : 'text-[11px]')}>
                {prozent} %
              </span>
              <input
                type="range"
                min={5} max={95} step={1}
                disabled={einzeln}
                value={prozent}
                aria-label={`Breite Spalte ${i + 1}`}
                onChange={(e) => anteilSetzen(i, Number(e.target.value))}
                className={cn(
                  'min-w-0 flex-1 accent-primary',
                  handy ? 'h-1.5' : 'h-1',
                  einzeln ? 'opacity-40' : 'cursor-pointer',
                )}
              />
              <Button
                variant="ghost"
                size={handy ? 'icon' : 'icon-sm'}
                aria-label={`Spalte ${i + 1} entfernen`}
                disabled={b.spalten.length <= 1}
                title={b.spalten.length <= 1 ? 'Die letzte Spalte bleibt.' : 'Inhalt wandert in die Nachbarspalte.'}
                onClick={() => aktionen.spalteEntfernen(b.id, spalte.id)}
              >
                <Trash2 className="text-muted-foreground" />
              </Button>
            </div>

            <Bausteinliste bausteine={spalte.bausteine} spalteId={spalte.id} aktionen={aktionen} />

            {spalte.bausteine.length === 0 && (
              <p className={cn('px-1 text-muted-foreground', handy ? 'text-[13px]' : 'text-[11px]')}>
                Noch leer. Ein Baustein aus der Hauptliste kommt über sein Menü hierher.
              </p>
            )}

            <Button
              variant="ghost"
              size={handy ? 'default' : 'sm'}
              className="w-full justify-start"
              onClick={() => aktionen.hinzufuegen(spalte.id)}
            >
              <Plus /> Baustein in Spalte {i + 1}
            </Button>
          </div>
        );
      })}

      <Button
        variant="outline"
        size={handy ? 'default' : 'sm'}
        className="w-full"
        onClick={() => aktionen.spalteHinzufuegen(b.id)}
      >
        <Plus /> Spalte hinzufügen
      </Button>
    </div>
  );
}

// ─── Die Liste selbst ────────────────────────────────────────────────────────

export function Bausteinliste({
  bausteine, spalteId, aktionen,
}: { bausteine: Baustein[]; spalteId: string | null; aktionen: ListenAktionen }) {
  const handy = useHandy();
  const oberste = spalteId === null;

  return (
    <SortableContext items={bausteine.map((b) => b.id)} strategy={verticalListSortingStrategy}>
      <div
        className={cn(
          oberste && handy && 'overflow-hidden rounded-xl bg-card',
          oberste && !handy && 'space-y-1.5',
          !oberste && 'space-y-1',
        )}
      >
        {bausteine.map((b) => (
          <Zeile key={b.id} baustein={b} spalteId={spalteId} aktionen={aktionen} />
        ))}
      </div>
    </SortableContext>
  );
}
