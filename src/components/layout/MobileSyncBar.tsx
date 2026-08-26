// Sync-Anzeige für das Handy: ein schmaler Streifen am oberen Rand.
//
// Seit die Kopfleiste weg ist, gibt es dort keinen Platz mehr für ein
// Symbol – nötig ist er aber weiterhin: Wenn im Hintergrund abgeglichen
// wird, soll man das auf jeder Seite sehen können, ohne erst ins Menü zu
// gehen. Zwei Pixel Farbe reichen dafür, und im Ruhezustand ist der
// Streifen gar nicht da (kein Platzverbrauch, keine Unruhe).
//
// Rot bleibt stehen, solange ein Fehler ansteht – der Grund dazu steht im
// „Mehr"-Menü in der Sync-Zeile.

import { useSyncStatus } from '@/lib/sync';
import { cn } from '@/lib/utils';

export function MobileSyncBar() {
  const { running, lastError } = useSyncStatus();
  if (!running && !lastError) return null;

  return (
    <div
      role="status"
      aria-label={running ? 'Synchronisiere' : 'Synchronisierung fehlgeschlagen'}
      className="h-[2px] shrink-0 overflow-hidden bg-transparent"
    >
      <div
        className={cn(
          'h-full',
          running ? 'w-1/3 animate-[rm-sync-slide_1.1s_ease-in-out_infinite] bg-primary' : 'w-full bg-destructive',
        )}
      />
    </div>
  );
}
