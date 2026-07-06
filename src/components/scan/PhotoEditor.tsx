// Vollbild-Foto-Editor für den Beleg-Scan: Drehen (90°-Schritte) und
// Zuschneiden per Touch (Ecken ziehen, Rechteck verschieben).

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RotateCw, Check, X, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  dataUrl: string;
  onCancel: () => void;
  onApply: (dataUrl: string) => void;
}

interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FULL_CROP: Crop = { x: 0, y: 0, w: 1, h: 1 };
const MIN_SIZE = 0.08;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'));
    img.src = src;
  });
}

/** Dreht ein Bild in 90°-Schritten und gibt es als Data-URL zurück. */
async function rotateImage(src: string, deg: 0 | 90 | 180 | 270): Promise<string> {
  if (deg === 0) return src;
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  const swap = deg === 90 || deg === 270;
  canvas.width = swap ? img.height : img.width;
  canvas.height = swap ? img.width : img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  return canvas.toDataURL('image/jpeg', 0.92);
}

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se';

export function PhotoEditor({ dataUrl, onCancel, onApply }: Props) {
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [rotatedUrl, setRotatedUrl] = useState(dataUrl);
  const [crop, setCrop] = useState<Crop>(FULL_CROP);
  const [applying, setApplying] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ mode: DragMode; startX: number; startY: number; start: Crop } | null>(null);

  useEffect(() => {
    let cancelled = false;
    rotateImage(dataUrl, rotation).then((url) => {
      if (!cancelled) {
        setRotatedUrl(url);
        setCrop(FULL_CROP);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [dataUrl, rotation]);

  const onPointerDown = useCallback((mode: DragMode) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, start: crop };
  }, [crop]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    const img = imgRef.current;
    if (!drag || !img) return;
    const rect = img.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dx = (e.clientX - drag.startX) / rect.width;
    const dy = (e.clientY - drag.startY) / rect.height;
    const s = drag.start;
    const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

    let next: Crop;
    switch (drag.mode) {
      case 'move':
        next = {
          x: clamp(s.x + dx, 0, 1 - s.w),
          y: clamp(s.y + dy, 0, 1 - s.h),
          w: s.w,
          h: s.h,
        };
        break;
      case 'nw': {
        const x = clamp(s.x + dx, 0, s.x + s.w - MIN_SIZE);
        const y = clamp(s.y + dy, 0, s.y + s.h - MIN_SIZE);
        next = { x, y, w: s.x + s.w - x, h: s.y + s.h - y };
        break;
      }
      case 'ne': {
        const y = clamp(s.y + dy, 0, s.y + s.h - MIN_SIZE);
        const w = clamp(s.w + dx, MIN_SIZE, 1 - s.x);
        next = { x: s.x, y, w, h: s.y + s.h - y };
        break;
      }
      case 'sw': {
        const x = clamp(s.x + dx, 0, s.x + s.w - MIN_SIZE);
        const h = clamp(s.h + dy, MIN_SIZE, 1 - s.y);
        next = { x, y: s.y, w: s.x + s.w - x, h };
        break;
      }
      case 'se':
        next = {
          x: s.x,
          y: s.y,
          w: clamp(s.w + dx, MIN_SIZE, 1 - s.x),
          h: clamp(s.h + dy, MIN_SIZE, 1 - s.y),
        };
        break;
    }
    setCrop(next);
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleApply = async () => {
    setApplying(true);
    try {
      const img = await loadImage(rotatedUrl);
      const sx = Math.round(crop.x * img.width);
      const sy = Math.round(crop.y * img.height);
      const sw = Math.max(1, Math.round(crop.w * img.width));
      const sh = Math.max(1, Math.round(crop.h * img.height));
      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      onApply(canvas.toDataURL('image/jpeg', 0.9));
    } finally {
      setApplying(false);
    }
  };

  const handleSize = 28;
  const handleStyle: React.CSSProperties = {
    position: 'absolute',
    width: handleSize,
    height: handleSize,
    touchAction: 'none',
  };
  const cornerDot = (
    <span className="pointer-events-none absolute inset-0 m-auto block h-4 w-4 rounded-full border-2 border-white bg-primary shadow" />
  );

  // Portal an document.body: entkoppelt das Vollbild-Overlay von
  // transformierten Vorfahren (position:fixed wäre sonst relativ zu ihnen)
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-medium">Zuschneiden & Drehen</span>
        <button type="button" onClick={onCancel} className="rounded-full p-2 hover:bg-white/10" aria-label="Abbrechen">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <div className="relative inline-block max-h-full max-w-full">
          <img
            ref={imgRef}
            src={rotatedUrl}
            alt="Aufnahme"
            draggable={false}
            className="block max-h-[65vh] max-w-full select-none rounded"
          />
          {/* Crop-Rechteck (abgedunkelter Rest via box-shadow) */}
          <div
            className="absolute cursor-move border-2 border-white/90"
            style={{
              left: `${crop.x * 100}%`,
              top: `${crop.y * 100}%`,
              width: `${crop.w * 100}%`,
              height: `${crop.h * 100}%`,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
              touchAction: 'none',
            }}
            onPointerDown={onPointerDown('move')}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <div style={{ ...handleStyle, left: -handleSize / 2, top: -handleSize / 2 }} onPointerDown={onPointerDown('nw')} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>{cornerDot}</div>
            <div style={{ ...handleStyle, right: -handleSize / 2, top: -handleSize / 2 }} onPointerDown={onPointerDown('ne')} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>{cornerDot}</div>
            <div style={{ ...handleStyle, left: -handleSize / 2, bottom: -handleSize / 2 }} onPointerDown={onPointerDown('sw')} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>{cornerDot}</div>
            <div style={{ ...handleStyle, right: -handleSize / 2, bottom: -handleSize / 2 }} onPointerDown={onPointerDown('se')} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>{cornerDot}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 px-3 py-4">
        <Button variant="secondary" size="sm" onClick={() => setRotation((r) => ((r + 90) % 360) as 0 | 90 | 180 | 270)}>
          <RotateCw className="mr-1.5 h-4 w-4" /> Drehen
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setCrop(FULL_CROP)}>
          <Maximize2 className="mr-1.5 h-4 w-4" /> Ganzes Bild
        </Button>
        <Button size="sm" onClick={handleApply} disabled={applying}>
          <Check className="mr-1.5 h-4 w-4" /> {applying ? 'Übernehme …' : 'Übernehmen'}
        </Button>
      </div>
    </div>,
    document.body,
  );
}
