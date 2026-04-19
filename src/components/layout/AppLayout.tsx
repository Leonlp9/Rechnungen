import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { NewInvoiceDialog } from '@/components/invoices/NewInvoiceDialog';
import { ExportDialog } from '@/components/invoices/ExportDialog';
import { DraftsPanel } from '@/components/invoices/DraftsPanel';
import { GlobalSearch } from '@/components/search/GlobalSearch';
import { AIChatFloat } from '@/components/chat/AIChatFloat';
import { useAppStore } from '@/store';
import { getAllDrafts } from '@/lib/db';
import { getAbsolutePdfPath } from '@/lib/pdf';
import { WelcomeScreen } from '@/components/tutorial/WelcomeScreen';
import { TutorialOverlay } from '@/components/tutorial/TutorialOverlay';

const FULL_HEIGHT_ROUTES = ['/invoice-designer', '/write-invoice', '/lists', '/gmail', '/calendar'];

export function AppLayout() {
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const { pathname } = useLocation();
  const fullHeight = FULL_HEIGHT_ROUTES.some((r) => pathname.startsWith(r));
  const searchOpen = useAppStore((s) => s.searchOpen);
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const setDrafts = useAppStore((s) => s.setDrafts);

  // Entwürfe aus DB laden
  useEffect(() => {
    getAllDrafts().then(async (rows) => {
      const drafts = await Promise.all(rows.map(async (r) => ({
        id: r.id,
        filePath: await getAbsolutePdfPath(r.file_path),
        fileName: r.file_name,
        addedAt: r.added_at,
        relativePath: r.file_path,
      })));
      setDrafts(drafts);
    }).catch(() => {});
  }, []);

  // Ctrl+K / Strg+K öffnet die Suche global
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setSearchOpen]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          onNewInvoice={() => setNewInvoiceOpen(true)}
          onExport={() => setExportOpen(true)}
          onDrafts={() => setDraftsOpen(true)}
        />
        <main className={fullHeight ? 'flex-1 overflow-hidden' : 'flex-1 overflow-y-auto p-6'}>
          <Outlet />
        </main>
      </div>
      <NewInvoiceDialog open={newInvoiceOpen} onClose={() => setNewInvoiceOpen(false)} />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
      <DraftsPanel open={draftsOpen} onClose={() => setDraftsOpen(false)} />
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <AIChatFloat />
      <WelcomeScreen />
      <TutorialOverlay />
    </div>
  );
}
