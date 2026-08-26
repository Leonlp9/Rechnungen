// Antippbare Marke für Filter und Kategorien.
//
// Auf dem Handy sind Aufklappmenüs für so etwas unpraktisch: Sie legen sich
// über den Inhalt und zeigen immer nur einen Punkt. Marken nebeneinander
// zeigen dagegen alles auf einmal und sind mit dem Daumen zu treffen.
//
// Die Themes greifen über `data-filter-chip` zu (One UI: Pille mit
// Akzentkontur, Windows 11: eckige Schaltfläche, Apple: gefüllte Pille).

import { cn } from '@/lib/utils';

interface ChipProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

export function Chip({ active, onClick, children, className }: ChipProps) {
  return (
    <button
      type="button"
      data-filter-chip
      data-active={active ? '' : undefined}
      onClick={onClick}
      className={cn(
        'min-h-9 rounded-full px-3.5 py-1.5 text-[15px] transition-colors active:opacity-70',
        active ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
        className,
      )}
    >
      {children}
    </button>
  );
}
