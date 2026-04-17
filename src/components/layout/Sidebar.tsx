import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Receipt,
  FilePlus2,
  PenSquare,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/invoices', label: 'Alle Rechnungen', icon: FileText },
  { to: '/write-invoice', label: 'Rechnung schreiben', icon: FilePlus2 },
  { to: '/invoice-designer', label: 'Template Designer', icon: PenSquare },
  { to: '/settings', label: 'Einstellungen', icon: Settings },
];

export function Sidebar() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggle = useAppStore((s) => s.toggleSidebar);
  const [version, setVersion] = useState('');

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion('0.1.0'));
  }, []);

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-all duration-300',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <Receipt className="h-6 w-6 shrink-0 text-primary" />
        {!collapsed && (
          <span className="text-lg font-semibold tracking-tight">Rechnungen</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              )
            }
          >
            <Icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-2">
        <button
          onClick={toggle}
          className="flex w-full items-center justify-center rounded-lg p-2 text-sidebar-foreground/50 hover:bg-sidebar-accent/50 transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
        {!collapsed && (
          <p className="mt-1 text-center text-xs text-muted-foreground">v{version}</p>
        )}
      </div>
    </aside>
  );
}
