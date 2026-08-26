import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { customers } from '@/lib/db';
import type { Customer } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { ListGroup, ListRow } from '@/components/ui/list-group';
import { FormGroup, FormRow, FormFullRow, FIELD } from '@/components/ui/form-list';
import { PageHeader } from '@/components/layout/PageHeader';
import { SearchField } from '@/components/ui/search-field';
import { useIsMobile } from '@/hooks/useIsMobile';
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
  const isMobile = useIsMobile();

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
  // dataVersion: nach einem Cloud-Sync neu laden, ohne Seitenwechsel
  const dataVersion = useAppStore((s) => s.dataVersion);
  useEffect(() => { reload(); }, [dataVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = allCustomers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.customer_number ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (data: Partial<Customer>) => {
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
  };

  const handleDelete = async (c: Customer) => {
    await customers.delete(c.id);
    await reload();
    setShowForm(false);
    toast.success('Kunde gelöscht');
  };

  const formModal = (
    <ResponsiveModal
      open={showForm}
      onClose={() => setShowForm(false)}
      title={editing ? 'Kunde bearbeiten' : 'Neuer Kunde'}
    >
      <CustomerForm
        initial={editing}
        onSave={handleSave}
        onDelete={isMobile && editing ? () => handleDelete(editing) : undefined}
      />
    </ResponsiveModal>
  );

  // ── Handy ──
  // Karten mit je fünf Zeilen Kleingedrucktem passten dreimal auf den
  // Bildschirm. Als Liste sieht man zwölf Kunden auf einen Blick – die
  // Einzelheiten stehen im Formular, das ohnehin nur einen Tipper entfernt ist.
  if (isMobile) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Kunden"
          subtitle={allCustomers.length > 0 ? `${allCustomers.length} im Kundenstamm` : undefined}
          actions={
            <Button size="icon" onClick={() => { setEditing(null); setShowForm(true); }} aria-label="Neuer Kunde">
              <Plus className="h-5 w-5" />
            </Button>
          }
        />

        <SearchField value={search} onChange={setSearch} placeholder="Kunden suchen" />

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Lade …</p>
        ) : filtered.length === 0 ? (
          <ListGroup>
            <ListRow
              icon={<Users />}
              label={search ? 'Keine Treffer' : 'Noch keine Kunden'}
              hint={search ? undefined : 'Mit + oben rechts anlegen'}
              noChevron
            />
          </ListGroup>
        ) : (
          <ListGroup footer="Tippe einen Kunden an, um ihn zu bearbeiten.">
            {filtered.map((c) => {
              const revenue = revenueByName.get(c.name.trim().toLowerCase()) ?? 0;
              const place = [c.zip, c.city].filter(Boolean).join(' ');
              return (
                <ListRow
                  key={c.id}
                  label={c.name}
                  hint={[c.email, place, c.customer_number].filter(Boolean).join(' · ') || undefined}
                  value={revenue > 0 ? <span className="text-green-600">{fmtCurrency(revenue, false)}</span> : undefined}
                  onClick={() => { setEditing(c); setShowForm(true); }}
                />
              );
            })}
          </ListGroup>
        )}

        {formModal}
      </div>
    );
  }

  // ── Desktop ──
  return (
    <div className="space-y-6">
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
                          <AlertDialogAction onClick={() => handleDelete(c)}>Löschen</AlertDialogAction>
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

      {formModal}
    </div>
  );
}

function CustomerForm({
  initial,
  onSave,
  onDelete,
}: {
  initial: Customer | null;
  onSave: (data: Partial<Customer>) => Promise<void>;
  onDelete?: () => void;
}) {
  const isMobile = useIsMobile();
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

  // ── Handy: Beschriftung links, Eingabe rechts ──
  if (isMobile) {
    return (
      <div className="space-y-6">
        <FormGroup title="Kunde">
          <FormRow label="Name">
            <input value={name} onChange={e => setName(e.target.value)} className={FIELD} placeholder="Firma oder Person" />
          </FormRow>
          <FormRow label="E-Mail">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={FIELD} placeholder="optional" />
          </FormRow>
          <FormRow label="Telefon">
            <input value={phone} onChange={e => setPhone(e.target.value)} className={FIELD} placeholder="optional" />
          </FormRow>
        </FormGroup>

        <FormGroup title="Anschrift">
          <FormRow label="Straße">
            <input value={street} onChange={e => setStreet(e.target.value)} className={FIELD} placeholder="optional" />
          </FormRow>
          <FormRow label="PLZ">
            <input value={zip} onChange={e => setZip(e.target.value)} className={FIELD} placeholder="optional" />
          </FormRow>
          <FormRow label="Stadt">
            <input value={city} onChange={e => setCity(e.target.value)} className={FIELD} placeholder="optional" />
          </FormRow>
        </FormGroup>

        <FormGroup title="Rechnung" footer="Das Zahlungsziel wird beim Schreiben einer Rechnung vorgeschlagen.">
          <FormRow label="USt-IdNr.">
            <input value={taxId} onChange={e => setTaxId(e.target.value)} className={FIELD} placeholder="optional" />
          </FormRow>
          <FormRow label="Zahlungsziel">
            <input type="number" value={paymentDays} onChange={e => setPaymentDays(e.target.value)} className={FIELD} />
          </FormRow>
        </FormGroup>

        <FormGroup title="Notizen">
          <FormFullRow>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Optionale Notiz"
              className="w-full resize-none bg-transparent text-[17px] outline-none placeholder:text-muted-foreground"
            />
          </FormFullRow>
        </FormGroup>

        <Button onClick={handleSubmit} disabled={saving} className="h-[50px] w-full text-[17px] font-semibold">
          {saving ? 'Speichere …' : (initial ? 'Aktualisieren' : 'Kunde anlegen')}
        </Button>

        {onDelete && (
          <ListGroup>
            <ListRow tint="red" icon={<Trash2 />} label="Kunde löschen" destructive noChevron onClick={onDelete} />
          </ListGroup>
        )}
      </div>
    );
  }

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
