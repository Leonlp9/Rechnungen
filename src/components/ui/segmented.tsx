// Segmentierte Auswahl („segmented control").
//
// Bisher war das an jeder Stelle ein eigenes Stück Markup – mal mit Rahmen,
// mal ohne, mit unterschiedlichen Radien und Schriftgrößen. Hier einmal in
// iOS-Maßen: Spur 32 pt hoch, Radius 9 pt, der ausgewählte Reiter als
// erhabene Kachel mit 7 pt Radius, Beschriftung 13 pt halbfett.
//
// Die Farben bleiben themenneutral; `.apple26` legt über `[data-segmented]`
// die Systemfarben darüber (siehe App.css).

import { cn } from '@/lib/utils';

interface Props<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  className?: string;
}

export function Segmented<T extends string>({ value, onChange, options, className }: Props<T>) {
  return (
    <div data-segmented className={cn('flex shrink-0 gap-1 rounded-[9px] bg-muted p-[2px]', className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            data-selected={selected || undefined}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex-1 rounded-[7px] px-3 py-1.5 text-[13px] font-semibold transition-colors',
              selected ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
