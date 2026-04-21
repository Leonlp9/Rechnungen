import { Check, Receipt, Save, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore } from '@/store';

export const PROFILE_FIELDS = [
  { key: 'profile_name', label: 'Name / Firma' },
  { key: 'profile_address', label: 'Adresse' },
  { key: 'profile_tax_number', label: 'Steuernummer' },
  { key: 'profile_vat_id', label: 'USt-IdNr.' },
  { key: 'profile_iban', label: 'IBAN' },
  { key: 'profile_bic', label: 'BIC' },
  { key: 'profile_email', label: 'E-Mail' },
  { key: 'profile_phone', label: 'Telefon' },
  { key: 'profile_business_type', label: 'Branche / Tätigkeit (z.B. "Softwareentwicklung, Freelancer")' },
] as const;

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
              {([
                { value: 'freiberufler' as const, label: 'Freiberufler', desc: '§ 18 EStG – Katalogberuf (Entwickler, Designer, Berater). Keine Gewerbesteuer, Anlage S.' },
                { value: 'gewerbetreibend' as const, label: 'Gewerbetreibend', desc: '§ 15 EStG – Gewerbeanmeldung, IHK-Pflicht. Gewerbesteuer ab 24.500 € Gewinn, Anlage G.' },
              ]).map((opt) => (
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
              {([
                { value: 'standard' as const, label: 'Standard', desc: 'Allgemein – Dienstleistung, IT, Büro, sonstige Freelancer-Tätigkeit.' },
                { value: 'content_creator' as const, label: 'Content Creator', desc: 'Streamer, YouTuber, Influencer. Kategorien: Donations, Sponsoring, Affiliate, Reverse Charge.' },
                { value: 'ecommerce' as const, label: 'E-Commerce', desc: 'Online-Handel, Dropshipping, Amazon FBA. Reverse Charge für internationale Plattformen.' },
                { value: 'handwerk' as const, label: 'Handwerk', desc: 'Handwerksbetrieb, Bauleistungen, Werkstatt. Standard-Kategorien.' },
                { value: 'beratung' as const, label: 'Beratung', desc: 'Consulting, Coaching, Agentur. Standard-Kategorien.' },
              ]).map((opt) => (
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
              {([
                { value: 'kleinunternehmer' as const, label: 'Kleinunternehmer', desc: 'Umsatz unter 25.000 € (2025+) – keine USt auf Rechnungen, keine Abführung ans Finanzamt. Dashboard zeigt Fortschritt zur Grenze.' },
                { value: 'regelbesteuerung' as const, label: 'Regelbesteuerung', desc: 'USt-pflichtig – du weist Umsatzsteuer aus und führst sie ab. Dashboard zeigt deine Einnahmen ohne Grenzbalken.' },
              ]).map((opt) => (
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

