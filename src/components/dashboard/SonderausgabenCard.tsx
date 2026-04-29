import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Invoice, Category } from '@/types';
import { CATEGORY_LABELS, SONDERAUSGABEN_CATEGORIES, PRIVAT_CATEGORIES } from '@/types';
import { fmtCurrency } from '@/lib/utils';
import { Heart } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

interface Props {
  invoices: Invoice[];
  privacyMode?: boolean;
  loading?: boolean;
}

const ACCENT_COLORS: Record<string, string> = {
  spenden: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  krankenkasse: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  sozialversicherung: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  privat: 'bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400',
};

const ALL_SPECIAL: Category[] = [...SONDERAUSGABEN_CATEGORIES, ...PRIVAT_CATEGORIES];

export function SonderausgabenCard({ invoices, privacyMode, loading }: Props) {
  const { sonderRows, privatRows } = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of invoices) {
      if (inv.type !== 'ausgabe') continue;
      if (!ALL_SPECIAL.includes(inv.category as Category)) continue;
      map.set(inv.category, (map.get(inv.category) ?? 0) + inv.brutto);
    }
    const entries = Array.from(map.entries()).map(([cat, total]) => ({
      cat,
      total,
      label: CATEGORY_LABELS[cat as Category] ?? cat,
    }));
    return {
      sonderRows: entries.filter((r) => SONDERAUSGABEN_CATEGORIES.includes(r.cat as Category)).sort((a, b) => b.total - a.total),
      privatRows: entries.filter((r) => PRIVAT_CATEGORIES.includes(r.cat as Category)).sort((a, b) => b.total - a.total),
    };
  }, [invoices]);

  const sonderGesamt = sonderRows.reduce((s, r) => s + r.total, 0);
  const privatGesamt = privatRows.reduce((s, r) => s + r.total, 0);
  const isEmpty = sonderRows.length === 0 && privatRows.length === 0;
  if (isEmpty) return null;

  if (loading) {
    return (
      <Card className="rounded-xl shadow-sm h-full">
        <CardHeader><Skeleton className="h-5 w-48" /></CardHeader>
        <CardContent className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-6 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl shadow-sm h-full">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Heart className="h-4 w-4 text-rose-500" />
          Sonderausgaben & Privat
          <InfoTooltip text="Sonderausgaben (z. B. Krankenkasse, Spenden) können ggf. in der Einkommensteuererklärung geltend gemacht werden. Private Ausgaben sind steuerlich nicht absetzbar. Beide Kategorien senken das Saldo, aber nicht das steuerliche Betriebsergebnis." side="right" />
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Kein regulärer Betriebsaufwand – senken das Saldo, nicht das Betriebsergebnis
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
            {sonderRows.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sonderausgaben</p>
                <p className="text-[11px] text-muted-foreground">Senken das Saldo – steuerlich ggf. bei Einkommensteuer absetzbar</p>
                {sonderRows.map((r) => (
                  <div key={r.cat} className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ACCENT_COLORS[r.cat] ?? 'bg-muted text-muted-foreground'}`}>
                      {r.label}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">{fmtCurrency(r.total, privacyMode ?? false)}</span>
                  </div>
                ))}
                <div className="pt-1 border-t flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Gesamt Sonderausgaben</span>
                  <span className="text-sm font-bold tabular-nums">{fmtCurrency(sonderGesamt, privacyMode ?? false)}</span>
                </div>
              </div>
            )}
            {privatRows.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Privat</p>
                <p className="text-[11px] text-muted-foreground">Senken das Saldo – steuerlich nicht absetzbar</p>
                {privatRows.map((r) => (
                  <div key={r.cat} className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ACCENT_COLORS[r.cat] ?? 'bg-muted text-muted-foreground'}`}>
                      {r.label}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">{fmtCurrency(r.total, privacyMode ?? false)}</span>
                  </div>
                ))}
                <div className="pt-1 border-t flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Gesamt Privat</span>
                  <span className="text-sm font-bold tabular-nums">{fmtCurrency(privatGesamt, privacyMode ?? false)}</span>
                </div>
              </div>
            )}
          </div>
      </CardContent>
    </Card>
  );
}
