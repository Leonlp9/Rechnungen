import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { customers } from '@/lib/db';
import type { Customer } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Plus, Users, Pencil, Trash2, Mail, Phone, MapPin, Building2, TrendingUp } from 'lucide-react';
import { useAppStore } from '@/store';
import { fmtCurrency } from '@/lib/utils';

export default function CustomersPage() {
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const invoices = useAppStore((s) => s.invoices);

  // Umsatz pro Kunde aggregieren (Einnahmen, die den Kundennamen als Partner haben)
  const revenueByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of invoices) {
      if (inv.type !== 'einnahme') continue;
      const key = inv.partner.trim().toLowerCase();
      map.set(key, (map.get(key) ?? 0) + inv.brutto);
    }
    return map;
  }, [invoices]);

  const reload = () => customers.getAll().then(setAllCustomers).finally(() => setLoading(false));
  useEffect(() => { reload(); }, []);

  const filtered = allCustomers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.customer_number ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6" /> Kunden</h1>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}><Plus className="mr-2 h-4 w-4" /> Neuer Kunde</Button>
      </div>

      <Input placeholder="Kunden suchen…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-md" />

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Lade...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Keine Kunden gefunden.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <Card key={c.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    {c.customer_number && <p className="text-xs text-muted-foreground font-mono">{c.customer_number}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(c); setShowForm(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Kunde löschen?</AlertDialogTitle>
                          <AlertDialogDescription>„{c.name}" wird unwiderruflich gelöscht.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                          <AlertDialogAction onClick={async () => { await customers.delete(c.id); await reload(); toast.success('Kunde gelöscht'); }}>Löschen</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {c.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" /> {c.email}</div>}
                {c.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {c.phone}</div>}
                {(c.street || c.city) && <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {[c.street, [c.zip, c.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</div>}
                {c.tax_id && <div className="flex items-center gap-2 text-muted-foreground"><Building2 className="h-3.5 w-3.5" /> {c.tax_id}</div>}
                <p className="text-xs text-muted-foreground">Zahlungsziel: {c.payment_days} Tage</p>
                {(() => {
                  const revenue = revenueByName.get(c.name.trim().toLowerCase()) ?? 0;
                  if (revenue <= 0) return null;
                  return (
                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/50">
                      <TrendingUp className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      <span className="text-xs font-semibold text-green-700 dark:text-green-400">
                        {fmtCurrency(revenue, false)} Umsatz gesamt
                      </span>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Kunde bearbeiten' : 'Neuer Kunde'}</DialogTitle></DialogHeader>
          <CustomerForm
            initial={editing}
            onSave={async (data) => {
              if (editing) {
                await customers.update(editing.id, data);
                toast.success('Kunde aktualisiert');
              } else {
                const number = await customers.generateNextNumber();
                await customers.save({ name: data.name!, customer_number: number, country: data.country || 'DE', payment_days: data.payment_days ?? 14, ...data });
                toast.success('Kunde angelegt');
              }
              await reload();
              setShowForm(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CustomerForm({ initial, onSave }: { initial: Customer | null; onSave: (data: Partial<Customer>) => Promise<void> }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [street, setStreet] = useState(initial?.street ?? '');
  const [zip, setZip] = useState(initial?.zip ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [taxId, setTaxId] = useState(initial?.tax_id ?? '');
  const [paymentDays, setPaymentDays] = useState(String(initial?.payment_days ?? 14));
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name) { toast.error('Name ist erforderlich'); return; }
    setSaving(true);
    try {
      await onSave({ name, email: email || undefined, phone: phone || undefined, street: street || undefined, zip: zip || undefined, city: city || undefined, tax_id: taxId || undefined, payment_days: parseInt(paymentDays) || 14, notes: notes || undefined });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div><Label>Name / Firma *</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>E-Mail</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div><Label>Telefon</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
      </div>
      <div><Label>Straße</Label><Input value={street} onChange={e => setStreet(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>PLZ</Label><Input value={zip} onChange={e => setZip(e.target.value)} /></div>
        <div><Label>Stadt</Label><Input value={city} onChange={e => setCity(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>USt-IdNr.</Label><Input value={taxId} onChange={e => setTaxId(e.target.value)} /></div>
        <div><Label>Zahlungsziel (Tage)</Label><Input type="number" value={paymentDays} onChange={e => setPaymentDays(e.target.value)} /></div>
      </div>
      <div><Label>Notizen</Label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></div>
      <Button onClick={handleSubmit} disabled={saving} className="w-full">{saving ? 'Speichere…' : (initial ? 'Aktualisieren' : 'Kunde anlegen')}</Button>
    </div>
  );
}


