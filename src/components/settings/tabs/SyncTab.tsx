import { useEffect, useState } from 'react';
import {
  Cloud,
  FolderOpen,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Lock,
  HardDrive,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import {
  loadSyncConfig,
  saveSyncConfig,
  syncNow,
  testSyncConnection,
  startDriveOAuthFlow,
  syncSecrets,
  useSyncStatus,
  type SyncConfig,
  type SyncProviderKind,
} from '@/lib/sync';

export function SyncTab() {
  const [config, setConfig] = useState<SyncConfig | null>(null);
  const [webdavPassword, setWebdavPassword] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [driveConnected, setDriveConnected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const status = useSyncStatus();

  useEffect(() => {
    void loadSyncConfig().then(setConfig);
    void syncSecrets.getDriveToken().then((t) => setDriveConnected(t !== null));
  }, []);

  if (!config) return null;

  const update = (patch: Partial<SyncConfig>) => setConfig({ ...config, ...patch });

  const handleSave = async () => {
    setSaving(true);
    try {
      if (config.kind === 'webdav' && webdavPassword) {
        await syncSecrets.setWebdavPassword(webdavPassword);
      }
      if (config.encrypted && passphrase) {
        await syncSecrets.setPassphrase(passphrase);
      }
      if (config.encrypted && !passphrase) {
        const existing = await syncSecrets.getPassphrase();
        if (!existing) {
          toast.error('Bitte eine Passphrase für die Verschlüsselung festlegen.');
          setSaving(false);
          return;
        }
      }
      await saveSyncConfig(config);
      toast.success('Sync-Einstellungen gespeichert');
      if (config.kind !== 'none') void syncNow();
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      if (config.kind === 'webdav' && webdavPassword) {
        await syncSecrets.setWebdavPassword(webdavPassword);
      }
      if (config.encrypted && passphrase) {
        await syncSecrets.setPassphrase(passphrase);
      }
      await testSyncConnection(config);
      toast.success('Verbindung erfolgreich!');
    } catch (e) {
      toast.error(`Verbindung fehlgeschlagen: ${e instanceof Error ? e.message : e}`);
    } finally {
      setTesting(false);
    }
  };

  const handlePickFolder = async () => {
    const dir = await openDialog({ directory: true, title: 'Sync-Ordner wählen' });
    if (typeof dir === 'string') update({ localBase: dir });
  };

  const handleConnectDrive = async () => {
    try {
      const token = await startDriveOAuthFlow();
      await syncSecrets.setDriveToken(token);
      setDriveConnected(true);
      toast.success('Google Drive verbunden!');
    } catch (e) {
      toast.error(`Google-Anmeldung fehlgeschlagen: ${e instanceof Error ? e.message : e}`);
    }
  };

  return (
    <>
      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Cloud-Synchronisation</CardTitle>
            {status.lastSync && (
              <Badge variant="outline" className="ml-auto text-xs">
                Zuletzt: {new Date(status.lastSync).toLocaleString('de-DE')}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Synchronisiere alle Rechnungen, PDFs und Einstellungen zwischen deinen Geräten.
            Der Speicher gehört dir – es gibt keinen Klevr-Server. Es wird nie etwas
            überschrieben oder endgültig gelöscht: Änderungen sind nur-anfügend, gelöschte
            Dateien wandern in den Papierkorb-Ordner.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Speicherort</Label>
            <Select value={config.kind} onValueChange={(v) => update({ kind: v as SyncProviderKind })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Kein Sync (nur lokal)</SelectItem>
                <SelectItem value="local">Lokaler Ordner / Netzlaufwerk</SelectItem>
                <SelectItem value="webdav">WebDAV (Nextcloud, Hetzner, Strato …)</SelectItem>
                <SelectItem value="gdrive">Google Drive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.kind === 'local' && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5" /> Sync-Ordner
              </Label>
              <div className="flex gap-2">
                <Input
                  value={config.localBase ?? ''}
                  onChange={(e) => update({ localBase: e.target.value })}
                  placeholder="z. B. ein Netzlaufwerk oder Dropbox-/OneDrive-Ordner"
                />
                <Button variant="outline" onClick={handlePickFolder}>
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Tipp: Wähle einen Ordner, den ein Cloud-Client (Dropbox, OneDrive, Google
                Drive für Desktop) synchronisiert – dann läuft der Sync über diesen Anbieter.
              </p>
            </div>
          )}

          {config.kind === 'webdav' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" /> WebDAV-URL
                </Label>
                <Input
                  value={config.webdavUrl ?? ''}
                  onChange={(e) => update({ webdavUrl: e.target.value })}
                  placeholder="https://cloud.example.com/remote.php/dav/files/benutzer/KlevrSync"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Benutzername</Label>
                  <Input
                    value={config.webdavUser ?? ''}
                    onChange={(e) => update({ webdavUser: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Passwort / App-Passwort</Label>
                  <Input
                    type="password"
                    value={webdavPassword}
                    onChange={(e) => setWebdavPassword(e.target.value)}
                    placeholder="wird sicher gespeichert"
                  />
                </div>
              </div>
            </div>
          )}

          {config.kind === 'gdrive' && (
            <div className="space-y-2">
              {driveConnected ? (
                <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> Google Drive ist verbunden
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={handleConnectDrive}
                  >
                    Neu verbinden
                  </Button>
                </div>
              ) : (
                <Button variant="outline" onClick={handleConnectDrive}>
                  <Cloud className="mr-2 h-4 w-4" /> Mit Google Drive verbinden
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Die App sieht ausschließlich ihre eigenen Sync-Dateien (Ordner
                „KlevrSync“) – keine anderen Drive-Inhalte.
              </p>
            </div>
          )}

          {config.kind !== 'none' && (
            <>
              <div className="space-y-2 rounded-lg border p-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={config.encrypted}
                    onCheckedChange={(v) => update({ encrypted: v === true })}
                  />
                  <Lock className="h-3.5 w-3.5" />
                  Ende-zu-Ende-Verschlüsselung (empfohlen bei Cloud-Anbietern)
                </label>
                {config.encrypted && (
                  <div className="space-y-1">
                    <Input
                      type="password"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      placeholder="Passphrase (auf allen Geräten identisch)"
                    />
                    <p className="text-xs text-muted-foreground">
                      ⚠️ Ohne diese Passphrase sind die Sync-Daten unlesbar – gut aufbewahren!
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={config.autoSync}
                    onCheckedChange={(v) => update({ autoSync: v === true })}
                  />
                  Automatisch synchronisieren
                </label>
                {config.autoSync && (
                  <div className="flex items-center gap-2 text-sm">
                    alle
                    <Input
                      type="number"
                      min={2}
                      className="w-20"
                      value={config.intervalMin}
                      onChange={(e) => update({ intervalMin: Math.max(2, Number(e.target.value) || 10) })}
                    />
                    Minuten
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Speichere …' : 'Speichern'}
            </Button>
            {config.kind !== 'none' && (
              <>
                <Button variant="outline" onClick={handleTest} disabled={testing}>
                  {testing ? 'Teste …' : 'Verbindung testen'}
                </Button>
                <Button variant="outline" disabled={status.running} onClick={() => void syncNow()}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${status.running ? 'animate-spin' : ''}`} />
                  {status.running ? status.message || 'Synchronisiere …' : 'Jetzt synchronisieren'}
                </Button>
              </>
            )}
          </div>

          {status.lastError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {status.lastError}
            </div>
          )}
          {status.lastResult && status.lastResult.conflicts > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {status.lastResult.conflicts} Einträge konnten nicht automatisch zusammengeführt
              werden und wurden gesichert (nichts ist verloren gegangen).
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
