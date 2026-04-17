import { getSetting } from '@/lib/db';
import type { GeminiResult } from '@/types';
import type { TemplateElement, ItemsElement, LineElement } from '@/types/template';
import { CANVAS_W, CANVAS_H, DEFAULT_FONT_FAMILY, FONT_FAMILIES } from '@/types/template';

export interface AiTemplateResult {
  name: string;
  elements: TemplateElement[];
}

function newId() { return `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

export async function analyzeInvoiceLayoutWithAI(base64: string, mimeType: string): Promise<AiTemplateResult> {
  const apiKey = await getSetting('gemini_api_key');
  if (!apiKey) {
    throw new Error('Kein Gemini API-Key hinterlegt. Bitte unter Einstellungen eingeben.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const prompt = `Du bist ein Experte für Rechnungsdesign. Analysiere das gegebene Rechnungsbild/-dokument und erstelle daraus ein präzises JSON-Template-Layout.

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

═══════════════════════════════════════════════════════
POSITIONIERUNGSREGELN
═══════════════════════════════════════════════════════
- Alle Koordinaten (x, y, width, height) in Pixeln auf dem ${CANVAS_W}×${CANVAS_H}px Canvas
- Messe die Positionen so genau wie möglich am Original ab
- zIndex: rectangle im Hintergrund = 1, text/variable/image = 5, Elemente über Rechtecken = 3
- Farben immer als Hex-Werte (#rrggbb), nie als CSS-Namen
- lineHeight: Zahl zwischen 1.0 und 2.0
- fontFamily: Wähle die Schriftart die optisch am besten zum Layout passt. Standard ist "Helvetica, Arial, sans-serif". Mögliche Werte: ${FONT_FAMILIES.map(f => `"${f.value}"`).join(', ')}

Gib dem Template einen passenden Namen basierend auf dem Stil (z.B. "Modernes Blau", "Klassisch Minimalistisch").`;

  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
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
          name: { type: 'string', description: 'Name des Templates, z.B. "Modernes Blau"' },
          elements: {
            type: 'array',
            description: 'Alle Layout-Elemente des Templates',
            items: {
              type: 'object',
              required: ['type', 'x', 'y', 'width', 'height', 'zIndex'],
              properties: {
                type: { type: 'string', enum: ['text', 'variable', 'rectangle', 'image', 'items', 'line'] },
                x: { type: 'number', description: 'X-Position in Pixeln (nicht für type=line)' },
                y: { type: 'number', description: 'Y-Position in Pixeln (nicht für type=line)' },
                width: { type: 'number', description: 'Breite in Pixeln (nicht für type=line)' },
                height: { type: 'number', description: 'Höhe in Pixeln (nicht für type=line)' },
                // line-specific
                x1: { type: 'number', description: 'Nur für type=line: X-Koordinate Startpunkt' },
                y1: { type: 'number', description: 'Nur für type=line: Y-Koordinate Startpunkt' },
                x2: { type: 'number', description: 'Nur für type=line: X-Koordinate Endpunkt' },
                y2: { type: 'number', description: 'Nur für type=line: Y-Koordinate Endpunkt' },
                thickness: { type: 'number', description: 'Nur für type=line: Linienstärke in px (z.B. 1 oder 2)' },
                zIndex: { type: 'integer', description: '1 = Hintergrund, 5 = Vordergrund' },
                // text & variable shared
                fontSize: { type: 'number' },
                fontWeight: { type: 'string', enum: ['normal', 'bold'] },
                fontStyle: { type: 'string', enum: ['normal', 'italic'] },
                fontFamily: {
                  type: 'string',
                  description: 'CSS-Schriftart-Stack, z.B. "Helvetica, Arial, sans-serif"',
                  enum: FONT_FAMILIES.map((f) => f.value),
                },
                color: { type: 'string', description: 'Hex-Farbe z.B. #111827' },
                backgroundColor: { type: 'string', description: 'Hex-Farbe oder "transparent"' },
                textAlign: { type: 'string', enum: ['left', 'center', 'right'] },
                lineHeight: { type: 'number', minimum: 1.0, maximum: 2.0 },
                // text only
                content: { type: 'string', description: 'Nur für type=text: der statische Text' },
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
                prefix: { type: 'string', description: 'Optionaler Text vor dem Variablenwert, z.B. "IBAN: "' },
                suffix: { type: 'string', description: 'Optionaler Text nach dem Variablenwert' },
                // rectangle only
                borderColor: { type: 'string' },
                borderWidth: { type: 'number' },
                borderRadius: { type: 'number' },
                // image only
                src: { type: 'string', description: 'Immer leer "" – User fügt Bild später ein' },
                objectFit: { type: 'string', enum: ['contain', 'cover', 'fill'] },
                // items only
                rowHeight: { type: 'number', description: 'Zeilenhöhe in px' },
                headerBgColor: { type: 'string' },
                headerTextColor: { type: 'string' },
                altRowBgColor: { type: 'string' },
                summaryBgColor: { type: 'string' },
                mwstRate: { type: 'number', description: 'MwSt.-Satz z.B. 19' },
                colWidths: {
                  type: 'array',
                  description: 'Spaltenbreiten als Anteile (Summe = 1.0), 6 Werte: [Nr, Beschreibung, Menge, Einheit, Einzelpreis, Gesamtpreis]',
                  items: { type: 'number', minimum: 0, maximum: 1 },
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
      return { ...base, type: 'rectangle' as const, backgroundColor: String(el.backgroundColor ?? 'transparent'), borderColor: String(el.borderColor ?? '#000000'), borderWidth: Number(el.borderWidth ?? 1), borderRadius: Number(el.borderRadius ?? 0) };
    }
    if (el.type === 'image') {
      return { ...base, type: 'image' as const, src: '', objectFit: (el.objectFit as 'contain' | 'cover' | 'fill') ?? 'contain' };
    }
    if (el.type === 'items') {
      const cols = Array.isArray(el.colWidths) ? el.colWidths as [number,number,number,number,number,number] : [0.07, 0.38, 0.1, 0.1, 0.15, 0.2] as [number,number,number,number,number,number];
      return { ...base, type: 'items' as const, fontSize: Number(el.fontSize ?? 10), rowHeight: Number(el.rowHeight ?? 24), headerBgColor: String(el.headerBgColor ?? '#1e3a5f'), headerTextColor: String(el.headerTextColor ?? '#ffffff'), borderColor: String(el.borderColor ?? '#d1d5db'), altRowBgColor: String(el.altRowBgColor ?? '#f8fafc'), summaryBgColor: String(el.summaryBgColor ?? '#1e3a5f'), mwstRate: Number(el.mwstRate ?? 19), colWidths: cols } as ItemsElement;
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
      return { ...base, type: 'variable' as const, variableKey: String(el.variableKey ?? ''), prefix: String(el.prefix ?? ''), suffix: String(el.suffix ?? ''), fontSize: Number(el.fontSize ?? 12), fontWeight: (el.fontWeight as 'normal' | 'bold') ?? 'normal', fontStyle: (el.fontStyle as 'normal' | 'italic') ?? 'normal', fontFamily: String(el.fontFamily ?? DEFAULT_FONT_FAMILY), color: String(el.color ?? '#2563eb'), backgroundColor: String(el.backgroundColor ?? 'transparent'), textAlign: (el.textAlign as 'left' | 'center' | 'right') ?? 'left', lineHeight: Number(el.lineHeight ?? 1.3) };
    }
    // default: text
    return { ...base, type: 'text' as const, content: String(el.content ?? ''), fontSize: Number(el.fontSize ?? 12), fontWeight: (el.fontWeight as 'normal' | 'bold') ?? 'normal', fontStyle: (el.fontStyle as 'normal' | 'italic') ?? 'normal', fontFamily: String(el.fontFamily ?? DEFAULT_FONT_FAMILY), color: String(el.color ?? '#111827'), backgroundColor: String(el.backgroundColor ?? 'transparent'), textAlign: (el.textAlign as 'left' | 'center' | 'right') ?? 'left', lineHeight: Number(el.lineHeight ?? 1.3) };
  });

  return { name: parsed.name ?? 'KI-Template', elements };
}

export async function analyzeInvoicePdf(base64: string): Promise<GeminiResult> {
  const apiKey = await getSetting('gemini_api_key');
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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  let profileContext = '';
  if (hasProfile) {
    profileContext = `
KONTEXT – Der Benutzer dieser Software ist:
- Name/Firma: ${profile.name || '(nicht angegeben)'}
- Adresse: ${profile.address || '(nicht angegeben)'}
- Steuernummer: ${profile.tax_number || '(nicht angegeben)'}
- USt-IdNr.: ${profile.vat_id || '(nicht angegeben)'}
- IBAN: ${profile.iban || '(nicht angegeben)'}
- Branche/Tätigkeit: ${profile.business_type || '(nicht angegeben)'}

Nutze diese Informationen, um zu entscheiden:
- Wenn der Benutzer der EMPFÄNGER der Leistung ist (er bezahlt), dann type = "ausgabe".
- Wenn der Benutzer der ERBRINGER der Leistung ist (er bekommt Geld), dann type = "einnahme".
- "partner" ist immer die ANDERE Partei (nicht der Benutzer selbst).
`;
  }

  const prompt = `Analysiere diese PDF-Rechnung/Dokument und extrahiere die folgenden Informationen als JSON.
Antworte NUR mit validem JSON, kein Markdown, kein Text drumherum.
${profileContext}
JSON-Schema:
{
  "date": "YYYY-MM-DD (Rechnungsdatum)",
  "description": "Kurze Beschreibung des Inhalts",
  "partner": "Name des Rechnungsstellers oder -empfängers",
  "netto": 0.00,
  "ust": 0.00,
  "brutto": 0.00,
  "currency": "EUR",
  "type": "einnahme | ausgabe | info",
  "suggested_category": "einnahmen | anlagevermoegen_afa | gwg | software_abos | fremdleistungen | vertraege | sonstiges"
}

=== REGELN FÜR "type" ===
- "einnahme": Der Benutzer BEKOMMT Geld (z.B. eine Rechnung die ER gestellt hat, Gutschrift an ihn).
- "ausgabe": Der Benutzer BEZAHLT etwas (z.B. Rechnung von einem Lieferanten/Dienstleister).
- "info": Kein Geldfluss – z.B. Verträge, AGBs, Bestätigungen, Informationsschreiben, Vertragsdokumente.

=== REGELN FÜR "suggested_category" ===
Wähle die passendste Kategorie:
- "einnahmen": NUR wenn type="einnahme" ist. Umsätze/Erlöse des Benutzers.
- "anlagevermoegen_afa": Anschaffungen > 800€ netto, die über Jahre abgeschrieben werden (z.B. Laptop, Möbel, Maschinen).
- "gwg": Geringwertige Wirtschaftsgüter, Anschaffungen bis 800€ netto (z.B. Monitor, Tastatur, Bürostuhl).
- "software_abos": Software-Lizenzen, SaaS-Abos, Cloud-Dienste (z.B. Adobe, GitHub, Hosting).
- "fremdleistungen": Leistungen von Dritten/Subunternehmern (z.B. Freelancer, Agentur, externer Entwickler).
- "vertraege": Verträge, Vereinbarungen, Rahmenverträge – Dokumente OHNE direkten Zahlungsbetrag. Hier ist type meist "info".
- "sonstiges": Alles was in keine andere Kategorie passt.

WICHTIG:
- Verträge/Vereinbarungen → type="info", suggested_category="vertraege"
- Beträge als Zahlen (nicht Strings). Wenn kein Betrag erkennbar → netto=0, ust=0, brutto=0.
- Bei Verträgen ohne konkreten Rechnungsbetrag: setze Beträge auf 0.`;

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
            enum: ['einnahmen', 'anlagevermoegen_afa', 'gwg', 'software_abos', 'fremdleistungen', 'vertraege', 'sonstiges'],
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


