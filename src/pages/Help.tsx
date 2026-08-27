import { useRef, useState } from 'react';
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
  GraduationCap,
  Wallet,
  TrendingUp,
  Shield,
  Calculator,
  FileSpreadsheet,
  ClipboardList,
  Globe,
  Receipt,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useIsMobile';
import { PageHeader } from '@/components/layout/PageHeader';
import { SearchField } from '@/components/ui/search-field';
import { Chip } from '@/components/ui/chip';
import { ListGroup, ListRow, type ListTint } from '@/components/ui/list-group';

/** Farbe der Symbolkachel je Kategorie – das Apple-Theme färbt danach ein. */
const CATEGORY_TINTS: Record<string, ListTint> = {
  Allgemein: 'blue',
  Rechnungen: 'green',
  Auswertungen: 'purple',
  Designer: 'pink',
  Einstellungen: 'gray',
  Suche: 'orange',
  Steuern: 'red',
  Compliance: 'indigo',
};

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
    id: 'angestellt',
    title: 'Als Angestellter: was sich lohnt zu sammeln',
    icon: Wallet,
    category: 'Steuern',
    keywords: ['angestellt', 'arbeitnehmer', 'werbungskosten', 'gehalt', 'lohn', 'anlage n', 'pendler', 'homeoffice', 'handwerker', '35a'],
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Wer angestellt ist, führt keinen Betrieb: Es gibt keine Umsatzsteuer und keine
          Betriebsausgaben. Für die Steuererklärung zählen vier andere Töpfe – und für alle vier
          gilt: ohne Beleg kein Abzug.
        </p>

        <Section title="1. Werbungskosten (Anlage N)">
          <p className="text-sm text-muted-foreground mb-2">
            Alles rund um den Job. Das Finanzamt zieht ohnehin <strong>1.230 €</strong> pauschal ab –
            sammeln lohnt sich also erst, wenn du darüber kommst. Der Steuerbericht zeigt, wie weit
            du bist.
          </p>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span><strong>Weg zur Arbeit</strong> – 0,38 € je Entfernungskilometer, ab dem ersten Kilometer. Einfache Strecke, nicht Hin- und Rückweg.</span></li>
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span><strong>Homeoffice</strong> – 6 € je Tag, höchstens 210 Tage (1.260 €). Am selben Tag entweder Pendeln oder Homeoffice, nicht beides.</span></li>
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span><strong>Arbeitsmittel</strong> – Laptop, Werkzeug, Fachbuch, Arbeitskleidung. Bis 952 € brutto sofort, teurer über die Nutzungsdauer.</span></li>
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span><strong>Fortbildung, Bewerbung, Gewerkschaft</strong> und nicht erstattete Dienstreisen.</span></li>
          </ul>
        </Section>

        <Section title="2. Haushalt und Handwerker (§ 35a)">
          <p className="text-sm text-muted-foreground">
            Der stärkste Hebel: <strong>20 % gehen direkt von der Steuer ab</strong>, nicht bloß vom
            Einkommen. Haushaltsnahe Dienstleistungen bis 20.000 € im Jahr (also bis 4.000 €
            Ersparnis), Handwerker bis 6.000 € (1.200 €).
          </p>
          <Tip>
            Nur der <strong>Arbeitsanteil</strong> zählt, Material nicht – und die Rechnung muss
            überwiesen sein. Bar bezahlt erkennt das Finanzamt nicht an.
          </Tip>
        </Section>

        <Section title="3. Sonderausgaben">
          <p className="text-sm text-muted-foreground">
            Kranken-, Pflege- und Rentenversicherung, Haftpflicht, Berufsunfähigkeit,
            Kinderbetreuung, Spenden, Kirchensteuer.
          </p>
        </Section>

        <Section title="4. Außergewöhnliche Belastungen">
          <p className="text-sm text-muted-foreground">
            Arzt, Zahnersatz, Brille, Pflege. Sie wirken erst über der <em>zumutbaren Belastung</em> –
            je nach Einkommen 1 bis 7 %. Deshalb lohnt es sich, größere Behandlungen in ein Jahr zu
            legen.
          </p>
        </Section>

        <Section title="Und das Gehalt?">
          <p className="text-sm text-muted-foreground">
            Dafür gibt es keinen Beleg – es kommt jeden Monat von selbst. Es steht deshalb unter
            <strong> Gehalt</strong>: einmal eintragen, ab wann du wie viel bekommst. Eine Erhöhung
            ist eine neue Stufe, Sonderzahlungen wie das 13. Gehalt stehen daneben.
          </p>
        </Section>
      </div>
    ),
  },
  {
    id: 'euer',
    title: 'Die EÜR und deine Steuererklärung',
    icon: Receipt,
    category: 'Steuern',
    keywords: ['euer', 'eür', 'einnahmen', 'überschuss', 'gewinnermittlung', 'steuererklärung', 'einkommensteuer', 'anlage s', 'anlage g', 'vorsorgeaufwand', 'frist', 'abgabe', 'elster', 'zufluss', 'abfluss', 'sonderausgabe', 'selbständig'],
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Wer selbständig ist, muss dem Finanzamt einmal im Jahr sagen, was übrig geblieben ist.
          Für die meisten reicht dafür die einfachste Form der Gewinnermittlung: die
          Einnahmen-Überschuss-Rechnung nach <strong>§ 4 Abs. 3 EStG</strong> – Betriebseinnahmen
          minus Betriebsausgaben, ohne Bilanz und ohne Inventur.
        </p>

        <Section title="Wer die EÜR nutzen darf">
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span><strong>Freiberufler</strong> dürfen sie immer – unabhängig von Umsatz und Gewinn.</span></li>
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span><strong>Gewerbetreibende</strong>, solange sie unter den Grenzen des § 141 AO bleiben: für Wirtschaftsjahre nach dem 31.12.2023 mehr als <strong>800.000 € Umsatz</strong> oder mehr als <strong>80.000 € Gewinn</strong>.</span></li>
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span>Die Buchführungspflicht beginnt nicht von allein: Erst wenn das Finanzamt dazu auffordert, muss ab dem folgenden Wirtschaftsjahr bilanziert werden.</span></li>
          </ul>
        </Section>

        <Section title="Zufluss und Abfluss (§ 11 EStG)">
          <p className="text-sm text-muted-foreground mb-2">
            In der EÜR zählt der Tag der <strong>Zahlung</strong>, nicht das Rechnungsdatum. Eine
            im Dezember geschriebene, im Januar bezahlte Rechnung gehört ins neue Jahr. Das ist
            der wichtigste Unterschied zur Bilanz – und der einfachste Hebel: Wer eine Anschaffung
            um zwei Wochen vorzieht oder eine Rechnung später stellt, verschiebt den Gewinn.
          </p>
          <Tip>
            <strong>Zehn-Tage-Regel:</strong> Regelmäßig wiederkehrende Zahlungen – Miete,
            Beiträge, die Umsatzsteuer-Vorauszahlung – werden dem Jahr zugerechnet, zu dem sie
            wirtschaftlich gehören, wenn sie innerhalb von zehn Tagen um den Jahreswechsel
            fließen. Die Dezember-Miete, am 3. Januar überwiesen, gehört also noch ins alte Jahr.
          </Tip>
        </Section>

        <Section title="Die EÜR ist nur eine Anlage">
          <p className="text-sm text-muted-foreground">
            Es gibt keine eigene „EÜR-Erklärung". Die Anlage EÜR hängt an deiner ganz normalen,
            <strong> privaten Einkommensteuererklärung</strong> – zusammen mit dem Gehalt eines
            Nebenjobs, den Sonderausgaben und allem anderen. Und selbständig heißt: immer
            erklärungspflichtig (§ 56 EStDV), auch bei einem Verlust. Gerade dann lohnt es sich,
            weil der Verlust mit anderen Einkünften verrechnet wird.
          </p>
        </Section>

        <Section title="Welche Formulare dazugehören">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1.5 pr-4 font-semibold">Formular</th>
                <th className="text-left py-1.5 font-semibold">Wofür</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-muted-foreground">
              <tr><td className="py-1.5 pr-4 font-medium text-foreground">Hauptvordruck ESt 1 A</td><td className="py-1.5">Der Mantel: Person, Konto, Spenden, Kirchensteuer, § 35a</td></tr>
              <tr><td className="py-1.5 pr-4 font-medium text-foreground">Anlage EÜR</td><td className="py-1.5">Die Gewinnermittlung selbst – Einnahmen, Ausgaben, AfA</td></tr>
              <tr><td className="py-1.5 pr-4 font-medium text-foreground">Anlage S oder G</td><td className="py-1.5">Trägt den Gewinn ein: S für Freiberufler, G für Gewerbe</td></tr>
              <tr><td className="py-1.5 pr-4 font-medium text-foreground">Anlage Vorsorgeaufwand</td><td className="py-1.5">Kranken-, Pflege- und Rentenversicherung</td></tr>
              <tr><td className="py-1.5 pr-4 font-medium text-foreground">Gewerbesteuererklärung</td><td className="py-1.5">Nur bei Gewerbe, und praktisch erst über 24.500 € Gewinn</td></tr>
            </tbody>
          </table>
          <p className="text-sm text-muted-foreground mt-2">
            Als Kleinunternehmer entfällt die Umsatzsteuer-Jahreserklärung seit dem
            Besteuerungszeitraum 2024 – außer das Finanzamt fordert sie an oder du schuldest
            Steuer nach § 13b UStG.
          </p>
        </Section>

        <Section title="Fristen">
          <div className="space-y-2 text-sm">
            {[
              ['Steuerjahr 2025', '31.07.2026 ohne Steuerberater, 01.03.2027 mit Steuerberater'],
              ['Steuerjahr 2026', '31.07.2027 ohne Steuerberater, 28.02.2028 mit Steuerberater'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <span className="font-medium w-36 shrink-0">{k}</span>
                <span className="text-muted-foreground">{v}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Fällt der Termin auf ein Wochenende oder einen Feiertag, verschiebt er sich auf den
            nächsten Werktag. Eine Fristverlängerung ist formlos möglich, aber begründungspflichtig.
          </p>
        </Section>

        <Section title="Betriebsausgabe oder Sonderausgabe?">
          <p className="text-sm text-muted-foreground mb-2">
            Beides ist absetzbar – aber an völlig verschiedenen Stellen. Das ist die häufigste
            Verwechslung überhaupt.
          </p>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1.5 pr-4 font-semibold">Art</th>
                <th className="text-left py-1.5 pr-4 font-semibold">Wirkt auf</th>
                <th className="text-left py-1.5 font-semibold">Beispiele</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-muted-foreground">
              <tr><td className="py-1.5 pr-4 font-medium text-foreground">Betriebsausgabe</td><td className="py-1.5 pr-4">den Gewinn, in der Anlage EÜR</td><td className="py-1.5">Miete, Software, Fremdleistung, Berufsgenossenschaft</td></tr>
              <tr><td className="py-1.5 pr-4 font-medium text-foreground">Sonderausgabe</td><td className="py-1.5 pr-4">das zu versteuernde Einkommen, eine Stufe später</td><td className="py-1.5">Kranken- und Pflegeversicherung, Altersvorsorge, Spenden</td></tr>
              <tr><td className="py-1.5 pr-4 font-medium text-foreground">Privat</td><td className="py-1.5 pr-4">gar nichts</td><td className="py-1.5">Netflix, private Einkäufe, Privatentnahme</td></tr>
            </tbody>
          </table>
          <p className="text-sm text-muted-foreground mt-2">
            Deshalb taucht deine Krankenversicherung im Gewinn nicht auf, obwohl sie oft der
            größte Posten des Jahres ist – sie wirkt erst in der Anlage Vorsorgeaufwand.
          </p>
        </Section>

        <Tip>
          Die Anlage EÜR muss <strong>elektronisch übermittelt</strong> werden (§ 60 Abs. 4
          EStDV) – über ELSTER oder ein Steuerprogramm. Eine formlose Gewinnermittlung auf Papier
          gibt es seit dem Formular für 2017 nicht mehr, und zwar auch für Kleinunternehmer
          nicht. Der Excel-Export und die Buchungs-CSV dieser App liefern die Zahlen dafür.
        </Tip>
      </div>
    ),
  },
  {
    id: 'overview',
    title: 'Erste Schritte – Übersicht',
    icon: Star,
    category: 'Allgemein',
    keywords: ['start', 'anfang', 'einführung', 'übersicht', 'hilfe'],
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Willkommen beim Klevr! Diese App hilft dir, alle deine Rechnungen
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
              { name: 'Umsatzerlöse (steuerpflichtig)', color: 'bg-green-500/15 text-green-700 dark:text-green-400', desc: 'Standard für Rechnungen mit 19% oder 7% MwSt. In der Anlage EÜR die Zeile „Umsatzsteuerpflichtige Betriebseinnahmen".' },
              { name: 'Umsatzerlöse (steuerfrei / §19 UStG)', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400', desc: 'Einnahmen ohne MwSt – z.B. Kleinunternehmer, Exporte, steuerfreie Leistungen. In der Anlage EÜR die Zeile „Umsatzsteuerfreie … Betriebseinnahmen".' },
              { name: 'Reverse Charge (§ 13b UStG)', color: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400', desc: 'Einnahmen von ausländischen Plattformen (Twitch, YouTube, Amazon). Steuerschuldumkehr – Netto-Rechnung mit USt-IdNr. beider Parteien.' },
              { name: 'USt-Erstattung vom Finanzamt', color: 'bg-teal-500/15 text-teal-700 dark:text-teal-400', desc: 'Geld, das du vom Finanzamt zurückbekommst (Umsatzsteuererklärung). In der Anlage EÜR die Zeile „Vom Finanzamt erstattete Umsatzsteuer".' },
              { name: 'Privateinlage', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400', desc: 'Privates Geld, das du ins Unternehmen einlegst. Kein steuerpflichtiger Gewinn, erhöht aber dein Konto.' },
              { name: 'Verkauf von Anlagevermögen', color: 'bg-violet-500/15 text-violet-700 dark:text-violet-400', desc: 'Erlös aus dem Verkauf von Firmenvermögen (alter Laptop, Möbel, Fahrzeug). Buchhalterisch anders als normale Umsätze.' },
              { name: 'Erstattungen / Auslagen', color: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400', desc: 'Rückerstattungen, Auslagenerstattungen (durchlaufender Posten). Mindert zuvor gebuchte Ausgaben.' },
              { name: 'Sponsoring / Werbeleistung', color: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-400', desc: 'Zahlungen von Sponsoren für Werbeplatzierung, Product Placement, gesponserte Beiträge.' },
              { name: 'Affiliate / Vermittlungsprovision', color: 'bg-rose-500/15 text-rose-700 dark:text-rose-400', desc: 'Provisionen aus Affiliate-Links, Empfehlungsprogrammen (Amazon PartnerNet, etc.).' },
              { name: 'Donations / Tips (Streaming)', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400', desc: 'Freiwillige Zuschauerzahlungen (Twitch Bits, YouTube Super Chat, Ko-fi). Sind Betriebseinnahmen, keine steuerfreien Spenden!' },
              { name: 'Sachzuwendungen (Marktwert)', color: 'bg-orange-500/15 text-orange-700 dark:text-orange-400', desc: 'Erhaltene Produkte/PR-Samples. Marktwert als Einnahme ansetzen. Ausnahme: Rückgabepflicht, Pauschalversteuerung § 37b, Streuartikel < 10 €.' },
              { name: 'Sonstige Einnahmen', color: 'bg-lime-500/15 text-lime-700 dark:text-lime-400', desc: 'Alle anderen Einnahmen: Crowdfunding, nicht zuordenbare Erträge.' },
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
              { name: 'GWG (Geringwertige Wirtschaftsgüter)', color: 'bg-orange-500/15 text-orange-700 dark:text-orange-400', desc: 'Selbständig nutzbare Anschaffungen bis 800€ netto – sofort vollständig abziehbar (Bürostuhl, Werkzeug, Mikrofon). Monitor, Drucker und Tastatur sind hier ausgenommen, siehe AfA-Artikel.' },
              { name: 'Software & Abos', color: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400', desc: 'Lizenzkosten, SaaS-Abos, App-Subscriptions, Cloud-Dienste (Adobe, GitHub, Hosting).' },
              { name: 'Fremdleistungen', color: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400', desc: 'Unterauftragnehmer, externe Dienstleister, Freelancer, Agenturen.' },
              { name: 'Bürobedarf & Material', color: 'bg-slate-500/15 text-slate-700 dark:text-slate-400', desc: 'Büromaterial, Druckerpatronen, Papier, Kleinmaterial.' },
              { name: 'Reisekosten', color: 'bg-teal-500/15 text-teal-700 dark:text-teal-400', desc: 'Hotel, Flüge, Bahnfahrten und Dienstfahrten mit dem eigenen Pkw – 0,30 € je tatsächlich gefahrenem Kilometer, ohne Höchstbetrag. Verpflegungsmehraufwand: 28 € je vollem Tag, 14 € bei mehr als 8 Stunden und an An-/Abreisetagen.' },
              { name: 'Bewirtungskosten', color: 'bg-red-500/15 text-red-700 dark:text-red-400', desc: 'Geschäftliche Bewirtung – nur 70 % mindern den Gewinn (§ 4 Abs. 5 S. 1 Nr. 2 EStG), die Vorsteuer bleibt zu 100 % abziehbar. Angaben zu Teilnehmern und Anlass sind Pflicht. NICHT für private Restaurantbesuche.' },
              { name: 'Marketing & Werbung', color: 'bg-pink-500/15 text-pink-700 dark:text-pink-400', desc: 'Online-Werbung, Drucksachen, Messen, PR-Maßnahmen.' },
              { name: 'Weiterbildung & Fachliteratur', color: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400', desc: 'Kurse, Seminare, Fachbücher, Konferenztickets.' },
              { name: 'Miete & Raumkosten', color: 'bg-lime-500/15 text-lime-700 dark:text-lime-400', desc: 'Büro-, Co-Working- oder Lagermiete.' },
              { name: 'Versicherungen (Betrieb)', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400', desc: 'Betriebliche Versicherungen: Berufshaftpflicht, Inventarversicherung und die Beiträge zur Berufsgenossenschaft. Eine Berufsunfähigkeitsversicherung gehört dagegen nicht hierher – sie ist Sonderausgabe.' },
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
        <Section title="Sonderausgaben (Typ = Ausgabe, aber KEIN Betriebsaufwand)">
          <p className="text-sm text-muted-foreground mb-3">
            Diese Kategorien mindern <strong>nicht den Gewinn</strong>, sondern erst eine Stufe
            später das <strong>zu versteuernde Einkommen</strong> (§ 10 EStG). In der EÜR tauchen
            sie deshalb gar nicht auf – sie gehören in die Anlage Vorsorgeaufwand deiner
            Einkommensteuererklärung.
          </p>
          <div className="space-y-3 text-sm">
            {[
              { name: 'Krankenversicherung', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400', desc: 'Beiträge zur gesetzlichen oder privaten Kranken- und Pflegeversicherung. Sonderausgabe nach § 10 Abs. 1 Nr. 3 EStG – keine Betriebsausgabe, auch wenn du hauptberuflich selbständig bist.' },
              { name: 'Sozialversicherung / Altersvorsorge', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400', desc: 'Rentenversicherung, berufsständische Versorgungswerke, Rürup. Ebenfalls Sonderausgabe (§ 10 Abs. 1 Nr. 2 EStG). Die Berufsgenossenschaft gehört dagegen zu den betrieblichen Versicherungen.' },
              { name: 'Spenden (Sonderausgabe)', color: 'bg-rose-500/15 text-rose-700 dark:text-rose-400', desc: 'Geldspenden an gemeinnützige Organisationen, abziehbar bis 20 % des Gesamtbetrags der Einkünfte. Twitch-Subs und Gaming-Subs sind keine Spenden → Kategorie „Privat".' },
            ].map(({ name, color, desc }) => (
              <div key={name} className="flex items-start gap-3">
                <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${color}`}>{name}</span>
                <span className="text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
          <Tip>
            Der häufigste Irrtum: „Sonderausgabe" ist nicht dasselbe wie „privat". Die
            Krankenversicherung wirkt sich steuerlich sehr wohl aus – nur eben nicht auf den
            Gewinn, sondern auf das Einkommen. Eine private Ausgabe wirkt sich dagegen an
            <strong> keiner </strong> Stelle aus.
          </Tip>
        </Section>
        <Section title="Privat (Typ = Ausgabe, überhaupt nicht absetzbar)">
          <div className="space-y-3 text-sm">
            {[
              { name: 'Privat (nicht absetzbar)', color: 'bg-gray-500/15 text-gray-600 dark:text-gray-400', desc: 'Rein private Ausgaben ohne Geschäftsbezug: Netflix, Spotify, Gaming-Abos, private Einkäufe. Weder Betriebsausgabe noch Sonderausgabe – senkt dein Saldo, bleibt steuerlich aber wirkungslos.' },
              { name: 'Privatentnahme', color: 'bg-gray-500/15 text-gray-600 dark:text-gray-400', desc: 'Überweisung von Firmen- auf Privatkonto. Nur eine Umbuchung, kein Aufwand und keine Steuerrelevanz.' },
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
    title: 'Vorlagen gestalten',
    icon: Palette,
    category: 'Designer',
    keywords: ['designer', 'vorlage', 'template', 'baukasten', 'baustein', 'gestalten', 'layout', 'logo', 'farbe', 'schrift'],
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Eine Vorlage ist eine Reihenfolge von Bausteinen. Du sagst, welche vorkommen und in welcher
          Reihenfolge – wo sie auf dem Blatt landen, rechnet die App aus. Deshalb sitzen Ränder und
          Ausrichtung immer, ohne dass du sie triffst.
        </p>
        <Section title="Die Bausteine">
          <div className="space-y-2 text-sm">
            {[
              ['Kopfzeile', 'Logo und Dokumenttitel, wahlweise mit farbigem Balken darunter.'],
              ['Anschriftfeld', 'Kleine Absenderzeile, darunter der Empfänger – passt ins Fenster eines Briefumschlags.'],
              ['Eckdaten', 'Nummer, Datum, Leistungszeitpunkt, Fälligkeit. Als Block rechts oder als Zeile darunter.'],
              ['Betreff', 'Eine fette Zeile, die sagt, worum es geht.'],
              ['Text', 'Freier Absatz – Anschreiben, Hinweise oder der Steuerhinweis.'],
              ['Positionen', 'Die Tabelle samt Summen. Spalten, Stil und Steuersatz stellst du hier ein.'],
              ['Zahlung', 'Bankverbindung und Zahlungsziel, auf Wunsch mit QR-Code zum Überweisen.'],
              ['Fußzeile', 'Absenderdaten klein und mehrspaltig am Seitenfuß, auf jeder Seite.'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <span className="font-medium w-32 shrink-0">{k}</span>
                <span className="text-muted-foreground">{v}</span>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Aussehen">
          <p className="text-sm text-muted-foreground">
            Akzentfarbe, Schriftart, Schriftgröße, Seitenränder, Abstand zwischen den Bausteinen und
            das Logo gelten für das ganze Dokument. Genau das war am alten Editor mühsam: Dort stand
            jede Schriftgröße an jedem Element einzeln und wich überall leicht ab.
          </p>
        </Section>
        <Section title="Mitgelieferte Vorlagen">
          <div className="space-y-2 text-sm">
            {[
              ['Klar', 'Farbiger Tabellenkopf, kräftiger Titel. Das, was die meisten erwarten.'],
              ['Ruhig', 'Ohne Balken, dünne Linien, viel Weißraum. Zurückhaltend.'],
              ['Kompakt', 'Kleinere Schrift und engere Abstände – für Rechnungen mit vielen Positionen.'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <span className="font-medium w-24 shrink-0">{k}</span>
                <span className="text-muted-foreground">{v}</span>
              </div>
            ))}
          </div>
        </Section>
        <Tip>
          Änderst du eine mitgelieferte Vorlage, legt die App automatisch eine Kopie an. Das Original
          bleibt, damit du jederzeit zurück kannst. Vorschau und PDF entstehen aus derselben
          Berechnung – was du siehst, kommt auch aus dem Drucker.
        </Tip>
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
          Der Klevr erkennt automatisch wiederkehrende Zahlungsmuster – egal ob offizielle
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
  {
    id: 'steuerregelung',
    title: 'Steuerregelung & Tätigkeitsart',
    icon: Shield,
    category: 'Steuern',
    keywords: ['steuer', 'kleinunternehmer', 'regelbesteuerung', 'freiberufler', 'gewerbe', 'content creator', '§19', 'ust'],
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Unter Einstellungen legst du fest, wie du steuerlich aufgestellt bist. Das beeinflusst Dashboard-Widgets,
          Rechnungserstellung und Kategorie-Empfehlungen.
        </p>
        <Section title="Steuerregelung">
          <div className="space-y-3 text-sm">
            {[
              { name: 'Kleinunternehmer (§ 19 UStG)', desc: 'Vorjahresumsatz ≤ 25.000 € (ab 2025), lfd. Jahr < 100.000 €. Kein USt-Ausweis erlaubt, Pflichthinweis auf § 19. Dashboard zeigt Fortschrittsbalken.' },
              { name: 'Regelbesteuerung', desc: 'USt wird auf Rechnungen ausgewiesen und ans Finanzamt abgeführt. Vorsteuerabzug möglich. Umsatzsteuer-Voranmeldung nötig.' },
            ].map(({ name, desc }) => (
              <div key={name} className="flex items-start gap-3">
                <span className="shrink-0 rounded px-2 py-0.5 text-xs font-medium bg-primary/15 text-primary">{name}</span>
                <span className="text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Tätigkeitsart">
          <div className="space-y-3 text-sm">
            {[
              { name: 'Freiberufler (§ 18 EStG)', desc: 'Katalogberufe (Entwickler, Designer, Berater). Keine Gewerbesteuer, keine Gewerbeanmeldung, Anlage S.' },
              { name: 'Gewerbetreibend (§ 15 EStG)', desc: 'Gewerbeanmeldung + IHK-Pflicht. Gewerbesteuer ab 24.500 € Gewinn (Hebesatz der Kommune), Anlage G.' },
              { name: 'Content Creator', desc: 'Streamer, YouTuber, Influencer – gewerblich. Spezielle Kategorien: Donations, Sponsoring, Affiliate, Reverse Charge, Sachzuwendungen.' },
            ].map(({ name, desc }) => (
              <div key={name} className="flex items-start gap-3">
                <span className="shrink-0 rounded px-2 py-0.5 text-xs font-medium bg-blue-500/15 text-blue-700 dark:text-blue-400">{name}</span>
                <span className="text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </Section>
        <Tip>Die Einstellung beeinflusst, wie das Dashboard die Kleinunternehmergrenze darstellt und welche Kategorien die KI bevorzugt vorschlägt.</Tip>
      </div>
    ),
  },
  {
    id: 'reverse-charge',
    title: 'Reverse Charge & Plattformen',
    icon: Globe,
    category: 'Steuern',
    keywords: ['reverse charge', '13b', 'twitch', 'youtube', 'google', 'amazon', 'plattform', 'ausland', 'international'],
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Bei Leistungen von/an ausländische Plattformen greift oft das Reverse-Charge-Verfahren (§ 13b UStG).
          Die Steuerschuld wird auf den Leistungsempfänger übertragen.
        </p>
        <Section title="Wann gilt Reverse Charge?">
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span>Einnahmen von EU-Plattformen (z.B. Google Ireland) → Netto-Rechnung + USt-IdNr. beider Parteien</span></li>
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span>Einnahmen von US-Firmen (z.B. Twitch Interactive) → Nicht steuerbar in DE (§ 3a Abs. 2 UStG), aber in EÜR deklarieren</span></li>
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span>Hinweis auf Rechnung: „Steuerschuldnerschaft des Leistungsempfängers"</span></li>
          </ul>
        </Section>
        <Section title="Wichtige Plattform-Stammdaten">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1.5 pr-4 font-semibold">Plattform</th>
                <th className="text-left py-1.5 pr-4 font-semibold">Vertragspartner</th>
                <th className="text-left py-1.5 font-semibold">USt-IdNr.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-muted-foreground">
              <tr><td className="py-1.5 pr-4 font-medium text-foreground">YouTube / AdSense</td><td className="py-1.5 pr-4">Google Ireland Ltd., Dublin</td><td className="py-1.5">IE 6388047V</td></tr>
              <tr><td className="py-1.5 pr-4 font-medium text-foreground">Twitch</td><td className="py-1.5 pr-4">Twitch Interactive, Inc., San Francisco</td><td className="py-1.5">– (US-Firma)</td></tr>
              <tr><td className="py-1.5 pr-4 font-medium text-foreground">Amazon KDP</td><td className="py-1.5 pr-4">Amazon Media EU S.à r.l., Luxemburg</td><td className="py-1.5">LU 20944528</td></tr>
            </tbody>
          </table>
        </Section>
        <Section title="Als Kleinunternehmer: § 19 schützt nicht vor § 13b">
          <p className="text-sm text-muted-foreground mb-2">
            Die Kleinunternehmerregelung befreit dich davon, Umsatzsteuer auf <em>deine</em>
            Leistungen auszuweisen. Sie befreit dich nicht davon, die Steuer auf
            <em> bezogene</em> Leistungen aus dem Ausland zu schulden. Wer Google Ads bucht,
            eine Twitch-Gebühr zahlt oder Amazon-Werbung schaltet, wird selbst zum
            Steuerschuldner.
          </p>
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span><strong>Steuerschuld</strong> – 19 % auf den Rechnungsbetrag der ausländischen Plattform, an das Finanzamt abzuführen.</span></li>
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span><strong>Voranmeldung</strong> – für den betroffenen Zeitraum ist eine Umsatzsteuer-Voranmeldung abzugeben, obwohl sonst keine fällig wäre.</span></li>
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span><strong>Kein Vorsteuerabzug</strong> – als Kleinunternehmer darfst du die geschuldete Steuer nicht gegenrechnen. Sie bleibt echte Kosten und gehört mit in die Betriebsausgabe.</span></li>
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span><strong>USt-IdNr. nötig</strong> – beim Bundeszentralamt für Steuern zu beantragen und der Plattform mitzuteilen, sonst rechnet sie mit ausländischer Steuer ab.</span></li>
          </ul>
          <p className="text-sm text-muted-foreground mt-2">
            Dasselbe gilt beim innergemeinschaftlichen Erwerb, also beim Warenkauf bei einem
            Händler aus einem anderen EU-Land.
          </p>
        </Section>
        <Tip>Verwende die Kategorie „Reverse Charge (§ 13b UStG)" für Einnahmen von diesen Plattformen.</Tip>
      </div>
    ),
  },
  {
    id: 'audit-trail',
    title: 'GoBD-Audit-Trail (Änderungshistorie)',
    icon: ClipboardList,
    category: 'Compliance',
    keywords: ['gobd', 'audit', 'trail', 'änderung', 'historie', 'protokoll', 'unveränderbar', 'revision', 'compliance'],
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Der Klevr protokolliert automatisch jede Anlage, Änderung und Löschung von Rechnungen –
          ein zentrales Kriterium der GoBD-Konformität.
        </p>
        <Section title="Was wird protokolliert?">
          <ul className="space-y-1.5 text-sm">
            {['Anlegen einer neuen Rechnung', 'Ändern einzelner Felder (alter → neuer Wert)', 'Löschen einer Rechnung', 'Zeitstempel für jede Aktion'].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </Section>
        <Section title="GoBD-Grundsätze">
          <div className="space-y-2 text-sm">
            {[
              ['Unveränderbarkeit', 'Festgeschriebene Belege dürfen nicht gelöscht oder spurlos geändert werden'],
              ['Korrekturen', 'Nur über Stornobuchungen oder Korrekturbelege'],
              ['Aufbewahrung', '8 Jahre für Buchungsbelege und Rechnungen (verkürzt durch das BEG IV). Bücher, Aufzeichnungen, Inventare und Jahresabschlüsse bleiben bei 10 Jahren'],
              ['Verknüpfung', 'Jeder Buchungssatz muss mit dem digitalen Beleg verknüpft sein'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <span className="font-medium w-36 shrink-0">{k}</span>
                <span className="text-muted-foreground">{v}</span>
              </div>
            ))}
          </div>
        </Section>
        <Tip>Erstelle regelmäßig Backups (.rmbackup) – sie enthalten die Datenbank, alle PDFs und den Audit-Trail.</Tip>
      </div>
    ),
  },
  {
    id: 'datev-export',
    title: 'Buchungs-CSV für den Steuerberater',
    icon: FileSpreadsheet,
    category: 'Auswertungen',
    keywords: ['datev', 'elster', 'steuerberater', 'csv', 'buchungsstapel', 'export', 'finanzbuchhaltung', 'skr03'],
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Exportiere deine Buchungen als CSV mit Konto, Gegenkonto und Buchungstext – die Datei ist dafür
          gemacht, dass eine Steuerkanzlei sie einliest und zuordnet.
        </p>
        <Section title="So funktioniert der Export">
          <Steps>
            <Step n={1} title="Rechnungen filtern">
              Gehe zu „Alle Rechnungen" und wähle das gewünschte Jahr.
            </Step>
            <Step n={2} title='Buchungs-CSV exportieren'>
              Im Export-Menü „Buchungen für den Steuerberater" wählen und Speicherort festlegen.
            </Step>
            <Step n={3} title="An die Kanzlei geben">
              Die Kanzlei liest die Datei ein und ordnet die Konten dem Mandanten zu.
            </Step>
          </Steps>
        </Section>
        <Section title="Enthaltene Felder">
          <ul className="space-y-1.5 text-sm">
            {['Umsatz (Brutto)', 'Soll/Haben-Kennzeichen', 'Konto & Gegenkonto', 'BU-Schlüssel', 'Belegdatum', 'Buchungstext (Partner + Beschreibung)', 'USt-Satz', 'Netto & Umsatzsteuer', 'Kategorie', 'Steuerliche Wirkung'].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Welche Konten gewählt werden">
          <p className="text-sm text-muted-foreground">
            Die Sachkonten folgen dem SKR03 und richten sich danach, ob Umsatzsteuer ausgewiesen ist:
            8400 bei 19 %, 8300 bei 7 %, 8200 ohne ausgewiesene Steuer (Kleinunternehmer nach § 19 UStG
            oder steuerfreier Umsatz) und 8195, wenn der Leistungsempfänger die Steuer nach § 13b UStG
            schuldet. Sonderausgaben wie die Krankenversicherung und private Belege laufen als
            Privatentnahme über 1800 – sie mindern den Gewinn nicht.
          </p>
        </Section>
        <Tip>Das ist kein fertiger DATEV-Buchungsstapel. Dafür fehlt der EXTF-Kopfsatz mit Berater- und Mandantennummer, Wirtschaftsjahr und Kontenrahmen – Angaben, die nur deine Kanzlei kennt. Sprich mit ihr ab, welche Konten dein Mandant tatsächlich bebucht.</Tip>
      </div>
    ),
  },
  {
    id: 'afa-gwg',
    title: 'AfA-Rechner & GWG-Grenzen',
    icon: Calculator,
    category: 'Steuern',
    keywords: ['afa', 'abschreibung', 'gwg', 'wirtschaftsgut', 'anlage', 'nutzungsdauer', 'sofortabschreibung', 'pool'],
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Wirtschaftsgüter werden je nach Wert unterschiedlich steuerlich behandelt. Die App hilft dir,
          die richtige Abschreibungsmethode zu wählen.
        </p>
        <Section title="GWG-Schwellen (2025/2026)">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1.5 pr-4 font-semibold">Netto-Preis</th>
                <th className="text-left py-1.5 font-semibold">Behandlung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-muted-foreground">
              <tr><td className="py-1.5 pr-4 font-medium text-foreground">Bis 250 €</td><td className="py-1.5">Direkter Betriebsausgabenabzug – kein Verzeichnis nötig</td></tr>
              <tr><td className="py-1.5 pr-4 font-medium text-foreground">250,01 – 800 €</td><td className="py-1.5">GWG-Sofortabschreibung (vollständig im Anschaffungsjahr)</td></tr>
              <tr><td className="py-1.5 pr-4 font-medium text-foreground">250,01 – 1.000 €</td><td className="py-1.5">Alternativ: Sammelposten über 5 Jahre</td></tr>
              <tr><td className="py-1.5 pr-4 font-medium text-foreground">Über 800 €</td><td className="py-1.5">Lineare AfA über Nutzungsdauer – oder degressiv, siehe unten</td></tr>
            </tbody>
          </table>
          <Tip>
            Die Wertgrenzen werden <strong>immer am Nettobetrag</strong> geprüft – auch als
            Kleinunternehmer, obwohl du gar keine Vorsteuer ziehen darfst. Abgeschrieben wird
            dann aber der <strong>Bruttobetrag</strong>, denn ohne Vorsteuerabzug gehört die
            Umsatzsteuer zu den Anschaffungskosten (§ 9b Abs. 1 EStG). Ein Gerät für 900 €
            brutto liegt also mit 756,30 € netto unter der GWG-Grenze und wird trotzdem mit
            900 € abgezogen.
          </Tip>
        </Section>
        <Section title="Nicht selbständig nutzbar: Monitor, Drucker, Tastatur">
          <p className="text-sm text-muted-foreground">
            Ein Bildschirm allein tut nichts – er ist ohne Rechner nicht nutzbar und deshalb
            <strong> kein GWG</strong> (§ 6 Abs. 2 Satz 2 EStG). Dasselbe gilt für Drucker und
            Tastatur. Sie können weder sofort abgeschrieben noch in einen Sammelposten gelegt
            werden, auch wenn sie unter 800 € kosten.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Das ist trotzdem kein Nachteil: Computerhardware samt Peripherie und Software darf
            mit einer Nutzungsdauer von <strong>einem Jahr</strong> angesetzt werden
            (BMF-Schreiben vom 22.02.2022) – ohne monatsgenaue Zwölftelung. Der volle Betrag
            wirkt also im Anschaffungsjahr, nur über einen anderen Weg.
          </p>
        </Section>
        <Section title="Degressive AfA: 30 % vom Restbuchwert">
          <p className="text-sm text-muted-foreground mb-2">
            Für bewegliche Wirtschaftsgüter des Anlagevermögens, die zwischen dem
            <strong> 01.07.2025 und dem 31.12.2027</strong> angeschafft werden, erlaubt
            § 7 Abs. 2 EStG wieder die degressive Abschreibung: 30 % vom jeweiligen
            Restbuchwert statt eines gleichbleibenden Betrags.
          </p>
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span>Die 30 % sind nur die Obergrenze: Erlaubt ist höchstens das <strong>Dreifache des linearen Satzes</strong>. Bei drei Jahren Nutzungsdauer wären das rechnerisch 100 %, es bleibt bei 30 %; bei Büromöbeln mit 13 Jahren sind es dagegen nur 23,1 %.</span></li>
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span>Im ersten Jahr wird monatsgenau gezwölftelt – wer im Oktober kauft, bekommt drei Zwölftel.</span></li>
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span>Der Wechsel zur linearen AfA ist erlaubt, sobald sie mehr bringt. Ohne ihn würde der Restbuchwert nie null erreichen. Der Rückweg ist nicht erlaubt.</span></li>
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span><strong>Software ist ausgenommen</strong> – sie ist kein bewegliches Wirtschaftsgut. Für sie bleibt es bei der Nutzungsdauer von einem Jahr.</span></li>
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" /><span>Lohnt sich vor allem bei langer Nutzungsdauer: Ein Fahrzeug bringt degressiv im ersten vollen Jahr 30 % statt 16,7 %.</span></li>
          </ul>
        </Section>
        <Section title="Typische Nutzungsdauern">
          <div className="grid grid-cols-2 gap-1 text-xs">
            {[
              ['Computer / Laptop', '3 J. – oder 1 J.'],
              ['Monitor / Drucker', '3 J. – oder 1 J.'],
              ['Software', '1 Jahr'],
              ['Smartphone', '5 Jahre'],
              ['Büromöbel', '13 Jahre'],
              ['Kamera / Audio', '7 Jahre'],
              ['Fahrzeug', '6 Jahre'],
            ].map(([item, nd]) => (
              <div key={item} className="flex justify-between rounded bg-muted px-2 py-1">
                <span>{item}</span>
                <span className="text-muted-foreground font-mono">{nd}</span>
              </div>
            ))}
          </div>
        </Section>
        <Tip>Pro Jahr: Entweder GWG-Sofortabschreibung ODER Poolabschreibung – beides nebeneinander ist nicht zulässig. Die amtliche AfA-Tabelle nennt für Computer und Peripherie drei Jahre; das BMF-Schreiben vom 22.02.2022 erlaubt daneben eine Nutzungsdauer von einem Jahr, was auf einen Sofortabzug hinausläuft.</Tip>
      </div>
    ),
  },
  {
    id: 'verfahrensdoku',
    title: 'Verfahrensdokumentation (GoBD)',
    icon: Shield,
    category: 'Compliance',
    keywords: ['verfahrensdokumentation', 'gobd', 'dokumentation', 'prüfer', 'finanzamt', 'betriebsprüfung', 'archivierung', 'e-rechnung', 'erechnung', 'xrechnung', 'zugferd', 'xml'],
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Die GoBD verlangen, dass du dokumentierst, wie du deine Buchführung organisierst. Keine Software
          ist „per se" GoBD-konform – die Konformität ergibt sich aus dem Zusammenspiel von Software, Hardware
          und deinen Prozessen.
        </p>
        <Section title="Was muss dokumentiert werden?">
          <ul className="space-y-1.5 text-sm">
            {[
              'Welche Software du für Buchführung nutzt (Klevr)',
              'Wie Belege erfasst werden (PDF-Upload, KI-Erkennung, manuelle Eingabe)',
              'Wie Belege archiviert werden (lokal als PDF/A in app_data_dir)',
              'Wer Zugriff auf die Daten hat',
              'Wie Backups erstellt werden (.rmbackup-Format)',
              'Wie Korrekturen vorgenommen werden (Stornobuchung)',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Klevr Compliance-Features">
          <div className="space-y-2 text-sm">
            {[
              ['Audit-Trail', 'Automatisches Änderungsprotokoll für jede Rechnung'],
              ['PDF-Archivierung', 'Belege werden lokal als PDF gespeichert und mit Buchungen verknüpft'],
              ['Backup-System', '.rmbackup enthält DB + PDFs + Metadaten'],
              ['Duplikat-Prüfung', 'Warnung bei gleichen Partner + Betrag + Datum'],
              ['10-Jahres-Archiv', 'Daten werden nie automatisch gelöscht'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <span className="font-medium w-36 shrink-0">{k}</span>
                <span className="text-muted-foreground">{v}</span>
              </div>
            ))}
          </div>
        </Section>
        <Section title="E-Rechnung: empfangen musst du sie schon heute">
          <p className="text-sm text-muted-foreground mb-2">
            Seit dem <strong>01.01.2025</strong> muss jedes inländische Unternehmen E-Rechnungen
            annehmen können – auch Kleinunternehmer, auch ohne einen einzigen eigenen Kunden im
            B2B. Ein E-Mail-Postfach genügt dafür; einen Anspruch auf ein PDF gibt es nicht mehr.
          </p>
          <div className="space-y-2 text-sm">
            {[
              ['Empfangen', 'Pflicht seit 01.01.2025 für alle, unabhängig von Größe und Steuerregelung'],
              ['Versenden', 'Ab 01.01.2027 bei über 800.000 € Vorjahresumsatz, ab 01.01.2028 für alle übrigen'],
              ['Kleinunternehmer', 'Vom Versand dauerhaft befreit – PDF und Papier bleiben erlaubt, empfangen musst du trotzdem'],
              ['Archivierung', 'Die XML-Datei (XRechnung, ZUGFeRD) ist das Original und muss so aufbewahrt werden'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <span className="font-medium w-36 shrink-0">{k}</span>
                <span className="text-muted-foreground">{v}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Ein aus dem XML erzeugtes PDF ist nur eine Ansicht. Wer es archiviert und das XML
            wegwirft, hat den Beleg im Sinne der GoBD nicht aufbewahrt – lege deshalb beide
            Dateien zur Buchung.
          </p>
        </Section>
        <Tip>Erstelle ein einfaches Textdokument mit den oben genannten Punkten und bewahre es zusammen mit deinen Backups auf. Das reicht als Verfahrensdokumentation für Kleinunternehmer und Freiberufler in der Regel aus.</Tip>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const initialArticle = searchParams.get('article') ?? ARTICLES[0].id;
  const resetTutorial = useTutorialStore((s) => s.resetTutorial);
  const startTutorial = useTutorialStore((s) => s.startTutorial);

  const isMobile = useIsMobile();
  const [selected, setSelected] = useState<string>(initialArticle);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Handy: Liste und Artikel liegen übereinander. Welcher Artikel offen ist,
  // steht in der Adresse – dann bringt die Zurück-Geste des Systems einen
  // zur Liste zurück und nicht gleich aus der Hilfe heraus.
  const articleParam = searchParams.get('article');
  const mobileView: 'list' | 'article' = articleParam ? 'article' : 'list';
  /** Merkt, ob der Verlaufseintrag von uns stammt. */
  const pushedArticle = useRef(false);

  const openArticle = (id: string) => {
    setSelected(id);
    pushedArticle.current = true;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('article', id);
      return next;
    });
  };

  const closeArticle = () => {
    if (pushedArticle.current) {
      pushedArticle.current = false;
      navigate(-1);
      return;
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('article');
      return next;
    }, { replace: true });
  };

  const filtered = ARTICLES.filter((a) => {
    const matchesSearch =
      !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.keywords.some((k) => k.includes(search.toLowerCase()));
    const matchesCat = !activeCategory || a.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  const article = ARTICLES.find((a) => a.id === (articleParam ?? selected)) ?? ARTICLES[0];
  const ArticleIcon = article.icon;

  /** Gefundene Artikel nach Kategorie, in der Reihenfolge der Kategorien. */
  const groupedArticles = CATEGORIES
    .map((cat) => [cat, filtered.filter((a) => a.category === cat)] as const)
    .filter(([, items]) => items.length > 0);

  // ── Handy: erst die Liste, dann der Artikel ──
  // Beide Ansichten sind gewöhnliche Seiten mit Kopfzeile – damit gilt hier
  // dasselbe wie überall sonst: großer Titel, ein einziger Scrollbereich,
  // im One-UI-Theme der einklappende Titel, im Apple-Theme der Weg zurück
  // darüber. Vorher brachte die Seite ihre eigene Leiste mit und scrollte in
  // sich selbst – daher die zweite Bildlaufleiste mitten auf der Seite.
  if (isMobile) {
    if (mobileView === 'article') {
      return (
        <div className="space-y-5 pb-6">
          <PageHeader
            title={article.title}
            subtitle={article.category}
            back={{ label: 'Hilfe', onClick: closeArticle }}
            // Artikeltitel sind lang und dürfen umbrechen – abgeschnitten
            // („Rechnung manuell …“) verlieren sie ihren Sinn.
            className='[&_h1]:overflow-visible [&_h1]:whitespace-normal'
          />
          {/* Eigener Haken: Die Artikel enthalten Tabellen mit zwei bis drei
              Spalten. Auf 375 px wären die unlesbar schmal, deshalb stellt
              das Stylesheet sie hier untereinander (siehe App.css). */}
          <div data-help-article className="space-y-5 text-[15px] leading-relaxed">
            {article.content}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4 pb-6">
        <PageHeader title="Hilfe" />
        <SearchField value={search} onChange={setSearch} placeholder="Artikel suchen" />

        {/* Kategorien brechen um, statt seitwärts zu scrollen – verborgene
            Einträge rechts außerhalb des Bildes findet niemand. */}
        <div className="flex flex-wrap gap-2">
          <Chip active={!activeCategory} onClick={() => setActiveCategory(null)}>Alle</Chip>
          {CATEGORIES.map((cat) => (
            <Chip
              key={cat}
              active={activeCategory === cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
            >
              {cat}
            </Chip>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Kein Artikel gefunden</p>
        ) : (
          // Nach Kategorien gruppiert: 20 Artikel in einer einzigen Liste
          // sind eine Wand, mit Zwischenüberschriften findet man sich zurecht.
          // Der Haken am Behälter erlaubt den Titeln, umzubrechen – sonst
          // stünde dort „PDF hochladen & KI-Erkennu…“.
          <div data-help-list className="space-y-4">
            {groupedArticles.map(([cat, items]) => (
            <ListGroup key={cat} title={cat}>
              {items.map((a) => {
                const Icon = a.icon;
                return (
                  <ListRow
                    key={a.id}
                    icon={<Icon />}
                    tint={CATEGORY_TINTS[a.category] ?? 'gray'}
                    label={a.title}
                    onClick={() => openArticle(a.id)}
                  />
                );
              })}
            </ListGroup>
            ))}
          </div>
        )}

        <ListGroup>
          <ListRow
            icon={<GraduationCap />}
            tint="orange"
            label="Geführtes Tutorial neu starten"
            hint="Zeigt die Einführung noch einmal von vorn"
            onClick={() => { resetTutorial(); setTimeout(() => startTutorial(), 100); }}
          />
        </ListGroup>
      </div>
    );
  }

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


