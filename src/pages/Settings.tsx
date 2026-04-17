import { useEffect, useState } from 'react';
import { getSetting, setSetting } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useAppStore } from '@/store';
import { Save, Eye, EyeOff, User } from 'lucide-react';

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
	const [primaryColor, setPrimaryColor] = useState('#1a1a1a');
	const darkMode = useAppStore((s) => s.darkMode);
	const setDarkMode = useAppStore((s) => s.setDarkMode);
	const [profile, setProfile] = useState<Record<string, string>>({});
	const [profileSaving, setProfileSaving] = useState(false);

	useEffect(() => {
		getSetting('gemini_api_key').then((v) => { if (v) setApiKey(v); }).catch(console.error);
		getSetting('primary_color').then((v) => { if (v) setPrimaryColor(v); }).catch(console.error);
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

	const savePrimaryColor = async () => {
		try {
			await setSetting('primary_color', primaryColor);
			document.documentElement.style.setProperty('--primary', primaryColor);
			toast.success('Primärfarbe gespeichert!');
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
					<div className="space-y-1.5">
						<Label>Primärfarbe</Label>
						<div className="flex gap-2 items-center">
							<input
								type="color"
								value={primaryColor}
								onChange={(e) => setPrimaryColor(e.target.value)}
								className="h-10 w-14 cursor-pointer rounded border-0"
							/>
							<Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-32" />
							<Button onClick={savePrimaryColor}>
								<Save className="mr-2 h-4 w-4" />
								Speichern
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card className="rounded-xl shadow-sm">
				<CardHeader>
					<CardTitle className="text-base">Über</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">Rechnungs-Manager v0.1.0</p>
					<p className="text-sm text-muted-foreground">Tauri + React + TypeScript</p>
				</CardContent>
			</Card>
		</div>
	);
}
