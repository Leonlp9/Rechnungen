import ExcelJS from 'exceljs';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile, readFile } from '@tauri-apps/plugin-fs';
import type { Invoice } from '@/types';
import { CATEGORY_LABELS, TYPE_LABELS } from '@/types';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { zipSync } from 'fflate';
import { getAbsolutePdfPath } from '@/lib/pdf';

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

const fmtEur = (v: number) => v.toFixed(2).replace('.', ',');

/** Sanitize a string so it's safe to use as a filename */
function sanitize(s: string): string {
  return s.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim().slice(0, 60);
}

export async function exportToZip(invoices: Invoice[], year: number) {
  const path = await save({
    defaultPath: `Rechnungen_${year}.zip`,
    filters: [{ name: 'ZIP', extensions: ['zip'] }],
  });
  if (!path) return;

  const files: Record<string, Uint8Array> = {};

  for (const inv of invoices) {
    if (!inv.pdf_path) continue;

    const monthIdx = inv.month - 1;
    const monthFolder = `${String(inv.month).padStart(2, '0')}_${MONTH_NAMES[monthIdx]}`;
    const catFolder = sanitize(CATEGORY_LABELS[inv.category] ?? inv.category);
    const dateStr = format(new Date(inv.date), 'yyyy-MM-dd', { locale: de });
    const partnerStr = sanitize(inv.partner);
    const bruttoStr = fmtEur(inv.brutto).replace(',', '-');
    const descStr = sanitize(inv.description);
    const fileName = `${dateStr}_${partnerStr}_${bruttoStr}EUR_${descStr}.pdf`;

    try {
      const absPath = await getAbsolutePdfPath(inv.pdf_path);
      const data = await readFile(absPath);
      const zipPath = `${monthFolder}/${catFolder}/${fileName}`;
      files[zipPath] = data;
    } catch {
      // PDF not found – skip
    }
  }

  if (Object.keys(files).length === 0) {
    throw new Error('Keine PDFs gefunden zum Exportieren.');
  }

  const zipped = zipSync(files, { level: 0 });
  await writeFile(path, zipped);
}

export async function exportAll(invoices: Invoice[], year: number) {
  const path = await save({
    defaultPath: `Rechnungen_${year}.zip`,
    filters: [{ name: 'ZIP', extensions: ['zip'] }],
  });
  if (!path) return;

  const files: Record<string, Uint8Array> = {};

  // --- PDFs nach Monat/Kategorie ---
  for (const inv of invoices) {
    if (!inv.pdf_path) continue;
    const monthIdx = inv.month - 1;
    const monthFolder = `${String(inv.month).padStart(2, '0')}_${MONTH_NAMES[monthIdx]}`;
    const catFolder = sanitize(CATEGORY_LABELS[inv.category] ?? inv.category);
    const dateStr = format(new Date(inv.date), 'yyyy-MM-dd', { locale: de });
    const partnerStr = sanitize(inv.partner);
    const bruttoStr = fmtEur(inv.brutto).replace(',', '-');
    const descStr = sanitize(inv.description);
    const fileName = `${dateStr}_${partnerStr}_${bruttoStr}EUR_${descStr}.pdf`;
    try {
      const absPath = await getAbsolutePdfPath(inv.pdf_path);
      const data = await readFile(absPath);
      files[`${monthFolder}/${catFolder}/${fileName}`] = data;
    } catch {
      // PDF not found – skip
    }
  }

  // --- Excel ins Root der ZIP ---
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Rechnungs-Manager';
  wb.created = new Date();
  await buildWorkbook(wb, invoices, year);
  const xlsxBuffer = await wb.xlsx.writeBuffer();
  files[`Rechnungen_${year}.xlsx`] = new Uint8Array(xlsxBuffer as ArrayBuffer);

  if (Object.keys(files).length === 0) {
    throw new Error('Keine Dateien gefunden zum Exportieren.');
  }

  const zipped = zipSync(files, { level: 0 });
  await writeFile(path, zipped);
}

export async function exportToXlsx(invoices: Invoice[], year: number) {
  const path = await save({
    defaultPath: `Rechnungen_${year}.xlsx`,
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
  });
  if (!path) return;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Rechnungs-Manager';
  wb.created = new Date();
  await buildWorkbook(wb, invoices, year);
  const buffer = await wb.xlsx.writeBuffer();
  await writeFile(path, new Uint8Array(buffer as ArrayBuffer));
}

async function buildWorkbook(wb: ExcelJS.Workbook, invoices: Invoice[], year: number) {

  // --- Sheet 1: Alle Belege ---
  const ws1 = wb.addWorksheet('Alle Belege');
  ws1.columns = [
    { header: 'Datum', key: 'date', width: 14 },
    { header: 'Partner', key: 'partner', width: 25 },
    { header: 'Beschreibung', key: 'description', width: 35 },
    { header: 'Kategorie', key: 'category', width: 22 },
    { header: 'Typ', key: 'type', width: 12 },
    { header: 'Netto', key: 'netto', width: 14 },
    { header: 'USt', key: 'ust', width: 14 },
    { header: 'Brutto', key: 'brutto', width: 14 },
    { header: 'Währung', key: 'currency', width: 10 },
    { header: 'Notiz', key: 'note', width: 30 },
  ];
  styleHeaderRow(ws1);

  for (const inv of invoices) {
    ws1.addRow({
      date: format(new Date(inv.date), 'dd.MM.yyyy', { locale: de }),
      partner: inv.partner,
      description: inv.description,
      category: CATEGORY_LABELS[inv.category] ?? inv.category,
      type: TYPE_LABELS[inv.type] ?? inv.type,
      netto: fmtEur(inv.netto),
      ust: fmtEur(inv.ust),
      brutto: fmtEur(inv.brutto),
      currency: inv.currency,
      note: inv.note,
    });
  }

  // --- Sheet 2: Zusammenfassung nach Kategorie ---
  const ws2 = wb.addWorksheet('Zusammenfassung');
  ws2.columns = [
    { header: 'Kategorie', key: 'category', width: 25 },
    { header: 'Anzahl', key: 'count', width: 10 },
    { header: 'Netto', key: 'netto', width: 16 },
    { header: 'USt', key: 'ust', width: 16 },
    { header: 'Brutto', key: 'brutto', width: 16 },
  ];
  styleHeaderRow(ws2);

  const byCat = new Map<string, { count: number; netto: number; ust: number; brutto: number }>();
  for (const inv of invoices) {
    const cat = inv.category;
    const e = byCat.get(cat) ?? { count: 0, netto: 0, ust: 0, brutto: 0 };
    e.count++;
    e.netto += inv.netto;
    e.ust += inv.ust;
    e.brutto += inv.brutto;
    byCat.set(cat, e);
  }
  for (const [cat, e] of byCat) {
    ws2.addRow({
      category: CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat,
      count: e.count,
      netto: fmtEur(e.netto),
      ust: fmtEur(e.ust),
      brutto: fmtEur(e.brutto),
    });
  }

  // --- Sheet 3: Nach Monat ---
  const ws3 = wb.addWorksheet('Nach Monat');
  ws3.columns = [
    { header: 'Monat', key: 'month', width: 16 },
    { header: 'Einnahmen', key: 'einnahmen', width: 16 },
    { header: 'Ausgaben', key: 'ausgaben', width: 16 },
    { header: 'Saldo', key: 'saldo', width: 16 },
  ];
  styleHeaderRow(ws3);

  for (let m = 1; m <= 12; m++) {
    const mi = invoices.filter((i) => i.month === m);
    const ein = mi.filter((i) => i.type === 'einnahme').reduce((s, i) => s + i.brutto, 0);
    const aus = mi.filter((i) => i.type === 'ausgabe').reduce((s, i) => s + i.brutto, 0);
    ws3.addRow({
      month: MONTH_NAMES[m - 1],
      einnahmen: fmtEur(ein),
      ausgaben: fmtEur(aus),
      saldo: fmtEur(ein - aus),
    });
  }

  // --- Sheet 4: Hinweise ---
  const ws4 = wb.addWorksheet('Hinweise');
  ws4.columns = [{ header: 'Hinweis', key: 'note', width: 80 }];
  styleHeaderRow(ws4);
  ws4.addRow({ note: `Export erstellt am ${format(new Date(), 'dd.MM.yyyy HH:mm', { locale: de })}` });
  ws4.addRow({ note: `Jahr: ${year}` });
  ws4.addRow({ note: `Anzahl Belege: ${invoices.length}` });
  ws4.addRow({ note: 'Erstellt mit Rechnungs-Manager' });
}

function styleHeaderRow(ws: ExcelJS.Worksheet) {
  const row = ws.getRow(1);
  row.font = { bold: true };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
}

