import { useState } from 'react';
import { DatabaseBackup, Download, FileDown, ScrollText, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { exportBackup, importBackup } from '@/lib/backup';
import { getFullAuditLog, verifyAuditIntegrity } from '@/lib/db';
import type { AuditLogEntry, AuditIntegrityBrokenEntry } from '@/lib/db';
import { VerfahrensdokuButton } from '@/components/settings/VerfahrensdokuButton';
import { saveCsvFile } from '@/lib/utils';

interface DatenTabProps {
  exportingBackup: boolean;
  setExportingBackup: (v: boolean) => void;
  importingBackup: boolean;
  setImportingBackup: (v: boolean) => void;
  auditLog: AuditLogEntry[];
  setAuditLog: (v: AuditLogEntry[]) => void;
  auditOpen: boolean;
  setAuditOpen: (v: boolean) => void;
  auditLoading: boolean;
  setAuditLoading: (v: boolean) => void;
}

export function DatenTab({
  exportingBackup, setExportingBackup,
  importingBackup, setImportingBackup,
  auditLog, setAuditLog,
  auditOpen, setAuditOpen,
  auditLoading, setAuditLoading,
}: DatenTabProps) {
  const [integrityLoading, setIntegrityLoading] = useState(false);
  const [integrityResult, setIntegrityResult] = useState<{
    ok: boolean; brokenEntries: number; total: number;
    details: AuditIntegrityBrokenEntry[];
  } | null>(null);
  const [integrityOpen, setIntegrityOpen] = useState(false);

  const handleCheckIntegrity = async () => {
    setIntegrityLoading(true);
    try {
      const result = await verifyAuditIntegrity();
      setIntegrityResult(result);
      setIntegrityOpen(true);
      if (result.ok) {
        toast.success(`✅ Audit-Trail integer – alle ${result.total} Einträge bestätigt`);
      } else {
        toast.error(`❌ ${result.brokenEntries} von ${result.total} Einträgen beschädigt`);
      }
    } catch (e) {
      toast.error('Prüfung fehlgeschlagen: ' + String(e));
    } finally {
      setIntegrityLoading(false);
    }
  };

  return (
    <>
      <Card className="rounded-xl shadow-sm" data-tutorial="settings-backup">
        <CardHeader>
          <div className="flex items-center gap-2">
            <DatabaseBackup className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Backup & Wiederherstellen</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Erstelle ein vollständiges Backup aller Rechnungen, PDFs und Einstellungen als <code className="font-mono">.rmbackup</code>-Datei (umbenanntes ZIP).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button className="flex-1" onClick={async () => {
              setExportingBackup(true);
              try {
                const result = await exportBackup();
                if (result.success) toast.success('Backup erfolgreich gespeichert!');
                else if (result.error) toast.error('Backup fehlgeschlagen: ' + result.error);
              } finally { setTimeout(() => setExportingBackup(false), 800); }
            }} disabled={exportingBackup}>
              <Download className="mr-2 h-4 w-4" />{exportingBackup ? 'Exportiere…' : 'Backup erstellen & exportieren'}
            </Button>
            <Button variant="outline" className="flex-1" onClick={async () => {
              setImportingBackup(true);
              try {
                const result = await importBackup();
                if (result.success) { toast.success('Backup erfolgreich eingespielt! Die App wird neu geladen…'); setTimeout(() => window.location.reload(), 1500); }
                else if (result.error) toast.error('Import fehlgeschlagen: ' + result.error);
              } finally { setImportingBackup(false); }
            }} disabled={importingBackup}>
              <Upload className="mr-2 h-4 w-4" />{importingBackup ? 'Importiere…' : 'Backup wiederherstellen'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            ⚠️ Beim Wiederherstellen werden alle aktuellen Daten überschrieben. Die <code className="font-mono">.rmbackup</code>-Datei ist ein ZIP-Archiv.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3">
          <ScrollText className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">GoBD Audit-Trail (Änderungshistorie)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Jede Erstellung, Änderung und Löschung eines Belegs wird unveränderlich protokolliert (GoBD-konform).
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={async () => {
              setAuditLoading(true);
              try { const log = await getFullAuditLog(500); setAuditLog(log); setAuditOpen(true); }
              catch (e) { toast.error('Fehler beim Laden: ' + String(e)); }
              finally { setAuditLoading(false); }
            }} disabled={auditLoading}>
              <ScrollText className="mr-2 h-4 w-4" />{auditLoading ? 'Lade…' : 'Audit-Log anzeigen'}
            </Button>
            <Button variant="outline" onClick={async () => {
              try {
                const log = await getFullAuditLog(10000);
                if (log.length === 0) { toast.info('Kein Audit-Log vorhanden.'); return; }
                const header = 'ID;Beleg-ID;Aktion;Feld;Alter Wert;Neuer Wert;Zeitstempel;Notiz';
                const esc = (v: string | null) => v == null ? '' : '"' + v.replace(/"/g, '""') + '"';
                const rows = log.map((e) => [e.id, e.invoice_id, e.action, e.field_name ?? '', esc(e.old_value), esc(e.new_value), e.timestamp, esc(e.user_note)].join(';'));
                const csv = '\uFEFF' + header + '\n' + rows.join('\n');
                await saveCsvFile(`audit-log-${new Date().toISOString().slice(0, 10)}.csv`, csv);
              } catch (e) { toast.error('Export fehlgeschlagen: ' + String(e)); }
            }}>
              <FileDown className="mr-2 h-4 w-4" />Als CSV exportieren
            </Button>
            <Button variant="outline" onClick={handleCheckIntegrity} disabled={integrityLoading}>
              🔒 {integrityLoading ? 'Prüfe…' : 'Integrität prüfen'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Verfahrensdokumentation & Compliance</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Generiere auf Knopfdruck eine GoBD-konforme Verfahrensdokumentation als PDF.
          </p>
        </CardHeader>
        <CardContent>
          <VerfahrensdokuButton />
        </CardContent>
      </Card>

      {/* Audit-Log Dialog */}
      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-primary" />
              Audit-Log – Änderungshistorie ({auditLog.length} Einträge)
            </DialogTitle>
          </DialogHeader>
          {auditLog.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Noch keine Einträge vorhanden.</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Zeitpunkt</TableHead>
                    <TableHead className="w-[80px]">Aktion</TableHead>
                    <TableHead>Beleg-ID</TableHead>
                    <TableHead>Feld</TableHead>
                    <TableHead>Alter Wert</TableHead>
                    <TableHead>Neuer Wert</TableHead>
                    <TableHead>Notiz</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLog.map((entry) => (
                    <TableRow key={entry.id} className="text-xs">
                      <TableCell className="font-mono text-[10px]">{new Date(entry.timestamp).toLocaleString('de-DE')}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${entry.action === 'created' ? 'bg-green-500/10 text-green-700 dark:text-green-400' : entry.action === 'deleted' ? 'bg-red-500/10 text-red-700 dark:text-red-400' : entry.action === 'updated' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400' : 'bg-muted text-muted-foreground'}`}>
                          {entry.action === 'created' ? 'Erstellt' : entry.action === 'deleted' ? 'Gelöscht' : entry.action === 'updated' ? 'Geändert' : entry.action === 'restored' ? 'Wiederhergestellt' : entry.action}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-[10px] max-w-[100px] truncate" title={entry.invoice_id}>{entry.invoice_id.slice(0, 12)}…</TableCell>
                      <TableCell className="text-muted-foreground">{entry.field_name ?? '–'}</TableCell>
                      <TableCell className="max-w-[120px] truncate text-red-600/70" title={entry.old_value ?? ''}>{entry.old_value ?? '–'}</TableCell>
                      <TableCell className="max-w-[120px] truncate text-green-600/70" title={entry.new_value ?? ''}>{entry.new_value ?? '–'}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[100px] truncate" title={entry.user_note ?? ''}>{entry.user_note || '–'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Integritäts-Ergebnis Dialog */}
      <Dialog open={integrityOpen} onOpenChange={setIntegrityOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {integrityResult?.ok
                ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                : <AlertTriangle className="h-5 w-5 text-destructive" />}
              Audit-Trail Integritätsprüfung
            </DialogTitle>
          </DialogHeader>

          {integrityResult && (
            <div className="space-y-4">
              {/* Summary */}
              <div className={`rounded-lg border p-4 ${integrityResult.ok ? 'border-green-500/30 bg-green-500/5' : 'border-destructive/30 bg-destructive/5'}`}>
                <div className="flex items-center gap-3">
                  {integrityResult.ok
                    ? <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" />
                    : <AlertTriangle className="h-6 w-6 text-destructive shrink-0" />}
                  <div>
                    <p className="font-semibold text-sm">
                      {integrityResult.ok
                        ? `Alle ${integrityResult.total} Einträge integer`
                        : `${integrityResult.brokenEntries} von ${integrityResult.total} Einträgen beschädigt`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {integrityResult.ok
                        ? 'Das Audit-Log wurde nicht manipuliert. GoBD-Konformität bestätigt.'
                        : 'Diese Einträge wurden möglicherweise geändert oder stammen aus einer früheren Software-Version mit anderem Hash-Format.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Erklärung bei Fehlern */}
              {!integrityResult.ok && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  <p className="font-semibold">ℹ️ Warum passiert das?</p>
                  <p>Hash-Fehler (<code>hash_mismatch</code>) entstehen oft durch ein früheres Software-Problem: Der Zeitstempel im Hash wurde im JS-Format berechnet, aber in der Datenbank im SQLite-Format gespeichert – diese Formate stimmen nicht überein. Dieser Fehler wurde in der aktuellen Version behoben; neue Einträge sind korrekt.</p>
                  <p>Kettenbrüche (<code>chain_break</code>) deuten auf eine Unterbrechung der Verkettung hin, z.B. durch manuelle DB-Änderungen.</p>
                </div>
              )}

              {/* Detail-Tabelle */}
              {!integrityResult.ok && integrityResult.details.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Betroffene Einträge ({integrityResult.details.length}):</p>
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">ID</TableHead>
                          <TableHead>Zeitpunkt</TableHead>
                          <TableHead>Beleg-ID</TableHead>
                          <TableHead>Aktion</TableHead>
                          <TableHead>Feld</TableHead>
                          <TableHead>Fehlerart</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {integrityResult.details.map((entry) => (
                          <TableRow key={entry.id} className="text-xs">
                            <TableCell className="font-mono text-muted-foreground">{entry.id}</TableCell>
                            <TableCell className="font-mono text-[10px]">
                              {new Date(entry.timestamp).toLocaleString('de-DE')}
                            </TableCell>
                            <TableCell className="font-mono text-[10px] max-w-[120px] truncate" title={entry.invoice_id}>
                              {entry.invoice_id.slice(0, 14)}…
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${entry.action === 'created' ? 'bg-green-500/10 text-green-700 dark:text-green-400' : entry.action === 'deleted' ? 'bg-red-500/10 text-red-700 dark:text-red-400' : 'bg-blue-500/10 text-blue-700 dark:text-blue-400'}`}>
                                {entry.action}
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{entry.field_name ?? '–'}</TableCell>
                            <TableCell>
                              <Badge variant={entry.reason === 'chain_break' ? 'destructive' : 'secondary'} className="text-[10px]">
                                {entry.reason === 'hash_mismatch' ? 'Hash-Fehler' : 'Kettenbruch'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

