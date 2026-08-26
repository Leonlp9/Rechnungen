// Einheitliche Seitenüberschrift.
//
// Vorher hatte jede Seite ihren eigenen Kopfbereich – mal 24 px fett, mal mit
// Icon, mal mit Knöpfen inline im Fließtext. Auf dem Handy wirkte das unruhig,
// weil auf jeder Seite etwas anderes über dem Inhalt stand.
//
// Regel hier: großer Titel links, Aktionen als Symbole rechts daneben. Auf dem
// Handy fällt der Titel deutlich größer aus (28 px) – das Apple-Theme hebt ihn
// auf die iOS-Large-Title-Größe von 34 px an, One UI setzt ihn mittig.
//
// ── Warum die Kopfleiste hier gerendert wird ─────────────────────────────
// Die Zeile mit Zurück-Pfeil, kleinem Titel und Aktionen gehört UNTER die
// große Überschrift: Sie wandert beim Scrollen mit nach oben und bleibt dort
// hängen (`position: sticky`). Läge sie im Layout über der Überschrift,
// müsste man sie per Skript auf Position halten – das ruckelt sichtbar.
// Deshalb meldet diese Komponente dem Layout, dass sie die Leiste selbst
// mitbringt; das Layout lässt sie dann weg.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store';
import { useIsMobile } from '@/hooks/useIsMobile';
import { MobileBackLink, usePageBar } from './MobileBackLink';

interface PageHeaderProps {
  title: string;
  /** Kurze Einordnung unter dem Titel */
  subtitle?: string;
  /** Symbolknöpfe rechts neben dem Titel */
  actions?: React.ReactNode;
  /**
   * Eigener Weg zurück. Nötig für Unterseiten, die eine Seite selbst
   * verwaltet (die Einstellungen etwa wechseln nur ihren Reiter, es gibt
   * also keinen Eintrag im Verlauf, zu dem man springen könnte).
   */
  back?: { label: string; onClick: () => void };
  /**
   * Öffnet die Seite mit großem Titel. One UI klappt Seiten sonst gleich ein
   * – auf der Startseite eines Bereichs gehört der große Titel aber dazu.
   */
  startExpanded?: boolean;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, back, startExpanded, className }: PageHeaderProps) {
  const isMobile = useIsMobile();
  const setPageHeaderMounted = useAppStore((s) => s.setPageHeaderMounted);
  const pageBar = usePageBar();

  const inBar = useAppStore((s) => s.theme === 'oneui') && isMobile;
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!isMobile) return;
    setPageHeaderMounted(true);
    return () => setPageHeaderMounted(false);
  }, [isMobile, setPageHeaderMounted]);



  // Die Leiste mit Pfeil und kleinem Titel. Wo sie steht, hängt vom Theme ab:
  // One UI legt sie UNTER die große Überschrift – dort klappt der Titel beim
  // Scrollen in sie hinein. Überall sonst gehört der Weg zurück ÜBER den
  // Titel, so wie iOS, Fluent und die übrigen es halten.
  const bar = isMobile ? (
    <MobileBackLink
      {...pageBar}
      {...(back ? { target: back.label, current: title, onBack: back.onClick } : null)}
      hasTitle
      startExpanded={startExpanded}
      onSlotReady={(el) => setSlot(inBar ? el : null)}
    />
  ) : null;

  return (
    <>
      {!inBar && bar}
      <div data-page-header className={cn('flex items-start gap-3', className)}>
        <div data-page-title className="min-w-0 flex-1">
          <h1 className="truncate text-[28px] leading-tight font-bold tracking-tight md:text-2xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm leading-snug text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {actions && !slot && (
          // Eigener Haken, damit Themes die Aktionen getrennt platzieren
          // können – One UI hängt sie in die Leiste darunter.
          <div data-page-actions className="flex shrink-0 items-center gap-1.5 pt-0.5">
            {actions}
          </div>
        )}
      </div>
      {inBar && bar}
      {actions && slot && createPortal(actions, slot)}
    </>
  );
}
