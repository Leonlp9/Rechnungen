// Kopfleiste am Desktop.
//
// Vorher standen hier acht gleichrangige Bedienelemente nebeneinander –
// Suche, Beträge, Design, Export, Sync, Hinweise, Entwürfe, Neue Rechnung.
// Dabei ging unter, was wirklich zählt. Jetzt gilt:
//
//   * links   die Suche
//   * rechts  nur, was sich von selbst meldet (Hinweise, Sync, Entwürfe)
//             und die eine Hauptaktion
//   * im „⋯"  alles, was man selten und bewusst anfasst
//
// Hinweise, Sync und Entwürfe blenden sich selbst aus, wenn es nichts zu
// zeigen gibt – im Normalfall bleiben also Suche, „⋯" und „Neue Rechnung".

import { Search, Plus, Moon, Sun, Download, Eye, EyeOff, FileStack, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataIssuesIndicator } from './DataIssuesIndicator';
import { SyncIndicator } from './SyncIndicator';

interface TopbarProps {
  onNewInvoice?: () => void;
  onExport?: () => void;
  onDrafts?: () => void;
}

export function Topbar({ onNewInvoice, onExport, onDrafts }: TopbarProps) {
  const darkMode = useAppStore((s) => s.darkMode);
  const setDarkMode = useAppStore((s) => s.setDarkMode);
  const privacyMode = useAppStore((s) => s.privacyMode);
  const togglePrivacyMode = useAppStore((s) => s.togglePrivacyMode);
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const draftsCount = useAppStore((s) => s.drafts?.length ?? 0);

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
  };

  return (
    // relative + z-30: ohne eigene Stapelebene lag das aufgeklappte
    // Hinweis-Panel hinter den Karten des Inhaltsbereichs.
    <header className="relative z-30 flex h-14 items-center gap-4 border-b border-border bg-background px-6">
      <button
        onClick={() => setSearchOpen(true)}
        data-tutorial="topbar-search"
        className="relative flex flex-1 max-w-md items-center gap-2 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Suchen…</span>
        <kbd className="hidden sm:flex items-center gap-0.5 rounded border border-border bg-background px-1.5 text-[10px]">
          Ctrl K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        {/* Melden sich nur, wenn es etwas zu melden gibt */}
        <DataIssuesIndicator />
        <SyncIndicator hideWhenOff />
        {draftsCount > 0 && (
          <Button
            variant="outline"
            size="icon"
            onClick={onDrafts}
            title={`${draftsCount} Entwurf${draftsCount !== 1 ? 'e' : ''} verarbeiten`}
            className="relative"
          >
            <FileStack className="h-4 w-4" />
            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
              {draftsCount > 99 ? '99+' : draftsCount}
            </span>
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" title="Weitere Aktionen" aria-label="Weitere Aktionen">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onSelect={() => onExport?.()}>
              <Download className="h-4 w-4" />
              Exportieren
            </DropdownMenuItem>
            {draftsCount > 0 && (
              <DropdownMenuItem onSelect={() => onDrafts?.()}>
                <FileStack className="h-4 w-4" />
                Entwürfe ({draftsCount})
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={togglePrivacyMode}>
              {privacyMode ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              {privacyMode ? 'Beträge einblenden' : 'Beträge ausblenden'}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={toggleDark}>
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {darkMode ? 'Helles Design' : 'Dunkles Design'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button onClick={onNewInvoice} data-tutorial="topbar-new-invoice">
          <Plus className="mr-2 h-4 w-4" />
          Neue Rechnung
        </Button>
      </div>
    </header>
  );
}
