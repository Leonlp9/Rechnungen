import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/store';
import { getAllInvoices } from '@/lib/db';
import { InvoiceTable } from '@/components/invoices/InvoiceTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ByYear() {
  const invoices = useAppStore((s) => s.invoices);
  const setInvoices = useAppStore((s) => s.setInvoices);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllInvoices().then(setInvoices).catch(console.error).finally(() => setLoading(false));
  }, [setInvoices]);

  const years = useMemo(() => {
    const s = new Set(invoices.map((i) => i.year));
    s.add(new Date().getFullYear());
    return Array.from(s).sort((a, b) => b - a);
  }, [invoices]);

  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));

  const filtered = useMemo(
    () => invoices.filter((i) => i.year === Number(selectedYear)),
    [invoices, selectedYear]
  );

  if (loading) return <div className="flex items-center justify-center h-full text-muted-foreground">Lade...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nach Jahr</h1>
      <Tabs value={selectedYear} onValueChange={setSelectedYear}>
        <TabsList>
          {years.map((y) => (
            <TabsTrigger key={y} value={String(y)}>{y}</TabsTrigger>
          ))}
        </TabsList>
        {years.map((y) => (
          <TabsContent key={y} value={String(y)}>
            <InvoiceTable invoices={filtered} showFilters={false} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
