// ─── Umsatzsteuer-Voranmeldung (ELSTER-Entwurf) ──────────────────────────────
//
// Ehrlicher Hinweis vorweg: Dieser Export ist nirgends verdrahtet. Keine Seite
// und kein Menüpunkt ruft `calculateUstVA` oder `generateUstVaXml` auf, die
// Datei liegt hier als Entwurf. Bevor daraus eine Voranmeldung wird, die
// tatsächlich beim Finanzamt landet, muss sie Zeile für Zeile gegen das
// amtliche Formular und gegen das ELSTER-Schema geprüft werden: die Belegung
// der Kennzahlen, die Zahlenformate und der Aufbau des Datensatzes. Die
// Übermittlung selbst braucht ohnehin eine zertifizierte Schnittstelle (ERiC),
// eine XML-Datei allein reicht dafür nicht.
//
// Was die Datei bewusst NICHT abbildet:
//  - Kz 61 (Vorsteuer aus innergemeinschaftlichem Erwerb) und Kz 67 (Vorsteuer
//    aus Leistungen im Sinne des § 13b UStG). Beide setzen voraus, dass zu
//    einem Beleg die selbst geschuldete Steuer getrennt festgehalten ist – das
//    erfasst die App heute nicht. Eine stillschweigende 0 wäre gerade bei
//    Leistungen aus dem Ausland (Google Ads, Twitch, Amazon) falsch, denn
//    § 19 UStG schützt nicht vor § 13b UStG.
//  - steuerfreie Umsätze und Reverse-Charge-Ausgangsleistungen. Sie haben im
//    Formular eigene Kennzahlen und werden hier nicht geraten, sondern in
//    `nicht_zugeordnet` sichtbar gemacht.

import type { Invoice } from '@/types';
import { istVorsteuerfaehig, wirkungVon } from '@/lib/steuer/kategorien';

export interface UstVAData {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  /** Gesetzter Monat (1–12) wenn Monatsvoranmeldung, sonst undefined (Quartalsvoranmeldung). */
  month?: number;
  steuernummer: string;
  firmenname: string;
  /** Kz 81 – Umsätze zum Steuersatz 19 %, Bemessungsgrundlage (netto). */
  kz_81: number;
  /** Kz 86 – Umsätze zum Steuersatz 7 %, Bemessungsgrundlage (netto). */
  kz_86: number;
  /**
   * Kz 66 – Vorsteuerbeträge aus Rechnungen von anderen Unternehmern.
   *
   * Hier steht ein Steuerbetrag, keine Bemessungsgrundlage. Eigene Kennzahlen
   * für „Umsatzsteuer aus 19 %" und „Umsatzsteuer aus 7 %" gibt es nicht – die
   * Steuer rechnet das Formular selbst aus Kz 81 und Kz 86 aus.
   */
  kz_66: number;
  /**
   * Kz 83 – verbleibende Umsatzsteuer-Vorauszahlung, also die Zahllast.
   * Ein negativer Wert ist ein Erstattungsanspruch gegen das Finanzamt.
   */
  kz_83: number;
  /**
   * Summe der Einnahmen, die weder 19 % noch 7 % treffen (netto).
   *
   * Steuerfreie Umsätze, Reverse-Charge-Leistungen und Belege mit einem
   * krummen Steuersatz gehören in eigene Kennzahlen, die dieser Entwurf nicht
   * bedient. Früher sind sie ersatzlos verschwunden; jetzt stehen sie hier,
   * damit niemand eine Voranmeldung abgibt, in der ein Teil des Jahres fehlt.
   */
  nicht_zugeordnet: number;
  /** Anzahl der Belege hinter `nicht_zugeordnet` – für einen Warnhinweis in der Oberfläche. */
  nicht_zugeordnet_anzahl: number;
}

/**
 * Ordnet einen Beleg einem Regelsteuersatz zu.
 *
 * Die Erkennung läuft über das Verhältnis von Steuer zu Netto, weil der
 * Steuersatz am Beleg nicht gespeichert ist. Trifft das Verhältnis weder 19 %
 * noch 7 %, gibt die Funktion `null` zurück – der Beleg wird dann nicht still
 * ignoriert, sondern in `nicht_zugeordnet` gesammelt.
 */
function steuersatzVon(invoice: Invoice): 19 | 7 | null {
  if (Math.abs(invoice.netto) < 0.005) return null;
  const satz = invoice.ust / invoice.netto;
  if (Math.abs(satz - 0.19) < 0.02) return 19;
  if (Math.abs(satz - 0.07) < 0.02) return 7;
  return null;
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

  // Nur echte Betriebseinnahmen gehören in die Voranmeldung. Privateinlagen und
  // die Umsatzsteuererstattung vom Finanzamt sind zwar als Einnahme gebucht,
  // sind aber kein Umsatz – sie dürfen weder in eine Kennzahl noch in die
  // Liste der ungeklärten Belege wandern.
  const einnahmen = invoices.filter(
    (i) => i.type === 'einnahme' && inPeriod(i.date) && wirkungVon(i.category) === 'betriebseinnahme',
  );
  const ausgaben = invoices.filter((i) => i.type === 'ausgabe' && inPeriod(i.date));

  let umsatz19 = 0;
  let umsatz7 = 0;
  let nichtZugeordnet = 0;
  let nichtZugeordnetAnzahl = 0;

  for (const beleg of einnahmen) {
    // Ein Beleg ohne Betrag verändert keine Kennzahl und ist auch kein
    // ungeklärter Fall – er würde nur einen Warnhinweis über 0,00 EUR auslösen.
    if (Math.abs(beleg.netto) < 0.005 && Math.abs(beleg.ust) < 0.005) continue;

    const satz = steuersatzVon(beleg);
    if (satz === 19) umsatz19 += beleg.netto;
    else if (satz === 7) umsatz7 += beleg.netto;
    else {
      nichtZugeordnet += beleg.netto;
      nichtZugeordnetAnzahl += 1;
    }
  }

  // Vorsteuer nur aus Belegen, aus denen sie überhaupt gezogen werden darf
  // (§ 15 Abs. 1 UStG). Welche Kategorie das ist, entscheidet die zentrale
  // Tabelle in src/lib/steuer/kategorien.ts – Versicherungen und private Käufe
  // sind dort ausgenommen.
  const vorsteuer = ausgaben
    .filter((i) => istVorsteuerfaehig(i.category))
    .reduce((s, i) => s + i.ust, 0);

  // Die Umsatzsteuer selbst hat keine eigene Kennzahl, sie ergibt sich aus den
  // Bemessungsgrundlagen. Für die Zahllast muss sie hier trotzdem gerechnet
  // werden.
  const ust19 = umsatz19 * 0.19;
  const ust7 = umsatz7 * 0.07;
  const zahllast = ust19 + ust7 - vorsteuer;

  const q = period.type === 'quarter' ? period.q : Math.ceil(period.m / 3) as 1|2|3|4;
  const reportMonth = period.type === 'month' ? period.m : undefined;

  return {
    year,
    quarter: q,
    month: reportMonth,
    steuernummer: '',
    firmenname: '',
    kz_81: umsatz19,
    kz_86: umsatz7,
    kz_66: vorsteuer,
    kz_83: zahllast,
    nicht_zugeordnet: nichtZugeordnet,
    nicht_zugeordnet_anzahl: nichtZugeordnetAnzahl,
  };
}

/**
 * Bemessungsgrundlagen gibt das Formular in vollen Euro an, gerundet zugunsten
 * des Steuerpflichtigen – also zur Null hin abgeschnitten, damit auch eine
 * Stornobuchung mit negativem Vorzeichen richtig herum landet.
 */
function vollerEuro(v: number): string {
  return String(Math.trunc(v));
}

/** Steuerbeträge dagegen mit zwei Nachkommastellen. */
function euroMitCent(v: number): string {
  return (Math.round(v * 100) / 100).toFixed(2);
}

export function generateUstVaXml(data: UstVAData): string {
  const stnr = data.steuernummer.replace(/[/ ]/g, '');

  // ELSTER Zeitraum-Kennzeichen: Monate = "01"–"12", Quartale = "41"–"44"
  const period = data.month !== undefined
    ? String(data.month).padStart(2, '0')
    : String(40 + data.quarter);

  // Der Hinweis auf ungeklärte Umsätze steht als Kommentar mit im Datensatz,
  // damit er beim Nachsehen in der Datei nicht verloren geht.
  const offenerHinweis = data.nicht_zugeordnet_anzahl > 0
    ? `\n              <!-- ACHTUNG: ${data.nicht_zugeordnet_anzahl} Beleg(e) über ${euroMitCent(data.nicht_zugeordnet)} EUR sind keiner Kennzahl zugeordnet (steuerfrei, Reverse Charge oder abweichender Steuersatz) und fehlen in dieser Anmeldung. -->`
    : '';

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
              <Kz09>0</Kz09>${offenerHinweis}
              <!-- Kz 81: Umsätze zum Steuersatz 19 % (Bemessungsgrundlage) -->
              <Kz81>${vollerEuro(data.kz_81)}</Kz81>
              <!-- Kz 86: Umsätze zum Steuersatz 7 % (Bemessungsgrundlage) -->
              <Kz86>${vollerEuro(data.kz_86)}</Kz86>
              <!-- Kz 66: Vorsteuer aus Rechnungen von anderen Unternehmern -->
              <Kz66>${euroMitCent(data.kz_66)}</Kz66>
              <!-- Kz 83: verbleibende Umsatzsteuer-Vorauszahlung (Zahllast) -->
              <Kz83>${euroMitCent(data.kz_83)}</Kz83>
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
