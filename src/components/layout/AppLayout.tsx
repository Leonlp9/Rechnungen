import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { NewInvoiceDialog } from '@/components/invoices/NewInvoiceDialog';
import { ExportDialog } from '@/components/invoices/ExportDialog';

export function AppLayout() {
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          onNewInvoice={() => setNewInvoiceOpen(true)}
          onExport={() => setExportOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <NewInvoiceDialog open={newInvoiceOpen} onClose={() => setNewInvoiceOpen(false)} />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
