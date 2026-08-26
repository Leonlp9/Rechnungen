// Währungsauswahl – bewusst eine feste Liste statt Freitext.
//
// Nur für die hier gelisteten Währungen gibt es EZB-Referenzkurse, also nur
// für die kann automatisch und nachvollziehbar in Euro umgerechnet werden.
//
// Auf dem Handy ist das KEIN Aufklappmenü: 31 Einträge füllten dort den
// gesamten Bildschirm. Stattdessen ein Blatt von unten, das höchstens die
// halbe Höhe einnimmt, mit Suchfeld und den vier gebräuchlichen Währungen
// vorneweg – so sind zwei Tipper statt einer langen Scrollstrecke nötig.

import { useMemo, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useSheetDrag, SheetGrabber } from '@/components/ui/sheet-drag';
import { CURRENCIES } from '@/lib/currency';
import { useIsMobile } from '@/hooks/useIsMobile';
import { cn } from '@/lib/utils';

/** Was in dieser App tatsächlich vorkommt – der Rest steht darunter. */
const COMMON = ['EUR', 'USD', 'CHF', 'GBP'];

interface Props {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  className?: string;
}

export function CurrencySelect({ value, onChange, disabled, className }: Props) {
  const isMobile = useIsMobile();
  const code = value || 'EUR';

  if (isMobile) return <MobileCurrencyPicker code={code} onChange={onChange} disabled={disabled} className={className} />;

  return (
    <Select value={code} onValueChange={onChange} disabled={disabled}>
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

function MobileCurrencyPicker({
  code,
  onChange,
  disabled,
  className,
}: {
  code: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { contentRef, onGrabberMouseDown } = useSheetDrag(() => setOpen(false));

  const current = CURRENCIES.find((c) => c.code === code);

  const { common, rest } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (c: (typeof CURRENCIES)[number]) =>
      !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
    const hits = CURRENCIES.filter(match);
    // Beim Suchen stört die Zweiteilung – dann zählt nur noch der Treffer.
    if (q) return { common: [], rest: hits };
    return {
      common: hits.filter((c) => COMMON.includes(c.code)),
      rest: hits.filter((c) => !COMMON.includes(c.code)),
    };
  }, [query]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          'flex items-center gap-1.5 text-[17px] disabled:opacity-50',
          className,
        )}
      >
        <span className="font-mono text-[11px] font-semibold text-muted-foreground">{code}</span>
        <span className="text-muted-foreground">{current?.name ?? code}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground/60" />
      </button>

      <Sheet open={open} onOpenChange={(v) => { if (!v) { setOpen(false); setQuery(''); } }}>
        <SheetContent
          ref={contentRef}
          side="bottom"
          showCloseButton={false}
          aria-describedby={undefined}
          className="max-h-[60dvh] gap-0 rounded-t-2xl p-0"
        >
          <SheetTitle className="sr-only">Währung wählen</SheetTitle>
          <SheetGrabber onMouseDown={onGrabberMouseDown} />

          <div className="shrink-0 px-4 pb-3">
            <div data-search-field className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Währung suchen"
                className="w-full bg-transparent text-[17px] outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div
            className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
          >
            {common.length > 0 && (
              <CurrencyGroup title="Häufig" items={common} selected={code} onPick={pick} />
            )}
            {rest.length > 0 && (
              <CurrencyGroup
                title={common.length > 0 ? 'Alle Währungen' : undefined}
                items={rest}
                selected={code}
                onPick={pick}
              />
            )}
            {common.length === 0 && rest.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Keine Währung gefunden</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function CurrencyGroup({
  title,
  items,
  selected,
  onPick,
}: {
  title?: string;
  items: typeof CURRENCIES;
  selected: string;
  onPick: (code: string) => void;
}) {
  return (
    <section className="space-y-1.5">
      {title && <h3 className="px-4 text-[13px] font-medium text-muted-foreground">{title}</h3>}
      <div data-list-group className="overflow-hidden rounded-xl bg-card [&>*:last-child>span]:border-b-0">
        {items.map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => onPick(c.code)}
            className="flex w-full items-stretch text-left active:bg-accent"
          >
            <span className="ml-4 flex min-h-[44px] flex-1 items-center gap-3 border-b border-border pr-4">
              <span className="w-10 shrink-0 font-mono text-[13px] font-semibold text-muted-foreground">
                {c.code}
              </span>
              <span className="min-w-0 flex-1 truncate text-[17px]">{c.name}</span>
              {c.code === selected && <Check className="h-[18px] w-[18px] shrink-0 text-primary" />}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
