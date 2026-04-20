import type { Invoice } from '@/types';

export interface UstVAData {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  steuernummer: string;
  firmenname: string;
  kz_81: number;  // Umsätze 19% (netto)
  kz_86: number;  // Umsätze 7% (netto)
  kz_66: number;  // USt aus Umsätzen 19%
  kz_65: number;  // USt aus Umsätzen 7%
  kz_83: number;  // Vorsteuer
  kz_69: number;  // Verbleibende USt (Zahllast/Erstattung)
}

export function calculateUstVA(
  invoices: Invoice[],
  year: number,
  period: { type: 'quarter'; q: 1|2|3|4 } | { type: 'month'; m: number }
): UstVAData {
  const inPeriod = (date: string) => {
    const d = new Date(date);
    if (d.getFullYear() !== year) return false;
    if (period.type === 'month') return d.getMonth() + 1 === period.m;
    const q = Math.ceil((d.getMonth() + 1) / 3);
    return q === period.q;
  };

  const einnahmen = invoices.filter(i => i.type === 'einnahme' && inPeriod(i.date));
  const ausgaben = invoices.filter(i => i.type === 'ausgabe' && inPeriod(i.date));

  // Split revenues by tax rate (inferred from ust/netto ratio)
  const umsatz19 = einnahmen
    .filter(i => i.netto > 0 && Math.abs(i.ust / i.netto - 0.19) < 0.02)
    .reduce((s, i) => s + i.netto, 0);
  const umsatz7 = einnahmen
    .filter(i => i.netto > 0 && Math.abs(i.ust / i.netto - 0.07) < 0.02)
    .reduce((s, i) => s + i.netto, 0);

  const ust19 = umsatz19 * 0.19;
  const ust7 = umsatz7 * 0.07;
  const vorsteuer = ausgaben.reduce((s, i) => s + i.ust, 0);
  const zahllast = ust19 + ust7 - vorsteuer;

  const q = period.type === 'quarter' ? period.q : Math.ceil(period.m / 3) as 1|2|3|4;

  return {
    year,
    quarter: q,
    steuernummer: '',
    firmenname: '',
    kz_81: umsatz19,
    kz_86: umsatz7,
    kz_66: ust19,
    kz_65: ust7,
    kz_83: vorsteuer,
    kz_69: zahllast,
  };
}

export function generateUstVaXml(data: UstVAData): string {
  const stnr = data.steuernummer.replace(/[/ ]/g, '');
  const period = String(data.quarter * 3).padStart(2, '0');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Elster xmlns="http://www.elster.de/elsterxml/schema/v12">
  <TransferHeader version="12">
    <Verfahren>ElsterAnmeldung</Verfahren>
    <DatenArt>UStVA</DatenArt>
    <Vorgang>send-Auth</Vorgang>
    <SigUser/>
    <Empfaenger id="F">
      <Adresse>richter@elster.de</Adresse>
    </Empfaenger>
    <HerstellerID>00000</HerstellerID>
    <DatenLieferant>
      <Name>${escapeXml(data.firmenname)}</Name>
    </DatenLieferant>
    <Datei>
      <Verschluesselung>PKCS#7v1.5</Verschluesselung>
      <Kompression>GZIP</Kompression>
    </Datei>
    <RC/>
  </TransferHeader>
  <DatenTeil>
    <Nutzdatenblock>
      <NutzdatenHeader version="12">
        <NutzdatenTicket>0000000000</NutzdatenTicket>
        <Empfaenger id="F">5133</Empfaenger>
      </NutzdatenHeader>
      <Nutzdaten>
        <Anmeldungssteuern art="UStVA" version="202001">
          <DatenLieferant>
            <Erstellungsdatum>${new Date().toISOString().slice(0,10).replace(/-/g,'')}</Erstellungsdatum>
          </DatenLieferant>
          <Steuerfall>
            <Umsatzsteuervoranmeldung>
              <Jahr>${data.year}</Jahr>
              <Zeitraum>${period}</Zeitraum>
              <Steuernummer>${stnr}</Steuernummer>
              <Kz09>0</Kz09>
              <Kz81>${Math.round(data.kz_81 * 100)}</Kz81>
              <Kz86>${Math.round(data.kz_86 * 100)}</Kz86>
              <Kz66>${Math.round(data.kz_66 * 100)}</Kz66>
              <Kz65>${Math.round(data.kz_65 * 100)}</Kz65>
              <Kz83>${Math.round(data.kz_83 * 100)}</Kz83>
            </Umsatzsteuervoranmeldung>
          </Steuerfall>
        </Anmeldungssteuern>
      </Nutzdaten>
    </Nutzdatenblock>
  </DatenTeil>
</Elster>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}


