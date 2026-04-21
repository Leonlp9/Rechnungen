import { useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Activity, AlertTriangle, ClipboardList, Code2, Database,
  FlaskConical, HardDrive, MemoryStick, RefreshCw, RotateCcw,
  ScrollText, Server, Terminal, Trash2, Zap, Cpu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store';
import { getAllInvoices, deleteAllStornoInvoices, verifyAuditIntegrity } from '@/lib/db';
import { UpdateDialog, type UpdatePhase } from '@/components/UpdateDialog';

// PerformanceMark is a global Web API type (lib.dom.d.ts)

interface DevTabProps {
  version: string;
  activeTab: string;
  storeSnapshot: string | null;
  setStoreSnapshot: (v: string | null) => void;
  lsKeys: string[];
  setLsKeys: (v: string[]) => void;
  lsViewKey: string | null;
  setLsViewKey: (v: string | null) => void;
  lsViewVal: string | null;
  setLsViewVal: (v: string | null) => void;
  dbStats: Record<string, number> | null;
  setDbStats: (v: Record<string, number> | null) => void;
  dbStatsLoading: boolean;
  setDbStatsLoading: (v: boolean) => void;
  envInfo: Record<string, string> | null;
  setEnvInfo: (v: Record<string, string> | null) => void;
  perfMarks: PerformanceMark[];
  setPerfMarks: (v: PerformanceMark[]) => void;
  setPendingThrow: (e: Error) => void;
  previewOpen: boolean;
  setPreviewOpen: (v: boolean) => void;
  previewPhase: UpdatePhase;
  setPreviewPhase: (v: UpdatePhase) => void;
  previewProgress: number;
  setPreviewProgress: (v: number) => void;
}

export function DevTab({
  version, activeTab,
  storeSnapshot, setStoreSnapshot,
  lsKeys, setLsKeys, lsViewKey, setLsViewKey, lsViewVal, setLsViewVal,
  dbStats, setDbStats, dbStatsLoading, setDbStatsLoading,
  envInfo, setEnvInfo, perfMarks, setPerfMarks,
  setPendingThrow,
  previewOpen, setPreviewOpen, previewPhase, setPreviewPhase, previewProgress, setPreviewProgress,
}: DevTabProps) {
  const theme = useAppStore((s) => s.theme);
  const darkMode = useAppStore((s) => s.darkMode);
  const animations = useAppStore((s) => s.animations);
  const steuerregelung = useAppStore((s) => s.steuerregelung);
  const rechtsform = useAppStore((s) => s.rechtsform);
  const branchenprofil = useAppStore((s) => s.branchenprofil);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPreview = (phase: UpdatePhase) => {
    setPreviewPhase(phase);
    setPreviewProgress(0);
    setPreviewOpen(true);
    if (phase === 'downloading') {
      if (progressRef.current) clearInterval(progressRef.current);
      progressRef.current = setInterval(() => {
        setPreviewProgress(0); // placeholder – real impl uses state in parent
      }, 80);
    }
  };

  const closePreview = () => {
    setPreviewOpen(false);
    if (progressRef.current) clearInterval(progressRef.current);
  };

  const captureStoreSnapshot = () => {
    try {
      const state = useAppStore.getState();
      const snap = JSON.stringify(state, (_k, v) => typeof v === 'function' ? '[Function]' : v, 2);
      setStoreSnapshot(snap);
    } catch (e) { toast.error('Fehler: ' + String(e)); }
  };

  const loadDbStats = async () => {
    setDbStatsLoading(true);
    try {
      const invoices = await getAllInvoices();
      const { getFullAuditLog } = await import('@/lib/db');
      const auditEntries = await getFullAuditLog(999999);
      setDbStats({
        'Belege gesamt': invoices.length,
        'Einnahmen': invoices.filter((i) => i.type === 'einnahme').length,
        'Ausgaben': invoices.filter((i) => i.type === 'ausgabe').length,
        'Info-Einträge': invoices.filter((i) => i.type === 'info').length,
        'Audit-Log Einträge': auditEntries.length,
      });
    } catch (e) { toast.error('Fehler: ' + String(e)); } finally { setDbStatsLoading(false); }
  };

  const captureEnvInfo = () => {
    setEnvInfo({
      'import.meta.env.MODE': import.meta.env.MODE,
      'import.meta.env.DEV': String(import.meta.env.DEV),
      'import.meta.env.PROD': String(import.meta.env.PROD),
      'navigator.userAgent': navigator.userAgent,
      'navigator.language': navigator.language,
      'window.innerWidth': String(window.innerWidth),
      'window.innerHeight': String(window.innerHeight),
      'devicePixelRatio': String(window.devicePixelRatio),
      'Date.now()': new Date().toISOString(),
    });
  };

  const capturePerfMarks = () => {
    const marks = performance.getEntriesByType('mark') as PerformanceMark[];
    setPerfMarks(marks);
    if (marks.length === 0) toast.info('Keine Performance-Marks vorhanden.');
  };

  const loadLsKeys = () => {
    setLsKeys(Object.keys(localStorage).sort());
    setLsViewKey(null); setLsViewVal(null);
  };

  const viewLsKey = (key: string) => {
    setLsViewKey(key);
    const raw = localStorage.getItem(key);
    try { setLsViewVal(JSON.stringify(JSON.parse(raw ?? ''), null, 2)); }
    catch { setLsViewVal(raw); }
  };

  const triggerToast = (type: 'success' | 'error' | 'info' | 'warning') => {
    const msgs = { success: '✅ Test-Success-Toast!', error: '❌ Test-Error-Toast!', info: 'ℹ️ Test-Info-Toast!', warning: '⚠️ Test-Warning-Toast!' };
    toast[type](msgs[type]);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => toast.success('In Zwischenablage kopiert!'))
      .catch(() => toast.error('Kopieren fehlgeschlagen'));
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border-2 border-yellow-400/50 bg-yellow-500/5 px-4 py-3 flex items-center gap-3">
        <FlaskConical className="h-6 w-6 text-yellow-500 shrink-0" />
        <div>
          <p className="text-sm font-bold text-yellow-600 dark:text-yellow-400">Dev Debug Panel</p>
          <p className="text-xs text-yellow-600/70 dark:text-yellow-500/70">Nur im Dev-Build sichtbar. Nicht für Endnutzer bestimmt.</p>
        </div>
      </div>

      {/* Toast Tester */}
      <Card className="rounded-xl border-yellow-400/30">
        <CardHeader><div className="flex items-center gap-2"><Zap className="h-4 w-4 text-yellow-500" /><CardTitle className="text-sm text-yellow-600 dark:text-yellow-400">Toast-Tester</CardTitle></div></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="border-green-500/40 text-green-600" onClick={() => triggerToast('success')}>✅ Success</Button>
          <Button size="sm" variant="outline" className="border-red-500/40 text-red-600" onClick={() => triggerToast('error')}>❌ Error</Button>
          <Button size="sm" variant="outline" className="border-blue-500/40 text-blue-600" onClick={() => triggerToast('info')}>ℹ️ Info</Button>
          <Button size="sm" variant="outline" className="border-yellow-500/40 text-yellow-600" onClick={() => triggerToast('warning')}>⚠️ Warning</Button>
        </CardContent>
      </Card>

      {/* UpdateDialog Preview */}
      <Card className="rounded-xl border-yellow-400/30">
        <CardHeader><div className="flex items-center gap-2"><RefreshCw className="h-4 w-4 text-yellow-500" /><CardTitle className="text-sm text-yellow-600 dark:text-yellow-400">UpdateDialog Vorschau</CardTitle></div></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => startPreview('confirm')}>Phase: confirm</Button>
          <Button variant="outline" size="sm" onClick={() => startPreview('downloading')}>Phase: downloading (animiert)</Button>
          <Button variant="outline" size="sm" onClick={() => startPreview('done')}>Phase: done</Button>
        </CardContent>
      </Card>

      {/* DB-Aktionen */}
      <Card className="rounded-xl border-yellow-400/30">
        <CardHeader><div className="flex items-center gap-2"><Database className="h-4 w-4 text-yellow-500" /><CardTitle className="text-sm text-yellow-600 dark:text-yellow-400">Datenbank-Aktionen & Statistiken</CardTitle></div></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" size="sm" onClick={async () => {
              const count = await deleteAllStornoInvoices();
              const all = await getAllInvoices();
              useAppStore.getState().setInvoices(all);
              toast.success(`${count} Stornobuchung(en) gelöscht & Originalbelege entsperrt`);
            }}>
              <Trash2 className="mr-1 h-3 w-3" /> Alle Test-Stornos löschen
            </Button>
            <Button variant="outline" size="sm" onClick={loadDbStats} disabled={dbStatsLoading}>
              <Activity className="mr-1 h-3 w-3" /> {dbStatsLoading ? 'Lädt…' : 'DB-Statistiken laden'}
            </Button>
            <Button variant="outline" size="sm" onClick={async () => {
              const result = await verifyAuditIntegrity();
              if (result.ok) {
                toast.success(`Audit-Log integer: ${result.total} Einträge verifiziert ✓`);
              } else {
                toast.error(`${result.brokenEntries} von ${result.total} Audit-Einträgen sind beschädigt!`);
              }
            }}>
              <ScrollText className="mr-1 h-3 w-3" /> Audit-Integrität prüfen
            </Button>
          </div>
          {dbStats && (
            <div className="rounded-lg bg-muted/50 border p-3 grid grid-cols-2 gap-2">
              {Object.entries(dbStats).map(([k, v]) => (
                <div key={k} className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{k}</span>
                  <span className="text-xs font-mono font-bold">{v}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Store Inspector */}
      <Card className="rounded-xl border-yellow-400/30">
        <CardHeader><div className="flex items-center gap-2"><Server className="h-4 w-4 text-yellow-500" /><CardTitle className="text-sm text-yellow-600 dark:text-yellow-400">Zustand Store Inspector</CardTitle></div></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={captureStoreSnapshot}><ClipboardList className="mr-1 h-3 w-3" /> Store-Snapshot</Button>
            {storeSnapshot && <Button variant="outline" size="sm" onClick={() => copyToClipboard(storeSnapshot)}>Kopieren</Button>}
            {storeSnapshot && <Button variant="outline" size="sm" onClick={() => setStoreSnapshot(null)}>Schließen</Button>}
          </div>
          {storeSnapshot && (
            <pre className="rounded-lg bg-muted/50 border p-3 text-[10px] font-mono overflow-auto max-h-64 leading-relaxed">{storeSnapshot}</pre>
          )}
        </CardContent>
      </Card>

      {/* LocalStorage Inspector */}
      <Card className="rounded-xl border-yellow-400/30">
        <CardHeader><div className="flex items-center gap-2"><HardDrive className="h-4 w-4 text-yellow-500" /><CardTitle className="text-sm text-yellow-600 dark:text-yellow-400">LocalStorage Inspector</CardTitle></div></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadLsKeys}>
              <HardDrive className="mr-1 h-3 w-3" /> Keys laden ({Object.keys(localStorage).length})
            </Button>
            {lsKeys.length > 0 && <Button variant="outline" size="sm" onClick={() => { setLsKeys([]); setLsViewKey(null); setLsViewVal(null); }}>Schließen</Button>}
          </div>
          {lsKeys.length > 0 && (
            <div className="rounded-lg border bg-muted/30 divide-y max-h-48 overflow-y-auto">
              {lsKeys.map((k) => (
                <button key={k} type="button" onClick={() => viewLsKey(k)}
                  className={cn('w-full px-3 py-1.5 text-left text-xs font-mono hover:bg-muted transition-colors', lsViewKey === k && 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400')}>
                  {k}
                </button>
              ))}
            </div>
          )}
          {lsViewKey && lsViewVal && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-mono font-bold text-yellow-600 dark:text-yellow-400">{lsViewKey}</p>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => copyToClipboard(lsViewVal)}>Kopieren</Button>
              </div>
              <pre className="rounded-lg bg-muted/50 border p-3 text-[10px] font-mono overflow-auto max-h-48 leading-relaxed">{lsViewVal}</pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Env Info */}
      <Card className="rounded-xl border-yellow-400/30">
        <CardHeader><div className="flex items-center gap-2"><Cpu className="h-4 w-4 text-yellow-500" /><CardTitle className="text-sm text-yellow-600 dark:text-yellow-400">Umgebungsinformationen</CardTitle></div></CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" size="sm" onClick={captureEnvInfo}><Terminal className="mr-1 h-3 w-3" /> Env-Info laden</Button>
          {envInfo && (
            <div className="rounded-lg bg-muted/50 border divide-y overflow-hidden">
              {Object.entries(envInfo).map(([k, v]) => (
                <div key={k} className="flex gap-3 px-3 py-1.5">
                  <span className="text-[11px] font-mono text-muted-foreground shrink-0 w-44 truncate">{k}</span>
                  <span className="text-[11px] font-mono font-medium break-all">{v}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance */}
      <Card className="rounded-xl border-yellow-400/30">
        <CardHeader><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-yellow-500" /><CardTitle className="text-sm text-yellow-600 dark:text-yellow-400">Performance Marks</CardTitle></div></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={capturePerfMarks}><Activity className="mr-1 h-3 w-3" /> Marks erfassen</Button>
            <Button variant="outline" size="sm" onClick={() => { performance.clearMarks(); setPerfMarks([]); toast.info('Performance Marks geleert'); }}>Marks löschen</Button>
          </div>
          {perfMarks.length > 0 && (
            <div className="rounded-lg bg-muted/50 border divide-y max-h-40 overflow-auto">
              {perfMarks.map((m, i) => (
                <div key={i} className="flex justify-between px-3 py-1.5">
                  <span className="text-[11px] font-mono">{m.name}</span>
                  <span className="text-[11px] font-mono text-muted-foreground">{m.startTime.toFixed(2)} ms</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Memory & Quick Actions */}
      <Card className="rounded-xl border-yellow-400/30">
        <CardHeader><div className="flex items-center gap-2"><MemoryStick className="h-4 w-4 text-yellow-500" /><CardTitle className="text-sm text-yellow-600 dark:text-yellow-400">Browser Memory & Schnellaktionen</CardTitle></div></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              // @ts-expect-error non-standard chromium API
              const mem = performance.memory;
              if (mem) toast.info(`JS Heap: ${(mem.usedJSHeapSize / 1048576).toFixed(1)} MB / ${(mem.jsHeapSizeLimit / 1048576).toFixed(1)} MB`);
              else toast.info('Memory API nicht verfügbar (nur in Chromium)');
            }}><MemoryStick className="mr-1 h-3 w-3" /> Heap-Größe anzeigen</Button>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}><RotateCcw className="mr-1 h-3 w-3" /> App neu laden</Button>
            <Button variant="outline" size="sm" onClick={() => {
              const info = { version, url: window.location.href, timestamp: new Date().toISOString() };
              navigator.clipboard.writeText(JSON.stringify(info, null, 2))
                .then(() => toast.success('In Zwischenablage kopiert!'))
                .catch(() => toast.error('Kopieren fehlgeschlagen'));
            }}><Code2 className="mr-1 h-3 w-3" /> App-Info kopieren</Button>
            <Button variant="outline" size="sm" onClick={() => {
              toast.info(`${Object.keys(localStorage).length} LocalStorage-Keys · ${document.cookie ? 'Cookies vorhanden' : 'Keine Cookies'}`);
            }}><Database className="mr-1 h-3 w-3" /> Storage-Überblick</Button>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            {([
              ['Aktiver Tab', activeTab],
              ['Theme', theme],
              ['Dark Mode', darkMode ? 'ja' : 'nein'],
              ['Animationen', animations ? 'an' : 'aus'],
              ['Steuerregelung', steuerregelung],
              ['Rechtsform', rechtsform],
              ['Branchenprofil', branchenprofil],
              ['App-Version', version || '…'],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className="rounded-lg bg-muted/50 border px-3 py-2 flex justify-between items-center">
                <span className="text-[11px] text-muted-foreground">{label}</span>
                <span className="text-[11px] font-mono font-bold">{value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Error Boundary Tester */}
      <Card className="rounded-xl border-yellow-400/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <CardTitle className="text-sm text-yellow-600 dark:text-yellow-400">Error Boundary Tester</CardTitle>
          </div>
          <p className="text-xs text-yellow-600/60 dark:text-yellow-500/60 mt-1">
            Fehler werden im <strong>Render</strong> geworfen (nicht im Event-Handler) – so fängt die <code className="font-mono">AppErrorBoundary</code> sie korrekt ab.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="border-yellow-400/50 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10"
            onClick={() => setPendingThrow(new Error('Test-Fehler: Normaler Error aus Settings'))}>
            🔥 Normalen Error
          </Button>
          <Button variant="outline" size="sm" className="border-yellow-400/50 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10"
            onClick={() => setPendingThrow(new TypeError("Test-Fehler: TypeError – Cannot read properties of undefined (reading 'foo')"))}>
            🔥 TypeError
          </Button>
          <Button variant="outline" size="sm" className="border-yellow-400/50 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10"
            onClick={() => {
              const e = new Error('Test-Fehler: Simulierter Hooks-Fehler\n\nRendered fewer hooks than expected.');
              e.stack = e.message + '\n    at finishRenderingHooks\n    at renderWithHooks\n    at updateFunctionComponent\n    at beginWork';
              setPendingThrow(e);
            }}>
            🔥 Hooks-Fehler
          </Button>
          <Button variant="outline" size="sm" className="border-yellow-400/50 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10"
            onClick={() => setPendingThrow(new RangeError('Test-Fehler: Maximum call stack size exceeded'))}>
            🔥 RangeError
          </Button>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="rounded-xl border-red-400/30 bg-red-500/5">
        <CardHeader>
          <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" /><CardTitle className="text-sm text-red-600 dark:text-red-400">Danger Zone</CardTitle></div>
          <p className="text-xs text-red-500/70 mt-1">Nur für Testing – diese Aktionen können Datenverlust verursachen!</p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="destructive" size="sm" onClick={() => { localStorage.clear(); toast.success('LocalStorage geleert – App-Reload empfohlen!'); }}>
            <Trash2 className="mr-1 h-3 w-3" /> LocalStorage leeren
          </Button>
          <Button variant="destructive" size="sm" onClick={async () => {
            try {
              const deleted = await invoke<number>('cleanup_old_invoice_files', { days: 0 });
              toast.success(`${deleted} Invoice-Dateien gelöscht`);
            } catch (e) { toast.error(String(e)); }
          }}>
            <HardDrive className="mr-1 h-3 w-3" /> Alle Invoice-Dateien löschen
          </Button>
        </CardContent>
      </Card>

      {previewOpen && (
        <UpdateDialog
          version="1.2.3"
          releaseNotes={"• Neue Funktion A\n• Bugfix B\n• Performance verbessert"}
          phase={previewPhase}
          progress={previewProgress}
          onConfirm={() => startPreview('downloading')}
          onCancel={closePreview}
        />
      )}
    </div>
  );
}



