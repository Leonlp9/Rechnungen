import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DashboardNode } from '@/types/dashboard';
import { DEFAULT_LAYOUT } from '@/types/dashboard';

interface DashboardStore {
  layout: DashboardNode;
  setLayout: (layout: DashboardNode) => void;
  resetLayout: () => void;
}

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set) => ({
      layout: DEFAULT_LAYOUT,
      setLayout: (layout) => set({ layout }),
      resetLayout: () => set({ layout: DEFAULT_LAYOUT }),
    }),
    {
      name: 'dashboard-layout-v4',
    },
  ),
);

