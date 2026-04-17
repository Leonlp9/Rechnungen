import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/store';
import { getAllInvoices } from '@/lib/db';
import { InvoiceTable } from '@/components/invoices/InvoiceTable';

export default function AllInvoices() {
  const invoices = useAppStore((s) => s.invoices);
  const setInvoices = useAppStore((s) => s.setInvoices);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  useEffect(() => {
    getAllInvoices()
      .then((data) => {
        setInvoices(data);
        // default to current year if available, else latest
        const curYear = new Date().getFullYear();
        const years = Array.from(new Set(data.map((i) => i.year))).sort((a, b) => b - a);
        setSelectedYear(years.includes(curYear) ? curYear : (years[0] ?? curYear));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [setInvoices]);

  const years = useMemo(() => {
    const s = new Set(invoices.map((i) => i.year));
    s.add(new Date().getFullYear());
    return Array.from(s).sort((a, b) => b - a);
  }, [invoices]);

  const filtered = useMemo(
    () => selectedYear ? invoices.filter((i) => i.year === selectedYear) : invoices,
    [invoices, selectedYear]
  );

  if (loading) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Lade...</div>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Alle Rechnungen</h1>

      {/* Jahr-Tabs */}
      <div className="flex gap-1 border-b border-border">
        {years.map((y) => (
          <button
            key={y}
            onClick={() => setSelectedYear(y)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              selectedYear === y
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {y}
          </button>
        ))}
        <button
          onClick={() => setSelectedYear(null)}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            selectedYear === null
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Alle Jahre
        </button>
      </div>

      <InvoiceTable invoices={filtered} showYearFilter={false} />
    </div>
  );
}
