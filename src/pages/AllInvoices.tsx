import { useEffect, useState } from 'react';
import { InvoiceTable } from '@/components/invoices/InvoiceTable';
import { useAppStore } from '@/store';
import { getAllInvoices } from '@/lib/db';

export default function AllInvoices() {
  const invoices = useAppStore((s) => s.invoices);
  const setInvoices = useAppStore((s) => s.setInvoices);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllInvoices()
      .then(setInvoices)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [setInvoices]);

  if (loading) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Lade...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Alle Rechnungen</h1>
      <InvoiceTable invoices={invoices} />
    </div>
  );
}
