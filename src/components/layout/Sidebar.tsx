import { NavLink, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { DESKTOP_NAV_ITEMS, navItemsFor } from './navItems';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';

function useNavHistory() {
  const location = useLocation();
  const navType = useNavigationType(); // 'PUSH' | 'POP' | 'REPLACE'

  const getHistoryIdx = () => (window.history.state as { idx?: number })?.idx ?? 0;

  const [state, setState] = useState(() => {
    const idx = getHistoryIdx();
    return { idx, maxIdx: idx };
  });

  useEffect(() => {
    const currentIdx = getHistoryIdx();
    if (navType === 'PUSH') {
      // Push navigation clears the forward stack
      setState({ idx: currentIdx, maxIdx: currentIdx });
    } else if (navType === 'POP') {
      // POP (back or forward) – preserve maxIdx so forward stays available
      setState((prev) => ({
        idx: currentIdx,
        maxIdx: Math.max(prev.maxIdx, currentIdx),
      }));
    } else {
      // REPLACE – same idx, only path changes, don't touch maxIdx
      setState((prev) => ({ ...prev, idx: currentIdx }));
    }
  }, [location, navType]); // eslint-disable-line react-hooks/exhaustive-deps

  return { canGoBack: state.idx > 0, canGoForward: state.idx < state.maxIdx };
}


export function Sidebar() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggle = useAppStore((s) => s.toggleSidebar);
  const hiddenNavItems = useAppStore((s) => s.hiddenNavItems);
  const rechtsform = useAppStore((s) => s.rechtsform);
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
        <img src="/klevr.svg" alt="Klevr" className="h-6 w-6 shrink-0" />
        {!collapsed && (
          <>
            <span className="text-lg font-semibold tracking-tight flex-1">Klevr</span>
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
        {navItemsFor(rechtsform, DESKTOP_NAV_ITEMS).filter(({ to }) => !hiddenNavItems.includes(to)).map(({ to, label, icon: Icon, tutorialId }) => (
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
