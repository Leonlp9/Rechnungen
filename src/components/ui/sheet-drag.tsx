// Bottom-Sheets zum Schließen nach unten ziehen.
//
// Zwei Dinge machen das auf dem Handy angenehm:
//
// 1. Der Griff oben ist immer ziehbar.
// 2. Innerhalb scrollbarer Bereiche geht das Ziehen übergangslos aus dem
//    Scrollen hervor: Wer oben angekommen ist und weiterzieht, zieht das
//    Sheet mit – ohne abzusetzen und neu anzufassen.
//
// Geschlossen wird ab einer bestimmten Strecke ODER ab einer bestimmten
// Wurfgeschwindigkeit; darunter federt das Sheet zurück.
//
// Die Listener werden direkt in der Callback-Ref an- und abgehängt, nicht
// über einen Effekt. Grund: Das Sheet steckt in einem Portal und existiert
// erst beim Öffnen, und Radix hängt die Ref bei jedem Render neu an – ein
// `useState` in der Ref-Callback löst deshalb eine Endlosschleife aus
// ("Maximum update depth exceeded").

import { useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/** Ab dieser Ziehstrecke (px) wird geschlossen. */
const CLOSE_DISTANCE = 110;
/** Ab dieser Geschwindigkeit (px/ms) wird geschlossen – auch bei kurzer Strecke. */
const CLOSE_VELOCITY = 0.55;
/** Mindeststrecke, damit ein schneller Wisch nicht aus Versehen schließt. */
const FLING_MIN_DISTANCE = 24;
/** Bewegung, ab der entschieden wird, ob gezogen oder gescrollt wird. */
const DECIDE_THRESHOLD = 5;
/**
 * Untergrenze für den Zeitabstand zweier Messpunkte (ms). Ohne sie liefern
 * zwei Ereignisse in derselben Millisekunde eine unendliche Geschwindigkeit –
 * und das Sheet schließt sich schon bei einer winzigen Bewegung.
 */
const MIN_SAMPLE_MS = 8;

/** Nächstgelegener scrollbarer Vorfahre innerhalb des Sheets. */
function findScroller(from: EventTarget | null, root: HTMLElement): HTMLElement | null {
  let el = from instanceof HTMLElement ? from : null;
  while (el) {
    const style = getComputedStyle(el);
    const scrollable = style.overflowY === 'auto' || style.overflowY === 'scroll';
    if (scrollable && el.scrollHeight > el.clientHeight + 1) return el;
    if (el === root) break;
    el = el.parentElement;
  }
  return null;
}

function overlayEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-slot="sheet-overlay"]');
}

export function useSheetDrag(onClose: () => void) {
  // onClose ist oft eine Inline-Pfeilfunktion und ändert sich bei jedem
  // Render – über eine Ref bleibt die Callback-Ref unten trotzdem stabil.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const elRef = useRef<HTMLDivElement | null>(null);
  const detachRef = useRef<(() => void) | null>(null);
  const api = useRef<ReturnType<typeof createDragApi> | null>(null);
  if (!api.current) api.current = createDragApi(elRef, onCloseRef);

  const contentRef = useCallback((el: HTMLDivElement | null) => {
    if (elRef.current === el) return;
    detachRef.current?.();
    detachRef.current = null;
    elRef.current = el;
    if (el) detachRef.current = api.current!.attach(el);
  }, []);

  return { contentRef, onGrabberMouseDown: api.current.onGrabberMouseDown };
}

function createDragApi(
  elRef: React.MutableRefObject<HTMLDivElement | null>,
  onCloseRef: React.MutableRefObject<() => void>,
) {
  const d = {
    active: false,
    decided: false,
    fromHandle: false,
    startY: 0,
    offset: 0,
    lastY: 0,
    lastT: 0,
    velocity: 0,
  };

  /** Sheet verschieben und die Abdunklung passend mitziehen. */
  function paint(offset: number) {
    const el = elRef.current;
    if (!el) return;
    el.style.transform = offset > 0 ? `translateY(${offset}px)` : '';
    const overlay = overlayEl();
    if (overlay) {
      const height = el.offsetHeight || 1;
      overlay.style.opacity = String(Math.max(0, 1 - offset / height));
    }
  }

  function settle(close: boolean) {
    const el = elRef.current;
    d.active = false;
    d.decided = false;
    d.fromHandle = false;
    if (!el) { if (close) onCloseRef.current(); return; }
    const overlay = overlayEl();

    if (close) {
      // Erst nach unten aus dem Bild schieben, dann schließen – sonst springt
      // das Sheet vor der Ausblend-Animation kurz zurück.
      el.style.transition = 'transform 190ms cubic-bezier(0.32, 0.72, 0, 1)';
      el.style.transform = `translateY(${el.offsetHeight}px)`;
      if (overlay) {
        overlay.style.transition = 'opacity 190ms linear';
        overlay.style.opacity = '0';
      }
      window.setTimeout(() => {
        onCloseRef.current();
        const o = overlayEl();
        if (o) { o.style.transition = ''; o.style.opacity = ''; }
      }, 180);
      return;
    }

    el.style.transition = 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)';
    paint(0);
    if (overlay) { overlay.style.transition = 'opacity 260ms linear'; overlay.style.opacity = ''; }
    window.setTimeout(() => {
      if (elRef.current) elRef.current.style.transition = '';
      const o = overlayEl();
      if (o) o.style.transition = '';
    }, 270);
    d.offset = 0;
  }

  function move(y: number, now: number) {
    const dy = y - d.startY;
    // Geglättete Geschwindigkeit: ein einzelner Ausreißer soll nicht schon
    // zum Schließen führen, ein echter Wisch aber sofort erkannt werden.
    const dt = Math.max(now - d.lastT, MIN_SAMPLE_MS);
    const instant = (y - d.lastY) / dt;
    d.velocity = d.velocity * 0.6 + instant * 0.4;
    d.lastY = y;
    d.lastT = now;
    // Leichter Widerstand nach oben statt harter Anschlag
    d.offset = dy > 0 ? dy : dy / 4;
    paint(Math.max(0, d.offset));
  }

  function end() {
    if (!d.active) return;
    const far = d.offset > CLOSE_DISTANCE;
    const fast = d.velocity > CLOSE_VELOCITY && d.offset > FLING_MIN_DISTANCE;
    settle(far || fast);
  }

  /** Touch-Listener anhängen; gibt die Abhäng-Funktion zurück. */
  function attach(el: HTMLDivElement) {
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      el.style.transition = '';
      d.active = true;
      d.decided = false;
      d.fromHandle = !!(e.target instanceof HTMLElement && e.target.closest('[data-sheet-grabber]'));
      d.startY = e.touches[0].clientY;
      d.lastY = d.startY;
      d.lastT = e.timeStamp;
      d.offset = 0;
      d.velocity = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!d.active || e.touches.length !== 1) return;
      const y = e.touches[0].clientY;
      const dy = y - d.startY;

      if (!d.decided) {
        if (Math.abs(dy) < DECIDE_THRESHOLD) return;
        d.decided = true;
        // Ziehen nur nach unten – und nur, wenn darunter nichts mehr zu
        // scrollen ist. Genau das macht den Übergang nahtlos.
        const scroller = findScroller(e.target, el);
        const atTop = !scroller || scroller.scrollTop <= 0;
        if (!(dy > 0 && (d.fromHandle || atTop))) {
          d.active = false;
          return;
        }
      }

      e.preventDefault();
      move(y, e.timeStamp);
    };

    const onTouchEnd = () => end();

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }

  /** Maus-Unterstützung – nur am Griff, damit Textauswahl möglich bleibt. */
  function onGrabberMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    if (elRef.current) elRef.current.style.transition = '';
    d.active = true;
    d.decided = true;
    d.fromHandle = true;
    d.startY = e.clientY;
    d.lastY = e.clientY;
    d.lastT = performance.now();
    d.offset = 0;
    d.velocity = 0;

    const onMove = (ev: MouseEvent) => move(ev.clientY, performance.now());
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      end();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  return { attach, onGrabberMouseDown };
}

/** Der Ziehgriff oben am Sheet – großzügige Trefferfläche, kein Eigenscroll. */
export function SheetGrabber({
  onMouseDown,
  className,
}: {
  onMouseDown: (e: React.MouseEvent) => void;
  className?: string;
}) {
  return (
    <div
      data-sheet-grabber
      onMouseDown={onMouseDown}
      aria-hidden
      className={cn(
        'flex shrink-0 cursor-grab touch-none justify-center pt-2.5 pb-2 active:cursor-grabbing',
        className,
      )}
    >
      <div className="h-1.5 w-11 rounded-full bg-muted-foreground/35" />
    </div>
  );
}
