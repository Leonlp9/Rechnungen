// Dashboard für das Handy – inklusive Editor.
//
// Statt Drag & Drop (auf dem Touchscreen unzuverlässig) wird hier per
// Antippen gebaut: Element hinzufügen, hoch/runter schieben, Breite
// umschalten, löschen. Das Layout liegt getrennt vom Desktop-Layout im
// dashboardStore und ist damit frei anpassbar.

import { useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  Plus,
  Check,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Search,
  RotateCcw,
  BookOpen,
  Pencil,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useSheetDrag, SheetGrabber } from '@/components/ui/sheet-drag';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { DashboardNode, ElementType, NodeType } from '@/types/dashboard';
import { genId, isGridType } from '@/types/dashboard';
import { DashboardElementNode, ELEMENT_LABELS } from './DashboardElementNode';
import { DashboardErrorBoundary } from './DashboardErrorBoundary';
import { WIDGET_ITEMS, itemsFor } from './elementCatalog';
import { useAppStore } from '@/store';

// ─── Normalisiertes Mobile-Modell ────────────────────────────────────────────
//
// Auf dem Handy ist jede Seite einfach eine Liste von Widgets mit halber oder
// voller Breite. Beliebige (auch vom Desktop stammende) Layouts werden in
// dieses Modell überführt – so kann nie ein unbedienbarer Zustand entstehen.

export interface MobileItem {
  id: string;
  type: ElementType;
  /** 1 = halbe Breite, 2 = volle Breite */
  span: 1 | 2;
}

export interface MobilePage {
  id: string;
  label: string;
  items: MobileItem[];
}

function collectItems(node: DashboardNode, out: MobileItem[]): void {
  if (!isGridType(node.type)) {
    const span = node.props?.colSpan === 1 ? 1 : 2;
    out.push({ id: node.id, type: node.type as ElementType, span: span as 1 | 2 });
    return;
  }
  for (const c of node.children ?? []) collectItems(c, out);
  for (const p of node.pages ?? []) for (const c of p.children) collectItems(c, out);
}

export function toPages(root: DashboardNode): MobilePage[] {
  if (root.type === 'grid-pages' && root.pages?.length) {
    return root.pages.map((p) => {
      const items: MobileItem[] = [];
      for (const c of p.children) collectItems(c, items);
      return { id: p.id, label: p.label, items };
    });
  }
  const items: MobileItem[] = [];
  collectItems(root, items);
  return [{ id: 'mpage1', label: 'Übersicht', items }];
}

export function fromPages(pages: MobilePage[]): DashboardNode {
  return {
    id: 'mroot',
    type: 'grid-pages',
    pages: pages.map((p) => ({
      id: p.id,
      label: p.label,
      children: [
        {
          id: `${p.id}-bento`,
          type: 'grid-bento',
          props: { columns: 2 },
          children: p.items.map((it) => ({
            id: it.id,
            type: it.type as NodeType,
            props: { colSpan: it.span },
          })),
        },
      ],
    })),
  };
}

/**
 * Nächstgelegener waagerecht scrollbarer Vorfahre. Wird gebraucht, damit ein
 * Wisch in einer breiten Tabelle (z. B. „Letzte 10 Belege") diese scrollt und
 * nicht die Seite umblättert.
 */
function findXScroller(from: EventTarget | null, root: HTMLElement): HTMLElement | null {
  let el = from instanceof HTMLElement ? from : null;
  while (el) {
    const cs = getComputedStyle(el);
    const scrollable = cs.overflowX === 'auto' || cs.overflowX === 'scroll';
    if (scrollable && el.scrollWidth > el.clientWidth + 1) return el;
    if (el === root) break;
    el = el.parentElement;
  }
  return null;
}

/**
 * Abstand zwischen zwei Seiten beim Wischen (px). Muss exakt mit dem Versatz
 * der Nachbarseiten übereinstimmen – sonst blättert die Spur um genau diese
 * Differenz zu kurz und ruckt beim Einrasten nach.
 */
const PAGE_GAP = 12;

/** KPIs passen zu zweit nebeneinander, alles andere braucht die volle Breite. */
function defaultSpan(type: NodeType): 1 | 2 {
  return type.startsWith('kpi-') ? 1 : 2;
}

// ─── Hauptkomponente ─────────────────────────────────────────────────────────

interface Props {
  layout: DashboardNode;
  onChange: (layout: DashboardNode) => void;
  onReset: () => void;
  editMode: boolean;
  onEditModeChange: (v: boolean) => void;
}

export function MobileDashboard({ layout, onChange, onReset, editMode, onEditModeChange }: Props) {
  const pages = useMemo(() => toPages(layout), [layout]);
  const [activePageId, setActivePageId] = useState<string>(() => pages[0]?.id ?? 'mpage1');
  const [pickerOpen, setPickerOpen] = useState(false);
  /**
   * Nachbarseiten werden erst gerendert, sobald der Finger die Fläche berührt.
   * Dauerhaft alle drei Seiten mit ihren Diagrammen zu rendern wäre auf dem
   * Handy zu teuer – so entsteht der Aufwand nur beim tatsächlichen Wischen.
   */
  const [armed, setArmed] = useState(false);
  const [pagesOpen, setPagesOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const activeIdx = Math.max(0, pages.findIndex((p) => p.id === activePageId));
  const activePage = pages[activeIdx] ?? pages[0];

  const trackRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dotsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const labelRef = useRef<HTMLSpanElement | null>(null);

  /**
   * Punkte und Beschriftung laufen mit der Ziehbewegung mit – anteilig zum
   * bereits zurückgelegten Weg. Sprangen sie erst beim Umschalten um, wirkte
   * der Wechsel träge, obwohl die Seite längst mitging.
   */
  const paintDots = (progress: number, dir: 1 | -1) => {
    const target = activeIdx + dir;
    const t = Math.max(0, Math.min(1, progress));
    dotsRef.current.forEach((el, i) => {
      if (!el) return;
      const weight = i === activeIdx ? 1 - t : i === target ? t : 0;
      el.style.width = `${6 + 10 * weight}px`;
      const fill = el.firstElementChild as HTMLElement | null;
      if (fill) fill.style.opacity = String(weight);
    });
    if (labelRef.current) {
      const shown = t > 0.5 && pages[target] ? pages[target] : activePage;
      if (labelRef.current.textContent !== shown?.label) {
        labelRef.current.textContent = shown?.label ?? '';
      }
    }
  };

  /**
   * Index wird übergeben statt aus dem Closure gelesen: Nach dem Seitentausch
   * kennt diese Funktion sonst noch den ALTEN aktiven Index und setzt die
   * Punkte auf die falsche Seite zurück.
   */
  const resetDots = (index: number) => {
    dotsRef.current.forEach((el, i) => {
      if (!el) return;
      el.style.width = i === index ? '16px' : '6px';
      const fill = el.firstElementChild as HTMLElement | null;
      if (fill) fill.style.opacity = i === index ? '1' : '0';
    });
    if (labelRef.current) labelRef.current.textContent = pages[index]?.label ?? '';
  };

  /** Aufräumen einer laufenden Gleitbewegung – bricht sie sauber ab. */
  const settleCleanup = useRef<(() => void) | null>(null);
  const clearSettle = () => {
    settleCleanup.current?.();
    settleCleanup.current = null;
  };

  /** Spur ohne Übergang an eine Position setzen. */
  const setTrack = (x: number, animate: boolean) => {
    const el = trackRef.current;
    if (!el) return;
    el.style.transition = animate ? 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)' : 'none';
    el.style.transform = x === 0 ? '' : `translateX(${x}px)`;
  };

  /**
   * Spur animiert verschieben und den Abschluss ans ECHTE Animationsende
   * hängen – nicht an einen Timer. Mit `setTimeout(300)` war die Bewegung bei
   * dieser Kurve noch rund 20 px vom Ziel entfernt, wenn die Seite getauscht
   * wurde: genau das sichtbare Nachrucken beim Einrasten.
   */
  const glideTo = (x: number, done: () => void, dotTarget?: { progress: number; dir: 1 | -1 }) => {
    const el = trackRef.current;
    if (!el) { done(); return; }
    // Punkte in derselben Dauer nachziehen wie die Seite
    if (dotTarget) {
      dotsRef.current.forEach((d) => {
        if (!d) return;
        d.style.transition = 'width 300ms cubic-bezier(0.32, 0.72, 0, 1)';
        const fill = d.firstElementChild as HTMLElement | null;
        if (fill) fill.style.transition = 'opacity 300ms linear';
      });
      paintDots(dotTarget.progress, dotTarget.dir);
    }
    let fallback = 0;
    const finish = () => { cleanup(); done(); };
    const onEnd = (ev: TransitionEvent) => {
      if (ev.target !== el || ev.propertyName !== 'transform') return;
      finish();
    };
    const cleanup = () => {
      el.removeEventListener('transitionend', onEnd);
      window.clearTimeout(fallback);
      settleCleanup.current = null;
      dotsRef.current.forEach((d) => {
        if (!d) return;
        d.style.transition = '';
        const fill = d.firstElementChild as HTMLElement | null;
        if (fill) fill.style.transition = '';
      });
    };
    el.addEventListener('transitionend', onEnd);
    // Sicherheitsnetz, falls transitionend ausbleibt (z. B. kein Positionswechsel)
    fallback = window.setTimeout(finish, 500);
    settleCleanup.current = cleanup;

    // Bewusst KEINE Höhen-Animation: Die Nachbarseite misst absolut
    // positioniert eine andere Höhe als später im Fluss (Diagramme mit
    // prozentualer Höhe). Der Übergang liefe dadurch auf einen falschen Wert
    // und ruckte am Ende – ohne Animation ist es ruhiger.

    setTrack(x, true);
  };

  /**
   * Seitenwechsel abschließen: erst die neue Seite einhängen, DANN die Spur
   * zurücksetzen. Andersherum stand für einen Frame die alte Seite auf
   * Position 0 – das war das sichtbare Verrutschen beim Einrasten.
   */
  const finishSwitch = (index: number) => {
    flushSync(() => setActivePageId(pages[index].id));
    setTrack(0, false);
    setArmed(false);
    resetDots(index);
  };

  /** Seite wechseln – mit Gleitbewegung in die jeweilige Richtung. */
  const goToPage = (index: number) => {
    if (index < 0 || index >= pages.length || index === activeIdx) return;
    clearSettle();
    const travel = (trackRef.current?.offsetWidth ?? 0) + PAGE_GAP;
    const dir = index > activeIdx ? 1 : -1;
    setArmed(true);
    // Erst im nächsten Frame schieben, damit die Nachbarseite schon steht.
    requestAnimationFrame(() => glideTo(-dir * travel, () => finishSwitch(index), { progress: 1, dir }));
  };

  const commit = (next: MobilePage[]) => onChange(fromPages(next));

  const updateActive = (fn: (p: MobilePage) => MobilePage) =>
    commit(pages.map((p, i) => (i === activeIdx ? fn(p) : p)));

  const addItem = (type: NodeType) => {
    updateActive((p) => ({
      ...p,
      items: [...p.items, { id: genId(), type: type as ElementType, span: defaultSpan(type) }],
    }));
  };

  const removeItem = (id: string) =>
    updateActive((p) => ({ ...p, items: p.items.filter((i) => i.id !== id) }));

  const moveItem = (id: string, dir: -1 | 1) =>
    updateActive((p) => {
      const idx = p.items.findIndex((i) => i.id === id);
      const target = idx + dir;
      if (idx === -1 || target < 0 || target >= p.items.length) return p;
      const items = [...p.items];
      [items[idx], items[target]] = [items[target], items[idx]];
      return { ...p, items };
    });

  const toggleSpan = (id: string) =>
    updateActive((p) => ({
      ...p,
      items: p.items.map((i) => (i.id === id ? { ...i, span: i.span === 2 ? 1 : 2 } : i)),
    }));

  // Seitenwechsel per Wischen – die Seite hängt dabei direkt am Finger.
  // Erst beim Loslassen wird entschieden, ob umgeblättert oder zurückgefedert
  // wird. Ob überhaupt gewischt wird, entscheidet sich nach den ersten Pixeln:
  // waagerecht → blättern, senkrecht → normal scrollen lassen.
  const swipe = useRef({ x: 0, y: 0, dx: 0, active: false, decided: false, horizontal: false, t: 0, v: 0 });

  const onSwipeStart = (e: React.TouchEvent) => {
    if (editMode || pages.length < 2 || e.touches.length !== 1) return;
    // Einen noch laufenden Nachlauf abbrechen – sonst blendete sein Timer
    // die Nachbarseiten mitten in der neuen Geste aus und man zog ins Leere.
    clearSettle();
    const t = e.touches[0];
    swipe.current = { x: t.clientX, y: t.clientY, dx: 0, active: true, decided: false, horizontal: false, t: e.timeStamp, v: 0 };
    setArmed(true);
    setTrack(0, false);
  };

  const onSwipeMove = (e: React.TouchEvent) => {
    const d = swipe.current;
    if (!d.active || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - d.x;
    const dy = t.clientY - d.y;

    if (!d.decided) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      d.decided = true;
      d.horizontal = Math.abs(dx) > Math.abs(dy) * 1.2;
      if (!d.horizontal) { d.active = false; setArmed(false); return; }

      // Liegt darunter etwas waagerecht Scrollbares, das in diese Richtung
      // noch Weg hat, gehört die Geste dorthin – erst am Anschlag übernimmt
      // die Seite. Genauso verhält sich iOS bei verschachtelten Bereichen.
      const scroller = findXScroller(e.target, e.currentTarget as HTMLElement);
      if (scroller) {
        const restLinks = scroller.scrollLeft > 1;
        const restRechts = scroller.scrollLeft < scroller.scrollWidth - scroller.clientWidth - 1;
        if ((dx < 0 && restRechts) || (dx > 0 && restLinks)) {
          d.active = false;
          setArmed(false);
          return;
        }
      }
    }

    // An den Rändern zäher ziehen, damit spürbar ist, dass es nicht weitergeht
    const atEdge = (dx > 0 && activeIdx === 0) || (dx < 0 && activeIdx === pages.length - 1);
    const eased = atEdge ? dx / 3 : dx;
    const dt = Math.max(e.timeStamp - d.t, 8);
    d.v = d.v * 0.6 + ((dx - d.dx) / dt) * 0.4;
    d.dx = dx;
    d.t = e.timeStamp;
    setTrack(eased, false);

    const width = trackRef.current?.offsetWidth ?? 1;
    paintDots(Math.abs(eased) / (width + PAGE_GAP), dx < 0 ? 1 : -1);
  };

  const onSwipeEnd = () => {
    const d = swipe.current;
    if (!d.active) { setArmed(false); return; }
    d.active = false;
    const width = trackRef.current?.offsetWidth ?? 1;
    const travel = width + PAGE_GAP;
    const far = Math.abs(d.dx) > width * 0.28;
    const fast = Math.abs(d.v) > 0.4 && Math.abs(d.dx) > 24;
    const dir = d.dx < 0 ? 1 : -1;
    const target = activeIdx + dir;

    clearSettle();
    if ((far || fast) && target >= 0 && target < pages.length) {
      glideTo(-dir * travel, () => finishSwitch(target), { progress: 1, dir });
    } else {
      glideTo(0, () => setArmed(false), { progress: 0, dir });
    }
  };

  /** Widgets einer Seite – wird beim Wechsel für zwei Seiten gleichzeitig gebraucht. */
  const renderPage = (page: MobilePage) => (
    <div className="grid grid-cols-2 gap-3">
          {page.items.map((item, idx) => (
            <div
              key={item.id}
              className={cn('flex min-w-0 flex-col', item.span === 2 ? 'col-span-2' : 'col-span-1')}
            >
              {editMode && (
                <div className="mb-1 flex items-center gap-0.5 rounded-t-lg bg-muted/60 px-1.5 py-1">
                  <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-muted-foreground">
                    {ELEMENT_LABELS[item.type as keyof typeof ELEMENT_LABELS] ?? item.type}
                  </span>
                  <IconBtn label="Nach oben" disabled={idx === 0} onClick={() => moveItem(item.id, -1)}>
                    <ChevronUp className="h-3.5 w-3.5" />
                  </IconBtn>
                  <IconBtn
                    label="Nach unten"
                    disabled={idx === page.items.length - 1}
                    onClick={() => moveItem(item.id, 1)}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </IconBtn>
                  <IconBtn
                    label={item.span === 2 ? 'Halbe Breite' : 'Volle Breite'}
                    onClick={() => toggleSpan(item.id)}
                  >
                    {item.span === 2 ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  </IconBtn>
                  <IconBtn label="Entfernen" destructive onClick={() => removeItem(item.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconBtn>
                </div>
              )}
              <div className={cn('flex min-h-0 flex-1 flex-col', editMode && 'pointer-events-none')}>
                <DashboardErrorBoundary
                  widgetName={ELEMENT_LABELS[item.type as keyof typeof ELEMENT_LABELS] ?? item.type}
                >
                  <DashboardElementNode type={item.type} />
                </DashboardErrorBoundary>
              </div>
            </div>
          ))}
    </div>
  );

  return (
    <div className="space-y-3">
      {/* ── Seitenwechsel ──
          Im Ansichtsmodus wie auf dem iOS-Homescreen: seitlich wischen, Punkte
          zeigen die Position. Im Bearbeitungsmodus bleiben die benannten
          Pillen, weil man dort gezielt eine Seite ansteuert. */}
      {editMode ? (
        <div className="-mx-3 flex items-center gap-1 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {pages.map((p) => (
            <button
              key={p.id}
              onClick={() => setActivePageId(p.id)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                p.id === activePage?.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-muted/40 text-muted-foreground',
              )}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setPagesOpen(true)}
            className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground"
          >
            <BookOpen className="h-3 w-3" /> Seiten
          </button>
        </div>
      ) : (
        pages.length > 1 && (
          // Pfeile links und rechts machen sichtbar, dass es weitere Seiten
          // gibt – die Punkte allein verraten nicht, dass man wischen kann.
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={() => goToPage(activeIdx - 1)}
              disabled={activeIdx === 0}
              aria-label="Vorherige Seite"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground disabled:opacity-25"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="flex min-w-0 items-center gap-2 px-1">
              {/* Titel antippen öffnet die Liste aller Seiten – schneller als
                  sich durchzuwischen, wenn es mehr als zwei sind. */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex min-w-0 items-center gap-1 text-[13px] font-medium">
                    <span ref={labelRef} className="truncate">{activePage?.label}</span>
                    <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="min-w-44">
                  {pages.map((p, i) => (
                    <DropdownMenuCheckboxItem
                      key={p.id}
                      checked={p.id === activePage?.id}
                      onCheckedChange={() => goToPage(i)}
                    >
                      {p.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="flex shrink-0 items-center gap-1.5">
                {pages.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => goToPage(i)}
                    aria-label={`Seite ${i + 1}: ${p.label}`}
                    className="relative h-1.5 overflow-hidden rounded-full bg-muted-foreground/35"
                    style={{ width: i === activeIdx ? 16 : 6 }}
                    ref={(el) => { dotsRef.current[i] = el as unknown as HTMLSpanElement | null; }}
                  >
                    <span
                      className="absolute inset-0 rounded-full bg-primary"
                      style={{ opacity: i === activeIdx ? 1 : 0 }}
                    />
                  </button>
                ))}
              </span>
            </span>
            <button
              onClick={() => goToPage(activeIdx + 1)}
              disabled={activeIdx === pages.length - 1}
              aria-label="Nächste Seite"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground disabled:opacity-25"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )
      )}

      {/* ── Editor-Leiste ── */}
      {editMode && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-2">
          <Button size="sm" className="h-8 gap-1.5" onClick={() => setPickerOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Element
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setPagesOpen(true)}>
            <BookOpen className="h-3.5 w-3.5" /> Seiten
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-destructive"
            onClick={() => setConfirmReset(true)}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Zurücksetzen
          </Button>
          <Button size="sm" variant="secondary" className="ml-auto h-8 gap-1.5" onClick={() => onEditModeChange(false)}>
            <Check className="h-3.5 w-3.5" /> Fertig
          </Button>
        </div>
      )}

      {/* ── Widgets ── */}
      {activePage && activePage.items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
          <SlidersHorizontal className="h-8 w-8 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium">Diese Seite ist leer</p>
            <p className="text-xs text-muted-foreground">Füge Kennzahlen, Charts oder Listen hinzu.</p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              onEditModeChange(true);
              setPickerOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Element hinzufügen
          </Button>
        </div>
      ) : (
        <div
          data-dashboard-pages
          className="relative overflow-hidden"
          onTouchStart={onSwipeStart}
          onTouchMove={onSwipeMove}
          onTouchEnd={onSwipeEnd}
          onTouchCancel={onSwipeEnd}
        >
          {/* Die aktive Seite steht im Fluss und bestimmt die Höhe; die
              Nachbarn liegen absolut daneben, damit sie die Höhe nicht
              verändern. Alle drei bewegen sich mit der Spur. */}
          <div ref={frameRef} className="relative">
          <div ref={trackRef} className="relative will-change-transform">
            {armed && pages[activeIdx - 1] && (
              <div
                data-page="prev"
                className="pointer-events-none absolute inset-x-0 top-0"
                style={{ transform: `translateX(calc(-100% - ${PAGE_GAP}px))` }}
              >
                {renderPage(pages[activeIdx - 1])}
              </div>
            )}
            {renderPage(activePage)}
            {armed && pages[activeIdx + 1] && (
              <div
                data-page="next"
                className="pointer-events-none absolute inset-x-0 top-0"
                style={{ transform: `translateX(calc(100% + ${PAGE_GAP}px))` }}
              >
                {renderPage(pages[activeIdx + 1])}
              </div>
            )}
          </div>
          </div>
        </div>
      )}

      {/* ── Anpassen ganz unten ──
          Oben ist der Platz knapp; hier unten stört der Knopf niemanden und
          ist trotzdem auffindbar. Beim Öffnen scrollt die Seite nach oben,
          weil die Bearbeitungsleiste dort erscheint. */}
      {!editMode && (
        <Button
          variant="outline"
          className="mt-2 w-full gap-2"
          onClick={() => {
            onEditModeChange(true);
            document.querySelector('[data-app-main]')?.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Dashboard anpassen
        </Button>
      )}

      {/* ── Element-Picker ── */}
      <ElementPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(type) => addItem(type)}
      />

      {/* ── Seiten-Verwaltung ── */}
      <PageManager
        open={pagesOpen}
        onClose={() => setPagesOpen(false)}
        pages={pages}
        activePageId={activePage?.id ?? ''}
        onSelect={(id) => setActivePageId(id)}
        onChange={(next, focusId) => {
          commit(next);
          if (focusId) setActivePageId(focusId);
        }}
      />

      <ConfirmDialog
        open={confirmReset}
        title="Handy-Dashboard zurücksetzen?"
        description="Das Layout auf dem Handy wird auf die Standardansicht zurückgesetzt. Das Desktop-Dashboard bleibt unverändert."
        confirmLabel="Zurücksetzen"
        cancelLabel="Abbrechen"
        destructive
        onConfirm={() => {
          onReset();
          setConfirmReset(false);
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}

// ─── Kleine Icon-Schaltfläche in der Widget-Kopfzeile ────────────────────────

function IconBtn({
  children,
  onClick,
  disabled,
  destructive,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors active:bg-background',
        disabled ? 'text-muted-foreground/30' : destructive ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {children}
    </button>
  );
}

// ─── Element-Picker (Bottom-Sheet) ───────────────────────────────────────────

function ElementPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (type: NodeType) => void;
}) {
  const [search, setSearch] = useState('');
  const [added, setAdded] = useState<string | null>(null);
  const { contentRef, onGrabberMouseDown } = useSheetDrag(onClose);
  const rechtsform = useAppStore((s) => s.rechtsform);

  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const verfuegbar = itemsFor(rechtsform, WIDGET_ITEMS);
    const filtered = q
      ? verfuegbar.filter(
          (i) =>
            i.label.toLowerCase().includes(q) ||
            i.description?.toLowerCase().includes(q) ||
            i.section.toLowerCase().includes(q),
        )
      : verfuegbar;
    const map = new Map<string, typeof WIDGET_ITEMS>();
    for (const item of filtered) {
      if (!map.has(item.section)) map.set(item.section, []);
      map.get(item.section)!.push(item);
    }
    return [...map.entries()];
  }, [search, rechtsform]);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        ref={contentRef}
        side="bottom"
        showCloseButton={false}
        aria-describedby={undefined}
        className="max-h-[85dvh] gap-0 rounded-t-2xl p-0"
      >
        <SheetTitle className="sr-only">Element hinzufügen</SheetTitle>
        <SheetGrabber onMouseDown={onGrabberMouseDown} />
        <div className="flex items-center gap-2 border-b px-4 pt-1 pb-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Element suchen …"
              className="h-9 pl-8"
            />
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Schließen">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div
          className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
        >
          {sections.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Nichts gefunden.</p>
          )}
          {sections.map(([section, items]) => (
            <div key={section} className="space-y-1.5">
              <p className="px-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                {section}
              </p>
              <div className="overflow-hidden rounded-xl border">
                {items.map((item, idx) => (
                  <button
                    key={item.type}
                    onClick={() => {
                      onPick(item.type);
                      setAdded(item.type);
                      setTimeout(() => setAdded(null), 900);
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors active:bg-muted',
                      idx > 0 && 'border-t',
                    )}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.label}</span>
                      {item.description && (
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {item.description}
                        </span>
                      )}
                    </span>
                    {added === item.type ? (
                      <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Seiten-Verwaltung (Bottom-Sheet) ────────────────────────────────────────

function PageManager({
  open,
  onClose,
  pages,
  activePageId,
  onSelect,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  pages: MobilePage[];
  activePageId: string;
  onSelect: (id: string) => void;
  onChange: (pages: MobilePage[], focusId?: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const { contentRef, onGrabberMouseDown } = useSheetDrag(onClose);

  const rename = (id: string, label: string) =>
    onChange(pages.map((p) => (p.id === id ? { ...p, label } : p)));

  const move = (id: string, dir: -1 | 1) => {
    const idx = pages.findIndex((p) => p.id === id);
    const target = idx + dir;
    if (idx === -1 || target < 0 || target >= pages.length) return;
    const next = [...pages];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const addPage = () => {
    const id = genId();
    onChange([...pages, { id, label: `Seite ${pages.length + 1}`, items: [] }], id);
  };

  const deletePage = (id: string) => {
    const next = pages.filter((p) => p.id !== id);
    onChange(next.length ? next : [{ id: genId(), label: 'Übersicht', items: [] }], next[0]?.id);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <SheetContent
          ref={contentRef}
          side="bottom"
          showCloseButton={false}
          aria-describedby={undefined}
          className="max-h-[80dvh] gap-0 rounded-t-2xl p-0"
        >
          <SheetGrabber onMouseDown={onGrabberMouseDown} />
          <div data-sheet-grabber className="flex items-center justify-between border-b px-4 pt-1 pb-3">
            <SheetTitle className="text-sm font-semibold">Seiten verwalten</SheetTitle>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Schließen">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div
            className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-3"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
          >
            {pages.map((p, idx) => (
              <div
                key={p.id}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl border p-2',
                  p.id === activePageId && 'border-primary/40 bg-primary/5',
                )}
              >
                <Pencil className="ml-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <Input
                  value={p.label}
                  onChange={(e) => rename(p.id, e.target.value)}
                  onFocus={() => onSelect(p.id)}
                  className="h-8 flex-1 border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0"
                />
                <span className="shrink-0 pr-1 text-[10px] text-muted-foreground">
                  {p.items.length}
                </span>
                <IconBtn label="Nach oben" disabled={idx === 0} onClick={() => move(p.id, -1)}>
                  <ChevronUp className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn label="Nach unten" disabled={idx === pages.length - 1} onClick={() => move(p.id, 1)}>
                  <ChevronDown className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn
                  label="Seite löschen"
                  destructive
                  disabled={pages.length <= 1}
                  onClick={() => setConfirmDelete(p.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </IconBtn>
              </div>
            ))}
            <Button variant="outline" className="w-full gap-1.5" onClick={addPage}>
              <Plus className="h-4 w-4" /> Neue Seite
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Seite löschen?"
        description="Alle Elemente dieser Seite werden entfernt."
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        destructive
        onConfirm={() => {
          if (confirmDelete) deletePage(confirmDelete);
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}
