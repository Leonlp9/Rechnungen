import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: ['Ctrl', 'K'], label: 'Globale Suche öffnen' },
  { keys: ['g', 'd'], label: 'Dashboard' },
  { keys: ['g', 'r'], label: 'Alle Rechnungen' },
  { keys: ['g', 'n'], label: 'Neue Rechnung erstellen' },
  { keys: ['g', 's'], label: 'Einstellungen' },
  { keys: ['g', 'k'], label: 'Kunden' },
  { keys: ['g', 'f'], label: 'Fahrtenbuch' },
  { keys: ['g', 't'], label: 'Steuerbericht' },
  { keys: ['g', 'm'], label: 'Mail (Gmail)' },
  { keys: ['g', 'b'], label: 'Bankimport' },
  { keys: ['←', '→'], label: 'Vorherige / nächste Rechnung (in Detailansicht)' },
  { keys: ['?'], label: 'Diese Übersicht anzeigen' },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground shadow-sm min-w-[24px]">
      {children}
    </kbd>
  );
}

export function ShortcutsModal({ open, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard-Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="divide-y divide-border">
          {SHORTCUTS.map(({ keys, label }) => (
            <div key={label} className="flex items-center justify-between py-2.5 gap-3">
              <span className="text-sm text-muted-foreground">{label}</span>
              <div className="flex items-center gap-1 shrink-0">
                {keys.map((k, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <Kbd>{k}</Kbd>
                    {i < keys.length - 1 && <span className="text-xs text-muted-foreground">then</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
