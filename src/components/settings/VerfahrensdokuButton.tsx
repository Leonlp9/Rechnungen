import { useState } from 'react';
import jsPDF from 'jspdf';
import { getAllInvoices, getSetting } from '@/lib/db';
import { useAppStore } from '@/store';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FileText } from 'lucide-react';

export function VerfahrensdokuButton() {
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    setGenerating(true);
    try {
      const store = useAppStore.getState();
      const invoices = await getAllInvoices();
      const dates = invoices.map(i => i.date).filter(Boolean).sort();
      const profileName = await getSetting('profile_name') ?? 'Nicht angegeben';
      const profileTaxNumber = await getSetting('profile_tax_number') ?? 'Nicht angegeben';
      const erstellDatum = new Date().toLocaleDateString('de-DE');

      const doc = new jsPDF({ format: 'a4', unit: 'mm' });
      let y = 25;
      const line = (text: string, indent = 0) => { doc.text(text, 15 + indent, y); y += 7; };
      const h1 = (text: string) => { doc.setFontSize(14); doc.setFont('helvetica', 'bold'); line(text); doc.setFontSize(11); doc.setFont('helvetica', 'normal'); y += 2; };
      const h2 = (text: string) => { doc.setFontSize(12); doc.setFont('helvetica', 'bold'); line(text); doc.setFontSize(11); doc.setFont('helvetica', 'normal'); };
      const field = (label: string, value: string) => { doc.setFont('helvetica', 'bold'); doc.text(label + ':', 15, y); doc.setFont('helvetica', 'normal'); doc.text(value, 80, y); y += 7; };

      // Titelseite
      doc.setFontSize(18); doc.setFont('helvetica', 'bold');
      doc.text('Verfahrensdokumentation', 15, 20);
      doc.setFontSize(12); doc.setFont('helvetica', 'normal');
      doc.text('gemäß GoBD (BMF-Schreiben 14. Juli 2025)', 15, 30);
      y = 50;

      h1('1. Allgemeine Angaben');
      field('Unternehmen', profileName);
      field('Steuernummer', profileTaxNumber);
      field('Besteuerung', store.steuerregelung === 'kleinunternehmer' ? 'Kleinunternehmer § 19 UStG' : 'Regelbesteuerung');
      field('Dokument erstellt', erstellDatum);
      y += 5;

      h1('2. Beschreibung des DV-Systems');
      h2('2.1 Softwarebezeichnung');
      line('Rechnungs-Manager — Desktop-Anwendung für Freiberufler und Kleinunternehmer');
      line('Plattform: Windows, macOS, Linux (Tauri v2)', 5);
      y += 3;

      h2('2.2 Datenspeicherung');
      line('Alle Buchungsdaten werden in einer lokalen SQLite-Datenbank gespeichert.');
      line('Backup-Format: .rmbackup (ZIP-komprimiertes SQLite + PDF-Belege)', 5);
      y += 3;

      h2('2.3 Datensicherheitskonzept');
      line('• Tägliche manuelle Backup-Erstellung empfohlen');
      line('• Audit-Trail: Alle Änderungen werden in der audit_log-Tabelle protokolliert');
      line('• Löschung von Rechnungen: nur als Storno (Original bleibt erhalten)');
      line('• Passwörter/API-Keys werden im OS-Schlüsselbund gespeichert');
      y += 3;

      h1('3. Aufbewahrungsfristen (§ 147 AO)');
      field('Rechnungen, Buchungsbelege', '8 Jahre');
      field('Handelsbücher, Jahresabschlüsse', '10 Jahre');
      field('Früheste Buchung', dates[0] || 'Keine');
      field('Späteste Buchung', dates[dates.length - 1] || 'Keine');
      field('Gesamtanzahl Belege', invoices.length.toString());
      y += 3;

      h1('4. Erfassungsprozess');
      line('Belege werden erfasst durch:');
      line('a) Manuelle Eingabe über die Rechnungsmaske', 5);
      line('b) KI-gestützte PDF-Erkennung (Gemini API)', 5);
      line('c) Import von E-Rechnungen (XRechnung/ZUGFeRD XML)', 5);
      y += 3;

      h1('5. Zugriffsberechtigungen');
      line('Das System wird als Einzelplatzlösung betrieben.');
      y += 3;

      h1('6. Unveränderlichkeit der Daten');
      line('Einmal gespeicherte Rechnungen können nur als Storno korrigiert werden.');
      line('Der Audit-Trail ist durch SHA-256-Verkettung gegen Manipulation gesichert.');
      y += 10;

      line('___________________________          ___________________________');
      line(`Ort, Datum                           Unterschrift`);

      doc.save(`Verfahrensdokumentation_${erstellDatum.replace(/\./g, '-')}.pdf`);
      toast.success('Verfahrensdokumentation als PDF generiert!');
    } catch (e) {
      toast.error('Fehler: ' + String(e));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button onClick={generate} variant="outline" disabled={generating}>
      <FileText className="mr-2 h-4 w-4" />
      {generating ? 'Generiere…' : 'Verfahrensdokumentation (PDF)'}
    </Button>
  );
}

