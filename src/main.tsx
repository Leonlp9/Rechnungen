import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { getDb } from "./lib/db";
import { checkForUpdates } from "./lib/updater";

// Initialize DB on startup
getDb().catch(console.error);

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

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
