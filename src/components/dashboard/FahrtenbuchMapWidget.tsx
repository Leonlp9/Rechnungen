import { useState } from 'react';
import { Car, CalendarDays, CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlleFahrtenMap } from '@/components/fahrtenbuch/AlleFahrtenMap';
import type { Fahrt } from '@/lib/db';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface Props {
  fahrtFahrten: Fahrt[];       // alle Fahrten des gewählten Jahres
  fahrtFahrtenMonat: Fahrt[];  // Fahrten des gewählten Monats
  selectedYear: number;
  selectedMonth: number;
}

export function FahrtenbuchMapWidget({ fahrtFahrten, fahrtFahrtenMonat, selectedYear, selectedMonth }: Props) {
  const [mode, setMode] = useState<'monat' | 'jahr'>('monat');

  const fahrten = mode === 'monat' ? fahrtFahrtenMonat : fahrtFahrten;

  const monthLabel = format(new Date(selectedYear, selectedMonth - 1, 1), 'MMMM yyyy', { locale: de });
  const label = mode === 'monat' ? monthLabel : String(selectedYear);

  const dienstFahrten = fahrten.filter(f => f.art === 'dienst');
  const privatFahrten = fahrten.filter(f => f.art === 'privat');

  return (
    <div className="rounded-xl border bg-card shadow-sm h-full flex flex-col overflow-hidden min-h-[380px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
        <div className="flex items-center gap-2">
          <Car className="h-4 w-4 text-blue-500" />
          <span className="font-semibold text-sm">Fahrten auf Karte – {label}</span>
          {fahrten.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {dienstFahrten.length} Dienst · {privatFahrten.length} Privat
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <Button
            variant={mode === 'monat' ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={() => setMode('monat')}
          >
            <CalendarDays className="h-3.5 w-3.5" /> Monat
          </Button>
          <Button
            variant={mode === 'jahr' ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={() => setMode('jahr')}
          >
            <CalendarRange className="h-3.5 w-3.5" /> Jahr
          </Button>
        </div>
      </div>

      {/* Legende */}
      <div className="flex items-center gap-4 px-4 py-1.5 bg-muted/30 border-b flex-shrink-0 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-5 h-1 rounded bg-blue-500" /> Dienstfahrt
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-5 h-1 rounded bg-gray-400" /> Privatfahrt
        </span>
        <span className="ml-auto">Klicken auf eine Route für Details</span>
      </div>

      {/* Karte */}
      <div className="flex-1 min-h-0">
        {fahrten.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
            <Car className="h-10 w-10 opacity-20" />
            <p>Keine Fahrten für {label} eingetragen.</p>
          </div>
        ) : (
          <AlleFahrtenMap fahrten={fahrten} className="h-full w-full" />
        )}
      </div>
    </div>
  );
}

