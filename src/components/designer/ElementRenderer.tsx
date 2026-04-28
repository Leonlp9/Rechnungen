import React from 'react';
import type {
  TemplateElement, TextElement, VariableElement, ImageElement, RectangleElement, ItemsElement, LineItem, QrCodeElement,
} from '@/types/template';
import { buildLineItemRenderEntries, lineItemTotal } from '@/lib/lineItems';

interface Props {
  element: TemplateElement;
  variableValues?: Record<string, string>;
  isSelected?: boolean;
  isHovered?: boolean;
  isResizeHovered?: boolean;
  lineItems?: LineItem[];
  includeMwst?: boolean;
  simpleMode?: boolean;
  epcQrDataUrl?: string;
}

export function ElementRenderer({ element: el, variableValues, isSelected, isHovered, isResizeHovered, lineItems, simpleMode, epcQrDataUrl }: Props) {
  // ── Items table – handled before the discriminated-union switch ──────────
  if (el.type === 'items') {
    const it = el as ItemsElement;
    const fs = it.fontSize || 10;
    const headerBg  = it.headerBgColor  || '#1e3a5f';
    const headerTxt = it.headerTextColor || '#ffffff';
    const border    = it.borderColor    || '#d1d5db';
    const altBg     = it.altRowBgColor  || '#f8fafc';

    const fmtNum = (n: number) =>
      n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20ac';

    const isLive = Array.isArray(lineItems) && lineItems.length > 0;
    const entries = isLive ? buildLineItemRenderEntries(lineItems!) : [];
    const subtotalBg = it.groupSubtotalBgColor || '#f3f4f6';
    const subtotalText = it.groupSubtotalTextColor || '#7c3aed';

    // Simple mode: only Bezeichnung + Betrag (2 columns)
    if (simpleMode) {
      const simpleCols = [0.78, 0.22];
      const simpleHeaders = ['Bezeichnung', 'Betrag'];
      const simpleRows: string[][] = isLive
        ? entries.map((entry) => {
            if (entry.kind === 'group') {
              const indent = ' '.repeat(entry.depth * 2);
              return [`${indent}${entry.item.description || 'Gruppe'}`, ''];
            }
            if (entry.kind === 'subtotal') {
              const indent = ' '.repeat(entry.depth * 2);
              return [`${indent}∑ ${entry.label}`, fmtNum(entry.amount)];
            }
            return [`${' '.repeat(entry.depth * 2)}${entry.item.description || ''}`, fmtNum(lineItemTotal(entry.item))];
          })
        : [
            ['Beispielposition', '100,00 \u20ac'],
            ['Weitere Position', '200,00 \u20ac'],
          ];

      return (
        <div style={{ position: 'relative', width: '100%', fontFamily: 'Helvetica, Arial, sans-serif', fontSize: fs, boxSizing: 'border-box', outline: isSelected ? '2px solid #2563eb' : isResizeHovered ? '2px dashed #2563eb' : isHovered ? '1.5px dashed #94a3b8' : 'none', outlineOffset: '-1px' }}>
          <div style={{ display: 'flex', backgroundColor: headerBg, color: headerTxt, fontWeight: 'bold' }}>
            {simpleHeaders.map((h, i) => (
              <div key={i} style={{ width: `${simpleCols[i] * 100}%`, padding: '4px 6px', borderRight: i < simpleHeaders.length - 1 ? '1px solid rgba(255,255,255,0.2)' : 'none', textAlign: i === 1 ? 'right' : 'left', fontSize: fs, boxSizing: 'border-box' }}>{h}</div>
            ))}
          </div>
          {simpleRows.map((row, ri) => {
            const isSubtotal = row[0].trimStart().startsWith('∑ ');
            const isGroupHeader = !isSubtotal && row[1] === '';
            return (
            <div key={ri} style={{ display: 'flex', backgroundColor: isSubtotal ? subtotalBg : isGroupHeader ? '#e5e7eb' : (ri % 2 === 1 ? altBg : '#ffffff'), borderBottom: `1px solid ${border}` }}>
              {row.map((cell, ci) => (
                <div key={ci} style={{ width: `${simpleCols[ci] * 100}%`, padding: '4px 6px', borderRight: ci < row.length - 1 ? `1px solid ${border}` : 'none', textAlign: ci === 1 ? 'right' : 'left', fontSize: fs, color: isSubtotal ? subtotalText : '#111827', fontWeight: isSubtotal || isGroupHeader ? 'bold' : 'normal', boxSizing: 'border-box' }}>{cell}</div>
              ))}
            </div>
          )})}
          {!isLive && (
            <div style={{ position: 'absolute', top: 2, right: 4, fontSize: 9, color: headerBg, opacity: 0.6, fontWeight: 'bold', pointerEvents: 'none' }}>POSITIONS-TABELLE</div>
          )}
        </div>
      );
    }

    const cols: number[] = (it.colWidths as unknown as number[]) || [0.07, 0.38, 0.1, 0.1, 0.15, 0.2];
    const headers = ['Pos.', 'Bezeichnung', 'Menge', 'Einheit', 'Einzelpreis', 'Gesamt'];
    const rows: string[][] = isLive
      ? entries.map((entry) => {
          if (entry.kind === 'group') {
            return ['', `${' '.repeat(entry.depth * 2)}${entry.item.description || 'Gruppe'}`, '', '', '', ''];
          }
          if (entry.kind === 'subtotal') {
            return ['', `${' '.repeat(entry.depth * 2)}∑ ${entry.label}`, '', '', '', fmtNum(entry.amount)];
          }
          return [
            String(entry.position),
            `${' '.repeat(entry.depth * 2)}${entry.item.description || ''}`,
            entry.item.quantity.toLocaleString('de-DE'),
            entry.item.unit || '',
            fmtNum(entry.item.unitPrice),
            fmtNum(lineItemTotal(entry.item)),
          ];
        })
      : [
          ['1', 'Beispielposition', '1', 'Std.', '100,00 \u20ac', '100,00 \u20ac'],
          ['2', 'Weitere Position', '2', 'Stk.',  '50,00 \u20ac', '100,00 \u20ac'],
        ];

    const containerStyle: React.CSSProperties = {
      position: 'relative',
      width: '100%',
      fontFamily: 'Helvetica, Arial, sans-serif',
      fontSize: fs,
      boxSizing: 'border-box',
      outline: isSelected ? '2px solid #2563eb' : isResizeHovered ? '2px dashed #2563eb' : isHovered ? '1.5px dashed #94a3b8' : 'none',
      outlineOffset: '-1px',
    };

    return (
      <div style={containerStyle}>
        {/* Header row */}
        <div style={{ display: 'flex', backgroundColor: headerBg, color: headerTxt, fontWeight: 'bold' }}>
          {headers.map((h, i) => (
            <div key={i} style={{
              width: `${cols[i] * 100}%`,
              padding: '4px 6px',
              borderRight: i < headers.length - 1 ? `1px solid rgba(255,255,255,0.2)` : 'none',
              textAlign: i >= 2 ? 'right' : 'left',
              fontSize: fs,
              boxSizing: 'border-box',
            }}>{h}</div>
          ))}
        </div>
        {/* Data rows */}
        {rows.map((row, ri) => {
          const isSubtotal = row[1].trimStart().startsWith('∑ ');
          const isGroupHeader = !isSubtotal && row[0] === '' && row[5] === '';
          return (
          <div key={ri} style={{
            display: 'flex',
            backgroundColor: isSubtotal ? subtotalBg : isGroupHeader ? '#e5e7eb' : (ri % 2 === 1 ? altBg : '#ffffff'),
            borderBottom: `1px solid ${border}`,
          }}>
            {row.map((cell, ci) => (
              <div key={ci} style={{
                width: `${cols[ci] * 100}%`,
                padding: '4px 6px',
                borderRight: ci < row.length - 1 ? `1px solid ${border}` : 'none',
                textAlign: ci >= 2 ? 'right' : 'left',
                fontSize: fs,
                color: isSubtotal ? subtotalText : '#111827',
                fontWeight: isSubtotal || isGroupHeader ? 'bold' : 'normal',
                boxSizing: 'border-box',
              }}>{cell}</div>
            ))}
          </div>
        )})}
        {/* Designer label */}
        {!isLive && (
          <div style={{
            position: 'absolute', top: 2, right: 4, fontSize: 9,
            color: headerBg, opacity: 0.6, fontWeight: 'bold', pointerEvents: 'none',
          }}>
            POSITIONS-TABELLE
          </div>
        )}
      </div>
    );
  }

  // ── All other element types ──────────────────────────────────────────────
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
            fontFamily: t.fontFamily || 'Helvetica, Arial, sans-serif',
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
            fontFamily: v.fontFamily || 'Helvetica, Arial, sans-serif',
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
            <img src={img.src} alt="" style={{ width: '100%', height: '100%', objectFit: img.objectFit, display: 'block' }} />
          ) : (
            <div style={{ ...base, border: '2px dashed #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 11, flexDirection: 'column', gap: 4 }}>
              <span>🖼</span><span>Bild</span>
            </div>
          )}
        </div>
      );
    }
    case 'qr_code': {
      const qr = el as QrCodeElement;
      const fg = qr.fgColor || '#111827';
      const bg = qr.bgColor || '#ffffff';
      const borderColor = qr.borderColor || '#d1d5db';
      const borderWidth = qr.borderWidth ?? 1;
      const borderRadius = qr.borderRadius ?? 6;
      const padding = qr.padding ?? 6;
      const label = qr.label || 'EPC-QR';
      const showLabel = qr.showLabel ?? true;
      const labelColor = qr.labelColor || '#6366f1';

      const frameStyle: React.CSSProperties = {
        ...base,
        border: borderWidth > 0 ? `${borderWidth}px solid ${borderColor}` : 'none',
        borderRadius,
        background: bg,
        padding,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 4,
      };

      if (epcQrDataUrl) {
        return (
          <div style={frameStyle}>
            <img src={epcQrDataUrl} alt="EPC QR" style={{ width: '100%', height: showLabel ? '86%' : '100%', objectFit: 'contain', display: 'block' }} />
            {showLabel && <span style={{ fontSize: 9, color: labelColor, fontFamily: 'sans-serif', fontWeight: 'bold' }}>{label}</span>}
          </div>
        );
      }
      return (
        <div style={{ ...frameStyle, borderStyle: 'dashed' }}>
          {/* QR placeholder grid */}
          <svg viewBox="0 0 48 48" width={Math.min(el.width, el.height) * 0.6} height={Math.min(el.width, el.height) * 0.6} style={{ opacity: 0.45 }} xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="18" height="18" rx="2" fill="none" stroke={fg} strokeWidth="3"/>
            <rect x="6" y="6" width="10" height="10" fill={fg}/>
            <rect x="28" y="2" width="18" height="18" rx="2" fill="none" stroke={fg} strokeWidth="3"/>
            <rect x="32" y="6" width="10" height="10" fill={fg}/>
            <rect x="2" y="28" width="18" height="18" rx="2" fill="none" stroke={fg} strokeWidth="3"/>
            <rect x="6" y="32" width="10" height="10" fill={fg}/>
            <rect x="28" y="28" width="4" height="4" fill={fg}/>
            <rect x="36" y="28" width="4" height="4" fill={fg}/>
            <rect x="28" y="36" width="4" height="4" fill={fg}/>
            <rect x="36" y="36" width="4" height="4" fill={fg}/>
            <rect x="32" y="32" width="4" height="4" fill={fg}/>
            <rect x="32" y="28" width="4" height="4" fill={fg}/>
            <rect x="28" y="32" width="4" height="4" fill={fg}/>
            <rect x="40" y="32" width="4" height="4" fill={fg}/>
            <rect x="36" y="40" width="4" height="4" fill={fg}/>
            <rect x="44" y="28" width="4" height="4" fill={fg}/>
            <rect x="44" y="36" width="4" height="4" fill={fg}/>
            <rect x="44" y="44" width="4" height="4" fill={fg}/>
          </svg>
          {showLabel && <span style={{ fontSize: 9, color: labelColor, fontFamily: 'sans-serif', fontWeight: 'bold' }}>{label}</span>}
          <span style={{ fontSize: 8, color: '#9ca3af', fontFamily: 'sans-serif', textAlign: 'center' }}>Wird beim Erstellen angezeigt</span>
        </div>
      );
    }
  }
}

