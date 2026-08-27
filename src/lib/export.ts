import ExcelJS from 'exceljs';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile, readFile } from '@tauri-apps/plugin-fs';
import type { Category, Invoice } from '@/types';
import { CATEGORY_LABELS, TYPE_LABELS } from '@/types';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { zipSync } from 'fflate';
import { getAbsolutePdfPath } from '@/lib/pdf';
import { normalizeCurrency } from '@/lib/currency';
import {
  WIRKUNG_LABELS,
  abzugsQuote,
  istBetriebsausgabe,
  istBetriebseinnahme,
  istVorsteuerfaehig,
  laeuftUeberAfa,
  wirkungVon,
} from '@/lib/steuer/kategorien';
import { useAppStore, type Steuerregelung } from '@/store';

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

const fmtEur = (v: number) => v.toFixed(2).replace('.', ',');

/** Sanitize a string so it's safe to use as a filename */
function sanitize(s: string): string {
  return s.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim().slice(0, 60);
}

export async function exportToZip(invoices: Invoice[], year: number | string) {
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

export async function exportAll(invoices: Invoice[], year: number | string) {
  // Export both XLSX + ZIP – user picks save path for each
  await exportToXlsx(invoices, year);
  await exportToZip(invoices, year);
}

export async function exportToXlsx(invoices: Invoice[], year: number | string) {
  const path = await save({
    defaultPath: `Rechnungen_${year}.xlsx`,
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
  });
  if (!path) return;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Klevr';
  wb.created = new Date();

  // --- Sheet 1: Alle Belege ---
  const ws1 = wb.addWorksheet('Alle Belege');
  ws1.columns = [
    { header: 'Datum', key: 'date', width: 14 },
    { header: 'Partner', key: 'partner', width: 25 },
    { header: 'Beschreibung', key: 'description', width: 35 },
    { header: 'Kategorie', key: 'category', width: 22 },
    { header: 'Typ', key: 'type', width: 12 },
    { header: 'Netto (EUR)', key: 'netto', width: 14 },
    { header: 'USt (EUR)', key: 'ust', width: 14 },
    { header: 'Brutto (EUR)', key: 'brutto', width: 14 },
    { header: 'Währung', key: 'currency', width: 10 },
    { header: 'Brutto (Original)', key: 'bruttoOriginal', width: 16 },
    { header: 'Kurs (EUR/Einheit)', key: 'fxRate', width: 18 },
    { header: 'Kursdatum', key: 'fxDate', width: 14 },
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
      currency: normalizeCurrency(inv.currency),
      // Bei Euro-Belegen bleiben die Zusatzspalten leer – sonst wären sie nur Rauschen
      bruttoOriginal: normalizeCurrency(inv.currency) === 'EUR' ? '' : fmtEur(inv.brutto_original ?? inv.brutto),
      fxRate: normalizeCurrency(inv.currency) === 'EUR' ? '' : (inv.fx_rate ?? 1).toFixed(6),
      fxDate: normalizeCurrency(inv.currency) === 'EUR' ? '' : (inv.fx_date ?? ''),
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
  ws4.addRow({ note: `Zeitraum: ${year}` });
  ws4.addRow({ note: `Anzahl Belege: ${invoices.length}` });
  ws4.addRow({ note: 'Erstellt mit Klevr v0.1.0' });

  const buffer = await wb.xlsx.writeBuffer();
  await writeFile(path, new Uint8Array(buffer as ArrayBuffer));
}

function styleHeaderRow(ws: ExcelJS.Worksheet) {
  const row = ws.getRow(1);
  row.font = { bold: true };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
}

// ─── Buchungs-CSV für den Steuerberater ──────────────────────────────────────
//
// Diese Datei hieß früher „DATEV-Export" und gab damit vor, ein Buchungsstapel
// zu sein. Sie ist keiner, und sie kann derzeit auch keiner sein: Ein
// Buchungsstapel beginnt mit dem EXTF-Kopfsatz, und der verlangt Angaben, die
// die App weder kennt noch raten darf – Berater- und Mandantennummer, den
// Beginn des Wirtschaftsjahres, die Sachkontenlänge, den verwendeten
// Kontenrahmen und das Festschreibekennzeichen. Stünden dort erfundene Werte,
// würde DATEV die Datei entweder abweisen oder, deutlich schlimmer, in den
// falschen Mandanten buchen. Solange diese Angaben nirgends in der App stehen,
// schreiben wir deshalb keinen Kopfsatz, sondern eine ehrliche Spaltenzeile,
// die eine Kanzlei einlesen und zuordnen kann.
//
// Zu einem echten Buchungsstapel fehlen damit: der EXTF-Kopfsatz, die
// Formatfelder „Kurs", „Basis-Umsatz" und „WKZ Basis-Umsatz" (Position 4 bis 6
// des DATEV-Formats), die Personenkonten für Debitoren und Kreditoren und ein
// Belegdatum in der Kurzform TTMM. Die Sachkonten unten sind ein Vorschlag nach
// SKR03; welche Konten der Mandant tatsächlich bebucht, weiß nur seine Kanzlei.

/**
 * Ein Feld für die CSV. Alles wird in Anführungszeichen gesetzt, weil Partner
 * und Beschreibung ein Semikolon enthalten dürfen – vorher hat ein einziges
 * Semikolon im Firmennamen die ganze Zeile um eine Spalte verschoben.
 */
function csvFeld(wert: string | number): string {
  return `"${String(wert).replace(/"/g, '""')}"`;
}

/** Umsatzsteuersatz eines Belegs in Prozent, aus Netto und Steuer zurückgerechnet. */
function ustSatzVon(inv: Invoice): number {
  if (inv.netto <= 0 || !inv.ust) return 0;
  return Math.round((inv.ust / inv.netto) * 1000) / 10;
}

/**
 * Erlöskonto nach SKR03.
 *
 * Vorher lief jede Einnahme auf 8400. Das ist das Automatikkonto „Erlöse 19 %
 * USt": Die Kanzlei hätte aus jedem Beleg 19 % Umsatzsteuer herausgerechnet –
 * auch beim Kleinunternehmer, der gar keine ausweist, und auch bei steuerfreien
 * Umsätzen. Deshalb entscheidet jetzt der Beleg selbst, wohin er gehört.
 */
function erloesKonto(inv: Invoice): string {
  // § 13b UStG: Die Steuer schuldet der Leistungsempfänger, beim Leistenden
  // bleibt der Erlös ohne Umsatzsteuer stehen.
  if (inv.category === 'reverse_charge') return '8195';
  const satz = ustSatzVon(inv);
  if (satz >= 15) return '8400'; // Erlöse 19 % USt
  if (satz >= 5) return '8300';  // Erlöse 7 % USt
  // Ohne ausgewiesene Steuer: Kleinunternehmer nach § 19 UStG oder ein nach
  // § 4 UStG steuerfreier Umsatz. 8200 ist das Erlöskonto ohne Steuerautomatik.
  return '8200';
}

/**
 * Aufwandskonten nach SKR03, soweit die Zuordnung eindeutig ist. Was hier
 * fehlt, landet auf dem Sammelkonto 4900 – das ist ehrlicher, als eine
 * Kontonummer zu erfinden, die die Kanzlei anschließend suchen muss.
 */
const SKR03_AUFWAND: Partial<Record<Category, string>> = {
  // Anschaffungen sind kein Aufwand: Sie gehen ins Anlagevermögen, der Aufwand
  // entsteht erst über die Abschreibung.
  anlagevermoegen_afa: '0400', // Betriebsausstattung
  gwg: '0480',                 // Geringwertige Wirtschaftsgüter
  miete: '4210',
  versicherungen_betrieb: '4360',
  fahrzeugkosten: '4530',      // Laufende Kfz-Betriebskosten
  marketing: '4600',           // Werbekosten
  bewirtungskosten: '4650',
  reisekosten: '4670',         // Reisekosten Unternehmer
  kommunikation: '4920',       // Telefon
  buerobedarf: '4930',
  weiterbildung: '4945',       // Fortbildungskosten
};

/**
 * Das Konto, auf dem ein Beleg landet.
 *
 * Der wichtigste Unterschied zu vorher: Sonderausgaben, außergewöhnliche
 * Belastungen und rein Privates liefen bisher als Betriebsausgabe auf 4900 mit
 * und haben den Gewinn gedrückt. Die Krankenversicherung ist aber
 * Sonderausgabe (§ 10 Abs. 1 Nr. 3 EStG) – vom Firmenkonto bezahlt ist sie eine
 * Privatentnahme und sonst nichts.
 */
function belegKonto(inv: Invoice): string {
  if (inv.type === 'einnahme') {
    if (istBetriebseinnahme(inv.category)) return erloesKonto(inv);
    // Die Erstattung des Finanzamts ist kein Erlös, sondern die Gegenbuchung
    // zur abgeführten Umsatzsteuer.
    if (inv.category === 'ust_erstattung') return '1780'; // Umsatzsteuer-Vorauszahlungen
    return '1890'; // Privateinlagen
  }
  if (istBetriebsausgabe(inv.category)) return SKR03_AUFWAND[inv.category] ?? '4900';
  return '1800'; // Privatentnahmen allgemein
}

/**
 * BU-Schlüssel (Steuerschlüssel).
 *
 * Auf den Automatikkonten 8400 und 8300 bleibt er bewusst leer: Dort steckt der
 * Steuersatz schon im Konto, ein zusätzlicher Schlüssel würde die Steuer ein
 * zweites Mal ansetzen. Gebraucht wird er auf der Aufwandsseite, weil die
 * Konten der Klasse 4 keine Steuerautomatik haben – 9 für 19 % Vorsteuer, 8 für
 * 7 %.
 *
 * Ein Kleinunternehmer bekommt keinen Schlüssel: Er darf keine Vorsteuer
 * ziehen, die Steuer gehört bei ihm zu den Anschaffungskosten
 * (§ 9b Abs. 1 EStG) und steckt damit schon im gebuchten Bruttobetrag.
 */
function buSchluessel(inv: Invoice, regelung: Steuerregelung): string {
  if (inv.type !== 'ausgabe') return '';
  if (regelung !== 'regelbesteuerung') return '';
  if (!istBetriebsausgabe(inv.category) || !istVorsteuerfaehig(inv.category)) return '';
  const satz = ustSatzVon(inv);
  if (satz >= 15) return '9';
  if (satz >= 5) return '8';
  return '';
}

/**
 * Wie der Beleg steuerlich wirkt – als eigene Spalte, damit die Kanzlei die
 * Fälle sieht, die eine Buchungszeile allein nicht hergibt: die 70 % der
 * Bewirtung und die Anschaffung, die erst über die Abschreibung wirkt.
 */
function wirkungText(inv: Invoice): string {
  const basis = WIRKUNG_LABELS[wirkungVon(inv.category)];
  if (laeuftUeberAfa(inv.category)) return `${basis} – erst über die Abschreibung, nicht im Kaufjahr`;
  const quote = abzugsQuote(inv.category);
  if (quote < 1) return `${basis} – nur ${Math.round(quote * 100)} % mindern den Gewinn (§ 4 Abs. 5 EStG)`;
  return basis;
}

/**
 * Schreibt die Buchungen als CSV für die Steuerkanzlei.
 *
 * `regelung` steuert allein den BU-Schlüssel; voreingestellt ist, was in den
 * Einstellungen steht.
 */
export async function exportToSteuerberaterCsv(
  invoices: Invoice[],
  year: number | string,
  regelung: Steuerregelung = useAppStore.getState().steuerregelung,
) {
  const path = await save({
    defaultPath: `Buchungen_Steuerberater_${year}.csv`,
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (!path) return;

  const KOPFZEILE = [
    'Umsatz (ohne Soll/Haben-Kz)',
    'Soll/Haben-Kennzeichen',
    'WKZ Umsatz',
    'Konto',
    'Gegenkonto (ohne BU-Schlüssel)',
    'BU-Schlüssel',
    'Belegdatum',
    'Belegfeld 1',
    'Buchungstext',
    'USt-Satz',
    'Netto',
    'Umsatzsteuer',
    'Kategorie',
    'Steuerliche Wirkung',
  ].map(csvFeld).join(';');

  const GEGENKONTO = '1200'; // Bank
  const rows: string[] = [];

  for (const inv of invoices) {
    // Info-Belege sind Verträge und Merkzettel. Es ist kein Geld geflossen,
    // also gibt es auch nichts zu buchen.
    if (inv.type === 'info') continue;

    const belegDatum = format(new Date(inv.date), 'dd.MM.yyyy', { locale: de });
    const belegfeld1 = inv.id.slice(0, 12);

    rows.push([
      // Die Beträge der App stehen immer schon in Euro – deshalb ist der
      // Währungsschlüssel hier immer EUR, unabhängig von der Belegwährung.
      fmtEur(Math.abs(inv.brutto)),
      inv.type === 'ausgabe' ? 'S' : 'H',
      'EUR',
      belegKonto(inv),
      GEGENKONTO,
      buSchluessel(inv, regelung),
      belegDatum,
      belegfeld1,
      `${inv.partner} – ${inv.description}`.slice(0, 60),
      fmtEur(ustSatzVon(inv)),
      fmtEur(inv.netto),
      fmtEur(inv.ust),
      CATEGORY_LABELS[inv.category] ?? inv.category,
      wirkungText(inv),
    ].map(csvFeld).join(';'));

    // Was der Zahlungsanbieter einbehält, ist eine eigene Betriebsausgabe: Auf
    // dem Konto kommt nur der Rest an, verdient und ausgegeben wurde aber
    // beides. Ohne diese Zeile fehlte der Betrag in der Buchführung.
    if ((inv.fee ?? 0) > 0) {
      rows.push([
        fmtEur(Math.abs(inv.fee)),
        'S',
        'EUR',
        '4970', // Nebenkosten des Geldverkehrs
        GEGENKONTO,
        '',
        belegDatum,
        belegfeld1,
        `Gebühr ${inv.partner}`.slice(0, 60),
        fmtEur(0),
        fmtEur(inv.fee),
        fmtEur(0),
        'Zahlungsgebühr',
        WIRKUNG_LABELS.betriebsausgabe,
      ].map(csvFeld).join(';'));
    }
  }

  const csv = '\uFEFF' + [KOPFZEILE, ...rows].join('\r\n'); // BOM, damit Excel die Umlaute erkennt
  const encoder = new TextEncoder();
  await writeFile(path, encoder.encode(csv));
}

