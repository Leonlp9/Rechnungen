// Suchfeld im iOS-Stil: gefüllte Fläche, Lupe links, Löschen rechts.
//
// Ein normales Eingabefeld mit Rahmen sah auf dem Handy wie ein Formularfeld
// aus – man erkannte nicht, dass darin gesucht wird. Diese Bauform ist auf
// iOS die Konvention und kommt in dieser App an mehreren Stellen vor.

import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchField({ value, onChange, placeholder = 'Suchen', className }: Props) {
  return (
    <div data-search-field className={cn('flex items-center gap-2 rounded-xl bg-muted px-3 py-2', className)}>
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-[17px] outline-none placeholder:text-muted-foreground"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Eingabe löschen" className="text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
