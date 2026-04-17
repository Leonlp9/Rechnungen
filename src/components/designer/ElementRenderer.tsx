import React from 'react';
import type {
  TemplateElement, TextElement, VariableElement, ImageElement, RectangleElement,
} from '@/types/template';

interface Props {
  element: TemplateElement;
  variableValues?: Record<string, string>; // for preview mode
  isSelected?: boolean;
}

export function ElementRenderer({ element: el, variableValues, isSelected }: Props) {
  const base: React.CSSProperties = {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    boxSizing: 'border-box',
    outline: isSelected ? '2px solid #2563eb' : 'none',
    outlineOffset: '-1px',
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
  }
}

