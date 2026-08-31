// ─── Der Prüfbericht ─────────────────────────────────────────────────────────
//
// Was hier steht, entscheidet darüber, ob die Prüfung hilft oder nur nervt.
// Drei Dinge sind deshalb Absicht:
//
// Jeder Punkt nennt die Fundstelle. „Fehlt" ohne Begründung liest sich wie eine
// Behauptung; mit „§ 34a Satz 1 Nr. 5 UStDV" daneben kann man nachschlagen und
// selbst entscheiden.
//
// Punkte aus der KI sind als solche gekennzeichnet. Eine feste Regel und eine
// Vermutung sind nicht dasselbe, und der Unterschied gehört nicht verwischt.
//
// Der Weg vorbei bleibt offen. Ein Programm kennt den Sachverhalt nicht – wer
// weiß, dass eine Warnung hier nicht zutrifft, muss weiterarbeiten können. Nur
// still übergehen soll es sich nicht.

import { AlertTriangle, Check, Info, Loader2, Sparkles, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { cn } from '@/lib/utils';
import { zaehle, type Befund, type Schwere } from '@/lib/rechnung/pruefung';

const AUSSEHEN: Record<Schwere, { farbe: string; hintergrund: string; symbol: React.ReactNode; wort: string }> = {
  fehler: {
    farbe: 'text-destructive',
    hintergrund: 'border-destructive/30 bg-destructive/5',
    symbol: <XCircle className="h-4 w-4" />,
    wort: 'Fehler',
  },
  warnung: {
    farbe: 'text-amber-600 dark:text-amber-500',
    hintergrund: 'border-amber-500/30 bg-amber-500/5',
    symbol: <AlertTriangle className="h-4 w-4" />,
    wort: 'Warnung',
  },
  hinweis: {
    farbe: 'text-muted-foreground',
    hintergrund: 'border-border bg-muted/30',
    symbol: <Info className="h-4 w-4" />,
    wort: 'Hinweis',
  },
};

interface Props {
  offen: boolean;
  onClose: () => void;
  befunde: Befund[];
  /** Läuft die KI-Prüfung gerade? */
  kiLaeuft: boolean;
  /** Fehlermeldung der KI-Prüfung, falls sie nicht durchlief. */
  kiFehler: string | null;
  /** Gibt es einen Schlüssel, mit dem man die KI überhaupt fragen könnte? */
  kiMoeglich: boolean;
  /** Startet die KI-Prüfung von Hand. */
  onKiPruefen: () => void;
  /** Beschriftung des Knopfes, der trotz Befunden weitermacht. */
  weiterLabel: string;
  onWeiter: () => void;
}

export function Pruefbericht({
  offen, onClose, befunde, kiLaeuft, kiFehler, kiMoeglich, onKiPruefen, weiterLabel, onWeiter,
}: Props) {
  const n = zaehle(befunde);
  const sauber = befunde.length === 0 && !kiLaeuft;

  const ueberschrift = sauber
    ? 'Alles vollständig'
    : [
      n.fehler && `${n.fehler} ${n.fehler === 1 ? 'Fehler' : 'Fehler'}`,
      n.warnungen && `${n.warnungen} ${n.warnungen === 1 ? 'Warnung' : 'Warnungen'}`,
      n.hinweise && `${n.hinweise} ${n.hinweise === 1 ? 'Hinweis' : 'Hinweise'}`,
    ].filter(Boolean).join(' · ');

  return (
    <ResponsiveModal
      open={offen}
      onClose={onClose}
      title="Rechnung geprüft"
      description={
        kiLaeuft && !befunde.length
          ? 'Die KI liest die Rechnung gerade gegen …'
          : sauber
            ? 'Die Pflichtangaben sind vollständig und nichts widerspricht sich.'
            : ueberschrift
      }
      desktopClassName="max-w-xl"
    >
      <div className="space-y-4">
        {sauber && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
            <Check className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-500" />
            <p className="text-[15px] leading-snug">
              Nichts gefunden. Die Rechnung kann so heraus.
            </p>
          </div>
        )}

        {befunde.map((f, i) => {
          const a = AUSSEHEN[f.schwere];
          return (
            <div key={i} className={cn('rounded-xl border px-4 py-3', a.hintergrund)}>
              <div className="flex items-start gap-2.5">
                <span className={cn('mt-0.5 shrink-0', a.farbe)}>{a.symbol}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[15px] font-semibold leading-snug">{f.titel}</span>
                    {f.quelle === 'ki' && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        <Sparkles className="h-3 w-3" /> KI
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[14px] leading-snug text-muted-foreground">{f.text}</p>
                  {f.fundstelle && (
                    <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground/70">{f.fundstelle}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {kiLaeuft && (
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/30 px-4 py-3 text-[14px] text-muted-foreground">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            Die KI liest die Rechnung gegen – Beschreibung, Widersprüche, Unklarheiten.
          </div>
        )}

        {kiFehler && (
          <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-[13px] leading-snug text-muted-foreground">
            Die KI-Prüfung lief nicht durch: {kiFehler} Die Prüfung der Pflichtangaben oben ist davon
            unberührt – die läuft ohne Netz.
          </p>
        )}

        {!kiLaeuft && !kiFehler && kiMoeglich && (
          <Button variant="outline" className="w-full gap-2" onClick={onKiPruefen}>
            <Sparkles className="h-4 w-4" />
            Zusätzlich von der KI gegenlesen lassen
          </Button>
        )}

        {!kiMoeglich && (
          <p className="px-1 text-[13px] leading-snug text-muted-foreground">
            Für das zusätzliche Gegenlesen durch die KI fehlt der Gemini-Schlüssel. Du trägst ihn
            unter Einstellungen ein. Die Prüfung der Pflichtangaben oben braucht ihn nicht.
          </p>
        )}

        <div className="flex flex-col gap-2 pt-1 sm:flex-row-reverse">
          {n.fehler > 0 ? (
            <>
              <Button className="flex-1" onClick={onClose}>Zurück zur Rechnung</Button>
              <Button variant="ghost" className="flex-1 text-muted-foreground" onClick={onWeiter}>
                {weiterLabel}
              </Button>
            </>
          ) : (
            <>
              <Button className="flex-1" onClick={onWeiter} disabled={kiLaeuft}>
                {kiLaeuft ? 'Moment …' : weiterLabel}
              </Button>
              <Button variant="ghost" className="flex-1 text-muted-foreground" onClick={onClose}>
                Zurück zur Rechnung
              </Button>
            </>
          )}
        </div>
      </div>
    </ResponsiveModal>
  );
}
