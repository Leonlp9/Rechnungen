// ─── Die zweite Meinung ──────────────────────────────────────────────────────
//
// Was hier passiert, ist bewusst die kleinere Hälfte der Prüfung. Die
// Pflichtangaben prüft `pruefung.ts` mit festen Regeln – offline, sofort und
// ohne dass irgendwelche Daten das Gerät verlassen. Eine Sprachmaschine, die zu
// 95 Prozent merkt, dass die Steuernummer fehlt, wäre dafür zu wenig.
//
// Übrig bleibt das, was Regeln nicht können: Ist „Beratung" bestimmt genug?
// Passt „1 Monat" in der Position zu einem einzelnen Stichtag als
// Leistungszeitpunkt? Steht im Anschreiben ein Verweis auf etwas, das es gar
// nicht gibt? Das sind Ermessensfragen, und dafür ist ein Sprachmodell das
// richtige Werkzeug.
//
// Zwei Vorsichtsmaßnahmen stecken darin. Erstens bekommt das Modell die
// Befunde der harten Regeln mitgeteilt, damit es sie nicht ein zweites Mal
// meldet – doppelte Meldungen lassen eine Prüfung unbrauchbar wirken. Zweitens
// wird es ausdrücklich angewiesen zu schweigen, wenn es sich nicht sicher ist:
// Eine erfundene Rechtspflicht ist schädlicher als ein übersehener Schönheits-
// fehler, weil sie den Nutzer dazu bringt, eine richtige Rechnung zu ändern.
//
// Datenschutz: Für diese Prüfung gehen Rechnungsdaten samt Kundenname an
// Google. Deshalb hängt sie an derselben ausdrücklichen Zustimmung wie die
// übrigen KI-Funktionen und läuft nie ungefragt beim ersten Mal.

import { ensureGeminiConsent, getGeminiApiKey, hasGeminiConsent } from '@/lib/gemini';
import { blatttext, type Befund, type PruefEingabe } from './pruefung';

/** Gibt es überhaupt einen Schlüssel? Fragt bewusst nicht nach Zustimmung. */
export async function kiSchluesselDa(): Promise<boolean> {
  return !!(await getGeminiApiKey());
}

/** Schlüssel da UND schon zugestimmt – dann darf ungefragt geprüft werden. */
export async function kiBereit(): Promise<boolean> {
  return (await kiSchluesselDa()) && (await hasGeminiConsent());
}

const ANWEISUNG = `Du bist ein sehr erfahrener Buchhalter und liest eine deutsche Rechnung gegen, bevor sie
herausgeht. Du bist NICHT dafür zuständig, Pflichtangaben abzuhaken – das hat ein Programm bereits
zuverlässig getan, und seine Ergebnisse bekommst du unten mitgeteilt.

Deine Aufgabe ist das, was ein Programm nicht sehen kann:

1. UNKLARE LEISTUNGSBESCHREIBUNG. Ergibt sich aus der Rechnung eindeutig, wofür bezahlt wird?
   Ein Betriebsprüfer muss das ohne weitere Unterlagen verstehen können. Einzelne Wörter wie
   "Beratung", "Diverses" oder "Arbeitsleistung" reichen nicht.
2. WIDERSPRÜCHE zwischen den Angaben. Das häufigste Beispiel: Die Position spricht von einem
   Zeitraum ("1 Monat", "monatliche Pauschale"), während als Leistungszeitpunkt ein einzelner
   Stichtag steht. Dann gehört dort der Zeitraum hin, etwa "Juli 2026".
3. VERWEISE INS LEERE. Wird auf eine Anlage, einen Vertrag oder einen Lieferschein verwiesen,
   der gar nicht mitgeht?
4. UNPLAUSIBLES. Beträge, Mengen, Einheiten oder Daten, die nicht zusammenpassen.
5. SPRACHLICHE FEHLER, die auf der Rechnung peinlich wirken – aber nur echte Fehler, keine
   Geschmacksfragen.

REGELN, an die du dich halten musst:
- Melde NICHTS, was in der Liste der bereits gefundenen Punkte steht.
- Erfinde keine Rechtspflichten. Wenn du dir bei einer Vorschrift nicht sicher bist, lass den Punkt
  weg. Ein übersehener Schönheitsfehler ist harmlos; eine erfundene Pflicht bringt den Nutzer dazu,
  eine korrekte Rechnung zu verschlimmbessern.
- Der Aussteller ist Kleinunternehmer nach § 19 UStG, sofern unten nichts anderes steht. Er weist
  KEINE Umsatzsteuer aus, und das ist richtig so – melde das niemals als Fehler.
- Schreib auf Deutsch, in ganzen Sätzen, und sag jeweils konkret, was zu ändern ist.
- Sei sparsam. Lieber drei Punkte, die stimmen, als zehn, von denen sieben Rauschen sind.
- Findest du nichts, gib eine leere Liste zurück. Das ist ein gutes Ergebnis, kein Versagen.

Schweregrade:
- "fehler"  = geht so nicht heraus
- "warnung" = solltest du ändern
- "hinweis" = fiel mir auf`;

export async function pruefeMitKi(e: PruefEingabe, schonGefunden: Befund[]): Promise<Befund[]> {
  const zugestimmt = await ensureGeminiConsent();
  if (!zugestimmt) throw new Error('Ohne Zustimmung werden keine Rechnungsdaten übertragen.');

  const apiKey = await getGeminiApiKey();
  if (!apiKey) throw new Error('Kein Gemini-Schlüssel hinterlegt. Du findest das Feld unter Einstellungen.');

  const positionen = e.positionen
    .filter((p) => !p.isGroupHeader)
    .map((p, i) => `${i + 1}. „${p.description}" · Menge ${p.quantity} ${p.unit} · Einzelpreis ${p.unitPrice.toFixed(2)} EUR${p.discount ? ` · ${p.discount} % Rabatt` : ''}`)
    .join('\n');

  const bereitsGemeldet = schonGefunden.length
    ? schonGefunden.map((b) => `- ${b.titel}`).join('\n')
    : '(nichts)';

  const prompt = `${ANWEISUNG}

═══ SO SIEHT DIE FERTIGE RECHNUNG AUS ═══
Das ist der Text, der wirklich auf dem Papier steht:

${blatttext(e.seiten)}

═══ DIE EINGETRAGENEN WERTE ═══
Belegart:            ${e.art}
Rechnungsnummer:     ${e.werte.doc_number || '(leer)'}
Rechnungsdatum:      ${e.werte.doc_date || '(leer)'}
Leistungszeitpunkt:  ${e.werte.delivery_date || '(leer)'}
Fällig bis:          ${e.werte.due_date || '(leer)'}
Zahlungsbedingungen: ${e.werte.payment_terms || '(leer)'}
Anschreiben:         ${e.werte.notes || '(leer)'}
Steuerhinweis:       ${e.werte.legal_notice || '(leer)'}
Kleinunternehmer:    ${e.kleinunternehmer ? 'ja (§ 19 UStG, weist keine Umsatzsteuer aus)' : 'nein'}
Umsatzsteuer:        ${e.mitUst ? `ausgewiesen, ${e.ustSatz} %` : 'nicht ausgewiesen'}
Nettobetrag:         ${e.summen.netto.toFixed(2)} EUR
Steuer:              ${e.summen.steuer.toFixed(2)} EUR
Bruttobetrag:        ${e.summen.brutto.toFixed(2)} EUR

Positionen:
${positionen || '(keine)'}

═══ DAS HAT DAS PROGRAMM SCHON GEFUNDEN – NICHT WIEDERHOLEN ═══
${bereitsGemeldet}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const antwort = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          required: ['befunde'],
          properties: {
            befunde: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                required: ['schwere', 'titel', 'text'],
                properties: {
                  schwere: { type: 'STRING', enum: ['fehler', 'warnung', 'hinweis'] },
                  titel: { type: 'STRING' },
                  text: { type: 'STRING' },
                  feld: { type: 'STRING' },
                },
              },
            },
          },
        },
      },
    }),
  });

  if (!antwort.ok) {
    throw new Error(`Die KI-Prüfung ist fehlgeschlagen (${antwort.status}). ${await antwort.text()}`);
  }

  const daten = await antwort.json();
  const text = daten?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Die KI hat nichts zurückgegeben.');

  let roh: { befunde?: Array<{ schwere?: string; titel?: string; text?: string; feld?: string }> };
  try {
    roh = JSON.parse(text);
  } catch {
    throw new Error('Die Antwort der KI war nicht lesbar.');
  }

  // Alles, was zurückkommt, wird auf die eigenen Typen gezwungen. Ein Modell
  // kann trotz Schema Unfug liefern, und ein unbekannter Schweregrad würde die
  // Sortierung durcheinanderbringen.
  return (roh.befunde ?? [])
    .filter((b) => b.titel && b.text)
    .map((b) => ({
      schwere: b.schwere === 'fehler' ? 'fehler' as const
        : b.schwere === 'warnung' ? 'warnung' as const
          : 'hinweis' as const,
      titel: String(b.titel),
      text: String(b.text),
      feld: b.feld ? String(b.feld) : undefined,
      quelle: 'ki' as const,
    }));
}
