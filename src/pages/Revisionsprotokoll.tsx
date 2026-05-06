import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScrollText, Search, Filter, Download, ShieldCheck, ShieldAlert, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { getFullAuditLog, verifyAuditIntegrity } from '@/lib/db';
import type { AuditLogEntry } from '@/lib/db';
import { saveCsvFile } from '@/lib/utils';

const PAGE_SIZE = 100;

const ACTION_LABELS: Record<string, string> = {
  created: 'Erstellt',
  updated: 'Geändert',
  deleted: 'Gelöscht',
  restored: 'Wiederhergestellt',
  locked: 'Festgeschrieben',
  storno: 'Storniert',
};

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-green-500/10 text-green-700 dark:text-green-400',
  updated: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  deleted: 'bg-red-500/10 text-red-700 dark:text-red-400',
  locked: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  storno: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  restored: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
};

export default function RevisionsprotokollPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [integrityChecking, setIntegrityChecking] = useState(false);
  const [integrityStatus, setIntegrityStatus] = useState<'unknown' | 'ok' | 'broken'>('unknown');
  const [integrityBroken, setIntegrityBroken] = useState(0);
  const [integrityTotal, setIntegrityTotal] = useState(0);

  // Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination
  const [page, setPage] = useState(0);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const log = await getFullAuditLog(10000);
      setEntries(log);
    } catch (e) {
      toast.error('Fehler beim Laden: ' + String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleIntegrityCheck = async () => {
    setIntegrityChecking(true);
    try {
      const result = await verifyAuditIntegrity();
      setIntegrityStatus(result.ok ? 'ok' : 'broken');
      setIntegrityBroken(result.brokenEntries);
      setIntegrityTotal(result.total);
      if (result.ok) {
        toast.success(`✅ Audit-Trail integer – alle ${result.total} Einträge bestätigt`);
      } else {
        toast.error(`❌ ${result.brokenEntries} von ${result.total} Einträgen beschädigt`);
      }
    } catch (e) {
      toast.error('Integritätsprüfung fehlgeschlagen: ' + String(e));
    } finally {
      setIntegrityChecking(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const log = await getFullAuditLog(100000);
      if (log.length === 0) { toast.info('Kein Audit-Log vorhanden.'); return; }
      const header = 'ID;Beleg-ID;Aktion;Feld;Alter Wert;Neuer Wert;Zeitstempel;Notiz';
      const esc = (v: string | null) => v == null ? '' : '"' + v.replace(/"/g, '""') + '"';
      const rows = log.map((e) =>
        [e.id, e.invoice_id, e.action, e.field_name ?? '', esc(e.old_value), esc(e.new_value), e.timestamp, esc(e.user_note)].join(';')
      );
      const csv = '\uFEFF' + header + '\n' + rows.join('\n');
      await saveCsvFile(`audit-log-${new Date().toISOString().slice(0, 10)}.csv`, csv);
      toast.success('Audit-Log erfolgreich exportiert');
    } catch (e) {
      toast.error('Export fehlgeschlagen: ' + String(e));
    }
  };

  // Filtered entries
  const filtered = entries.filter((e) => {
    if (actionFilter !== 'all' && e.action !== actionFilter) return false;
    if (dateFrom && e.timestamp < dateFrom) return false;
    if (dateTo && e.timestamp > dateTo + 'T23:59:59') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !e.invoice_id.toLowerCase().includes(q) &&
        !e.action.toLowerCase().includes(q) &&
        !(e.field_name ?? '').toLowerCase().includes(q) &&
        !(e.old_value ?? '').toLowerCase().includes(q) &&
        !(e.new_value ?? '').toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filter changes
  useEffect(() => { setPage(0); }, [searchQuery, actionFilter, dateFrom, dateTo]);

  return (
    <div className="flex flex-col h-full gap-4 p-6 overflow-y-auto min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ScrollText className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Revisionsprotokoll</h1>
            <p className="text-sm text-muted-foreground">GoBD-konformes Audit-Log aller Buchungsänderungen</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadEntries} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="mr-2 h-4 w-4" />
            CSV-Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleIntegrityCheck}
            disabled={integrityChecking}
            className={integrityStatus === 'ok' ? 'border-green-400 text-green-600' : integrityStatus === 'broken' ? 'border-destructive text-destructive' : ''}
          >
            {integrityStatus === 'ok' ? (
              <ShieldCheck className="mr-2 h-4 w-4 text-green-500" />
            ) : integrityStatus === 'broken' ? (
              <ShieldAlert className="mr-2 h-4 w-4 text-destructive" />
            ) : (
              '🔒 '
            )}
            {integrityChecking ? 'Prüfe…' : integrityStatus === 'ok' ? 'Integer ✓' : integrityStatus === 'broken' ? `${integrityBroken} Fehler` : 'Integrität prüfen'}
          </Button>
        </div>
      </div>

      {/* Integritäts-Banner */}
      {integrityStatus === 'ok' && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-2.5 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          Alle {integrityTotal} Audit-Log-Einträge sind integer. SHA-256-Verkettung bestätigt – GoBD-konform.
        </div>
      )}
      {integrityStatus === 'broken' && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm text-destructive flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          {integrityBroken} von {integrityTotal} Einträgen beschädigt. Mögliche Hash-Fehler aus älteren Versionen. Details in Einstellungen → Daten.
        </div>
      )}

      {/* Filter-Zeile */}
      <Card className="rounded-xl shadow-sm">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px] space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Suche</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Beleg-ID, Feld, Wert…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-44 space-y-1">
              <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                <Filter className="h-3 w-3" />Aktion
              </label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Aktionen</SelectItem>
                  <SelectItem value="created">Erstellt</SelectItem>
                  <SelectItem value="updated">Geändert</SelectItem>
                  <SelectItem value="deleted">Gelöscht</SelectItem>
                  <SelectItem value="locked">Festgeschrieben</SelectItem>
                  <SelectItem value="storno">Storniert</SelectItem>
                  <SelectItem value="restored">Wiederhergestellt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Von Datum</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Bis Datum</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
            </div>
            {(searchQuery || actionFilter !== 'all' || dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(''); setActionFilter('all'); setDateFrom(''); setDateTo(''); }}>
                Filter zurücksetzen
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Zusammenfassung */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {loading ? 'Lade…' : `${filtered.length} Einträge`}
          {filtered.length !== entries.length && ` (gefiltert aus ${entries.length})`}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>Seite {page + 1} / {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Tabelle */}
      <Card className="rounded-xl shadow-sm">
        <CardHeader className="pb-0">
          <CardTitle className="text-base flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-primary" />
            Änderungshistorie
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              {entries.length === 0 ? 'Noch keine Audit-Log-Einträge vorhanden.' : 'Keine Einträge für den gewählten Filter.'}
            </p>
          ) : (
            <div className="overflow-auto max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[155px]">Zeitpunkt</TableHead>
                    <TableHead className="w-[110px]">Aktion</TableHead>
                    <TableHead className="w-[130px]">Beleg-ID</TableHead>
                    <TableHead className="w-[110px]">Feld</TableHead>
                    <TableHead className="w-[140px]">Alter Wert</TableHead>
                    <TableHead className="w-[140px]">Neuer Wert</TableHead>
                    <TableHead>Notiz</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((entry) => (
                    <TableRow key={entry.id} className="text-xs hover:bg-muted/30">
                      <TableCell className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleString('de-DE')}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${ACTION_COLORS[entry.action] ?? 'bg-muted text-muted-foreground'}`}>
                          {ACTION_LABELS[entry.action] ?? entry.action}
                        </span>
                      </TableCell>
                      <TableCell>
                        <button
                          className="font-mono text-[11px] text-primary hover:underline truncate max-w-[120px] block"
                          title={entry.invoice_id}
                          onClick={() => navigate(`/invoices/${entry.invoice_id}`)}
                        >
                          {entry.invoice_id.slice(0, 14)}…
                        </button>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{entry.field_name ?? '–'}</TableCell>
                      <TableCell className="max-w-[130px] truncate text-red-600/80 dark:text-red-400/80 font-mono text-[11px]" title={entry.old_value ?? ''}>
                        {entry.old_value ?? '–'}
                      </TableCell>
                      <TableCell className="max-w-[130px] truncate text-green-600/80 dark:text-green-400/80 font-mono text-[11px]" title={entry.new_value ?? ''}>
                        {entry.new_value ?? '–'}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[150px] truncate" title={entry.user_note ?? ''}>
                        {entry.user_note || '–'}
                      </TableCell>
                      <TableCell>
                        {entry.entry_hash ? (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono text-green-600 border-green-400/40" title={`Hash: ${entry.entry_hash}`}>
                            ✓ Hash
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 text-muted-foreground">
                            alt
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination (unten) */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pb-4">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4 mr-1" />Zurück
          </Button>
          <span className="text-sm text-muted-foreground">Seite {page + 1} von {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            Weiter<ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}



