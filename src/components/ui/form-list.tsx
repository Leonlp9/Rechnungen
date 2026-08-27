// Formular als Gruppenliste – das Eingabe-Gegenstück zu `list-group.tsx`.
//
// Beschriftung links, Eingabe rechts, mindestens 44 pt hoch, Trennlinie zur
// nächsten Zeile, mehrere Zeilen in einer flächigen Gruppe. Auf dem Handy ist
// das deutlich ruhiger als Label über Feld: gestapelte Label/Feld-Paare
// ergaben eine endlose Kolonne, in der kein Zusammenhang mehr zu sehen war.
//
// Bewusst themenneutral – das Apple-Theme legt darüber nur noch Systemfarben
// und durchsichtige Felder (siehe App.css).

import { cn } from '@/lib/utils';

/** Eingabefeld in einer Formularzeile: rechtsbündig, ohne eigene Fläche. */
export const FIELD =
  'w-auto min-w-0 flex-1 bg-transparent text-right text-[17px] outline-none placeholder:text-muted-foreground/60';

/**
 * Datumsfelder ziehen ihren Inhalt immer nach links – `text-align` greift im
 * Inneren eines `input[type=date]` nicht. Also darf das Feld gar nicht erst
 * die ganze Zeile einnehmen: ohne `flex-1` schrumpft es auf seine Breite und
 * die Zeile schiebt es nach rechts, wo alle anderen Werte auch stehen.
 */
export const FIELD_DATE = 'w-auto min-w-0 shrink-0 bg-transparent text-[17px] outline-none';

/** Auswahlfelder in Formularzeilen: keine eigene Fläche, Inhalt rechts. */
export const FIELD_SELECT = 'h-9 w-auto max-w-52 min-w-32 border-0 bg-transparent shadow-none';

export function FormGroup({
  title,
  footer,
  children,
  className,
}: {
  title?: string;
  footer?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-1.5', className)}>
      {title && <h2 data-list-title className="px-4 text-[13px] font-medium text-muted-foreground">{title}</h2>}
      <div data-list-group className="overflow-hidden rounded-xl bg-card [&>*:last-child]:border-b-0">
        {children}
      </div>
      {footer && <p className="px-4 text-[13px] leading-snug text-muted-foreground">{footer}</p>}
    </section>
  );
}

export function FormRow({
  label,
  hint,
  warn,
  children,
}: {
  label: string;
  /**
   * Ein Satz unter der Beschriftung. Für Schalter, deren Wirkung man nicht
   * sieht – etwa „Fahrzeug im Betriebsvermögen", das die Kilometerpauschale
   * abschaltet.
   */
  hint?: string;
  /** Beschriftung hervorheben, wenn mit dem Wert etwas nicht stimmt */
  warn?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div data-form-row className="flex min-h-[44px] items-center gap-3 border-b border-border px-4 py-1.5">
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[17px]', warn && 'text-amber-600 dark:text-amber-400')}>
          {label}
        </span>
        {hint && (
          <span className="block pb-1 pr-2 text-[13px] leading-snug text-muted-foreground">{hint}</span>
        )}
      </span>
      <div className={cn('flex min-w-0 items-center justify-end', hint ? 'shrink-0' : 'flex-1')}>
        {children}
      </div>
    </div>
  );
}

/** Zeile über die volle Breite – für mehrzeilige Felder wie die Notiz. */
export function FormFullRow({ children }: { children: React.ReactNode }) {
  return <div data-form-row className="border-b border-border px-4 py-2.5">{children}</div>;
}
