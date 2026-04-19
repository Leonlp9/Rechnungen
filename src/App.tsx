import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import AllInvoices from "@/pages/AllInvoices";
import SettingsPage from "@/pages/Settings";
import InvoiceDetail from "@/components/invoices/InvoiceDetail";
import WriteInvoice from "@/pages/WriteInvoice";
import InvoiceDesigner from "@/pages/InvoiceDesigner";
import HelpPage from "@/pages/Help";
import ListsPage from "@/pages/Lists";
import GmailPage from "@/pages/Gmail";
import { Toaster } from "@/components/ui/sonner";
import { UpdateDialog } from "@/components/UpdateDialog";
import { registerUpdateSetter, startDownload, type UpdateState } from "@/lib/updater";
import { useAppStore } from "@/store";
import { useTemplateStore } from "@/store/templateStore";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { importBackup } from "@/lib/backup";
import { toast } from "sonner";
import "./App.css";

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <Dashboard /> },
      { path: "/invoices", element: <AllInvoices /> },
      { path: "/invoices/:id", element: <InvoiceDetail /> },
      { path: "/write-invoice", element: <WriteInvoice /> },
      { path: "/invoice-designer", element: <InvoiceDesigner /> },
      { path: "/lists", element: <ListsPage /> },
      { path: "/gmail", element: <GmailPage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "/help", element: <HelpPage /> },
    ],
  },
]);

function App() {
  const [updateState, setUpdateState] = useState<UpdateState>({
    open: false, version: '', phase: 'confirm', progress: 0,
  });
  const [pendingBackupPath, setPendingBackupPath] = useState<string | null>(null);
  const darkMode = useAppStore((s) => s.darkMode);
  const theme = useAppStore((s) => s.theme);
  const animations = useAppStore((s) => s.animations);
  const autoUpdateBuiltins = useTemplateStore((s) => s.autoUpdateBuiltins);

  // Upgrade outdated builtin templates (e.g. missing items element) on every mount
  useEffect(() => { autoUpdateBuiltins(); }, []);

  // Check if app was opened with a .rmbackup file (double-click)
  useEffect(() => {
    invoke<string | null>('get_pending_backup_path').then((path) => {
      if (path) setPendingBackupPath(path);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    registerUpdateSetter((patch) => setUpdateState((s) => ({ ...s, ...patch })));
  }, []);

  // dark-Klasse auf <html> setzen + Titelleiste synchronisieren + Theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    // Theme-Klassen: alle entfernen, dann aktives setzen
    document.documentElement.classList.remove('liquid-glass', 'aurora-borealis', 'crimson-dusk', 'zinc', 'stone', 'chroma');
    if (theme !== 'default') {
      document.documentElement.classList.add(theme);
    }
    getCurrentWindow().setTheme(darkMode ? 'dark' : 'light').catch(() => {});
  }, [darkMode, theme]);

  // Animationen-Klasse synchronisieren
  useEffect(() => {
    document.documentElement.classList.toggle('animations-enabled', animations);
  }, [animations]);

  return (
    <>
      <RouterProvider router={router} />
      <Toaster richColors position="bottom-right" />
      {updateState.open && (
        <UpdateDialog
          version={updateState.version}
          releaseNotes={updateState.releaseNotes}
          phase={updateState.phase}
          progress={updateState.progress}
          onConfirm={() => startDownload()}
          onCancel={() => setUpdateState((s) => ({ ...s, open: false }))}
        />
      )}
      {pendingBackupPath && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-background border border-border rounded-2xl shadow-2xl p-6 max-w-md w-full space-y-4 mx-4">
            <h2 className="text-lg font-bold">Backup wiederherstellen?</h2>
            <p className="text-sm text-muted-foreground">
              Du hast eine <span className="font-mono font-medium">.rmbackup</span>-Datei geöffnet. Soll das Backup eingespielt werden?<br />
              <span className="text-destructive font-medium">Alle aktuellen Daten werden überschrieben.</span>
            </p>
            <p className="text-xs text-muted-foreground break-all font-mono bg-muted px-2 py-1 rounded">{pendingBackupPath}</p>
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
                onClick={() => setPendingBackupPath(null)}
              >
                Abbrechen
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
                onClick={async () => {
                  const path = pendingBackupPath;
                  setPendingBackupPath(null);
                  const result = await importBackup(path);
                  if (result.success) {
                    toast.success('Backup erfolgreich eingespielt! Die App wird neu geladen…');
                    setTimeout(() => window.location.reload(), 1500);
                  } else if (result.error) {
                    toast.error('Import fehlgeschlagen: ' + result.error);
                  }
                }}
              >
                Backup einspielen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


export default App;
