import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import AllInvoices from "@/pages/AllInvoices";
import ByYear from "@/pages/ByYear";
import ByCategory from "@/pages/ByCategory";
import SettingsPage from "@/pages/Settings";
import InvoiceDetail from "@/components/invoices/InvoiceDetail";
import { Toaster } from "@/components/ui/sonner";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/invoices" element={<AllInvoices />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
          <Route path="/by-year" element={<ByYear />} />
          <Route path="/by-category" element={<ByCategory />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
      <Toaster richColors position="bottom-right" />
    </BrowserRouter>
  );
}

export default App;
