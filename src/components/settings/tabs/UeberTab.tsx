import { invoke } from '@tauri-apps/api/core';
import { Code2, ExternalLink, GitBranch, RefreshCw, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListGroup, ListRow } from '@/components/ui/list-group';
import { useIsMobile } from '@/hooks/useIsMobile';
import { toast } from 'sonner';
import { checkForUpdates } from '@/lib/updater';

interface UeberTabProps {
  version: string;
  checkingUpdate: boolean;
  setCheckingUpdate: (v: boolean) => void;
  clearingCache: boolean;
  setClearingCache: (v: boolean) => void;
}

export function UeberTab({ version, checkingUpdate, setCheckingUpdate, clearingCache, setClearingCache }: UeberTabProps) {
  const isMobile = useIsMobile();

  const clearCache = async () => {
    setClearingCache(true);
    try {
      const deleted = await invoke<number>('cleanup_old_invoice_files', { days: 0 });
      toast.success(deleted > 0 ? `Cache geleert – ${deleted} Datei${deleted === 1 ? '' : 'en'} gelöscht` : 'Cache ist bereits leer');
    } catch (e) {
      toast.error('Fehler beim Leeren des Caches: ' + String(e));
    } finally {
      setClearingCache(false);
    }
  };

  // ── Handy: Zeilen statt Karte ──
  // Version, Entwickler und Verweise sind Angaben zum Nachschlagen – auf dem
  // Telefon stehen die in Zeilen mit Wert rechts, nicht als Textblöcke.
  if (isMobile) {
    return (
      <div className="space-y-8">
        <ListGroup title="App">
          <ListRow icon={<Code2 />} tint="blue" label="Klevr" value={version ? `v${version}` : '…'} noChevron />
          <ListRow label="Technik" value="Tauri · React · SQLite" noChevron />
        </ListGroup>

        <ListGroup title="Entwickler">
          <ListRow icon={<User />} tint="gray" label="Leon Rabe" hint="Softwareentwicklung · Freelancer" noChevron />
        </ListGroup>

        <ListGroup title="Verweise">
          <ListRow
            icon={<GitBranch />}
            tint="purple"
            label="Quelltext"
            hint="github.com/Leonlp9/Rechnungen"
            onClick={() => window.open('https://github.com/Leonlp9/Rechnungen', '_blank', 'noopener')}
          />
          <ListRow
            icon={<ExternalLink />}
            tint="indigo"
            label="Entwicklerprofil"
            hint="github.com/Leonlp9"
            onClick={() => window.open('https://github.com/Leonlp9', '_blank', 'noopener')}
          />
        </ListGroup>

        <div className="space-y-3">
          <Button
            variant="secondary"
            className="h-11 w-full text-[17px]"
            onClick={async () => { setCheckingUpdate(true); await checkForUpdates(false); setCheckingUpdate(false); }}
            disabled={checkingUpdate}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${checkingUpdate ? 'animate-spin' : ''}`} />
            {checkingUpdate ? 'Suche…' : 'Nach Updates suchen'}
          </Button>
          <Button variant="secondary" className="h-11 w-full text-[17px]" onClick={clearCache} disabled={clearingCache}>
            <Trash2 className={`mr-2 h-4 w-4 ${clearingCache ? 'animate-spin' : ''}`} />
            {clearingCache ? 'Leere…' : 'Cache leeren'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader><CardTitle className="text-base">Über</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10"><Code2 className="h-5 w-5 text-primary" /></div>
          <div>
            <p className="text-sm font-semibold">Klevr</p>
            <p className="text-xs text-muted-foreground">Version: <span className="font-mono font-medium text-foreground">{version ? `v${version}` : '...'}</span></p>
            <p className="text-xs text-muted-foreground mt-0.5">Tauri · React · TypeScript · SQLite</p>
          </div>
        </div>
        <div className="h-px bg-border" />
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Entwickler</p>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-sm">L</div>
            <div><p className="text-sm font-medium">Leon Rabe</p><p className="text-xs text-muted-foreground">Softwareentwicklung · Freelancer</p></div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Links</p>
          <a href="https://github.com/Leonlp9/Rechnungen" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
            <GitBranch className="h-4 w-4 shrink-0" /><span>github.com/Leonlp9/Rechnungen</span><ExternalLink className="h-3 w-3 opacity-60 ml-auto" />
          </a>
          <a href="https://github.com/Leonlp9" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
            <GitBranch className="h-4 w-4 shrink-0" /><span>github.com/Leonlp9</span><ExternalLink className="h-3 w-3 opacity-60 ml-auto" />
          </a>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={async () => { setCheckingUpdate(true); await checkForUpdates(false); setCheckingUpdate(false); }} disabled={checkingUpdate}>
            <RefreshCw className={`mr-2 h-4 w-4 ${checkingUpdate ? 'animate-spin' : ''}`} />{checkingUpdate ? 'Suche...' : 'Nach Updates suchen'}
          </Button>
          <Button variant="outline" onClick={clearCache} disabled={clearingCache}>
            <Trash2 className={`mr-2 h-4 w-4 ${clearingCache ? 'animate-spin' : ''}`} />{clearingCache ? 'Leere...' : 'Cache leeren'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

