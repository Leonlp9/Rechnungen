import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store';
import { AlertTriangle, CheckCircle2, XCircle, Info } from 'lucide-react';
import { fmtCurrency } from '@/lib/utils';

interface Props {
  einnahmen: number;   // aktuelle Jahreseinnahmen
  selectedYear: number;
  privacyMode?: boolean;
  loading?: boolean;
}

// Grenzwert: ab 2025 gilt 25.000 €, davor 22.000 €
function getGrenzwert(year: number) {
  return year >= 2025 ? 25_000 : 22_000;
}

export function KleinunternehmerCard({ einnahmen, selectedYear, privacyMode = false, loading }: Props) {
  const steuerregelung = useAppStore((s) => s.steuerregelung);

  if (loading) {
    return (
      <Card className="rounded-xl shadow-sm h-full flex flex-col">
        <CardHeader><Skeleton className="h-5 w-48" /></CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  const grenzwert = getGrenzwert(selectedYear);
  const pct = Math.min((einnahmen / grenzwert) * 100, 100);
  const verbleibend = Math.max(grenzwert - einnahmen, 0);
  const ueberschritten = einnahmen > grenzwert;

  // Farb-Stufen: < 70 % grün, 70–90 % gelb, > 90 % rot
  const barColor =
    steuerregelung === 'regelbesteuerung'
      ? 'bg-blue-500'
      : ueberschritten
      ? 'bg-destructive'
      : pct >= 90
      ? 'bg-amber-500'
      : pct >= 70
      ? 'bg-yellow-400'
      : 'bg-emerald-500';

  const StatusIcon =
    steuerregelung === 'regelbesteuerung'
      ? Info
      : ueberschritten
      ? XCircle
      : pct >= 90
      ? AlertTriangle
      : CheckCircle2;

  const statusColor =
    steuerregelung === 'regelbesteuerung'
      ? 'text-blue-500'
      : ueberschritten
      ? 'text-destructive'
      : pct >= 90
      ? 'text-amber-500'
      : 'text-emerald-500';

  return (
    <Card className="rounded-xl shadow-sm h-full flex flex-col">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Kleinunternehmergrenze {selectedYear}
        </CardTitle>
        <StatusIcon className={`h-4 w-4 flex-shrink-0 ${statusColor}`} />
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-3">
        {steuerregelung === 'regelbesteuerung' ? (
          // ── Regelbesteuerung ──
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              Du bist <span className="font-semibold text-foreground">regelbesteuert</span> – du weist Umsatzsteuer auf
              Rechnungen aus und führst sie ans Finanzamt ab. Die 25.000-€-Grenze gilt für dich nicht.
            </p>
            <div className="text-xl font-bold">
              {fmtCurrency(einnahmen, privacyMode)}
            </div>
            <p className="text-[11px] text-muted-foreground">Einnahmen {selectedYear} (Brutto-Umsatz)</p>
          </div>
        ) : (
          // ── Kleinunternehmer ──
          <div className="space-y-2">
            {/* Betrag + Grenzwert */}
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xl font-bold">
                  {fmtCurrency(einnahmen, privacyMode)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  von {fmtCurrency(grenzwert, false)} Grenzwert
                </div>
              </div>
              <div className={`text-sm font-semibold ${statusColor}`}>
                {pct.toFixed(0)} %
              </div>
            </div>

            {/* Progress Bar */}
            <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Status-Text */}
            {ueberschritten ? (
              <p className="text-xs text-destructive font-medium">
                ⚠️ Grenzwert überschritten! Du bist ggf. umsatzsteuerpflichtig geworden –
                bitte Steuerberater kontaktieren.
              </p>
            ) : pct >= 90 ? (
              <p className="text-xs text-amber-600 font-medium">
                Fast am Limit – noch {fmtCurrency(verbleibend, privacyMode)} bis zur Grenze.
              </p>
            ) : pct >= 70 ? (
              <p className="text-xs text-yellow-600">
                Noch {fmtCurrency(verbleibend, privacyMode)} Spielraum bis zur Grenze.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Noch {fmtCurrency(verbleibend, privacyMode)} bis zur Umsatzsteuergrenze.
              </p>
            )}

            <p className="text-[10px] text-muted-foreground/60 leading-tight border-t pt-1.5 mt-0.5">
              ⚠️ Grenze = <strong>Brutto-Umsatz</strong> (deine Einnahmen), nicht Gewinn.
              Ausgaben senken diese Grenze <strong>nicht</strong>. § 19 UStG – kein Steuerberaterersatz.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


