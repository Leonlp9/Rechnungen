import { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { HardDrive, Cpu, MemoryStick, RefreshCw, Database, FolderOpen, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SystemStats {
  db_size_bytes: number;
  invoices_size_bytes: number;
  pdfs_size_bytes: number;
  total_app_size_bytes: number;
  invoices_file_count: number;
  pdfs_file_count: number;
  process_memory_bytes: number;
  system_memory_total_bytes: number;
  system_memory_free_bytes: number;
  cpu_usage_percent: number;
}

function fmtBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function UsageBar({ value, max, colorClass }: { value: number; max: number; colorClass: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all', colorClass)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function StatRow({
  icon, label, value, sub, bar,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  bar?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
          {icon}
          <span className="truncate">{label}</span>
        </div>
        <div className="text-right flex-shrink-0">
          <span className="text-xs font-medium tabular-nums">{value}</span>
          {sub && <span className="text-[10px] text-muted-foreground ml-1">{sub}</span>}
        </div>
      </div>
      {bar}
    </div>
  );
}

export function SystemStatsCard({ loading: parentLoading }: { loading: boolean }) {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const s = await invoke<SystemStats>('get_system_stats');
      setStats(s);
    } catch (e) {
      setError(String(e));
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (!parentLoading) load();
  }, [parentLoading, load]);

  const ramUsed = stats ? stats.system_memory_total_bytes - stats.system_memory_free_bytes : 0;
  const ramPct = stats && stats.system_memory_total_bytes > 0
    ? Math.round((ramUsed / stats.system_memory_total_bytes) * 100)
    : 0;
  const cpuPct = stats ? Math.round(stats.cpu_usage_percent) : 0;

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">System & Speicher</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={load}
          disabled={fetching}
          title="Aktualisieren"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', fetching && 'animate-spin')} />
        </Button>
      </div>

      {parentLoading || (fetching && !stats) ? (
        <div className="space-y-3 flex-1">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
      ) : error ? (
        <p className="text-xs text-destructive flex-1">{error}</p>
      ) : stats ? (
        <div className="flex-1 space-y-4">
          {/* Speicherplatz */}
          <div className="space-y-2.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Speicherplatz</p>
            <StatRow
              icon={<Database className="h-3.5 w-3.5" />}
              label="Datenbank"
              value={fmtBytes(stats.db_size_bytes)}
            />
            <StatRow
              icon={<FolderOpen className="h-3.5 w-3.5" />}
              label="Rechnungen / PDFs"
              value={fmtBytes(stats.invoices_size_bytes)}
              sub={`${stats.invoices_file_count} Dateien`}
            />
            <StatRow
              icon={<FileText className="h-3.5 w-3.5" />}
              label="PDF-Archiv"
              value={fmtBytes(stats.pdfs_size_bytes)}
              sub={`${stats.pdfs_file_count} Dateien`}
            />
            <div className="pt-1 border-t">
              <StatRow
                icon={<HardDrive className="h-3.5 w-3.5 text-primary" />}
                label="Gesamt App-Daten"
                value={fmtBytes(stats.total_app_size_bytes)}
              />
            </div>
          </div>

          {/* RAM */}
          <div className="space-y-2.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Arbeitsspeicher</p>
            <StatRow
              icon={<MemoryStick className="h-3.5 w-3.5" />}
              label="RAM genutzt"
              value={`${fmtBytes(ramUsed)} / ${fmtBytes(stats.system_memory_total_bytes)}`}
              sub={`${ramPct} %`}
              bar={
                <UsageBar
                  value={ramUsed}
                  max={stats.system_memory_total_bytes}
                  colorClass={ramPct > 85 ? 'bg-destructive' : ramPct > 65 ? 'bg-amber-500' : 'bg-blue-500'}
                />
              }
            />
            <StatRow
              icon={<MemoryStick className="h-3.5 w-3.5 text-violet-500" />}
              label="App-Prozess"
              value={fmtBytes(stats.process_memory_bytes)}
            />
          </div>

          {/* CPU */}
          <div className="space-y-2.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Prozessor</p>
            <StatRow
              icon={<Cpu className="h-3.5 w-3.5" />}
              label="CPU-Auslastung (Ø)"
              value={`${cpuPct} %`}
              bar={
                <UsageBar
                  value={cpuPct}
                  max={100}
                  colorClass={cpuPct > 80 ? 'bg-destructive' : cpuPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'}
                />
              }
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

