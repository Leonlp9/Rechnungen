import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/store';
import { getAllInvoices } from '@/lib/db';
import { InvoiceTable } from '@/components/invoices/InvoiceTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CATEGORIES, CATEGORY_LABELS } from '@/types';

export default function ByCategory() {
  const invoices = useAppStore((s) => s.invoices);
  const setInvoices = useAppStore((s) => s.setInvoices);
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState<string>(CATEGORIES[0]);

  useEffect(() => {
    getAllInvoices().then(setInvoices).catch(console.error).finally(() => setLoading(false));
  }, [setInvoices]);

  const filtered = useMemo(
    () => invoices.filter((i) => i.category === selectedCat),
    [invoices, selectedCat]
  );

  if (loading) return <div className="flex items-center justify-center h-full text-muted-foreground">Lade...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nach Kategorie</h1>
      <Tabs value={selectedCat} onValueChange={setSelectedCat}>
        <TabsList className="flex-wrap h-auto gap-1">
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c} value={c}>{CATEGORY_LABELS[c]}</TabsTrigger>
          ))}
        </TabsList>
        {CATEGORIES.map((c) => (
          <TabsContent key={c} value={c}>
            <InvoiceTable invoices={filtered} showFilters={false} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
