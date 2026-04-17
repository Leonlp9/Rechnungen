import jsPDF from 'jspdf';
import type { InvoiceTemplate, TemplateElement, ItemsElement, LineItem } from '@/types/template';
import { PX_TO_MM, FONT_FAMILIES } from '@/types/template';

function resolvePdfFont(fontFamily?: string): string {
  if (!fontFamily) return 'helvetica';
  const match = FONT_FAMILIES.find((f) => f.value === fontFamily);
  return match ? match.pdfFont : 'helvetica';
}

function hexToRgb(hex: string): [number, number, number] {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : [0, 0, 0];
}

function isTransparent(c: string) {
  return !c || c === 'transparent' || c === 'none';
}

function applyTextStyle(doc: jsPDF, el: { fontSize: number; fontWeight: string; fontStyle: string; color: string; fontFamily?: string }) {
  const style =
    el.fontWeight === 'bold' && el.fontStyle === 'italic' ? 'bolditalic' :
    el.fontWeight === 'bold' ? 'bold' :
    el.fontStyle === 'italic' ? 'italic' : 'normal';
  doc.setFont(resolvePdfFont(el.fontFamily), style);
  doc.setFontSize(el.fontSize);
  const [r, g, b] = hexToRgb(el.color || '#000000');
  doc.setTextColor(r, g, b);
}

function renderTextContent(
  doc: jsPDF,
  text: string,
  el: { fontSize: number; fontWeight: string; fontStyle: string; color: string; backgroundColor: string; textAlign: string; lineHeight: number; fontFamily?: string },
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

function fmt(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function renderItemsTable(
  doc: jsPDF,
  el: ItemsElement,
  lineItems: LineItem[],
) {
  const x = el.x * PX_TO_MM;
  const w = el.width * PX_TO_MM;
  const rowH = (el.rowHeight || 24) * PX_TO_MM;
  const headerH = rowH * 1.25;
  const fs = el.fontSize || 10;
  const cols = el.colWidths || [0.07, 0.38, 0.1, 0.1, 0.15, 0.2];
  const colW = cols.map((c) => c * w);
  const headers = ['Pos.', 'Bezeichnung', 'Menge', 'Einheit', 'Einzelpreis', 'Gesamt'];
  const headerBg = el.headerBgColor || '#1e3a5f';
  const headerTxt = el.headerTextColor || '#ffffff';
  const borderCol = el.borderColor || '#d1d5db';
  const altBg = el.altRowBgColor || '#f8fafc';

  let cy = el.y * PX_TO_MM;

  const drawRow = (
    cells: string[],
    rowHeight: number,
    bgColor: string | null,
    textColor: string,
    bold: boolean,
    aligns: Array<'left' | 'right'>,
  ) => {
    if (bgColor) {
      const [r, g, b] = hexToRgb(bgColor);
      doc.setFillColor(r, g, b);
      doc.rect(x, cy, w, rowHeight, 'F');
    }
    const [br, bg2, bb] = hexToRgb(borderCol);
    doc.setDrawColor(br, bg2, bb);
    doc.setLineWidth(0.2);
    doc.rect(x, cy, w, rowHeight, 'S');

    let cx = x;
    cells.forEach((cell, i) => {
      const cw = colW[i];
      if (i > 0) {
        doc.setDrawColor(br, bg2, bb);
        doc.setLineWidth(0.2);
        doc.line(cx, cy, cx, cy + rowHeight);
      }
      applyTextStyle(doc, { fontSize: fs, fontWeight: bold ? 'bold' : 'normal', fontStyle: 'normal', color: textColor });
      const align = aligns[i] ?? 'left';
      const tx = align === 'right' ? cx + cw - 2 : cx + 2;
      const ty = cy + rowHeight * 0.65;
      doc.text(cell, tx, ty, { align, baseline: 'alphabetic', maxWidth: cw - 4 });
      cx += cw;
    });
    cy += rowHeight;
  };

  // Header
  drawRow(headers, headerH, headerBg, headerTxt, true,
    ['left', 'left', 'right', 'right', 'right', 'right']);

  // Data rows
  lineItems.forEach((item, idx) => {
    const total = item.quantity * item.unitPrice;
    const bg = idx % 2 === 1 ? altBg : '#ffffff';
    drawRow(
      [
        String(idx + 1),
        item.description || '',
        item.quantity.toLocaleString('de-DE'),
        item.unit || '',
        fmt(item.unitPrice),
        fmt(total),
      ],
      rowH, bg, '#111827', false,
      ['left', 'left', 'right', 'right', 'right', 'right'],
    );
  });
}

function renderElement(doc: jsPDF, el: TemplateElement, values: Record<string, string>, lineItems?: LineItem[]) {  const x = el.x * PX_TO_MM;
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
    case 'items': {
      renderItemsTable(doc, el as ItemsElement, lineItems || []);
      break;
    }
    case 'line': {
      const ln = el as unknown as import('@/types/template').LineElement;
      const [r, g, b] = hexToRgb(ln.color || '#111827');
      doc.setDrawColor(r, g, b);
      const lw = (ln.thickness || 2) * PX_TO_MM;
      doc.setLineWidth(lw);
      if (ln.style === 'dashed') doc.setLineDashPattern([2, 2], 0);
      else if (ln.style === 'dotted') doc.setLineDashPattern([0.5, 1.5], 0);
      else doc.setLineDashPattern([], 0);
      doc.line(ln.x1 * PX_TO_MM, ln.y1 * PX_TO_MM, ln.x2 * PX_TO_MM, ln.y2 * PX_TO_MM);
      doc.setLineDashPattern([], 0);
      break;
    }
  }
}

export async function generateTemplatePdf(
  template: InvoiceTemplate,
  values: Record<string, string>,
  lineItems?: LineItem[],
): Promise<ArrayBuffer> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const sorted = [...template.elements].sort((a, b) => a.zIndex - b.zIndex);
  for (const el of sorted) {
    renderElement(doc, el, values, lineItems);
  }

  return doc.output('arraybuffer');
}

