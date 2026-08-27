import { Check, Receipt, Save, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormGroup, FormRow, FIELD } from '@/components/ui/form-list';
import { ListGroup, ListRow } from '@/components/ui/list-group';
import { Segmented } from '@/components/ui/segmented';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useAppStore } from '@/store';
import { werteFuer } from '@/lib/steuer/jahreswerte';
import { Switch } from '@/components/ui/switch';

/**
 * Die Profilfelder. `label` ist die ausführliche Beschriftung für den
 * Rechner; auf dem Handy stehen Beschriftung und Feld nebeneinander in einer
 * Zeile, dort passt nur `short` – der erklärende Teil wird zum Platzhalter.
 * `group` fasst die Felder auf dem Handy zu Abschnitten zusammen.
 */
export const PROFILE_FIELDS = [
  { key: 'profile_name', label: 'Name / Firma', short: 'Name', hint: 'Name oder Firma', group: 'Anschrift' },
  { key: 'profile_address', label: 'Adresse (einzeilig – für Rechnungsvorlagen)', short: 'Adresse', hint: 'Einzeilig, für Vorlagen', group: 'Anschrift' },
  { key: 'profile_street', label: 'Straße & Hausnummer (für XRechnung / E-Rechnung)', short: 'Straße', hint: 'Straße & Hausnummer', group: 'Anschrift' },
  { key: 'profile_zip', label: 'Postleitzahl (für XRechnung)', short: 'PLZ', hint: 'Postleitzahl', group: 'Anschrift' },
  { key: 'profile_city', label: 'Stadt (für XRechnung)', short: 'Stadt', hint: 'Stadt', group: 'Anschrift' },
  { key: 'profile_country', label: 'Land-Code (ISO 3166, z.B. DE)', short: 'Land', hint: 'DE', group: 'Anschrift' },
  { key: 'profile_tax_number', label: 'Steuernummer (z.B. 123/456/78901)', short: 'Steuernummer', hint: '123/456/78901', group: 'Steuer' },
  { key: 'profile_w_idnr', label: 'W-IdNr. – Wirtschafts-Identifikationsnummer', short: 'W-IdNr.', hint: 'Wirtschafts-Ident.-Nr.', group: 'Steuer' },
  { key: 'profile_vat_id', label: 'USt-IdNr. (z.B. DE123456789 – für XRechnung & Regelbesteuerung)', short: 'USt-IdNr.', hint: 'DE123456789', group: 'Steuer' },
  { key: 'profile_finanzamt', label: 'Finanzamt', short: 'Finanzamt', hint: 'Zuständiges Finanzamt', group: 'Steuer' },
  { key: 'profile_iban', label: 'IBAN', short: 'IBAN', hint: 'DE00 0000 0000 0000 0000 00', group: 'Bank' },
  { key: 'profile_bic', label: 'BIC', short: 'BIC', hint: 'BIC', group: 'Bank' },
  { key: 'profile_email', label: 'E-Mail', short: 'E-Mail', hint: 'name@beispiel.de', group: 'Kontakt' },
  { key: 'profile_phone', label: 'Telefon', short: 'Telefon', hint: 'Telefonnummer', group: 'Kontakt' },
  { key: 'profile_business_type', label: 'Branche / Tätigkeit (z.B. "Softwareentwicklung, Freelancer")', short: 'Branche', hint: 'z.B. Softwareentwicklung', group: 'Kontakt' },
] as const;

/** Reihenfolge der Abschnitte auf dem Handy */
const PROFILE_GROUPS = ['Anschrift', 'Steuer', 'Bank', 'Kontakt'] as const;

const RECHTSFORM_OPTIONS = [
  { value: 'angestellt' as const, label: 'Angestellt', desc: 'Festes Arbeitsverhältnis. Kein Betrieb, keine Umsatzsteuer – dafür Werbungskosten, Sonderausgaben und § 35a in der Steuererklärung (Anlage N).' },
  { value: 'freiberufler' as const, label: 'Freiberufler', desc: '§ 18 EStG – Katalogberuf (Entwickler, Designer, Berater). Keine Gewerbesteuer, Anlage S.' },
  { value: 'gewerbetreibend' as const, label: 'Gewerbetreibend', desc: '§ 15 EStG – Gewerbeanmeldung, IHK-Pflicht. Gewerbesteuer ab 24.500 € Gewinn, Anlage G.' },
];

/** Kurzbezeichnung je Branchen-Profil – auch die Profilzeile zeigt sie. */
export const BRANCHEN_LABELS: Record<string, string> = {
  standard: 'Standard',
  content_creator: 'Content Creator',
  ecommerce: 'E-Commerce',
  handwerk: 'Handwerk',
  beratung: 'Beratung',
};

const BRANCHEN_OPTIONS = [
  { value: 'standard' as const, label: 'Standard', desc: 'Allgemein – Dienstleistung, IT, Büro, sonstige Freelancer-Tätigkeit.' },
  { value: 'content_creator' as const, label: 'Content Creator', desc: 'Streamer, YouTuber, Influencer. Kategorien: Donations, Sponsoring, Affiliate, Reverse Charge.' },
  { value: 'ecommerce' as const, label: 'E-Commerce', desc: 'Online-Handel, Dropshipping, Amazon FBA. Reverse Charge für internationale Plattformen.' },
  { value: 'handwerk' as const, label: 'Handwerk', desc: 'Handwerksbetrieb, Bauleistungen, Werkstatt. Standard-Kategorien.' },
  { value: 'beratung' as const, label: 'Beratung', desc: 'Consulting, Coaching, Agentur. Standard-Kategorien.' },
];

const STEUER_OPTIONS = [
  { value: 'kleinunternehmer' as const, label: 'Kleinunternehmer', desc: 'Keine Umsatzsteuer auf Rechnungen. Seit 2025 gilt: höchstens 25.000 € Gesamtumsatz im Vorjahr und höchstens 100.000 € im laufenden Jahr. Die Vorjahresgrenze wirkt ab dem 1. Januar, die 100.000 € sofort.' },
  { value: 'regelbesteuerung' as const, label: 'Regelbesteuerung', desc: 'USt-pflichtig – du weist Umsatzsteuer aus und führst sie ab. Dashboard zeigt deine Einnahmen ohne Grenzbalken.' },
];

interface ProfilTabProps {
  profile: Record<string, string>;
  setProfile: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  profileSaving: boolean;
  saveProfile: () => void;
}

export function ProfilTab({ profile, setProfile, profileSaving, saveProfile }: ProfilTabProps) {
  const steuerregelung = useAppStore((s) => s.steuerregelung);
  const setSteuerregelung = useAppStore((s) => s.setSteuerregelung);
  const rechtsform = useAppStore((s) => s.rechtsform);
  const setRechtsform = useAppStore((s) => s.setRechtsform);
  const branchenprofil = useAppStore((s) => s.branchenprofil);
  const setBranchenprofil = useAppStore((s) => s.setBranchenprofil);
  const isMobile = useIsMobile();
  const angestellt = rechtsform === 'angestellt';

  // Steuerprofil: Diese Angaben entscheiden über Beitragssätze, Freibeträge
  // und Abzugsgrenzen. Vorher galten überall dieselben Annahmen – ledig, ohne
  // Kinder, ohne Kirchensteuer, Fahrzeug im Privatvermögen.
  const verheiratet = useAppStore((s) => s.verheiratet);
  const setVerheiratet = useAppStore((s) => s.setVerheiratet);
  const kinder = useAppStore((s) => s.kinder);
  const setKinder = useAppStore((s) => s.setKinder);
  const kirchensteuerSatz = useAppStore((s) => s.kirchensteuerSatz);
  const setKirchensteuerSatz = useAppStore((s) => s.setKirchensteuerSatz);
  const gewerbesteuerHebesatz = useAppStore((s) => s.gewerbesteuerHebesatz);
  const setGewerbesteuerHebesatz = useAppStore((s) => s.setGewerbesteuerHebesatz);
  const fahrzeugImBetriebsvermoegen = useAppStore((s) => s.fahrzeugImBetriebsvermoegen);
  const setFahrzeugImBetriebsvermoegen = useAppStore((s) => s.setFahrzeugImBetriebsvermoegen);
  const kvKrankengeld = useAppStore((s) => s.kvKrankengeld);
  const setKvKrankengeld = useAppStore((s) => s.setKvKrankengeld);
  const grundfreibetragManuell = useAppStore((s) => s.grundfreibetragManuell);
  const setGrundfreibetragManuell = useAppStore((s) => s.setGrundfreibetragManuell);
  const jahr = useAppStore((s) => s.selectedYear);
  const werte = werteFuer(jahr);

  /**
   * Zwei Angaben, die sich widersprechen können, und die niemand von selbst
   * bemerkt – sie stehen an verschiedenen Stellen und wirken erst im
   * Steuerbericht.
   */
  const hinweise: string[] = [];
  if (branchenprofil === 'content_creator' && rechtsform === 'freiberufler') {
    hinweise.push(
      'Branche „Content Creator" und Rechtsform „Freiberufler" passen selten zusammen: Streaming, '
      + 'YouTube und Influencer-Tätigkeit gelten in aller Regel als Gewerbebetrieb nach § 15 EStG, '
      + 'nicht als Katalogberuf nach § 18 EStG. Das entscheidet über Gewerbeanmeldung, Gewerbesteuer '
      + 'und darüber, ob die Anlage G oder die Anlage S zur Steuererklärung gehört.',
    );
  }
  if (rechtsform === 'angestellt' && steuerregelung === 'regelbesteuerung') {
    hinweise.push(
      'Als Angestellter führst du keinen Betrieb – eine Steuerregelung brauchst du nur, wenn du '
      + 'nebenbei selbständig bist. Dann passt „Angestellt" als Rechtsform nicht.',
    );
  }

  // ── Handy: Gruppenlisten statt Karten mit gestapelten Feldern ──
  // Beschriftung über Feld ergab auf 375 px eine endlose Kolonne, in der der
  // Zusammenhang verloren ging. Hier steht die Beschriftung links, der Wert
  // rechts, und die Felder sind nach Themen gruppiert – so wie die
  // Einstellungen eines Telefons aufgebaut sind.
  if (isMobile) {
    return (
      <div className="space-y-8">
        {PROFILE_GROUPS.map((group) => (
          <FormGroup
            key={group}
            title={group}
            footer={
              group === 'Steuer'
                ? 'Straße, PLZ, Stadt und USt-IdNr. werden für den XRechnung-Export benötigt.'
                : undefined
            }
          >
            {PROFILE_FIELDS.filter((f) => f.group === group).map((f) => (
              <FormRow key={f.key} label={f.short}>
                <input
                  className={FIELD}
                  value={profile[f.key] ?? ''}
                  onChange={(e) => setProfile((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.hint}
                />
              </FormRow>
            ))}
          </FormGroup>
        ))}

        <Button className="h-[50px] w-full text-[17px] font-semibold" onClick={saveProfile} disabled={profileSaving}>
          <Save className="mr-2 h-5 w-5" /> Profil speichern
        </Button>

        {/* Zwei Möglichkeiten passen als Schalter nebeneinander … */}
        <div className="space-y-2">
          <h2 data-list-title className="px-4 text-[13px] font-medium text-muted-foreground">
            Rechtlicher Status
          </h2>
          <Segmented
            value={rechtsform}
            onChange={setRechtsform}
            options={RECHTSFORM_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
          <p className="px-4 text-[13px] leading-snug text-muted-foreground">
            {RECHTSFORM_OPTIONS.find((o) => o.value === rechtsform)?.desc}
          </p>
        </div>

        {/* Wer angestellt ist, hat weder Branchen-Profil noch Umsatzsteuer –
            beides gehört zum Betrieb. Stattdessen der Hinweis, wo das Gehalt
            hingehört. */}
        {angestellt ? (
          <ListGroup
            title="Angestellt"
            footer="Dein Gehalt trägst du unter „Gehalt“ ein – dafür gibt es keine Belege. Alles, was du für die Steuererklärung sammelst (Fahrten, Arbeitsmittel, Handwerker, Versicherungen), legst du wie gewohnt als Beleg ab."
          >
            <ListRow
              label="Umsatzsteuer"
              hint="Als Angestellter weist du keine Umsatzsteuer aus"
              value="entfällt"
              noChevron
            />
            <ListRow
              label="Krankenversicherung"
              hint="Zieht dein Arbeitgeber vom Lohn ab"
              value="über den Lohn"
              noChevron
            />
          </ListGroup>
        ) : (
        <ListGroup
          title="Branchen-Profil"
          footer="Schaltet branchenspezifische Kategorien frei – etwa Donations, Sponsoring oder Reverse Charge."
        >
          {BRANCHEN_OPTIONS.map((o) => (
            <ListRow
              key={o.value}
              label={o.label}
              hint={o.desc}
              active={branchenprofil === o.value}
              // Kein Chevron: Die Zeile führt nirgendwohin, sie wählt aus.
              noChevron
              onClick={() => setBranchenprofil(o.value)}
            />
          ))}
        </ListGroup>
        )}

        {!angestellt && (
          <div className="space-y-2">
            <h2 data-list-title className="px-4 text-[13px] font-medium text-muted-foreground">
              Steuer-Modus
            </h2>
            <Segmented
              value={steuerregelung}
              onChange={setSteuerregelung}
              options={STEUER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
            <p className="px-4 text-[13px] leading-snug text-muted-foreground">
              {STEUER_OPTIONS.find((o) => o.value === steuerregelung)?.desc}
            </p>
          </div>
        )}

        {hinweise.length > 0 && (
          <div className="space-y-2 px-4">
            {hinweise.map((h, i) => (
              <p key={i} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-[13px] leading-snug text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                {h}
              </p>
            ))}
          </div>
        )}

        <FormGroup
          title="Persönliche Verhältnisse"
          footer="Bestimmt den Grundfreibetrag, die zumutbare Belastung bei außergewöhnlichen Belastungen und den Satz der Pflegeversicherung."
        >
          <FormRow label="Zusammenveranlagt">
            <Switch checked={verheiratet} onCheckedChange={setVerheiratet} />
          </FormRow>
          <FormRow label="Kinder">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              className={FIELD}
              value={kinder || ''}
              onChange={(e) => setKinder(Number(e.target.value) || 0)}
              placeholder="0"
            />
          </FormRow>
          <FormRow label="Kirchensteuer">
            <select
              className={FIELD}
              value={String(kirchensteuerSatz)}
              onChange={(e) => setKirchensteuerSatz(Number(e.target.value))}
            >
              <option value="0">keine</option>
              <option value="8">8 % (BW, BY)</option>
              <option value="9">9 % (übrige Länder)</option>
            </select>
          </FormRow>
        </FormGroup>

        {!angestellt && (
          <FormGroup
            title="Betrieb"
            footer="Der Hebesatz steht auf dem Gewerbesteuerbescheid oder auf der Seite deiner Gemeinde. Bis 400 % gleicht die Anrechnung nach § 35 EStG die Gewerbesteuer rechnerisch wieder aus."
          >
            {rechtsform === 'gewerbetreibend' && (
              <FormRow label="Hebesatz (%)">
                <input
                  type="number"
                  inputMode="decimal"
                  className={FIELD}
                  value={gewerbesteuerHebesatz || ''}
                  onChange={(e) => setGewerbesteuerHebesatz(Number(e.target.value) || 0)}
                  placeholder="400"
                />
              </FormRow>
            )}
            <FormRow
              label="Fahrzeug im Betriebsvermögen"
              hint="Dann zählen die tatsächlichen Kosten, und die Kilometerpauschale aus dem Fahrtenbuch entfällt – beides zusammen wäre ein doppelter Abzug."
            >
              <Switch checked={fahrzeugImBetriebsvermoegen} onCheckedChange={setFahrzeugImBetriebsvermoegen} />
            </FormRow>
            <FormRow
              label="Krankengeldanspruch"
              hint={`Belegt einen neuen Beitragssatz mit ${werte.kvSatzAllgemein.toFixed(1).replace('.', ',')} % statt ${werte.kvSatzErmaessigt.toFixed(1).replace('.', ',')} % vor. Bestehende Sätze bleiben, wie sie sind.`}
            >
              <Switch checked={kvKrankengeld} onCheckedChange={setKvKrankengeld} />
            </FormRow>
          </FormGroup>
        )}

        <FormGroup
          title="Steuerwerte"
          footer={`Leer heißt: den amtlichen Wert des jeweiligen Jahres nehmen – für ${jahr} sind das ${werte.grundfreibetrag.toLocaleString('de-DE')} €. Nur eintragen, wenn du bewusst mit einem anderen Wert rechnen willst.`}
        >
          <FormRow label="Grundfreibetrag">
            <input
              type="number"
              inputMode="decimal"
              className={FIELD}
              value={grundfreibetragManuell || ''}
              onChange={(e) => setGrundfreibetragManuell(Number(e.target.value) || 0)}
              placeholder={String(werte.grundfreibetrag)}
            />
          </FormRow>
        </FormGroup>
      </div>
    );
  }

  return (
    <>
      <Card className="rounded-xl shadow-sm" data-tutorial="settings-profile">
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Persönliche Daten</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Diese Daten helfen der KI zu verstehen, ob eine Rechnung eine Einnahme oder Ausgabe ist.
            Straße, PLZ, Stadt und USt-IdNr. werden für den <strong>XRechnung-Export</strong> (E-Rechnungspflicht 2025/2026) benötigt.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {PROFILE_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label>{f.label}</Label>
              <Input
                value={profile[f.key] ?? ''}
                onChange={(e) => setProfile((p) => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.label}
              />
            </div>
          ))}
          <div className="flex justify-end pt-2">
            <Button onClick={saveProfile} disabled={profileSaving}>
              <Save className="mr-2 h-4 w-4" /> Profil speichern
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-sm" data-tutorial="settings-steuer">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Steuerliches Setup</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Konfiguriere deinen rechtlichen Status, dein Branchen-Profil und den Steuer-Modus.
            Das bestimmt, welche Kategorien, Widgets und Hinweise dir angezeigt werden.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Schritt 1 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
              <Label className="text-sm font-semibold">Rechtlicher Status</Label>
            </div>
            <p className="text-xs text-muted-foreground ml-8">Bestimmt Gewerbesteuer-Pflicht und Steuererklärung (Anlage S oder G).</p>
            <div className="grid grid-cols-2 gap-3 ml-8">
              {RECHTSFORM_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setRechtsform(opt.value)}
                  className={`relative rounded-xl border-2 p-3 text-left transition-all hover:shadow-md focus:outline-none ${rechtsform === opt.value ? 'border-primary shadow-md bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                  {rechtsform === opt.value && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" /></span>}
                  <p className="text-sm font-semibold">{opt.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Schritt 2 */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
              <Label className="text-sm font-semibold">Branchen-Profil</Label>
            </div>
            <p className="text-xs text-muted-foreground ml-8">Schaltet branchenspezifische Buchungskategorien frei (z.B. Donations, Sponsoring, Reverse Charge für Creator).</p>
            <div className="grid grid-cols-3 gap-3 ml-8">
              {BRANCHEN_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setBranchenprofil(opt.value)}
                  className={`relative rounded-xl border-2 p-3 text-left transition-all hover:shadow-md focus:outline-none ${branchenprofil === opt.value ? 'border-primary shadow-md bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                  {branchenprofil === opt.value && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" /></span>}
                  <p className="text-sm font-semibold">{opt.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Schritt 3 */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
              <Label className="text-sm font-semibold">Steuer-Modus</Label>
            </div>
            <p className="text-xs text-muted-foreground ml-8">Entscheidet, ob auf Rechnungen MwSt berechnet wird oder der § 19 UStG-Hinweis erscheint.</p>
            <div className="grid grid-cols-2 gap-3 ml-8">
              {STEUER_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setSteuerregelung(opt.value)}
                  className={`relative rounded-xl border-2 p-3 text-left transition-all hover:shadow-md focus:outline-none ${steuerregelung === opt.value ? 'border-primary shadow-md bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                  {steuerregelung === opt.value && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" /></span>}
                  <p className="text-sm font-semibold">{opt.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-lg bg-muted/50 border border-border p-3 ml-8 space-y-1">
            <p className="text-xs font-semibold text-foreground">Aktuelle Konfiguration:</p>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 font-medium">{rechtsform === 'angestellt' ? '👔 Angestellt' : rechtsform === 'freiberufler' ? '🎓 Freiberufler' : '🏢 Gewerbetreibend'}</span>
              <span className="rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-0.5 font-medium">
                {branchenprofil === 'content_creator' ? '🎮 Content Creator' : branchenprofil === 'ecommerce' ? '🛒 E-Commerce' : branchenprofil === 'handwerk' ? '🔧 Handwerk' : branchenprofil === 'beratung' ? '💼 Beratung' : '📋 Standard'}
              </span>
              <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 font-medium">{steuerregelung === 'kleinunternehmer' ? '§19 Kleinunternehmer' : '💶 Regelbesteuerung'}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {rechtsform === 'angestellt'
                ? 'Steuererklärung: Anlage N · Werbungskosten über dem Pauschbetrag'
                : rechtsform === 'freiberufler'
                  ? 'Steuererklärung: Anlage S · Keine Gewerbesteuer'
                  : 'Steuererklärung: Anlage G · Gewerbesteuer ab 24.500 € Gewinn'}
              {branchenprofil === 'content_creator' ? ' · Erweiterte Kategorien: Donations, Sponsoring, Affiliate, Reverse Charge, Sachzuwendungen' : branchenprofil === 'ecommerce' ? ' · Erweiterte Kategorien: Reverse Charge' : ''}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Steuerprofil</CardTitle>
          <p className="text-xs text-muted-foreground">
            Diese Angaben entscheiden über Freibeträge, Beitragssätze und Abzugsgrenzen. Ohne sie rechnet
            die App mit den Annahmen ledig, kinderlos, ohne Kirchensteuer.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {hinweise.length > 0 && (
            <div className="space-y-2">
              {hinweise.map((h, i) => (
                <p key={i} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs leading-snug text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  {h}
                </p>
              ))}
            </div>
          )}
          <div className="grid gap-5 md:grid-cols-2">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
              <div className="min-w-0">
                <Label className="text-sm">Zusammenveranlagt</Label>
                <p className="text-[11px] text-muted-foreground">Verdoppelt den Grundfreibetrag und wendet den Splittingtarif an</p>
              </div>
              <Switch className="shrink-0" checked={verheiratet} onCheckedChange={setVerheiratet} />
            </div>

            <div className="space-y-1.5">
              <Label>Kinder</Label>
              <Input
                type="number"
                min={0}
                value={kinder || ''}
                onChange={(e) => setKinder(Number(e.target.value) || 0)}
                placeholder="0"
                className="w-24"
              />
              <p className="text-[11px] text-muted-foreground">
                Senkt die zumutbare Belastung bei außergewöhnlichen Belastungen und den Satz der
                Pflegeversicherung.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Kirchensteuer</Label>
              <select
                className="h-9 w-full max-w-[14rem] rounded-md border border-input bg-background px-3 text-sm"
                value={String(kirchensteuerSatz)}
                onChange={(e) => setKirchensteuerSatz(Number(e.target.value))}
              >
                <option value="0">keine</option>
                <option value="8">8 % (Baden-Württemberg, Bayern)</option>
                <option value="9">9 % (übrige Länder)</option>
              </select>
              <p className="text-[11px] text-muted-foreground">Wird auf die Einkommensteuer aufgeschlagen.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Grundfreibetrag (€)</Label>
              <Input
                type="number"
                value={grundfreibetragManuell || ''}
                onChange={(e) => setGrundfreibetragManuell(Number(e.target.value) || 0)}
                placeholder={String(werte.grundfreibetrag)}
                className="w-full max-w-[10rem]"
              />
              <p className="text-[11px] text-muted-foreground">
                Leer lassen heißt: den amtlichen Wert des jeweiligen Jahres nehmen – für {jahr} sind das{' '}
                {werte.grundfreibetrag.toLocaleString('de-DE')} €.
              </p>
            </div>
          </div>

          {!angestellt && (
            <div className="space-y-5 border-t pt-5">
              <div className="grid gap-5 md:grid-cols-2">
                {rechtsform === 'gewerbetreibend' && (
                  <div className="space-y-1.5">
                    <Label>Gewerbesteuer-Hebesatz (%)</Label>
                    <Input
                      type="number"
                      value={gewerbesteuerHebesatz || ''}
                      onChange={(e) => setGewerbesteuerHebesatz(Number(e.target.value) || 0)}
                      placeholder="400"
                      className="w-32"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Steht auf dem Gewerbesteuerbescheid oder auf der Seite deiner Gemeinde. Bis 400 %
                      gleicht die Anrechnung nach § 35 EStG die Gewerbesteuer rechnerisch wieder aus.
                    </p>
                  </div>
                )}

                <div className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                  <div className="min-w-0">
                    <Label className="text-sm">Fahrzeug im Betriebsvermögen</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Dann zählen die tatsächlichen Kosten, und die Kilometerpauschale aus dem Fahrtenbuch
                      entfällt – beides zusammen wäre ein doppelter Abzug. Dafür ist die Privatnutzung zu
                      versteuern.
                    </p>
                  </div>
                  <Switch
                    className="mt-0.5 shrink-0"
                    checked={fahrzeugImBetriebsvermoegen}
                    onCheckedChange={setFahrzeugImBetriebsvermoegen}
                  />
                </div>

                <div className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                  <div className="min-w-0">
                    <Label className="text-sm">Krankengeldanspruch</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Belegt einen neu angelegten Beitragssatz mit {werte.kvSatzAllgemein.toFixed(1).replace('.', ',')} % vor
                      statt mit {werte.kvSatzErmaessigt.toFixed(1).replace('.', ',')} %. Bereits gespeicherte Sätze auf der
                      Krankenkassenseite bleiben unverändert.
                    </p>
                  </div>
                  <Switch className="mt-0.5 shrink-0" checked={kvKrankengeld} onCheckedChange={setKvKrankengeld} />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

