/**
 * GoBD-konformer Buchungsexport als CSV
 *
 * Exportiert alle Buchungen in einem Format, das bei Betriebsprüfungen
 * (§ 147 AO / GoBD) vorgelegt werden kann.
 *
 * Die CSV enthält alle steuerrelevanten Felder und ist mit einem
 * UTF-8-BOM versehen (für korrekte Excel-Anzeige).
 */

import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import type { Invoice } from '@/types';
import { CATEGORY_LABELS, TYPE_LABELS } from '@/types';

/** Formatiert einen Betrag als deutsches Dezimalformat (Komma als Trennzeichen) */
function fmtEur(v: number): string {
  return v.toFixed(2).replace('.', ',');
}

/** Formatiert ein ISO-Datum als deutsches Datum */
function fmtDate(isoDate: string): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/** Escapet einen Wert für CSV (umschließt mit Anführungszeichen wenn nötig) */
function csvEsc(v: string | null | undefined): string {
  const s = v == null ? '' : String(v);
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** Leitet den Status eines Belegs aus is_locked und storno_of ab */
function getStatus(inv: Invoice): string {
  if (inv.storno_of) return 'Stornobuchung';
  if (inv.is_locked) return 'Festgeschrieben';
  return 'Entwurf';
}

/**
 * Erstellt einen GoBD-konformen CSV-String aus den übergebenen Rechnungen.
 *
 * Spalten:
 *   Belegnummer;Datum;Leistungsdatum;Partner;Beschreibung;Typ;Kategorie;
 *   Netto (EUR);USt (EUR);Brutto (EUR);Währung;Status;Festgeschrieben;
 *   Storniert von;Notiz;Erfassungszeitpunkt;Geändert am
 */
export function buildGobdCsv(invoices: Invoice[]): string {
  const HEADER = [
    'Belegnummer',
    'Datum',
    'Leistungsdatum',
    'Partner',
    'Beschreibung',
    'Typ',
    'Kategorie',
    'Netto (EUR)',
    'Gebühren (EUR)',
    'USt (EUR)',
    'USt-Satz (%)',
    'Brutto (EUR)',
    'Währung',
    'Status',
    'Festgeschrieben',
    'Storniert von (Beleg-ID)',
    'Notiz',
    'Erfassungszeitpunkt',
    'Geändert am',
    'Beleg-ID',
  ].join(';');

  const rows = invoices.map((inv) => {
    const ustSatz =
      inv.netto !== 0 ? Math.round((Math.abs(inv.ust) / Math.abs(inv.netto)) * 100) : 0;
    return [
      csvEsc(inv.description),
      csvEsc(fmtDate(inv.date)),
      csvEsc(fmtDate(inv.delivery_date || inv.date)),
      csvEsc(inv.partner),
      csvEsc(inv.description),
      csvEsc(TYPE_LABELS[inv.type] ?? inv.type),
      csvEsc(CATEGORY_LABELS[inv.category] ?? inv.category),
      csvEsc(fmtEur(inv.netto)),
      csvEsc(fmtEur(inv.fee ?? 0)),
      csvEsc(fmtEur(inv.ust)),
      csvEsc(`${ustSatz}%`),
      csvEsc(fmtEur(inv.brutto)),
      csvEsc(inv.currency || 'EUR'),
      csvEsc(getStatus(inv)),
      csvEsc(inv.is_locked ? 'Ja' : 'Nein'),
      csvEsc(inv.storno_of || ''),
      csvEsc(inv.note),
      csvEsc(inv.created_at ? new Date(inv.created_at).toLocaleString('de-DE') : ''),
      csvEsc(inv.updated_at ? new Date(inv.updated_at).toLocaleString('de-DE') : ''),
      csvEsc(inv.id),
    ].join(';');
  });

  // UTF-8 BOM (\uFEFF) für korrekte Excel-Anzeige
  return '\uFEFF' + [HEADER, ...rows].join('\r\n');
}

/**
 * Öffnet den Speichern-Dialog und schreibt den GoBD-CSV auf die Festplatte.
 *
 * @param invoices - Alle zu exportierenden Belege
 * @param year - Optional: Filtert auf ein bestimmtes Jahr (z. B. 2025)
 */
export async function downloadGobdCsv(invoices: Invoice[], year?: number): Promise<void> {
  const filtered = year ? invoices.filter((i) => i.year === year) : invoices;
  const suffix = year ? `_${year}` : '_alle-jahre';
  const defaultName = `GoBD_Buchungsexport${suffix}_${new Date().toISOString().slice(0, 10)}.csv`;

  const path = await save({
    defaultPath: defaultName,
    filters: [{ name: 'CSV (GoBD)', extensions: ['csv'] }],
  });
  if (!path) return;

  const csv = buildGobdCsv(filtered);
  const encoder = new TextEncoder();
  await writeFile(path, encoder.encode(csv));
}

/**
 * Gibt alle Jahre zurück, für die Belege vorhanden sind.
 */
export function getAvailableYears(invoices: Invoice[]): number[] {
  const years = new Set(invoices.map((i) => i.year).filter(Boolean));
  return Array.from(years).sort((a, b) => b - a);
}

