// PDF-Anzeige für Mobilgeräte: rendert die Seiten per pdf.js auf Canvas.
// Nötig, weil der Android-WebView PDFs nicht nativ (<embed>) darstellen kann.
//
// Zoomen und Verschieben passiert hier – und nur hier. Die App selbst ist
// gegen Browser-Zoom gesperrt (siehe viewport-Meta in index.html), weil sich
// eine zoombare Oberfläche nicht wie eine App anfühlt. Ein Beleg dagegen muss
// sich vergrößern lassen, sonst sind Kleinbeträge nicht lesbar.
//
// Ablauf: Zwei Finger skalieren die Breite des Inhalts sofort (flüssig, aber
// zunächst unscharf, weil die Bitmap noch die alte Auflösung hat). Sobald die
// Geste endet, werden die Seiten in der neuen Größe neu gerendert – dann ist
// es wieder scharf. Verschoben wird über das normale Scrollen des Containers,
// der bei Vergrößerung breiter wird als der sichtbare Bereich.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

const MAX_PAGES = 25;
const MIN_SCALE = 1;
const MAX_SCALE = 5;

export function PdfCanvasViewer({
  url,
  /**
   * Freiraum unter dem Dokument. Auf einer Seite mit schwebender
   * Navigationsleiste muss sich die letzte Zeile darüber hinausschieben
   * lassen; in einem Dialog gibt es nichts, was im Weg läge.
   */
  bottomInset = '0.5rem',
}: { url: string; bottomInset?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);
  /** Zoomstufe, die tatsächlich gerendert wurde (scharf) */
  const [renderScale, setRenderScale] = useState(1);
  /** Live-Zoomstufe während der Geste */
  const scaleRef = useRef(1);
  const [scaleLabel, setScaleLabel] = useState(1);

  /** Breite des Inhalts setzen – die Seiten skalieren per CSS mit. */
  const applyScale = useCallback((next: number) => {
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next));
    scaleRef.current = clamped;
    if (sizerRef.current) sizerRef.current.style.width = `${clamped * 100}%`;
    setScaleLabel(clamped);
    return clamped;
  }, []);

  // ── Seiten rendern (bei Zoomstufe neu, damit es scharf bleibt) ────────────
  useEffect(() => {
    let cancelled = false;
    let pdfDoc: { destroy: () => void } | null = null;

    (async () => {
      try {
        setRendering(true);
        setError(null);
        const pdfjs = await import('pdfjs-dist');
        const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

        const pdf = await pdfjs.getDocument(url).promise;
        pdfDoc = pdf;
        if (cancelled) return;

        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = '';

        // Grundbreite ist die des sichtbaren Bereichs; der Zoomfaktor kommt
        // als zusätzliche Auflösung obendrauf.
        const baseWidth = scrollRef.current?.clientWidth || 320;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const pageCount = Math.min(pdf.numPages, MAX_PAGES);

        for (let i = 1; i <= pageCount; i++) {
          if (cancelled) return;
          const page = await pdf.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const scale = (baseWidth / base.width) * dpr * renderScale;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = '100%';
          canvas.style.display = 'block';
          canvas.className = 'rounded-lg border bg-white mb-3';
          container.appendChild(canvas);

          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport } as never).promise;
        }
        if (pdf.numPages > MAX_PAGES) {
          const note = document.createElement('p');
          note.className = 'text-xs text-muted-foreground text-center pb-2';
          note.textContent = `… ${pdf.numPages - MAX_PAGES} weitere Seiten (vollständig am Desktop ansehen)`;
          container.appendChild(note);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
      try {
        pdfDoc?.destroy();
      } catch {
        // ignorieren
      }
    };
  }, [url, renderScale]);

  // ── Zwei-Finger-Zoom ──────────────────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let startDist = 0;
    let startScale = 1;
    let pinching = false;
    let sharpenTimer = 0;

    const dist = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      pinching = true;
      startDist = dist(e.touches);
      startScale = scaleRef.current;
      window.clearTimeout(sharpenTimer);
    };

    const onMove = (e: TouchEvent) => {
      if (!pinching || e.touches.length !== 2) return;
      e.preventDefault(); // sonst scrollt der Container während der Geste mit
      const factor = dist(e.touches) / (startDist || 1);
      const before = scaleRef.current;
      const after = applyScale(startScale * factor);
      // Auf die Fingermitte zuhalten, damit nicht die linke obere Ecke wegläuft
      if (after !== before) {
        const rect = el.getBoundingClientRect();
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        const ratio = after / before;
        el.scrollLeft = (el.scrollLeft + cx) * ratio - cx;
        el.scrollTop = (el.scrollTop + cy) * ratio - cy;
      }
    };

    const onEnd = (e: TouchEvent) => {
      if (!pinching || e.touches.length > 0) return;
      pinching = false;
      // Erst wenn die Finger weg sind neu rendern – währenddessen wäre es zäh
      sharpenTimer = window.setTimeout(() => setRenderScale(scaleRef.current), 180);
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      window.clearTimeout(sharpenTimer);
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [applyScale]);

  const step = (delta: number) => {
    applyScale(scaleRef.current + delta);
    setRenderScale(scaleRef.current);
  };

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
        PDF konnte nicht angezeigt werden: {error}
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <div ref={scrollRef} className="h-full overflow-auto p-2" style={{ paddingBottom: bottomInset }}>
        {rendering && (
          <p className="py-6 text-center text-sm text-muted-foreground">PDF wird geladen …</p>
        )}
        <div ref={sizerRef} style={{ width: '100%' }}>
          <div ref={containerRef} />
        </div>
      </div>

      {/* Für alle, die nicht auf die Zwei-Finger-Geste kommen */}
      <div
        className="absolute right-3 flex items-center gap-1 rounded-full border border-border bg-background/90 p-1 shadow-sm backdrop-blur"
        style={{ bottom: `calc(${bottomInset} + 0.25rem)` }}
      >
        <button
          onClick={() => step(-0.5)}
          disabled={scaleLabel <= MIN_SCALE}
          aria-label="Verkleinern"
          className="flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-30"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="min-w-9 text-center text-xs tabular-nums">{Math.round(scaleLabel * 100)}%</span>
        <button
          onClick={() => step(0.5)}
          disabled={scaleLabel >= MAX_SCALE}
          aria-label="Vergrößern"
          className="flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-30"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
