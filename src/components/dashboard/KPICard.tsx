import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  delta?: number;
  icon?: React.ReactNode;
  tooltip?: string;
}

export function KPICard({ title, value, delta, icon, tooltip }: KPICardProps) {
  return (
    <Card className="rounded-xl shadow-sm">
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
      <CardContent>
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
