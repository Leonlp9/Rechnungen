import { Info } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './tooltip';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';

interface InfoTooltipProps {
  /** Erklärungstext der im Tooltip erscheint */
  text: string;
  /** Seite an der der Tooltip erscheint (Standard: top) */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Zusätzliche CSS-Klassen für den Icon-Wrapper */
  className?: string;
}

/**
 * Kleines ⓘ-Icon-Tooltip für Begriffserklärungen.
 * Wird ausgeblendet, wenn der Nutzer "Erklärungssymbole" in den Einstellungen deaktiviert hat.
 */
export function InfoTooltip({ text, side = 'top', className }: InfoTooltipProps) {
  const showGlossarTooltips = useAppStore((s) => s.showGlossarTooltips);

  if (!showGlossarTooltips) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex cursor-help items-center text-muted-foreground/50 hover:text-muted-foreground transition-colors shrink-0',
              className,
            )}
            // Screenreader-freundlich
            aria-label={text}
            tabIndex={0}
          >
            <Info className="h-3.5 w-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs text-xs leading-relaxed">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

