import { useMemo } from 'react';
import { useDashboardContext } from './DashboardContext';
import { fmtCurrency } from '@/lib/utils';
import { useAppStore } from '@/store';
import { NUTZUNGSDAUER_LABELS } from '@/lib/afa';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, TrendingUp, TrendingDown, PiggyBank, Calculator, ShieldCheck, Package } from 'lucide-react';

/** Vermögens-Check: Was bleibt nach Steuern & Verbindlichkeiten? */
export function VermoegenCheckCard() {
  const { loading, privacyMode, gesamtSaldo, afaItems, selectedYear, betriebsergebnisNachAfa } = useDashboardContext();
  const steuerregelung = useAppStore((s) => s.steuerregelung);

  const data = useMemo(() => {
    // Liquide Mittel (Cash laut App)
    const cash = gesamtSaldo;

    // Sachanlagen: Restwert aller AfA-Güter
    const anlagenRestwert = afaItems
      .filter((item) => item.nutzungsdauer > 1 && item.proRata)
      .reduce((sum, item) => sum + (item.proRata?.restwertEndeJahr ?? 0), 0);

    // GWG: Sofort abgeschrieben, Buchwert = 0, aber als Info
    const gwgAnschaffung = afaItems
      .filter((item) => item.nutzungsdauer <= 1)
      .reduce((sum, item) => sum + item.invoice.netto, 0);
    const gwgAnzahl = afaItems.filter((item) => item.nutzungsdauer <= 1).length;

    // Steuerrücklage
    const GRUNDFREIBETRAG = 12_348;
    const zuVersteuern = Math.max(0, betriebsergebnisNachAfa - GRUNDFREIBETRAG);
    const steuerruecklage = Math.round(zuVersteuern * 0.3 * 100) / 100;

    // USt-Zahllast (nur Regelbesteuerung)
    let ustZahllast = 0;
    if (steuerregelung !== 'kleinunternehmer') {
      // simplified – actual calculation is in DashboardElementNode
      ustZahllast = 0; // We don't have yearInvoices here in gesamt context
    }

    // Gesamt-Aktiva
    const aktiva = cash + anlagenRestwert;

    // Gesamt-Passiva (Rückstellungen)
    const passiva = steuerruecklage + ustZahllast;

    // Netto-Vermögen
    const nettoVermoegen = aktiva - passiva;

    return { cash, anlagenRestwert, gwgAnschaffung, gwgAnzahl, steuerruecklage, ustZahllast, aktiva, passiva, nettoVermoegen };
  }, [gesamtSaldo, afaItems, betriebsergebnisNachAfa, steuerregelung]);

  if (loading) return <Skeleton className="h-72 rounded-xl" />;

  const fmt = (v: number) => fmtCurrency(v, privacyMode);

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-semibold">Vermögens-Check</span>
        </div>
        <span className="text-xs text-muted-foreground">Stand: {selectedYear}</span>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {/* Aktiva */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">
            <TrendingUp className="h-3.5 w-3.5" />
            Aktiva (Was du hast)
          </div>
          <div className="space-y-1.5 pl-5">
            <div className="flex justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Wallet className="h-3 w-3" /> Liquide Mittel (Cash)
              </span>
              <span className="font-medium">{fmt(data.cash)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Package className="h-3 w-3" /> Sachanlagen (Restwert)
              </span>
              <span className="font-medium">{fmt(data.anlagenRestwert)}</span>
            </div>
            {data.gwgAnzahl > 0 && (
              <div className="flex justify-between text-[10px] text-muted-foreground/70 pl-4">
                <span>+ {data.gwgAnzahl} GWG (Buchwert 0 €, Anschaffung: {fmt(data.gwgAnschaffung)})</span>
              </div>
            )}
            <div className="flex justify-between text-xs border-t pt-1.5 font-semibold">
              <span>Summe Aktiva</span>
              <span className="text-green-700 dark:text-green-400">{fmt(data.aktiva)}</span>
            </div>
          </div>
        </div>

        {/* Passiva */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide">
            <TrendingDown className="h-3.5 w-3.5" />
            Passiva (Was du schuldest)
          </div>
          <div className="space-y-1.5 pl-5">
            <div className="flex justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <PiggyBank className="h-3 w-3" /> Steuerrücklage (ESt)
              </span>
              <span className="font-medium">− {fmt(data.steuerruecklage)}</span>
            </div>
            {data.ustZahllast > 0 && (
              <div className="flex justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Calculator className="h-3 w-3" /> USt-Zahllast
                </span>
                <span className="font-medium">− {fmt(data.ustZahllast)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs border-t pt-1.5 font-semibold">
              <span>Summe Passiva</span>
              <span className="text-red-700 dark:text-red-400">− {fmt(data.passiva)}</span>
            </div>
          </div>
        </div>

        {/* Netto-Vermögen */}
        <div className={`rounded-lg p-3 text-center ${data.nettoVermoegen >= 0 ? 'bg-emerald-500/10 border border-emerald-300/30' : 'bg-red-500/10 border border-red-300/30'}`}>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Netto-Vermögen</div>
          <div className={`text-xl font-bold ${data.nettoVermoegen >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
            {fmt(data.nettoVermoegen)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            Aktiva − Rückstellungen = das bleibt dir wirklich
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t bg-muted/20 text-[10px] text-muted-foreground">
        💡 Vereinfachte Unternehmer-Übersicht – keine Bilanz nach HGB
      </div>
    </div>
  );
}

/** Investitions-Spiegel: Anlagevermögen mit Restwerten */
export function InvestitionsSpiegelCard() {
  const { loading, privacyMode, afaItems, selectedYear } = useDashboardContext();

  const { afaLinear, gwgItems } = useMemo(() => {
    const afaLinear = afaItems
      .filter((item) => item.nutzungsdauer > 1 && item.proRata)
      .map((item) => ({
        label: item.invoice.partner || item.invoice.description,
        typ: NUTZUNGSDAUER_LABELS[item.assetType] ?? item.assetType,
        kaufpreis: item.invoice.netto,
        restwert: item.proRata?.restwertEndeJahr ?? 0,
        abgeschrieben: item.invoice.netto - (item.proRata?.restwertEndeJahr ?? 0),
        prozent: item.invoice.netto > 0
          ? Math.round(((item.invoice.netto - (item.proRata?.restwertEndeJahr ?? 0)) / item.invoice.netto) * 100)
          : 100,
        endeJahr: item.proRata?.endeJahr ?? selectedYear,
        isGwg: false,
      }))
      .sort((a, b) => b.restwert - a.restwert);

    const gwgItems = afaItems
      .filter((item) => item.nutzungsdauer <= 1)
      .map((item) => ({
        label: item.invoice.partner || item.invoice.description,
        typ: NUTZUNGSDAUER_LABELS[item.assetType] ?? item.assetType,
        kaufpreis: item.invoice.netto,
        restwert: 0,
        abgeschrieben: item.invoice.netto,
        prozent: 100,
        endeJahr: new Date(item.invoice.date).getFullYear(),
        isGwg: true,
      }));

    return { afaLinear, gwgItems };
  }, [afaItems, selectedYear]);

  if (loading) return <Skeleton className="h-72 rounded-xl" />;

  const allItems = [...afaLinear, ...gwgItems];
  const totalKaufpreis = allItems.reduce((s, i) => s + i.kaufpreis, 0);
  const totalRestwert = allItems.reduce((s, i) => s + i.restwert, 0);
  const totalAbgeschrieben = totalKaufpreis - totalRestwert;

  const fmt = (v: number) => fmtCurrency(v, privacyMode);

  const renderItem = (item: typeof allItems[0], i: number) => (
    <div key={i} className="px-4 py-2.5 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium truncate">{item.label}</span>
            {item.isGwg && (
              <span className="text-[9px] rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 font-medium shrink-0">GWG</span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {item.typ} · {item.isGwg ? `Sofortabzug ${item.endeJahr}` : `bis ${item.endeJahr}`}
          </span>
        </div>
        <div className="text-right shrink-0 ml-3">
          <div className={`text-xs font-semibold ${item.restwert > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
            {fmt(item.restwert)}
          </div>
          <div className="text-[10px] text-muted-foreground">von {fmt(item.kaufpreis)}</div>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${item.isGwg ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-violet-500 to-violet-400'}`}
          style={{ width: `${item.prozent}%` }}
        />
      </div>
      <div className="text-[10px] text-muted-foreground text-right">{item.prozent}% abgeschrieben</div>
    </div>
  );

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-semibold">Investitions-Spiegel</span>
        </div>
        <span className="text-xs text-muted-foreground">{afaLinear.length} AfA + {gwgItems.length} GWG · {selectedYear}</span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 divide-x border-b">
        <div className="px-3 py-2 text-center">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Anschaffung</div>
          <div className="text-sm font-bold mt-0.5">{fmt(totalKaufpreis)}</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Abgeschrieben</div>
          <div className="text-sm font-bold text-red-600/80 mt-0.5">− {fmt(totalAbgeschrieben)}</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Restwert</div>
          <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{fmt(totalRestwert)}</div>
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {allItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground py-8">
            <Package className="h-8 w-8 opacity-40" />
            <p className="text-xs">Keine Wirtschaftsgüter vorhanden</p>
          </div>
        ) : (
          <div className="divide-y">
            {/* AfA-Anlagen zuerst (mit Restwert) */}
            {afaLinear.map((item, i) => renderItem(item, i))}
            {/* GWG danach */}
            {gwgItems.length > 0 && afaLinear.length > 0 && (
              <div className="px-4 py-1.5 bg-muted/30 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                GWG – Sofort abgeschrieben (Restwert 0 €)
              </div>
            )}
            {gwgItems.map((item, i) => renderItem(item, afaLinear.length + i))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t bg-muted/20 text-[10px] text-muted-foreground">
        Restwert = Anschaffungskosten − kumulierte AfA (Ende {selectedYear})
      </div>
    </div>
  );
}







