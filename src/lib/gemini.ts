import { getSetting, setSetting } from '@/lib/db';
import { keyringLoad, keyringSave, keyringDelete } from '@/lib/keyring';
import type { GeminiResult} from '@/types';
import {HELP_CONTENT_TEXT} from '@/lib/helpContent';

// ─── Gemini API Key (Keychain) ────────────────────────────────────────────────

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

// ─── DSGVO Consent ───────────────────────────────────────────────────────────

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

// --- Global consent event emitter --------------------------------------------
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

// ─── AI Chat ────────────────────────────────────────────────────────────────

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
  if (!consented) throw new Error('KI-Nutzung wurde nicht best�tigt.');

  const apiKey = await getGeminiApiKey();
  if (!apiKey) throw new Error('Kein Gemini API-Key hinterlegt. Bitte unter Einstellungen eingeben.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const systemPrompt = `Du bist ein hilfreicher KI-Assistent für den Klevr. Du kennst dich perfekt mit Buchhaltung, Steuern und dem Klevr aus.

## Hilfe-Dokumentation (immer aktuell):
${HELP_CONTENT_TEXT}

## Aktueller Seitenkontext (was der Nutzer gerade sieht):
${pageContext || 'Kein spezifischer Kontext verfügbar.'}

## Deine Aufgaben:
- Beantworte Fragen des Nutzers hilfreich und präzise auf Deutsch.
- Nutze die Kontextdaten um spezifische, personalisierte Antworten zu geben.
- Du kannst Navigations-Links zu anderen Seiten der App einfügen mit der Syntax: [Linktext](/route)
  Verfügbare Routen: / (Dashboard), /invoices (Alle Rechnungen), /invoices/ID (Rechnungsdetail mit konkreter ID), /write-invoice (Rechnung schreiben), /invoice-designer (Designer), /settings (Einstellungen), /help (Hilfe), /lists (Listen & Boards), /gmail (E-Mail)
  WICHTIG: Nutze IMMER relative Pfade mit führendem / (z.B. /invoices). Einzelne Rechnungen kannst du direkt verlinken: wenn im Kontext z.B. "[ID:42]" steht, dann verlinke mit [Partnername](/invoices/42). Nie absolute URLs für App-Navigation.

- Auf der Rechnungsseite (/invoices) kannst du Filter als URL-Parameter setzen:
  • q=Suchbegriff        → Freitext-Suche nach Partner/Beschreibung
  • type=einnahme        → Typ-Filter (einnahme | ausgabe | info), mehrere mit Komma: type=einnahme,ausgabe
  • cat=software_abos   → Kategorie-Filter, mehrere mit Komma
    Verfügbare Kategorien (Einnahmen): umsatz_pflichtig, umsatz_steuerfrei, reverse_charge, ust_erstattung, privateinlage, anlagenverkauf, erstattungen, sponsoring, affiliate, donations_tips, sachzuwendungen, sonstige_einnahmen
    Verfügbare Kategorien (Ausgaben): anlagevermoegen_afa, gwg, software_abos, fremdleistungen, buerobedarf, reisekosten, bewirtungskosten, marketing, weiterbildung, miete, versicherungen_betrieb, fahrzeugkosten, kommunikation, spenden, krankenkasse, sozialversicherung, privat, privatentnahme, sonstiges
    Verfügbare Kategorien (Info): vertraege, sonstiges
  • fyear=2025           → Jahres-Filter (Zahl oder "all")
  • sort=brutto&dir=desc → Sortierung (date|partner|category|brutto|type, asc|desc)
  Beispiele:
    [Alle Software-Abos 2025](/invoices?cat=software_abos&fyear=2025)
    [Ausgaben sortiert nach Betrag](/invoices?type=ausgabe&sort=brutto&dir=desc)
    [Amazon-Rechnungen suchen](/invoices?q=Amazon&fyear=all)
- Antworte im Markdown-Format (Fett, Listen, etc. sind erlaubt).
- Halte Antworten klar und prägnant.
${isFirstMessage ? '- Erstelle einen kurzen, prägnanten Chat-Titel (max. 6 Wörter) basierend auf dem Thema.' : ''}`;

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

import type {TemplateElement, ItemsElement, LineElement, QrCodeElement} from '@/types/template';
import {CANVAS_W, CANVAS_H, DEFAULT_FONT_FAMILY, FONT_FAMILIES} from '@/types/template';

export interface AiTemplateResult {
  name: string;
  elements: TemplateElement[];
}

function newId() {
  return `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function analyzeInvoiceLayoutWithAI(base64: string, mimeType: string, userPrompt?: string): Promise<AiTemplateResult>;
export async function analyzeInvoiceLayoutWithAI(input: {
  base64?: string;
  mimeType?: string;
  userPrompt?: string;
}): Promise<AiTemplateResult>;
export async function analyzeInvoiceLayoutWithAI(
  inputOrBase64: { base64?: string; mimeType?: string; userPrompt?: string } | string,
  mimeTypeArg?: string,
  userPromptArg?: string,
): Promise<AiTemplateResult> {
  const { base64, mimeType, userPrompt } = typeof inputOrBase64 === 'string'
    ? { base64: inputOrBase64, mimeType: mimeTypeArg, userPrompt: userPromptArg }
    : inputOrBase64;
  if (!base64 && !userPrompt?.trim()) {
    throw new Error('Bitte Prompt oder Datei für die KI-Analyse angeben.');
  }
  const consented = await ensureGeminiConsent();
  if (!consented) throw new Error('KI-Nutzung wurde nicht best�tigt.');

  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Kein Gemini API-Key hinterlegt. Bitte unter Einstellungen eingeben.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const prompt = `Du bist ein Experte für Rechnungsdesign. Analysiere das gegebene Rechnungsbild/-dokument und/oder die Nutzeranweisung und erstelle daraus ein präzises JSON-Template-Layout.

Das Canvas hat die Größe ${CANVAS_W}×${CANVAS_H}px (A4 bei 96dpi, Hochformat).

═══════════════════════════════════════════════════════
ELEMENTTYPEN
═══════════════════════════════════════════════════════

1. "text" – Statischer, unveränderlicher Textblock
   Verwenden für: fixe Labels ("Rechnung an:", "Datum:", "MwSt.:"), Überschriften wie "RECHNUNG", Fußzeilen, Hinweistexte

2. "variable" – Dynamischer Platzhalter, der zur Laufzeit befüllt wird
   Verwenden für: alle Felder, die sich pro Rechnung ändern (Name, Adresse, Datum, Beträge usw.)
   WICHTIG: variableKey MUSS eines der folgenden Systemfelder sein:
   ┌─────────────────────┬─────────────────────────────────────────────────────┐
   │ variableKey         │ Beschreibung / wann verwenden                       │
   ├─────────────────────┼─────────────────────────────────────────────────────┤
   │ sender_name         │ Name/Firma des Rechnungsstellers (aus Profil)        │
   │ sender_address      │ Adresse des Rechnungsstellers (aus Profil)           │
   │ sender_email        │ E-Mail des Rechnungsstellers (aus Profil)            │
   │ sender_phone        │ Telefon des Rechnungsstellers (aus Profil)           │
   │ sender_tax_number   │ Steuernummer (aus Profil)                            │
   │ sender_vat_id       │ USt-IdNr. (aus Profil)                              │
   │ sender_iban         │ IBAN (aus Profil)                                    │
   │ sender_bic          │ BIC (aus Profil)                                     │
   │ receiver_name       │ Name/Firma des Rechnungsempfängers                  │
   │ receiver_address    │ Adresse des Rechnungsempfängers                     │
   │ doc_number          │ Rechnungsnummer / Dokumentennummer                  │
   │ doc_date            │ Rechnungsdatum                                      │
   │ due_date            │ Fälligkeitsdatum / Zahlungsziel                     │
   │ notes               │ Hinweistext / Zahlungshinweis                       │
   │ netto               │ Nettobetrag (automatisch aus Positionen berechnet)  │
   │ vat_amount          │ MwSt.-Betrag (automatisch berechnet)                │
   │ total               │ Gesamtbetrag Brutto (automatisch berechnet)         │
   └─────────────────────┴─────────────────────────────────────────────────────┘
   "prefix" und "suffix" sind optionale Texte vor/nach dem Wert, z.B. prefix="IBAN: " oder suffix=" €"

3. "rectangle" – Hintergrundrechteck, farbiger Balken, Rahmen
   Verwenden für: Kopfzeilenbalken, Box-Hintergründe, farbige Akzente

4. "image" – Bildplatzhalter (src bleibt immer leer "")
   Verwenden NUR wenn im Original ein Logo oder Bild sichtbar ist. Der User fügt später sein Bild ein.

5. "items" – Die Positionstabelle (genau EINMAL, falls eine Tabelle mit Leistungspositionen vorhanden)
   Enthält Kopfzeile (Nr., Beschreibung, Menge, Einheit, Einzelpreis, Gesamtpreis) + automatische Zusammenfassung.

6. "line" – Eine gerade Linie zwischen zwei Punkten
   Verwenden für: Trennlinien, horizontale Striche unter Überschriften, dekorative Linien.
   Hat KEIN x/y/width/height, sondern x1,y1 (Startpunkt) und x2,y2 (Endpunkt) in Pixeln.

7. "qr_code" – EPC/GiroCode Platzhalter
   Verwenden für: Bereiche mit Hinweis auf Bezahl-QR, GiroCode, EPC QR, "Scan & Pay".
   Übliche Position: nahe Summen-/Zahlungsbereich, meist unten rechts.

═══════════════════════════════════════════════════════
MAPPING-REGELN (was wird zu welchem Typ?)
═══════════════════════════════════════════════════════
- Firmenname des Absenders → variable (sender_name)
- Adresse des Absenders → variable (sender_address)
- E-Mail / Telefon des Absenders → variable (sender_email / sender_phone)
- Steuernummer / USt-IdNr. → variable (sender_tax_number / sender_vat_id)
- IBAN / BIC → variable (sender_iban / sender_bic)
- "Rechnung an" / Empfängername → variable (receiver_name)
- Empfängeradresse → variable (receiver_address)
- Rechnungsnummer → variable (doc_number)
- Datum der Rechnung → variable (doc_date)
- Zahlungsziel / fällig bis → variable (due_date)
- Zahlungshinweis / Bankverbindungstext → variable (notes)
- Netto-Betrag → variable (netto)
- MwSt.-Betrag → variable (vat_amount)
- Gesamtbetrag / Brutto → variable (total)
- Felder wie "Netto:", "MwSt. (19%):", "Gesamt:" → text (statische Labels!)
- Positionstabelle → items
- Logos, Bilder → image
- Farbige Balken, Boxen → rectangle
- Trennlinien, horizontale Striche → line
- Bereiche "GiroCode", "EPC QR", "Bezahl-QR" → qr_code

═══════════════════════════════════════════════════════
POSITIONIERUNGSREGELN
═══════════════════════════════════════════════════════
- Alle Koordinaten (x, y, width, height) in Pixeln auf dem ${CANVAS_W}×${CANVAS_H}px Canvas
- Messe die Positionen so genau wie möglich am Original ab
- zIndex: rectangle im Hintergrund = 1, text/variable/image = 5, Elemente über Rechtecken = 3
- Farben immer als Hex-Werte (#rrggbb), nie als CSS-Namen
- lineHeight: Zahl zwischen 1.0 und 2.0
- fontFamily: Wähle die Schriftart die optisch am besten zum Layout passt. Standard ist "Helvetica, Arial, sans-serif". Mögliche Werte: ${FONT_FAMILIES.map(f => `"${f.value}"`).join(', ')}

Gib dem Template einen passenden Namen basierend auf dem Stil (z.B. "Modernes Blau", "Klassisch Minimalistisch").

${userPrompt?.trim() ? `
═══════════════════════════════════════════════════════
NUTZER-ANWEISUNG (zusätzlich beachten)
═══════════════════════════════════════════════════════
${userPrompt.trim()}
` : ''}`;

  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  if (base64 && mimeType) {
    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: base64,
      },
    });
  }

  const body = {
    contents: [
      {
        parts,
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
                type: {type: 'string', enum: ['text', 'variable', 'rectangle', 'image', 'items', 'line', 'qr_code']},
                x: {type: 'number', description: 'X-Position in Pixeln (nicht für type=line)'},
                y: {type: 'number', description: 'Y-Position in Pixeln (nicht für type=line)'},
                width: {type: 'number', description: 'Breite in Pixeln (nicht für type=line)'},
                height: {type: 'number', description: 'Höhe in Pixeln (nicht für type=line)'},
                // line-specific
                x1: {type: 'number', description: 'Nur für type=line: X-Koordinate Startpunkt'},
                y1: {type: 'number', description: 'Nur für type=line: Y-Koordinate Startpunkt'},
                x2: {type: 'number', description: 'Nur für type=line: X-Koordinate Endpunkt'},
                y2: {type: 'number', description: 'Nur für type=line: Y-Koordinate Endpunkt'},
                thickness: {type: 'number', description: 'Nur für type=line: Linienstärke in px (z.B. 1 oder 2)'},
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
                content: {type: 'string', description: 'Nur für type=text: der statische Text'},
                // variable only
                variableKey: {
                  type: 'string',
                  description: 'Nur für type=variable: Schlüssel des Systemfeldes',
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
                src: {type: 'string', description: 'Immer leer "" – User fügt Bild später ein'},
                objectFit: {type: 'string', enum: ['contain', 'cover', 'fill']},
                // items only
                rowHeight: {type: 'number', description: 'Zeilenhöhe in px'},
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
                // qr_code only
                label: {type: 'string'},
                fgColor: {type: 'string'},
                bgColor: {type: 'string'},
                padding: {type: 'number'},
                labelColor: {type: 'string'},
                showLabel: {type: 'boolean'},
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
        groupSubtotalBgColor: String(el.groupSubtotalBgColor ?? '#f3f4f6'),
        groupSubtotalTextColor: String(el.groupSubtotalTextColor ?? '#7c3aed'),
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
    if (el.type === 'qr_code') {
      return {
        ...base,
        type: 'qr_code' as const,
        label: String(el.label ?? 'EPC-QR'),
        fgColor: String(el.fgColor ?? '#111827'),
        bgColor: String(el.bgColor ?? '#ffffff'),
        borderColor: String(el.borderColor ?? '#d1d5db'),
        borderWidth: Number(el.borderWidth ?? 1),
        borderRadius: Number(el.borderRadius ?? 6),
        padding: Number(el.padding ?? 6),
        labelColor: String(el.labelColor ?? '#6366f1'),
        showLabel: Boolean(el.showLabel ?? true),
      } as QrCodeElement;
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
  if (!consented) throw new Error('KI-Nutzung wurde nicht best�tigt.');

  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Kein Gemini API-Key hinterlegt. Bitte unter Einstellungen eingeben.');
  }

  // Load user profile for context
  const profileKeys = [
    'profile_name', 'profile_address', 'profile_tax_number', 'profile_w_idnr', 'profile_vat_id',
    'profile_iban', 'profile_bic', 'profile_email', 'profile_phone', 'profile_business_type',
    'profile_finanzamt',
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
KONTEXT – Der Benutzer dieser Software ist:
- Name/Firma: ${profile.name || '(nicht angegeben)'}
- Adresse: ${profile.address || '(nicht angegeben)'}
- Steuernummer: ${profile.tax_number || '(nicht angegeben)'}
- W-IdNr.: ${profile.w_idnr || '(nicht angegeben)'}
- USt-IdNr.: ${profile.vat_id || '(nicht angegeben)'}
- IBAN: ${profile.iban || '(nicht angegeben)'}
- Branche/Tätigkeit: ${profile.business_type || '(nicht angegeben)'}
- Finanzamt: ${profile.finanzamt || '(nicht angegeben)'}

Nutze diese Informationen, um zu entscheiden:
- Wenn der Benutzer der EMPFÄNGER der Leistung ist (er bezahlt), dann type = "ausgabe".
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
═══════════════════════════════════════════════════════
BEKANNTE PARTNER (letzte 360 Tage) – verwende exakt diese Schreibweise wenn der Partner übereinstimmt:
═══════════════════════════════════════════════════════
${recentPartners.map((p) => `- ${p}`).join('\n')}

WICHTIG: Wenn der Aussteller/Empfänger der Rechnung einem dieser Partner entspricht, übernimm dessen Namen EXAKT so wie er hier steht (gleiche Groß-/Kleinschreibung, gleiche Abkürzungen).
`;
    }
  }

  const prompt = `Analysiere dieses PDF-Dokument und extrahiere Buchhaltungsdaten als JSON.
Antworte NUR mit validem JSON, kein Markdown, kein Text drumherum.
${profileContext}${knownPartnersContext}${aiInstructions.trim() ? `
═══════════════════════════════════════════════════════
PERSÖNLICHE KI-ANWEISUNGEN DES NUTZERS (höchste Priorität – halte dich strikt daran):
═══════════════════════════════════════════════════════
${aiInstructions.trim()}

` : ''}
=== WICHTIG: GÜLTIGE DOKUMENTE ===
Setze "is_invoice": true NUR wenn das Dokument eines der folgenden ist:
- Rechnung, Gutschrift, Stornorechnung
- Quittung, Kassenbon, Zahlungsbeleg
- Kontoauszug, Buchungsbeleg
- Gehaltsabrechnung, Honorarrechnung
- Steuerbescheid, Steuervorauszahlung
- Lieferschein mit Preisen
- Versicherungspolice mit Beitrag
- Vertrag mit konkreten Zahlungsangaben
- Spendenbescheinigung
- Jahresabschluss / betriebliche Auswertung

Setze "is_invoice": false wenn das Dokument kein Buchhaltungsdokument ist, z.B.:
- Lebenslauf / Bewerbungsunterlagen
- Foto / Bild / Screenshot (ohne Rechnungsinhalt)
- Zeitung / Artikel / Blogpost
- Bedienungsanleitung / Handbuch
- Offensichtlich privates oder nicht buchhalterisches Dokument
In diesem Fall: "rejection_reason" mit kurzer Erklärung auf Deutsch befüllen.

JSON-Schema:
{
  "is_invoice": true,
  "rejection_reason": "",
  "date": "YYYY-MM-DD (Rechnungsdatum)",
  "description": "Kurze Beschreibung des Inhalts",
  "partner": "Name des Rechnungsstellers oder -empfängers",
  "netto": 0.00,
  "fee": 0.00,
  "ust": 0.00,
  "brutto": 0.00,
  "currency": "EUR",
  "type": "einnahme | ausgabe | info",
  "suggested_category": "umsatz_pflichtig | umsatz_steuerfrei | reverse_charge | ust_erstattung | privateinlage | anlagenverkauf | erstattungen | sponsoring | affiliate | donations_tips | sachzuwendungen | sonstige_einnahmen | anlagevermoegen_afa | gwg | software_abos | fremdleistungen | buerobedarf | reisekosten | bewirtungskosten | marketing | weiterbildung | miete | versicherungen_betrieb | fahrzeugkosten | kommunikation | vertraege | spenden | krankenkasse | sozialversicherung | privat | privatentnahme | sonstiges"
}

=== REGELN FÜR "type" ===
- "einnahme": Der Benutzer BEKOMMT Geld (z.B. eine Rechnung die ER gestellt hat, Gutschrift an ihn).
- "ausgabe": Der Benutzer BEZAHLT etwas (z.B. Rechnung von einem Lieferanten/Dienstleister).
- "info": Kein Geldfluss – z.B. Verträge, AGBs, Bestätigungen, Informationsschreiben, Vertragsdokumente.

=== REGELN FÜR "suggested_category" ===
Wähle die passendste Kategorie – WICHTIG: Die Kategorie MUSS zum Typ passen!

EINNAHMEN (NUR wenn type="einnahme"):
- "umsatz_pflichtig": Standard-Umsätze mit 19% oder 7% MwSt (Rechnungen, Honorare, Dienstleistungen).
- "umsatz_steuerfrei": Einnahmen ohne MwSt (Kleinunternehmer §19 UStG, steuerfreie Leistungen).
- "reverse_charge": Reverse Charge (§ 13b UStG) – Einnahmen von ausländischen Plattformen (z.B. Twitch, YouTube/Google Ireland, Amazon KDP). Netto-Rechnung, Steuerschuldumkehr.
- "ust_erstattung": Geld vom Finanzamt zurück (Umsatzsteuererstattung).
- "privateinlage": Privates Geld ins Unternehmen eingelegt (kein steuerpflichtiger Gewinn).
- "anlagenverkauf": Erlös aus Verkauf von Firmengeräten, Möbeln, Fahrzeugen etc.
- "erstattungen": Rückerstattungen, Gutschriften, Auslagenerstattungen an den Benutzer (durchlaufender Posten).
- "sponsoring": Sponsoring / Werbeleistung – Zahlungen von Sponsoren für Werbeplatzierung, Product Placement.
- "affiliate": Affiliate / Vermittlungsprovision – Provisionen aus Affiliate-Links, Empfehlungsprogrammen.
- "donations_tips": Donations / Tips (Streaming) – freiwillige Zuschauerzahlungen (Twitch Bits, YouTube Super Chat, Ko-fi, PayPal.me). Sind Betriebseinnahmen!
- "sachzuwendungen": Sachzuwendungen – erhaltene Produkte/PR-Samples, Marktwert als Einnahme ansetzen.
- "sonstige_einnahmen": Alle anderen Einnahmen (Crowdfunding, sonstige Erträge).

BETRIEBSAUSGABEN (NUR wenn type="ausgabe"):
- "anlagevermoegen_afa": Anschaffungen > 800€ netto, die über Jahre abgeschrieben werden (z.B. Laptop, Maschinen, Möbel über 800€).
- "gwg": Geringwertige Wirtschaftsgüter ≤ 800€ netto (z.B. Monitor, Tastatur, Bürostuhl, Kleingeräte).
- "software_abos": Software-Lizenzen, SaaS-Abos, Cloud-Dienste (Adobe, GitHub, Hosting, Microsoft 365).
- "fremdleistungen": Leistungen von Dritten/Subunternehmern (Freelancer, Agentur, externer Entwickler).
- "buerobedarf": Büromaterial, Druckerpatronen, Papier, Kleinmaterial.
- "reisekosten": Fahrtkosten, Hotel, Flüge, Bahnfahrten für berufliche Reisen, Spesen, Verpflegungsmehraufwand.
- "bewirtungskosten": Geschäftliche Bewirtung – Restaurantbesuche mit Geschäftspartnern, nur 70 % absetzbar. NICHT für private Restaurantbesuche (→ privat)!
- "marketing": Werbung, Social-Media-Anzeigen, Drucksachen, Messen, PR.
- "weiterbildung": Kurse, Seminare, Fachbücher, Online-Kurse, Konferenztickets.
- "miete": Büromiete, Co-Working, Lagermiete, Raumkosten.
- "versicherungen_betrieb": Betriebliche Versicherungen (Haftpflicht, Berufsunfähigkeit, Inventar).
- "fahrzeugkosten": KFZ-Kosten, Benzin, Leasing, Reparatur für betriebliche Fahrzeuge.
- "kommunikation": Telefon, Mobilfunk, Internet, Festnetz für den Betrieb.

SONDERAUSGABEN (NUR wenn type="ausgabe"):
- "spenden": NUR wenn der Benutzer eine Spende ZAHLT an eine gemeinnützige Organisation. NICHT für Twitch-Subs oder Gaming!
- "krankenkasse": Beiträge zur gesetzlichen oder privaten Krankenversicherung, Pflegeversicherung.
- "sozialversicherung": Rentenversicherung, Altersvorsorge, Berufsgenossenschaft.

PRIVAT (NUR wenn type="ausgabe"):
- "privat": Rein private Ausgaben (Twitch-Subs, Netflix, Spotify, private Einkäufe, Restaurantbesuche privat). NICHT steuerlich relevant.
- "privatentnahme": Geldentnahme aus dem Betrieb für private Zwecke.

INFO (NUR wenn type="info"):
- "vertraege": Verträge, Vereinbarungen, AGBs, Bestätigungen, Informationsschreiben.
- "sonstiges": Alle anderen Info-Dokumente.

SONSTIGES:
- "sonstiges": Ausgaben, die in keine andere Ausgaben-Kategorie passen.

WICHTIG:
- Verträge/Vereinbarungen → type="info", suggested_category="vertraege"
- Erhaltene Spenden/Donations → type="einnahme", suggested_category="sonstige_einnahmen"
- Gezahlte Spenden → type="ausgabe", suggested_category="spenden"
- Krankenkasse/Sozialversicherung → type="ausgabe", suggested_category="krankenkasse" oder "sozialversicherung"
- Beträge als Zahlen (nicht Strings). Wenn kein Betrag erkennbar → netto=0, fee=0, ust=0, brutto=0.
- fee = nicht steuerbare Gebuehren (z. B. Zahlungsanbieter-/Transaktionsgebuehren). Wenn keine Gebuehren erkennbar sind, setze fee=0.
- Bei Verträgen ohne konkreten Rechnungsbetrag: setze Beträge auf 0.
- Kategorien für Einnahmen DÜRFEN NICHT für Ausgaben verwendet werden und umgekehrt!`;

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
          is_invoice: { type: 'BOOLEAN' },
          rejection_reason: { type: 'STRING' },
          date: { type: 'STRING' },
          description: { type: 'STRING' },
          partner: { type: 'STRING' },
          netto: { type: 'NUMBER' },
          fee: { type: 'NUMBER' },
          ust: { type: 'NUMBER' },
          brutto: { type: 'NUMBER' },
          currency: { type: 'STRING' },
          type: { type: 'STRING', enum: ['einnahme', 'ausgabe', 'info'] },
          suggested_category: {
            type: 'STRING',
            enum: ['umsatz_pflichtig', 'umsatz_steuerfrei', 'reverse_charge', 'ust_erstattung', 'privateinlage', 'anlagenverkauf', 'erstattungen', 'sponsoring', 'affiliate', 'donations_tips', 'sachzuwendungen', 'sonstige_einnahmen', 'anlagevermoegen_afa', 'gwg', 'software_abos', 'fremdleistungen', 'buerobedarf', 'reisekosten', 'bewirtungskosten', 'marketing', 'weiterbildung', 'miete', 'versicherungen_betrieb', 'fahrzeugkosten', 'kommunikation', 'vertraege', 'spenden', 'krankenkasse', 'sozialversicherung', 'privat', 'privatentnahme', 'sonstiges'],
          },
        },
        required: ['is_invoice', 'date', 'description', 'partner', 'netto', 'fee', 'ust', 'brutto', 'currency', 'type', 'suggested_category'],
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

// ─── Rechnungs-Compliance-Check ───────────────────────────────────────────────

export interface ComplianceIssue {
  type: 'error' | 'warning' | 'tip';
  field: string;
  message: string;
}

export interface ComplianceResult {
  ok: boolean;
  issues: ComplianceIssue[];
  improvedNote?: string; // KI-verbesserter Hinweistext (falls 'notes' vorhanden)
}

export interface ComplianceCheckInput {
  values: Record<string, string>;
  lineItems: import('@/types/template').LineItem[];
  includeMwst: boolean;
  mwstRate: number;
  netto: number;
  globalDiscount: number;
  isKleinunternehmer: boolean;
}

/**
 * Prüft eine Rechnung auf rechtliche Pflichtangaben (§ 14 Abs. 4 UStG)
 * und schlägt Verbesserungen vor.
 */
export async function checkInvoiceCompliance(input: ComplianceCheckInput): Promise<ComplianceResult> {
  const consented = await ensureGeminiConsent();
  if (!consented) throw new Error('KI-Nutzung wurde nicht bestätigt.');

  const apiKey = await getGeminiApiKey();
  if (!apiKey) throw new Error('Kein Gemini API-Key hinterlegt. Bitte unter Einstellungen eingeben.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const itemsSummary = input.lineItems
    .filter(i => !i.isGroupHeader)
    .map(i => `- ${i.description || '(kein Name)'}: ${i.quantity} × ${i.unitPrice} €${i.discount ? ` (${i.discount}% Rabatt)` : ''}`)
    .join('\n');

  const prompt = `Du bist ein Steuerberater-Assistent für deutsche Rechnungen. Prüfe folgende Rechnung auf Vollständigkeit und rechtliche Korrektheit.

RECHNUNGSDATEN:
- Rechnungsnummer (doc_number): "${input.values['doc_number'] || ''}"
- Rechnungsdatum (doc_date): "${input.values['doc_date'] || ''}"
- Fälligkeitsdatum (due_date): "${input.values['due_date'] || ''}"
- Leistungszeitpunkt (delivery_date): "${input.values['delivery_date'] || ''}"
- Empfänger Name: "${input.values['receiver_name'] || ''}"
- Empfänger Adresse: "${input.values['receiver_address'] || ''}"
- Absender Name: "${input.values['sender_name'] || ''}"
- Steuernummer: "${input.values['sender_tax_number'] || ''}"
- USt-IdNr.: "${input.values['sender_vat_id'] || ''}"
- MwSt. ausgewiesen: ${input.includeMwst ? `Ja (${input.mwstRate}%)` : 'Nein'}
- Kleinunternehmer (§19 UStG): ${input.isKleinunternehmer ? 'Ja' : 'Nein'}
- Nettobetrag: ${input.netto.toFixed(2)} €
- Globaler Rabatt: ${input.globalDiscount}%
- Hinweistext (notes): "${input.values['notes'] || ''}"

POSITIONEN:
${itemsSummary || '(keine Positionen)'}

PFLICHTANGABEN nach § 14 Abs. 4 UStG:
1. Vollständiger Name und Anschrift des Rechnungsstellers
2. Vollständiger Name und Anschrift des Leistungsempfängers  
3. Steuernummer ODER USt-IdNr. des Rechnungsstellers
4. Ausstellungsdatum der Rechnung
5. Fortlaufende Rechnungsnummer
6. Menge und Art der gelieferten Leistung/Ware
7. Zeitpunkt der Lieferung/Leistung
8. Entgelt (Nettobetrag)
9. Steuerbetrag oder Hinweis auf Steuerbefreiung (§19 UStG bei Kleinunternehmer)
10. Anzuwendender Steuersatz

Prüfe auf:
- Fehlende Pflichtangaben (error)
- Inkonsistenzen (z.B. Datum in Vergangenheit ohne Begründung = warning)
- Positionen mit 0 € Preis ohne Begründung (warning)
- Fehlender Hinweis bei Kleinunternehmer (§19 UStG) in notes (error)
- Sehr kurze oder generische Beschreibungen (tip)

Falls ein Hinweistext (notes) vorhanden ist: Formuliere ihn professioneller auf Deutsch (improvedNote).
Falls kein Hinweistext vorhanden: Schlage einen passenden vor (improvedNote).

Antworte mit strukturiertem JSON.`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        required: ['ok', 'issues'],
        properties: {
          ok: { type: 'BOOLEAN' },
          issues: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              required: ['type', 'field', 'message'],
              properties: {
                type: { type: 'STRING', enum: ['error', 'warning', 'tip'] },
                field: { type: 'STRING' },
                message: { type: 'STRING' },
              },
            },
          },
          improvedNote: { type: 'STRING' },
        },
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
  if (!text) throw new Error('Keine Antwort von Gemini erhalten.');

  try {
    return JSON.parse(text) as ComplianceResult;
  } catch {
    return { ok: false, issues: [{ type: 'error', field: 'general', message: 'KI-Antwort konnte nicht verarbeitet werden.' }] };
  }
}

/**
 * Verbessert einen Rechnungshinweistext mit KI.
 * Schnelle Variante ohne vollständigen Compliance-Check.
 */
export async function improveInvoiceNote(note: string, context?: string): Promise<string> {
  const consented = await ensureGeminiConsent();
  if (!consented) throw new Error('KI-Nutzung wurde nicht bestätigt.');

  const apiKey = await getGeminiApiKey();
  if (!apiKey) throw new Error('Kein Gemini API-Key hinterlegt.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const prompt = `Verbessere folgenden deutschen Rechnungshinweistext. Mache ihn professionell, höflich und klar. Behalte alle Informationen (besonders Zahlungsfristen und Bankdaten). Antworte NUR mit dem verbesserten Text, ohne Erklärungen.${context ? `\n\nKontext: ${context}` : ''}

Original: "${note}"`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'text/plain' },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Gemini API Fehler (${res.status})`);

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? note;
}
