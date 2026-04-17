import { useEffect, useRef, useState } from 'react';
import { getSetting, setSetting } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useAppStore } from '@/store';
import { Save, Eye, EyeOff, User, RefreshCw, FlaskConical, Check } from 'lucide-react';
import { getVersion } from '@tauri-apps/api/app';
import { checkForUpdates } from '@/lib/updater';
import { UpdateDialog, type UpdatePhase } from '@/components/UpdateDialog';

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
	const theme = useAppStore((s) => s.theme);
	const setTheme = useAppStore((s) => s.setTheme);
	const [profile, setProfile] = useState<Record<string, string>>({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [version, setVersion] = useState('');
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  // --- Dev-Preview für UpdateDialog ---
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPhase, setPreviewPhase] = useState<UpdatePhase>('confirm');
  const [previewProgress, setPreviewProgress] = useState(0);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPreview = (phase: UpdatePhase) => {
    setPreviewPhase(phase);
    setPreviewProgress(phase === 'downloading' ? 0 : 0);
    setPreviewOpen(true);
    if (phase === 'downloading') {
      if (progressRef.current) clearInterval(progressRef.current);
      setPreviewProgress(0);
      progressRef.current = setInterval(() => {
        setPreviewProgress((p) => {
          if (p >= 100) {
            clearInterval(progressRef.current!);
            return 100;
          }
          return p + 2;
        });
      }, 80);
    }
  };

  const closePreview = () => {
    setPreviewOpen(false);
    if (progressRef.current) clearInterval(progressRef.current);
  };

  // Wenn Download-Simulation fertig → Phase 'done'
  useEffect(() => {
    if (previewPhase === 'downloading' && previewProgress >= 100) {
      const t = setTimeout(() => setPreviewPhase('done'), 400);
      return () => clearTimeout(t);
    }
  }, [previewPhase, previewProgress]);
  // ------------------------------------

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
		<CardContent className="space-y-6">
			{/* Dark Mode */}
			<div className="flex items-center justify-between">
				<div>
					<Label>Dark Mode</Label>
					<p className="text-xs text-muted-foreground">Dunkles Farbschema aktivieren</p>
				</div>
				<Button variant="outline" onClick={toggleDark}>
					{darkMode ? 'Deaktivieren' : 'Aktivieren'}
				</Button>
			</div>

			{/* Theme-Auswahl */}
			<div className="space-y-3">
				<div>
					<Label>Theme</Label>
					<p className="text-xs text-muted-foreground">Wähle das visuelle Design der App</p>
				</div>
				<div className="grid grid-cols-2 gap-3">
					{/* Default Theme */}
					<button
						type="button"
						onClick={() => setTheme('default')}
						className={`relative rounded-xl border-2 p-3 text-left transition-all hover:shadow-md focus:outline-none ${
							theme === 'default'
								? 'border-primary shadow-md'
								: 'border-border hover:border-primary/50'
						}`}
					>
						{theme === 'default' && (
							<span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
								<Check className="h-3 w-3" />
							</span>
						)}
						{/* Preview */}
						<div className="mb-2 h-16 rounded-lg overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 flex flex-col gap-1 p-2">
							<div className="h-2 w-3/4 rounded bg-zinc-900 dark:bg-zinc-100 opacity-80" />
							<div className="h-2 w-1/2 rounded bg-zinc-300 dark:bg-zinc-600" />
							<div className="mt-1 h-6 w-full rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700" />
						</div>
						<p className="text-sm font-medium">Default</p>
						<p className="text-xs text-muted-foreground">Klares, minimales Design</p>
					</button>

					{/* Liquid Glass Theme */}
					<button
						type="button"
						onClick={() => setTheme('liquid-glass')}
						className={`relative rounded-xl border-2 p-3 text-left transition-all hover:shadow-md focus:outline-none ${
							theme === 'liquid-glass'
								? 'border-primary shadow-md'
								: 'border-border hover:border-primary/50'
						}`}
					>
						{theme === 'liquid-glass' && (
							<span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
								<Check className="h-3 w-3" />
							</span>
						)}
						{/* Preview */}
						<div className="mb-2 h-16 rounded-lg overflow-hidden relative flex flex-col gap-1 p-2"
							style={{
								background: darkMode
									? 'linear-gradient(135deg, oklch(0.18 0.04 265) 0%, oklch(0.14 0.03 200) 100%)'
									: 'linear-gradient(135deg, oklch(0.88 0.06 265) 0%, oklch(0.92 0.04 200) 100%)',
							}}
						>
							<div className="absolute inset-0 opacity-30"
								style={{ background: 'radial-gradient(circle at 30% 30%, oklch(0.75 0.18 265 / 40%), transparent 60%)' }}
							/>
							<div className="relative h-2 w-3/4 rounded"
								style={{ background: darkMode ? 'oklch(0.95 0 0 / 80%)' : 'oklch(0.15 0 0 / 70%)' }}
							/>
							<div className="relative h-2 w-1/2 rounded"
								style={{ background: darkMode ? 'oklch(0.95 0 0 / 40%)' : 'oklch(0.15 0 0 / 35%)' }}
							/>
							<div className="relative mt-1 h-6 w-full rounded-lg"
								style={{
									background: darkMode ? 'oklch(1 0 0 / 8%)' : 'oklch(1 0 0 / 55%)',
									backdropFilter: 'blur(8px)',
									border: darkMode ? '1px solid oklch(1 0 0 / 12%)' : '1px solid oklch(1 0 0 / 40%)',
								}}
							/>
						</div>
						<p className="text-sm font-medium">Liquid Glass</p>
						<p className="text-xs text-muted-foreground">Apple-ähnliches Glasdesign</p>
					</button>

					{/* Aurora Borealis Theme */}
					<button
						type="button"
						onClick={() => setTheme('aurora-borealis')}
						className={`relative rounded-xl border-2 p-3 text-left transition-all hover:shadow-md focus:outline-none ${
							theme === 'aurora-borealis'
								? 'border-primary shadow-md'
								: 'border-border hover:border-primary/50'
						}`}
					>
						{theme === 'aurora-borealis' && (
							<span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
								<Check className="h-3 w-3" />
							</span>
						)}
						{/* Preview */}
						<div className="mb-2 h-16 rounded-lg overflow-hidden relative flex flex-col gap-1 p-2"
							style={{
								background: darkMode
									? 'linear-gradient(135deg, oklch(0.10 0.025 220) 0%, oklch(0.12 0.03 175) 100%)'
									: 'linear-gradient(135deg, oklch(0.93 0.025 165) 0%, oklch(0.90 0.04 200) 100%)',
							}}
						>
							<div className="absolute inset-0"
								style={{ background: darkMode
									? 'radial-gradient(ellipse at 20% 50%, oklch(0.45 0.22 175 / 45%) 0%, transparent 55%), radial-gradient(ellipse at 80% 30%, oklch(0.42 0.24 280 / 35%) 0%, transparent 50%)'
									: 'radial-gradient(ellipse at 20% 50%, oklch(0.65 0.18 175 / 25%) 0%, transparent 55%), radial-gradient(ellipse at 80% 30%, oklch(0.60 0.20 280 / 20%) 0%, transparent 50%)',
								}}
							/>
							<div className="relative h-2 w-3/4 rounded"
								style={{ background: darkMode ? 'oklch(0.62 0.20 175 / 90%)' : 'oklch(0.48 0.18 175 / 80%)' }}
							/>
							<div className="relative h-2 w-1/2 rounded"
								style={{ background: darkMode ? 'oklch(0.65 0.22 280 / 60%)' : 'oklch(0.55 0.20 280 / 50%)' }}
							/>
							<div className="relative mt-1 h-6 w-full rounded-lg"
								style={{
									background: darkMode ? 'oklch(0.14 0.03 210 / 80%)' : 'oklch(0.99 0.008 165 / 75%)',
									border: darkMode ? '1px solid oklch(0.62 0.20 175 / 25%)' : '1px solid oklch(0.48 0.18 175 / 30%)',
								}}
							/>
						</div>
						<p className="text-sm font-medium">Aurora Borealis</p>
						<p className="text-xs text-muted-foreground">Nordlichter in Grün & Lila</p>
					</button>

					{/* Crimson Dusk Theme */}
					<button
						type="button"
						onClick={() => setTheme('crimson-dusk')}
						className={`relative rounded-xl border-2 p-3 text-left transition-all hover:shadow-md focus:outline-none ${
							theme === 'crimson-dusk'
								? 'border-primary shadow-md'
								: 'border-border hover:border-primary/50'
						}`}
					>
						{theme === 'crimson-dusk' && (
							<span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
								<Check className="h-3 w-3" />
							</span>
						)}
						{/* Preview */}
						<div className="mb-2 h-16 rounded-lg overflow-hidden relative flex flex-col gap-1 p-2"
							style={{
								background: darkMode
									? 'linear-gradient(135deg, oklch(0.10 0.025 20) 0%, oklch(0.13 0.03 35) 100%)'
									: 'linear-gradient(135deg, oklch(0.97 0.010 40) 0%, oklch(0.93 0.025 25) 100%)',
							}}
						>
							<div className="absolute inset-0"
								style={{ background: darkMode
									? 'radial-gradient(ellipse at 75% 20%, oklch(0.48 0.24 25 / 50%) 0%, transparent 50%), radial-gradient(ellipse at 25% 70%, oklch(0.50 0.20 50 / 35%) 0%, transparent 50%)'
									: 'radial-gradient(ellipse at 75% 20%, oklch(0.65 0.22 25 / 25%) 0%, transparent 50%), radial-gradient(ellipse at 25% 70%, oklch(0.68 0.18 50 / 20%) 0%, transparent 50%)',
								}}
							/>
							<div className="relative h-2 w-3/4 rounded"
								style={{ background: darkMode ? 'oklch(0.65 0.22 25 / 90%)' : 'oklch(0.52 0.22 25 / 80%)' }}
							/>
							<div className="relative h-2 w-1/2 rounded"
								style={{ background: darkMode ? 'oklch(0.70 0.20 50 / 60%)' : 'oklch(0.60 0.18 50 / 50%)' }}
							/>
							<div className="relative mt-1 h-6 w-full rounded-lg"
								style={{
									background: darkMode ? 'oklch(0.15 0.03 20 / 80%)' : 'oklch(0.99 0.006 40 / 75%)',
									border: darkMode ? '1px solid oklch(0.65 0.22 25 / 25%)' : '1px solid oklch(0.52 0.22 25 / 30%)',
								}}
							/>
						</div>
						<p className="text-sm font-medium">Crimson Dusk</p>
						<p className="text-xs text-muted-foreground">Warmer Sonnenuntergang in Rot & Orange</p>
					</button>
				</div>
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

      {/* Dev-Preview – nur im Entwicklungsmodus sichtbar */}
      {import.meta.env.DEV && (
        <Card className="rounded-xl shadow-sm border-dashed border-yellow-500/60">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-yellow-500" />
              <CardTitle className="text-base text-yellow-600 dark:text-yellow-400">Dev: UpdateDialog Vorschau</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Nur im Dev-Modus sichtbar.</p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => startPreview('confirm')}>Phase: confirm</Button>
            <Button variant="outline" size="sm" onClick={() => startPreview('downloading')}>Phase: downloading (animiert)</Button>
            <Button variant="outline" size="sm" onClick={() => startPreview('done')}>Phase: done</Button>
          </CardContent>
        </Card>
      )}

      {previewOpen && (
        <UpdateDialog
          version="1.2.3"
          releaseNotes={"• Neue Funktion A\n• Bugfix B\n• Performance verbessert"}
          phase={previewPhase}
          progress={previewProgress}
          onConfirm={() => startPreview('downloading')}
          onCancel={closePreview}
        />
      )}
    </div>
	);
}
