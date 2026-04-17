import { Search, Plus, Moon, Sun, Download, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
  };

  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-background px-6">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Suchen..." className="pl-9" />
      </div>

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
