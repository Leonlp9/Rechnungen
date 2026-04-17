import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  delta?: number;
  icon?: React.ReactNode;
}

export function KPICard({ title, value, delta, icon }: KPICardProps) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
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

