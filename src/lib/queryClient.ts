// Zentrale React-Query-Instanz.
//
// Liegt bewusst außerhalb von main.tsx, damit auch Nicht-React-Code
// (z. B. der Cloud-Sync) Caches invalidieren kann, wenn von anderen
// Geräten neue Daten eingetroffen sind.

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
