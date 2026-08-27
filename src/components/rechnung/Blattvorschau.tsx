// ─── Die Vorschau ────────────────────────────────────────────────────────────
//
// Zeichnet genau die Kästen, die `layoutRechnung` geliefert hat. Sie rechnet
// nichts selbst – kein eigener Zeilenumbruch, keine eigenen Abstände. Deshalb
// kann sie vom PDF nicht abweichen.
//
// Millimeter werden über einen einzigen Faktor in Pixel umgerechnet. Der
// Maßstab bestimmt nur, wie groß das Blatt am Bildschirm ist.

import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { A4_BREITE, A4_HOEHE } from '@/types/rechnungsvorlage';
import type { Kasten, Seite } from '@/lib/rechnung/layout';

interface Props {
  seiten: Seite[];
  schriftart: string;
  /** Pixel je Millimeter. 3,78 entspricht etwa 96 dpi. */
  massstab?: number;
  /** Ruft die Kennung des angeklickten Bausteins zurück – für den Designer. */
  onBausteinKlick?: (id: string) => void;
  /** Hebt einen Baustein hervor. */
  aktiverBaustein?: string | null;
  className?: string;
}

/** QR-Codes werden einmal je Datensatz erzeugt und dann gemerkt. */
function useQrBilder(seiten: Seite[]): Record<string, string> {
  const [bilder, setBilder] = useState<Record<string, string>>({});
  const offen = useRef(new Set<string>());

  useEffect(() => {
    const daten = new Set<string>();
    for (const s of seiten) {
      for (const k of s.kaesten) if (k.art === 'qr') daten.add(k.daten);
    }
    for (const d of daten) {
      if (bilder[d] || offen.current.has(d)) continue;
      offen.current.add(d);
      QRCode.toDataURL(d, { margin: 0, width: 240, errorCorrectionLevel: 'M' })
        .then((url) => setBilder((v) => ({ ...v, [d]: url })))
        .catch(() => { /* Ohne QR-Bild bleibt das Feld leer – kein Grund abzubrechen. */ });
    }
  }, [seiten, bilder]);

  return bilder;
}

function KastenZeichnen({
  k,
  mm,
  schriftart,
  qrBilder,
}: {
  k: Kasten;
  mm: number;
  schriftart: string;
  qrBilder: Record<string, string>;
}) {
  switch (k.art) {
    case 'flaeche':
      return (
        <div
          style={{
            position: 'absolute',
            left: k.x * mm,
            top: k.y * mm,
            width: k.breite * mm,
            height: k.hoehe * mm,
            background: k.farbe,
          }}
        />
      );

    case 'linie': {
      const waagerecht = Math.abs(k.y1 - k.y2) < 0.01;
      return (
        <div
          style={{
            position: 'absolute',
            left: Math.min(k.x1, k.x2) * mm,
            top: Math.min(k.y1, k.y2) * mm,
            width: waagerecht ? Math.abs(k.x2 - k.x1) * mm : Math.max(k.dicke * mm, 1),
            height: waagerecht ? Math.max(k.dicke * mm, 1) : Math.abs(k.y2 - k.y1) * mm,
            background: k.farbe,
          }}
        />
      );
    }

    case 'bild':
      return (
        <img
          src={k.quelle}
          alt=""
          style={{
            position: 'absolute',
            left: k.x * mm,
            top: k.y * mm,
            width: k.breite * mm,
            height: k.hoehe * mm,
            objectFit: 'contain',
          }}
        />
      );

    case 'qr': {
      const bild = qrBilder[k.daten];
      return (
        <div
          style={{
            position: 'absolute',
            left: k.x * mm,
            top: k.y * mm,
            width: k.groesse * mm,
            height: k.groesse * mm,
            background: '#fff',
          }}
        >
          {bild && <img src={bild} alt="Überweisungscode" style={{ width: '100%', height: '100%' }} />}
        </div>
      );
    }

    case 'text':
      return (
        <div
          style={{
            position: 'absolute',
            left: k.x * mm,
            top: k.y * mm,
            width: k.breite * mm,
            // Punkt in Pixel: 1 pt = 1/72 Zoll, 1 mm = mm Pixel.
            fontSize: k.groesse * (25.4 / 72) * mm,
            lineHeight: `${k.zeilenhoehe * mm}px`,
            color: k.farbe,
            fontWeight: k.fett ? 700 : 400,
            fontStyle: k.kursiv ? 'italic' : 'normal',
            fontFamily: schriftart,
            textAlign: k.ausrichtung === 'mitte' ? 'center' : k.ausrichtung === 'rechts' ? 'right' : 'left',
            whiteSpace: 'pre',
          }}
        >
          {k.zeilen.map((z, i) => (
            <div key={i}>{z === '' ? ' ' : z}</div>
          ))}
        </div>
      );
  }
}

export function Blattvorschau({
  seiten,
  schriftart,
  massstab = 3.78,
  onBausteinKlick,
  aktiverBaustein,
  className,
}: Props) {
  const qrBilder = useQrBilder(seiten);
  const mm = massstab;

  // Ohne Inhalt ein leeres Blatt zeigen – besser als gar nichts, weil man so
  // Ränder und Format schon beurteilen kann.
  const anzuzeigen = useMemo(() => (seiten.length > 0 ? seiten : [{ kaesten: [] }]), [seiten]);

  return (
    <div className={className}>
      <div className="flex flex-col items-center gap-6">
        {anzuzeigen.map((seite, i) => (
          <div
            key={i}
            data-blattseite={i}
            onClick={onBausteinKlick ? () => onBausteinKlick('') : undefined}
            style={{
              position: 'relative',
              width: A4_BREITE * mm,
              height: A4_HOEHE * mm,
              background: '#ffffff',
              boxShadow: '0 1px 3px rgba(0,0,0,.12), 0 12px 32px -12px rgba(0,0,0,.35)',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {seite.kaesten.map((k, j) => (
              <KastenZeichnen key={j} k={k} mm={mm} schriftart={schriftart} qrBilder={qrBilder} />
            ))}
            {aktiverBaustein && null}
          </div>
        ))}
      </div>
    </div>
  );
}
