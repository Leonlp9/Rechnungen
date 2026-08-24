import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, ReceiptText, Camera, Menu, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

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
const SLOT = 'flex h-10 w-10 items-center justify-center rounded-full transition-colors';
const ITEM = 'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors';

interface Props {
  onOpenMore: () => void;
  moreOpen: boolean;
}

export function MobileNav({ onOpenMore, moreOpen }: Props) {
  const { pathname } = useLocation();
  // Seiten außerhalb der vier Tabs → „Mehr" als aktiv markieren
  const onOtherPage = !ITEMS.some((i) => (i.exact ? pathname === i.to : pathname.startsWith(i.to)));

  return (
    <nav
      className="z-40 flex shrink-0 items-stretch border-t border-border bg-background/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {ITEMS.map((item) => {
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
            {({ isActive }) => {
              const active = isActive && !moreOpen;
              return (
                <>
                  <span
                    className={cn(
                      SLOT,
                      item.primary
                        // Im Light-Mode schwarz, im Dark-Mode hell
                        ? 'bg-foreground text-background shadow-sm'
                        : active && 'bg-primary/10',
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
        <span className={cn(SLOT, (moreOpen || onOtherPage) && 'bg-primary/10')}>
          <Menu className="h-5 w-5" />
        </span>
        <span>Mehr</span>
      </button>
    </nav>
  );
}
