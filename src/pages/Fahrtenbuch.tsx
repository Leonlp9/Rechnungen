import { useEffect, useMemo, useState } from 'react';
import { fahrtenbuch } from '@/lib/db';
import type { Fahrt } from '@/lib/db';
import { geocodeAddress, getRoute } from '@/lib/geocoding';
import type { GeoPlace, RouteResult } from '@/lib/geocoding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { fmtCurrency, saveCsvFile } from '@/lib/utils';
import { useAppStore } from '@/store';
import { Plus, Car, Trash2, Download, Settings2, FileDown, Map, Navigation, Clock, Ruler, Pencil, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PlaceSearchInput } from '@/components/fahrtenbuch/PlaceSearchInput';
import { FahrtRouteMap } from '@/components/fahrtenbuch/FahrtRouteMap';
import { AlleFahrtenMap } from '@/components/fahrtenbuch/AlleFahrtenMap';

// ── CSV-Export ───────────────────────────────────────────────────────────────

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

// ── PDF-Export ───────────────────────────────────────────────────────────────

async function exportFahrtenbuchPdf(fahrten: Fahrt[], kmPauschale: number) {
  if (fahrten.length === 0) { toast.error('Keine Fahrten zum Exportieren'); return; }

  const { default: jsPDF } = await import('jspdf');
  const { save } = await import('@tauri-apps/plugin-dialog');
  const { writeFile } = await import('@tauri-apps/plugin-fs');

  const sorted = [...fahrten].sort((a, b) => a.datum.localeCompare(b.datum));
  const years = [...new Set(sorted.map(f => new Date(f.datum).getFullYear()))].sort();
  const yearLabel = years.length === 1 ? String(years[0]) : `${years[0]}-${years[years.length - 1]}`;

  const path = await save({
    defaultPath: `Fahrtenbuch_${yearLabel}.pdf`,
    filters: [{ name: 'PDF-Datei', extensions: ['pdf'] }],
  });
  if (!path) return;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297, marginL = 15, marginR = 15, usable = W - marginL - marginR;
  const pageH = 210, marginTop = 15, marginBot = 12;
  const COL_HEADER_BG: [number, number, number] = [30, 41, 59];
  const COL_DIENST: [number, number, number] = [22, 101, 52];
  const COL_PRIVAT: [number, number, number] = [107, 114, 128];
  const COL_BORDER: [number, number, number] = [226, 232, 240];
  const COL_ALT: [number, number, number] = [248, 250, 252];
  const COL_SUMMARY_BG: [number, number, number] = [239, 246, 255];
  const cols = { datum: 24, von: 38, nach: 38, km: 16, zweck: 70, art: 24, kfz: usable - 24 - 38 - 38 - 16 - 70 - 24 };

  let page = 1;
  let y = marginTop;
  const colX = () => { const x: Record<string, number> = {}; let cur = marginL; for (const [k, w] of Object.entries(cols)) { x[k] = cur; cur += w; } return x; };

  function drawHeader() {
    doc.setFillColor(...COL_HEADER_BG); doc.rect(marginL, marginTop, usable, 12, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text(`Fahrtenbuch ${yearLabel}`, marginL + 4, marginTop + 8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(`Erstellt am ${new Date().toLocaleDateString('de-DE')} · ${fahrten.length} Einträge`, W - marginR - 4, marginTop + 8, { align: 'right' });
    y = marginTop + 12 + 4;
  }

  function drawSummary() {
    const dKm = sorted.filter(f => f.art === 'dienst').reduce((s, f) => s + f.km, 0);
    const pKm = sorted.filter(f => f.art === 'privat').reduce((s, f) => s + f.km, 0);
    const abs = dKm * kmPauschale;
    const bh = 16;
    doc.setFillColor(...COL_SUMMARY_BG); doc.setDrawColor(...COL_BORDER); doc.rect(marginL, y, usable, bh, 'FD');
    const items = [{ label: 'Dienstfahrten', value: `${dKm.toFixed(1)} km` }, { label: 'Privatfahrten', value: `${pKm.toFixed(1)} km` }, { label: `km-Pauschale (${kmPauschale.toFixed(2).replace('.', ',')} €/km)`, value: `${abs.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €` }];
    const iw = usable / items.length;
    items.forEach(({ label, value }, i) => {
      const ix = marginL + i * iw + iw / 2;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(100, 116, 139); doc.text(label, ix, y + 5, { align: 'center' });
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(15, 23, 42); doc.text(value, ix, y + 12, { align: 'center' });
    });
    y += bh + 4;
  }

  function drawTableHeader() {
    const x = colX(); const rh = 8;
    doc.setFillColor(...COL_HEADER_BG); doc.rect(marginL, y, usable, rh, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    for (const [k, label] of [['datum','Datum'],['von','Von'],['nach','Nach'],['km','km'],['zweck','Zweck'],['art','Art'],['kfz','KFZ-Kennz.']] as [string,string][]) { doc.text(label, x[k] + 2, y + 5.5); }
    y += rh;
  }

  function newPage() {
    doc.addPage(); page++; y = marginTop;
    doc.setFillColor(...COL_HEADER_BG); doc.rect(marginL, y, usable, 7, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text(`Fahrtenbuch ${yearLabel} – Seite ${page}`, marginL + 4, y + 5);
    y += 7 + 3; drawTableHeader();
  }

  function drawRows() {
    const x = colX(); const rh = 6.5; doc.setFontSize(7.5);
    sorted.forEach((f, idx) => {
      if (y + rh > pageH - marginBot) newPage();
      if (idx % 2 === 0) { doc.setFillColor(...COL_ALT); doc.rect(marginL, y, usable, rh, 'F'); }
      doc.setDrawColor(...COL_BORDER); doc.line(marginL, y + rh, marginL + usable, y + rh);
      const isDienst = f.art === 'dienst';
      const fg: [number,number,number] = isDienst ? COL_DIENST : COL_PRIVAT;
      const rowY = y + 4.5;
      doc.setTextColor(...fg); doc.setFont('helvetica', isDienst ? 'bold' : 'normal');
      doc.text(new Date(f.datum).toLocaleDateString('de-DE'), x['datum'] + 2, rowY);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(15, 23, 42);
      const clip = (t: string, w: number) => (doc.splitTextToSize(t, w - 3) as string[])[0];
      doc.text(clip(f.abfahrt, cols['von']), x['von'] + 2, rowY);
      doc.text(clip(f.ziel, cols['nach']), x['nach'] + 2, rowY);
      doc.setTextColor(...fg); doc.setFont('helvetica', 'bold');
      doc.text(f.km.toFixed(1), x['km'] + cols['km'] - 4, rowY, { align: 'right' });
      doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'normal');
      doc.text(clip(f.zweck, cols['zweck']), x['zweck'] + 2, rowY);
      doc.setFillColor(...(isDienst ? [220,252,231] : [243,244,246]) as [number,number,number]);
      doc.roundedRect(x['art'] + 2, y + 1, cols['art'] - 4, rh - 2, 1, 1, 'F');
      doc.setTextColor(...fg); doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
      doc.text(isDienst ? 'Dienst' : 'Privat', x['art'] + cols['art'] / 2, rowY, { align: 'center' });
      doc.setFontSize(7.5); doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal');
      doc.text(f.kfz_kennz ?? '', x['kfz'] + 2, rowY);
      y += rh;
    });
  }

  drawHeader(); drawSummary(); drawTableHeader(); drawRows();
  for (let p = 1; p <= doc.getNumberOfPages(); p++) {
    doc.setPage(p); doc.setDrawColor(...COL_BORDER); doc.line(marginL, pageH - marginBot + 2, W - marginR, pageH - marginBot + 2);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(148, 163, 184);
    doc.text(`Fahrtenbuch ${yearLabel}`, marginL, pageH - 4);
    doc.text(`Seite ${p} / ${doc.getNumberOfPages()}`, W - marginR, pageH - 4, { align: 'right' });
  }

  const buf = doc.output('arraybuffer');
  await writeFile(path, new Uint8Array(buf));
  toast.success('PDF erfolgreich gespeichert.');
}

// ── Hauptkomponente ──────────────────────────────────────────────────────────

export default function FahrtenbuchPage() {
  const [fahrten, setFahrten] = useState<Fahrt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [detailFahrt, setDetailFahrt] = useState<Fahrt | null>(null);
  const [showAllMap, setShowAllMap] = useState(false);
  const privacyMode  = useAppStore((s) => s.privacyMode);
  const kmPauschale  = useAppStore((s) => s.kmPauschale);
  const setKmPauschale = useAppStore((s) => s.setKmPauschale);
  const [kmInput, setKmInput] = useState(String(kmPauschale));

  const reload = () => fahrtenbuch.getAll().then(setFahrten).finally(() => setLoading(false));
  useEffect(() => { reload(); }, []);

  const dienstKm = useMemo(() => fahrten.filter(f => f.art === 'dienst').reduce((s, f) => s + f.km, 0), [fahrten]);
  const absetzbar = dienstKm * kmPauschale;

  const handleExportPdf = async () => {
    setPdfGenerating(true);
    try { await exportFahrtenbuchPdf(fahrten, kmPauschale); }
    catch (err) { toast.error('PDF-Export fehlgeschlagen: ' + String(err)); }
    finally { setPdfGenerating(false); }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Car className="h-6 w-6" /> Fahrtenbuch</h1>
        <div className="flex gap-2 flex-wrap justify-end">
          {/* km-Pauschale Einstellungen */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" title="km-Pauschale einstellen">
                <Settings2 className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 space-y-3">
              <p className="text-sm font-medium">km-Pauschale</p>
              <p className="text-xs text-muted-foreground">Steuerlich anerkannter Satz pro km (ab 2022: 0,30 € für die ersten 20 km, 0,38 € ab km 21).</p>
              <div className="flex gap-2 items-center">
                <Input type="number" step="0.01" min="0" value={kmInput} onChange={(e) => setKmInput(e.target.value)} className="h-8 text-sm" />
                <span className="text-sm text-muted-foreground">€/km</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => { setKmInput('0.30'); setKmPauschale(0.30); }}>0,30 €</Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => { setKmInput('0.38'); setKmPauschale(0.38); }}>0,38 €</Button>
              </div>
              <Button size="sm" className="w-full" onClick={() => {
                const v = parseFloat(kmInput.replace(',', '.'));
                if (!isNaN(v) && v > 0) { setKmPauschale(v); toast.success(`km-Pauschale auf ${v.toFixed(2).replace('.', ',')} €/km gesetzt`); }
                else toast.error('Ungültiger Wert');
              }}>Übernehmen</Button>
            </PopoverContent>
          </Popover>
          {/* Alle Fahrten Karte */}
          {fahrten.length > 0 && (
            <Button variant="outline" onClick={() => setShowAllMap(true)}>
              <Map className="mr-2 h-4 w-4" /> Alle Fahrten auf Karte
            </Button>
          )}
          {/* CSV & PDF Export */}
          {fahrten.length > 0 && (
            <Button variant="outline" onClick={() => exportFahrtenbuchCsv(fahrten)}>
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
          )}
          {fahrten.length > 0 && (
            <Button variant="outline" onClick={handleExportPdf} disabled={pdfGenerating}>
              <FileDown className="mr-2 h-4 w-4" /> {pdfGenerating ? 'Erstelle PDF…' : 'PDF'}
            </Button>
          )}
          <Button onClick={() => setShowAdd(true)}><Plus className="mr-2 h-4 w-4" /> Fahrt eintragen</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Dienstfahrten</p><p className="text-2xl font-bold">{dienstKm.toFixed(0)} km</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Absetzbar ({kmPauschale.toFixed(2).replace('.', ',')} €/km)</p><p className="text-2xl font-bold">{fmtCurrency(absetzbar, privacyMode)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Einträge</p><p className="text-2xl font-bold">{fahrten.length}</p></CardContent></Card>
      </div>

      {/* Trip Table */}
      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
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
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fahrten.map((f) => (
                  <TableRow
                    key={f.id}
                    className={`cursor-pointer hover:bg-muted/40 transition-colors ${f.art === 'privat' ? 'text-muted-foreground' : ''}`}
                    onClick={() => setDetailFahrt(f)}
                  >
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
                    <TableCell onClick={(e) => e.stopPropagation()}>
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

      {/* Dialog: Fahrt eintragen */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Neue Fahrt eintragen</DialogTitle></DialogHeader>
          <FahrtForm
            onSave={async (data) => {
              await fahrtenbuch.add(data);
              await reload();
              setShowAdd(false);
              toast.success('Fahrt eingetragen');
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog: Fahrt-Details + Karte */}
      {detailFahrt && (
        <FahrtDetailDialog
          fahrt={detailFahrt}
          onClose={() => setDetailFahrt(null)}
          onSaved={async () => { await reload(); setDetailFahrt(null); }}
        />
      )}

      {/* Dialog: Alle Fahrten auf Karte */}
      <Dialog open={showAllMap} onOpenChange={setShowAllMap}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-3 flex-shrink-0 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Map className="h-5 w-5" /> Alle Fahrten auf Karte
              <span className="text-xs font-normal text-muted-foreground ml-1">
                Blau = Dienst · Grau = Privat · Klicken für Details
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            <AlleFahrtenMap fahrten={fahrten} className="h-full w-full rounded-b-lg" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── FahrtDetailDialog ────────────────────────────────────────────────────────

function FahrtDetailDialog({ fahrt, onClose, onSaved }: { fahrt: Fahrt; onClose: () => void; onSaved: () => Promise<void> }) {
  const [editMode, setEditMode] = useState(false);
  const [fromPlace, setFromPlace] = useState<GeoPlace | null>(null);
  const [toPlace,   setToPlace]   = useState<GeoPlace | null>(null);
  const [route,     setRoute]     = useState<RouteResult | null | undefined>(undefined);
  const [geoLoading, setGeoLoading] = useState(true);

  useEffect(() => {
    if (editMode) return; // Karte nur im Detail-Modus laden
    let cancelled = false;
    (async () => {
      setGeoLoading(true);

      let fp: GeoPlace | null = null;
      let tp: GeoPlace | null = null;

      if (fahrt.abfahrt_lat && fahrt.abfahrt_lon) {
        fp = { lat: fahrt.abfahrt_lat, lon: fahrt.abfahrt_lon, displayName: fahrt.abfahrt, shortName: fahrt.abfahrt, placeId: 'stored-from' };
      } else {
        fp = await geocodeAddress(fahrt.abfahrt);
      }

      if (fahrt.ziel_lat && fahrt.ziel_lon) {
        tp = { lat: fahrt.ziel_lat, lon: fahrt.ziel_lon, displayName: fahrt.ziel, shortName: fahrt.ziel, placeId: 'stored-to' };
      } else {
        tp = await geocodeAddress(fahrt.ziel);
      }

      if (cancelled) return;
      setFromPlace(fp);
      setToPlace(tp);
      setGeoLoading(false);

      if (fp && tp) {
        const r = await getRoute(fp, tp);
        if (!cancelled) setRoute(r);
      } else {
        setRoute(null);
      }
    })();
    return () => { cancelled = true; };
  }, [fahrt, editMode]);

  const isDienst = fahrt.art === 'dienst';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 flex-shrink-0 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Navigation className="h-5 w-5" />
              {editMode ? 'Fahrt bearbeiten' : (
                <>
                  {fahrt.abfahrt} → {fahrt.ziel}
                  <Badge variant={isDienst ? 'default' : 'secondary'} className="ml-1">
                    {isDienst ? '💼 Dienst' : '🏠 Privat'}
                  </Badge>
                </>
              )}
            </DialogTitle>
            {!editMode && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditMode(true)}>
                <Pencil className="h-3.5 w-3.5" /> Bearbeiten
              </Button>
            )}
            {editMode && (
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setEditMode(false)}>
                <X className="h-3.5 w-3.5" /> Abbrechen
              </Button>
            )}
          </div>
        </DialogHeader>

        {editMode ? (
          /* ── Edit-Formular ─────────────────────────────────── */
          <div className="px-6 py-4 overflow-y-auto">
            <FahrtForm
              initialValues={fahrt}
              submitLabel="Änderungen speichern"
              onSave={async (data) => {
                await fahrtenbuch.update(fahrt.id, data);
                toast.success('Fahrt aktualisiert');
                await onSaved();
              }}
            />
          </div>
        ) : (
          /* ── Detail-Ansicht ────────────────────────────────── */
          <>
            {/* Info-Zeile */}
            <div className="px-6 py-3 flex gap-6 text-sm border-b flex-shrink-0 flex-wrap">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Car className="h-3.5 w-3.5" />
                {new Date(fahrt.datum).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Ruler className="h-3.5 w-3.5" />
                {fahrt.km.toFixed(1)} km (eingetragen)
              </span>
              {route && (
                <>
                  <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                    <Ruler className="h-3.5 w-3.5" />
                    {(route.distance / 1000).toFixed(1)} km (Route)
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {Math.round(route.duration / 60)} Min.
                  </span>
                </>
              )}
              {fahrt.zweck && <span className="text-muted-foreground italic">{fahrt.zweck}</span>}
              {fahrt.kfz_kennz && <span className="text-muted-foreground">{fahrt.kfz_kennz}</span>}
            </div>

            {/* Karte */}
            <div className="flex-1 min-h-0 px-6 py-4">
              {geoLoading ? (
                <div className="flex items-center justify-center h-64 gap-2 text-sm text-muted-foreground">
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                  Geocodierung läuft…
                </div>
              ) : fromPlace && toPlace ? (
                <FahrtRouteMap
                  from={fromPlace}
                  to={toPlace}
                  route={route}
                  className="w-full rounded-xl overflow-hidden border"
                />
              ) : (
                <div className="flex items-center justify-center h-64 text-sm text-muted-foreground text-center">
                  Adressen konnten nicht geocodiert werden.<br />
                  Bitte prüfe die Schreibweise von „{fahrt.abfahrt}" und „{fahrt.ziel}".
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── FahrtForm ────────────────────────────────────────────────────────────────

function FahrtForm({
  onSave,
  initialValues,
  submitLabel = 'Fahrt eintragen',
}: {
  onSave: (data: Omit<Fahrt, 'id' | 'created_at'>) => Promise<void>;
  initialValues?: Fahrt;
  submitLabel?: string;
}) {
  const [datum,    setDatum]    = useState(initialValues?.datum    ?? new Date().toISOString().slice(0, 10));
  const [abfahrt,  setAbfahrt]  = useState(initialValues?.abfahrt  ?? '');
  const [ziel,     setZiel]     = useState(initialValues?.ziel     ?? '');
  const [km,       setKm]       = useState(initialValues?.km != null ? String(initialValues.km) : '');
  const [zweck,    setZweck]    = useState(initialValues?.zweck    ?? '');
  const [art,      setArt]      = useState<'dienst' | 'privat'>(initialValues?.art ?? 'dienst');
  const [kfzKennz, setKfzKennz] = useState(initialValues?.kfz_kennz ?? '');
  const [saving,   setSaving]   = useState(false);

  // Geocoded places & route
  const [fromPlace, setFromPlace] = useState<GeoPlace | null>(() =>
    initialValues?.abfahrt_lat && initialValues?.abfahrt_lon
      ? { lat: initialValues.abfahrt_lat, lon: initialValues.abfahrt_lon, displayName: initialValues.abfahrt, shortName: initialValues.abfahrt, placeId: 'stored-from' }
      : null
  );
  const [toPlace, setToPlace] = useState<GeoPlace | null>(() =>
    initialValues?.ziel_lat && initialValues?.ziel_lon
      ? { lat: initialValues.ziel_lat, lon: initialValues.ziel_lon, displayName: initialValues.ziel, shortName: initialValues.ziel, placeId: 'stored-to' }
      : null
  );
  const [route,     setRoute]     = useState<RouteResult | null | undefined>(undefined);
  const [routeLoading, setRouteLoading] = useState(false);

  // Fetch route when both places are known
  useEffect(() => {
    if (!fromPlace || !toPlace) { setRoute(undefined); return; }
    let cancelled = false;
    setRouteLoading(true);
    getRoute(fromPlace, toPlace).then((r) => {
      if (!cancelled) {
        setRoute(r);
        setRouteLoading(false);
        // Auto-fill km from route distance only if field is still empty (new entry)
        if (r && !km && !initialValues) {
          setKm(((r.distance / 1000)).toFixed(1));
        }
      }
    });
    return () => { cancelled = true; };
  }, [fromPlace, toPlace]);

  const handleSave = async () => {
    if (!abfahrt || !ziel || !km || !zweck) { toast.error('Bitte alle Felder ausfüllen'); return; }
    setSaving(true);
    try {
      await onSave({
        datum, abfahrt, ziel,
        km: parseFloat(km),
        zweck, art,
        kfz_kennz: kfzKennz,
        abfahrt_lat: fromPlace?.lat ?? null,
        abfahrt_lon: fromPlace?.lon ?? null,
        ziel_lat:    toPlace?.lat   ?? null,
        ziel_lon:    toPlace?.lon   ?? null,
      });
    } finally { setSaving(false); }
  };

  const showMap = fromPlace && toPlace;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Datum</Label><Input type="date" value={datum} onChange={e => setDatum(e.target.value)} /></div>
        <div><Label>KFZ-Kennzeichen</Label><Input value={kfzKennz} onChange={e => setKfzKennz(e.target.value)} placeholder="B-AB 1234" /></div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Abfahrtsort</Label>
          <PlaceSearchInput
            value={abfahrt}
            onChange={(v, place) => { setAbfahrt(v); setFromPlace(place ?? null); }}
            placeholder="z. B. Berlin Mitte"
            className="mt-1"
          />
        </div>
        <div>
          <Label>Zielort</Label>
          <PlaceSearchInput
            value={ziel}
            onChange={(v, place) => { setZiel(v); setToPlace(place ?? null); }}
            placeholder="z. B. Hamburg Hauptbahnhof"
            className="mt-1"
          />
        </div>
      </div>

      {/* Route-Karte */}
      {showMap && (
        <div className="rounded-xl overflow-hidden border" style={{ height: 260 }}>
          {routeLoading ? (
            <div className="h-full flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted/30">
              <span className="animate-spin inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
              Route wird berechnet…
            </div>
          ) : (
            <FahrtRouteMap from={fromPlace} to={toPlace} route={route} className="h-full w-full" />
          )}
        </div>
      )}

      {/* Route-Info */}
      {route && !routeLoading && (
        <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2 text-xs text-blue-700 dark:text-blue-300 flex gap-4">
          <span className="flex items-center gap-1"><Ruler className="h-3 w-3" /> {(route.distance / 1000).toFixed(1)} km (Route)</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> ca. {Math.round(route.duration / 60)} Min.</span>
          {km && Math.abs(parseFloat(km) - route.distance / 1000) > 2 && (
            <span className="text-amber-600 dark:text-amber-400">⚠ Abweichung zu eingetragenen {km} km</span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Kilometer</Label>
          <Input type="number" step="0.1" value={km} onChange={e => setKm(e.target.value)} placeholder="25.5" />
          {route && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Route: {(route.distance / 1000).toFixed(1)} km
              {' · '}
              <button type="button" className="underline" onClick={() => setKm((route.distance / 1000).toFixed(1))}>
                übernehmen
              </button>
            </p>
          )}
        </div>
        <div>
          <Label>Art</Label>
          <div className="flex gap-2 mt-1">
            <Button variant={art === 'dienst' ? 'default' : 'outline'} size="sm" onClick={() => setArt('dienst')}>💼 Dienst</Button>
            <Button variant={art === 'privat' ? 'default' : 'outline'} size="sm" onClick={() => setArt('privat')}>🏠 Privat</Button>
          </div>
        </div>
      </div>

      <div>
        <Label>Zweck</Label>
        <Input value={zweck} onChange={e => setZweck(e.target.value)} placeholder="Kundenbesuch bei Firma XYZ" />
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? 'Speichere…' : submitLabel}
      </Button>
    </div>
  );
}

