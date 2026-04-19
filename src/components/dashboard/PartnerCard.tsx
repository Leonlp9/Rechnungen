import React, { useState, useMemo } from 'react';
import type { Invoice } from '@/types';
import { fmtCurrency } from '@/lib/utils';
import { Settings, User, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

type Zeitraum = 'monat' | 'jahr' | 'gesamt';

const STORAGE_KEY = 'partner_card_settings';

function loadSettings(): { partner: string; zeitraum: Zeitraum } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { partner: '', zeitraum: 'monat' };
}

function saveSettings(s: { partner: string; zeitraum: Zeitraum }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

interface PartnerCardProps {
  loading?: boolean;
  invoices: Invoice[];
  selectedYear: number;
  selectedMonth: number;
  privacyMode?: boolean;
  editMode?: boolean;
  settingsOpen?: boolean;
  onSettingsClose?: () => void;
}

export const PartnerCard: React.FC<PartnerCardProps> = ({
  loading,
  invoices,
  selectedYear,
  selectedMonth,
  privacyMode,
  editMode,
  settingsOpen,
  onSettingsClose,
}) => {
  const [settings, setSettings] = useState(loadSettings);
  const [search, setSearch] = useState('');

  // Collect unique partners from all invoices
  const allPartners = useMemo(() => {
    const set = new Set(invoices.map((i) => i.partner).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'de'));
  }, [invoices]);

  const filteredPartners = useMemo(() => {
    const q = search.toLowerCase();
    return allPartners.filter((p) => p.toLowerCase().includes(q));
  }, [allPartners, search]);

  const updateSettings = (patch: Partial<typeof settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  };

  // Filter invoices for the chosen partner & zeitraum
  const relevantInvoices = useMemo(() => {
    const partner = settings.partner;
    if (!partner) return [];
    let filtered = invoices.filter((i) => i.partner === partner);
    if (settings.zeitraum === 'monat') {
      filtered = filtered.filter((i) => i.year === selectedYear && i.month === selectedMonth);
    } else if (settings.zeitraum === 'jahr') {
      filtered = filtered.filter((i) => i.year === selectedYear);
    }
    return filtered;
  }, [invoices, settings.partner, settings.zeitraum, selectedYear, selectedMonth]);

  const einnahmen = relevantInvoices.filter((i) => i.type === 'einnahme').reduce((s, i) => s + i.brutto, 0);
  const ausgaben = relevantInvoices.filter((i) => i.type === 'ausgabe').reduce((s, i) => s + i.brutto, 0);
  const saldo = einnahmen - ausgaben;
  const belegCount = relevantInvoices.length;

  const zeitraumLabel: Record<Zeitraum, string> = {
    monat: 'Akt. Monat',
    jahr: 'Akt. Jahr',
    gesamt: 'Gesamt',
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <User className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-semibold truncate">
            {settings.partner || 'Partner wählen…'}
          </span>
          {settings.partner && (
            <span className="text-xs text-muted-foreground shrink-0">
              · {zeitraumLabel[settings.zeitraum]}
            </span>
          )}
        </div>

        <DropdownMenu
          open={editMode && settingsOpen !== undefined ? settingsOpen : undefined}
          onOpenChange={(open) => { if (!open) { onSettingsClose?.(); setSearch(''); } }}
        >
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-7 w-7 pointer-events-auto shrink-0', editMode ? 'invisible w-0 p-0 overflow-hidden' : '')}
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Partner-Einstellungen</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* Zeitraum */}
            <div className="px-2 pb-1">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Zeitraum</p>
              <div className="flex gap-1">
                {(['monat', 'jahr', 'gesamt'] as Zeitraum[]).map((z) => (
                  <button
                    key={z}
                    onClick={() => updateSettings({ zeitraum: z })}
                    className={cn(
                      'flex-1 text-xs px-2 py-1 rounded border transition-colors',
                      settings.zeitraum === z
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'text-muted-foreground border-muted hover:bg-muted',
                    )}
                  >
                    {zeitraumLabel[z]}
                  </button>
                ))}
              </div>
            </div>
            <DropdownMenuSeparator />
            {/* Partner search */}
            <div className="px-2 pt-1 pb-1">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Partner suchen</p>
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name eingeben…"
                className="h-7 text-xs mb-1"
              />
            </div>
            <div className="max-h-40 overflow-y-auto">
              {filteredPartners.length === 0 ? (
                <p className="text-xs text-muted-foreground px-3 py-2">Keine Partner gefunden.</p>
              ) : (
                filteredPartners.map((p) => (
                  <DropdownMenuItem
                    key={p}
                    onClick={() => { updateSettings({ partner: p }); setSearch(''); }}
                    className={cn(settings.partner === p && 'font-semibold')}
                  >
                    {p}
                  </DropdownMenuItem>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Body */}
      <div className="flex-1 px-4 pb-4">
        {loading ? (
          <div className="space-y-2 pt-2">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-40" />
          </div>
        ) : !settings.partner ? (
          <p className="text-sm text-muted-foreground pt-1">
            Wähle über ⚙ einen Partner aus, um dessen Umsätze zu sehen.
          </p>
        ) : (
          <div className="space-y-3 pt-1">
            {/* Saldo */}
            <div>
              <p className="text-xs text-muted-foreground">Saldo</p>
              <p className={cn('text-2xl font-bold', saldo > 0 ? 'text-green-600' : saldo < 0 ? 'text-red-600' : '')}>
                {fmtCurrency(saldo, privacyMode ?? false)}
              </p>
            </div>
            {/* Einnahmen / Ausgaben */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-green-50 dark:bg-green-950/30 px-3 py-2">
                <div className="flex items-center gap-1 mb-0.5">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  <span className="text-[11px] text-green-700 dark:text-green-400">Einnahmen</span>
                </div>
                <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                  {fmtCurrency(einnahmen, privacyMode ?? false)}
                </p>
              </div>
              <div className="rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2">
                <div className="flex items-center gap-1 mb-0.5">
                  <TrendingDown className="h-3 w-3 text-red-600" />
                  <span className="text-[11px] text-red-700 dark:text-red-400">Ausgaben</span>
                </div>
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                  {fmtCurrency(ausgaben, privacyMode ?? false)}
                </p>
              </div>
            </div>
            {/* Belege */}
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Minus className="h-3 w-3" />
              {belegCount} {belegCount === 1 ? 'Beleg' : 'Belege'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

