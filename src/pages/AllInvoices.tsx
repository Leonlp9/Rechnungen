import { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import { getAllInvoices } from '@/lib/db';
import { InvoiceTable } from '@/components/invoices/InvoiceTable';

export default function AllInvoices() {
  const invoices = useAppStore((s) => s.invoices);
  const setInvoices = useAppStore((s) => s.setInvoices);
  const [loading, setLoading] = useState(true);

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
    </div>
  );
}
