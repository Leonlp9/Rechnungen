import { useMemo } from 'react';
import { useDashboardContext } from './DashboardContext';
import { fmtCurrency } from '@/lib/utils';
import { CATEGORY_LABELS, SONDERAUSGABEN_CATEGORIES, PRIVAT_CATEGORIES } from '@/types';
import type { Category } from '@/types';
import { Calculator, TrendingUp, TrendingDown, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: 'cash' | 'afa';
}

export function BetriebsergebnisDialog({ open, onOpenChange, variant }: Props) {
  const { privacyMode, yearInvoices, selectedYear, afaItems, afaJahresAbschreibung, fahrtAbsetzbar, fahrtKmDienst } = useDashboardContext();

  const data = useMemo(() => {
    const nichtBetrieblich: Category[] = [...SONDERAUSGABEN_CATEGORIES, ...PRIVAT_CATEGORIES];

    // Einnahmen nach Kategorie
    const einnahmenInvoices = yearInvoices.filter((i) => i.type === 'einnahme');
    const einnahmenGesamt = einnahmenInvoices.reduce((s, i) => s + i.brutto, 0);
    // Netto-Einnahmen für EÜR
    const einnahmenNettoGesamt = einnahmenInvoices.reduce((s, i) => s + i.netto, 0);

    const einnahmenByCategory = new Map<Category, number>();
    for (const inv of einnahmenInvoices) {
      einnahmenByCategory.set(inv.category, (einnahmenByCategory.get(inv.category) ?? 0) + inv.brutto);
    }

    // Betriebsausgaben nach Kategorie (ohne Sonder/Privat)
    const betriebsausgabenInvoices = yearInvoices.filter(
      (i) => i.type === 'ausgabe' && !nichtBetrieblich.includes(i.category),
    );
    const betriebsausgabenGesamt = betriebsausgabenInvoices.reduce((s, i) => s + i.brutto, 0);

    const ausgabenByCategory = new Map<Category, number>();
    for (const inv of betriebsausgabenInvoices) {
      ausgabenByCategory.set(inv.category, (ausgabenByCategory.get(inv.category) ?? 0) + inv.brutto);
    }

    // AfA-Korrektur: Voller Kaufpreis vs. zeitanteilige Abschreibung
    // Im Betriebsergebnis (cash-flow) zählt der volle Kaufpreis.
    // Steuerlich relevant (EÜR mit AfA) ist nur die Jahres-AfA.
    const afaVollkaufpreis = yearInvoices
      .filter((i) => i.type === 'ausgabe' && i.category === 'anlagevermoegen_afa')
      .reduce((s, i) => s + i.brutto, 0);
    const gwgVollkaufpreis = yearInvoices
      .filter((i) => i.type === 'ausgabe' && i.category === 'gwg')
      .reduce((s, i) => s + i.brutto, 0);

    // Sonderausgaben
    const sonderausgaben = yearInvoices
      .filter((i) => i.type === 'ausgabe' && SONDERAUSGABEN_CATEGORIES.includes(i.category))
      .reduce((s, i) => s + i.brutto, 0);

    const privatAusgaben = yearInvoices
      .filter((i) => i.type === 'ausgabe' && PRIVAT_CATEGORIES.includes(i.category))
      .reduce((s, i) => s + i.brutto, 0);

    const betriebsergebnisCashflow = einnahmenGesamt - betriebsausgabenGesamt;

    // ── Steuerlicher Gewinn (EÜR) – netto-basiert ─────────────────────────────
    // GWG = Sofort-Betriebsausgabe (in ausgabenOhneAnlageNetto enthalten)
    // Nur anlagevermoegen_afa wird über zeitanteilige AfA verteilt
    const ausgabenOhneAnlageNetto = betriebsausgabenInvoices
      .filter((i) => i.category !== 'anlagevermoegen_afa')
      .reduce((s, i) => s + i.netto, 0);
    const afaOnlyAbschreibung = afaItems
      .filter((item) => item.invoice.category === 'anlagevermoegen_afa')
      .reduce((s, item) => s + item.jahresAfa, 0);
    const betriebsergebnisNachAfa = einnahmenNettoGesamt - ausgabenOhneAnlageNetto - afaOnlyAbschreibung - fahrtAbsetzbar;

    // Für Anzeige: brutto-basierte ausgaben ohne AfA/GWG (Cash-Dialog)
    const ausgabenOhneAfaGwg = betriebsausgabenGesamt - afaVollkaufpreis - gwgVollkaufpreis;

    return {
      einnahmenGesamt,
      einnahmenNettoGesamt,
      einnahmenByCategory,
      betriebsausgabenGesamt,
      ausgabenByCategory,
      betriebsergebnisCashflow,
      sonderausgaben,
      privatAusgaben,
      afaVollkaufpreis,
      gwgVollkaufpreis,
      ausgabenOhneAfaGwg,
      ausgabenOhneAnlageNetto,
      afaOnlyAbschreibung,
      betriebsergebnisNachAfa,
    };
  }, [yearInvoices, afaItems, afaJahresAbschreibung, fahrtAbsetzbar]);

  const fmt = (v: number) => fmtCurrency(v, privacyMode);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-violet-500" />
            {variant === 'cash' ? 'Cash-Gewinn' : 'Steuerlicher Gewinn (EÜR)'} – {selectedYear}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          {/* ── Drei Gewinne im Vergleich ─── */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="bg-muted/50 px-4 py-2 flex items-center gap-1.5 border-b">
              <span className="text-xs font-semibold">Die drei Gewinne im Vergleich</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Die drei Werte unterscheiden sich in der Behandlung von Privatausgaben und Abschreibungen (AfA).
                    Der Saldo zeigt Cash-Positionen; der steuerliche Gewinn ist die Basis fürs Finanzamt.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="grid grid-cols-3 divide-x text-center">
              {[
                {
                  label: 'Saldo YTD',
                  value: data.einnahmenGesamt - data.betriebsausgabenGesamt - data.sonderausgaben - data.privatAusgaben,
                  color: 'text-primary',
                  formula: 'Einnahmen − alle Ausgaben inkl. Privat/Sonder',
                  detail: 'Wie viel Geld ist wirklich geflossen?',
                },
                {
                  label: 'Cash-Gewinn',
                  value: data.betriebsergebnisCashflow,
                  color: 'text-violet-600 dark:text-violet-400',
                  formula: 'Einnahmen − Betriebsausgaben (voller Kaufpreis)',
                  detail: 'Ohne Privat & Sonderausgaben, mit vollem Investitionsabzug',
                },
                {
                  label: 'Steuerlicher Gewinn',
                  value: data.betriebsergebnisNachAfa,
                  color: 'text-amber-600 dark:text-amber-400',
                  formula: 'Netto-Einnahmen − Netto-BA − zeitanteilige AfA',
                  detail: 'Basis für Einkommensteuer (EÜR)',
                },
              ].map(({ label, value, color, formula, detail }) => (
                <div key={label} className="px-3 py-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
                  <div className={`text-base font-bold ${color}`}>{fmt(value)}</div>
                  <div className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">{formula}</div>
                  <div className="text-[10px] italic text-muted-foreground/70 mt-0.5">{detail}</div>
                </div>
              ))}
            </div>
            {data.privatAusgaben > 0 && (
              <div className="px-4 py-2 bg-muted/30 border-t text-[10px] text-muted-foreground">
                <strong>Warum ist Saldo kleiner als Cash-Gewinn?</strong>&nbsp;
                Weil {fmt(data.privatAusgaben)} an Privat-/Sonderausgaben den Saldo senken, aber <em>nicht</em> den betrieblichen Gewinn mindern.
              </div>
            )}
          </div>

          {/* Erklärung */}
          <div className="rounded-lg border border-blue-300/30 bg-blue-500/5 p-4 space-y-2">
            <p className="font-semibold text-blue-700 dark:text-blue-400">
              {variant === 'cash' ? 'Was ist der Cash-Gewinn?' : 'Was ist der steuerliche Gewinn?'}
            </p>
            {variant === 'cash' ? (
              <p className="text-muted-foreground text-xs leading-relaxed">
                Der Cash-Gewinn zeigt, wie viel <strong>echtes Geld</strong> durch deine Geschäftstätigkeit übrig geblieben ist:
                Einnahmen minus alle Betriebsausgaben mit vollem Kaufpreis. Ideal um zu sehen, was wirklich auf dem Konto passiert ist.
              </p>
            ) : (
              <>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Der steuerliche Gewinn ist der Betrag, den das <strong>Finanzamt als Gewinn</strong> ansetzt.
                  Bei Wirtschaftsgütern &gt; 800 € netto wird nicht der volle Kaufpreis, sondern nur die
                  <strong> zeitanteilige Abschreibung (AfA)</strong> als Betriebsausgabe anerkannt.
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Nutze diesen Wert als Basis für deine <strong>Steuerrücklage</strong>!
                </p>
              </>
            )}
          </div>

          {/* ── Einnahmen ─── */}
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="font-semibold text-green-700 dark:text-green-400">Einnahmen</span>
              <span className="ml-auto font-bold text-green-700 dark:text-green-400">{fmt(data.einnahmenGesamt)}</span>
            </div>
            <div className="divide-y">
              {Array.from(data.einnahmenByCategory.entries())
                .sort(([, a], [, b]) => b - a)
                .map(([cat, val]) => (
                  <div key={cat} className="flex justify-between py-1.5 text-xs">
                    <span className="text-muted-foreground">{CATEGORY_LABELS[cat] ?? cat}</span>
                    <span className="font-medium">{fmt(val)}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* ── Betriebsausgaben ─── */}
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              <span className="font-semibold text-red-700 dark:text-red-400">Betriebsausgaben</span>
              <span className="ml-auto font-bold text-red-700 dark:text-red-400">− {fmt(data.betriebsausgabenGesamt)}</span>
            </div>
            <div className="divide-y">
              {Array.from(data.ausgabenByCategory.entries())
                .sort(([, a], [, b]) => b - a)
                .map(([cat, val]) => (
                  <div key={cat} className="flex justify-between py-1.5 text-xs">
                    <span className="text-muted-foreground">{CATEGORY_LABELS[cat] ?? cat}</span>
                    <span className="font-medium">− {fmt(val)}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* ── Ergebnis (Cashflow-Basis) – nur bei Cash-Variante ─── */}
          {variant === 'cash' && (
            <div className="rounded-lg border border-violet-300/40 bg-violet-500/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Cash-Gewinn</span>
                <span className="text-lg font-bold text-violet-700 dark:text-violet-400">{fmt(data.betriebsergebnisCashflow)}</span>
              </div>
              <div className="text-[11px] text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>Einnahmen</span>
                  <span>{fmt(data.einnahmenGesamt)}</span>
                </div>
                <div className="flex justify-between">
                  <span>− Betriebsausgaben (inkl. voller Kaufpreis AfA/GWG)</span>
                  <span>− {fmt(data.betriebsausgabenGesamt)}</span>
                </div>
                <div className="border-t pt-1 flex justify-between font-semibold">
                  <span>= Cash-Gewinn</span>
                  <span>{fmt(data.betriebsergebnisCashflow)}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Steuerlicher Gewinn (AfA-korrigiert) – nur bei AfA-Variante ─── */}
          {variant === 'afa' && (
            <div className="rounded-lg border border-amber-300/40 bg-amber-500/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Steuerlicher Gewinn (EÜR)</span>
                <span className="text-lg font-bold text-amber-700 dark:text-amber-400">{fmt(data.betriebsergebnisNachAfa)}</span>
              </div>
              <div className="text-[11px] space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Betriebseinnahmen (Netto)</span>
                  <span className="font-medium">{fmt(data.einnahmenNettoGesamt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">− Betriebsausgaben Netto (ohne Anlagevermögen &gt; 800 €)</span>
                  <span className="font-medium">− {fmt(data.ausgabenOhneAnlageNetto)}</span>
                </div>
                <div className="flex justify-between text-violet-600 dark:text-violet-400">
                  <span>− Zeitanteilige AfA Anlagevermögen ({selectedYear})</span>
                  <span>− {fmt(data.afaOnlyAbschreibung)}</span>
                </div>
                {fahrtAbsetzbar > 0 && (
                  <div className="flex justify-between text-blue-600 dark:text-blue-400">
                    <span>− km-Pauschale Fahrtenbuch ({fahrtKmDienst.toFixed(0)} km)</span>
                    <span>− {fmt(fahrtAbsetzbar)}</span>
                  </div>
                )}
                {data.afaVollkaufpreis > 0 && (
                  <div className="flex justify-between text-[10px] text-muted-foreground pl-4">
                    <span>davon AfA-Anlagen (Kaufpreis: {fmt(data.afaVollkaufpreis)}, nur zeitanteilig absetzbar)</span>
                  </div>
                )}
                <div className="border-t pt-1 flex justify-between font-bold">
                  <span>= Steuerlicher Gewinn</span>
                  <span className="text-amber-700 dark:text-amber-400">{fmt(data.betriebsergebnisNachAfa)}</span>
                </div>
              </div>
              {data.betriebsergebnisNachAfa !== data.betriebsergebnisCashflow && (
                <div className="rounded bg-muted/50 p-2 text-[10px] text-muted-foreground">
                  <strong>Vergleich zum Cash-Gewinn:</strong> Der Cash-Gewinn beträgt {fmt(data.betriebsergebnisCashflow)}.
                  Die Differenz entsteht durch netto-Basis (EÜR) sowie AfA-Korrektur (voller Kaufpreis vs. zeitanteilige Abschreibung).
                </div>
              )}
            </div>
          )}

          {/* ── Nicht berücksichtigt ─── */}
          {(data.sonderausgaben > 0 || data.privatAusgaben > 0) && (
            <div className="rounded-lg bg-muted/50 border p-3 space-y-1.5">
              <p className="text-[11px] font-medium">ℹ️ Nicht im Betriebsergebnis enthalten:</p>
              {data.sonderausgaben > 0 && (
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Sonderausgaben (Krankenversicherung, Spenden etc.)</span>
                  <span>{fmt(data.sonderausgaben)}</span>
                </div>
              )}
              {data.privatAusgaben > 0 && (
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Private Ausgaben / Entnahmen</span>
                  <span>{fmt(data.privatAusgaben)}</span>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground italic">
                Diese Beträge fließen erst in die Einkommensteuererklärung ein, nicht ins Betriebsergebnis.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

