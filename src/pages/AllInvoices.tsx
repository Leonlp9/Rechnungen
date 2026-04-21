import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '@/store';
import { getAllInvoices } from '@/lib/db';
import { InvoiceTable } from '@/components/invoices/InvoiceTable';
import { NewInvoiceDialog } from '@/components/invoices/NewInvoiceDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { FileText, Plus } from 'lucide-react';

export default function AllInvoices() {
  const invoices = useAppStore((s) => s.invoices);
  const setInvoices = useAppStore((s) => s.setInvoices);
  // Skip loading skeleton if invoices are already cached in the store
  const [loading, setLoading] = useState(invoices.length === 0);
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Alle Rechnungen</h1>

      {invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <FileText className="h-10 w-10 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-semibold">Noch keine Rechnungen</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Lade eine PDF hoch, um deine erste Rechnung zu erfassen. Die KI hilft dir dabei, alle Felder automatisch auszufüllen.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Erste Rechnung erstellen
          </Button>
        </div>
      ) : (
        <div data-tutorial="invoices-table">
          <InvoiceTable invoices={invoices} showYearFilter={true} />
        </div>
      )}

      <NewInvoiceDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setImportPdfPath(undefined); }}
        initialPdfPath={importPdfPath}
        initialPdfName={importPdfName}
      />
    </div>
  );
}
