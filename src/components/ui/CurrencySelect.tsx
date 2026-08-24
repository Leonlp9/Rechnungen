// Währungsauswahl – bewusst eine feste Liste statt Freitext.
//
// Nur für die hier gelisteten Währungen gibt es EZB-Referenzkurse, also nur
// für die kann automatisch und nachvollziehbar in Euro umgerechnet werden.

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CURRENCIES } from '@/lib/currency';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  className?: string;
}

export function CurrencySelect({ value, onChange, disabled, className }: Props) {
  return (
    <Select value={value || 'EUR'} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={cn('w-full', className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {CURRENCIES.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            <span className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold">{c.code}</span>
              <span className="text-muted-foreground">{c.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
