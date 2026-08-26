// Kopfleiste für das Handy – mit einklappbarem Titel.
//
// Sie ersetzt die frühere Navigationsleiste, die auf jeder Seite Logo, Titel
// und KI-Knopf zeigte – der Titel stand ohnehin schon als Überschrift
// darunter, das Logo kennt man vom App-Symbol, den KI-Chat gibt es im
// „Mehr"-Menü. Übrig blieben zwei nützliche Dinge: der Weg zurück und der
// Name der Seite, sobald deren große Überschrift weggescrollt ist.
//
// Die Plattformen beschriften den Weg zurück unterschiedlich, deshalb stehen
// beide Beschriftungen im Markup – welche sichtbar ist, entscheidet das Theme:
//
//   iOS      „‹ Belege"  – benannt nach dem ZIEL, zu dem es zurückgeht.
//   Android  „‹ Beleg"   – benannt nach der Seite, auf der man IST.
//
// ── Der Übergang (One UI) ────────────────────────────────────────────────
// An einem echten Gerät abgeschaut: Das ist kein Umschalten, sondern ein
// Verlauf entlang der Scrollstrecke, und die beiden Titel wechseln sich
// zeitversetzt ab – erst verschwindet der große, dann erscheint der kleine.
// Deshalb liefert diese Datei einen Fortschritt 0…1 als CSS-Variable
// (`--bar-progress`), aus dem das Theme Deckkraft und Größe ableitet.
//
// Dazu kommt das Einrasten: Es gibt genau zwei Rastpunkte – ganz offen
// (großer Titel) und eingeklappt (kleiner Titel). Dazwischen wird beim
// Loslassen zum näheren gezogen; darunter scrollt die Seite frei weiter.
// Und weil man den großen Titel selten braucht, öffnen Seiten bereits
// eingeklappt – nach oben wischen holt ihn zurück.
//
// Weiter unten bleibt schließlich nur noch der runde Knopf über dem Inhalt
// (`data-stage="floating"`).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { NAV_ITEMS } from './navItems';
import { useAppStore } from '@/store';

/**
 * Ab dieser Strecke UNTER dem eingeklappten Zustand bleibt nur der Knopf.
 * Null heißt: Am Rastpunkt selbst noch nicht, aber ab dem ersten Pixel
 * darüber hinaus sofort – so bekommt der Pfeil seine Tönung genau dann,
 * wenn Inhalt beginnt, unter ihm durchzulaufen.
 */
const FLOATING_AFTER = 0;
/** So lange nach der letzten Scrollbewegung gilt die Geste als beendet. */
const SETTLE_MS = 90;

type Stage = 'expanded' | 'compact' | 'floating';

export interface PageBar {
  /** Name der Seite, zu der es zurückgeht – null auf Seiten der Hauptnavigation */
  target: string | null;
  /** Name der aktuellen Seite */
  current: string;
}

/** Titel der aktuellen Seite und – falls es eine Unterseite ist – ihr Ziel. */
export function usePageBar(): PageBar {
  const { pathname } = useLocation();

  const exact = NAV_ITEMS.find((i) => i.to === pathname);
  if (exact) return { target: null, current: exact.label };

  const parent = NAV_ITEMS.filter((i) => i.to !== '/').find((i) => pathname.startsWith(i.to));
  const current =
    pathname.startsWith('/invoices/') ? 'Beleg'
    : pathname.startsWith('/projects/') ? 'Projekt'
    : parent?.label ?? 'Zurück';

  return { target: parent?.label ?? 'Zurück', current };
}

/** Der Kasten, in dem die Seite scrollt – entweder <main> oder ein Kind darin. */
function findScroller(main: Element): HTMLElement {
  const inner = main.querySelector<HTMLElement>('.overflow-y-auto');
  if (inner && inner.scrollHeight > inner.clientHeight + 8) return inner;
  return main as HTMLElement;
}

export interface CollapseState {
  stage: Stage;
  /** 0 = großer Titel steht, 1 = eingeklappt */
  progress: number;
  hasTitle: boolean;
}

/**
 * Verfolgt die Scrollposition und leitet daraus Fortschritt und Stufe ab.
 * Auch von Seiten genutzt, die ihre Kopfzeile selbst mitbringen
 * (Einstellungen) – so verhalten sich beide gleich.
 */
export function useCollapsingHeader(dep?: unknown): CollapseState {
  const [state, setState] = useState<CollapseState>({ stage: 'expanded', progress: 1, hasTitle: false });
  const snapEnabled = useAppStore((s) => s.theme === 'oneui');
  const smooth = useAppStore((s) => s.animations);
  const frame = useRef(0);
  const settle = useRef(0);
  const snapping = useRef(false);

  const measure = useCallback(() => {
    const main = document.querySelector('[data-app-main]');
    if (!main) return null;
    const scroller = findScroller(main);
    const header = main.querySelector<HTMLElement>('[data-page-header]');
    // Die Strecke, über die eingeklappt wird: die Höhe der großen
    // Überschrift. Ohne Überschrift gibt es nichts einzuklappen.
    // Mit großer Überschrift ist die Einklappstrecke deren Höhe. Ohne eine
    // solche (ein Beleg etwa) reicht die Höhe der Leiste: Über diese kurze
    // Strecke wandert der kleine Titel nach oben aus dem Bild, während der
    // Pfeil oben stehen bleibt.
    const wanted = header
      ? Math.max(header.offsetHeight + parseFloat(getComputedStyle(header).marginBottom || '0'), 1)
      : 44;
    // Eine kurze Seite (ein knapper Hilfeartikel) kann gar nicht so weit
    // scrollen. Dann läuft der Übergang über die Strecke, die sie hergibt –
    // sonst bliebe er auf halbem Weg stehen und der kleine Titel stünde
    // dauerhaft halb durchsichtig da.
    const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    return {
      scroller,
      distance: Math.min(wanted, maxScroll),
      hasTitle: !!header,
      /** Reicht die Seite überhaupt bis zum eingeklappten Rastpunkt? */
      canCollapse: maxScroll >= wanted,
    };
  }, []);

  useEffect(() => {
    const main = document.querySelector('[data-app-main]');
    if (!main) return;

    const read = () => {
      frame.current = 0;
      const m = measure();
      if (!m) return;
      const top = m.scroller.scrollTop;
      const progress = m.distance > 0 ? Math.min(1, Math.max(0, top / m.distance)) : 0;
      const stage: Stage =
        top > m.distance + FLOATING_AFTER ? 'floating' : progress >= 0.999 ? 'compact' : 'expanded';
      // Der Fortschritt muss auch die große Überschrift erreichen, und die
      // ist kein Nachfahre der Leiste – deshalb direkt auf <main> setzen.
      (main as HTMLElement).style.setProperty('--bar-progress', progress.toFixed(3));
      // Rohe Scrollstrecke: Damit kann der kleine Titel exakt so schnell nach
      // oben wandern wie der Inhalt – er verhält sich dann, als wäre er gar
      // nicht mitgeklebt, und ist irgendwann schlicht aus dem Bild.
      (main as HTMLElement).style.setProperty('--bar-scroll', `${Math.min(top, 900)}`);
      (main as HTMLElement).style.setProperty('--bar-distance', `${Math.round(m.distance)}`);
      setState({ stage, progress, hasTitle: m.hasTitle });
    };

    /** Beim Loslassen zum näheren der beiden Rastpunkte ziehen. */
    const snap = () => {
      if (!snapEnabled || snapping.current) return;
      const m = measure();
      if (!m || m.distance <= 0) return;
      const top = m.scroller.scrollTop;
      if (top <= 0 || top >= m.distance) return;
      // Zu kurz zum Einklappen heißt auch: nichts, wozu man ziehen könnte.
      if (!m.canCollapse) return;
      const target = top > m.distance / 2 ? m.distance : 0;
      snapping.current = true;
      m.scroller.scrollTo({ top: target, behavior: smooth ? 'smooth' : 'auto' });
      window.setTimeout(() => { snapping.current = false; }, 400);
    };

    const onScroll = () => {
      if (!frame.current) frame.current = requestAnimationFrame(read);
      window.clearTimeout(settle.current);
      settle.current = window.setTimeout(snap, SETTLE_MS);
    };

    main.addEventListener('scroll', onScroll, { passive: true, capture: true });
    main.addEventListener('wheel', onScroll, { passive: true, capture: true });
    read();

    // Seiten öffnen eingeklappt – der große Titel ist einen Wisch entfernt.
    // Das gehört zu One UI; die anderen Themes starten oben, wie gewohnt.
    //
    // Einmal messen reicht nicht: Beim Wechsel zwischen zwei Ansichten
    // derselben Seite (Hilfe: Liste → Artikel) steht kurz noch die alte
    // Überschrift im Dokument, und lange Titel brechen erst um, wenn die
    // Schrift geladen ist. Wer dann eingeklappt hat, landet auf halber
    // Strecke – der kleine Titel steht halb durchsichtig da. Deshalb wird
    // die Position nachgezogen, solange sie noch von uns stammt.
    const openCollapsed = () => {
      if (!snapEnabled) return;
      const m = measure();
      if (!m || m.distance <= 0) return;
      const top = m.scroller.scrollTop;
      // Kurze Seiten reichen nicht bis zum Rastpunkt (ein knapper Hilfe-
      // artikel etwa). Dort bleibt der große Titel stehen, statt die Seite
      // an ihr Ende zu ziehen.
      if (!m.canCollapse) {
        if (top !== 0) m.scroller.scrollTop = 0;
        read();
        return;
      }
      // Wer tiefer im Inhalt steht, bleibt dort – nur der Bereich zwischen
      // den beiden Rastpunkten wird auf den unteren gezogen. Das trifft den
      // Start (0) genauso wie einen Ansichtswechsel, bei dem die alte
      // Position auf halber Strecke der neuen Überschrift landet.
      if (top > m.distance) return;
      if (top !== m.distance) m.scroller.scrollTop = m.distance;
      read();
    };
    // Die Überschrift meldet sich, sobald sie ihre endgültige Höhe hat –
    // und zwar die JEWEILS aktuelle: Wechselt eine Seite ihre Ansicht, wird
    // das alte Element ersetzt, ein daran hängender Beobachter sähe nichts
    // mehr. Deshalb wird es kurz nach dem Öffnen mehrfach nachgeschlagen.
    let observed: Element | null = null;
    const observer = new ResizeObserver(openCollapsed);
    const sync = () => {
      openCollapsed();
      const header = main.querySelector('[data-page-header]');
      if (header && header !== observed) {
        observer.disconnect();
        observer.observe(header);
        observed = header;
      }
    };
    const timers = [0, 60, 160, 320].map((d) => window.setTimeout(sync, d));

    return () => {
      main.removeEventListener('scroll', onScroll, { capture: true });
      main.removeEventListener('wheel', onScroll, { capture: true });
      window.clearTimeout(settle.current);
      timers.forEach(window.clearTimeout);
      observer.disconnect();
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [dep, measure, snapEnabled, smooth]);

  return state;
}

export function MobileBackLink({
  target,
  current,
  hasTitle: hasTitleProp,
  onSlotReady,
  onBack,
}: PageBar & {
  hasTitle?: boolean;
  /** Meldet den Platzhalter für die Aktionen zurück (siehe PageHeader) */
  onSlotReady?: (el: HTMLElement | null) => void;
  /** Eigener Weg zurück – z. B. Unterseiten, die die Seite selbst verwaltet */
  onBack?: () => void;
}) {
  const navigate = useNavigate();
  const { stage, progress, hasTitle: detected } = useCollapsingHeader(current);
  const hasTitle = hasTitleProp ?? detected;

  return (
    <div
      data-back-link
      data-stage={stage}
      data-has-back={target ? '' : undefined}
      data-has-title={hasTitle ? '' : undefined}
      style={{ ['--bar-progress' as string]: progress.toFixed(3) }}
      className="sticky top-0 z-30 flex shrink-0 items-center px-2 pt-1"
    >
      <button
        onClick={() => (onBack ? onBack() : target ? navigate(-1) : undefined)}
        disabled={!target}
        aria-label={target ? `Zurück zu ${target}` : current}
        className="-ml-1 flex h-9 min-w-0 items-center gap-0.5 rounded-md pr-3 pl-1 text-[17px] text-primary transition-all active:opacity-60 disabled:pointer-events-none"
      >
        {target && <ChevronLeft data-back-icon className="h-5 w-5 shrink-0" />}
        <span data-back-target className="truncate">{target}</span>
      </button>
      {/* Der Seitenname steht BEWUSST außerhalb des Knopfes: Sobald der Knopf
          zum runden Symbol schrumpft, würde ein Kind darin mitgequetscht –
          man sah dann nur noch den ersten Buchstaben. Außerdem soll er sich
          unabhängig vom Knopf bewegen dürfen.
          Auf Seiten mit großer Überschrift setzt er erst ein, wenn die
          große weggescrollt ist – sonst stünde derselbe Name zweimal
          übereinander. */}
      <span data-back-title className="hidden min-w-0 truncate">{current}</span>
      {/* Die Aktionen der Überschrift ziehen hier ein (One UI): Die Leiste
          sitzt unter dem großen Titel und bleibt beim Scrollen oben hängen –
          damit bleiben Jahreswahl und „Neu" immer erreichbar. */}
      <div
        data-bar-slot
        // Per Ref statt per Suche im Dokument: Sonst greift der Aufrufer im
        // ersten Durchlauf womöglich den Platzhalter einer anderen Leiste ab,
        // die gleich darauf verschwindet – das Portal hinge dann in einem
        // Element, das nicht mehr im Dokument steht.
        ref={onSlotReady}
        className="ml-auto flex shrink-0 items-center gap-1.5"
      />
    </div>
  );
}
