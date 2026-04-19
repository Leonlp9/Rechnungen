import { cn } from '@/lib/utils';

interface LegendPayloadItem {
  value: string;
  color?: string;
  dataKey?: string;
}

interface Props {
  payload?: LegendPayloadItem[];
  /** Override recharts-injected payload (needed for Pie charts where hidden slices disappear from payload) */
  customPayload?: LegendPayloadItem[];
  hiddenKeys: Set<string>;
  onToggle: (key: string) => void;
}

/**
 * Drop-in replacement for ChartLegendContent that makes every item
 * clickable to show/hide the corresponding data series.
 * Pass `customPayload` to keep all items visible in the legend even when filtered out of the chart.
 */
export function ClickableLegend({ payload, customPayload, hiddenKeys, onToggle }: Props) {
  const items = customPayload ?? payload;
  if (!items?.length) return null;
  return (
    <div className="flex items-center justify-center gap-4 pt-2 flex-wrap">
      {items.map((item) => {
        const key = item.value;
        const hidden = hiddenKeys.has(key);
        return (
          <button
            key={key}
            onClick={() => onToggle(key)}
            className={cn(
              'flex items-center gap-1.5 text-xs transition-opacity select-none',
              hidden ? 'opacity-35' : 'opacity-100',
            )}
            title={hidden ? `${key} einblenden` : `${key} ausblenden`}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className={cn('font-medium', hidden && 'line-through decoration-1')}>
              {key}
            </span>
          </button>
        );
      })}
    </div>
  );
}



