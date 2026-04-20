import { getSetting, setSetting } from '@/lib/db';
import { keyringLoad, keyringSave, keyringDelete } from '@/lib/keyring';
import type { GeminiResult} from '@/types';
import {HELP_CONTENT_TEXT} from '@/lib/helpContent';

// â”€â”€â”€ Gemini API Key (Keychain) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getGeminiApiKey(): Promise<string | null> {
  // Try keychain first, fall back to DB for backward compat
  const fromKeychain = await keyringLoad('gemini_api_key');
  if (fromKeychain) return fromKeychain;
  return await getSetting('gemini_api_key');
}

export async function saveGeminiApiKey(key: string): Promise<void> {
  await keyringSave('gemini_api_key', key);
  // Clear old DB entry
  await setSetting('gemini_api_key', '').catch(() => {});
}

export async function deleteGeminiApiKey(): Promise<void> {
  await keyringDelete('gemini_api_key');
  await setSetting('gemini_api_key', '').catch(() => {});
}

// â”€â”€â”€ DSGVO Consent â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function hasGeminiConsent(): Promise<boolean> {
  const consent = await getSetting('gemini_consent');
  return consent === 'true';
}

export async function setGeminiConsent(value: boolean): Promise<void> {
  await setSetting('gemini_consent', value ? 'true' : 'false');
}

export async function ensureGeminiConsent(): Promise<boolean> {
  if (await hasGeminiConsent()) return true;
  // Trigger global consent dialog and wait for result
  return new Promise<boolean>((resolve) => {
    geminiConsentEmitter.emit(resolve);
  });
}

// ─── Global consent event emitter ────────────────────────────────────────────
type ConsentResolver = (consented: boolean) => void;
class GeminiConsentEmitter {
  private listeners: Array<(resolver: ConsentResolver) => void> = [];
  on(fn: (resolver: ConsentResolver) => void) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter((l) => l !== fn); };
  }
  emit(resolver: ConsentResolver) {
    this.listeners.forEach((fn) => fn(resolver));
  }
}
export const geminiConsentEmitter = new GeminiConsentEmitter();

// â”€â”€â”€ AI Chat â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface GeminiChatMessage {
  role: 'user' | 'model';
  parts: [{ text: string }];
}

export interface ChatResponse {
  answer: string;
  followUps: string[];
  title?: string;
}

/**
 * Sends a chat message to Gemini with optional page context.
 * @param history Previous messages (role=user/model)
 * @param pageContext Stringified context of what the user currently sees
 * @param isFirstMessage Whether this is the first message in the session (for title generation)
 * @param pdfBase64 Optional PDF attachment (base64)
 */
export async function sendChatMessage(
    history: GeminiChatMessage[],
    pageContext: string,
    isFirstMessage: boolean,
    pdfBase64?: string | null,
): Promise<ChatResponse> {
  const consented = await ensureGeminiConsent();
  if (!consented) throw new Error('KI-Nutzung wurde nicht bestätigt.');

  const apiKey = await getGeminiApiKey();
  if (!apiKey) throw new Error('Kein Gemini API-Key hinterlegt. Bitte unter Einstellungen eingeben.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const systemPrompt = `Du bist ein hilfreicher KI-Assistent fÃ¼r den Rechnungs-Manager. Du kennst dich perfekt mit Buchhaltung, Steuern und dem Rechnungs-Manager aus.

## Hilfe-Dokumentation (immer aktuell):
${HELP_CONTENT_TEXT}

## Aktueller Seitenkontext (was der Nutzer gerade sieht):
${pageContext || 'Kein spezifischer Kontext verfÃ¼gbar.'}

## Deine Aufgaben:
- Beantworte Fragen des Nutzers hilfreich und prÃ¤zise auf Deutsch.
- Nutze die Kontextdaten um spezifische, personalisierte Antworten zu geben.
- Du kannst Navigations-Links zu anderen Seiten der App einfÃ¼gen mit der Syntax: [Linktext](/route)
  VerfÃ¼gbare Routen: / (Dashboard), /invoices (Alle Rechnungen), /invoices/ID (Rechnungsdetail mit konkreter ID), /write-invoice (Rechnung schreiben), /invoice-designer (Designer), /settings (Einstellungen), /help (Hilfe), /lists (Listen & Boards), /gmail (E-Mail)
  WICHTIG: Nutze IMMER relative Pfade mit fÃ¼hrendem / (z.B. /invoices). Einzelne Rechnungen kannst du direkt verlinken: wenn im Kontext z.B. "[ID:42]" steht, dann verlinke mit [Partnername](/invoices/42). Nie absolute URLs fÃ¼r App-Navigation.

- Auf der Rechnungsseite (/invoices) kannst du Filter als URL-Parameter setzen:
  â€¢ q=Suchbegriff        â†’ Freitext-Suche nach Partner/Beschreibung
  â€¢ type=einnahme        â†’ Typ-Filter (einnahme | ausgabe | info), mehrere mit Komma: type=einnahme,ausgabe
  â€¢ cat=software_abos   â†’ Kategorie-Filter, mehrere mit Komma
    VerfÃ¼gbare Kategorien (Einnahmen): umsatz_pflichtig, umsatz_steuerfrei, reverse_charge, ust_erstattung, privateinlage, anlagenverkauf, erstattungen, sponsoring, affiliate, donations_tips, sachzuwendungen, sonstige_einnahmen
    VerfÃ¼gbare Kategorien (Ausgaben): anlagevermoegen_afa, gwg, software_abos, fremdleistungen, buerobedarf, reisekosten, bewirtungskosten, marketing, weiterbildung, miete, versicherungen_betrieb, fahrzeugkosten, kommunikation, spenden, krankenkasse, sozialversicherung, privat, privatentnahme, sonstiges
    VerfÃ¼gbare Kategorien (Info): vertraege, sonstiges
  â€¢ fyear=2025           â†’ Jahres-Filter (Zahl oder "all")
  â€¢ sort=brutto&dir=desc â†’ Sortierung (date|partner|category|brutto|type, asc|desc)
  Beispiele:
    [Alle Software-Abos 2025](/invoices?cat=software_abos&fyear=2025)
    [Ausgaben sortiert nach Betrag](/invoices?type=ausgabe&sort=brutto&dir=desc)
    [Amazon-Rechnungen suchen](/invoices?q=Amazon&fyear=all)
- Antworte im Markdown-Format (Fett, Listen, etc. sind erlaubt).
- Halte Antworten klar und prÃ¤gnant.
${isFirstMessage ? '- Erstelle einen kurzen, prÃ¤gnanten Chat-Titel (max. 6 WÃ¶rter) basierend auf dem Thema.' : ''}`;

  const contents: GeminiChatMessage[] = [
    {role: 'user', parts: [{text: systemPrompt}]},
    {role: 'model', parts: [{text: 'Verstanden! Ich bin bereit, dir zu helfen.'}]},
    ...history,
  ];

  // If PDF is attached, add it to the last user message
  if (pdfBase64 && contents.length > 0) {
    const last = contents[contents.length - 1];
    if (last.role === 'user') {
      (last.parts as unknown[]).push({
        inline_data: {mime_type: 'application/pdf', data: pdfBase64},
      });
    }
  }

  const schema = isFirstMessage
      ? {
        type: 'OBJECT',
        required: ['answer', 'followUps', 'title'],
        properties: {
          answer: {type: 'STRING'},
          followUps: {type: 'ARRAY', items: {type: 'STRING'}, maxItems: 3},
          title: {type: 'STRING'},
        },
      }
      : {
        type: 'OBJECT',
        required: ['answer', 'followUps'],
        properties: {
          answer: {type: 'STRING'},
          followUps: {type: 'ARRAY', items: {type: 'STRING'}, maxItems: 3},
        },
      };

  const body = {
    contents,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API Fehler (${res.status}): ${err}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Keine Antwort von Gemini erhalten.');

  try {
    return JSON.parse(text) as ChatResponse;
  } catch {
    return {answer: text, followUps: []};
  }
}

import type {TemplateElement, ItemsElement, LineElement} from '@/types/template';
import {CANVAS_W, CANVAS_H, DEFAULT_FONT_FAMILY, FONT_FAMILIES} from '@/types/template';

export interface AiTemplateResult {
  name: string;
  elements: TemplateElement[];
}

function newId() {
  return `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function analyzeInvoiceLayoutWithAI(base64: string, mimeType: string): Promise<AiTemplateResult> {
  const consented = await ensureGeminiConsent();
  if (!consented) throw new Error('KI-Nutzung wurde nicht bestätigt.');

  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Kein Gemini API-Key hinterlegt. Bitte unter Einstellungen eingeben.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const prompt = `Du bist ein Experte fÃ¼r Rechnungsdesign. Analysiere das gegebene Rechnungsbild/-dokument und erstelle daraus ein prÃ¤zises JSON-Template-Layout.

Das Canvas hat die GrÃ¶ÃŸe ${CANVAS_W}Ã—${CANVAS_H}px (A4 bei 96dpi, Hochformat).

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
ELEMENTTYPEN
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

1. "text" â€“ Statischer, unverÃ¤nderlicher Textblock
   Verwenden fÃ¼r: fixe Labels ("Rechnung an:", "Datum:", "MwSt.:"), Ãœberschriften wie "RECHNUNG", FuÃŸzeilen, Hinweistexte

2. "variable" â€“ Dynamischer Platzhalter, der zur Laufzeit befÃ¼llt wird
   Verwenden fÃ¼r: alle Felder, die sich pro Rechnung Ã¤ndern (Name, Adresse, Datum, BetrÃ¤ge usw.)
   WICHTIG: variableKey MUSS eines der folgenden Systemfelder sein:
   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
   â”‚ variableKey         â”‚ Beschreibung / wann verwenden                       â”‚
   â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
   â”‚ sender_name         â”‚ Name/Firma des Rechnungsstellers (aus Profil)        â”‚
   â”‚ sender_address      â”‚ Adresse des Rechnungsstellers (aus Profil)           â”‚
   â”‚ sender_email        â”‚ E-Mail des Rechnungsstellers (aus Profil)            â”‚
   â”‚ sender_phone        â”‚ Telefon des Rechnungsstellers (aus Profil)           â”‚
   â”‚ sender_tax_number   â”‚ Steuernummer (aus Profil)                            â”‚
   â”‚ sender_vat_id       â”‚ USt-IdNr. (aus Profil)                              â”‚
   â”‚ sender_iban         â”‚ IBAN (aus Profil)                                    â”‚
   â”‚ sender_bic          â”‚ BIC (aus Profil)                                     â”‚
   â”‚ receiver_name       â”‚ Name/Firma des RechnungsempfÃ¤ngers                  â”‚
   â”‚ receiver_address    â”‚ Adresse des RechnungsempfÃ¤ngers                     â”‚
   â”‚ doc_number          â”‚ Rechnungsnummer / Dokumentennummer                  â”‚
   â”‚ doc_date            â”‚ Rechnungsdatum                                      â”‚
   â”‚ due_date            â”‚ FÃ¤lligkeitsdatum / Zahlungsziel                     â”‚
   â”‚ notes               â”‚ Hinweistext / Zahlungshinweis                       â”‚
   â”‚ netto               â”‚ Nettobetrag (automatisch aus Positionen berechnet)  â”‚
   â”‚ vat_amount          â”‚ MwSt.-Betrag (automatisch berechnet)                â”‚
   â”‚ total               â”‚ Gesamtbetrag Brutto (automatisch berechnet)         â”‚
   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
   "prefix" und "suffix" sind optionale Texte vor/nach dem Wert, z.B. prefix="IBAN: " oder suffix=" â‚¬"

3. "rectangle" â€“ Hintergrundrechteck, farbiger Balken, Rahmen
   Verwenden fÃ¼r: Kopfzeilenbalken, Box-HintergrÃ¼nde, farbige Akzente

4. "image" â€“ Bildplatzhalter (src bleibt immer leer "")
   Verwenden NUR wenn im Original ein Logo oder Bild sichtbar ist. Der User fÃ¼gt spÃ¤ter sein Bild ein.

5. "items" â€“ Die Positionstabelle (genau EINMAL, falls eine Tabelle mit Leistungspositionen vorhanden)
   EnthÃ¤lt Kopfzeile (Nr., Beschreibung, Menge, Einheit, Einzelpreis, Gesamtpreis) + automatische Zusammenfassung.

6. "line" â€“ Eine gerade Linie zwischen zwei Punkten
   Verwenden fÃ¼r: Trennlinien, horizontale Striche unter Ãœberschriften, dekorative Linien.
   Hat KEIN x/y/width/height, sondern x1,y1 (Startpunkt) und x2,y2 (Endpunkt) in Pixeln.

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
MAPPING-REGELN (was wird zu welchem Typ?)
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
- Firmenname des Absenders â†’ variable (sender_name)
- Adresse des Absenders â†’ variable (sender_address)
- E-Mail / Telefon des Absenders â†’ variable (sender_email / sender_phone)
- Steuernummer / USt-IdNr. â†’ variable (sender_tax_number / sender_vat_id)
- IBAN / BIC â†’ variable (sender_iban / sender_bic)
- "Rechnung an" / EmpfÃ¤ngername â†’ variable (receiver_name)
- EmpfÃ¤ngeradresse â†’ variable (receiver_address)
- Rechnungsnummer â†’ variable (doc_number)
- Datum der Rechnung â†’ variable (doc_date)
- Zahlungsziel / fÃ¤llig bis â†’ variable (due_date)
- Zahlungshinweis / Bankverbindungstext â†’ variable (notes)
- Netto-Betrag â†’ variable (netto)
- MwSt.-Betrag â†’ variable (vat_amount)
- Gesamtbetrag / Brutto â†’ variable (total)
- Felder wie "Netto:", "MwSt. (19%):", "Gesamt:" â†’ text (statische Labels!)
- Positionstabelle â†’ items
- Logos, Bilder â†’ image
- Farbige Balken, Boxen â†’ rectangle
- Trennlinien, horizontale Striche â†’ line

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
POSITIONIERUNGSREGELN
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
- Alle Koordinaten (x, y, width, height) in Pixeln auf dem ${CANVAS_W}Ã—${CANVAS_H}px Canvas
- Messe die Positionen so genau wie mÃ¶glich am Original ab
- zIndex: rectangle im Hintergrund = 1, text/variable/image = 5, Elemente Ã¼ber Rechtecken = 3
- Farben immer als Hex-Werte (#rrggbb), nie als CSS-Namen
- lineHeight: Zahl zwischen 1.0 und 2.0
- fontFamily: WÃ¤hle die Schriftart die optisch am besten zum Layout passt. Standard ist "Helvetica, Arial, sans-serif". MÃ¶gliche Werte: ${FONT_FAMILIES.map(f => `"${f.value}"`).join(', ')}

Gib dem Template einen passenden Namen basierend auf dem Stil (z.B. "Modernes Blau", "Klassisch Minimalistisch").`;

  const body = {
    contents: [
      {
        parts: [
          {text: prompt},
          {
            inline_data: {
              mime_type: mimeType,
              data: base64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: {
        type: 'object',
        required: ['name', 'elements'],
        properties: {
          name: {type: 'string', description: 'Name des Templates, z.B. "Modernes Blau"'},
          elements: {
            type: 'array',
            description: 'Alle Layout-Elemente des Templates',
            items: {
              type: 'object',
              required: ['type', 'x', 'y', 'width', 'height', 'zIndex'],
              properties: {
                type: {type: 'string', enum: ['text', 'variable', 'rectangle', 'image', 'items', 'line']},
                x: {type: 'number', description: 'X-Position in Pixeln (nicht fÃ¼r type=line)'},
                y: {type: 'number', description: 'Y-Position in Pixeln (nicht fÃ¼r type=line)'},
                width: {type: 'number', description: 'Breite in Pixeln (nicht fÃ¼r type=line)'},
                height: {type: 'number', description: 'HÃ¶he in Pixeln (nicht fÃ¼r type=line)'},
                // line-specific
                x1: {type: 'number', description: 'Nur fÃ¼r type=line: X-Koordinate Startpunkt'},
                y1: {type: 'number', description: 'Nur fÃ¼r type=line: Y-Koordinate Startpunkt'},
                x2: {type: 'number', description: 'Nur fÃ¼r type=line: X-Koordinate Endpunkt'},
                y2: {type: 'number', description: 'Nur fÃ¼r type=line: Y-Koordinate Endpunkt'},
                thickness: {type: 'number', description: 'Nur fÃ¼r type=line: LinienstÃ¤rke in px (z.B. 1 oder 2)'},
                zIndex: {type: 'integer', description: '1 = Hintergrund, 5 = Vordergrund'},
                // text & variable shared
                fontSize: {type: 'number'},
                fontWeight: {type: 'string', enum: ['normal', 'bold']},
                fontStyle: {type: 'string', enum: ['normal', 'italic']},
                fontFamily: {
                  type: 'string',
                  description: 'CSS-Schriftart-Stack, z.B. "Helvetica, Arial, sans-serif"',
                  enum: FONT_FAMILIES.map((f) => f.value),
                },
                color: {type: 'string', description: 'Hex-Farbe z.B. #111827'},
                backgroundColor: {type: 'string', description: 'Hex-Farbe oder "transparent"'},
                textAlign: {type: 'string', enum: ['left', 'center', 'right']},
                lineHeight: {type: 'number', minimum: 1.0, maximum: 2.0},
                // text only
                content: {type: 'string', description: 'Nur fÃ¼r type=text: der statische Text'},
                // variable only
                variableKey: {
                  type: 'string',
                  description: 'Nur fÃ¼r type=variable: SchlÃ¼ssel des Systemfeldes',
                  enum: [
                    'sender_name', 'sender_address', 'sender_email', 'sender_phone',
                    'sender_tax_number', 'sender_vat_id', 'sender_iban', 'sender_bic',
                    'receiver_name', 'receiver_address',
                    'doc_number', 'doc_date', 'due_date', 'notes',
                    'netto', 'vat_amount', 'total',
                  ],
                },
                prefix: {type: 'string', description: 'Optionaler Text vor dem Variablenwert, z.B. "IBAN: "'},
                suffix: {type: 'string', description: 'Optionaler Text nach dem Variablenwert'},
                // rectangle only
                borderColor: {type: 'string'},
                borderWidth: {type: 'number'},
                borderRadius: {type: 'number'},
                // image only
                src: {type: 'string', description: 'Immer leer "" â€“ User fÃ¼gt Bild spÃ¤ter ein'},
                objectFit: {type: 'string', enum: ['contain', 'cover', 'fill']},
                // items only
                rowHeight: {type: 'number', description: 'ZeilenhÃ¶he in px'},
                headerBgColor: {type: 'string'},
                headerTextColor: {type: 'string'},
                altRowBgColor: {type: 'string'},
                summaryBgColor: {type: 'string'},
                mwstRate: {type: 'number', description: 'MwSt.-Satz z.B. 19'},
                colWidths: {
                  type: 'array',
                  description: 'Spaltenbreiten als Anteile (Summe = 1.0), 6 Werte: [Nr, Beschreibung, Menge, Einheit, Einzelpreis, Gesamtpreis]',
                  items: {type: 'number', minimum: 0, maximum: 1},
                  minItems: 6,
                  maxItems: 6,
                },
              },
            },
          },
        },
      },
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API Fehler (${res.status}): ${err}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Keine Antwort von Gemini erhalten.');
  }

  let parsed: { name: string; elements: unknown[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Gemini-Antwort konnte nicht als JSON geparst werden.');
  }

  // Normalize & assign IDs
  const elements: TemplateElement[] = (parsed.elements ?? []).map((raw: unknown) => {
    const el = raw as Record<string, unknown>;
    const base = {
      id: newId(),
      x: Number(el.x ?? 0),
      y: Number(el.y ?? 0),
      width: Number(el.width ?? 100),
      height: Number(el.height ?? 40),
      zIndex: Number(el.zIndex ?? 5),
    };
    if (el.type === 'rectangle') {
      return {
        ...base,
        type: 'rectangle' as const,
        backgroundColor: String(el.backgroundColor ?? 'transparent'),
        borderColor: String(el.borderColor ?? '#000000'),
        borderWidth: Number(el.borderWidth ?? 1),
        borderRadius: Number(el.borderRadius ?? 0)
      };
    }
    if (el.type === 'image') {
      return {
        ...base,
        type: 'image' as const,
        src: '',
        objectFit: (el.objectFit as 'contain' | 'cover' | 'fill') ?? 'contain'
      };
    }
    if (el.type === 'items') {
      const cols = Array.isArray(el.colWidths) ? el.colWidths as [number, number, number, number, number, number] : [0.07, 0.38, 0.1, 0.1, 0.15, 0.2] as [number, number, number, number, number, number];
      return {
        ...base,
        type: 'items' as const,
        fontSize: Number(el.fontSize ?? 10),
        rowHeight: Number(el.rowHeight ?? 24),
        headerBgColor: String(el.headerBgColor ?? '#1e3a5f'),
        headerTextColor: String(el.headerTextColor ?? '#ffffff'),
        borderColor: String(el.borderColor ?? '#d1d5db'),
        altRowBgColor: String(el.altRowBgColor ?? '#f8fafc'),
        summaryBgColor: String(el.summaryBgColor ?? '#1e3a5f'),
        mwstRate: Number(el.mwstRate ?? 19),
        colWidths: cols
      } as ItemsElement;
    }
    if (el.type === 'line') {
      return {
        id: newId(),
        type: 'line' as const,
        zIndex: Number(el.zIndex ?? 3),
        x1: Number(el.x1 ?? 40), y1: Number(el.y1 ?? 200),
        x2: Number(el.x2 ?? 754), y2: Number(el.y2 ?? 200),
        color: String(el.color ?? '#d1d5db'),
        thickness: Number(el.thickness ?? 1),
        style: (el.style as LineElement['style']) ?? 'solid',
      } as unknown as TemplateElement;
    }
    if (el.type === 'variable') {
      return {
        ...base,
        type: 'variable' as const,
        variableKey: String(el.variableKey ?? ''),
        prefix: String(el.prefix ?? ''),
        suffix: String(el.suffix ?? ''),
        fontSize: Number(el.fontSize ?? 12),
        fontWeight: (el.fontWeight as 'normal' | 'bold') ?? 'normal',
        fontStyle: (el.fontStyle as 'normal' | 'italic') ?? 'normal',
        fontFamily: String(el.fontFamily ?? DEFAULT_FONT_FAMILY),
        color: String(el.color ?? '#2563eb'),
        backgroundColor: String(el.backgroundColor ?? 'transparent'),
        textAlign: (el.textAlign as 'left' | 'center' | 'right') ?? 'left',
        lineHeight: Number(el.lineHeight ?? 1.3)
      };
    }
    // default: text
    return {
      ...base,
      type: 'text' as const,
      content: String(el.content ?? ''),
      fontSize: Number(el.fontSize ?? 12),
      fontWeight: (el.fontWeight as 'normal' | 'bold') ?? 'normal',
      fontStyle: (el.fontStyle as 'normal' | 'italic') ?? 'normal',
      fontFamily: String(el.fontFamily ?? DEFAULT_FONT_FAMILY),
      color: String(el.color ?? '#111827'),
      backgroundColor: String(el.backgroundColor ?? 'transparent'),
      textAlign: (el.textAlign as 'left' | 'center' | 'right') ?? 'left',
      lineHeight: Number(el.lineHeight ?? 1.3)
    };
  });

  return {name: parsed.name ?? 'KI-Template', elements};
}

export async function analyzeInvoicePdf(base64: string, recentInvoices?: import('@/types').Invoice[]): Promise<GeminiResult> {
  const consented = await ensureGeminiConsent();
  if (!consented) throw new Error('KI-Nutzung wurde nicht bestätigt.');

  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Kein Gemini API-Key hinterlegt. Bitte unter Einstellungen eingeben.');
  }

  // Load user profile for context
  const profileKeys = [
    'profile_name', 'profile_address', 'profile_tax_number', 'profile_vat_id',
    'profile_iban', 'profile_bic', 'profile_email', 'profile_phone', 'profile_business_type',
  ];
  const profileEntries = await Promise.all(
    profileKeys.map(async (k) => [k.replace('profile_', ''), await getSetting(k) ?? ''] as const)
  );
  const profile = Object.fromEntries(profileEntries);
  const hasProfile = Object.values(profile).some((v) => v.length > 0);

  const aiInstructions = await getSetting('profile_ai_instructions') ?? '';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  let profileContext = '';
  if (hasProfile) {
    profileContext = `
KONTEXT â€“ Der Benutzer dieser Software ist:
- Name/Firma: ${profile.name || '(nicht angegeben)'}
- Adresse: ${profile.address || '(nicht angegeben)'}
- Steuernummer: ${profile.tax_number || '(nicht angegeben)'}
- USt-IdNr.: ${profile.vat_id || '(nicht angegeben)'}
- IBAN: ${profile.iban || '(nicht angegeben)'}
- Branche/TÃ¤tigkeit: ${profile.business_type || '(nicht angegeben)'}

Nutze diese Informationen, um zu entscheiden:
- Wenn der Benutzer der EMPFÃ„NGER der Leistung ist (er bezahlt), dann type = "ausgabe".
- Wenn der Benutzer der ERBRINGER der Leistung ist (er bekommt Geld), dann type = "einnahme".
- "partner" ist immer die ANDERE Partei (nicht der Benutzer selbst).
`;
  }

  // Build known partners context from last 360 days
  let knownPartnersContext = '';
  if (recentInvoices && recentInvoices.length > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 360);
    const recentPartners = [...new Set(
      recentInvoices
        .filter((inv) => new Date(inv.date) >= cutoff)
        .map((inv) => inv.partner)
        .filter(Boolean)
    )].slice(0, 100);
    if (recentPartners.length > 0) {
      knownPartnersContext = `
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
BEKANNTE PARTNER (letzte 360 Tage) â€“ verwende exakt diese Schreibweise wenn der Partner Ã¼bereinstimmt:
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
${recentPartners.map((p) => `- ${p}`).join('\n')}

WICHTIG: Wenn der Aussteller/EmpfÃ¤nger der Rechnung einem dieser Partner entspricht, Ã¼bernimm dessen Namen EXAKT so wie er hier steht (gleiche GroÃŸ-/Kleinschreibung, gleiche AbkÃ¼rzungen).
`;
    }
  }

  const prompt = `Analysiere diese PDF-Rechnung/Dokument und extrahiere die folgenden Informationen als JSON.
Antworte NUR mit validem JSON, kein Markdown, kein Text drumherum.
${profileContext}${knownPartnersContext}${aiInstructions.trim() ? `
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
PERSÃ–NLICHE KI-ANWEISUNGEN DES NUTZERS (hÃ¶chste PrioritÃ¤t â€“ halte dich strikt daran):
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
${aiInstructions.trim()}

` : ''}
JSON-Schema:
{
  "date": "YYYY-MM-DD (Rechnungsdatum)",
  "description": "Kurze Beschreibung des Inhalts",
  "partner": "Name des Rechnungsstellers oder -empfÃ¤ngers",
  "netto": 0.00,
  "ust": 0.00,
  "brutto": 0.00,
  "currency": "EUR",
  "type": "einnahme | ausgabe | info",
  "suggested_category": "umsatz_pflichtig | umsatz_steuerfrei | reverse_charge | ust_erstattung | privateinlage | anlagenverkauf | erstattungen | sponsoring | affiliate | donations_tips | sachzuwendungen | sonstige_einnahmen | anlagevermoegen_afa | gwg | software_abos | fremdleistungen | buerobedarf | reisekosten | bewirtungskosten | marketing | weiterbildung | miete | versicherungen_betrieb | fahrzeugkosten | kommunikation | vertraege | spenden | krankenkasse | sozialversicherung | privat | privatentnahme | sonstiges"
}

=== REGELN FÃœR "type" ===
- "einnahme": Der Benutzer BEKOMMT Geld (z.B. eine Rechnung die ER gestellt hat, Gutschrift an ihn).
- "ausgabe": Der Benutzer BEZAHLT etwas (z.B. Rechnung von einem Lieferanten/Dienstleister).
- "info": Kein Geldfluss â€“ z.B. VertrÃ¤ge, AGBs, BestÃ¤tigungen, Informationsschreiben, Vertragsdokumente.

=== REGELN FÃœR "suggested_category" ===
WÃ¤hle die passendste Kategorie â€“ WICHTIG: Die Kategorie MUSS zum Typ passen!

EINNAHMEN (NUR wenn type="einnahme"):
- "umsatz_pflichtig": Standard-UmsÃ¤tze mit 19% oder 7% MwSt (Rechnungen, Honorare, Dienstleistungen).
- "umsatz_steuerfrei": Einnahmen ohne MwSt (Kleinunternehmer Â§19 UStG, steuerfreie Leistungen).
- "reverse_charge": Reverse Charge (Â§ 13b UStG) â€“ Einnahmen von auslÃ¤ndischen Plattformen (z.B. Twitch, YouTube/Google Ireland, Amazon KDP). Netto-Rechnung, Steuerschuldumkehr.
- "ust_erstattung": Geld vom Finanzamt zurÃ¼ck (Umsatzsteuererstattung).
- "privateinlage": Privates Geld ins Unternehmen eingelegt (kein steuerpflichtiger Gewinn).
- "anlagenverkauf": ErlÃ¶s aus Verkauf von FirmengerÃ¤ten, MÃ¶beln, Fahrzeugen etc.
- "erstattungen": RÃ¼ckerstattungen, Gutschriften, Auslagenerstattungen an den Benutzer (durchlaufender Posten).
- "sponsoring": Sponsoring / Werbeleistung â€“ Zahlungen von Sponsoren fÃ¼r Werbeplatzierung, Product Placement.
- "affiliate": Affiliate / Vermittlungsprovision â€“ Provisionen aus Affiliate-Links, Empfehlungsprogrammen.
- "donations_tips": Donations / Tips (Streaming) â€“ freiwillige Zuschauerzahlungen (Twitch Bits, YouTube Super Chat, Ko-fi, PayPal.me). Sind Betriebseinnahmen!
- "sachzuwendungen": Sachzuwendungen â€“ erhaltene Produkte/PR-Samples, Marktwert als Einnahme ansetzen.
- "sonstige_einnahmen": Alle anderen Einnahmen (Crowdfunding, sonstige ErtrÃ¤ge).

BETRIEBSAUSGABEN (NUR wenn type="ausgabe"):
- "anlagevermoegen_afa": Anschaffungen > 800â‚¬ netto, die Ã¼ber Jahre abgeschrieben werden (z.B. Laptop, Maschinen, MÃ¶bel Ã¼ber 800â‚¬).
- "gwg": Geringwertige WirtschaftsgÃ¼ter â‰¤ 800â‚¬ netto (z.B. Monitor, Tastatur, BÃ¼rostuhl, KleingerÃ¤te).
- "software_abos": Software-Lizenzen, SaaS-Abos, Cloud-Dienste (Adobe, GitHub, Hosting, Microsoft 365).
- "fremdleistungen": Leistungen von Dritten/Subunternehmern (Freelancer, Agentur, externer Entwickler).
- "buerobedarf": BÃ¼romaterial, Druckerpatronen, Papier, Kleinmaterial.
- "reisekosten": Fahrtkosten, Hotel, FlÃ¼ge, Bahnfahrten fÃ¼r berufliche Reisen, Spesen, Verpflegungsmehraufwand.
- "bewirtungskosten": GeschÃ¤ftliche Bewirtung â€“ Restaurantbesuche mit GeschÃ¤ftspartnern, nur 70 % absetzbar. NICHT fÃ¼r private Restaurantbesuche (â†’ privat)!
- "marketing": Werbung, Social-Media-Anzeigen, Drucksachen, Messen, PR.
- "weiterbildung": Kurse, Seminare, FachbÃ¼cher, Online-Kurse, Konferenztickets.
- "miete": BÃ¼romiete, Co-Working, Lagermiete, Raumkosten.
- "versicherungen_betrieb": Betriebliche Versicherungen (Haftpflicht, BerufsunfÃ¤higkeit, Inventar).
- "fahrzeugkosten": KFZ-Kosten, Benzin, Leasing, Reparatur fÃ¼r betriebliche Fahrzeuge.
- "kommunikation": Telefon, Mobilfunk, Internet, Festnetz fÃ¼r den Betrieb.

SONDERAUSGABEN (NUR wenn type="ausgabe"):
- "spenden": NUR wenn der Benutzer eine Spende ZAHLT an eine gemeinnÃ¼tzige Organisation. NICHT fÃ¼r Twitch-Subs oder Gaming!
- "krankenkasse": BeitrÃ¤ge zur gesetzlichen oder privaten Krankenversicherung, Pflegeversicherung.
- "sozialversicherung": Rentenversicherung, Altersvorsorge, Berufsgenossenschaft.

PRIVAT (NUR wenn type="ausgabe"):
- "privat": Rein private Ausgaben (Twitch-Subs, Netflix, Spotify, private EinkÃ¤ufe, Restaurantbesuche privat). NICHT steuerlich relevant.
- "privatentnahme": Geldentnahme aus dem Betrieb fÃ¼r private Zwecke.

INFO (NUR wenn type="info"):
- "vertraege": VertrÃ¤ge, Vereinbarungen, AGBs, BestÃ¤tigungen, Informationsschreiben.
- "sonstiges": Alle anderen Info-Dokumente.

SONSTIGES:
- "sonstiges": Ausgaben, die in keine andere Ausgaben-Kategorie passen.

WICHTIG:
- VertrÃ¤ge/Vereinbarungen â†’ type="info", suggested_category="vertraege"
- Erhaltene Spenden/Donations â†’ type="einnahme", suggested_category="sonstige_einnahmen"
- Gezahlte Spenden â†’ type="ausgabe", suggested_category="spenden"
- Krankenkasse/Sozialversicherung â†’ type="ausgabe", suggested_category="krankenkasse" oder "sozialversicherung"
- BetrÃ¤ge als Zahlen (nicht Strings). Wenn kein Betrag erkennbar â†’ netto=0, ust=0, brutto=0.
- Bei VertrÃ¤gen ohne konkreten Rechnungsbetrag: setze BetrÃ¤ge auf 0.
- Kategorien fÃ¼r Einnahmen DÃœRFEN NICHT fÃ¼r Ausgaben verwendet werden und umgekehrt!`;

  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: 'application/pdf',
              data: base64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          date: { type: 'STRING' },
          description: { type: 'STRING' },
          partner: { type: 'STRING' },
          netto: { type: 'NUMBER' },
          ust: { type: 'NUMBER' },
          brutto: { type: 'NUMBER' },
          currency: { type: 'STRING' },
          type: { type: 'STRING', enum: ['einnahme', 'ausgabe', 'info'] },
          suggested_category: {
            type: 'STRING',
            enum: ['umsatz_pflichtig', 'umsatz_steuerfrei', 'reverse_charge', 'ust_erstattung', 'privateinlage', 'anlagenverkauf', 'erstattungen', 'sponsoring', 'affiliate', 'donations_tips', 'sachzuwendungen', 'sonstige_einnahmen', 'anlagevermoegen_afa', 'gwg', 'software_abos', 'fremdleistungen', 'buerobedarf', 'reisekosten', 'bewirtungskosten', 'marketing', 'weiterbildung', 'miete', 'versicherungen_betrieb', 'fahrzeugkosten', 'kommunikation', 'vertraege', 'spenden', 'krankenkasse', 'sozialversicherung', 'privat', 'privatentnahme', 'sonstiges'],
          },
        },
        required: ['date', 'description', 'partner', 'netto', 'ust', 'brutto', 'currency', 'type', 'suggested_category'],
      },
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API Fehler (${res.status}): ${err}`);
  }

  const data = await res.json();

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Keine Antwort von Gemini erhalten.');
  }

  try {
    return JSON.parse(text) as GeminiResult;
  } catch {
    throw new Error('Gemini-Antwort konnte nicht als JSON geparst werden.');
  }
}


