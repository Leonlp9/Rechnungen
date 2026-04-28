import jsPDF from 'jspdf';
import type { InvoiceTemplate, TemplateElement, ItemsElement, LineItem } from '@/types/template';
import { PX_TO_MM, FONT_FAMILIES } from '@/types/template';
import { buildLineItemRenderEntries, estimateLineItemRows } from '@/lib/lineItems';

const A4_H_MM = 297;

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

/** Ensures enough pages exist and switches to the target page (1-indexed). */
function gotoPage(doc: jsPDF, page: number) {
  while (doc.getNumberOfPages() < page) doc.addPage();
  doc.setPage(page);
}

/** Computes effective total for a single line item (applying per-line discount). */
function lineTotal(item: LineItem): number {
  const base = item.quantity * item.unitPrice;
  return item.discount ? base * (1 - item.discount / 100) : base;
}

/**
 * Renders the items table with automatic page breaks.
 * Supports group headers with subtotals, per-line discounts, global discount and EPC QR code.
 * Returns the absolute y position (in mm) after the last rendered row.
 */
function renderItemsTable(
  doc: jsPDF,
  el: ItemsElement,
  lineItems: LineItem[],
  simpleMode = false,
  globalDiscount = 0,
  epcQrDataUrl?: string,
): number {
  const x = el.x * PX_TO_MM;
  const w = el.width * PX_TO_MM;
  const rowH = (el.rowHeight || 24) * PX_TO_MM;
  const headerH = rowH * 1.25;
  const fs = el.fontSize || 10;
  const headerBg = el.headerBgColor || '#1e3a5f';
  const headerTxt = el.headerTextColor || '#ffffff';
  const borderCol = el.borderColor || '#d1d5db';
  const altBg = el.altRowBgColor || '#f8fafc';
  const summaryBg = el.summaryBgColor || '#1e3a5f';
  const groupHeaderBg = '#e5e7eb'; // light gray for group rows
  const subtotalBg = el.groupSubtotalBgColor || '#f3f4f6';
  const subtotalText = el.groupSubtotalTextColor || '#7c3aed';

  let absCy = el.y * PX_TO_MM;

  const drawRow = (
    cells: string[],
    colWidths: number[],
    rowHeight: number,
    bgColor: string | null,
    textColor: string,
    bold: boolean,
    aligns: Array<'left' | 'right'>,
  ) => {
    const page = Math.floor(absCy / A4_H_MM) + 1;
    gotoPage(doc, page);
    const cy = absCy - (page - 1) * A4_H_MM;

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
      const cw = colWidths[i];
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
    absCy += rowHeight;
  };

  // Draw full-width row (for group headers, subtotals, etc.)
  const drawFullRow = (text: string, rowHeight: number, bgColor: string | null, textColor: string, bold: boolean, indent = 0) => {
    const page = Math.floor(absCy / A4_H_MM) + 1;
    gotoPage(doc, page);
    const cy = absCy - (page - 1) * A4_H_MM;

    if (bgColor) {
      const [r, g, b] = hexToRgb(bgColor);
      doc.setFillColor(r, g, b);
      doc.rect(x, cy, w, rowHeight, 'F');
    }
    const [br, bg2, bb] = hexToRgb(borderCol);
    doc.setDrawColor(br, bg2, bb);
    doc.setLineWidth(0.2);
    doc.rect(x, cy, w, rowHeight, 'S');

    applyTextStyle(doc, { fontSize: fs, fontWeight: bold ? 'bold' : 'normal', fontStyle: 'normal', color: textColor });
    doc.text(text, x + 2 + indent, cy + rowHeight * 0.65, { baseline: 'alphabetic', maxWidth: w - 4 });
    absCy += rowHeight;
  };

  // Draw subtotal row (right-aligned value)
  const drawSubtotalRow = (label: string, value: string, rowHeight: number) => {
    const page = Math.floor(absCy / A4_H_MM) + 1;
    gotoPage(doc, page);
    const cy = absCy - (page - 1) * A4_H_MM;

    const [r2, g2, b2] = hexToRgb(subtotalBg);
    doc.setFillColor(r2, g2, b2);
    doc.rect(x, cy, w, rowHeight, 'F');
    const [br, bg2, bb] = hexToRgb(borderCol);
    doc.setDrawColor(br, bg2, bb);
    doc.setLineWidth(0.2);
    doc.rect(x, cy, w, rowHeight, 'S');

    applyTextStyle(doc, { fontSize: fs - 1, fontWeight: 'normal', fontStyle: 'italic', color: '#6b7280' });
    doc.text(label, x + 4, cy + rowHeight * 0.65, { baseline: 'alphabetic' });
    applyTextStyle(doc, { fontSize: fs, fontWeight: 'bold', fontStyle: 'normal', color: subtotalText });
    doc.text(value, x + w - 2, cy + rowHeight * 0.65, { align: 'right', baseline: 'alphabetic' });
    absCy += rowHeight;
  };

  const entries = buildLineItemRenderEntries(lineItems);

  if (simpleMode) {
    const simpleCols = [w * 0.78, w * 0.22];
    drawRow(['Bezeichnung', 'Betrag'], simpleCols, headerH, headerBg, headerTxt, true, ['left', 'right']);

    let dataIdx = 0;
    for (const entry of entries) {
      if (entry.kind === 'group') {
        drawFullRow(`${' '.repeat(entry.depth * 2)}${entry.item.description || 'Gruppe'}`, rowH * 0.9, groupHeaderBg, '#1f2937', true, 0);
      } else if (entry.kind === 'subtotal') {
        drawSubtotalRow(`${' '.repeat(entry.depth * 2)}Zwischensumme ${entry.label}`, fmt(entry.amount), rowH * 0.85);
      } else {
        drawRow(
          [`${' '.repeat(entry.depth * 2)}${entry.item.description || ''}`, fmt(lineTotal(entry.item))],
          simpleCols, rowH, dataIdx % 2 === 1 ? altBg : '#ffffff', '#111827', false,
          ['left', 'right'],
        );
        dataIdx++;
      }
    }
    return absCy;
  }

  // Full mode
  const cols = el.colWidths || [0.07, 0.38, 0.1, 0.1, 0.15, 0.2];
  const colW = cols.map((c) => c * w);
  const hasDiscounts = lineItems.some(i => !i.isGroupHeader && (i.discount ?? 0) > 0);
  const headers = ['Pos.', 'Bezeichnung', 'Menge', 'Einheit', 'Einzelpreis', 'Gesamt'];
  if (hasDiscounts) headers[4] = 'EP / Rabatt';

  drawRow(headers, colW, headerH, headerBg, headerTxt, true,
    ['left', 'left', 'right', 'right', 'right', 'right']);

  let dataIdx = 0;

  for (const entry of entries) {
    if (entry.kind === 'group') {
      drawFullRow(`${' '.repeat(entry.depth * 2)}${entry.item.description || 'Gruppe'}`, rowH * 0.9, groupHeaderBg, '#1f2937', true, 0);
    } else if (entry.kind === 'subtotal') {
      const page = Math.floor(absCy / A4_H_MM) + 1;
      gotoPage(doc, page);
      const cy = absCy - (page - 1) * A4_H_MM;

      const [r2, g2, b2] = hexToRgb(subtotalBg);
      doc.setFillColor(r2, g2, b2);
      doc.rect(x, cy, w, rowH * 0.85, 'F');
      const [br, bg2, bb] = hexToRgb(borderCol);
      doc.setDrawColor(br, bg2, bb);
      doc.setLineWidth(0.2);
      doc.rect(x, cy, w, rowH * 0.85, 'S');

      applyTextStyle(doc, { fontSize: fs - 1, fontWeight: 'normal', fontStyle: 'italic', color: '#6b7280' });
      doc.text(`${' '.repeat(entry.depth * 2)}Zwischensumme ${entry.label}`, x + 4, cy + rowH * 0.55, { baseline: 'alphabetic' });
      applyTextStyle(doc, { fontSize: fs, fontWeight: 'bold', fontStyle: 'normal', color: subtotalText });
      doc.text(fmt(entry.amount), x + w - 2, cy + rowH * 0.55, { align: 'right', baseline: 'alphabetic' });
      absCy += rowH * 0.85;
    } else {
      const total = lineTotal(entry.item);
      const priceCell = entry.item.discount
        ? `${fmt(entry.item.unitPrice)}\n−${entry.item.discount}%`
        : fmt(entry.item.unitPrice);
      drawRow(
        [
          String(entry.position),
          `${' '.repeat(entry.depth * 2)}${entry.item.description || ''}`,
          entry.item.quantity.toLocaleString('de-DE'),
          entry.item.unit || '',
          priceCell,
          fmt(total),
        ],
        colW, rowH, dataIdx % 2 === 1 ? altBg : '#ffffff', '#111827', false,
        ['left', 'left', 'right', 'right', 'right', 'right'],
      );
      dataIdx++;
    }
  }

  // Optional: show global discount row (Netto/MwSt/Brutto come from template variables)
  if (globalDiscount > 0) {
    const dataItems2 = lineItems.filter(i => !i.isGroupHeader);
    const netto2 = dataItems2.reduce((s, i) => s + lineTotal(i), 0);
    const discountAmt = netto2 * (globalDiscount / 100);
    const summaryColW = [w - 50 * PX_TO_MM, 50 * PX_TO_MM];
    drawRow([`Netto (vor Rabatt)`, fmt(netto2)], summaryColW, rowH * 0.9, '#f9fafb', '#6b7280', false, ['left', 'right']);
    drawRow([`Rabatt (${globalDiscount} %)`, `–${fmt(discountAmt)}`], summaryColW, rowH * 0.9, '#fff7ed', '#ea580c', false, ['left', 'right']);
  }

  void summaryBg; // used for template variable rows (handled by template engine)
  void epcQrDataUrl; // QR code is rendered via dedicated qr_code element in template

  return absCy;
}

/**
 * Renders a single non-items, non-line element.
 * absYOverrideMm: if given, overrides the element's y coordinate (already in mm, absolute across pages).
 */
function renderElement(
  doc: jsPDF,
  el: TemplateElement,
  values: Record<string, string>,
  _lineItems?: LineItem[],
  _simpleMode = false,
  absYOverrideMm?: number,
  epcQrDataUrl?: string,
) {
  // Line and items are handled in generateTemplatePdf directly
  if (el.type === 'line' || el.type === 'items') return;

  const base = el as import('@/types/template').BaseElement;
  const absY = absYOverrideMm ?? base.y * PX_TO_MM;

  const page = Math.floor(absY / A4_H_MM) + 1;
  gotoPage(doc, page);
  const yMm = absY - (page - 1) * A4_H_MM;

  const x = base.x * PX_TO_MM;
  const w = base.width * PX_TO_MM;
  const h = base.height * PX_TO_MM;

  switch (el.type) {
    case 'rectangle': {
      if (!isTransparent(el.backgroundColor)) {
        const [r, g, b] = hexToRgb(el.backgroundColor);
        doc.setFillColor(r, g, b);
        const rx = (el.borderRadius || 0) * PX_TO_MM;
        doc.roundedRect(x, yMm, w, h, rx, rx, 'F');
      }
      if (el.borderWidth > 0 && !isTransparent(el.borderColor)) {
        const [r, g, b] = hexToRgb(el.borderColor);
        doc.setDrawColor(r, g, b);
        doc.setLineWidth(el.borderWidth * PX_TO_MM);
        const rx = (el.borderRadius || 0) * PX_TO_MM;
        doc.roundedRect(x, yMm, w, h, rx, rx, 'S');
      }
      break;
    }
    case 'text': {
      renderTextContent(doc, el.content, el, x, yMm, w, h);
      break;
    }
    case 'variable': {
      const val = values[el.variableKey] ?? '';
      const text = (el.prefix || '') + val + (el.suffix || '');
      renderTextContent(doc, text, el, x, yMm, w, h);
      break;
    }
    case 'image': {
      if (el.src) {
        try {
          const ext = el.src.startsWith('data:image/jpeg') || el.src.startsWith('data:image/jpg') ? 'JPEG' : 'PNG';
          doc.addImage(el.src, ext, x, yMm, w, h);
        } catch { /* ignore bad images */ }
      }
      break;
    }
    case 'qr_code': {
      if (!isTransparent(el.bgColor || '')) {
        const [r, g, b] = hexToRgb(el.bgColor || '#ffffff');
        doc.setFillColor(r, g, b);
        const rx = ((el.borderRadius || 0) * PX_TO_MM);
        doc.roundedRect(x, yMm, w, h, rx, rx, 'F');
      }
      if ((el.borderWidth || 0) > 0 && !isTransparent(el.borderColor || '')) {
        const [r, g, b] = hexToRgb(el.borderColor || '#d1d5db');
        doc.setDrawColor(r, g, b);
        doc.setLineWidth((el.borderWidth || 0) * PX_TO_MM);
        const rx = ((el.borderRadius || 0) * PX_TO_MM);
        doc.roundedRect(x, yMm, w, h, rx, rx, 'S');
      }
      if (epcQrDataUrl) {
        try {
          const padMm = (el.padding || 0) * PX_TO_MM;
          const iw = Math.max(2, w - padMm * 2);
          const ih = Math.max(2, h - padMm * 2);
          doc.addImage(epcQrDataUrl, 'PNG', x + padMm, yMm + padMm, iw, ih);
        } catch { /* ignore */ }
      }
      break;
    }
  }
}

export async function generateTemplatePdf(
  template: InvoiceTemplate,
  values: Record<string, string>,
  lineItems?: LineItem[],
  simpleMode = false,
  globalDiscount = 0,
  epcQrDataUrl?: string,
): Promise<ArrayBuffer> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const sorted = [...template.elements].sort((a, b) => a.zIndex - b.zIndex);

  // ── Compute overflow from items table ───────────────────────────────────
  const itemsEl = sorted.find(el => el.type === 'items') as ItemsElement | undefined;
  let overflowMm = 0;
  let itemsBaseBtmPx = 0;

  if (itemsEl && lineItems && lineItems.length > 0) {
    const rowHmm = (itemsEl.rowHeight || 24) * PX_TO_MM;
    const dynamicRows = estimateLineItemRows(lineItems);
    const hasGlobalDiscount = globalDiscount > 0;
    const totalRows = dynamicRows + (hasGlobalDiscount ? 2 : 0);
    const actualHMm = rowHmm * 1.25 + totalRows * rowHmm;
    const baseHMm = itemsEl.height * PX_TO_MM;
    overflowMm = Math.max(0, actualHMm - baseHMm);
    itemsBaseBtmPx = itemsEl.y + itemsEl.height;
  }

  // ── Render all elements ─────────────────────────────────────────────────
  for (const el of sorted) {
    if (el.type === 'line') {
      const ln = el as unknown as import('@/types/template').LineElement;
      const isBelow = itemsEl != null && Math.min(ln.y1, ln.y2) >= itemsBaseBtmPx;
      const yAdjMm = isBelow ? overflowMm : 0;
      const absY1 = ln.y1 * PX_TO_MM + yAdjMm;
      const absY2 = ln.y2 * PX_TO_MM + yAdjMm;

      const page = Math.floor(Math.min(absY1, absY2) / A4_H_MM) + 1;
      gotoPage(doc, page);
      const pageOffsetMm = (page - 1) * A4_H_MM;

      const [r, g, b] = hexToRgb(ln.color || '#111827');
      doc.setDrawColor(r, g, b);
      const lw = (ln.thickness || 2) * PX_TO_MM;
      doc.setLineWidth(lw);
      if (ln.style === 'dashed') doc.setLineDashPattern([2, 2], 0);
      else if (ln.style === 'dotted') doc.setLineDashPattern([0.5, 1.5], 0);
      else doc.setLineDashPattern([], 0);
      doc.line(ln.x1 * PX_TO_MM, absY1 - pageOffsetMm, ln.x2 * PX_TO_MM, absY2 - pageOffsetMm);
      doc.setLineDashPattern([], 0);

    } else if (el.type === 'items') {
      renderItemsTable(doc, el as ItemsElement, lineItems || [], simpleMode, globalDiscount, epcQrDataUrl);

    } else {
      const base = el as import('@/types/template').BaseElement;
      const isBelow = itemsEl != null && base.y >= itemsBaseBtmPx;
      const absYMm = base.y * PX_TO_MM + (isBelow ? overflowMm : 0);
      renderElement(doc, el, values, lineItems, simpleMode, absYMm, epcQrDataUrl);
    }
  }

  return doc.output('arraybuffer');
}
