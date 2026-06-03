import { useState, useRef, useCallback, useEffect } from 'react';
import { searchPlaces } from '@/lib/geocoding';
import type { GeoPlace } from '@/lib/geocoding';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onChange: (value: string, place?: GeoPlace) => void;
  placeholder?: string;
  className?: string;
}

export function PlaceSearchInput({ value, onChange, placeholder, className }: Props) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<GeoPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value changes (e.g. form reset)
  useEffect(() => { setQuery(value); }, [value]);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 3) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    try {
      const results = await searchPlaces(q);
      setSuggestions(results);
      setOpen(results.length > 0);
      setFocusedIdx(-1);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    onChange(v, undefined);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => doSearch(v), 320);
  };

  const handleSelect = (place: GeoPlace) => {
    setQuery(place.shortName);
    setSuggestions([]);
    setOpen(false);
    onChange(place.shortName, place);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setFocusedIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && focusedIdx >= 0) { e.preventDefault(); handleSelect(suggestions[focusedIdx]); }
    if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-8 pr-7"
          autoComplete="off"
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground animate-spin" />
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 rounded-md border bg-popover shadow-lg overflow-hidden">
          {suggestions.map((place, idx) => (
            <button
              key={place.placeId}
              type="button"
              className={cn(
                'w-full text-left px-3 py-2 text-xs flex items-start gap-2 transition-colors',
                idx === focusedIdx ? 'bg-accent' : 'hover:bg-muted',
              )}
              onMouseDown={() => handleSelect(place)}
            >
              <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <div className="font-medium truncate">{place.shortName}</div>
                <div className="text-muted-foreground truncate text-[10px]">{place.displayName}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

