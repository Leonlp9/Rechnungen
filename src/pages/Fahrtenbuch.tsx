import { useEffect, useMemo, useState } from 'react';
import { fahrtenbuch } from '@/lib/db';
import type { Fahrt } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { fmtCurrency, saveCsvFile } from '@/lib/utils';
import { useAppStore } from '@/store';
import { Plus, Car, Trash2, Download } from 'lucide-react';

async function exportFahrtenbuchCsv(fahrten: Fahrt[]) {
  const header = ['Datum', 'Abfahrt', 'Ziel', 'km', 'Zweck', 'Art', 'KFZ-Kennzeichen'];
  const rows = fahrten.map((f) => [
    new Date(f.datum).toLocaleDateString('de-DE'),
    `"${f.abfahrt.replace(/"/g, '""')}"`,
    `"${f.ziel.replace(/"/g, '""')}"`,
    f.km.toFixed(2).replace('.', ','),
    `"${f.zweck.replace(/"/g, '""')}"`,
    f.art === 'dienst' ? 'Dienst' : 'Privat',
    `"${(f.kfz_kennz ?? '').replace(/"/g, '""')}"`,
  ]);
  const csv = '\uFEFF' + [header.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
  await saveCsvFile(`Fahrtenbuch_${new Date().toISOString().slice(0, 10)}.csv`, csv);
}

export default function FahrtenbuchPage() {
  const [fahrten, setFahrten] = useState<Fahrt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const privacyMode = useAppStore((s) => s.privacyMode);

  const reload = () => fahrtenbuch.getAll().then(setFahrten).finally(() => setLoading(false));
  useEffect(() => { reload(); }, []);

  const dienstKm = useMemo(() => fahrten.filter(f => f.art === 'dienst').reduce((s, f) => s + f.km, 0), [fahrten]);
  const absetzbar = dienstKm * 0.30;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Car className="h-6 w-6" /> Fahrtenbuch</h1>
        <div className="flex gap-2">
          {fahrten.length > 0 && (
            <Button variant="outline" onClick={() => exportFahrtenbuchCsv(fahrten)}>
              <Download className="mr-2 h-4 w-4" /> CSV-Export
            </Button>
          )}
          <Button onClick={() => setShowAdd(true)}><Plus className="mr-2 h-4 w-4" /> Fahrt eintragen</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Dienstfahrten</p><p className="text-2xl font-bold">{dienstKm.toFixed(0)} km</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Absetzbar (30 Ct/km)</p><p className="text-2xl font-bold">{fmtCurrency(absetzbar, privacyMode)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Einträge</p><p className="text-2xl font-bold">{fahrten.length}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Lade...</p>
          ) : fahrten.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Noch keine Fahrten eingetragen.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Von</TableHead>
                  <TableHead>Nach</TableHead>
                  <TableHead>km</TableHead>
                  <TableHead>Zweck</TableHead>
                  <TableHead>Art</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fahrten.map((f) => (
                  <TableRow key={f.id} className={f.art === 'privat' ? 'text-muted-foreground' : ''}>
                    <TableCell>{new Date(f.datum).toLocaleDateString('de-DE')}</TableCell>
                    <TableCell>{f.abfahrt}</TableCell>
                    <TableCell>{f.ziel}</TableCell>
                    <TableCell>{f.km.toFixed(1)}</TableCell>
                    <TableCell>{f.zweck}</TableCell>
                    <TableCell>
                      <Badge variant={f.art === 'dienst' ? 'default' : 'secondary'}>
                        {f.art === 'dienst' ? '💼 Dienst' : '🏠 Privat'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Fahrt löschen?</AlertDialogTitle>
                            <AlertDialogDescription>Diese Aktion kann nicht rückgängig gemacht werden.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction onClick={async () => { await fahrtenbuch.delete(f.id); await reload(); toast.success('Fahrt gelöscht'); }}>Löschen</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neue Fahrt eintragen</DialogTitle></DialogHeader>
          <FahrtForm onSave={async (data) => { await fahrtenbuch.add(data); await reload(); setShowAdd(false); toast.success('Fahrt eingetragen'); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FahrtForm({ onSave }: { onSave: (data: Omit<Fahrt, 'id' | 'created_at'>) => Promise<void> }) {
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10));
  const [abfahrt, setAbfahrt] = useState('');
  const [ziel, setZiel] = useState('');
  const [km, setKm] = useState('');
  const [zweck, setZweck] = useState('');
  const [art, setArt] = useState<'dienst' | 'privat'>('dienst');
  const [kfzKennz, setKfzKennz] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!abfahrt || !ziel || !km || !zweck) { toast.error('Bitte alle Felder ausfüllen'); return; }
    setSaving(true);
    try {
      await onSave({ datum, abfahrt, ziel, km: parseFloat(km), zweck, art, kfz_kennz: kfzKennz });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Datum</Label><Input type="date" value={datum} onChange={e => setDatum(e.target.value)} /></div>
        <div><Label>KFZ-Kennzeichen</Label><Input value={kfzKennz} onChange={e => setKfzKennz(e.target.value)} placeholder="B-AB 1234" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Abfahrtsort</Label><Input value={abfahrt} onChange={e => setAbfahrt(e.target.value)} placeholder="Büro" /></div>
        <div><Label>Zielort</Label><Input value={ziel} onChange={e => setZiel(e.target.value)} placeholder="Kunde XYZ" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Kilometer</Label><Input type="number" step="0.1" value={km} onChange={e => setKm(e.target.value)} placeholder="25.5" /></div>
        <div>
          <Label>Art</Label>
          <div className="flex gap-2 mt-1">
            <Button variant={art === 'dienst' ? 'default' : 'outline'} size="sm" onClick={() => setArt('dienst')}>💼 Dienst</Button>
            <Button variant={art === 'privat' ? 'default' : 'outline'} size="sm" onClick={() => setArt('privat')}>🏠 Privat</Button>
          </div>
        </div>
      </div>
      <div><Label>Zweck</Label><Input value={zweck} onChange={e => setZweck(e.target.value)} placeholder="Kundenbesuch bei Firma XYZ" /></div>
      <Button onClick={handleSubmit} disabled={saving} className="w-full">{saving ? 'Speichere…' : 'Fahrt eintragen'}</Button>
    </div>
  );
}


