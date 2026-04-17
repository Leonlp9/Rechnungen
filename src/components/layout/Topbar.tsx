import { Search, Plus, Moon, Sun, Download, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store';

interface TopbarProps {
  onNewInvoice?: () => void;
  onExport?: () => void;
}

export function Topbar({ onNewInvoice, onExport }: TopbarProps) {
  const darkMode = useAppStore((s) => s.darkMode);
  const setDarkMode = useAppStore((s) => s.setDarkMode);
  const privacyMode = useAppStore((s) => s.privacyMode);
  const togglePrivacyMode = useAppStore((s) => s.togglePrivacyMode);
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
  };

  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-background px-6">
      <button
        onClick={() => setSearchOpen(true)}
        className="relative flex flex-1 max-w-md items-center gap-2 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Suchen…</span>
        <kbd className="hidden sm:flex items-center gap-0.5 rounded border border-border bg-background px-1.5 text-[10px]">
          Ctrl K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={togglePrivacyMode} title={privacyMode ? 'Beträge einblenden' : 'Beträge ausblenden'}>
          {privacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={toggleDark}>
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="outline" onClick={onExport}>
          <Download className="mr-2 h-4 w-4" />
          Exportieren
        </Button>
        <Button onClick={onNewInvoice}>
          <Plus className="mr-2 h-4 w-4" />
          Neue Rechnung
        </Button>
      </div>
    </header>
  );
}


