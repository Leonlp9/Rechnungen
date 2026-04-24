import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DashboardNode } from '@/types/dashboard';
import { DEFAULT_LAYOUT } from '@/types/dashboard';

interface DashboardStore {
  layout: DashboardNode;
  setLayout: (layout: DashboardNode) => void;
  resetLayout: () => void;
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
      activePageIds: {},
      setActivePageId: (nodeId, pageId) =>
        set((s) => ({ activePageIds: { ...s.activePageIds, [nodeId]: pageId } })),
    }),
    {
      name: 'dashboard-layout-v5',
      // Nur das Layout persistieren – activePageIds wird NICHT gespeichert
      partialize: (s) => ({ layout: s.layout }),
    },
  ),
);

