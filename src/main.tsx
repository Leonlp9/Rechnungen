import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from "./App";
import { getDb } from "./lib/db";
import { checkForUpdates } from "./lib/updater";
import { invoke } from "@tauri-apps/api/core";

// Initialize DB on startup
getDb().catch(console.error);

// Clean up invoice temp files older than 1 day on startup (all files there are temporary)
invoke('cleanup_old_invoice_files', { days: 1 }).catch(() => {});

// Apply persisted dark mode BEFORE first render to avoid flash
try {
  const stored = localStorage.getItem('rechnungs-manager-settings');
  if (stored) {
    const parsed = JSON.parse(stored) as { state?: { darkMode?: boolean } };
    if (parsed?.state?.darkMode) {
      document.documentElement.classList.add('dark');
    }
  }
} catch { /* ignore */ }

// Check for updates silently on startup
setTimeout(() => checkForUpdates(true), 3000);

// Disable browser context menu globally
document.addEventListener('contextmenu', (e) => e.preventDefault());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>,
);
