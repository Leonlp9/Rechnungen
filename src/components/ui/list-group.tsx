// Gruppenliste im iOS-Stil („inset grouped list").
//
// Das ist DAS Layoutmuster von iOS: eine abgerundete Fläche, darin Zeilen mit
// farbiger Icon-Kachel links, Beschriftung, optionalem Wert rechts und einem
// Chevron. Trennlinien beginnen erst hinter der Kachel, darüber steht eine
// kleine graue Sektionsüberschrift.
//
// Maße nach Apples Vorgaben: Zeile mindestens 44 pt (auch die Trefferfläche),
// Seitenrand 16 pt, Sektionsabstand 32 pt, Icon-Kachel 29 pt.
//
// Bewusst themenneutral gebaut – die App ist auf dem Handy auch in den
// anderen Themes übersichtlicher damit. Das Apple-Theme legt nur noch
// Systemfarben und -radien darüber.

import { NavLink } from 'react-router-dom';
import { Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Farbwert der Icon-Kachel. Standardmäßig wird er NICHT ausgespielt – die
 * Kachel bleibt neutral, damit die App außerhalb des Apple-Themes nicht wie
 * iOS aussieht. Erst `.apple26` färbt sie über `[data-tint]` in den
 * iOS-Systemfarben ein (siehe App.css).
 */
export type ListTint =
  | 'blue' | 'green' | 'red' | 'orange' | 'purple'
  | 'teal' | 'pink' | 'indigo' | 'yellow' | 'gray';

interface ListGroupProps {
  /** Kleine Überschrift über der Gruppe */
  title?: string;
  /** Erklärender Text unter der Gruppe – in iOS der Section Footer */
  footer?: string;
  children: React.ReactNode;
  className?: string;
}

export function ListGroup({ title, footer, children, className }: ListGroupProps) {
  return (
    <section className={cn('space-y-1.5', className)}>
      {title && (
        <h2 data-list-title className="px-4 text-[13px] font-medium text-muted-foreground">{title}</h2>
      )}
      {/* Trennlinie der letzten Zeile entfällt – dafür der :last-child-Griff */}
      <div
        data-list-group
        className="overflow-hidden rounded-xl bg-card [&>*:last-child_[data-row-body]]:border-b-0"
      >
        {children}
      </div>
      {footer && <p className="px-4 text-[13px] leading-snug text-muted-foreground">{footer}</p>}
    </section>
  );
}

interface ListRowProps {
  icon?: React.ReactNode;
  tint?: ListTint;
  label: React.ReactNode;
  /** Zweite Zeile unter der Beschriftung */
  hint?: React.ReactNode;
  /** Rechtsbündiger Wert, grau – wie „Ein"/„Aus" in den iOS-Einstellungen */
  value?: React.ReactNode;
  /** Ersetzt den Chevron, z. B. durch einen Schalter */
  trailing?: React.ReactNode;
  /** Kein Chevron anzeigen (z. B. bei reinen Anzeigezeilen) */
  noChevron?: boolean;
  to?: string;
  onClick?: () => void;
  /** Zeile in Rot – für löschende Aktionen */
  destructive?: boolean;
  active?: boolean;
}

function RowInner({
  icon, tint = 'gray', label, hint, value, trailing, noChevron, destructive, interactive, current,
}: ListRowProps & { interactive: boolean; current?: boolean }) {
  return (
    <>
      {icon && (
        <span
          data-tint={tint}
          // Einheitliche Strichstärke und Größe: Die Symbole haben von Haus
          // aus unterschiedliche optische Gewichte, nebeneinander wirkte die
          // Liste dadurch unruhig.
          // self-center statt fester Randabstände: Die Kachel bleibt so auch
          // dann mittig, wenn ein Theme die Zeilenhöhe oder die Kachelgröße
          // ändert (One UI: 60-px-Zeile mit 36-px-Kreis).
          className="ml-4 flex h-[29px] w-[29px] shrink-0 items-center justify-center self-center rounded-[8px] bg-muted text-muted-foreground [&_svg]:h-4 [&_svg]:w-4 [&_svg]:stroke-[1.9]"
        >
          {icon}
        </span>
      )}
      <span
        data-row-body
        className={cn(
          'flex min-h-[44px] min-w-0 flex-1 items-center gap-3 border-b border-border py-2 pr-4',
          icon ? 'ml-3' : 'ml-4',
        )}
      >
        <span className="min-w-0 flex-1">
          <span
            data-row-label
            className={cn(
              'block truncate text-[17px] leading-tight',
              destructive && 'text-destructive',
              current && 'font-semibold text-primary',
            )}
          >
            {label}
          </span>
          {hint && <span data-row-hint className="mt-0.5 block truncate text-[13px] text-muted-foreground">{hint}</span>}
        </span>
        {value && <span data-row-value className="shrink-0 text-[17px] text-muted-foreground">{value}</span>}
        {trailing}
        {/* Die aktuelle Seite bekommt statt des Chevrons ein Häkchen – sonst
            sieht man in der Liste nicht, wo man gerade ist. */}
        {!trailing && current && <Check className="h-[18px] w-[18px] shrink-0 text-primary" />}
        {!trailing && !current && !noChevron && interactive && (
          // Eigener Haken: One UI zeigt in Listenzeilen keinen Pfeil.
          <ChevronRight data-row-chevron className="h-4 w-4 shrink-0 text-muted-foreground/50" />
        )}
      </span>
    </>
  );
}

export function ListRow(props: ListRowProps) {
  const { to, onClick, active } = props;
  const base = 'flex w-full items-stretch text-left transition-colors';

  if (to) {
    return (
      <NavLink data-list-row to={to} end={to === '/'} className={cn(base, 'active:bg-accent')}>
        {/* Keine flächige Markierung – ein grauer Block auf genau einer Zeile
            ließ die Liste unsauber wirken. Die aktuelle Seite zeigt sich über
            blaue Beschriftung und Häkchen, so wie iOS eine Auswahl markiert. */}
        {({ isActive }) => <RowInner {...props} interactive current={isActive} />}
      </NavLink>
    );
  }

  if (onClick) {
    return (
      // `active` markiert eine getroffene Wahl – dieselbe Darstellung wie die
      // aktuelle Seite: blaue Beschriftung und Häkchen statt Chevron. So
      // liest sich eine Auswahlliste wie in den iOS-Einstellungen.
      <button data-list-row type="button" onClick={onClick} className={cn(base, 'active:bg-accent')}>
        <RowInner {...props} interactive current={active} />
      </button>
    );
  }

  return (
    <div data-list-row className={base}>
      <RowInner {...props} interactive={false} />
    </div>
  );
}
