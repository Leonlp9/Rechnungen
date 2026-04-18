import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '@/store';
import { getAllInvoices } from '@/lib/db';
import { InvoiceTable } from '@/components/invoices/InvoiceTable';
import { NewInvoiceDialog } from '@/components/invoices/NewInvoiceDialog';

export default function AllInvoices() {
  const invoices = useAppStore((s) => s.invoices);
  const setInvoices = useAppStore((s) => s.setInvoices);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  // Support Gmail import: navigate('/invoices', { state: { pdf_path, pdf_name } })
  const importState = location.state as { pdf_path?: string; pdf_name?: string } | null;
  const [dialogOpen, setDialogOpen] = useState(() => !!importState?.pdf_path);
  const [importPdfPath, setImportPdfPath] = useState<string | undefined>(importState?.pdf_path);
  const [importPdfName, setImportPdfName] = useState<string | undefined>(importState?.pdf_name);

  useEffect(() => {
    if (importState?.pdf_path) {
      setImportPdfPath(importState.pdf_path);
      setImportPdfName(importState.pdf_name);
      setDialogOpen(true);
      // Clear state so refresh doesn't re-open
      window.history.replaceState({}, '');
    }
  }, [importState?.pdf_path]);

  useEffect(() => {
    getAllInvoices()
      .then((data) => { setInvoices(data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Lade...</div>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Alle Rechnungen</h1>
      <InvoiceTable invoices={invoices} showYearFilter={true} />
      <NewInvoiceDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setImportPdfPath(undefined); }}
        initialPdfPath={importPdfPath}
        initialPdfName={importPdfName}
      />
    </div>
  );
}
