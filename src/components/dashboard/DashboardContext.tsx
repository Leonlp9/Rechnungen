import { createContext, useContext } from 'react';
import type { DashboardData } from '@/hooks/useDashboardData';

export interface DashboardContextValue extends DashboardData {
  editMode: boolean;
}

export const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboardContext(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboardContext must be used inside DashboardContext.Provider');
  return ctx;
}

