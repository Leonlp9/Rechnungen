// KI-Assistent auf dem Handy.
//
// Statt des frei verschiebbaren Fensters (Desktop) ein Bottom-Sheet über die
// volle Breite – erreichbar von jeder Seite über die Kopfzeile oder das
// „Mehr"-Menü. Geöffnet/geschlossen wird über denselben chatStore wie am
// Desktop, damit beide Einstiegspunkte denselben Zustand teilen.

import { Bot, X } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useChatStore } from '@/store/chatStore';
import { useAppStore } from '@/store';
import { useChatContext, useCurrentInvoiceHasPdf, useIsInvoiceList } from '@/hooks/useChatContext';
import { ChatPanel } from './ChatPanel';

export function MobileAIChat() {
  const isOpen = useChatStore((s) => s.isOpen);
  const setOpen = useChatStore((s) => s.setOpen);
  const showAiChat = useAppStore((s) => s.showAiChat);
  const pageContext = useChatContext();
  const hasPdf = useCurrentInvoiceHasPdf();
  const isInvoiceList = useIsInvoiceList();

  if (!showAiChat) return null;

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        aria-describedby={undefined}
        // data-[side=bottom]: nötig, weil SheetContent per Attribut-Selektor
        // h-auto setzt – eine einfache h-Klasse würde davon überstimmt.
        className="gap-0 rounded-t-2xl p-0 data-[side=bottom]:h-[92dvh]"
      >
        <SheetTitle className="sr-only">KI-Assistent</SheetTitle>

        {/* Ziehgriff + Kopfzeile */}
        <div className="shrink-0">
          <div className="flex justify-center pt-2.5 pb-1">
            <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
          </div>
          <div className="flex items-center gap-2 px-3 pb-2">
            <Bot className="h-5 w-5 shrink-0 text-primary" />
            <span className="flex-1 text-sm font-semibold">KI-Assistent</span>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Schließen">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <ChatPanel pageContext={pageContext} hasPdf={hasPdf} isInvoiceList={isInvoiceList} mobile />
        </div>
      </SheetContent>
    </Sheet>
  );
}
