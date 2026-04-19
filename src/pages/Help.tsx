import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTutorialStore } from '@/store/tutorialStore';
import {
  BookOpen,
  Upload,
  FileText,
  Palette,
  Settings,
  Search,
  LayoutDashboard,
  ChevronRight,
  Star,
  FilePlus2,
  Moon,
  Tag,
  FileSearch,
  Sparkles,
  ArrowLeft,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface HelpArticle {
  id: string;
  title: string;
  icon: React.ElementType;
  category: string;
  keywords: string[];
  content: React.ReactNode;
}

const ARTICLES: HelpArticle[] = [
  {
    id: 'overview',
    title: 'Erste Schritte – Übersicht',
    icon: Star,
    category: 'Allgemein',
    keywords: ['start', 'anfang', 'einführung', 'übersicht', 'hilfe'],
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Willkommen beim Rechnungs-Manager! Diese App hilft dir, alle deine Rechnungen
          zu verwalten, zu kategorisieren und auszuwerten.
        </p>
        <Section title="Was kann diese App?">
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span><strong>Rechnungen erfassen</strong> – Manuell eingeben oder PDF hochladen & per KI automatisch auslesen</span></li>
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span><strong>Kategorisieren</strong> – Einnahmen, Ausgaben, AfA, GWG, Software-Abos und mehr</span></li>
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span><strong>Auswerten</strong> – Dashboard mit KPIs, Umsatzcharts und Kategorie-Donut</span></li>
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span><strong>Exportieren</strong> – Als Excel-Tabelle oder PDF-Sammelrechnung</span></li>
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span><strong>Vorlagen gestalten</strong> – Eigene Rechnungsvorlagen im Drag-&-Drop-Designer</span></li>
          </ul>
        </Section>
        <Section title="Empfohlene erste Schritte">
          <ol className="space-y-2 text-sm list-decimal list-inside">
            <li>Profildaten hinterlegen (Einstellungen → Persönliche Daten)</li>
            <li>Gemini API-Key eintragen für KI-Erkennung</li>
            <li>Erste Rechnung hochladen oder manuell erfassen</li>
            <li>Dashboard anschauen</li>
          </ol>
        </Section>
      </div>
    ),
  },
  {
    id: 'pdf-upload',
    title: 'PDF hochladen & KI-Erkennung',
    icon: Upload,
    category: 'Rechnungen',
    keywords: ['pdf', 'upload', 'hochladen', 'ki', 'gemini', 'erkennung', 'automatisch', 'scan'],
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Der schnellste Weg, eine Rechnung zu erfassen: PDF hochladen und die KI liest alle
          relevanten Felder automatisch aus.
        </p>
        <Section title="Schritt für Schritt">
          <Steps>
            <Step n={1} title='Seite "Rechnung schreiben" öffnen'>
              Im Seitenmenü auf <em>Rechnung schreiben</em> klicken oder <Kbd>Ctrl K</Kbd> → „Rechnung schreiben" eingeben.
            </Step>
            <Step n={2} title="PDF auswählen">
              Im Upload-Bereich auf <em>PDF auswählen</em> klicken oder die Datei per Drag & Drop ablegen.
            </Step>
            <Step n={3} title="KI-Analyse starten">
              Sobald das PDF geladen ist, auf <em>Analysieren</em> klicken. Gemini liest Datum, Betrag,
              Beschreibung, Partner und Kategorie aus.
            </Step>
            <Step n={4} title="Prüfen & speichern">
              Die vorausgefüllten Felder prüfen, ggf. anpassen und auf <em>Speichern</em> klicken.
            </Step>
          </Steps>
        </Section>
        <Section title="Voraussetzung: Gemini API-Key">
          <p className="text-sm text-muted-foreground">
            Für die KI-Erkennung brauchst du einen kostenlosen Gemini API-Key von Google.
            Den Key trägst du unter <strong>Einstellungen → Gemini API-Key</strong> ein.
            Alle Daten bleiben lokal – der Key wird nie an Dritte weitergegeben.
          </p>
        </Section>
        <Tip>Auch ohne KI kannst du Rechnungen manuell erfassen, indem du alle Felder selbst ausfüllst.</Tip>
      </div>
    ),
  },
  {
    id: 'manual-invoice',
    title: 'Rechnung manuell erfassen',
    icon: FilePlus2,
    category: 'Rechnungen',
    keywords: ['manuell', 'neu', 'erstellen', 'eingabe', 'formular', 'erfassen'],
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Ohne PDF kannst du Rechnungen auch komplett von Hand eingeben.
        </p>
        <Section title="Felder erklärt">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1.5 pr-4 font-semibold">Feld</th>
                <th className="text-left py-1.5 font-semibold">Bedeutung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ['Datum', 'Rechnungsdatum (nicht Eingangsdatum)'],
                ['Beschreibung', 'Kurze Bezeichnung, z.B. "Webhosting Q1 2026"'],
                ['Partner', 'Auftraggeber oder Lieferant'],
                ['Netto / USt / Brutto', 'Beträge – Brutto wird automatisch berechnet'],
                ['Typ', 'Einnahme, Ausgabe oder Info'],
                ['Kategorie', 'Steuerliche Einordnung (s. Kategorienhilfe)'],
                ['Notiz', 'Freies Notizfeld für interne Anmerkungen'],
              ].map(([f, d]) => (
                <tr key={f}>
                  <td className="py-1.5 pr-4 font-medium">{f}</td>
                  <td className="py-1.5 text-muted-foreground">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
        <Tip>Über den Button „Neue Rechnung" oben rechts öffnet sich ein Schnelldialog für einfache Eingaben.</Tip>
      </div>
    ),
  },
  {
    id: 'categories',
    title: 'Kategorien erklärt',
    icon: Tag,
    category: 'Rechnungen',
    keywords: ['kategorie', 'einnahme', 'ausgabe', 'afa', 'gwg', 'software', 'abo', 'fremdleistung', 'vertrag', 'steuer', 'umsatz', 'privateinlage'],
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Die Kategorie bestimmt die steuerliche Einordnung einer Buchung. Kategorien sind <strong>nach Typ getrennt</strong> – je nach gewähltem Typ (Einnahme / Ausgabe / Info) erscheinen nur die passenden Kategorien.
        </p>
        <Section title="Einnahmen (Typ = Einnahme)">
          <div className="space-y-3 text-sm">
            {[
              { name: 'Umsatzerlöse (steuerpflichtig)', color: 'bg-green-500/15 text-green-700 dark:text-green-400', desc: 'Standard für Rechnungen mit 19% oder 7% MwSt. Entspricht Zeile 14 der Anlage EÜR.' },
              { name: 'Umsatzerlöse (steuerfrei / §19 UStG)', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400', desc: 'Einnahmen ohne MwSt – z.B. Kleinunternehmer, Exporte (Reverse-Charge), steuerfreie Leistungen. Zeile 15 EÜR.' },
              { name: 'USt-Erstattung vom Finanzamt', color: 'bg-teal-500/15 text-teal-700 dark:text-teal-400', desc: 'Geld, das du vom Finanzamt zurückbekommst (Umsatzsteuererklärung). Zeile 18 EÜR.' },
              { name: 'Privateinlage', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400', desc: 'Privates Geld, das du ins Unternehmen einlegst. Kein steuerpflichtiger Gewinn, erhöht aber dein Konto.' },
              { name: 'Verkauf von Anlagevermögen', color: 'bg-violet-500/15 text-violet-700 dark:text-violet-400', desc: 'Erlös aus dem Verkauf von Firmenvermögen (alter Laptop, Möbel, Fahrzeug). Buchhalterisch anders als normale Umsätze.' },
              { name: 'Erstattungen / Auslagen', color: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400', desc: 'Rückerstattungen, Auslagenerstattungen (durchlaufender Posten). Mindert zuvor gebuchte Ausgaben.' },
              { name: 'Sonstige Einnahmen', color: 'bg-lime-500/15 text-lime-700 dark:text-lime-400', desc: 'Alle anderen Einnahmen: erhaltene Donations/Spenden, Crowdfunding, nicht zuordenbare Erträge.' },
            ].map(({ name, color, desc }) => (
              <div key={name} className="flex items-start gap-3">
                <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${color}`}>{name}</span>
                <span className="text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Betriebsausgaben (Typ = Ausgabe)">
          <div className="space-y-3 text-sm">
            {[
              { name: 'Anlagevermögen / AfA', color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400', desc: 'Wirtschaftsgüter >800€ netto mit Nutzungsdauer >1 Jahr (z.B. Laptop, Maschinen). Werden über mehrere Jahre abgeschrieben.' },
              { name: 'GWG (Geringwertige Wirtschaftsgüter)', color: 'bg-orange-500/15 text-orange-700 dark:text-orange-400', desc: 'Anschaffungen bis 800€ netto – sofort vollständig abziehbar (Monitor, Tastatur, Bürostuhl).' },
              { name: 'Software & Abos', color: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400', desc: 'Lizenzkosten, SaaS-Abos, App-Subscriptions, Cloud-Dienste (Adobe, GitHub, Hosting).' },
              { name: 'Fremdleistungen', color: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400', desc: 'Unterauftragnehmer, externe Dienstleister, Freelancer, Agenturen.' },
              { name: 'Bürobedarf & Material', color: 'bg-slate-500/15 text-slate-700 dark:text-slate-400', desc: 'Büromaterial, Druckerpatronen, Papier, Kleinmaterial.' },
              { name: 'Reisekosten', color: 'bg-teal-500/15 text-teal-700 dark:text-teal-400', desc: 'Fahrtkosten, Hotel, Flüge, Bahnfahrten für berufliche Reisen.' },
              { name: 'Marketing & Werbung', color: 'bg-pink-500/15 text-pink-700 dark:text-pink-400', desc: 'Online-Werbung, Drucksachen, Messen, PR-Maßnahmen.' },
              { name: 'Weiterbildung & Fachliteratur', color: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400', desc: 'Kurse, Seminare, Fachbücher, Konferenztickets.' },
              { name: 'Miete & Raumkosten', color: 'bg-lime-500/15 text-lime-700 dark:text-lime-400', desc: 'Büro-, Co-Working- oder Lagermiete.' },
              { name: 'Versicherungen (Betrieb)', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400', desc: 'Betriebliche Versicherungen, Haftpflicht, Inventarversicherung.' },
              { name: 'Fahrzeugkosten', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400', desc: 'KFZ-Kosten, Benzin, Leasing, Reparaturen (betrieblich).' },
              { name: 'Telefon & Internet', color: 'bg-sky-500/15 text-sky-700 dark:text-sky-400', desc: 'Mobilfunk, Festnetz, Internet für den Betrieb.' },
              { name: 'Sonstiges', color: 'bg-muted text-muted-foreground', desc: 'Betriebsausgaben, die in keine andere Ausgaben-Kategorie passen.' },
            ].map(({ name, color, desc }) => (
              <div key={name} className="flex items-start gap-3">
                <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${color}`}>{name}</span>
                <span className="text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Sonderausgaben (Typ = Ausgabe, kein regulärer Betriebsaufwand)">
          <div className="space-y-3 text-sm">
            {[
              { name: 'Spenden (Sonderausgabe)', color: 'bg-rose-500/15 text-rose-700 dark:text-rose-400', desc: 'Geldspenden an gemeinnützige Organisationen (type=Ausgabe). Steuerlich absetzbar als Sonderausgabe, aber KEIN Betriebsaufwand. Twitch-Subs/Gaming-Subs → Kategorie "Privat"!' },
              { name: 'Krankenversicherung', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400', desc: 'Beiträge zur gesetzlichen oder privaten Kranken- und Pflegeversicherung.' },
              { name: 'Sozialversicherung / Altersvorsorge', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400', desc: 'Rentenversicherung, Berufsgenossenschaft, berufsständische Versorgungswerke.' },
            ].map(({ name, color, desc }) => (
              <div key={name} className="flex items-start gap-3">
                <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${color}`}>{name}</span>
                <span className="text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Privat (Typ = Ausgabe, weder Betriebsausgabe noch absetzbar)">
          <div className="space-y-3 text-sm">
            {[
              { name: 'Privat (nicht absetzbar)', color: 'bg-gray-500/15 text-gray-600 dark:text-gray-400', desc: 'Rein private Ausgaben ohne Geschäftsbezug: Netflix, Spotify, Gaming-Abos, private Einkäufe. Senkt dein Saldo, aber steuerlich komplett irrelevant.' },
              { name: 'Privatentnahme', color: 'bg-gray-500/15 text-gray-600 dark:text-gray-400', desc: 'Überweisung von Firmen- auf Privatkonto. Kein Betriebsaufwand, keine Steuerrelevanz.' },
            ].map(({ name, color, desc }) => (
              <div key={name} className="flex items-start gap-3">
                <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${color}`}>{name}</span>
                <span className="text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Info-Dokumente (Typ = Info)">
          <div className="space-y-3 text-sm">
            {[
              { name: 'Verträge', color: 'bg-violet-500/15 text-violet-700 dark:text-violet-400', desc: 'Verträge, AGBs, Bestätigungen, Informationsschreiben ohne direkten Zahlungsbetrag.' },
              { name: 'Sonstiges', color: 'bg-muted text-muted-foreground', desc: 'Sonstige Info-Dokumente.' },
            ].map(({ name, color, desc }) => (
              <div key={name} className="flex items-start gap-3">
                <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${color}`}>{name}</span>
                <span className="text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </Section>
        <Tip>Die KI-Erkennung schlägt automatisch eine Kategorie vor – du kannst sie jederzeit ändern. Das Fehler-Icon oben in der Toolbar zeigt dir, welche Belege noch neu zugeordnet werden müssen.</Tip>
      </div>
    ),
  },
  {
    id: 'dashboard',
    title: 'Dashboard & Auswertungen',
    icon: LayoutDashboard,
    category: 'Auswertungen',
    keywords: ['dashboard', 'kpi', 'umsatz', 'statistik', 'chart', 'diagramm', 'auswertung', 'gewinn'],
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Das Dashboard zeigt dir auf einen Blick alle wichtigen Kennzahlen des ausgewählten Jahres.
        </p>
        <Section title="KPI-Karten">
          <ul className="space-y-2 text-sm">
            {[
              ['Gesamteinnahmen', 'Summe aller Buchungen vom Typ „Einnahme"'],
              ['Gesamtausgaben', 'Summe aller Buchungen vom Typ „Ausgabe"'],
              ['Gewinn (netto)', 'Einnahmen minus Ausgaben'],
              ['Offene Posten', 'Rechnungen ohne hinterlegtes PDF'],
            ].map(([k, v]) => (
              <li key={k} className="flex gap-2">
                <span className="font-medium w-40 shrink-0">{k}</span>
                <span className="text-muted-foreground">{v}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Jahresauswahl">
          <p className="text-sm text-muted-foreground">
            Mit dem Jahres-Dropdown oben links im Dashboard wechselst du zwischen den Jahren.
            Nur Rechnungen des ausgewählten Jahres werden angezeigt.
          </p>
        </Section>
        <Section title="Privatsphäre-Modus">
          <p className="text-sm text-muted-foreground">
            Das Auge-Symbol oben rechts blendet alle Beträge aus – praktisch für Bildschirmfreigaben.
          </p>
        </Section>
      </div>
    ),
  },
  {
    id: 'export',
    title: 'Daten exportieren',
    icon: FileText,
    category: 'Auswertungen',
    keywords: ['export', 'excel', 'csv', 'pdf', 'herunterladen', 'ausgabe', 'steuerberater'],
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Exportiere deine Daten für den Steuerberater oder zur eigenen Archivierung.
        </p>
        <Section title="Export starten">
          <Steps>
            <Step n={1} title='Button "Exportieren" klicken'>
              Oben rechts in der Topbar. Alternativ: <Kbd>Ctrl K</Kbd> → „exportieren".
            </Step>
            <Step n={2} title="Format wählen">
              <strong>Excel (.xlsx)</strong> – Tabelle mit allen Rechnungsfeldern, gut für den Steuerberater.<br />
              <strong>PDF</strong> – Zusammenfassung als druckbares Dokument.
            </Step>
            <Step n={3} title="Filter setzen">
              Du kannst den Export auf ein bestimmtes Jahr oder eine Kategorie beschränken.
            </Step>
          </Steps>
        </Section>
        <Tip>Der Export enthält immer nur die Rechnungen des aktuell ausgewählten Jahres, es sei denn, du wählst „Alle Jahre".</Tip>
      </div>
    ),
  },
  {
    id: 'designer',
    title: 'Rechnungsvorlagen gestalten',
    icon: Palette,
    category: 'Designer',
    keywords: ['designer', 'vorlage', 'template', 'variable', 'gestalten', 'layout', 'drag', 'drop'],
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Im Template Designer kannst du eigene Rechnungsvorlagen per Drag & Drop erstellen.
        </p>
        <Section title="Grundkonzept">
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span>Jede Vorlage besteht aus frei platzierbaren <strong>Elementen</strong> (Text, Bild, Tabelle, Linie)</span></li>
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span><strong>Variablen</strong> wie <code className="rounded bg-muted px-1">{'{{name}}'}</code> werden beim Drucken durch echte Daten ersetzt</span></li>
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span>Mehrere Vorlagen möglich – du wählst beim Drucken welche genutzt wird</span></li>
          </ul>
        </Section>
        <Section title="Wichtige Variablen">
          <div className="grid grid-cols-2 gap-1 text-xs font-mono">
            {[
              ['{{name}}', 'Dein Name / Firma'],
              ['{{address}}', 'Deine Adresse'],
              ['{{invoice_nr}}', 'Rechnungsnummer'],
              ['{{date}}', 'Rechnungsdatum'],
              ['{{partner}}', 'Empfänger'],
              ['{{total}}', 'Gesamtbetrag'],
              ['{{items}}', 'Positionstabelle'],
              ['{{tax_number}}', 'Steuernummer'],
            ].map(([v, d]) => (
              <div key={v} className="flex flex-col rounded bg-muted px-2 py-1">
                <span className="text-primary">{v}</span>
                <span className="text-muted-foreground font-sans">{d}</span>
              </div>
            ))}
          </div>
        </Section>
        <Tip>Die eingebauten Standardvorlagen können als Ausgangspunkt kopiert und angepasst werden.</Tip>
      </div>
    ),
  },
  {
    id: 'settings-profile',
    title: 'Profildaten hinterlegen',
    icon: Settings,
    category: 'Einstellungen',
    keywords: ['profil', 'name', 'adresse', 'steuer', 'iban', 'bic', 'einrichten', 'konfiguration'],
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Deine Profildaten werden von der KI genutzt, um Rechnungen korrekt als Einnahme oder
          Ausgabe einzustufen, und erscheinen in deinen Vorlagen.
        </p>
        <Section title="Felder">
          <ul className="space-y-1.5 text-sm">
            {[
              ['Name / Firma', 'Dein vollständiger Name oder Firmenname'],
              ['Adresse', 'Straße, PLZ, Ort'],
              ['Steuernummer', 'Format: 12/345/67890'],
              ['USt-IdNr.', 'Format: DE123456789 (falls vorhanden)'],
              ['IBAN & BIC', 'Bankverbindung für Rechnungen'],
              ['E-Mail & Telefon', 'Kontaktdaten'],
              ['Branche / Tätigkeit', 'z.B. "Softwareentwicklung, Freelancer" – hilft der KI'],
            ].map(([f, d]) => (
              <li key={f} className="flex gap-2">
                <span className="font-medium w-36 shrink-0">{f}</span>
                <span className="text-muted-foreground">{d}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Tip>Je mehr Profildaten du einträgst, desto präziser erkennt die KI Rechnungstypen und -kategorien.</Tip>
      </div>
    ),
  },
  {
    id: 'search',
    title: 'Suche & Tastaturkürzel',
    icon: Search,
    category: 'Allgemein',
    keywords: ['suche', 'shortcut', 'tastenkürzel', 'ctrl', 'strg', 'keyboard', 'schnell'],
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Die globale Suche findest du überall in der App – sie durchsucht Rechnungen, Seiten,
          Einstellungen und Hilfe gleichzeitig.
        </p>
        <Section title="Suche öffnen">
          <div className="flex items-center gap-3 text-sm">
            <Kbd>Ctrl</Kbd><span>+</span><Kbd>K</Kbd>
            <span className="text-muted-foreground">oder Klick auf die Suchleiste oben</span>
          </div>
        </Section>
        <Section title="Was wird durchsucht?">
          <ul className="space-y-2 text-sm">
            {[
              ['🧭 Navigation', 'Alle Seiten der App'],
              ['📄 Rechnungen', 'Beschreibung, Partner, Notizen, Betrag, Datum'],
              ['⚙️ Einstellungen', 'Profildaten, Dark Mode, Datenschutz'],
              ['❓ Hilfe', 'Alle Anleitungen (diese Seite)'],
              ['📑 PDF-Inhalte', 'Volltext der hinterlegten PDFs (opt-in, langsam)'],
            ].map(([cat, desc]) => (
              <li key={cat} className="flex gap-3">
                <span className="w-40 shrink-0 font-medium">{cat}</span>
                <span className="text-muted-foreground">{desc}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Alle Tastaturkürzel">
          <div className="space-y-2 text-sm">
            {[
              [['Ctrl', 'K'], 'Suche öffnen'],
              [['Esc'], 'Suche / Dialog schließen'],
              [['↑', '↓'], 'In Suchergebnissen navigieren'],
              [['↵'], 'Ergebnis öffnen'],
            ].map(([keys, desc]) => (
              <div key={desc as string} className="flex items-center gap-3">
                <div className="flex gap-1">
                  {(keys as string[]).map((k) => <Kbd key={k}>{k}</Kbd>)}
                </div>
                <span className="text-muted-foreground">{desc as string}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    ),
  },
  {
    id: 'privacy-dark',
    title: 'Dark Mode & Privatsphäre',
    icon: Moon,
    category: 'Einstellungen',
    keywords: ['dark', 'dunkel', 'hell', 'privat', 'privacy', 'betrag', 'ausblenden', 'theme'],
    content: (
      <div className="space-y-4">
        <Section title="Dark Mode">
          <p className="text-sm text-muted-foreground">
            Wechsle zwischen hellem und dunklem Design über:
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li className="flex items-center gap-2"><ChevronRight className="h-4 w-4 shrink-0 text-primary" />Mond/Sonne-Symbol oben rechts in der Topbar</li>
            <li className="flex items-center gap-2"><ChevronRight className="h-4 w-4 shrink-0 text-primary" />Einstellungen → Erscheinungsbild → Dark Mode</li>
            <li className="flex items-center gap-2"><ChevronRight className="h-4 w-4 shrink-0 text-primary" /><Kbd>Ctrl K</Kbd> → „Dark Mode aktivieren"</li>
          </ul>
        </Section>
        <Section title="Privatsphäre-Modus">
          <p className="text-sm text-muted-foreground">
            Das Auge-Symbol neben dem Dark-Mode-Toggle blendet alle Geldbeträge in der App aus.
            Praktisch, wenn du deinen Bildschirm teilst und keine Zahlen zeigen möchtest.
            Die Daten werden nicht gelöscht – sie werden nur versteckt.
          </p>
        </Section>
      </div>
    ),
  },
  {
    id: 'pdf-search',
    title: 'PDF-Inhalte durchsuchen',
    icon: FileSearch,
    category: 'Suche',
    keywords: ['pdf', 'suche', 'volltext', 'inhalt', 'durchsuchen', 'langsam'],
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Die Suche kann optional den Volltext aller hinterlegten PDFs durchsuchen.
          Das ist langsamer, da jede PDF-Datei zuerst eingelesen werden muss.
        </p>
        <Section title="PDF-Suche aktivieren">
          <Steps>
            <Step n={1} title="Suche öffnen"><Kbd>Ctrl K</Kbd></Step>
            <Step n={2} title='Häkchen setzen'>
              Unter dem Suchfeld die Checkbox <em>„PDF-Inhalte durchsuchen (langsam)"</em> aktivieren.
            </Step>
            <Step n={3} title="Suchbegriff eingeben">
              Der Suchbegriff wird jetzt auch im Text aller PDFs gesucht.
              Treffer zeigen einen Textausschnitt aus dem PDF als Vorschau.
            </Step>
          </Steps>
        </Section>
        <Tip>Die PDF-Suche liest die Dateien bei jedem Suchvorgang neu ein. Bei vielen PDFs kann das einige Sekunden dauern.</Tip>
      </div>
    ),
  },
  {
    id: 'ai-recognition',
    title: 'KI-Erkennung mit Gemini',
    icon: Sparkles,
    category: 'Rechnungen',
    keywords: ['ki', 'ai', 'gemini', 'google', 'erkennung', 'automatisch', 'apikey', 'key'],
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Die App nutzt Google Gemini, um hochgeladene PDFs automatisch auszulesen.
        </p>
        <Section title="API-Key einrichten">
          <Steps>
            <Step n={1} title="Google AI Studio besuchen">
              Gehe auf <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">aistudio.google.com</a> und erstelle einen kostenlosen API-Key.
            </Step>
            <Step n={2} title="Key eintragen">
              Einstellungen → Gemini API-Key → Key einfügen → Speichern.
            </Step>
            <Step n={3} title="PDF analysieren">
              Jetzt beim PDF-Upload den Analyse-Button nutzen.
            </Step>
          </Steps>
        </Section>
        <Section title="Was erkennt die KI?">
          <ul className="space-y-1.5 text-sm">
            {['Datum', 'Rechnungsbetrag (Netto, USt, Brutto)', 'Beschreibung / Leistungsart', 'Geschäftspartner', 'Rechnungstyp (Einnahme / Ausgabe)', 'Kategorie'].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </Section>
        <Tip>Der API-Key wird ausschließlich lokal in der SQLite-Datenbank gespeichert und nie an Dritte weitergegeben.</Tip>
      </div>
    ),
  },
  {
    id: 'forecast',
    title: 'Prognosen & Mustererkennung',
    icon: TrendingUp,
    category: 'Auswertungen',
    keywords: ['prognose', 'muster', 'wiederholung', 'abo', 'vorhersage', 'symmetrie', 'regelmäßig', 'monatlich', 'algorythmus', 'erkennung', '28 tage'],
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Der Rechnungs-Manager erkennt automatisch wiederkehrende Zahlungsmuster – egal ob offizielle
          Abonnements oder einfach monatlich gleichartige Einkäufe. Daraus wird eine Prognose für den
          restlichen Monat berechnet.
        </p>

        <Section title="Wie funktioniert die Mustererkennung?">
          <p className="text-sm text-muted-foreground mb-3">
            Der Algorithmus gruppiert alle Rechnungen nach dem Schlüssel <strong>Partner + Kategorie + Typ</strong>.
            Innerhalb jeder Gruppe wird geprüft, ob die zeitlichen Abstände zwischen den Einträgen
            einem regelmäßigen Intervall entsprechen.
          </p>
          <div className="space-y-2 text-sm">
            {[
              ['Mindestanzahl', 'Mindestens 3 Einträge in der Gruppe – sonst kein Muster.'],
              ['Intervall-Erkennung', 'Median der Tagesabstände. Toleranz ±30 %: wöchentlich (~7 d), monatlich (~30 d), quartalsweise (~91 d), jährlich (~365 d).'],
              ['Betragsanalyse', 'Der Median aller Beträge wird als Prognose-Betrag verwendet – robust gegenüber temporären Rabatten oder Sonderkonditionen.'],
              ['Ausreißer', 'Bis zu 30 % abweichende Einträge werden toleriert, ohne das Muster zu entwerten (z. B. 3 Rabattmonate in einem Jahres-Abo).'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <span className="font-medium w-40 shrink-0">{k}</span>
                <span className="text-muted-foreground">{v}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Konfidenz-Score">
          <p className="text-sm text-muted-foreground mb-3">
            Jedes erkannte Muster erhält einen Konfidenz-Wert zwischen 0 und 1, der aus drei Faktoren berechnet wird:
          </p>
          <div className="rounded-lg border border-border overflow-hidden text-sm">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-3 py-2 font-semibold">Faktor</th>
                  <th className="text-left px-3 py-2 font-semibold">Gewichtung</th>
                  <th className="text-left px-3 py-2 font-semibold">Bedeutung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="px-3 py-2 font-medium">Anzahl</td>
                  <td className="px-3 py-2 text-muted-foreground">30 %</td>
                  <td className="px-3 py-2 text-muted-foreground">3 Einträge = niedrig, ab 10+ = maximal</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium">Betrag</td>
                  <td className="px-3 py-2 text-muted-foreground">30 %</td>
                  <td className="px-3 py-2 text-muted-foreground">Weniger Ausreißer = höhere Konfidenz</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium">Regelmäßigkeit</td>
                  <td className="px-3 py-2 text-muted-foreground">40 %</td>
                  <td className="px-3 py-2 text-muted-foreground">Wie konstant sind die Zeitabstände?</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2.5 py-0.5 font-medium">Hoch ≥ 0.7</span>
            <span className="rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-2.5 py-0.5 font-medium">Mittel ≥ 0.4</span>
            <span className="rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 px-2.5 py-0.5 font-medium">Niedrig &lt; 0.4</span>
          </div>
        </Section>

        <Section title="Prognose-Liste im Dashboard">
          <p className="text-sm text-muted-foreground mb-2">
            Die Prognose-Karte erscheint nur wenn es tatsächlich Vorhersagen gibt – sie wird ausgeblendet wenn nichts erwartet wird.
          </p>
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span>Nur Muster deren nächster Termin <strong>heute oder später</strong> im laufenden Monat liegt werden gezeigt.</span></li>
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span>Bereits vergangene Fälligkeiten werden <strong>nicht</strong> angezeigt.</span></li>
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span>Oben in der Karte steht eine Zusammenfassung: erwartete Einnahmen und Ausgaben.</span></li>
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span>Die Prognose nutzt <strong>alle historischen Rechnungen</strong>, nicht nur das aktuell gewählte Jahr.</span></li>
          </ul>
        </Section>

        <Section title="Letzte-28-Tage-Chart">
          <p className="text-sm text-muted-foreground">
            Unabhängig von den Prognosen zeigt ein Balkendiagramm die täglichen Einnahmen und Ausgaben
            der letzten 28 Tage. Jeder Balken steht für einen Tag – die X-Achse wird alle 7 Tage
            beschriftet. Auch dieser Chart nutzt alle Rechnungen (jahresübergreifend).
          </p>
        </Section>

        <Tip>
          Muster werden rein algorithmisch berechnet – es werden keine Daten gespeichert oder verändert.
          Die Prognose ist eine Wahrscheinlichkeit, keine Gewissheit.
        </Tip>
      </div>
    ),
  },
];

const CATEGORIES = [...new Set(ARTICLES.map((a) => a.category))];

// ─── Helper-Komponenten ────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="space-y-3">{children}</ol>;
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
        {n}
      </span>
      <div>
        <span className="font-medium">{title}: </span>
        <span className="text-muted-foreground">{children}</span>
      </div>
    </li>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-mono">
      {children}
    </kbd>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-lg border border-yellow-400/30 bg-yellow-500/10 p-3 text-sm">
      <span className="shrink-0">💡</span>
      <span className="text-muted-foreground">{children}</span>
    </div>
  );
}

// ─── Hauptseite ────────────────────────────────────────────────────────────

export default function HelpPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialArticle = searchParams.get('article') ?? ARTICLES[0].id;
  const resetTutorial = useTutorialStore((s) => s.resetTutorial);
  const startTutorial = useTutorialStore((s) => s.startTutorial);

  const [selected, setSelected] = useState<string>(initialArticle);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = ARTICLES.filter((a) => {
    const matchesSearch =
      !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.keywords.some((k) => k.includes(search.toLowerCase()));
    const matchesCat = !activeCategory || a.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  const article = ARTICLES.find((a) => a.id === selected) ?? ARTICLES[0];
  const ArticleIcon = article.icon;

  return (
    <div className="flex h-full gap-0 -m-6 min-h-0">
      {/* Sidebar */}
      <aside className="w-72 shrink-0 flex flex-col border-r border-border bg-muted/30 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => navigate(-1)}
              className="rounded-md p-1 hover:bg-muted transition-colors text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <span className="font-semibold text-base">Hilfe & Anleitungen</span>
            </div>
          </div>
          {/* Suche in Hilfe */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Artikel suchen…"
              className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* Tutorial neu starten */}
        <div className="px-4 py-3 border-b border-border">
          <button
            data-tutorial="tutorial-restart-btn"
            onClick={() => { resetTutorial(); setTimeout(() => startTutorial(), 100); }}
            className="flex items-center gap-2 w-full rounded-lg bg-primary/10 border border-primary/20 text-primary px-3 py-2 text-xs font-medium hover:bg-primary/20 transition-colors"
          >
            <span>🎓</span>
            Geführtes Tutorial neu starten
          </button>
        </div>

        {/* Kategoriefilter */}
        <div className="flex flex-wrap gap-1 px-4 py-2 border-b border-border">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              'text-[11px] rounded-full px-2 py-0.5 border transition-colors',
              !activeCategory
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:bg-muted'
            )}
          >
            Alle
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={cn(
                'text-[11px] rounded-full px-2 py-0.5 border transition-colors',
                activeCategory === cat
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:bg-muted'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Artikelliste */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground px-3 py-4 text-center">Kein Artikel gefunden</p>
          )}
          {filtered.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.id}
                onClick={() => setSelected(a.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-left transition-colors',
                  selected === a.id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{a.title}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <ArticleIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{article.category}</p>
              <h1 className="text-xl font-bold">{article.title}</h1>
            </div>
          </div>
          <div className="prose-sm space-y-5">
            {article.content}
          </div>
        </div>
      </main>
    </div>
  );
}


