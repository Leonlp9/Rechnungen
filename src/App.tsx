import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";

function App() {
  const [updateState, setUpdateState] = useState<UpdateState>({
    open: false, version: '', phase: 'confirm', progress: 0,
  });
  const darkMode = useAppStore((s) => s.darkMode);

  useEffect(() => {
    registerUpdateSetter((patch) => setUpdateState((s) => ({ ...s, ...patch })));
  }, []);

  // dark-Klasse auf <html> setzen + Titelleiste synchronisieren
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    getCurrentWindow().setTheme(darkMode ? 'dark' : 'light').catch(() => {});
  }, [darkMode]);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/invoices" element={<AllInvoices />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
          <Route path="/write-invoice" element={<WriteInvoice />} />
          <Route path="/invoice-designer" element={<InvoiceDesigner />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
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
    </BrowserRouter>
  );
}

export default App;
