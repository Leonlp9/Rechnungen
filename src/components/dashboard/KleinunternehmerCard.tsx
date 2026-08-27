import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store';
import { AlertTriangle, CheckCircle2, XCircle, Info } from 'lucide-react';
import { fmtCurrency } from '@/lib/utils';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import type { KleinunternehmerStatus } from '@/lib/steuer/gewinn';

/**
 * Stand der Kleinunternehmerregelung.
 *
 * Die Karte verglich früher die Einnahmen des laufenden Jahres mit 25.000 €
 * und warnte beim Überschreiten, man sei „ggf. umsatzsteuerpflichtig
 * geworden". Beides ist seit 2025 falsch: Die 25.000 € gelten für das
 * **Vorjahr**, im laufenden Jahr sind es 100.000 €. Wer im laufenden Jahr über
 * 25.000 € kommt, bleibt das ganze Jahr Kleinunternehmer und wechselt erst
 * zum 1. Januar. Nur die 100.000 € wirken sofort und mitten im Jahr.
 *
 * Deshalb zeigt die Karte jetzt beide Grenzen getrennt und sagt dazu, ab wann
 * eine Überschreitung wirkt.
 */
interface Props {
  status: KleinunternehmerStatus;
  privacyMode?: boolean;
  loading?: boolean;
}

export function KleinunternehmerCard({ status, privacyMode = false, loading }: Props) {
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

  const regelbesteuert = steuerregelung === 'regelbesteuerung';

  // Der Balken misst das laufende Jahr an der Grenze, die im laufenden Jahr
  // tatsächlich gilt. Die Vorjahresgrenze steht als eigene Zeile darunter –
  // sie entscheidet über das nächste Jahr, nicht über dieses.
  const pct = Math.min((status.umsatzLaufend / status.grenzeLaufend) * 100, 100);
  const pctVorjahr = Math.min((status.umsatzVorjahr / status.grenzeVorjahr) * 100, 100);
  // Für das Folgejahr zählt der Umsatz dieses Jahres gegen die Vorjahresgrenze.
  const pctFolgejahr = Math.min((status.umsatzLaufend / status.grenzeVorjahr) * 100, 100);

  const ampel: 'gut' | 'achtung' | 'kritisch' =
    status.folge === 'sofort' ? 'kritisch'
      : status.folge === 'ab_folgejahr' ? 'achtung'
        : pctFolgejahr >= 80 ? 'achtung' : 'gut';

  const StatusIcon = regelbesteuert ? Info
    : ampel === 'kritisch' ? XCircle
      : ampel === 'achtung' ? AlertTriangle
        : CheckCircle2;

  const statusColor = regelbesteuert ? 'text-blue-500'
    : ampel === 'kritisch' ? 'text-destructive'
      : ampel === 'achtung' ? 'text-amber-500'
        : 'text-emerald-500';

  const barColor = regelbesteuert ? 'bg-blue-500'
    : ampel === 'kritisch' ? 'bg-destructive'
      : ampel === 'achtung' ? 'bg-amber-500'
        : 'bg-emerald-500';

  return (
    <Card className="rounded-xl shadow-sm h-full flex flex-col">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
          Kleinunternehmergrenze {status.jahr}
          <InfoTooltip
            text="§ 19 UStG seit 2025: Kleinunternehmer bleibt, wer im Vorjahr höchstens 25.000 € Gesamtumsatz hatte und im laufenden Jahr 100.000 € nicht überschreitet. Ein Überschreiten der Vorjahresgrenze wirkt ab dem 1. Januar des Folgejahres, ein Überschreiten der 100.000 € dagegen sofort und mitten im Jahr. Anlagenverkäufe zählen nicht mit."
            side="top"
          />
        </CardTitle>
        <StatusIcon className={`h-4 w-4 flex-shrink-0 ${statusColor}`} />
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-3">
        {regelbesteuert ? (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              Du bist <span className="font-semibold text-foreground">regelbesteuert</span> – du weist
              Umsatzsteuer aus und führst sie ans Finanzamt ab. Zurück in die Kleinunternehmerregelung
              geht es erst, wenn dein Gesamtumsatz eines Jahres wieder unter {fmtCurrency(status.grenzeVorjahr, false)} liegt.
            </p>
            <div className="text-xl font-bold">{fmtCurrency(status.umsatzLaufend, privacyMode)}</div>
            <p className="text-[11px] text-muted-foreground">Gesamtumsatz {status.jahr}</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {/* Laufendes Jahr gegen die Grenze, die jetzt gilt */}
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xl font-bold">{fmtCurrency(status.umsatzLaufend, privacyMode)}</div>
                <div className="text-[11px] text-muted-foreground">
                  von {fmtCurrency(status.grenzeLaufend, false)} im laufenden Jahr
                </div>
              </div>
              {/* Die Prozentzahl misst gegen die Grenze, die im laufenden
                  Jahr gilt – die Ampel daneben hängt an der Vorjahresgrenze,
                  weil die über das nächste Jahr entscheidet. Deshalb bleibt
                  die Zahl neutral gefärbt. */}
              <div className="text-sm font-semibold text-muted-foreground">{pct.toFixed(0)} %</div>
            </div>

            <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Vorjahr – die Grenze, die über dieses Jahr entschieden hat */}
            <div className="border-t pt-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  Vorjahr {status.jahr - 1} (entscheidet über {status.jahr})
                </span>
                <span className={`text-[11px] font-semibold ${status.vorjahrUeberschritten ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {fmtCurrency(status.umsatzVorjahr, privacyMode)} / {fmtCurrency(status.grenzeVorjahr, false)}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${status.vorjahrUeberschritten ? 'bg-destructive' : 'bg-blue-400'}`}
                  style={{ width: `${pctVorjahr}%` }}
                />
              </div>
            </div>

            {/* Was daraus folgt – im Klartext */}
            {status.folge === 'sofort' ? (
              <p className="text-xs text-destructive font-medium">
                {fmtCurrency(status.grenzeLaufend, false)} überschritten – die Regelbesteuerung greift
                <strong> sofort</strong>, schon für den Umsatz, mit dem die Grenze gerissen wurde. Ab jetzt
                Umsatzsteuer ausweisen und voranmelden.
              </p>
            ) : status.folge === 'ab_folgejahr' ? (
              <p className="text-xs text-amber-600 font-medium">
                Über {fmtCurrency(status.grenzeVorjahr, false)}: Dieses Jahr bleibst du Kleinunternehmer,
                aber ab dem 1. Januar {status.jahr + 1} giltst du als regelbesteuert. Bis dahin Rechnungen
                und Preise umstellen.
              </p>
            ) : status.vorjahrUeberschritten ? (
              <p className="text-xs text-amber-600 font-medium">
                Der Vorjahresumsatz lag über {fmtCurrency(status.grenzeVorjahr, false)} – für {status.jahr}
                {' '}gilt eigentlich die Regelbesteuerung. Prüf die Einstellung unter Profil und Steuer.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Noch {fmtCurrency(Math.max(0, status.grenzeVorjahr - status.umsatzLaufend), privacyMode)} bis
                zur Grenze, ab der du im nächsten Jahr regelbesteuert wärst.
              </p>
            )}

            <p className="text-[10px] text-muted-foreground/60 leading-tight border-t pt-1.5">
              Maßgeblich ist der <strong>Gesamtumsatz</strong>, nicht der Gewinn – Ausgaben senken ihn nicht.
              Verkäufe von Anlagevermögen und durchlaufende Posten bleiben außen vor. § 19 UStG, kein
              Steuerberaterersatz.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
