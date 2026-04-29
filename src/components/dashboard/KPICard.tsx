import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useAppStore } from '@/store';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

interface KPICardProps {
  title: string;
  value: string;
  /** Optional raw numeric value – enables count-up animation when animations are on */
  rawValue?: number;
  /** Formatter used for animated display (falls back to `value` when not animating) */
  formatValue?: (v: number) => string;
  delta?: number;
  icon?: React.ReactNode;
  tooltip?: string;
  loading?: boolean;
  onClick?: () => void;
}

function useCountUp(target: number, enabled: boolean, duration = 600) {
  const [display, setDisplay] = useState(target);
  const prevTarget = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) { setDisplay(target); prevTarget.current = target; return; }
    if (prevTarget.current === target) return;

    const start = prevTarget.current;
    const end = target;
    prevTarget.current = target;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + (end - start) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(end);
      }
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, enabled, duration]);

  return display;
}

export function KPICard({ title, value, rawValue, formatValue, delta, icon, tooltip, loading, onClick }: KPICardProps) {
  const animations = useAppStore((s) => s.animations);
  const animEnabled = animations && rawValue !== undefined && formatValue !== undefined;
  const animated = useCountUp(rawValue ?? 0, animEnabled);
  const displayValue = animEnabled ? formatValue!(animated) : value;

  if (loading) {
    return (
      <Card className="rounded-xl shadow-sm h-full flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-4 rounded-full" />
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-end">
          <Skeleton className="h-8 w-24 mb-2" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    );
  }
  return (
    <Card
      className={cn('rounded-xl shadow-sm h-full flex flex-col', onClick && 'cursor-pointer hover:bg-muted/30 transition-colors')}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
          {title}
          {tooltip && <InfoTooltip text={tooltip} side="top" />}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="text-2xl font-bold tabular-nums">{displayValue}</div>
        {delta !== undefined && (
          <div className={cn('mt-1 flex items-center gap-1 text-xs',
            delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-muted-foreground'
          )}>
            {delta > 0 ? <TrendingUp className="h-3 w-3" /> : delta < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            <span>{delta > 0 ? '+' : ''}{delta.toFixed(1)}% zur Vorperiode</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
