// ─── Aus dem Layout wird ein PDF ─────────────────────────────────────────────
//
// Der Zwilling der Vorschau: dieselben Kästen, andere Zeichenfläche. Auch
// dieser Zeichner rechnet nichts – er malt nur, was `layoutRechnung` gesagt
// hat. Deshalb sieht das PDF aus wie die Vorschau, ohne dass jemand beides
// von Hand angleichen müsste.
//
// jsPDF arbeitet in Millimetern, das Layout ebenfalls. Umrechnen entfällt.

import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { A4_BREITE, A4_HOEHE } from '@/types/rechnungsvorlage';
import type { Kasten, Seite } from './layout';
import { PT_ZU_MM } from './layout';

/** Von der CSS-Schriftfamilie zur PDF-Schrift. */
function pdfSchrift(schriftart: string): 'helvetica' | 'times' | 'courier' {
  const s = schriftart.toLowerCase();
  if (s.includes('times') || s.includes('georgia') || s.includes('serif') && !s.includes('sans')) return 'times';
  if (s.includes('courier') || s.includes('mono')) return 'courier';
  return 'helvetica';
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const voll = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(voll || '000000', 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

async function qrBild(daten: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(daten, { margin: 0, width: 400, errorCorrectionLevel: 'M' });
  } catch {
    return null;
  }
}

function zeichne(doc: jsPDF, k: Kasten, schrift: string, qrBilder: Map<string, string>) {
  switch (k.art) {
    case 'flaeche': {
      const [r, g, b] = rgb(k.farbe);
      doc.setFillColor(r, g, b);
      doc.rect(k.x, k.y, k.breite, k.hoehe, 'F');
      break;
    }

    case 'linie': {
      const [r, g, b] = rgb(k.farbe);
      doc.setDrawColor(r, g, b);
      doc.setLineWidth(k.dicke);
      doc.line(k.x1, k.y1, k.x2, k.y2);
      break;
    }

    case 'bild': {
      try {
        doc.addImage(k.quelle, 'PNG', k.x, k.y, k.breite, k.hoehe, undefined, 'FAST');
      } catch {
        // Ein kaputtes Logo darf die Rechnung nicht verhindern.
      }
      break;
    }

    case 'qr': {
      const bild = qrBilder.get(k.daten);
      if (!bild) break;
      try {
        doc.addImage(bild, 'PNG', k.x, k.y, k.groesse, k.groesse, undefined, 'FAST');
      } catch { /* siehe oben */ }
      break;
    }

    case 'text': {
      const [r, g, b] = rgb(k.farbe);
      doc.setTextColor(r, g, b);
      doc.setFont(schrift, k.kursiv ? (k.fett ? 'bolditalic' : 'italic') : (k.fett ? 'bold' : 'normal'));
      doc.setFontSize(k.groesse);

      k.zeilen.forEach((zeile, i) => {
        if (!zeile) return;
        // jsPDF setzt Text auf die Grundlinie; das Layout meint die Oberkante.
        // Der Versatz von 0,8 der Schrifthöhe trifft die Mitte gut.
        const y = k.y + k.zeilenhoehe * i + k.groesse * PT_ZU_MM * 0.8;
        const x =
          k.ausrichtung === 'rechts' ? k.x + k.breite
            : k.ausrichtung === 'mitte' ? k.x + k.breite / 2
              : k.x;
        doc.text(zeile, x, y, {
          align: k.ausrichtung === 'rechts' ? 'right' : k.ausrichtung === 'mitte' ? 'center' : 'left',
        });
      });
      break;
    }
  }
}

/** Erzeugt das PDF-Dokument. */
export async function erzeugePdf(seiten: Seite[], schriftart: string): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const schrift = pdfSchrift(schriftart);

  // QR-Codes vorab erzeugen – jsPDF kann nicht auf Zusagen warten.
  const qrBilder = new Map<string, string>();
  const daten = new Set<string>();
  for (const s of seiten) for (const k of s.kaesten) if (k.art === 'qr') daten.add(k.daten);
  for (const d of daten) {
    const bild = await qrBild(d);
    if (bild) qrBilder.set(d, bild);
  }

  seiten.forEach((seite, i) => {
    if (i > 0) doc.addPage([A4_BREITE, A4_HOEHE], 'portrait');
    // Flächen zuerst, damit Text darüber liegt – das Layout liefert sie
    // bereits in dieser Reihenfolge, hier wird nur nachsortiert, falls nicht.
    const hinten = seite.kaesten.filter((k) => k.art === 'flaeche');
    const vorne = seite.kaesten.filter((k) => k.art !== 'flaeche');
    for (const k of [...hinten, ...vorne]) zeichne(doc, k, schrift, qrBilder);
  });

  return doc;
}

/** PDF als Bytes – zum Speichern über Tauri. */
export async function pdfBytes(seiten: Seite[], schriftart: string): Promise<Uint8Array> {
  const doc = await erzeugePdf(seiten, schriftart);
  return new Uint8Array(doc.output('arraybuffer'));
}
