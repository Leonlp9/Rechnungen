import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { NewInvoiceDialog } from '@/components/invoices/NewInvoiceDialog';
import { ExportDialog } from '@/components/invoices/ExportDialog';
import { DraftsPanel } from '@/components/invoices/DraftsPanel';
import { GlobalSearch } from '@/components/search/GlobalSearch';
import { AIChatFloat } from '@/components/chat/AIChatFloat';
import { MobileAIChat } from '@/components/chat/MobileAIChat';
import { useAppStore } from '@/store';
import { getAllDrafts } from '@/lib/db';
import { getAbsolutePdfPath } from '@/lib/pdf';
import { WelcomeScreen } from '@/components/tutorial/WelcomeScreen';
import { TutorialOverlay } from '@/components/tutorial/TutorialOverlay';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { ShortcutsModal } from '@/components/ShortcutsModal';
import { initAutoSync } from '@/lib/sync';
import { useIsMobile } from '@/hooks/useIsMobile';
import { MobileNav } from './MobileNav';
import { MobileTopbar } from './MobileTopbar';
import { MobileMoreSheet } from './MobileMoreSheet';

/** Seiten, die ihre Höhe selbst verwalten (eigenes Scrolling im Inneren). */
const FULL_HEIGHT_ROUTES = ['/invoice-designer', '/write-invoice', '/lists', '/gmail', '/calendar', '/settings'];

/** Dasselbe für das Handy – hier scrollt sonst Seite UND Inhalt gleichzeitig. */
const MOBILE_FULL_HEIGHT_ROUTES = ['/settings', '/lists', '/help', '/write-invoice', '/invoice-designer', '/invoices/'];

export function AppLayout() {
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  const isMobile = useIsMobile();
  const fullHeight = isMobile
    ? MOBILE_FULL_HEIGHT_ROUTES.some((r) => pathname.startsWith(r))
    : FULL_HEIGHT_ROUTES.some((r) => pathname.startsWith(r));
  const searchOpen = useAppStore((s) => s.searchOpen);
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const setDrafts = useAppStore((s) => s.setDrafts);

  useKeyboardShortcuts(() => setShortcutsOpen(true));

  // Cloud-Sync (falls konfiguriert) im Hintergrund starten
  useEffect(() => {
    void initAutoSync();
  }, []);

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

  // Beim Seitenwechsel das Mehr-Menü schließen
  useEffect(() => { setMoreOpen(false); }, [pathname]);

  // Escape schließt die Suche
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setSearchOpen]);

  return (
    <div className="flex h-dvh overflow-hidden">
      {!isMobile && <Sidebar />}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {isMobile ? (
          <MobileTopbar
            onNewInvoice={() => setNewInvoiceOpen(true)}
            onDrafts={() => setDraftsOpen(true)}
            onExport={() => setExportOpen(true)}
          />
        ) : (
          <Topbar
            onNewInvoice={() => setNewInvoiceOpen(true)}
            onExport={() => setExportOpen(true)}
            onDrafts={() => setDraftsOpen(true)}
          />
        )}
        <main
          className={
            fullHeight
              ? 'min-h-0 flex-1 overflow-hidden'
              : isMobile
                ? 'min-h-0 flex-1 overflow-x-hidden overflow-y-auto'
                : 'flex-1 overflow-y-auto p-6'
          }
          style={
            isMobile && !fullHeight
              ? {
                  // Safe-Areas links/rechts; oben/unten übernehmen Topbar und Nav
                  padding: '0.75rem',
                  paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 0.75rem)',
                  paddingRight: 'calc(env(safe-area-inset-right, 0px) + 0.75rem)',
                }
              : undefined
          }
        >
          <Outlet />
        </main>
        {isMobile && <MobileNav onOpenMore={() => setMoreOpen(true)} moreOpen={moreOpen} />}
      </div>
      {isMobile && <MobileAIChat />}
      {isMobile && (
        <MobileMoreSheet
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          onNewInvoice={() => setNewInvoiceOpen(true)}
          onDrafts={() => setDraftsOpen(true)}
          onExport={() => setExportOpen(true)}
        />
      )}
      <NewInvoiceDialog open={newInvoiceOpen} onClose={() => setNewInvoiceOpen(false)} />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
      <DraftsPanel open={draftsOpen} onClose={() => setDraftsOpen(false)} />
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      {/* Desktop-only: schwebender KI-Chat und Tutorial passen nicht aufs Handy */}
      {!isMobile && <AIChatFloat />}
      {!isMobile && <WelcomeScreen />}
      {!isMobile && <TutorialOverlay />}
    </div>
  );
}
