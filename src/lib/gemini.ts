import { getSetting } from '@/lib/db';
import type { GeminiResult } from '@/types';

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
  "suggested_category": "einnahmen | erstattungen | anlagevermoegen_afa | gwg | software_abos | fremdleistungen | vertraege | sonstiges"
}

=== REGELN FÜR "type" ===
- "einnahme": Der Benutzer BEKOMMT Geld (z.B. eine Rechnung die ER gestellt hat, Gutschrift an ihn).
- "ausgabe": Der Benutzer BEZAHLT etwas (z.B. Rechnung von einem Lieferanten/Dienstleister).
- "info": Kein Geldfluss – z.B. Verträge, AGBs, Bestätigungen, Informationsschreiben, Vertragsdokumente.

=== REGELN FÜR "suggested_category" ===
Wähle die passendste Kategorie:
- "einnahmen": NUR wenn type="einnahme" ist. Echte Umsätze/Erlöse des Benutzers (z.B. Rechnungen die er gestellt hat).
- "erstattungen": Auslagenerstattungen, Rückerstattungen, Kostenübernahmen – der Benutzer bekommt Geld zurück für etwas das er verauslagt hat. type="einnahme".
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
            enum: ['einnahmen', 'erstattungen', 'anlagevermoegen_afa', 'gwg', 'software_abos', 'fremdleistungen', 'vertraege', 'sonstiges'],
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


