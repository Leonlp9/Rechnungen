import "./lib/tauriMock"; // Dev-only, no-op in der echten App
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from "./App";
import { getDb } from "./lib/db";
import { checkForUpdates } from "./lib/updater";
import { invoke } from "@tauri-apps/api/core";
import { queryClient } from "./lib/queryClient";

// Initialize DB on startup
getDb().catch(console.error);

// Clean up invoice temp files older than 1 day on startup (all files there are temporary)
invoke('cleanup_old_invoice_files', { days: 1 }).catch(() => {});

// Farbgebung vor dem ersten Bild setzen, sonst blitzt kurz die falsche auf.
// Im Modus „Automatisch" zählt, was das System gerade möchte – der zuletzt
// gespeicherte Wert kann über Nacht veraltet sein.
try {
  const stored = localStorage.getItem('Klevr-settings');
  if (stored) {
    const parsed = JSON.parse(stored) as { state?: { darkMode?: boolean; themeMode?: string } };
    const mode = parsed?.state?.themeMode;
    const dark = mode === 'auto'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : mode === 'dark' || (mode === undefined && parsed?.state?.darkMode);
    if (dark) document.documentElement.classList.add('dark');
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    // Erster Start: dem System folgen.
    document.documentElement.classList.add('dark');
  }
} catch { /* ignore */ }

// Check for updates silently on startup
setTimeout(() => checkForUpdates(true), 3000);

// Disable browser context menu globally
document.addEventListener('contextmenu', (e) => e.preventDefault());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>,
);
