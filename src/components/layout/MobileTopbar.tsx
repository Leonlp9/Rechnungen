// Kopfzeile für das Mobile-Layout.
//
// Ersetzt die Desktop-Topbar: Titel der aktuellen Seite, Zurück-Navigation,
// Suche, Sync-Status und die wichtigsten Aktionen – damit auf dem Handy
// nichts fehlt, was am Desktop oben rechts sitzt.

import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Bot, Plus, FileStack, MoreVertical, Eye, EyeOff, Moon, Sun, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppStore } from '@/store';
import { useChatStore } from '@/store/chatStore';
import { NAV_ITEMS } from './navItems';
import { SyncIndicator } from './SyncIndicator';

/** Seitentitel aus der Route ableiten (inkl. Detailrouten). */
function usePageTitle(): { title: string; canGoBack: boolean } {
  const { pathname } = useLocation();
  const exact = NAV_ITEMS.find((i) => i.to === pathname);
  if (exact) return { title: exact.label, canGoBack: false };
  if (pathname.startsWith('/invoices/')) return { title: 'Beleg', canGoBack: true };
  if (pathname.startsWith('/projects/')) return { title: 'Projekt', canGoBack: true };
  const prefix = NAV_ITEMS.filter((i) => i.to !== '/').find((i) => pathname.startsWith(i.to));
  return { title: prefix?.label ?? 'Klevr', canGoBack: true };
}

interface Props {
  onNewInvoice: () => void;
  onDrafts: () => void;
  onExport: () => void;
}

export function MobileTopbar({ onNewInvoice, onDrafts, onExport }: Props) {
  const navigate = useNavigate();
  const { title, canGoBack } = usePageTitle();
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const draftsCount = useAppStore((s) => s.drafts?.length ?? 0);
  const privacyMode = useAppStore((s) => s.privacyMode);
  const togglePrivacyMode = useAppStore((s) => s.togglePrivacyMode);
  const darkMode = useAppStore((s) => s.darkMode);
  const setDarkMode = useAppStore((s) => s.setDarkMode);
  const showAiChat = useAppStore((s) => s.showAiChat);
  const setChatOpen = useChatStore((s) => s.setOpen);

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
  };

  return (
    <header
      className="flex shrink-0 items-center gap-1 border-b border-border bg-background/95 px-2 backdrop-blur"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 0.5rem)',
        paddingRight: 'calc(env(safe-area-inset-right, 0px) + 0.5rem)',
      }}
    >
      <div className="flex h-14 w-full items-center gap-1">
        {canGoBack ? (
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(-1)} aria-label="Zurück">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        ) : (
          <img src="/klevr.svg" alt="" className="ml-1 h-6 w-6 shrink-0" />
        )}

        <h1 className="min-w-0 flex-1 truncate px-1 text-base font-semibold">{title}</h1>

        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setSearchOpen(true)} aria-label="Suchen">
          <Search className="h-5 w-5" />
        </Button>

        <SyncIndicator compact />

        {draftsCount > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="relative shrink-0"
            onClick={onDrafts}
            aria-label={`${draftsCount} Entwürfe`}
          >
            <FileStack className="h-5 w-5" />
            <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full px-1 py-0 text-[9px]">
              {draftsCount}
            </Badge>
          </Button>
        )}

        {/* KI-Assistent – von jeder Seite aus erreichbar. Hervorgehoben in
            derselben Sprache wie die Scan-Aktion unten: im Light-Mode schwarz,
            im Dark-Mode hell – keine Fremdfarbe. */}
        {showAiChat && (
          <button
            onClick={() => setChatOpen(true)}
            aria-label="KI-Assistent öffnen"
            className="ml-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background shadow-sm transition-transform active:scale-95"
          >
            <Bot className="h-5 w-5" />
          </button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0" aria-label="Weitere Aktionen">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={togglePrivacyMode}>
              {privacyMode ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
              {privacyMode ? 'Beträge einblenden' : 'Beträge ausblenden'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleDark}>
              {darkMode ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
              {darkMode ? 'Helles Design' : 'Dunkles Design'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onNewInvoice}>
              <Plus className="mr-2 h-4 w-4" />
              Beleg aus PDF anlegen
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExport}>
              <Download className="mr-2 h-4 w-4" />
              Exportieren
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDrafts}>
              <FileStack className="mr-2 h-4 w-4" />
              Entwürfe {draftsCount > 0 && `(${draftsCount})`}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
