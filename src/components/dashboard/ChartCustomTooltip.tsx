// Shared custom tooltip for all dashboard charts
// Shows: header label + colored dot + series name + formatted value for each entry
import { fmtEurChart as fmtEur } from '@/lib/utils';

interface Entry {
  name: string;
  value: number;
  color: string;
}

interface Props {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: string;
  privacyMode?: boolean;
}

export function ChartCustomTooltip({ active, payload, label, privacyMode }: Props) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-xs space-y-1 min-w-[140px]">
      {label && <p className="font-semibold text-foreground mb-1">{label}</p>}
      {(payload as Entry[]).map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-muted-foreground flex-1">{p.name}:</span>
          <span className="font-medium tabular-nums">
            {privacyMode ? '€€€€' : fmtEur(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

