import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import AllInvoices from "@/pages/AllInvoices";
import SettingsPage from "@/pages/Settings";
import InvoiceDetail from "@/components/invoices/InvoiceDetail";
import WriteInvoice from "@/pages/WriteInvoice";
import InvoiceDesigner from "@/pages/InvoiceDesigner";
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
      { path: "/settings", element: <SettingsPage /> },
    ],
  },
]);

function App() {
  const [updateState, setUpdateState] = useState<UpdateState>({
    open: false, version: '', phase: 'confirm', progress: 0,
  });
  const darkMode = useAppStore((s) => s.darkMode);
  const autoUpdateBuiltins = useTemplateStore((s) => s.autoUpdateBuiltins);

  // Upgrade outdated builtin templates (e.g. missing items element) on every mount
  useEffect(() => { autoUpdateBuiltins(); }, []);

  useEffect(() => {
    registerUpdateSetter((patch) => setUpdateState((s) => ({ ...s, ...patch })));
  }, []);

  // dark-Klasse auf <html> setzen + Titelleiste synchronisieren
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    getCurrentWindow().setTheme(darkMode ? 'dark' : 'light').catch(() => {});
  }, [darkMode]);

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
