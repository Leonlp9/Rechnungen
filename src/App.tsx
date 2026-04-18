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
import { Toaster } from "@/components/ui/sonner";
import { UpdateDialog } from "@/components/UpdateDialog";
import { registerUpdateSetter, startDownload, type UpdateState } from "@/lib/updater";
import { useAppStore } from "@/store";
import { useTemplateStore } from "@/store/templateStore";
import { getCurrentWindow } from "@tauri-apps/api/window";
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
      { path: "/settings", element: <SettingsPage /> },
      { path: "/help", element: <HelpPage /> },
    ],
  },
]);

function App() {
  const [updateState, setUpdateState] = useState<UpdateState>({
    open: false, version: '', phase: 'confirm', progress: 0,
  });
  const darkMode = useAppStore((s) => s.darkMode);
  const theme = useAppStore((s) => s.theme);
  const animations = useAppStore((s) => s.animations);
  const autoUpdateBuiltins = useTemplateStore((s) => s.autoUpdateBuiltins);

  // Upgrade outdated builtin templates (e.g. missing items element) on every mount
  useEffect(() => { autoUpdateBuiltins(); }, []);

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
    </>
  );
}


export default App;
