import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DashboardNode } from '@/types/dashboard';
import { DEFAULT_LAYOUT, DEFAULT_MOBILE_LAYOUT } from '@/types/dashboard';

interface DashboardStore {
  layout: DashboardNode;
  setLayout: (layout: DashboardNode) => void;
  resetLayout: () => void;
  /** Eigenes, frei anpassbares Layout fürs Handy (unabhängig vom Desktop) */
  mobileLayout: DashboardNode;
  setMobileLayout: (layout: DashboardNode) => void;
  resetMobileLayout: () => void;
  /** Merkt sich die aktive Seite jedes grid-pages-Knotens (nur Laufzeit, nicht persistiert) */
  activePageIds: Record<string, string>;
  setActivePageId: (nodeId: string, pageId: string) => void;
}

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set) => ({
      layout: DEFAULT_LAYOUT,
      setLayout: (layout) => set({ layout }),
      resetLayout: () => set({ layout: DEFAULT_LAYOUT }),
      mobileLayout: DEFAULT_MOBILE_LAYOUT,
      setMobileLayout: (mobileLayout) => set({ mobileLayout }),
      resetMobileLayout: () => set({ mobileLayout: DEFAULT_MOBILE_LAYOUT }),
      activePageIds: {},
      setActivePageId: (nodeId, pageId) =>
        set((s) => ({ activePageIds: { ...s.activePageIds, [nodeId]: pageId } })),
    }),
    {
      name: 'dashboard-layout-v5',
      // Nur die Layouts persistieren – activePageIds wird NICHT gespeichert
      partialize: (s) => ({ layout: s.layout, mobileLayout: s.mobileLayout }),
      // Ältere Stände kennen mobileLayout noch nicht → Standard nachziehen
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as object),
        mobileLayout:
          (persisted as Partial<DashboardStore> | undefined)?.mobileLayout ?? DEFAULT_MOBILE_LAYOUT,
      }),
    },
  ),
);
