import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useInvoices } from '@/hooks/useInvoices';
import { fmtCurrency } from '@/lib/utils';
import { useAppStore } from '@/store';
import {
  getAllBankTransactions, saveBankTransactions, deleteAllBankTransactions,
  deleteBankTransaction, updateBankTransactionMatch,
  type BankTransactionRow,
} from '@/lib/db';
import {
  Upload, Landmark, CheckCircle, Trash2,
  X, ArrowDownLeft, ArrowUpRight,
} from 'lucide-react';

interface ImportedTransaction {
  booking_date: string;
  value_date: string;
  amount: number;
  currency: string;
  creditor_name: string | null;
  debtor_name: string | null;
  remittance_info: string;
  transaction_id: string;
  source_file?: string | null;
}

export default function BankImportPage() {
  const { data: invoices = [] } = useInvoices();
  const [transactions, setTransactions] = useState<BankTransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<BankTransactionRow | null>(null);
  const privacyMode = useAppStore((s) => s.privacyMode);

  const loadTransactions = useCallback(async () => {
    try {
      const rows = await getAllBankTransactions();
      setTransactions(rows);
    } catch (e) {
      toast.error('Transaktionen konnten nicht geladen werden: ' + String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  const handleImport = async () => {
    const files = await open({
      title: 'Bankumsätze importieren',
      multiple: true,
      filters: [
        { name: 'Bankdateien', extensions: ['xml', 'csv', 'sta', 'mt940', 'txt', 'zip'] },
      ],
    });
    if (!files) return;
    const filePaths = Array.isArray(files) ? files : [files];
    if (filePaths.length === 0) return;

    setImporting(true);
    try {
      const result = await invoke<{ transactions: ImportedTransaction[]; errors: string[] }>(
        'import_bank_statements_batch',
        { filePaths },
      );

      if (result.transactions.length === 0) {
        toast.error('Keine Transaktionen gefunden');
        return;
      }

      // Auto-match
      const matchMap = new Map<string, string>();
      result.transactions.forEach((tx) => {
        const candidate = invoices.find((inv) => {
          const grossMatch = Math.abs(Math.abs(inv.brutto) - Math.abs(tx.amount)) < 0.01;
          const payoutMatch = Math.abs(Math.abs(inv.brutto - (inv.fee ?? 0)) - Math.abs(tx.amount)) < 0.01;
          const amountMatch = grossMatch || payoutMatch;
          const dateClose = Math.abs(new Date(inv.date).getTime() - new Date(tx.booking_date).getTime()) < 14 * 86400_000;
          return amountMatch && dateClose;
        });
        if (candidate) matchMap.set(tx.transaction_id, candidate.id);
      });

      const batchId = `import-${Date.now()}`;
      const toSave = result.transactions.map((tx) => ({
        transaction_id: tx.transaction_id,
        booking_date: tx.booking_date,
        value_date: tx.value_date || '',
        amount: tx.amount,
        currency: tx.currency || 'EUR',
        creditor_name: tx.creditor_name,
        debtor_name: tx.debtor_name,
        remittance_info: tx.remittance_info || '',
        source_file: tx.source_file || null,
        matched_invoice_id: matchMap.get(tx.transaction_id) || null,
        import_batch: batchId,
      }));

      const saved = await saveBankTransactions(toSave, batchId);

      if (result.errors.length > 0) {
        toast.warning(`${saved} Transaktionen gespeichert, ${result.errors.length} Fehler`, {
          description: result.errors.join('\n'),
        });
      } else {
        const dupes = result.transactions.length - saved;
        const msg = dupes > 0
          ? `${saved} neue Transaktionen gespeichert (${dupes} Duplikate übersprungen)`
          : `${saved} Transaktionen gespeichert`;
        toast.success(msg);
      }

      await loadTransactions();
    } catch (e) {
      toast.error('Import fehlgeschlagen: ' + String(e));
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteSingle = async (id: string) => {
    try {
      await deleteBankTransaction(id);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      if (selected?.id === id) setSelected(null);
      toast.success('Transaktion gelöscht');
    } catch (e) {
      toast.error('Löschen fehlgeschlagen: ' + String(e));
    }
  };

  const handleDeleteAll = async () => {
    try {
      await deleteAllBankTransactions();
      setTransactions([]);
      setSelected(null);
      toast.success('Alle Transaktionen gelöscht');
    } catch (e) {
      toast.error('Löschen fehlgeschlagen: ' + String(e));
    }
  };

  const getMatchedInvoice = (tx: BankTransactionRow) => {
    if (!tx.matched_invoice_id) return null;
    return invoices.find((inv) => inv.id === tx.matched_invoice_id) ?? null;
  };

  const totalEinnahmen = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalAusgaben = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
  const matchedCount = transactions.filter((t) => t.matched_invoice_id).length;

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Landmark className="h-6 w-6" /> Bankimport
        </h1>
        <div className="flex gap-2">
          {transactions.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" /> Alle löschen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Alle Transaktionen löschen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {transactions.length} Transaktionen werden unwiderruflich gelöscht.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAll}>Löschen</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button onClick={handleImport} disabled={importing}>
            <Upload className="mr-2 h-4 w-4" />
            {importing ? 'Importiere…' : 'Dateien importieren'}
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Importiere Bankumsätze aus XML (CAMT.053), CSV, MT940 oder ZIP-Dateien. Du kannst mehrere Dateien gleichzeitig auswählen – der Dateityp wird automatisch erkannt.
      </p>

      {transactions.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Transaktionen</p>
              <p className="text-2xl font-bold">{transactions.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><ArrowDownLeft className="h-3 w-3 text-green-500" /> Einnahmen</p>
              <p className="text-2xl font-bold text-green-600">{fmtCurrency(totalEinnahmen, privacyMode)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><ArrowUpRight className="h-3 w-3 text-red-500" /> Ausgaben</p>
              <p className="text-2xl font-bold text-red-600">{fmtCurrency(totalAusgaben, privacyMode)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Zugeordnet</p>
              <p className="text-2xl font-bold">{matchedCount} / {transactions.length}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {transactions.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Datum</TableHead>
                  <TableHead className="w-[130px]">Betrag</TableHead>
                  <TableHead>Verwendungszweck</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[160px]">Zuordnung</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const matched = getMatchedInvoice(tx);
                  return (
                    <TableRow
                      key={tx.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelected(tx)}
                    >
                      <TableCell className="font-mono text-sm">{tx.booking_date}</TableCell>
                      <TableCell className={tx.amount > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                        {tx.amount > 0 ? '+' : ''}{fmtCurrency(tx.amount, privacyMode)}
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate text-sm" title={tx.remittance_info}>
                        {tx.remittance_info || '–'}
                      </TableCell>
                      <TableCell className="text-sm">{tx.creditor_name || tx.debtor_name || '–'}</TableCell>
                      <TableCell>
                        {matched ? (
                          <Badge variant="default" className="gap-1 text-xs">
                            <CheckCircle className="h-3 w-3" /> {matched.partner || matched.description}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Offen</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Transaktion löschen?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {tx.booking_date} · {fmtCurrency(tx.amount, false)} · {tx.creditor_name || tx.debtor_name || 'Unbekannt'}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteSingle(tx.id)}>Löschen</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Landmark className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Keine Transaktionen vorhanden</p>
            <p className="text-sm mt-1">Importiere Bankumsätze über den Button oben. Du kannst mehrere Dateien oder eine ZIP auswählen.</p>
          </CardContent>
        </Card>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selected && (
            <TransactionDetail
              tx={selected}
              matched={getMatchedInvoice(selected)}
              privacyMode={privacyMode}
              onDelete={() => handleDeleteSingle(selected.id)}
              onUnmatch={async () => {
                await updateBankTransactionMatch(selected.id, null);
                setTransactions((prev) => prev.map((t) =>
                  t.id === selected.id ? { ...t, matched_invoice_id: null } : t
                ));
                setSelected((prev) => prev ? { ...prev, matched_invoice_id: null } : null);
                toast.success('Zuordnung entfernt');
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function TransactionDetail({
  tx, matched, privacyMode, onDelete, onUnmatch,
}: {
  tx: BankTransactionRow;
  matched: import('@/types').Invoice | null;
  privacyMode: boolean;
  onDelete: () => void;
  onUnmatch: () => void;
}) {
  const isIncome = tx.amount > 0;
  const name = tx.creditor_name || tx.debtor_name;

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <div className={`p-2 rounded-full ${isIncome ? 'bg-green-100 dark:bg-green-900/40' : 'bg-red-100 dark:bg-red-900/40'}`}>
            {isIncome ? <ArrowDownLeft className="h-5 w-5 text-green-600" /> : <ArrowUpRight className="h-5 w-5 text-red-600" />}
          </div>
          <div>
            <span>{isIncome ? 'Eingang' : 'Ausgang'}</span>
            {name && <p className="text-sm font-normal text-muted-foreground">{name}</p>}
          </div>
        </SheetTitle>
        <SheetDescription className="sr-only">Transaktionsdetails</SheetDescription>
      </SheetHeader>

      <div className="mt-6 space-y-5">
        {/* Betrag */}
        <div className={`text-center py-5 rounded-xl border ${isIncome ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900' : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'}`}>
          <p className={`text-3xl font-bold tracking-tight ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
            {isIncome ? '+' : ''}{fmtCurrency(tx.amount, privacyMode)}
          </p>
        </div>

        {/* Infos */}
        <div className="rounded-xl border divide-y">
          <InfoRow label="Buchungsdatum" value={formatDate(tx.booking_date)} />
          {tx.value_date && <InfoRow label="Valutadatum" value={formatDate(tx.value_date)} />}
          {name && <InfoRow label={isIncome ? 'Auftraggeber' : 'Empfänger'} value={name} />}
          <InfoRow label="Währung" value={tx.currency} />
          {tx.source_file && <InfoRow label="Quelldatei" value={tx.source_file.split(/[/\\]/).pop() || tx.source_file} />}
          <InfoRow label="Importiert" value={tx.created_at ? new Date(tx.created_at + 'Z').toLocaleString('de-DE') : '–'} />
        </div>

        {/* Verwendungszweck */}
        {tx.remittance_info && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Verwendungszweck</p>
            <div className="text-sm rounded-xl border p-4 whitespace-pre-wrap break-words leading-relaxed">
              {tx.remittance_info}
            </div>
          </div>
        )}

        {/* Zugeordneter Beleg */}
        {matched && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Zugeordneter Beleg</p>
            <div className="rounded-xl border border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{matched.partner}</span>
                <Badge variant="default" className="text-xs gap-1"><CheckCircle className="h-3 w-3" /> Zugeordnet</Badge>
              </div>
              {matched.description && <p className="text-sm text-muted-foreground">{matched.description}</p>}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{matched.date}</span>
                <span className="font-semibold">{fmtCurrency(matched.brutto, privacyMode)}</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={onUnmatch}>
              Zuordnung entfernen
            </Button>
          </div>
        )}

        {/* Löschen */}
        <div className="pt-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full text-destructive hover:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Transaktion löschen
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Wirklich löschen?</AlertDialogTitle>
                <AlertDialogDescription>Diese Transaktion wird unwiderruflich gelöscht.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Löschen</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%] truncate" title={value}>{value}</span>
    </div>
  );
}

function formatDate(d: string): string {
  if (!d) return '–';
  // YYYY-MM-DD → DD.MM.YYYY
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return d;
}






