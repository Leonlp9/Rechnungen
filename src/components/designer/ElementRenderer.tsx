import React from 'react';
import type {
  TemplateElement, TextElement, VariableElement, ImageElement, RectangleElement, ItemsElement, LineItem,
} from '@/types/template';

interface Props {
  element: TemplateElement;
  variableValues?: Record<string, string>;
  isSelected?: boolean;
  isHovered?: boolean;
  isResizeHovered?: boolean;
  lineItems?: LineItem[];
  includeMwst?: boolean;
}

export function ElementRenderer({ element: el, variableValues, isSelected, isHovered, isResizeHovered, lineItems, includeMwst }: Props) {
  const outline = isSelected
    ? '2px solid #2563eb'
    : isResizeHovered
      ? '2px dashed #2563eb'
      : isHovered
        ? '1.5px dashed #94a3b8'
        : 'none';

  const base: React.CSSProperties = {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    boxSizing: 'border-box',
    outline,
    outlineOffset: '-1px',
    cursor: isSelected ? 'move' : isHovered ? 'pointer' : 'default',
    transition: 'outline 0.08s ease',
  };

  switch (el.type) {
    case 'rectangle': {
      const r = el as RectangleElement;
      return (
        <div style={{
          ...base,
          backgroundColor: r.backgroundColor === 'transparent' ? 'transparent' : r.backgroundColor,
          border: r.borderWidth > 0 ? `${r.borderWidth}px solid ${r.borderColor}` : 'none',
          borderRadius: r.borderRadius,
        }} />
      );
    }
    case 'text': {
      const t = el as TextElement;
      return (
        <div style={{
          ...base,
          display: 'flex',
          alignItems: 'flex-start',
          backgroundColor: t.backgroundColor === 'transparent' ? 'transparent' : t.backgroundColor,
        }}>
          <span style={{
            fontFamily: 'Helvetica, Arial, sans-serif',
            fontSize: t.fontSize,
            fontWeight: t.fontWeight,
            fontStyle: t.fontStyle,
            color: t.color,
            textAlign: t.textAlign,
            lineHeight: t.lineHeight,
            width: '100%',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>{t.content}</span>
        </div>
      );
    }
    case 'variable': {
      const v = el as VariableElement;
      const val = variableValues?.[v.variableKey] ?? `{${v.variableKey}}`;
      const text = (v.prefix || '') + val + (v.suffix || '');
      return (
        <div style={{
          ...base,
          display: 'flex',
          alignItems: 'flex-start',
          backgroundColor: v.backgroundColor === 'transparent' ? 'transparent' : v.backgroundColor,
        }}>
          <span style={{
            fontFamily: 'Helvetica, Arial, sans-serif',
            fontSize: v.fontSize,
            fontWeight: v.fontWeight,
            fontStyle: v.fontStyle,
            color: variableValues ? v.color : '#2563eb',
            textAlign: v.textAlign,
            lineHeight: v.lineHeight,
            width: '100%',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>{text}</span>
        </div>
      );
    }
    case 'image': {
      const img = el as ImageElement;
      return (
        <div style={{ ...base, backgroundColor: 'transparent' }}>
          {img.src ? (
            <img
              src={img.src}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: img.objectFit, display: 'block' }}
            />
          ) : (
            <div style={{
              ...base,
              border: '2px dashed #d1d5db',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9ca3af',
              fontSize: 11,
              flexDirection: 'column',
              gap: 4,
            }}>
              <span>🖼</span>
              <span>Bild</span>
            </div>
          )}
        </div>
      );
    }
    case 'items': {
      const it = el as ItemsElement;
      const fs = it.fontSize || 10;
      const cols = it.colWidths || [0.07, 0.38, 0.1, 0.1, 0.15, 0.2];
      const headers = ['Pos.', 'Bezeichnung', 'Menge', 'Einheit', 'Einzelpreis', 'Gesamt'];
      const headerBg = it.headerBgColor || '#1e3a5f';
      const headerTxt = it.headerTextColor || '#ffffff';
      const border = it.borderColor || '#d1d5db';
      const altBg = it.altRowBgColor || '#f8fafc';
      const summaryBg = it.summaryBgColor || '#1e3a5f';
      const mwstRate = it.mwstRate ?? 19;

      const fmtNum = (n: number) =>
        n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

      // Use real items if provided (preview mode), otherwise show sample rows
      const isLive = lineItems && lineItems.length > 0;
      const rows: string[][] = isLive
        ? lineItems!.map((item, idx) => [
            String(idx + 1),
            item.description || '',
            item.quantity.toLocaleString('de-DE'),
            item.unit || '',
            fmtNum(item.unitPrice),
            fmtNum(item.quantity * item.unitPrice),
          ])
        : [
            ['1', 'Beispielposition', '1', 'Std.', '100,00 €', '100,00 €'],
            ['2', 'Weitere Position', '2', 'Stk.', '50,00 €', '100,00 €'],
          ];

      const netto = isLive
        ? lineItems!.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
        : 200;

      return (
        <div style={{ ...base, overflow: 'visible', fontSize: fs, fontFamily: 'Helvetica, Arial, sans-serif' }}>
          {/* Header */}
          <div style={{ display: 'flex', backgroundColor: headerBg, color: headerTxt, fontWeight: 'bold' }}>
            {headers.map((h, i) => (
              <div key={i} style={{
                width: `${cols[i] * 100}%`, padding: '4px 5px',
                borderRight: i < 5 ? `1px solid ${headerTxt}33` : 'none',
                textAlign: i >= 2 ? 'right' : 'left', fontSize: fs,
              }}>{h}</div>
            ))}
          </div>
          {/* Rows */}
          {rows.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', backgroundColor: ri % 2 === 1 ? altBg : '#ffffff', borderBottom: `1px solid ${border}` }}>
              {row.map((cell, ci) => (
                <div key={ci} style={{
                  width: `${cols[ci] * 100}%`, padding: '4px 5px',
                  borderRight: ci < 5 ? `1px solid ${border}` : 'none',
                  textAlign: ci >= 2 ? 'right' : 'left', fontSize: fs, color: '#111827',
                }}>{cell}</div>
              ))}
            </div>
          ))}
          {/* Designer badge – only when no real items */}
          {!isLive && (
            <div style={{ position: 'absolute', top: 2, right: 4, fontSize: 9, color: headerBg, opacity: 0.7, fontWeight: 'bold', pointerEvents: 'none' }}>
              POSITIONS-TABELLE
            </div>
          )}
        </div>
      );
    }
  }
}

