import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, ReceiptText, Camera, Menu, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store';
import { NAV_ITEMS } from './navItems';

const ITEMS = [
  { to: '/', label: 'Start', icon: LayoutDashboard, exact: true },
  { to: '/invoices', label: 'Belege', icon: ReceiptText },
  // Mittig und hervorgehoben – die Hauptaktion auf dem Handy
  { to: '/scan', label: 'Scannen', icon: Camera, primary: true },
  { to: '/steuerbericht', label: 'Steuer', icon: Receipt },
];

/**
 * Untere Navigationsleiste. Kein `fixed` – sie ist ein regulärer Flex-Nachbar
 * des Inhalts. Dadurch bekommt der Scrollbereich exakt die restliche Höhe und
 * es entsteht kein leerer Bereich unter der Seite.
 *
 * Alle fünf Einträge haben dieselbe Geometrie: ein 40-px-Kreis als Icon-Slot,
 * darunter das Label. Nur die Füllung unterscheidet sich – so bleibt die
 * hervorgehobene Mitte optisch auf einer Linie mit den übrigen Icons.
 */
/** Gehört die Seite zum anderen Status? (siehe navItems) */
function isFremd(to: string, rechtsform: string): boolean {
  const eintrag = NAV_ITEMS.find((i) => i.to === to);
  if (!eintrag?.fuer) return false;
  return eintrag.fuer !== (rechtsform === 'angestellt' ? 'angestellt' : 'selbststaendig');
}

const SLOT = 'flex h-10 w-10 items-center justify-center rounded-full transition-colors';
const ITEM = 'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors';

interface Props {
  onOpenMore: () => void;
  moreOpen: boolean;
}

export function MobileNav({ onOpenMore, moreOpen }: Props) {
  const { pathname } = useLocation();
  const hiddenNavItems = useAppStore((s) => s.hiddenNavItems);
  const rechtsform = useAppStore((s) => s.rechtsform);

  // Was in den Einstellungen ausgeblendet wurde, gehört auch hier unten nicht
  // hin – sonst führt die Leiste auf Seiten, die es für den Nutzer nicht mehr
  // gibt. Dasselbe gilt für Seiten, die zum jeweiligen Status nicht passen.
  // „Scannen" bleibt immer: Es ist die Hauptaktion der App auf dem Handy.
  const items = ITEMS.filter(
    (i) => i.primary || (!hiddenNavItems.includes(i.to) && !isFremd(i.to, rechtsform)),
  );
  // Seiten außerhalb der vier Tabs → „Mehr" als aktiv markieren
  const onOtherPage = !ITEMS.some((i) => (i.exact ? pathname === i.to : pathname.startsWith(i.to)));

  return (
    <nav
      data-mobile-nav
      className="z-40 flex shrink-0 items-stretch border-t border-border bg-background/95 backdrop-blur"
      // Als Variable statt als fester Innenabstand: So kann ein Theme, das
      // die Leiste schweben lässt oder anders staffelt, den Wert übernehmen.
      style={{ paddingBottom: 'var(--nav-safe-bottom, env(safe-area-inset-bottom, 0px))' }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) =>
              cn(
                ITEM,
                item.primary
                  ? 'text-foreground'
                  : isActive && !moreOpen
                    ? 'text-primary'
                    : 'text-muted-foreground',
              )
            }
          >
            {() => {
              return (
                <>
                  <span
                    className={cn(
                      SLOT,
                      // Nur die Hauptaktion bekommt eine Fläche. Der aktive Tab
                      // wird allein über die Farbe kenntlich – zwei
                      // Hervorhebungen nebeneinander wirkten unruhig.
                      item.primary && 'bg-foreground text-background shadow-sm',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className={cn(item.primary && 'font-semibold text-foreground')}>{item.label}</span>
                </>
              );
            }}
          </NavLink>
        );
      })}
      <button
        onClick={onOpenMore}
        aria-label="Mehr"
        className={cn(ITEM, moreOpen || onOtherPage ? 'text-primary' : 'text-muted-foreground')}
      >
        <span className={SLOT}>
          <Menu className="h-5 w-5" />
        </span>
        <span>Mehr</span>
      </button>
    </nav>
  );
}
