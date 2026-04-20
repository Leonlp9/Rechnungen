import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardContext } from './DashboardContext';
import { fmtCurrency } from '@/lib/utils';
import { NUTZUNGSDAUER_LABELS } from '@/lib/afa';
import { Calculator, Package, Zap, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import katex from 'katex';
import 'katex/dist/katex.min.css';

function KaTeX({ math, display = false }: { math: string; display?: boolean }) {
  const html = katex.renderToString(math, { throwOnError: false, displayMode: display });
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Formatiert eine Zahl für KaTeX (deutsch mit Komma) */
function fmtKaTeX(v: number): string {
  return v.toFixed(2).replace('.', '{,}') + '\\,€';
}

export function AfaUebersichtCard() {
  const { loading, privacyMode, afaInvoices, gwgInvoices, afaGesamtNetto, gwgGesamtNetto, afaJahresAbschreibung, afaItems, selectedYear } = useDashboardContext();
  const navigate = useNavigate();
  const [detailOpen, setDetailOpen] = useState(false);

  if (loading) return <Skeleton className="h-64 rounded-xl" />;

  const totalItems = afaInvoices.length + gwgInvoices.length;

  return (
    <>
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-semibold">AfA & GWG – {selectedYear}</span>
        </div>
        <span className="text-xs text-muted-foreground">{totalItems} Wirtschaftsgüter</span>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 divide-x border-b">
        <div className="px-3 py-2 text-center">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">AfA-Anlagen</div>
          <div className="text-sm font-bold mt-0.5">{fmtCurrency(afaGesamtNetto, privacyMode)}</div>
          <div className="text-[10px] text-muted-foreground">{afaInvoices.length} Posten</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">GWG</div>
          <div className="text-sm font-bold mt-0.5">{fmtCurrency(gwgGesamtNetto, privacyMode)}</div>
          <div className="text-[10px] text-muted-foreground">{gwgInvoices.length} Posten</div>
        </div>
        <div
          className="px-3 py-2 text-center cursor-pointer hover:bg-muted/40 transition-colors group"
          onClick={() => setDetailOpen(true)}
          title="Klicken für vollständige AfA-Berechnung"
        >
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Jahres-AfA {selectedYear}</div>
          <div className="text-sm font-bold text-violet-600 dark:text-violet-400 mt-0.5 group-hover:underline">{fmtCurrency(afaJahresAbschreibung, privacyMode)}</div>
          <div className="text-[10px] text-muted-foreground">zeitanteilig absetzbar ▸</div>
        </div>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto">
        {totalItems === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground py-8">
            <Package className="h-8 w-8 opacity-40" />
            <p className="text-xs">Keine Wirtschaftsgüter in {selectedYear}</p>
          </div>
        ) : (
          <div className="divide-y">
            {afaItems.map(({ invoice: inv, assetType, empfohlen, jahresAfa, proRata }) => {
              const isGwg = inv.category === 'gwg';
              const shouldBeAfa = inv.netto > 800 && inv.category === 'gwg';
              const shouldBeGwg = inv.netto <= 800 && inv.category === 'anlagevermoegen_afa';
              const hasIssue = shouldBeAfa || shouldBeGwg;
              const isAnteilig = proRata && proRata.monateImJahr < 12 && proRata.monateImJahr > 0;

              return (
                <div
                  key={inv.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 cursor-pointer transition-colors group',
                    hasIssue && 'bg-amber-500/5',
                  )}
                  onClick={() => navigate(`/invoices/${inv.id}`)}
                >
                  <div className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-lg shrink-0',
                    isGwg ? 'bg-emerald-500/10' : 'bg-violet-500/10',
                  )}>
                    {isGwg
                      ? <Zap className="h-3.5 w-3.5 text-emerald-600" />
                      : <Calculator className="h-3.5 w-3.5 text-violet-600" />
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium truncate">{inv.partner || inv.description}</span>
                      {hasIssue && (
                        <span className="text-[9px] rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 font-medium shrink-0">
                          ⚠ {shouldBeAfa ? 'Sollte AfA sein' : 'Sollte GWG sein'}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <span>{NUTZUNGSDAUER_LABELS[assetType] ?? assetType}</span>
                      <span>·</span>
                      <span>{empfohlen}</span>
                      {isAnteilig && (
                        <>
                          <span>·</span>
                          <span className="text-violet-500 font-medium">{proRata.monateImJahr}/12 Mon.</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-semibold">{fmtCurrency(jahresAfa, privacyMode)}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {isAnteilig ? `anteilig ${selectedYear}` : jahresAfa > 0 ? `in ${selectedYear}` : 'n/a'}
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer legend */}
      <div className="px-4 py-2 border-t bg-muted/20 flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-emerald-500" /> GWG ≤ 800 € (Sofort)</span>
        <span className="flex items-center gap-1"><Calculator className="h-3 w-3 text-violet-500" /> AfA &gt; 800 € (zeitanteilig)</span>
      </div>
    </div>

    {/* ─── KaTeX AfA-Berechnungs-Dialog ─── */}
    <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-violet-500" />
            AfA-Berechnung – {selectedYear} (zeitanteilig)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 text-sm">
          {/* Erklärung */}
          <div className="rounded-lg border border-blue-300/30 bg-blue-500/5 p-4 space-y-2">
            <p className="font-semibold text-blue-700 dark:text-blue-400">Zeitanteilige Abschreibung (pro rata temporis)</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Die AfA wird <strong>monatsgenau</strong> ab dem Kaufmonat berechnet. Der Kaufmonat zählt immer als voller Monat.
              Bei einem Kauf im Juli läuft die AfA z.B. über 6 Monate im ersten Jahr, dann volle Jahre, und im letzten Jahr die verbleibenden Monate.
            </p>
            <div className="mt-2 text-center py-2">
              <KaTeX math="\text{AfA im Jahr} = \frac{\text{Netto}}{n \text{ Jahre}} \times \frac{\text{Monate im Jahr}}{12}" display />
            </div>
            <p className="text-muted-foreground text-[11px]">
              <strong>GWG</strong> (≤ 800 € netto): Sofortabzug im Kaufjahr (keine Verteilung). <strong>Lineare AfA</strong> (&gt; 800 €): Zeitanteilig über die Nutzungsdauer.
            </p>
          </div>

          {/* Gesamtformel */}
          {!privacyMode && afaItems.length > 0 && (
          <div className="rounded-lg border p-4 space-y-3">
            <p className="font-semibold">Steuerlich absetzbar in {selectedYear}</p>
            <div className="text-center py-2 overflow-x-auto">
              <KaTeX math={`\\boxed{\\text{Gesamt-AfA}_{${selectedYear}} = ${fmtKaTeX(afaJahresAbschreibung)}}`} display />
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              Diesen Betrag kannst du {selectedYear} in deiner EÜR als Betriebsausgabe geltend machen.
            </p>
          </div>
          )}

          {/* Einzelposten */}
          {afaItems.length > 0 && (
            <div className="space-y-3">
              <p className="font-semibold">Einzelposten ({afaItems.length})</p>
              <div className="divide-y rounded-lg border overflow-hidden">
                {afaItems.map(({ invoice: inv, assetType, jahresAfa, nutzungsdauer, proRata }) => {
                  const isGwg = nutzungsdauer <= 1;
                  const kaufDatum = new Date(inv.date);
                  const kaufMonatLabel = kaufDatum.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

                  return (
                    <div key={inv.id} className="px-4 py-3 space-y-2 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isGwg
                            ? <Zap className="h-3.5 w-3.5 text-emerald-500" />
                            : <Calculator className="h-3.5 w-3.5 text-violet-500" />
                          }
                          <span className="font-medium text-xs">{inv.description || inv.partner}</span>
                          <span className="text-[10px] text-muted-foreground rounded bg-muted px-1.5 py-0.5">
                            {NUTZUNGSDAUER_LABELS[assetType] ?? assetType}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">
                          {fmtCurrency(jahresAfa, privacyMode)} in {selectedYear}
                        </span>
                      </div>

                      {/* Kaufdatum */}
                      <div className="text-[10px] text-muted-foreground">
                        Kauf: {kaufMonatLabel} · Netto: {fmtCurrency(inv.netto, privacyMode)}
                        {!isGwg && proRata && <> · Abgeschrieben bis: {proRata.endeJahr}</>}
                      </div>

                      {/* Formel */}
                      {!privacyMode && (
                        <div className="text-center py-1.5 bg-muted/30 rounded">
                          {isGwg ? (
                            <KaTeX math={`\\text{GWG-Sofortabzug: } ${fmtKaTeX(inv.netto)}`} />
                          ) : proRata ? (
                            <KaTeX math={`\\frac{${fmtKaTeX(inv.netto)}}{${nutzungsdauer}} \\times \\frac{${proRata.monateImJahr}}{12} = \\boldsymbol{${fmtKaTeX(jahresAfa)}}`} />
                          ) : null}
                        </div>
                      )}

                      {/* Jahresplan für lineare AfA */}
                      {!isGwg && proRata && !privacyMode && (
                        <div className="mt-1">
                          <details className="group">
                            <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                              ▸ Abschreibungsplan anzeigen ({proRata.jahresplan.length} Jahre)
                            </summary>
                            <div className="mt-1.5 rounded border overflow-hidden">
                              <table className="w-full text-[10px]">
                                <thead>
                                  <tr className="bg-muted/50">
                                    <th className="text-left px-2 py-1 font-medium">Jahr</th>
                                    <th className="text-center px-2 py-1 font-medium">Monate</th>
                                    <th className="text-right px-2 py-1 font-medium">AfA</th>
                                    <th className="text-right px-2 py-1 font-medium">Restwert</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {proRata.jahresplan.map((row: { jahr: number; monate: number; betrag: number; restwert: number }) => (
                                    <tr key={row.jahr} className={cn(
                                      'border-t',
                                      row.jahr === selectedYear && 'bg-violet-500/5 font-semibold',
                                    )}>
                                      <td className="px-2 py-1">{row.jahr}{row.jahr === selectedYear ? ' ◄' : ''}</td>
                                      <td className="px-2 py-1 text-center">{row.monate}/12</td>
                                      <td className="px-2 py-1 text-right">{fmtCurrency(row.betrag, false)}</td>
                                      <td className="px-2 py-1 text-right">{fmtCurrency(row.restwert, false)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </details>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {afaItems.length === 0 && (
            <div className="text-center text-muted-foreground py-6">
              <Package className="h-8 w-8 mx-auto opacity-40 mb-2" />
              <p>Keine Wirtschaftsgüter mit AfA/GWG in {selectedYear}.</p>
            </div>
          )}

          {/* Hinweis Typ-Erkennung */}
          <div className="rounded-lg bg-muted/50 border p-3 space-y-1">
            <p className="text-[11px] font-medium">💡 Typ-Erkennung</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Der Wirtschaftsgut-Typ (Computer, Smartphone, Kamera etc.) wird automatisch aus der Beschreibung erkannt
              und bestimmt die Nutzungsdauer. Falls der Typ falsch erkannt wird, passe die Beschreibung des Belegs
              an (z.B. „Samsung Monitor" statt nur „Samsung"). Der Typ wird <strong>nicht</strong> als „Monitor"
              erkannt, wenn nur der Hersteller steht.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}



