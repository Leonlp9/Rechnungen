import jsPDF from 'jspdf';
import type { InvoiceTemplate, TemplateElement } from '@/types/template';
import { PX_TO_MM } from '@/types/template';

function hexToRgb(hex: string): [number, number, number] {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : [0, 0, 0];
}

function isTransparent(c: string) {
  return !c || c === 'transparent' || c === 'none';
}

function applyTextStyle(doc: jsPDF, el: { fontSize: number; fontWeight: string; fontStyle: string; color: string }) {
  const style =
    el.fontWeight === 'bold' && el.fontStyle === 'italic' ? 'bolditalic' :
    el.fontWeight === 'bold' ? 'bold' :
    el.fontStyle === 'italic' ? 'italic' : 'normal';
  doc.setFont('helvetica', style);
  doc.setFontSize(el.fontSize);
  const [r, g, b] = hexToRgb(el.color || '#000000');
  doc.setTextColor(r, g, b);
}

function renderTextContent(
  doc: jsPDF,
  text: string,
  el: { fontSize: number; fontWeight: string; fontStyle: string; color: string; backgroundColor: string; textAlign: string; lineHeight: number },
  xMm: number, yMm: number, wMm: number, hMm: number
) {
  if (!isTransparent(el.backgroundColor)) {
    const [r, g, b] = hexToRgb(el.backgroundColor);
    doc.setFillColor(r, g, b);
    doc.rect(xMm, yMm, wMm, hMm, 'F');
  }
  if (!text.trim()) return;

  applyTextStyle(doc, el);

  const align = el.textAlign as 'left' | 'center' | 'right';
  const textX = align === 'center' ? xMm + wMm / 2 : align === 'right' ? xMm + wMm : xMm;

  // line height in mm: font points * 0.3528 * lineHeight
  const lineH = el.fontSize * 0.3528 * (el.lineHeight || 1.3);

  const lines = text.split('\n');
  let curY = yMm + lineH * 0.85;

  for (const rawLine of lines) {
    const wrapped = doc.splitTextToSize(rawLine || ' ', wMm);
    for (const wl of wrapped) {
      if (curY > yMm + hMm + lineH) break;
      doc.text(wl, textX, curY, { align, baseline: 'alphabetic' });
      curY += lineH;
    }
  }
}

function renderElement(doc: jsPDF, el: TemplateElement, values: Record<string, string>) {
  const x = el.x * PX_TO_MM;
  const y = el.y * PX_TO_MM;
  const w = el.width * PX_TO_MM;
  const h = el.height * PX_TO_MM;

  switch (el.type) {
    case 'rectangle': {
      if (!isTransparent(el.backgroundColor)) {
        const [r, g, b] = hexToRgb(el.backgroundColor);
        doc.setFillColor(r, g, b);
        const rx = (el.borderRadius || 0) * PX_TO_MM;
        doc.roundedRect(x, y, w, h, rx, rx, 'F');
      }
      if (el.borderWidth > 0 && !isTransparent(el.borderColor)) {
        const [r, g, b] = hexToRgb(el.borderColor);
        doc.setDrawColor(r, g, b);
        doc.setLineWidth(el.borderWidth * PX_TO_MM);
        const rx = (el.borderRadius || 0) * PX_TO_MM;
        doc.roundedRect(x, y, w, h, rx, rx, 'S');
      }
      break;
    }
    case 'text': {
      renderTextContent(doc, el.content, el, x, y, w, h);
      break;
    }
    case 'variable': {
      const val = values[el.variableKey] ?? '';
      const text = (el.prefix || '') + val + (el.suffix || '');
      renderTextContent(doc, text, el, x, y, w, h);
      break;
    }
    case 'image': {
      if (el.src) {
        try {
          const ext = el.src.startsWith('data:image/jpeg') || el.src.startsWith('data:image/jpg') ? 'JPEG' : 'PNG';
          doc.addImage(el.src, ext, x, y, w, h);
        } catch { /* ignore bad images */ }
      }
      break;
    }
  }
}

export async function generateTemplatePdf(
  template: InvoiceTemplate,
  values: Record<string, string>
): Promise<ArrayBuffer> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const sorted = [...template.elements].sort((a, b) => a.zIndex - b.zIndex);
  for (const el of sorted) {
    renderElement(doc, el, values);
  }

  return doc.output('arraybuffer');
}

