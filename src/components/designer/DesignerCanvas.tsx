import { useRef, useEffect, useCallback, useState } from 'react';
import React from 'react';
import { Rnd } from 'react-rnd';
import type { InvoiceTemplate, TemplateElement, BaseElement, LineElement, LineItem, ItemsElement } from '@/types/template';
import { CANVAS_W, CANVAS_H } from '@/types/template';
import { ElementRenderer } from './ElementRenderer';
import { estimateLineItemRows } from '@/lib/lineItems';

// ── Snap helpers ────────────────────────────────────────────────────────────
const SNAP_THRESHOLD = 8;

interface SnapLine { type: 'v' | 'h'; pos: number; }

function computeSnap(
  x: number, y: number, w: number, h: number,
  dragId: string, elements: TemplateElement[],
): { x: number; y: number; lines: SnapLine[] } {
  const others = elements.filter(e => e.id !== dragId && e.type !== 'line') as BaseElement[];
  const lines: SnapLine[] = [];

  // X: left / center / right of dragged element vs all edges of others
  const dragXCands = [{ v: x, off: 0 }, { v: x + w / 2, off: w / 2 }, { v: x + w, off: w }];
  const targetX: number[] = [];
  others.forEach(o => targetX.push(o.x, o.x + o.width / 2, o.x + o.width));

  let bestXd = SNAP_THRESHOLD + 1, snapX = x, snapXLine: number | null = null;
  for (const dc of dragXCands) {
    for (const tv of targetX) {
      const d = Math.abs(dc.v - tv);
      if (d < bestXd) { bestXd = d; snapX = tv - dc.off; snapXLine = tv; }
    }
  }
  if (snapXLine !== null) lines.push({ type: 'v', pos: snapXLine });

  // Y: top / center / bottom
  const dragYCands = [{ v: y, off: 0 }, { v: y + h / 2, off: h / 2 }, { v: y + h, off: h }];
  const targetY: number[] = [];
  others.forEach(o => targetY.push(o.y, o.y + o.height / 2, o.y + o.height));

  let bestYd = SNAP_THRESHOLD + 1, snapY = y, snapYLine: number | null = null;
  for (const dc of dragYCands) {
    for (const tv of targetY) {
      const d = Math.abs(dc.v - tv);
      if (d < bestYd) { bestYd = d; snapY = tv - dc.off; snapYLine = tv; }
    }
  }
  if (snapYLine !== null) lines.push({ type: 'h', pos: snapYLine });

  return { x: Math.round(snapX), y: Math.round(snapY), lines };
}

// ── Component ────────────────────────────────────────────────────────────────
interface Props {
  template: InvoiceTemplate;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (el: TemplateElement) => void;
  scale: number;
  variableValues?: Record<string, string>;
  readOnly?: boolean;
  snapEnabled?: boolean;
  lineItems?: LineItem[];
  includeMwst?: boolean;
  simpleMode?: boolean;
  epcQrDataUrl?: string;
}

/** Cursor styles for each resize handle direction */
const HANDLE_CURSORS: Record<string, string> = {
  top: 'n-resize', bottom: 's-resize',
  left: 'w-resize', right: 'e-resize',
  topLeft: 'nw-resize', topRight: 'ne-resize',
  bottomLeft: 'sw-resize', bottomRight: 'se-resize',
};

/** Builds a map of custom handle components that fire hover callbacks */
function buildResizeHandles(
  onEnter: () => void,
  onLeave: () => void,
): Record<string, React.ReactElement> {
  return Object.fromEntries(
    Object.entries(HANDLE_CURSORS).map(([dir, cursor]) => [
      dir,
      <div
        key={dir}
        style={{ width: '100%', height: '100%', cursor }}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      />,
    ])
  );
}

type LineDrag =
  | { kind: 'none' }
  | { kind: 'body'; id: string; sx: number; sy: number; ox1: number; oy1: number; ox2: number; oy2: number }
  | { kind: 'p1';   id: string; sx: number; sy: number; ox1: number; oy1: number }
  | { kind: 'p2';   id: string; sx: number; sy: number; ox2: number; oy2: number };

export function DesignerCanvas({
  template, selectedId, onSelect, onUpdate, scale, variableValues, readOnly, snapEnabled = true,
  lineItems, simpleMode, epcQrDataUrl,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [resizeHoveredId, setResizeHoveredId] = useState<string | null>(null);
  const [snapLines, setSnapLines] = useState<SnapLine[]>([]);
  const lineDragRef = useRef<LineDrag>({ kind: 'none' });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === containerRef.current) onSelect(null);
  }, [onSelect]);

  useEffect(() => {
    if (readOnly) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, readOnly]);

  // ── Line drag mouse handlers ───────────────────────────────────────────
  useEffect(() => {
    if (readOnly) return;
    const onMove = (e: MouseEvent) => {
      const drag = lineDragRef.current;
      if (drag.kind === 'none') return;
      const dx = (e.clientX - drag.sx) / scale;
      const dy = (e.clientY - drag.sy) / scale;
      const ln = template.elements.find(el => el.id === drag.id) as LineElement | undefined;
      if (!ln) return;
      if (drag.kind === 'body') {
        onUpdate({ ...ln, x1: Math.round(drag.ox1 + dx), y1: Math.round(drag.oy1 + dy), x2: Math.round(drag.ox2 + dx), y2: Math.round(drag.oy2 + dy) } as unknown as TemplateElement);
      } else if (drag.kind === 'p1') {
        onUpdate({ ...ln, x1: Math.round(drag.ox1 + dx), y1: Math.round(drag.oy1 + dy) } as unknown as TemplateElement);
      } else if (drag.kind === 'p2') {
        onUpdate({ ...ln, x2: Math.round(drag.ox2 + dx), y2: Math.round(drag.oy2 + dy) } as unknown as TemplateElement);
      }
    };
    const onUp = () => { lineDragRef.current = { kind: 'none' }; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [readOnly, scale, template.elements, onUpdate]);

  const sorted = [...template.elements].sort((a, b) => a.zIndex - b.zIndex);
  const lineEls = sorted.filter(el => el.type === 'line') as unknown as LineElement[];
  const nonLineEls = sorted.filter(el => el.type !== 'line');

  // ── Multi-page layout ──────────────────────────────────────────────────
  // Edit mode: use template.pageCount; readOnly: derive from overflow
  const editPageCount = readOnly ? 1 : Math.max(1, template.pageCount ?? 1);

  const itemsElForLayout = readOnly
    ? (nonLineEls.find(el => el.type === 'items') as ItemsElement | undefined)
    : undefined;

  const overflowPx = ((): number => {
    if (!itemsElForLayout || !lineItems || lineItems.length === 0) return 0;
    const rowH = itemsElForLayout.rowHeight || 24;
    const actualH = rowH * 1.25 + estimateLineItemRows(lineItems) * rowH;
    return Math.max(0, actualH - itemsElForLayout.height);
  })();

  const itemsBaseBtmPx = itemsElForLayout
    ? itemsElForLayout.y + itemsElForLayout.height
    : 0;

  /** Returns adjusted absolute y for readOnly mode; in edit mode returns y unchanged. */
  const getAdjY = (y: number): number =>
    overflowPx > 0 && y >= itemsBaseBtmPx ? y + overflowPx : y;

  // Compute total canvas height
  const canvasTotalH = ((): number => {
    if (!readOnly) return editPageCount * CANVAS_H;
    let max = editPageCount * CANVAS_H;
    for (const el of nonLineEls) {
      const base = el as unknown as BaseElement;
      if (el.type === 'items' && lineItems && lineItems.length > 0) {
        const it = el as unknown as ItemsElement;
        const rh = it.rowHeight || 24;
          const actualH = rh * 1.25 + estimateLineItemRows(lineItems) * rh;
        max = Math.max(max, base.y + actualH);
      } else {
        max = Math.max(max, getAdjY(base.y) + base.height);
      }
    }
    for (const ln of lineEls) {
      max = Math.max(max, getAdjY(ln.y1), getAdjY(ln.y2));
    }
    return max;
  })();

  const numPages = readOnly ? Math.ceil(canvasTotalH / CANVAS_H) : editPageCount;

  return (
    <div style={{ width: CANVAS_W * scale, height: canvasTotalH * scale, flexShrink: 0 }}>
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        style={{
          width: CANVAS_W,
          height: canvasTotalH,
          backgroundColor: '#ffffff',
          position: 'relative',
          transformOrigin: 'top left',
          transform: `scale(${scale})`,
          boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        }}
      >
        {/* ── Page-break separators ── */}
        {numPages > 1 && Array.from({ length: numPages - 1 }, (_, i) => (
          <div
            key={`page-break-${i}`}
            style={{
              position: 'absolute',
              left: 0,
              top: (i + 1) * CANVAS_H - 1,
              width: CANVAS_W,
              height: 2,
              background: readOnly
                ? 'repeating-linear-gradient(90deg,#64748b 0px,#64748b 10px,transparent 10px,transparent 20px)'
                : 'repeating-linear-gradient(90deg,#3b82f6 0px,#3b82f6 10px,transparent 10px,transparent 20px)',
              zIndex: 10000,
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* ── Page number labels ── */}
        {numPages > 1 && Array.from({ length: numPages }, (_, i) => (
          <div
            key={`page-num-${i}`}
            style={{
              position: 'absolute',
              right: 8,
              top: i * CANVAS_H + 6,
              fontSize: 10,
              color: readOnly ? '#94a3b8' : '#3b82f6',
              zIndex: 10001,
              pointerEvents: 'none',
              userSelect: 'none',
              fontWeight: 600,
            }}
          >
            Seite {i + 1}
          </div>
        ))}

        {/* ── Snap guide lines ── */}
        {snapLines.map((line, i) =>
          line.type === 'v' ? (
            <div key={`sv-${i}`} style={{
              position: 'absolute', left: line.pos, top: 0,
              width: 1, height: CANVAS_H,
              background: 'linear-gradient(to bottom, #f59e0b 50%, transparent 50%)',
              backgroundSize: '1px 8px',
              opacity: 0.9, zIndex: 9999, pointerEvents: 'none',
            }} />
          ) : (
            <div key={`sh-${i}`} style={{
              position: 'absolute', top: line.pos, left: 0,
              height: 1, width: CANVAS_W,
              background: 'linear-gradient(to right, #f59e0b 50%, transparent 50%)',
              backgroundSize: '8px 1px',
              opacity: 0.9, zIndex: 9999, pointerEvents: 'none',
            }} />
          )
        )}

        {/* ── Non-line elements via Rnd (edit) or plain div (readOnly) ── */}
        {nonLineEls.map((el) => {
          const base = el as unknown as BaseElement;
          return readOnly ? (
            <div key={el.id} style={{
              position: 'absolute',
              left: base.x,
              top: getAdjY(base.y),
              width: base.width,
              height: el.type === 'items' ? 'auto' : base.height,
              minHeight: el.type === 'items' ? base.height : undefined,
              zIndex: base.zIndex,
            }}>
              <ElementRenderer
                element={el}
                variableValues={variableValues}
                lineItems={lineItems}
                simpleMode={simpleMode}
                epcQrDataUrl={epcQrDataUrl}
              />
            </div>
          ) : (
            <Rnd
              key={el.id}
              scale={scale}
              position={{ x: base.x, y: base.y }}
              size={{ width: base.width, height: base.height }}
              style={{ zIndex: base.zIndex }}
              bounds="parent"
              resizeHandleComponent={buildResizeHandles(
                () => setResizeHoveredId(el.id),
                () => setResizeHoveredId((id) => id === el.id ? null : id),
              )}
              onMouseDown={(e) => { e.stopPropagation(); onSelect(el.id); }}
              onDrag={(_e, d) => {
                if (!snapEnabled) { if (snapLines.length) setSnapLines([]); return; }
                const { lines } = computeSnap(d.x, d.y, base.width, base.height, el.id, template.elements);
                setSnapLines(prev => {
                  if (prev.length === lines.length && prev.every((l, i) => l.type === lines[i].type && l.pos === lines[i].pos)) return prev;
                  return lines;
                });
              }}
              onDragStop={(_e, d) => {
                setSnapLines([]);
                if (snapEnabled) {
                  const snapped = computeSnap(d.x, d.y, base.width, base.height, el.id, template.elements);
                  if (snapped.x !== base.x || snapped.y !== base.y) {
                    onUpdate({ ...el, x: snapped.x, y: snapped.y } as TemplateElement);
                  }
                } else {
                  const nx = Math.round(d.x), ny = Math.round(d.y);
                  if (nx !== base.x || ny !== base.y) {
                    onUpdate({ ...el, x: nx, y: ny } as TemplateElement);
                  }
                }
              }}
              onResizeStop={(_e, _dir, ref, _delta, pos) => {
                const nx = Math.round(pos.x), ny = Math.round(pos.y);
                const nw = Math.round(parseInt(ref.style.width)), nh = Math.round(parseInt(ref.style.height));
                if (nx !== base.x || ny !== base.y || nw !== base.width || nh !== base.height) {
                  onUpdate({ ...el, x: nx, y: ny, width: nw, height: nh } as TemplateElement);
                }
              }}
              enableResizing={!readOnly}
              disableDragging={readOnly}
            >
              <div
                style={{ width: '100%', height: '100%' }}
                onMouseEnter={() => setHoveredId(el.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <ElementRenderer
                  element={el}
                  variableValues={variableValues}
                  isSelected={el.id === selectedId}
                  isHovered={hoveredId === el.id && el.id !== selectedId}
                  isResizeHovered={resizeHoveredId === el.id}
                  simpleMode={simpleMode}
                  epcQrDataUrl={epcQrDataUrl}
                />
              </div>
            </Rnd>
          );
        })}

        {/* ── Line elements as SVG overlay ── */}
        <svg
          style={{ position: 'absolute', left: 0, top: 0, width: CANVAS_W, height: canvasTotalH, pointerEvents: 'none', zIndex: 8000 }}
        >
          {lineEls.map(ln => {
            const isSelected = ln.id === selectedId;
            const isHov = hoveredId === ln.id;
            const thickness = ln.thickness || 2;
            const color = ln.color || '#111827';
            const dashArray =
              ln.style === 'dashed' ? `${thickness * 4},${thickness * 3}` :
              ln.style === 'dotted' ? `${thickness},${thickness * 2}` :
              undefined;
            // In readOnly mode use adjusted positions, in edit mode use originals
            const ry1 = readOnly ? getAdjY(ln.y1) : ln.y1;
            const ry2 = readOnly ? getAdjY(ln.y2) : ln.y2;
            return (
              <g key={ln.id}>
                {/* Invisible thick hit area for body drag (edit only) */}
                {!readOnly && (
                  <line
                    x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2}
                    stroke="transparent" strokeWidth={Math.max(14, thickness + 10)}
                    style={{ pointerEvents: 'all', cursor: 'move' }}
                    onMouseEnter={() => setHoveredId(ln.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      onSelect(ln.id);
                      lineDragRef.current = { kind: 'body', id: ln.id, sx: e.clientX, sy: e.clientY, ox1: ln.x1, oy1: ln.y1, ox2: ln.x2, oy2: ln.y2 };
                    }}
                  />
                )}
                {/* Visible line */}
                <line
                  x1={ln.x1} y1={ry1} x2={ln.x2} y2={ry2}
                  stroke={isSelected ? '#2563eb' : isHov ? '#94a3b8' : color}
                  strokeWidth={isSelected ? Math.max(thickness, 2) : thickness}
                  strokeDasharray={dashArray}
                  strokeLinecap="round"
                  style={{ pointerEvents: 'none' }}
                />
                {/* Actual color line on top when selected */}
                {isSelected && (
                  <line
                    x1={ln.x1} y1={ry1} x2={ln.x2} y2={ry2}
                    stroke={color} strokeWidth={thickness}
                    strokeDasharray={dashArray} strokeLinecap="round"
                    style={{ pointerEvents: 'none' }}
                  />
                )}
                {/* Selection outline */}
                {isSelected && (
                  <line
                    x1={ln.x1} y1={ry1} x2={ln.x2} y2={ry2}
                    stroke="#2563eb" strokeWidth={thickness + 4}
                    strokeOpacity={0.3} strokeLinecap="round"
                    style={{ pointerEvents: 'none' }}
                  />
                )}
                {/* Endpoint handles (only when selected & not readOnly) */}
                {isSelected && !readOnly && (
                  <>
                    <circle cx={ln.x1} cy={ln.y1} r={7} fill="white" stroke="#2563eb" strokeWidth={2}
                      style={{ pointerEvents: 'all', cursor: 'crosshair' }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        lineDragRef.current = { kind: 'p1', id: ln.id, sx: e.clientX, sy: e.clientY, ox1: ln.x1, oy1: ln.y1 };
                      }}
                    />
                    <circle cx={ln.x2} cy={ln.y2} r={7} fill="white" stroke="#2563eb" strokeWidth={2}
                      style={{ pointerEvents: 'all', cursor: 'crosshair' }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        lineDragRef.current = { kind: 'p2', id: ln.id, sx: e.clientX, sy: e.clientY, ox2: ln.x2, oy2: ln.y2 };
                      }}
                    />
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

