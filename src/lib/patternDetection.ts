import type { Invoice, InvoiceType, Category } from '@/types';

export type Interval = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface DetectedPattern {
  partner: string;
  category: Category;
  type: InvoiceType;
  interval: Interval;
  avgBrutto: number;
  lastDate: Date;
  nextExpectedDate: Date;
  confidence: number; // 0–1
  fixedAmount: boolean;
  occurrences: number;
}

export interface ForecastItem {
  pattern: DetectedPattern;
  expectedDate: Date;
  expectedBrutto: number;
}

const INTERVAL_DAYS: Record<Interval, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 91,
  yearly: 365,
};

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function detectInterval(medianDays: number): Interval | null {
  const entries = Object.entries(INTERVAL_DAYS) as [Interval, number][];
  for (const [interval, days] of entries) {
    if (medianDays >= days * 0.7 && medianDays <= days * 1.3) return interval;
  }
  return null;
}

export function detectPatterns(invoices: Invoice[]): DetectedPattern[] {
  // Group by partner + category + type
  const groups = new Map<string, Invoice[]>();
  for (const inv of invoices) {
    if (inv.type === 'info') continue;
    const key = `${inv.partner.trim().toLowerCase()}||${inv.category}||${inv.type}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(inv);
  }

  const patterns: DetectedPattern[] = [];

  for (const [, group] of groups) {
    if (group.length < 2) continue;

    // Sort by date ascending
    const sorted = [...group].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate gaps in days
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const diff = (new Date(sorted[i].date).getTime() - new Date(sorted[i - 1].date).getTime()) / (1000 * 60 * 60 * 24);
      gaps.push(diff);
    }

    const medianGap = median(gaps);
    const interval = detectInterval(medianGap);
    if (!interval) continue;

    // Check amount consistency – use median to be robust against temporary discounts/outliers
    const bruttoValues = sorted.map((i) => i.brutto);
    const medianBrutto = median(bruttoValues);
    const avgBrutto = medianBrutto; // use median as the representative amount
    // Count how many values are "outliers" (>10% off from median)
    const outlierCount = bruttoValues.filter((v) => Math.abs(v - medianBrutto) / medianBrutto > 0.10).length;
    const outlierRatio = outlierCount / bruttoValues.length;
    // Fixed amount if most values cluster around median (allow up to 30% outliers)
    const fixedAmount = outlierRatio <= 0.30;

    // Confidence: based on count, amount consistency (penalize only if many outliers) and regularity
    // countScore starts low for 2 occurrences (min 2 needed) and grows with more data
    const countScore = Math.min(1, (group.length - 1) / 9); // 2→0.11, 3→0.22, 10→1.0
    // Amount score: high if outlier ratio is low, gradually penalized
    const amountScore = Math.max(0, 1 - outlierRatio * 2);
    const gapVariance = gaps.length > 1
      ? gaps.reduce((s, g) => s + Math.abs(g - medianGap), 0) / gaps.length / medianGap
      : 0;
    // For 2 occurrences there's only 1 gap so regularity can't be measured – apply penalty
    const regularityScore = gaps.length === 1 ? 0.4 : Math.max(0, 1 - gapVariance);
    const confidence = Math.round(((countScore * 0.35 + amountScore * 0.25 + regularityScore * 0.40)) * 100) / 100;

    const last = sorted[sorted.length - 1];
    const lastDate = new Date(last.date);
    const nextExpectedDate = new Date(lastDate.getTime() + INTERVAL_DAYS[interval] * 24 * 60 * 60 * 1000);

    patterns.push({
      partner: last.partner,
      category: last.category,
      type: last.type,
      interval,
      avgBrutto,
      lastDate,
      nextExpectedDate,
      confidence,
      fixedAmount,
      occurrences: group.length,
    });
  }

  return patterns.sort((a, b) => b.confidence - a.confidence);
}

export function forecastCurrentMonth(patterns: DetectedPattern[]): ForecastItem[] {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  return patterns
    .filter((p) => {
      const d = p.nextExpectedDate;
      return d >= today && d >= startOfMonth && d <= endOfMonth;
    })
    .map((p) => ({
      pattern: p,
      expectedDate: p.nextExpectedDate,
      expectedBrutto: p.avgBrutto,
    }))
    .sort((a, b) => a.expectedDate.getTime() - b.expectedDate.getTime());
}




