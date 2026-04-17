import { useEffect, useState } from 'react';
import { getSetting, setSetting } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useAppStore } from '@/store';
import { Save, Eye, EyeOff, User, RefreshCw } from 'lucide-react';
import { getVersion } from '@tauri-apps/api/app';
import { checkForUpdates } from '@/lib/updater';

const PROFILE_FIELDS = [
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

export default function SettingsPage() {
	const [apiKey, setApiKey] = useState('');
	const [showKey, setShowKey] = useState(false);
	const darkMode = useAppStore((s) => s.darkMode);
	const setDarkMode = useAppStore((s) => s.setDarkMode);
	const [profile, setProfile] = useState<Record<string, string>>({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [version, setVersion] = useState('');
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion('0.1.0'));
		getSetting('gemini_api_key').then((v) => { if (v) setApiKey(v); }).catch(console.error);
		// Load profile
		Promise.all(
			PROFILE_FIELDS.map(async (f) => {
				const v = await getSetting(f.key);
				return [f.key, v ?? ''] as const;
			})
		).then((entries) => setProfile(Object.fromEntries(entries))).catch(console.error);
	}, []);

	const saveProfile = async () => {
		setProfileSaving(true);
		try {
			await Promise.all(
				PROFILE_FIELDS.map((f) => setSetting(f.key, profile[f.key] ?? ''))
			);
			toast.success('Profildaten gespeichert!');
		} catch (e) {
			toast.error('Fehler: ' + String(e));
		} finally {
			setProfileSaving(false);
		}
	};

	const saveApiKey = async () => {
		try {
			await setSetting('gemini_api_key', apiKey);
			toast.success('API-Key gespeichert!');
		} catch (e) {
			toast.error('Fehler: ' + String(e));
		}
	};

	const toggleDark = () => {
		const next = !darkMode;
		setDarkMode(next);
		document.documentElement.classList.toggle('dark', next);
	};

	return (
		<div className="space-y-6 max-w-2xl">
			<h1 className="text-2xl font-bold">Einstellungen</h1>

			{/* Profil / Persönliche Daten */}
			<Card className="rounded-xl shadow-sm">
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
							<Save className="mr-2 h-4 w-4" />
							Profil speichern
						</Button>
					</div>
				</CardContent>
			</Card>

			<Card className="rounded-xl shadow-sm">
				<CardHeader>
					<CardTitle className="text-base">Gemini API-Key</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="space-y-1.5">
						<Label>API-Key</Label>
						<div className="flex gap-2">
							<div className="relative flex-1">
								<Input
									type={showKey ? 'text' : 'password'}
									value={apiKey}
									onChange={(e) => setApiKey(e.target.value)}
									placeholder="AIza..."
								/>
								<button
									type="button"
									className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
									onClick={() => setShowKey(!showKey)}
								>
									{showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
								</button>
							</div>
							<Button onClick={saveApiKey}>
								<Save className="mr-2 h-4 w-4" />
								Speichern
							</Button>
						</div>
					</div>
					<p className="text-xs text-muted-foreground">
						Wird lokal in der SQLite-Datenbank gespeichert, nicht an Dritte gesendet.
					</p>
				</CardContent>
			</Card>

		<Card className="rounded-xl shadow-sm">
			<CardHeader>
				<CardTitle className="text-base">Erscheinungsbild</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex items-center justify-between">
					<div>
						<Label>Dark Mode</Label>
						<p className="text-xs text-muted-foreground">Dunkles Farbschema aktivieren</p>
					</div>
					<Button variant="outline" onClick={toggleDark}>
						{darkMode ? 'Deaktivieren' : 'Aktivieren'}
					</Button>
				</div>
			</CardContent>
		</Card>

      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Über</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Rechnungs-Manager</p>
          <p className="text-sm text-muted-foreground">Version: <span className="font-mono font-medium text-foreground">{version ? `v${version}` : '...'}</span></p>
          <p className="text-sm text-muted-foreground">Tauri + React + TypeScript</p>
          <Button
            variant="outline"
            onClick={async () => {
              setCheckingUpdate(true);
              await checkForUpdates(false);
              setCheckingUpdate(false);
            }}
            disabled={checkingUpdate}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${checkingUpdate ? 'animate-spin' : ''}`} />
            {checkingUpdate ? 'Suche...' : 'Nach Updates suchen'}
          </Button>
        </CardContent>
      </Card>
		</div>
	);
}
