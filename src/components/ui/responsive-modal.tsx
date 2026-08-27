// Ein Formular, zwei Auftritte: Dialog am Desktop, Blatt von unten am Handy.
//
// Die Dialoge dieser App waren auf dem Handy schwer zu bedienen – ein
// mittiger Kasten mit eigenem Scrollbalken, dessen Felder in zwei Spalten
// standen und dessen Schließkreuz oben rechts kaum zu treffen war. Auf dem
// Handy gehört so etwas an den unteren Rand: mit Griff zum Wegziehen, in
// voller Breite und in Daumennähe.
//
// Der Inhalt bleibt in beiden Fällen derselbe – nur die Hülle wechselt.

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useSheetDrag, SheetGrabber } from '@/components/ui/sheet-drag';
import { useIsMobile } from '@/hooks/useIsMobile';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Beschriftung des Abbruch-Verweises oben rechts (nur Handy); leer = keiner */
  closeLabel?: string;
  /** false = lässt sich weder wegziehen noch danebentippen (z. B. während eines Downloads) */
  dismissible?: boolean;
  /** Klassen für den Dialog am Desktop (z. B. `max-w-lg`) */
  desktopClassName?: string;
  children: React.ReactNode;
}

export function ResponsiveModal({
  open,
  onClose,
  title,
  description,
  closeLabel = 'Abbrechen',
  dismissible = true,
  desktopClassName,
  children,
}: Props) {
  const isMobile = useIsMobile();
  const { contentRef, onGrabberMouseDown } = useSheetDrag(() => { if (dismissible) onClose(); });

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(v) => { if (!v && dismissible) onClose(); }}>
        <SheetContent
          ref={contentRef}
          side="bottom"
          showCloseButton={false}
          aria-describedby={undefined}
          className="max-h-[92dvh] gap-0 rounded-t-2xl p-0"
        >
          <SheetTitle className="sr-only">{title}</SheetTitle>
          <SheetGrabber onMouseDown={onGrabberMouseDown} />
          <div
            className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 pt-1"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
          >
            <div className="flex items-baseline justify-between gap-3 px-1">
              <div className="min-w-0">
                <h2 className="truncate text-[22px] font-bold tracking-tight">{title}</h2>
                {description && (
                  <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{description}</p>
                )}
              </div>
              {closeLabel && (
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 text-[17px] text-primary active:opacity-60"
                >
                  {closeLabel}
                </button>
              )}
            </div>
            {children}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Am Desktop bleibt die Überschrift stehen und nur der Inhalt rollt. Ohne die
  // Deckelung wächst ein langes Formular aus dem Fenster heraus und der Rest ist
  // schlicht nicht mehr erreichbar.
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && dismissible) onClose(); }}>
      <DialogContent
        className={cn(
          'max-h-[85dvh] max-w-lg grid-rows-[auto_minmax(0,1fr)]',
          desktopClassName,
        )}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="-mx-1 min-h-0 overflow-y-auto overscroll-contain px-1">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
