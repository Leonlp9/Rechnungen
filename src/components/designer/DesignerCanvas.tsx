import { useRef, useEffect, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import type { InvoiceTemplate, TemplateElement } from '@/types/template';
import { CANVAS_W, CANVAS_H } from '@/types/template';
import { ElementRenderer } from './ElementRenderer';

interface Props {
  template: InvoiceTemplate;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (el: TemplateElement) => void;
  scale: number;
  variableValues?: Record<string, string>;
  readOnly?: boolean;
}

export function DesignerCanvas({
  template, selectedId, onSelect, onUpdate, scale, variableValues, readOnly,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Deselect when clicking canvas background
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === containerRef.current) onSelect(null);
  }, [onSelect]);

  // Delete selected element on Delete/Backspace key
  useEffect(() => {
    if (readOnly) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
        // handled by parent via onSelect callback cascade — parent listens separately
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, readOnly]);

  const sorted = [...template.elements].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div
      style={{
        width: CANVAS_W * scale,
        height: CANVAS_H * scale,
        flexShrink: 0,
      }}
    >
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          backgroundColor: '#ffffff',
          position: 'relative',
          transformOrigin: 'top left',
          transform: `scale(${scale})`,
          boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        }}
      >
        {sorted.map((el) =>
          readOnly ? (
            <div
              key={el.id}
              style={{
                position: 'absolute',
                left: el.x,
                top: el.y,
                width: el.width,
                height: el.height,
                zIndex: el.zIndex,
              }}
            >
              <ElementRenderer element={el} variableValues={variableValues} />
            </div>
          ) : (
            <Rnd
              key={el.id}
              scale={scale}
              position={{ x: el.x, y: el.y }}
              size={{ width: el.width, height: el.height }}
              style={{ zIndex: el.zIndex }}
              bounds="parent"
              onMouseDown={(e) => { e.stopPropagation(); onSelect(el.id); }}
              onDragStop={(_e, d) => onUpdate({ ...el, x: Math.round(d.x), y: Math.round(d.y) })}
              onResizeStop={(_e, _dir, ref, _delta, pos) =>
                onUpdate({
                  ...el,
                  x: Math.round(pos.x),
                  y: Math.round(pos.y),
                  width: Math.round(parseInt(ref.style.width)),
                  height: Math.round(parseInt(ref.style.height)),
                })
              }
              enableResizing={!readOnly}
              disableDragging={readOnly}
            >
              <ElementRenderer
                element={el}
                variableValues={variableValues}
                isSelected={el.id === selectedId}
              />
            </Rnd>
          )
        )}
      </div>
    </div>
  );
}

