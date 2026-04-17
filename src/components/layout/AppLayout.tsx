import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { NewInvoiceDialog } from '@/components/invoices/NewInvoiceDialog';
import { ExportDialog } from '@/components/invoices/ExportDialog';

const FULL_HEIGHT_ROUTES = ['/invoice-designer', '/write-invoice'];

export function AppLayout() {
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const { pathname } = useLocation();
  const fullHeight = FULL_HEIGHT_ROUTES.some((r) => pathname.startsWith(r));

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          onNewInvoice={() => setNewInvoiceOpen(true)}
          onExport={() => setExportOpen(true)}
        />
        <main className={fullHeight ? 'flex-1 overflow-hidden' : 'flex-1 overflow-y-auto p-6'}>
          <Outlet />
        </main>
      </div>
      <NewInvoiceDialog open={newInvoiceOpen} onClose={() => setNewInvoiceOpen(false)} />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
