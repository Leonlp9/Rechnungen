import { useMemo } from 'react';
import { useDashboardContext } from './DashboardContext';
import { fmtCurrency } from '@/lib/utils';
import { CATEGORY_LABELS, SONDERAUSGABEN_CATEGORIES, PRIVAT_CATEGORIES } from '@/types';
import type { Category } from '@/types';
import { Calculator, TrendingUp, TrendingDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: 'cash' | 'afa';
}

export function BetriebsergebnisDialog({ open, onOpenChange, variant }: Props) {
  const { privacyMode, yearInvoices, selectedYear, afaItems, afaJahresAbschreibung } = useDashboardContext();

  const data = useMemo(() => {
    const nichtBetrieblich: Category[] = [...SONDERAUSGABEN_CATEGORIES, ...PRIVAT_CATEGORIES];

    // Einnahmen nach Kategorie
    const einnahmenInvoices = yearInvoices.filter((i) => i.type === 'einnahme');
    const einnahmenGesamt = einnahmenInvoices.reduce((s, i) => s + i.brutto, 0);

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

    // Betriebsergebnis nach AfA: Betriebsausgaben OHNE AfA/GWG-Vollkauf + nur zeitanteilige AfA
    const ausgabenOhneAfaGwg = betriebsausgabenGesamt - afaVollkaufpreis - gwgVollkaufpreis;
    const betriebsergebnisNachAfa = einnahmenGesamt - ausgabenOhneAfaGwg - afaJahresAbschreibung;

    return {
      einnahmenGesamt,
      einnahmenByCategory,
      betriebsausgabenGesamt,
      ausgabenByCategory,
      betriebsergebnisCashflow,
      sonderausgaben,
      privatAusgaben,
      afaVollkaufpreis,
      gwgVollkaufpreis,
      ausgabenOhneAfaGwg,
      betriebsergebnisNachAfa,
    };
  }, [yearInvoices, afaItems, afaJahresAbschreibung]);

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
                  <span className="text-muted-foreground">Einnahmen</span>
                  <span className="font-medium">{fmt(data.einnahmenGesamt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">− Betriebsausgaben (ohne AfA/GWG-Käufe)</span>
                  <span className="font-medium">− {fmt(data.ausgabenOhneAfaGwg)}</span>
                </div>
                <div className="flex justify-between text-violet-600 dark:text-violet-400">
                  <span>− Zeitanteilige AfA + GWG-Sofortabzug ({selectedYear})</span>
                  <span>− {fmt(afaJahresAbschreibung)}</span>
                </div>
                {data.afaVollkaufpreis > 0 && (
                  <div className="flex justify-between text-[10px] text-muted-foreground pl-4">
                    <span>davon AfA-Anlagen (Kaufpreis: {fmt(data.afaVollkaufpreis)}, nur anteilig absetzbar)</span>
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
                  Die Differenz von {fmt(Math.abs(data.betriebsergebnisNachAfa - data.betriebsergebnisCashflow))} entsteht
                  durch die AfA-Korrektur (voller Kaufpreis vs. zeitanteilige Abschreibung).
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

