import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Receipt,
  FilePlus2,
  PenSquare,
  ArrowLeft,
  ArrowRight,
  HelpCircle,
  ListTodo,
  Mail,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';

function useNavHistory() {
  const location = useLocation();
  const [idx, setIdx] = useState(() => (window.history.state as { idx?: number })?.idx ?? 0);
  const [maxIdx, setMaxIdx] = useState(() => (window.history.state as { idx?: number })?.idx ?? 0);
  const isPop = useRef(false);

  useEffect(() => {
    const onPop = () => {
      isPop.current = true;
      const newIdx = (window.history.state as { idx?: number })?.idx ?? 0;
      setIdx(newIdx);
      setMaxIdx((prev) => Math.max(prev, newIdx));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const newIdx = (window.history.state as { idx?: number })?.idx ?? 0;
    if (isPop.current) {
      isPop.current = false;
    } else {
      // push navigation → forward history cleared
      setIdx(newIdx);
      setMaxIdx(newIdx);
    }
  }, [location]);

  return { canGoBack: idx > 0, canGoForward: idx < maxIdx };
}

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, tutorialId: 'nav-dashboard' },
  { to: '/invoices', label: 'Alle Rechnungen', icon: FileText, tutorialId: 'nav-invoices' },
  { to: '/write-invoice', label: 'Rechnung schreiben', icon: FilePlus2, tutorialId: 'nav-write-invoice' },
  { to: '/invoice-designer', label: 'Template Designer', icon: PenSquare, tutorialId: 'nav-invoice-designer' },
  { to: '/lists', label: 'Listen', icon: ListTodo, tutorialId: 'nav-lists' },
  { to: '/gmail', label: 'Mail', icon: Mail, tutorialId: 'nav-gmail' },
  { to: '/settings', label: 'Einstellungen', icon: Settings, tutorialId: 'nav-settings' },
  { to: '/help', label: 'Hilfe', icon: HelpCircle, tutorialId: 'nav-help' },
];

export function Sidebar() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggle = useAppStore((s) => s.toggleSidebar);
  const hiddenNavItems = useAppStore((s) => s.hiddenNavItems);
  const [version, setVersion] = useState('');
  const navigate = useNavigate();
  const { canGoBack, canGoForward } = useNavHistory();

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
          <>
            <span className="text-lg font-semibold tracking-tight flex-1">Rechnungen</span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => navigate(-1)}
                disabled={!canGoBack}
                title="Zurück"
                className="rounded p-1 text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => navigate(1)}
                disabled={!canGoForward}
                title="Vor"
                className="rounded p-1 text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-2">
        {NAV_ITEMS.filter(({ to }) => !hiddenNavItems.includes(to)).map(({ to, label, icon: Icon, tutorialId }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            data-tutorial={tutorialId}
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
