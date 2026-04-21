import { Check, Navigation } from 'lucide-react';
import {
  LayoutDashboard, FileText, FilePlus2, PenSquare, ListTodo, Mail,
  Settings as SettingsIcon, HelpCircle, CalendarDays, Users, Car, Landmark,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useAppStore } from '@/store';
import type { AppTheme } from '@/store';

const NAV_ITEMS_CONFIG = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/invoices', label: 'Alle Rechnungen', icon: FileText },
  { to: '/write-invoice', label: 'Rechnung schreiben', icon: FilePlus2 },
  { to: '/invoice-designer', label: 'Template Designer', icon: PenSquare },
  { to: '/lists', label: 'Listen', icon: ListTodo },
  { to: '/gmail', label: 'Mail', icon: Mail },
  { to: '/calendar', label: 'Kalender', icon: CalendarDays },
  { to: '/customers', label: 'Kunden', icon: Users },
  { to: '/fahrtenbuch', label: 'Fahrtenbuch', icon: Car },
  { to: '/bank-import', label: 'Bankimport', icon: Landmark },
  { to: '/settings', label: 'Einstellungen', icon: SettingsIcon },
  { to: '/help', label: 'Hilfe', icon: HelpCircle },
];

interface ErscheinungsbildTabProps {
  toggleDark: () => void;
}

function ThemeButton({ id: _id, label, desc, active, onClick, children }: {
  id: string; label: string; desc: string; active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`relative rounded-xl border-2 p-3 text-left transition-all hover:shadow-md focus:outline-none ${active ? 'border-primary shadow-md' : 'border-border hover:border-primary/50'}`}>
      {active && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" /></span>}
      {children}
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </button>
  );
}

export function ErscheinungsbildTab({ toggleDark }: ErscheinungsbildTabProps) {
  const darkMode = useAppStore((s) => s.darkMode);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const animations = useAppStore((s) => s.animations);
  const setAnimations = useAppStore((s) => s.setAnimations);
  const hiddenNavItems = useAppStore((s) => s.hiddenNavItems);
  const toggleNavItem = useAppStore((s) => s.toggleNavItem);

  return (
    <>
      <Card className="rounded-xl shadow-sm" data-tutorial="settings-appearance">
        <CardHeader><CardTitle className="text-base">Erscheinungsbild</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div><Label>Dark Mode</Label><p className="text-xs text-muted-foreground">Dunkles Farbschema aktivieren</p></div>
            <Button variant="outline" onClick={toggleDark}>{darkMode ? 'Deaktivieren' : 'Aktivieren'}</Button>
          </div>
          <div className="flex items-center justify-between">
            <div><Label>UI Animationen</Label><p className="text-xs text-muted-foreground">Hover-Effekte, Karten-Lift, Seiten-Übergänge u.v.m.</p></div>
            <Button variant="outline" onClick={() => setAnimations(!animations)} className="min-w-25">{animations ? 'Deaktivieren' : 'Aktivieren'}</Button>
          </div>
          <div className="space-y-3">
            <div><Label>Theme</Label><p className="text-xs text-muted-foreground">Wähle das visuelle Design der App</p></div>
            <div className="grid grid-cols-2 gap-3">
              <ThemeButton id="default" label="Default" desc="Klares, minimales Design" active={theme === 'default'} onClick={() => setTheme('default' as AppTheme)}>
                <div className="mb-2 h-16 rounded-lg overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 flex flex-col gap-1 p-2">
                  <div className="h-2 w-3/4 rounded bg-zinc-900 dark:bg-zinc-100 opacity-80" /><div className="h-2 w-1/2 rounded bg-zinc-300 dark:bg-zinc-600" /><div className="mt-1 h-6 w-full rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700" />
                </div>
              </ThemeButton>
              <ThemeButton id="zinc" label="Zinc" desc="Kühl-neutrales Grau, kompakt" active={theme === 'zinc'} onClick={() => setTheme('zinc' as AppTheme)}>
                <div className="mb-2 h-16 rounded-lg overflow-hidden flex flex-col gap-1 p-2" style={{ background: darkMode ? 'oklch(0.141 0 0)' : 'oklch(0.985 0 0)', border: darkMode ? '1px solid oklch(1 0 0 / 12%)' : '1px solid oklch(0.870 0 0)' }}>
                  <div className="h-2 w-3/4 rounded" style={{ background: darkMode ? 'oklch(0.920 0 0)' : 'oklch(0.271 0 0)' }} /><div className="h-2 w-1/2 rounded" style={{ background: darkMode ? 'oklch(0.650 0 0)' : 'oklch(0.520 0 0)', opacity: 0.5 }} /><div className="mt-1 h-6 w-full rounded" style={{ background: darkMode ? 'oklch(0.200 0 0)' : 'oklch(0.920 0 0)', border: darkMode ? '1px solid oklch(1 0 0 / 12%)' : '1px solid oklch(0.870 0 0)' }} />
                </div>
              </ThemeButton>
              <ThemeButton id="stone" label="Stone" desc="Warm-neutrales Beige, weich" active={theme === 'stone'} onClick={() => setTheme('stone' as AppTheme)}>
                <div className="mb-2 h-16 rounded-lg overflow-hidden flex flex-col gap-1 p-2" style={{ background: darkMode ? 'oklch(0.147 0.012 75)' : 'oklch(0.982 0.012 75)', border: darkMode ? '1px solid oklch(1 0 0 / 12%)' : '1px solid oklch(0.858 0.026 75)' }}>
                  <div className="h-2 w-3/4 rounded" style={{ background: darkMode ? 'oklch(0.923 0.005 75)' : 'oklch(0.268 0.018 75)' }} /><div className="h-2 w-1/2 rounded" style={{ background: darkMode ? 'oklch(0.655 0.008 75)' : 'oklch(0.520 0.020 75)', opacity: 0.5 }} /><div className="mt-1 h-6 w-full rounded" style={{ background: darkMode ? 'oklch(0.205 0.005 75)' : 'oklch(0.910 0.022 75)', border: darkMode ? '1px solid oklch(1 0 0 / 12%)' : '1px solid oklch(0.858 0.026 75)' }} />
                </div>
              </ThemeButton>
              <ThemeButton id="windows11" label="Windows 11" desc="Fluent Design, Windows-Blau" active={theme === 'windows11'} onClick={() => setTheme('windows11' as AppTheme)}>
                <div className="mb-2 h-16 rounded-lg overflow-hidden flex flex-col gap-1 p-2" style={{ background: darkMode ? 'oklch(0.115 0.012 248)' : 'oklch(0.975 0.006 240)', border: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid oklch(0.870 0.012 240)' }}>
                  <div className="flex items-center gap-1 mb-0.5"><div className="h-1.5 w-1.5 rounded-full" style={{ background: 'oklch(0.50 0.19 257)' }} /><div className="h-1.5 w-8 rounded" style={{ background: darkMode ? 'oklch(0.945 0.008 240)' : 'oklch(0.12 0.01 250)', opacity: 0.8 }} /></div>
                  <div className="h-2 w-3/4 rounded" style={{ background: darkMode ? 'oklch(0.945 0.008 240)' : 'oklch(0.12 0.01 250)', opacity: 0.85 }} /><div className="h-2 w-1/2 rounded" style={{ background: darkMode ? 'oklch(0.62 0.014 248)' : 'oklch(0.44 0.012 250)', opacity: 0.5 }} /><div className="mt-1 h-5 w-full rounded" style={{ background: darkMode ? 'oklch(0.210 0.018 248)' : 'oklch(0.930 0.010 240)', border: darkMode ? '1px solid oklch(1 0 0 / 10%)' : '1px solid oklch(0.870 0.012 240)' }} />
                </div>
              </ThemeButton>
              <ThemeButton id="chroma" label="Chroma" desc="Lebendiger Regenbogen-Farbwechsel" active={theme === 'chroma'} onClick={() => setTheme('chroma' as AppTheme)}>
                <div className="mb-2 h-16 rounded-lg overflow-hidden relative flex flex-col gap-1 p-2" style={{ background: darkMode ? '#0f0f18' : '#fafaff', border: '1px solid transparent' }}>
                  <div className="absolute inset-0 rounded-lg" style={{ background: 'linear-gradient(135deg, oklch(0.65 0.24 0), oklch(0.65 0.24 60), oklch(0.65 0.24 120), oklch(0.65 0.24 180), oklch(0.65 0.24 240), oklch(0.65 0.24 300), oklch(0.65 0.24 360))', opacity: darkMode ? 0.30 : 0.18 }} />
                  <div className="relative h-2 w-3/4 rounded" style={{ background: 'linear-gradient(90deg, oklch(0.55 0.24 10), oklch(0.58 0.22 120), oklch(0.55 0.24 240))' }} /><div className="relative h-2 w-1/2 rounded" style={{ background: 'linear-gradient(90deg, oklch(0.65 0.20 60), oklch(0.65 0.20 180))', opacity: 0.7 }} /><div className="relative mt-1 h-6 w-full rounded-lg" style={{ background: darkMode ? 'oklch(0.19 0.026 240 / 80%)' : 'oklch(0.993 0.004 240 / 85%)', border: '1px solid oklch(0.60 0.22 300 / 40%)' }} />
                </div>
              </ThemeButton>
              <ThemeButton id="liquid-glass" label="Liquid Glass" desc="Apple-ähnliches Glasdesign" active={theme === 'liquid-glass'} onClick={() => setTheme('liquid-glass' as AppTheme)}>
                <div className="mb-2 h-16 rounded-lg overflow-hidden relative flex flex-col gap-1 p-2" style={{ background: darkMode ? 'linear-gradient(135deg, oklch(0.18 0.04 265) 0%, oklch(0.14 0.03 200) 100%)' : 'linear-gradient(135deg, oklch(0.88 0.06 265) 0%, oklch(0.92 0.04 200) 100%)' }}>
                  <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(circle at 30% 30%, oklch(0.75 0.18 265 / 40%), transparent 60%)' }} />
                  <div className="relative h-2 w-3/4 rounded" style={{ background: darkMode ? 'oklch(0.95 0 0 / 80%)' : 'oklch(0.15 0 0 / 70%)' }} /><div className="relative h-2 w-1/2 rounded" style={{ background: darkMode ? 'oklch(0.95 0 0 / 40%)' : 'oklch(0.15 0 0 / 35%)' }} /><div className="relative mt-1 h-6 w-full rounded-lg" style={{ background: darkMode ? 'oklch(1 0 0 / 8%)' : 'oklch(1 0 0 / 55%)', backdropFilter: 'blur(8px)', border: darkMode ? '1px solid oklch(1 0 0 / 12%)' : '1px solid oklch(1 0 0 / 40%)' }} />
                </div>
              </ThemeButton>
              <ThemeButton id="aurora-borealis" label="Aurora Borealis" desc="Nordlichter in Grün & Lila" active={theme === 'aurora-borealis'} onClick={() => setTheme('aurora-borealis' as AppTheme)}>
                <div className="mb-2 h-16 rounded-lg overflow-hidden relative flex flex-col gap-1 p-2" style={{ background: darkMode ? 'linear-gradient(135deg, oklch(0.10 0.025 220) 0%, oklch(0.12 0.03 175) 100%)' : 'linear-gradient(135deg, oklch(0.93 0.025 165) 0%, oklch(0.90 0.04 200) 100%)' }}>
                  <div className="absolute inset-0" style={{ background: darkMode ? 'radial-gradient(ellipse at 20% 50%, oklch(0.45 0.22 175 / 45%) 0%, transparent 55%), radial-gradient(ellipse at 80% 30%, oklch(0.42 0.24 280 / 35%) 0%, transparent 50%)' : 'radial-gradient(ellipse at 20% 50%, oklch(0.65 0.18 175 / 25%) 0%, transparent 55%), radial-gradient(ellipse at 80% 30%, oklch(0.60 0.20 280 / 20%) 0%, transparent 50%)' }} />
                  <div className="relative h-2 w-3/4 rounded" style={{ background: darkMode ? 'oklch(0.62 0.20 175 / 90%)' : 'oklch(0.48 0.18 175 / 80%)' }} /><div className="relative h-2 w-1/2 rounded" style={{ background: darkMode ? 'oklch(0.65 0.22 280 / 60%)' : 'oklch(0.55 0.20 280 / 50%)' }} /><div className="relative mt-1 h-6 w-full rounded-lg" style={{ background: darkMode ? 'oklch(0.14 0.03 210 / 80%)' : 'oklch(0.99 0.008 165 / 75%)', border: darkMode ? '1px solid oklch(0.62 0.20 175 / 25%)' : '1px solid oklch(0.48 0.18 175 / 30%)' }} />
                </div>
              </ThemeButton>
              <ThemeButton id="crimson-dusk" label="Crimson Dusk" desc="Warmer Sonnenuntergang in Rot & Orange" active={theme === 'crimson-dusk'} onClick={() => setTheme('crimson-dusk' as AppTheme)}>
                <div className="mb-2 h-16 rounded-lg overflow-hidden relative flex flex-col gap-1 p-2" style={{ background: darkMode ? 'linear-gradient(135deg, oklch(0.10 0.025 20) 0%, oklch(0.13 0.03 35) 100%)' : 'linear-gradient(135deg, oklch(0.97 0.010 40) 0%, oklch(0.93 0.025 25) 100%)' }}>
                  <div className="absolute inset-0" style={{ background: darkMode ? 'radial-gradient(ellipse at 75% 20%, oklch(0.48 0.24 25 / 50%) 0%, transparent 50%), radial-gradient(ellipse at 25% 70%, oklch(0.50 0.20 50 / 35%) 0%, transparent 50%)' : 'radial-gradient(ellipse at 75% 20%, oklch(0.65 0.22 25 / 25%) 0%, transparent 50%), radial-gradient(ellipse at 25% 70%, oklch(0.68 0.18 50 / 20%) 0%, transparent 50%)' }} />
                  <div className="relative h-2 w-3/4 rounded" style={{ background: darkMode ? 'oklch(0.65 0.22 25 / 90%)' : 'oklch(0.52 0.22 25 / 80%)' }} /><div className="relative h-2 w-1/2 rounded" style={{ background: darkMode ? 'oklch(0.70 0.20 50 / 60%)' : 'oklch(0.60 0.18 50 / 50%)' }} /><div className="relative mt-1 h-6 w-full rounded-lg" style={{ background: darkMode ? 'oklch(0.15 0.03 20 / 80%)' : 'oklch(0.99 0.006 40 / 75%)', border: darkMode ? '1px solid oklch(0.65 0.22 25 / 25%)' : '1px solid oklch(0.52 0.22 25 / 30%)' }} />
                </div>
              </ThemeButton>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Navigation className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Navigation</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Wähle, welche Tabs in der Seitenleiste sichtbar sein sollen.</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {NAV_ITEMS_CONFIG.map(({ to, label, icon: Icon }) => {
            const isVisible = !hiddenNavItems.includes(to);
            const isSettings = to === '/settings';
            return (
              <div key={to} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{label}</span>
                </div>
                <Button variant="outline" size="sm" disabled={isSettings} onClick={() => toggleNavItem(to)} className="min-w-24">
                  {isVisible ? 'Ausblenden' : 'Einblenden'}
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}


