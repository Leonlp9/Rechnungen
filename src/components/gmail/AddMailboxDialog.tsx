import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGmailStore } from '@/store/gmailStore';
import { startOAuthFlow, fetchUserEmail } from '@/lib/gmail';
import { imapFetchEmails } from '@/lib/imap';
import type { ImapConfig } from '@/store/gmailStore';
import { toast } from 'sonner';
import { Loader2, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Provider {
  id: string;
  name: string;
  logo: string; // emoji or letter
  imapHost?: string;
  imapPort?: number;
  smtpHost?: string;
  smtpPort?: number;
  isOAuth?: boolean;
}

const PROVIDERS: Provider[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    logo: 'G',
    isOAuth: true,
  },
  {
    id: 'outlook',
    name: 'Outlook / Hotmail',
    logo: '⊞',
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    smtpHost: 'smtp-mail.outlook.com',
    smtpPort: 587,
  },
  {
    id: 'icloud',
    name: 'iCloud Mail',
    logo: '☁',
    imapHost: 'imap.mail.me.com',
    imapPort: 993,
    smtpHost: 'smtp.mail.me.com',
    smtpPort: 587,
  },
  {
    id: 'yahoo',
    name: 'Yahoo Mail',
    logo: 'Y',
    imapHost: 'imap.mail.yahoo.com',
    imapPort: 993,
    smtpHost: 'smtp.mail.yahoo.com',
    smtpPort: 465,
  },
  {
    id: 'gmx',
    name: 'GMX',
    logo: 'GMX',
    imapHost: 'imap.gmx.net',
    imapPort: 993,
    smtpHost: 'mail.gmx.net',
    smtpPort: 465,
  },
  {
    id: 'webde',
    name: 'Web.de',
    logo: 'W',
    imapHost: 'imap.web.de',
    imapPort: 993,
    smtpHost: 'smtp.web.de',
    smtpPort: 587,
  },
  {
    id: 'custom',
    name: 'Eigener Server',
    logo: '⚙',
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AddMailboxDialog({ open, onClose }: Props) {
  const addOrUpdateAccount = useGmailStore((s) => s.addOrUpdateAccount);
  const [step, setStep] = useState<'provider' | 'imap'>('provider');
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(false);

  // IMAP form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState('993');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');

  const handleClose = () => {
    setStep('provider');
    setSelectedProvider(null);
    setEmail('');
    setPassword('');
    onClose();
  };

  const handleSelectProvider = (p: Provider) => {
    if (p.isOAuth) {
      handleGmailOAuth();
      return;
    }
    setSelectedProvider(p);
    setImapHost(p.imapHost ?? '');
    setImapPort(String(p.imapPort ?? 993));
    setSmtpHost(p.smtpHost ?? '');
    setSmtpPort(String(p.smtpPort ?? 587));
    setStep('imap');
  };

  const handleGmailOAuth = async () => {
    setLoading(true);
    try {
      const token = await startOAuthFlow();
      const emailAddr = await fetchUserEmail(token.access_token);
      addOrUpdateAccount({ type: 'gmail', email: emailAddr, token, emails: [], readEmailIds: [] });
      toast.success(`${emailAddr} hinzugefügt!`);
      handleClose();
    } catch (e: any) {
      toast.error('Anmeldung fehlgeschlagen: ' + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  };

  const handleImapConnect = async () => {
    if (!email.trim() || !password.trim() || !imapHost.trim()) {
      toast.error('Bitte alle Pflichtfelder ausfüllen.');
      return;
    }
    setLoading(true);
    try {
      const config: ImapConfig = {
        imapHost: imapHost.trim(),
        imapPort: parseInt(imapPort) || 993,
        smtpHost: smtpHost.trim(),
        smtpPort: parseInt(smtpPort) || 587,
        password: password.trim(),
      };
      // Test connection by fetching page 1
      await imapFetchEmails(config, email.trim(), 1);
      addOrUpdateAccount({
        type: 'imap',
        email: email.trim(),
        imapConfig: config,
        emails: [],
        readEmailIds: [],
      });
      toast.success(`${email.trim()} erfolgreich verbunden!`);
      handleClose();
    } catch (e: any) {
      toast.error('Verbindung fehlgeschlagen: ' + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {step === 'imap' && (
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setStep('provider')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle>
              {step === 'provider' ? 'Postfach hinzufügen' : `${selectedProvider?.name} verbinden`}
            </DialogTitle>
          </div>
        </DialogHeader>

        {step === 'provider' && (
          <div className="grid grid-cols-2 gap-2 pt-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                disabled={loading}
                onClick={() => handleSelectProvider(p)}
                className={cn(
                  'flex items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/60 disabled:opacity-50'
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-bold text-primary">
                  {p.logo}
                </div>
                <span className="text-sm font-medium leading-tight">{p.name}</span>
                {p.isOAuth && loading && <Loader2 className="h-3.5 w-3.5 animate-spin ml-auto" />}
              </button>
            ))}
          </div>
        )}

        {step === 'imap' && (
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <Label className="text-xs">E-Mail-Adresse *</Label>
              <Input
                placeholder="deine@email.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoComplete="email"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Passwort *</Label>
              <Input
                type="password"
                placeholder="App-Passwort oder Kontopasswort"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
              />
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">IMAP-Einstellungen</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Server</Label>
                  <Input
                    placeholder="imap.beispiel.de"
                    value={imapHost}
                    onChange={(e) => setImapHost(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Port</Label>
                  <Input
                    value={imapPort}
                    onChange={(e) => setImapPort(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">SMTP-Einstellungen</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Server</Label>
                  <Input
                    placeholder="smtp.beispiel.de"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Port</Label>
                  <Input
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Für Gmail, Yahoo etc. wird ein <strong>App-Passwort</strong> benötigt (2FA aktiviert).
            </p>

            <Button className="w-full" onClick={handleImapConnect} disabled={loading}>
              {loading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verbinde…</>
                : 'Verbinden & testen'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

