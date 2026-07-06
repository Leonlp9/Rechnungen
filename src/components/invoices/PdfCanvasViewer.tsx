// PDF-Anzeige für Mobilgeräte: rendert die Seiten per pdf.js auf Canvas.
// Nötig, weil der Android-WebView PDFs nicht nativ (<embed>) darstellen kann.

import { useEffect, useRef, useState } from 'react';

const MAX_PAGES = 25;

export function PdfCanvasViewer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);

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

        const containerWidth = container.clientWidth || 320;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const pageCount = Math.min(pdf.numPages, MAX_PAGES);

        for (let i = 1; i <= pageCount; i++) {
          if (cancelled) return;
          const page = await pdf.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const scale = (containerWidth / base.width) * dpr;
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
  }, [url]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
        PDF konnte nicht angezeigt werden: {error}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-2">
      {rendering && (
        <p className="py-6 text-center text-sm text-muted-foreground">PDF wird geladen …</p>
      )}
      <div ref={containerRef} />
    </div>
  );
}
