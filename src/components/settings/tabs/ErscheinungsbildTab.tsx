import {Check, FolderKanban, Navigation} from 'lucide-react';
import {
  LayoutDashboard, FileText, FilePlus2, PenSquare, ListTodo, Mail,
  Settings as SettingsIcon, HelpCircle, CalendarDays, Users, Car, Landmark,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
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
  { to: '/projects', label: 'Projekte', icon: FolderKanban },
  { to: '/fahrtenbuch', label: 'Fahrtenbuch', icon: Car },
  { to: '/bank-import', label: 'Bankimport', icon: Landmark },
  { to: '/steuerbericht', label: 'Steuerbericht', icon: FileText },
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
  const showGlossarTooltips = useAppStore((s) => s.showGlossarTooltips);
  const setShowGlossarTooltips = useAppStore((s) => s.setShowGlossarTooltips);

  return (
    <>
      <Card className="rounded-xl shadow-sm" data-tutorial="settings-appearance">
        <CardHeader><CardTitle className="text-base">Erscheinungsbild</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div><Label>Dark Mode</Label><p className="text-xs text-muted-foreground">Dunkles Farbschema aktivieren</p></div>
            <Switch checked={darkMode} onCheckedChange={toggleDark} aria-label="Dark Mode" />
          </div>
          <div className="flex items-center justify-between">
            <div><Label>UI Animationen</Label><p className="text-xs text-muted-foreground">Hover-Effekte, Karten-Lift, Seiten-Übergänge u.v.m.</p></div>
            <Switch checked={animations} onCheckedChange={setAnimations} aria-label="UI Animationen" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Erklärungssymbole (ⓘ)</Label>
              <p className="text-xs text-muted-foreground">Info-Icons mit Begriffserklärungen für Fachbegriffe ein-/ausblenden</p>
            </div>
            <Switch
              checked={showGlossarTooltips}
              onCheckedChange={setShowGlossarTooltips}
              aria-label="Erklärungssymbole"
            />
          </div>
          <div className="space-y-3">
            <div><Label>Theme</Label><p className="text-xs text-muted-foreground">Wähle das visuelle Design der App</p></div>
            <div className="grid grid-cols-2 gap-3">
              <ThemeButton id="default" label="Standard" desc="Klar und zurückhaltend" active={theme === 'default'} onClick={() => setTheme('default' as AppTheme)}>
                <div className="mb-2 h-16 rounded-lg overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 flex flex-col gap-1 p-2">
                  <div className="h-2 w-3/4 rounded bg-zinc-900 dark:bg-zinc-100 opacity-80" />
                  <div className="h-2 w-1/2 rounded bg-zinc-300 dark:bg-zinc-600" />
                  <div className="mt-1 h-6 w-full rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700" />
                </div>
              </ThemeButton>

              <ThemeButton id="apple26" label="Apple UI Kit 26" desc="iOS 26 – große Titel, schwebende Leiste" active={theme === 'apple26'} onClick={() => setTheme('apple26' as AppTheme)}>
                <div className="mb-2 h-16 rounded-lg overflow-hidden relative flex flex-col gap-1 p-2" style={{ background: darkMode ? '#000000' : '#F2F2F7', border: darkMode ? '1px solid rgba(84,84,88,0.6)' : '1px solid rgba(60,60,67,0.2)' }}>
                  <div className="h-2 w-2/3 rounded-full" style={{ background: darkMode ? '#FFFFFF' : '#000000', opacity: 0.85 }} />
                  <div className="h-4 w-full rounded-lg" style={{ background: darkMode ? '#1C1C1E' : '#FFFFFF', boxShadow: darkMode ? 'none' : '0 1px 2px rgba(0,0,0,0.06)' }} />
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full px-1.5 py-1" style={{ background: darkMode ? 'rgba(30,30,32,0.8)' : 'rgba(255,255,255,0.8)', border: darkMode ? '0.5px solid rgba(255,255,255,0.12)' : '0.5px solid rgba(255,255,255,0.7)', boxShadow: '0 4px 12px rgba(0,0,0,0.18)' }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: darkMode ? '#0A84FF' : '#007AFF' }} />
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: darkMode ? 'rgba(235,235,245,0.4)' : 'rgba(60,60,67,0.35)' }} />
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: darkMode ? 'rgba(235,235,245,0.4)' : 'rgba(60,60,67,0.35)' }} />
                  </div>
                </div>
              </ThemeButton>

              <ThemeButton id="oneui" label="One UI 9" desc="Samsung – Titel unten, weiche Kacheln" active={theme === 'oneui'} onClick={() => setTheme('oneui' as AppTheme)}>
                <div className="mb-2 h-16 rounded-lg overflow-hidden relative flex flex-col justify-end gap-1 p-2" style={{ background: darkMode ? '#010102' : '#F1F1F3', border: darkMode ? '1px solid #3A3A3D' : '1px solid #E4E4E7' }}>
                  {/* One UI: großer Titel sitzt tief, Inhalt darunter in weichen Kacheln */}
                  <div className="h-2.5 w-1/2 rounded-full" style={{ background: darkMode ? '#FFFFFF' : '#000000', opacity: 0.9 }} />
                  <div className="h-5 w-full rounded-[10px]" style={{ background: darkMode ? '#17171A' : '#FCFCFF' }} />
                  <div className="absolute right-2 top-2 h-3 w-6 rounded-full" style={{ background: darkMode ? '#598FFF' : '#387AFF' }} />
                </div>
              </ThemeButton>

              <ThemeButton id="liquid-glass" label="Liquid Glass" desc="Apple UI Kit mit Glasflächen" active={theme === 'liquid-glass'} onClick={() => setTheme('liquid-glass' as AppTheme)}>
                <div className="mb-2 h-16 rounded-lg overflow-hidden relative flex flex-col gap-1 p-2" style={{ background: darkMode ? 'linear-gradient(135deg, oklch(0.18 0.04 265) 0%, oklch(0.14 0.03 200) 100%)' : 'linear-gradient(135deg, oklch(0.88 0.06 265) 0%, oklch(0.92 0.04 200) 100%)' }}>
                  <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(circle at 30% 30%, oklch(0.75 0.18 265 / 40%), transparent 60%)' }} />
                  <div className="relative h-2 w-3/4 rounded-full" style={{ background: darkMode ? 'oklch(0.95 0 0 / 80%)' : 'oklch(0.15 0 0 / 70%)' }} />
                  <div className="relative mt-1 h-6 w-full rounded-xl" style={{ background: darkMode ? 'oklch(1 0 0 / 8%)' : 'oklch(1 0 0 / 55%)', backdropFilter: 'blur(8px)', border: darkMode ? '1px solid oklch(1 0 0 / 12%)' : '1px solid oklch(1 0 0 / 40%)' }} />
                </div>
              </ThemeButton>

              <ThemeButton id="windows11" label="Windows 11" desc="Fluent Design, Mica und Akzentblau" active={theme === 'windows11'} onClick={() => setTheme('windows11' as AppTheme)}>
                <div className="mb-2 h-16 rounded-lg overflow-hidden flex gap-1 p-2" style={{ background: darkMode ? '#202020' : '#F3F3F3', border: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E5E5E5' }}>
                  {/* Fluent: linke Navigationsspalte mit senkrechtem Auswahlbalken */}
                  <div className="flex w-1/4 flex-col gap-1 pt-0.5">
                    <div className="flex items-center gap-0.5">
                      <span className="h-2 w-[2px] rounded-full" style={{ background: darkMode ? '#60CDFF' : '#0067C0' }} />
                      <span className="h-1.5 flex-1 rounded" style={{ background: darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)' }} />
                    </div>
                    <span className="ml-1 h-1.5 w-full rounded" style={{ background: darkMode ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)' }} />
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="h-2 w-3/4 rounded" style={{ background: darkMode ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)' }} />
                    <div className="mt-auto h-5 w-full rounded-[7px]" style={{ background: darkMode ? '#2B2B2B' : '#FFFFFF', border: darkMode ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.06)' }} />
                  </div>
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
                {/* Die Einstellungen selbst lassen sich nicht ausblenden –
                    man käme sonst nicht mehr hierher zurück. */}
                <Switch
                  checked={isVisible}
                  disabled={isSettings}
                  onCheckedChange={() => toggleNavItem(to)}
                  aria-label={`${label} in der Navigation anzeigen`}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}


