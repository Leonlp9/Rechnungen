import { useMemo } from 'react';
import { useAppStore } from '@/store';
import { getCategoriesForBranche } from '@/types';
import type { InvoiceType, Category } from '@/types';

/**
 * Custom Hook für Kategorie-Listen. Vermeidet getState()-Aufrufe in JSX
 * und sorgt für automatische Re-Renders bei Änderung des Branchenprofils.
 */
export function useCategoryList(type: InvoiceType, currentCategory?: Category) {
  const branchenprofil = useAppStore((s) => s.branchenprofil);
  return useMemo(
    () => getCategoriesForBranche(type, branchenprofil, currentCategory),
    [type, branchenprofil, currentCategory],
  );
}

