// Fremdwährungen: Kursermittlung und Umrechnung in Euro.
//
// Grundsatz: In der Datenbank liegen ZWEI Beträge pro Beleg –
//   * netto/ust/brutto/fee          → immer EUR (alles rechnet damit)
//   * netto_original/…              → Betrag in der Belegwährung (Dokumentwert)
// dazu fx_rate (EUR je 1 Einheit der Belegwährung), fx_date und fx_source.
//
// Der Kurs wird EINMAL zum Belegdatum ermittelt und dann eingefroren. Ein
// späterer Kursverfall verändert die Buchhaltung also nicht mehr – genau so
// verlangt es die Rechnungslegung (Stichtagskurs, nicht Tageskurs).
//
// Kursquelle: EZB-Referenzkurse über die Frankfurter-API (kostenlos, ohne
// Schlüssel). Die EZB veröffentlicht nur an Bankarbeitstagen; für Wochenenden
// und Feiertage liefert die API automatisch den letzten Arbeitstag davor –
// das tatsächlich verwendete Kursdatum landet in fx_date.
//
// Hinweis für die Umsatzsteuer: § 16 Abs. 6 UStG erlaubt alternativ die
// monatlichen BMF-Durchschnittskurse. Wer die braucht, kann den Kurs pro Beleg
// von Hand überschreiben (fx_source = 'manual').

// db.ts importiert dieses Modul (Umrechnung beim Schreiben). Der Zugriff in
// die Gegenrichtung läuft deshalb über einen dynamischen Import – so entsteht
// kein statischer Zyklus zwischen den beiden Modulen.
async function getDb() {
  return (await import('@/lib/db')).getDb();
}

// ─── Unterstützte Währungen ──────────────────────────────────────────────────
//
// Genau die Währungen, für die die EZB Referenzkurse veröffentlicht – nur für
// die kann automatisch umgerechnet werden. Deshalb ist die Auswahl im UI
// bewusst eine feste Liste und kein Freitext.

export interface CurrencyDef {
  code: string;
  name: string;
  symbol: string;
}

export const CURRENCIES: CurrencyDef[] = [
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'USD', name: 'US-Dollar', symbol: '$' },
  { code: 'CHF', name: 'Schweizer Franken', symbol: 'CHF' },
  { code: 'GBP', name: 'Britisches Pfund', symbol: '£' },
  { code: 'PLN', name: 'Polnischer Złoty', symbol: 'zł' },
  { code: 'CZK', name: 'Tschechische Krone', symbol: 'Kč' },
  { code: 'DKK', name: 'Dänische Krone', symbol: 'kr' },
  { code: 'SEK', name: 'Schwedische Krone', symbol: 'kr' },
  { code: 'NOK', name: 'Norwegische Krone', symbol: 'kr' },
  { code: 'HUF', name: 'Ungarischer Forint', symbol: 'Ft' },
  { code: 'RON', name: 'Rumänischer Leu', symbol: 'lei' },
  { code: 'BGN', name: 'Bulgarischer Lew', symbol: 'лв' },
  { code: 'TRY', name: 'Türkische Lira', symbol: '₺' },
  { code: 'ISK', name: 'Isländische Krone', symbol: 'kr' },
  { code: 'CAD', name: 'Kanadischer Dollar', symbol: 'CA$' },
  { code: 'AUD', name: 'Australischer Dollar', symbol: 'A$' },
  { code: 'NZD', name: 'Neuseeland-Dollar', symbol: 'NZ$' },
  { code: 'JPY', name: 'Japanischer Yen', symbol: '¥' },
  { code: 'CNY', name: 'Chinesischer Renminbi', symbol: '¥' },
  { code: 'HKD', name: 'Hongkong-Dollar', symbol: 'HK$' },
  { code: 'SGD', name: 'Singapur-Dollar', symbol: 'S$' },
  { code: 'KRW', name: 'Südkoreanischer Won', symbol: '₩' },
  { code: 'INR', name: 'Indische Rupie', symbol: '₹' },
  { code: 'IDR', name: 'Indonesische Rupiah', symbol: 'Rp' },
  { code: 'MYR', name: 'Malaysischer Ringgit', symbol: 'RM' },
  { code: 'PHP', name: 'Philippinischer Peso', symbol: '₱' },
  { code: 'THB', name: 'Thailändischer Baht', symbol: '฿' },
  { code: 'ILS', name: 'Israelischer Schekel', symbol: '₪' },
  { code: 'MXN', name: 'Mexikanischer Peso', symbol: 'MX$' },
  { code: 'BRL', name: 'Brasilianischer Real', symbol: 'R$' },
  { code: 'ZAR', name: 'Südafrikanischer Rand', symbol: 'R' },
];

export const CURRENCY_CODES: string[] = CURRENCIES.map((c) => c.code);
const CURRENCY_BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

/** Symbole und gängige Schreibweisen → ISO-Code. */
const ALIASES: Record<string, string> = {
  '€': 'EUR', 'EURO': 'EUR', 'EUROS': 'EUR', 'EUR.': 'EUR',
  '$': 'USD', 'US$': 'USD', 'USD$': 'USD', 'DOLLAR': 'USD', 'US-DOLLAR': 'USD', 'US DOLLAR': 'USD',
  '£': 'GBP', 'POUND': 'GBP', 'GBP£': 'GBP',
  '¥': 'JPY',
  'SFR': 'CHF', 'FR.': 'CHF', 'CHF.': 'CHF',
  'ZŁ': 'PLN', 'PLN.': 'PLN',
  'KČ': 'CZK',
  'C$': 'CAD', 'CA$': 'CAD',
  'A$': 'AUD', 'AU$': 'AUD',
  'R$': 'BRL',
  '₹': 'INR',
  '₺': 'TRY',
  '₩': 'KRW',
  '₪': 'ILS',
};

/**
 * Bringt beliebige Währungsangaben auf einen unterstützten ISO-Code.
 * Unbekanntes (auch leere Felder) fällt auf EUR zurück – das entspricht dem
 * bisherigen Verhalten und ist für deutsche Belege die richtige Annahme.
 */
export function normalizeCurrency(raw: string | null | undefined): string {
  if (!raw) return 'EUR';
  const up = String(raw).trim().toUpperCase();
  if (!up) return 'EUR';
  if (CURRENCY_BY_CODE.has(up)) return up;
  if (ALIASES[up]) return ALIASES[up];
  // "120,00 USD" oder "USD 120" → Code herausziehen
  const match = up.match(/\b([A-Z]{3})\b/);
  if (match && CURRENCY_BY_CODE.has(match[1])) return match[1];
  return 'EUR';
}

export function currencyLabel(code: string): string {
  const def = CURRENCY_BY_CODE.get(code);
  return def ? `${def.code} – ${def.name}` : code;
}

/** Formatiert einen Betrag in seiner Originalwährung (z. B. „120,00 $"). */
export function fmtOriginal(value: number, code: string): string {
  try {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: code }).format(value);
  } catch {
    return `${value.toFixed(2)} ${code}`;
  }
}

// ─── Kurs-Cache ──────────────────────────────────────────────────────────────

export interface FxRate {
  /** EUR je 1 Einheit der Fremdwährung */
  rate: number;
  /** Tatsächliches Kursdatum (EZB-Bankarbeitstag, ggf. vor dem Belegdatum) */
  rateDate: string;
  source: 'ecb' | 'identity';
}

const FX_API = 'https://api.frankfurter.dev/v1';

function isoDate(date: string): string {
  // Erwartet YYYY-MM-DD; schneidet einen evtl. mitgelieferten Zeitanteil ab
  return String(date).slice(0, 10);
}

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/**
 * Kurs für (Währung, Datum) – zuerst aus dem lokalen Cache, sonst von der EZB.
 * Jede Kombination wird also höchstens einmal aus dem Netz geholt.
 */
export async function getRate(currency: string, date: string): Promise<FxRate> {
  const code = normalizeCurrency(currency);
  const day = isoDate(date);
  if (code === 'EUR') return { rate: 1, rateDate: day, source: 'identity' };

  const db = await getDb();
  const cached = await db.select<{ rate: number; rate_date: string; source: string }[]>(
    'SELECT rate, rate_date, source FROM fx_rates WHERE currency = $1 AND date = $2',
    [code, day],
  );
  if (cached[0]) {
    return { rate: cached[0].rate, rateDate: cached[0].rate_date, source: 'ecb' };
  }

  const res = await fetch(`${FX_API}/${day}?base=${code}&symbols=EUR`);
  if (!res.ok) {
    throw new Error(`Kurs ${code}→EUR für ${day} nicht abrufbar (HTTP ${res.status})`);
  }
  const data = (await res.json()) as { date?: string; rates?: Record<string, number> };
  const rate = data?.rates?.EUR;
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Kurs ${code}→EUR für ${day} nicht verfügbar`);
  }
  const rateDate = data.date ?? day;

  await db.execute(
    `INSERT INTO fx_rates (currency, date, rate, rate_date, source, fetched_at)
     VALUES ($1, $2, $3, $4, 'ecb', $5)
     ON CONFLICT(currency, date) DO UPDATE SET rate = $3, rate_date = $4, fetched_at = $5`,
    [code, day, rate, rateDate, new Date().toISOString()],
  );

  return { rate, rateDate, source: 'ecb' };
}

/**
 * Holt viele Kurse einer Währung in EINEM Aufruf (Zeitreihen-Endpunkt) und
 * legt sie im Cache ab. Ohne das würde ein Altbestand mit hunderten
 * Belegdatumsangaben auch hunderte Einzelabrufe auslösen.
 *
 * Die EZB veröffentlicht nur an Bankarbeitstagen. Für Wochenend- und
 * Feiertagsbelege wird deshalb – genau wie beim Einzelabruf – der letzte
 * davorliegende Kurs eingetragen und sein echtes Datum als rate_date vermerkt.
 */
export async function prefetchRates(currency: string, dates: string[]): Promise<void> {
  const code = normalizeCurrency(currency);
  if (code === 'EUR' || dates.length === 0) return;

  const db = await getDb();
  const cached = await db.select<{ date: string }[]>(
    'SELECT date FROM fx_rates WHERE currency = $1',
    [code],
  );
  const have = new Set(cached.map((r) => r.date));
  const missing = [...new Set(dates.map(isoDate))].filter((d) => !have.has(d)).sort();
  if (missing.length === 0) return;

  // Startdatum eine Woche nach vorn ziehen, damit auch für einen Beleg am
  // Wochenende ein davorliegender Bankarbeitstag in der Reihe enthalten ist.
  const from = new Date(missing[0]);
  from.setDate(from.getDate() - 7);
  const range = `${from.toISOString().slice(0, 10)}..${missing[missing.length - 1]}`;

  const res = await fetch(`${FX_API}/${range}?base=${code}&symbols=EUR`);
  if (!res.ok) throw new Error(`Kurse ${code}→EUR nicht abrufbar (HTTP ${res.status})`);
  const data = (await res.json()) as { rates?: Record<string, Record<string, number>> };
  const series = Object.entries(data.rates ?? {})
    .map(([day, r]) => [day, r.EUR] as [string, number])
    .filter(([, r]) => typeof r === 'number' && Number.isFinite(r) && r > 0)
    .sort((a, b) => a[0].localeCompare(b[0]));
  if (series.length === 0) return;

  const fetchedAt = new Date().toISOString();
  for (const day of missing) {
    let pick: [string, number] | null = null;
    for (const entry of series) {
      if (entry[0] <= day) pick = entry;
      else break;
    }
    if (!pick) continue; // kein Kurs vor diesem Datum – Einzelabruf übernimmt
    await db.execute(
      `INSERT INTO fx_rates (currency, date, rate, rate_date, source, fetched_at)
       VALUES ($1, $2, $3, $4, 'ecb', $5)
       ON CONFLICT(currency, date) DO UPDATE SET rate = $3, rate_date = $4, fetched_at = $5`,
      [code, day, pick[1], pick[0], fetchedAt],
    );
  }
}

// ─── Umrechnung eines Belegs ─────────────────────────────────────────────────

/** Die vier Beträge eines Belegs – in Originalwährung oder in Euro. */
export interface Amounts {
  netto: number;
  ust: number;
  brutto: number;
  fee: number;
}

export interface ConversionResult extends Amounts {
  currency: string;
  netto_original: number;
  ust_original: number;
  brutto_original: number;
  fee_original: number;
  fx_rate: number;
  fx_date: string;
  fx_source: string;
}

/**
 * Rechnet Originalbeträge einmalig in Euro um.
 * Wirft, wenn kein Kurs ermittelbar ist (offline, unbekannte Währung) – der
 * Aufrufer entscheidet dann, ob der Beleg als „Umrechnung ausstehend"
 * gespeichert wird.
 */
export async function convertAmounts(
  original: Amounts,
  currency: string,
  date: string,
): Promise<ConversionResult> {
  const code = normalizeCurrency(currency);
  const originals = {
    netto_original: original.netto,
    ust_original: original.ust,
    brutto_original: original.brutto,
    fee_original: original.fee,
  };

  if (code === 'EUR') {
    return {
      ...original,
      currency: 'EUR',
      ...originals,
      fx_rate: 1,
      fx_date: isoDate(date),
      fx_source: 'identity',
    };
  }

  const { rate, rateDate } = await getRate(code, date);
  return {
    netto: round2(original.netto * rate),
    ust: round2(original.ust * rate),
    brutto: round2(original.brutto * rate),
    fee: round2(original.fee * rate),
    currency: code,
    ...originals,
    fx_rate: rate,
    fx_date: rateDate,
    fx_source: 'ecb',
  };
}

/** Umrechnung mit einem von Hand gesetzten Kurs (kein Netzzugriff). */
export function convertWithRate(
  original: Amounts,
  currency: string,
  rate: number,
  rateDate: string,
): ConversionResult {
  const code = normalizeCurrency(currency);
  return {
    netto: round2(original.netto * rate),
    ust: round2(original.ust * rate),
    brutto: round2(original.brutto * rate),
    fee: round2(original.fee * rate),
    currency: code,
    netto_original: original.netto,
    ust_original: original.ust,
    brutto_original: original.brutto,
    fee_original: original.fee,
    fx_rate: rate,
    fx_date: isoDate(rateDate),
    fx_source: code === 'EUR' ? 'identity' : 'manual',
  };
}

// ─── Nachträgliche Umrechnung („Umrechnung ausstehend") ──────────────────────
//
// Belege, für die beim Speichern kein Kurs ermittelt werden konnte (kein Netz,
// Kurs noch nicht veröffentlicht) sowie sämtliche Altbestände aus der
// Migration stehen auf fx_source = 'pending'. Dieser Lauf holt das nach –
// beim App-Start automatisch, sonst über den Hinweis-Indikator.

export interface BackfillResult {
  /** Belege, die vor dem Lauf offen waren */
  pending: number;
  converted: number;
  failed: number;
  /** Eindeutige Fehlermeldungen (z. B. „offline") */
  errors: string[];
}

interface PendingRow {
  id: string;
  date: string;
  currency: string;
  netto_original: number | null;
  ust_original: number | null;
  brutto_original: number | null;
  fee_original: number | null;
  netto: number;
  ust: number;
  brutto: number;
  fee: number;
}

export async function countPendingConversions(): Promise<number> {
  try {
    const db = await getDb();
    const rows = await db.select<{ cnt: number }[]>(
      "SELECT COUNT(*) as cnt FROM invoices WHERE fx_source = 'pending'",
    );
    return rows[0]?.cnt ?? 0;
  } catch {
    return 0;
  }
}

let backfillInFlight: Promise<BackfillResult> | null = null;

export async function ensureCurrencyConversions(): Promise<BackfillResult> {
  if (backfillInFlight) return backfillInFlight;
  backfillInFlight = (async () => {
    const result: BackfillResult = { pending: 0, converted: 0, failed: 0, errors: [] };
    const db = await getDb();

    const rows = await db.select<PendingRow[]>(
      `SELECT id, date, currency, netto_original, ust_original, brutto_original, fee_original,
              netto, ust, brutto, fee
         FROM invoices WHERE fx_source = 'pending' ORDER BY date`,
    );
    result.pending = rows.length;
    if (rows.length === 0) return result;

    // Kurse gebündelt vorladen – ein Abruf je Währung statt einer je Beleg.
    // Schlägt das fehl (offline), greift unten der Einzelabruf und meldet
    // den Fehler sauber pro Beleg.
    const byCurrency = new Map<string, string[]>();
    for (const row of rows) {
      const code = normalizeCurrency(row.currency);
      if (code === 'EUR') continue;
      const list = byCurrency.get(code) ?? [];
      list.push(row.date);
      byCurrency.set(code, list);
    }
    for (const [code, dates] of byCurrency) {
      try {
        await prefetchRates(code, dates);
      } catch {
        // egal – der Einzelabruf pro Beleg versucht es erneut
      }
    }

    const { addAuditLog } = await import('@/lib/db');

    for (const row of rows) {
      const original = {
        netto: row.netto_original ?? row.netto,
        ust: row.ust_original ?? row.ust,
        brutto: row.brutto_original ?? row.brutto,
        fee: row.fee_original ?? row.fee ?? 0,
      };
      try {
        const c = await convertAmounts(original, row.currency, row.date);
        await db.execute(
          `UPDATE invoices
              SET netto = $1, ust = $2, brutto = $3, fee = $4,
                  netto_original = $5, ust_original = $6, brutto_original = $7, fee_original = $8,
                  fx_rate = $9, fx_date = $10, fx_source = $11, currency = $12
            WHERE id = $13`,
          [c.netto, c.ust, c.brutto, c.fee,
           c.netto_original, c.ust_original, c.brutto_original, c.fee_original,
           c.fx_rate, c.fx_date, c.fx_source, c.currency, row.id],
        );
        // GoBD: Die Wertänderung wird im Änderungsprotokoll festgehalten –
        // Originalbetrag, Kurs und Kursdatum bleiben nachvollziehbar.
        await addAuditLog(
          row.id,
          'currency_converted',
          'brutto',
          `${original.brutto.toFixed(2)} ${c.currency}`,
          `${c.brutto.toFixed(2)} EUR`,
          `EZB-Referenzkurs ${c.fx_rate} EUR/${c.currency} vom ${c.fx_date}`,
        );
        result.converted++;
      } catch (e) {
        result.failed++;
        const msg = e instanceof Error ? e.message : String(e);
        if (!result.errors.includes(msg)) result.errors.push(msg);
      }
    }
    return result;
  })();

  try {
    return await backfillInFlight;
  } finally {
    backfillInFlight = null;
  }
}
