import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  delta?: number;
  icon?: React.ReactNode;
  tooltip?: string;
  loading?: boolean;
}

export function KPICard({ title, value, delta, icon, tooltip, loading }: KPICardProps) {
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
    <Card className="rounded-xl shadow-sm h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
          {title}
          {tooltip && (
            <span title={tooltip} className="cursor-help text-muted-foreground/60 hover:text-muted-foreground">
              <Info className="h-3 w-3" />
            </span>
          )}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="text-2xl font-bold">{value}</div>
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
