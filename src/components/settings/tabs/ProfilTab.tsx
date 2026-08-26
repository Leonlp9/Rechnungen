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
  { value: 'kleinunternehmer' as const, label: 'Kleinunternehmer', desc: 'Umsatz unter 25.000 € (2025+) – keine USt auf Rechnungen, keine Abführung ans Finanzamt. Dashboard zeigt Fortschritt zur Grenze.' },
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

        {/* … fünf werden zur Auswahlliste mit Häkchen. */}
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

        <FormGroup
          title="Steuerwerte"
          footer="Grundlage der Steuerrücklage. 2025: 12.096 €, 2026: ca. 12.348 €."
        >
          <FormRow label="Grundfreibetrag">
            <input
              type="number"
              inputMode="decimal"
              className={FIELD}
              defaultValue={useAppStore.getState().grundfreibetrag}
              onChange={(e) => useAppStore.getState().setGrundfreibetrag(Number(e.target.value) || 12348)}
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
              <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 font-medium">{rechtsform === 'freiberufler' ? '🎓 Freiberufler' : '🏢 Gewerbetreibend'}</span>
              <span className="rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-0.5 font-medium">
                {branchenprofil === 'content_creator' ? '🎮 Content Creator' : branchenprofil === 'ecommerce' ? '🛒 E-Commerce' : branchenprofil === 'handwerk' ? '🔧 Handwerk' : branchenprofil === 'beratung' ? '💼 Beratung' : '📋 Standard'}
              </span>
              <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 font-medium">{steuerregelung === 'kleinunternehmer' ? '§19 Kleinunternehmer' : '💶 Regelbesteuerung'}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {rechtsform === 'freiberufler' ? 'Steuererklärung: Anlage S · Keine Gewerbesteuer' : 'Steuererklärung: Anlage G · Gewerbesteuer ab 24.500 € Gewinn'}
              {branchenprofil === 'content_creator' ? ' · Erweiterte Kategorien: Donations, Sponsoring, Affiliate, Reverse Charge, Sachzuwendungen' : branchenprofil === 'ecommerce' ? ' · Erweiterte Kategorien: Reverse Charge' : ''}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-sm">
        <CardHeader><CardTitle className="text-base">Steuerwerte</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Grundfreibetrag (€)</Label>
            <Input
              type="number"
              defaultValue={useAppStore.getState().grundfreibetrag}
              onChange={(e) => useAppStore.getState().setGrundfreibetrag(Number(e.target.value) || 12348)}
              className="w-40"
            />
            <p className="text-xs text-muted-foreground">Wird für die Steuerrücklage-Berechnung verwendet. 2025: 12.096 €, 2026: ca. 12.348 €.</p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

