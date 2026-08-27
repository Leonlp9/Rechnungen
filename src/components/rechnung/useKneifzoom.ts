// ─── Zoomen mit zwei Fingern ─────────────────────────────────────────────────
//
// Eine A4-Seite ist 210 mm breit. Auf einem 375 Pixel breiten Handy passt sie
// nur bei etwa 44 Prozent ganz hinein, und dann steht der Fließtext einer
// Rechnung mit gut vier Pixeln da – man erkennt den Aufbau, lesen kann man
// nichts. Genau deshalb hat jeder Betrachter am Handy zwei Finger zum
// Aufziehen: Man sieht erst das ganze Blatt und geht dann in die Stelle hinein,
// die einen interessiert.
//
// Der Webview darf das nicht selbst übernehmen – der würde die ganze
// Oberfläche mitvergrößern statt nur das Blatt. Also fangen wir die Geste ab
// (`touch-action: pan-x pan-y` lässt das Wischen in Ruhe, unterbindet aber das
// Aufziehen) und rechnen den Maßstab selbst.
//
// Der Teil, der die Arbeit macht, ist das Nachführen des Scrollstands: Ohne das
// rutscht einem die Stelle, auf die man zeigt, unter dem Finger weg, und das
// fühlt sich sofort kaputt an. Wir merken uns deshalb vor der Änderung, welcher
// Millimeter des Blattes unter der Fingermitte lag, und schieben danach so
// weit, dass er wieder dort liegt.

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

interface Optionen {
  /**
   * Der Scrollbereich, in dem das Blatt liegt – als Knoten, nicht als Ref: Am
   * Handy entsteht er erst beim Wechsel auf den Vorschau-Reiter, und ein Ref
   * ändert dabei seine Gleichheit nicht. Die Handler hätten sich sonst nie
   * angehängt.
   */
  knoten: HTMLElement | null;
  /** Pixel je Millimeter – ändert sich, sobald der Zoom sich ändert. */
  massstab: number;
  /** Der aktuelle Zoom in Prozent. */
  prozent: number;
  /** Setzt einen neuen Zoom in Prozent. */
  setzeProzent: (p: number) => void;
  /** Doppeltippen: einmal ganz heran, noch einmal wieder aufs ganze Blatt. */
  aufDoppeltippen: () => void;
  min: number;
  max: number;
  /** Am Desktop gibt es keine zwei Finger – dort bleibt alles aus. */
  aktiv: boolean;
}

/** Laenger aufgesetzt heisst: kein Tipp, sondern Halten oder Wischen. */
const TIPP_DAUER = 250;
/** So weit darf ein Finger wandern und trotzdem als Tipp gelten. */
const TIPP_WEG = 12;
/** Hoechstabstand zwischen den beiden Tippern eines Doppeltipps. */
const DOPPEL_WEG = 40;
/** Hoechstpause zwischen ihnen. */
const DOPPEL_PAUSE = 300;

/** Abstand zweier Berührungspunkte. */
function abstand(a: Touch, b: Touch): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

export function useKneifzoom({
  knoten, massstab, prozent, setzeProzent, aufDoppeltippen, min, max, aktiv,
}: Optionen) {
  // Die Berührungshandler hängen am DOM, nicht an React. Sie dürfen den Zoom
  // nicht aus einem alten Render lesen, sonst springt er bei jeder Geste auf
  // einen veralteten Wert zurück.
  const prozentRef = useRef(prozent);
  prozentRef.current = prozent;
  // Auch der Maßstab wird gespiegelt: Läse ihn `merkeStelle` direkt, hinge die
  // Funktion an jedem Zoomschritt neu – und mit ihr die Berührungshandler, die
  // dann mitten in der Geste ab- und wieder angemeldet würden.
  const massstabRef = useRef(massstab);
  massstabRef.current = massstab;

  const kneifen = useRef<{ abstand: number; prozent: number } | null>(null);
  const anker = useRef<{ mmX: number; mmY: number; zeigerX: number; zeigerY: number } | null>(null);
  // Ein Tipp ist kurz und bleibt stehen. Ohne diese beiden Bedingungen zaehlt
  // auch ein Wisch als Tipp – und wer zweimal schnell hintereinander scrollt,
  // bekaeme unversehens den Doppeltipp-Zoom.
  const tippBeginn = useRef<{ zeit: number; x: number; y: number } | null>(null);
  const letzterTipp = useRef({ zeit: 0, x: 0, y: 0 });

  /**
   * Hält fest, welche Stelle des Blattes gerade unter dem Zeiger liegt. Muss
   * VOR der Zoomänderung gerufen werden – danach ist der alte Maßstab weg.
   */
  const merkeStelle = useCallback((zeigerX: number, zeigerY: number) => {
    const blatt = knoten?.querySelector<HTMLElement>('[data-blattseite]');
    if (!blatt) return;
    const r = blatt.getBoundingClientRect();
    anker.current = {
      mmX: (zeigerX - r.left) / massstabRef.current,
      mmY: (zeigerY - r.top) / massstabRef.current,
      zeigerX, zeigerY,
    };
  }, [knoten]);

  // Nach dem Zoomen den Scrollstand nachziehen, bevor der Browser zeichnet –
  // als Effekt nach dem Zeichnen sähe man das Blatt einmal springen.
  useLayoutEffect(() => {
    const a = anker.current;
    if (!knoten || !a) return;
    anker.current = null;

    const blatt = knoten.querySelector<HTMLElement>('[data-blattseite]');
    if (!blatt) return;
    const r = blatt.getBoundingClientRect();
    knoten.scrollLeft += r.left + a.mmX * massstab - a.zeigerX;
    knoten.scrollTop += r.top + a.mmY * massstab - a.zeigerY;
  }, [massstab, knoten]);

  useEffect(() => {
    const el = knoten;
    if (!el || !aktiv) return;

    const start = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        tippBeginn.current = { zeit: e.timeStamp, x: t.clientX, y: t.clientY };
        return;
      }
      // Sobald ein zweiter Finger dazukommt, ist es kein Tippen mehr.
      tippBeginn.current = null;
      if (e.touches.length !== 2) return;
      kneifen.current = {
        abstand: abstand(e.touches[0], e.touches[1]),
        prozent: prozentRef.current,
      };
    };

    const bewegen = (e: TouchEvent) => {
      const k = kneifen.current;
      if (!k || e.touches.length !== 2) return;
      // Ohne das scrollt der Bereich während des Aufziehens mit.
      e.preventDefault();

      const jetzt = abstand(e.touches[0], e.touches[1]);
      if (k.abstand < 1) return;
      const neu = Math.round(Math.min(max, Math.max(min, k.prozent * (jetzt / k.abstand))));
      if (neu === prozentRef.current) return;

      merkeStelle(
        (e.touches[0].clientX + e.touches[1].clientX) / 2,
        (e.touches[0].clientY + e.touches[1].clientY) / 2,
      );
      setzeProzent(neu);
    };

    const ende = (e: TouchEvent) => {
      if (e.touches.length < 2) kneifen.current = null;
      if (e.touches.length !== 0 || e.changedTouches.length !== 1) return;

      const beginn = tippBeginn.current;
      tippBeginn.current = null;
      if (!beginn) return;

      // Ein Tipp: kurz aufgesetzt und kaum bewegt. Ein Wisch erfüllt weder das
      // eine noch das andere und wird deshalb hier aussortiert.
      const b = e.changedTouches[0];
      const gewandert = Math.hypot(b.clientX - beginn.x, b.clientY - beginn.y);
      if (e.timeStamp - beginn.zeit > TIPP_DAUER || gewandert > TIPP_WEG) return;

      // Zwei Tipps zaehlen nur zusammen, wenn sie dicht beieinander liegen –
      // sonst waeren es zwei verschiedene Stellen und zwei verschiedene
      // Absichten.
      const vorher = letzterTipp.current;
      const nah = Math.hypot(b.clientX - vorher.x, b.clientY - vorher.y) <= DOPPEL_WEG;
      if (e.timeStamp - vorher.zeit < DOPPEL_PAUSE && nah) {
        letzterTipp.current = { zeit: 0, x: 0, y: 0 };
        merkeStelle(b.clientX, b.clientY);
        aufDoppeltippen();
      } else {
        letzterTipp.current = { zeit: e.timeStamp, x: b.clientX, y: b.clientY };
      }
    };

    // Ein Abbruch ist kein Loslassen: Nimmt der Webview die Berührung an sich –
    // etwa weil er sie als Systemgeste deutet –, darf daraus kein Tipp und
    // schon gar keine Hälfte eines Doppeltipps werden.
    const abbruch = () => {
      kneifen.current = null;
      tippBeginn.current = null;
      letzterTipp.current = { zeit: 0, x: 0, y: 0 };
    };

    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', bewegen, { passive: false });
    el.addEventListener('touchend', ende, { passive: true });
    el.addEventListener('touchcancel', abbruch, { passive: true });
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', bewegen);
      el.removeEventListener('touchend', ende);
      el.removeEventListener('touchcancel', abbruch);
    };
  }, [knoten, aktiv, min, max, setzeProzent, aufDoppeltippen, merkeStelle]);

  return { merkeStelle };
}
