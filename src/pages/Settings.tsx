import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getSetting, setSetting, deleteAllStornoInvoices, getAllInvoices, getFullAuditLog } from '@/lib/db';
import { getGeminiApiKey, saveGeminiApiKey } from '@/lib/gemini';
import type { AuditLogEntry } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { useAppStore } from '@/store';
import { useTutorialStore } from '@/store/tutorialStore';
import { TUTORIAL_STEPS } from '@/tutorial/tutorialSteps';
import {
  Save, Eye, EyeOff, User, RefreshCw, FlaskConical, Check, Bot, GitBranch, ExternalLink,
  Code2, Navigation, Trash2, Download, Upload, DatabaseBackup, Receipt, ScrollText, FileDown,
  Palette, LayoutDashboard, FileText, FilePlus2, PenSquare, ListTodo, Mail, Settings as SettingsIcon,
  HelpCircle, CalendarDays, Info, Bug, Terminal, Database, Zap, AlertTriangle, RotateCcw,
  ClipboardList, Activity, Server, HardDrive, Cpu, MemoryStick, Car, Users, Landmark,
} from 'lucide-react';
import { getVersion } from '@tauri-apps/api/app';
import { checkForUpdates } from '@/lib/updater';
import { UpdateDialog, type UpdatePhase } from '@/components/UpdateDialog';
import { exportBackup, importBackup } from '@/lib/backup';
import { BackupProgressOverlay } from '@/components/BackupProgressOverlay';
import { VerfahrensdokuButton } from '@/components/settings/VerfahrensdokuButton';
import { cn } from '@/lib/utils';

const NAV_ITEMS_CONFIG = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/invoices', label: 'Alle Rechnungen', icon: FileText },
  { to: '/write-invoice', label: 'Rechnung schreiben', icon: FilePlus2 },
  { to: '/invoice-designer', label: 'Template Designer', icon: PenSquare },
  { to: '/lists', label: 'Listen', icon: ListTodo },
  { to: '/gmail', label: 'Mail', icon: Mail },
  { to: '/calendar', label: 'Kalender', icon: CalendarDays },
  { to: '/customers', label: 'Kunden', icon: Users },
  { to: '/fahrtenbuch', label: 'Fahrtenbuch', icon: Car },
  { to: '/bank-import', label: 'Bankimport', icon: Landmark },
  { to: '/settings', label: 'Einstellungen', icon: SettingsIcon },
  { to: '/help', label: 'Hilfe', icon: HelpCircle },
];

type TabId = 'profil' | 'ki' | 'erscheinungsbild' | 'daten' | 'ueber' | 'dev';

interface SettingsTab {
  id: TabId;
  label: string;
  icon: React.ElementType;
  devOnly?: boolean;
}

const TABS: SettingsTab[] = [
  { id: 'profil', label: 'Profil & Steuer', icon: User },
  { id: 'ki', label: 'KI & API', icon: Bot },
  { id: 'erscheinungsbild', label: 'Erscheinungsbild', icon: Palette },
  { id: 'daten', label: 'Daten & Backup', icon: DatabaseBackup },
  { id: 'ueber', label: 'Über', icon: Info },
  { id: 'dev', label: 'Dev Debug', icon: Bug, devOnly: true },
];

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
  const [activeTab, setActiveTab] = useState<TabId>('profil');
  const contentRef = useRef<HTMLDivElement>(null);

  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [aiInstructions, setAiInstructions] = useState('');
  const [aiInstructionsSaving, setAiInstructionsSaving] = useState(false);
  const darkMode = useAppStore((s) => s.darkMode);
  const setDarkMode = useAppStore((s) => s.setDarkMode);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const animations = useAppStore((s) => s.animations);
  const setAnimations = useAppStore((s) => s.setAnimations);
  const hiddenNavItems = useAppStore((s) => s.hiddenNavItems);
  const toggleNavItem = useAppStore((s) => s.toggleNavItem);
  const steuerregelung = useAppStore((s) => s.steuerregelung);
  const setSteuerregelung = useAppStore((s) => s.setSteuerregelung);
  const rechtsform = useAppStore((s) => s.rechtsform);
  const setRechtsform = useAppStore((s) => s.setRechtsform);
  const branchenprofil = useAppStore((s) => s.branchenprofil);
  const setBranchenprofil = useAppStore((s) => s.setBranchenprofil);
  const showAiChat = useAppStore((s) => s.showAiChat);
  const setShowAiChat = useAppStore((s) => s.setShowAiChat);
  const [profile, setProfile] = useState<Record<string, string>>({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [version, setVersion] = useState('');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [exportingBackup, setExportingBackup] = useState(false);
  const [importingBackup, setImportingBackup] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);

  // Dev preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPhase, setPreviewPhase] = useState<UpdatePhase>('confirm');
  const [previewProgress, setPreviewProgress] = useState(0);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Dev debug state
  const [storeSnapshot, setStoreSnapshot] = useState<string | null>(null);
  const [lsKeys, setLsKeys] = useState<string[]>([]);
  const [lsViewKey, setLsViewKey] = useState<string | null>(null);
  const [lsViewVal, setLsViewVal] = useState<string | null>(null);
  // Error Boundary Tester: Fehler im Render werfen, nicht im Event-Handler
  const [pendingThrow, setPendingThrow] = useState<Error | null>(null);
  if (pendingThrow) throw pendingThrow;
  const [dbStatsLoading, setDbStatsLoading] = useState(false);
  const [envInfo, setEnvInfo] = useState<Record<string, string> | null>(null);
  const [perfMarks, setPerfMarks] = useState<PerformanceMark[]>([]);
  const [dbStats, setDbStats] = useState<Record<string, number> | null>(null);

  const startPreview = (phase: UpdatePhase) => {
    setPreviewPhase(phase);
    setPreviewProgress(0);
    setPreviewOpen(true);
    if (phase === 'downloading') {
      if (progressRef.current) clearInterval(progressRef.current);
      progressRef.current = setInterval(() => {
        setPreviewProgress((p) => {
          if (p >= 100) { clearInterval(progressRef.current!); return 100; }
          return p + 2;
        });
      }, 80);
    }
  };

  const closePreview = () => {
    setPreviewOpen(false);
    if (progressRef.current) clearInterval(progressRef.current);
  };

  useEffect(() => {
    if (previewPhase === 'downloading' && previewProgress >= 100) {
      const t = setTimeout(() => setPreviewPhase('done'), 400);
      return () => clearTimeout(t);
    }
  }, [previewPhase, previewProgress]);

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion('0.1.0'));
    getGeminiApiKey().then((v) => { if (v) setApiKey(v); }).catch(console.error);
    getSetting('profile_ai_instructions').then((v) => { if (v) setAiInstructions(v); }).catch(console.error);
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
      await Promise.all(PROFILE_FIELDS.map((f) => setSetting(f.key, profile[f.key] ?? '')));
      toast.success('Profildaten gespeichert!');
    } catch (e) { toast.error('Fehler: ' + String(e)); } finally { setProfileSaving(false); }
  };

  const saveApiKey = async () => {
    try { await saveGeminiApiKey(apiKey); toast.success('API-Key gespeichert!'); }
    catch (e) { toast.error('Fehler: ' + String(e)); }
  };

  const saveAiInstructions = async () => {
    setAiInstructionsSaving(true);
    try { await setSetting('profile_ai_instructions', aiInstructions); toast.success('KI-Anweisungen gespeichert!'); }
    catch (e) { toast.error('Fehler: ' + String(e)); } finally { setAiInstructionsSaving(false); }
  };

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
  };

  // Dev helpers
  const captureStoreSnapshot = () => {
    try {
      const state = useAppStore.getState();
      const snap = JSON.stringify(state, (_k, v) => typeof v === 'function' ? '[Function]' : v, 2);
      setStoreSnapshot(snap);
    } catch (e) { toast.error('Fehler: ' + String(e)); }
  };

  const loadDbStats = async () => {
    setDbStatsLoading(true);
    try {
      const invoices = await getAllInvoices();
      const auditEntries = await getFullAuditLog(999999);
      setDbStats({
        'Belege gesamt': invoices.length,
        'Einnahmen': invoices.filter((i) => i.type === 'einnahme').length,
        'Ausgaben': invoices.filter((i) => i.type === 'ausgabe').length,
        'Info-Einträge': invoices.filter((i) => i.type === 'info').length,
        'Audit-Log Einträge': auditEntries.length,
      });
    } catch (e) { toast.error('Fehler: ' + String(e)); } finally { setDbStatsLoading(false); }
  };

  const captureEnvInfo = () => {
    setEnvInfo({
      'import.meta.env.MODE': import.meta.env.MODE,
      'import.meta.env.DEV': String(import.meta.env.DEV),
      'import.meta.env.PROD': String(import.meta.env.PROD),
      'navigator.userAgent': navigator.userAgent,
      'navigator.language': navigator.language,
      'window.innerWidth': String(window.innerWidth),
      'window.innerHeight': String(window.innerHeight),
      'devicePixelRatio': String(window.devicePixelRatio),
      'Date.now()': new Date().toISOString(),
    });
  };

  const capturePerfMarks = () => {
    const marks = performance.getEntriesByType('mark') as PerformanceMark[];
    setPerfMarks(marks);
    if (marks.length === 0) toast.info('Keine Performance-Marks vorhanden.');
  };

  const loadLsKeys = () => {
    setLsKeys(Object.keys(localStorage).sort());
    setLsViewKey(null); setLsViewVal(null);
  };

  const viewLsKey = (key: string) => {
    setLsViewKey(key);
    const raw = localStorage.getItem(key);
    try { setLsViewVal(JSON.stringify(JSON.parse(raw ?? ''), null, 2)); }
    catch { setLsViewVal(raw); }
  };

  const triggerToast = (type: 'success' | 'error' | 'info' | 'warning') => {
    const msgs = { success: '✅ Test-Success-Toast!', error: '❌ Test-Error-Toast!', info: 'ℹ️ Test-Info-Toast!', warning: '⚠️ Test-Warning-Toast!' };
    toast[type](msgs[type]);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => toast.success('In Zwischenablage kopiert!'))
      .catch(() => toast.error('Kopieren fehlgeschlagen'));
  };

  const visibleTabs = TABS.filter((t) => !t.devOnly || import.meta.env.DEV);
  const activeIdx = visibleTabs.findIndex((t) => t.id === activeTab);
  const prevTab = activeIdx > 0 ? visibleTabs[activeIdx - 1] : null;
  const nextTab = activeIdx < visibleTabs.length - 1 ? visibleTabs[activeIdx + 1] : null;

  // Tutorial: Automatisch zum richtigen Tab wechseln
  const tutorialActive = useTutorialStore((s) => s.isActive);
  const tutorialStep = useTutorialStore((s) => s.currentStep);
  useEffect(() => {
    if (!tutorialActive) return;
    const step = TUTORIAL_STEPS[tutorialStep];
    if (step?.route === '/settings' && step.settingsTab) {
      setActiveTab(step.settingsTab as TabId);
    }
  }, [tutorialActive, tutorialStep]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left tab nav – sticky, never scrolls */}
      <nav className="w-52 shrink-0 space-y-1 overflow-y-auto px-3 py-6">
        <h1 className="text-xl font-bold mb-4 px-2">Einstellungen</h1>
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isDev = tab.devOnly;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all text-left',
                isActive && !isDev && 'bg-primary/10 text-primary',
                isActive && isDev && 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
                !isActive && !isDev && 'text-muted-foreground hover:bg-muted hover:text-foreground',
                !isActive && isDev && 'text-yellow-600/70 dark:text-yellow-500/70 hover:bg-yellow-500/10 hover:text-yellow-600 dark:hover:text-yellow-400',
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', isDev && 'text-yellow-500')} />
              <span>{tab.label}</span>
              {isDev && (
                <span className="ml-auto text-[10px] font-bold bg-yellow-400/20 text-yellow-600 dark:text-yellow-400 rounded px-1">DEV</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="w-px bg-border shrink-0 mr-6" />

      {/* Content – scrollable, scrollbar at the far right */}
      <div ref={contentRef} className="flex-1 min-w-0 overflow-y-auto">
        <div className="space-y-6 pb-2 max-w-2xl pt-6 pr-6">

        {/* ── PROFIL & STEUER ── */}
        {activeTab === 'profil' && (
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
                    <Input value={profile[f.key] ?? ''} onChange={(e) => setProfile((p) => ({ ...p, [f.key]: e.target.value }))} placeholder={f.label} />
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
                  <Input type="number" defaultValue={useAppStore.getState().grundfreibetrag} onChange={(e) => useAppStore.getState().setGrundfreibetrag(Number(e.target.value) || 12348)} className="w-40" />
                  <p className="text-xs text-muted-foreground">Wird für die Steuerrücklage-Berechnung verwendet. 2025: 12.096 €, 2026: ca. 12.348 €.</p>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ── KI & API ── */}
        {activeTab === 'ki' && (
          <>
            <Card className="rounded-xl shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">KI-Chat</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">KI-Chat-Button anzeigen</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Zeigt oder versteckt den schwebenden KI-Chat-Button unten rechts im Bildschirm.
                    </p>
                  </div>
                  <Button
                    variant={showAiChat ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowAiChat(!showAiChat)}
                    className="min-w-24"
                  >
                    {showAiChat ? 'Aktiv' : 'Versteckt'}
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Gemini API-Key</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Wird sicher im OS-Schlüsselbund gespeichert (Windows Credential Manager / macOS Keychain).</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label>API-Key</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="AIza..." />
                      <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowKey(!showKey)}>
                        {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button onClick={saveApiKey}><Save className="mr-2 h-4 w-4" />Speichern</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">KI-Anweisungen</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Gib der KI eigene Regeln und Hinweise vor, die sie beim Analysieren von Rechnungen berücksichtigen soll – z.&nbsp;B. Sonderregeln für bestimmte Partner, bevorzugte Kategorien oder individuelle Hinweise.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ai-instructions">Anweisungen</Label>
                  <textarea
                    id="ai-instructions"
                    value={aiInstructions}
                    onChange={(e) => setAiInstructions(e.target.value)}
                    placeholder={`Beispiele:\n- Rechnungen von "Amazon" sind immer Ausgaben, Kategorie "buerobedarf"\n- Wenn der Partner "Finanzamt" heißt, ist es immer type="info"\n- Zahlungen an mich selbst mit dem Betreff "Privatentnahme" sind type="info"\n- Nutze für alle Streaming-Einnahmen die Kategorie "einnahmen"`}
                    rows={8}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y min-h-30 font-mono leading-relaxed"
                  />
                  <p className="text-xs text-muted-foreground">Freitext – die KI liest diese Anweisungen bei jeder Rechnungsanalyse mit.</p>
                </div>
                <div className="flex justify-end">
                  <Button onClick={saveAiInstructions} disabled={aiInstructionsSaving}>
                    <Save className="mr-2 h-4 w-4" />Anweisungen speichern
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ── ERSCHEINUNGSBILD ── */}
        {activeTab === 'erscheinungsbild' && (
          <>
            <Card className="rounded-xl shadow-sm" data-tutorial="settings-appearance">
              <CardHeader><CardTitle className="text-base">Erscheinungsbild</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div><Label>Dark Mode</Label><p className="text-xs text-muted-foreground">Dunkles Farbschema aktivieren</p></div>
                  <Button variant="outline" onClick={toggleDark}>{darkMode ? 'Deaktivieren' : 'Aktivieren'}</Button>
                </div>
                <div className="flex items-center justify-between">
                  <div><Label>UI Animationen</Label><p className="text-xs text-muted-foreground">Hover-Effekte, Karten-Lift, Seiten-Übergänge u.v.m.</p></div>
                  <Button variant="outline" onClick={() => setAnimations(!animations)} className="min-w-25">{animations ? 'Deaktivieren' : 'Aktivieren'}</Button>
                </div>
                <div className="space-y-3">
                  <div><Label>Theme</Label><p className="text-xs text-muted-foreground">Wähle das visuelle Design der App</p></div>
                  <div className="grid grid-cols-2 gap-3">
                    <ThemeButton id="default" label="Default" desc="Klares, minimales Design" active={theme === 'default'} onClick={() => setTheme('default')}>
                      <div className="mb-2 h-16 rounded-lg overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 flex flex-col gap-1 p-2">
                        <div className="h-2 w-3/4 rounded bg-zinc-900 dark:bg-zinc-100 opacity-80" /><div className="h-2 w-1/2 rounded bg-zinc-300 dark:bg-zinc-600" /><div className="mt-1 h-6 w-full rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700" />
                      </div>
                    </ThemeButton>
                    <ThemeButton id="zinc" label="Zinc" desc="Kühl-neutrales Grau, kompakt" active={theme === 'zinc'} onClick={() => setTheme('zinc')}>
                      <div className="mb-2 h-16 rounded-lg overflow-hidden flex flex-col gap-1 p-2" style={{ background: darkMode ? 'oklch(0.141 0 0)' : 'oklch(0.985 0 0)', border: darkMode ? '1px solid oklch(1 0 0 / 12%)' : '1px solid oklch(0.870 0 0)' }}>
                        <div className="h-2 w-3/4 rounded" style={{ background: darkMode ? 'oklch(0.920 0 0)' : 'oklch(0.271 0 0)' }} /><div className="h-2 w-1/2 rounded" style={{ background: darkMode ? 'oklch(0.650 0 0)' : 'oklch(0.520 0 0)', opacity: 0.5 }} /><div className="mt-1 h-6 w-full rounded" style={{ background: darkMode ? 'oklch(0.200 0 0)' : 'oklch(0.920 0 0)', border: darkMode ? '1px solid oklch(1 0 0 / 12%)' : '1px solid oklch(0.870 0 0)' }} />
                      </div>
                    </ThemeButton>
                    <ThemeButton id="stone" label="Stone" desc="Warm-neutrales Beige, weich" active={theme === 'stone'} onClick={() => setTheme('stone')}>
                      <div className="mb-2 h-16 rounded-lg overflow-hidden flex flex-col gap-1 p-2" style={{ background: darkMode ? 'oklch(0.147 0.012 75)' : 'oklch(0.982 0.012 75)', border: darkMode ? '1px solid oklch(1 0 0 / 12%)' : '1px solid oklch(0.858 0.026 75)' }}>
                        <div className="h-2 w-3/4 rounded" style={{ background: darkMode ? 'oklch(0.923 0.005 75)' : 'oklch(0.268 0.018 75)' }} /><div className="h-2 w-1/2 rounded" style={{ background: darkMode ? 'oklch(0.655 0.008 75)' : 'oklch(0.520 0.020 75)', opacity: 0.5 }} /><div className="mt-1 h-6 w-full rounded" style={{ background: darkMode ? 'oklch(0.205 0.005 75)' : 'oklch(0.910 0.022 75)', border: darkMode ? '1px solid oklch(1 0 0 / 12%)' : '1px solid oklch(0.858 0.026 75)' }} />
                      </div>
                    </ThemeButton>
                    <ThemeButton id="windows11" label="Windows 11" desc="Fluent Design, Windows-Blau" active={theme === 'windows11'} onClick={() => setTheme('windows11')}>
                      <div className="mb-2 h-16 rounded-lg overflow-hidden flex flex-col gap-1 p-2" style={{ background: darkMode ? 'oklch(0.115 0.012 248)' : 'oklch(0.975 0.006 240)', border: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid oklch(0.870 0.012 240)' }}>
                        <div className="flex items-center gap-1 mb-0.5"><div className="h-1.5 w-1.5 rounded-full" style={{ background: 'oklch(0.50 0.19 257)' }} /><div className="h-1.5 w-8 rounded" style={{ background: darkMode ? 'oklch(0.945 0.008 240)' : 'oklch(0.12 0.01 250)', opacity: 0.8 }} /></div>
                        <div className="h-2 w-3/4 rounded" style={{ background: darkMode ? 'oklch(0.945 0.008 240)' : 'oklch(0.12 0.01 250)', opacity: 0.85 }} /><div className="h-2 w-1/2 rounded" style={{ background: darkMode ? 'oklch(0.62 0.014 248)' : 'oklch(0.44 0.012 250)', opacity: 0.5 }} /><div className="mt-1 h-5 w-full rounded" style={{ background: darkMode ? 'oklch(0.210 0.018 248)' : 'oklch(0.930 0.010 240)', border: darkMode ? '1px solid oklch(1 0 0 / 10%)' : '1px solid oklch(0.870 0.012 240)' }} />
                      </div>
                    </ThemeButton>
                    <ThemeButton id="chroma" label="Chroma" desc="Lebendiger Regenbogen-Farbwechsel" active={theme === 'chroma'} onClick={() => setTheme('chroma')}>
                      <div className="mb-2 h-16 rounded-lg overflow-hidden relative flex flex-col gap-1 p-2" style={{ background: darkMode ? '#0f0f18' : '#fafaff', border: '1px solid transparent' }}>
                        <div className="absolute inset-0 rounded-lg" style={{ background: 'linear-gradient(135deg, oklch(0.65 0.24 0), oklch(0.65 0.24 60), oklch(0.65 0.24 120), oklch(0.65 0.24 180), oklch(0.65 0.24 240), oklch(0.65 0.24 300), oklch(0.65 0.24 360))', opacity: darkMode ? 0.30 : 0.18 }} />
                        <div className="relative h-2 w-3/4 rounded" style={{ background: 'linear-gradient(90deg, oklch(0.55 0.24 10), oklch(0.58 0.22 120), oklch(0.55 0.24 240))' }} /><div className="relative h-2 w-1/2 rounded" style={{ background: 'linear-gradient(90deg, oklch(0.65 0.20 60), oklch(0.65 0.20 180))', opacity: 0.7 }} /><div className="relative mt-1 h-6 w-full rounded-lg" style={{ background: darkMode ? 'oklch(0.19 0.026 240 / 80%)' : 'oklch(0.993 0.004 240 / 85%)', border: '1px solid oklch(0.60 0.22 300 / 40%)' }} />
                      </div>
                    </ThemeButton>
                    <ThemeButton id="liquid-glass" label="Liquid Glass" desc="Apple-ähnliches Glasdesign" active={theme === 'liquid-glass'} onClick={() => setTheme('liquid-glass')}>
                      <div className="mb-2 h-16 rounded-lg overflow-hidden relative flex flex-col gap-1 p-2" style={{ background: darkMode ? 'linear-gradient(135deg, oklch(0.18 0.04 265) 0%, oklch(0.14 0.03 200) 100%)' : 'linear-gradient(135deg, oklch(0.88 0.06 265) 0%, oklch(0.92 0.04 200) 100%)' }}>
                        <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(circle at 30% 30%, oklch(0.75 0.18 265 / 40%), transparent 60%)' }} />
                        <div className="relative h-2 w-3/4 rounded" style={{ background: darkMode ? 'oklch(0.95 0 0 / 80%)' : 'oklch(0.15 0 0 / 70%)' }} /><div className="relative h-2 w-1/2 rounded" style={{ background: darkMode ? 'oklch(0.95 0 0 / 40%)' : 'oklch(0.15 0 0 / 35%)' }} /><div className="relative mt-1 h-6 w-full rounded-lg" style={{ background: darkMode ? 'oklch(1 0 0 / 8%)' : 'oklch(1 0 0 / 55%)', backdropFilter: 'blur(8px)', border: darkMode ? '1px solid oklch(1 0 0 / 12%)' : '1px solid oklch(1 0 0 / 40%)' }} />
                      </div>
                    </ThemeButton>
                    <ThemeButton id="aurora-borealis" label="Aurora Borealis" desc="Nordlichter in Grün & Lila" active={theme === 'aurora-borealis'} onClick={() => setTheme('aurora-borealis')}>
                      <div className="mb-2 h-16 rounded-lg overflow-hidden relative flex flex-col gap-1 p-2" style={{ background: darkMode ? 'linear-gradient(135deg, oklch(0.10 0.025 220) 0%, oklch(0.12 0.03 175) 100%)' : 'linear-gradient(135deg, oklch(0.93 0.025 165) 0%, oklch(0.90 0.04 200) 100%)' }}>
                        <div className="absolute inset-0" style={{ background: darkMode ? 'radial-gradient(ellipse at 20% 50%, oklch(0.45 0.22 175 / 45%) 0%, transparent 55%), radial-gradient(ellipse at 80% 30%, oklch(0.42 0.24 280 / 35%) 0%, transparent 50%)' : 'radial-gradient(ellipse at 20% 50%, oklch(0.65 0.18 175 / 25%) 0%, transparent 55%), radial-gradient(ellipse at 80% 30%, oklch(0.60 0.20 280 / 20%) 0%, transparent 50%)' }} />
                        <div className="relative h-2 w-3/4 rounded" style={{ background: darkMode ? 'oklch(0.62 0.20 175 / 90%)' : 'oklch(0.48 0.18 175 / 80%)' }} /><div className="relative h-2 w-1/2 rounded" style={{ background: darkMode ? 'oklch(0.65 0.22 280 / 60%)' : 'oklch(0.55 0.20 280 / 50%)' }} /><div className="relative mt-1 h-6 w-full rounded-lg" style={{ background: darkMode ? 'oklch(0.14 0.03 210 / 80%)' : 'oklch(0.99 0.008 165 / 75%)', border: darkMode ? '1px solid oklch(0.62 0.20 175 / 25%)' : '1px solid oklch(0.48 0.18 175 / 30%)' }} />
                      </div>
                    </ThemeButton>
                    <ThemeButton id="crimson-dusk" label="Crimson Dusk" desc="Warmer Sonnenuntergang in Rot & Orange" active={theme === 'crimson-dusk'} onClick={() => setTheme('crimson-dusk')}>
                      <div className="mb-2 h-16 rounded-lg overflow-hidden relative flex flex-col gap-1 p-2" style={{ background: darkMode ? 'linear-gradient(135deg, oklch(0.10 0.025 20) 0%, oklch(0.13 0.03 35) 100%)' : 'linear-gradient(135deg, oklch(0.97 0.010 40) 0%, oklch(0.93 0.025 25) 100%)' }}>
                        <div className="absolute inset-0" style={{ background: darkMode ? 'radial-gradient(ellipse at 75% 20%, oklch(0.48 0.24 25 / 50%) 0%, transparent 50%), radial-gradient(ellipse at 25% 70%, oklch(0.50 0.20 50 / 35%) 0%, transparent 50%)' : 'radial-gradient(ellipse at 75% 20%, oklch(0.65 0.22 25 / 25%) 0%, transparent 50%), radial-gradient(ellipse at 25% 70%, oklch(0.68 0.18 50 / 20%) 0%, transparent 50%)' }} />
                        <div className="relative h-2 w-3/4 rounded" style={{ background: darkMode ? 'oklch(0.65 0.22 25 / 90%)' : 'oklch(0.52 0.22 25 / 80%)' }} /><div className="relative h-2 w-1/2 rounded" style={{ background: darkMode ? 'oklch(0.70 0.20 50 / 60%)' : 'oklch(0.60 0.18 50 / 50%)' }} /><div className="relative mt-1 h-6 w-full rounded-lg" style={{ background: darkMode ? 'oklch(0.15 0.03 20 / 80%)' : 'oklch(0.99 0.006 40 / 75%)', border: darkMode ? '1px solid oklch(0.65 0.22 25 / 25%)' : '1px solid oklch(0.52 0.22 25 / 30%)' }} />
                      </div>
                    </ThemeButton>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Navigation className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Navigation</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Wähle, welche Tabs in der Seitenleiste sichtbar sein sollen.</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {NAV_ITEMS_CONFIG.map(({ to, label, icon: Icon }) => {
                  const isVisible = !hiddenNavItems.includes(to);
                  const isSettings = to === '/settings';
                  return (
                    <div key={to} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{label}</span>
                      </div>
                      <Button variant="outline" size="sm" disabled={isSettings} onClick={() => toggleNavItem(to)} className="min-w-24">
                        {isVisible ? 'Ausblenden' : 'Einblenden'}
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </>
        )}

        {/* ── DATEN & BACKUP ── */}
        {activeTab === 'daten' && (
          <>
            <Card className="rounded-xl shadow-sm" data-tutorial="settings-backup">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <DatabaseBackup className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Backup & Wiederherstellen</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Erstelle ein vollständiges Backup aller Rechnungen, PDFs und Einstellungen als <code className="font-mono">.rmbackup</code>-Datei (umbenanntes ZIP).
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button className="flex-1" onClick={async () => {
                    setExportingBackup(true);
                    try {
                      const result = await exportBackup();
                      if (result.success) toast.success('Backup erfolgreich gespeichert!');
                      else if (result.error) toast.error('Backup fehlgeschlagen: ' + result.error);
                    } finally { setTimeout(() => setExportingBackup(false), 800); }
                  }} disabled={exportingBackup}>
                    <Download className="mr-2 h-4 w-4" />{exportingBackup ? 'Exportiere…' : 'Backup erstellen & exportieren'}
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={async () => {
                    setImportingBackup(true);
                    try {
                      const result = await importBackup();
                      if (result.success) { toast.success('Backup erfolgreich eingespielt! Die App wird neu geladen…'); setTimeout(() => window.location.reload(), 1500); }
                      else if (result.error) toast.error('Import fehlgeschlagen: ' + result.error);
                    } finally { setImportingBackup(false); }
                  }} disabled={importingBackup}>
                    <Upload className="mr-2 h-4 w-4" />{importingBackup ? 'Importiere…' : 'Backup wiederherstellen'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  ⚠️ Beim Wiederherstellen werden alle aktuellen Daten überschrieben. Die <code className="font-mono">.rmbackup</code>-Datei ist ein ZIP-Archiv.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-xl shadow-sm">
              <CardHeader className="flex flex-row items-center gap-3">
                <ScrollText className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">GoBD Audit-Trail (Änderungshistorie)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Jede Erstellung, Änderung und Löschung eines Belegs wird unveränderlich protokolliert (GoBD-konform).
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={async () => {
                    setAuditLoading(true);
                    try { const log = await getFullAuditLog(500); setAuditLog(log); setAuditOpen(true); }
                    catch (e) { toast.error('Fehler beim Laden: ' + String(e)); }
                    finally { setAuditLoading(false); }
                  }} disabled={auditLoading}>
                    <ScrollText className="mr-2 h-4 w-4" />{auditLoading ? 'Lade…' : 'Audit-Log anzeigen'}
                  </Button>
                  <Button variant="outline" onClick={async () => {
                    try {
                      const log = await getFullAuditLog(10000);
                      if (log.length === 0) { toast.info('Kein Audit-Log vorhanden.'); return; }
                      const header = 'ID;Beleg-ID;Aktion;Feld;Alter Wert;Neuer Wert;Zeitstempel;Notiz';
                      const esc = (v: string | null) => v == null ? '' : '"' + v.replace(/"/g, '""') + '"';
                      const rows = log.map((e) => [e.id, e.invoice_id, e.action, e.field_name ?? '', esc(e.old_value), esc(e.new_value), e.timestamp, esc(e.user_note)].join(';'));
                      const csv = '\uFEFF' + header + '\n' + rows.join('\n');
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a'); a.href = url; a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
                      URL.revokeObjectURL(url);
                      toast.success(`${log.length} Einträge als CSV exportiert.`);
                    } catch (e) { toast.error('Export fehlgeschlagen: ' + String(e)); }
                  }}>
                    <FileDown className="mr-2 h-4 w-4" />Als CSV exportieren
                  </Button>
                  <Button variant="outline" onClick={async () => {
                    try {
                      const ok = await invoke<boolean>('verify_audit_integrity');
                      if (ok) toast.success('✅ Audit-Trail-Integrität bestätigt — keine Manipulationen erkannt');
                      else toast.error('❌ Audit-Trail beschädigt — Einträge wurden möglicherweise manipuliert!');
                    } catch (e) { toast.error('Prüfung fehlgeschlagen: ' + String(e)); }
                  }}>
                    🔒 Integrität prüfen
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileDown className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Verfahrensdokumentation & Compliance</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Generiere auf Knopfdruck eine GoBD-konforme Verfahrensdokumentation als PDF.
                </p>
              </CardHeader>
              <CardContent>
                <VerfahrensdokuButton />
              </CardContent>
            </Card>
          </>
        )}

        {/* ── ÜBER ── */}
        {activeTab === 'ueber' && (
          <Card className="rounded-xl shadow-sm">
            <CardHeader><CardTitle className="text-base">Über</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10"><Code2 className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-sm font-semibold">Rechnungs-Manager</p>
                  <p className="text-xs text-muted-foreground">Version: <span className="font-mono font-medium text-foreground">{version ? `v${version}` : '...'}</span></p>
                  <p className="text-xs text-muted-foreground mt-0.5">Tauri · React · TypeScript · SQLite</p>
                </div>
              </div>
              <div className="h-px bg-border" />
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Entwickler</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-sm">L</div>
                  <div><p className="text-sm font-medium">Leon Rabe</p><p className="text-xs text-muted-foreground">Softwareentwicklung · Freelancer</p></div>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Links</p>
                <a href="https://github.com/Leonlp9/Rechnungen" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <GitBranch className="h-4 w-4 shrink-0" /><span>github.com/Leonlp9/Rechnungen</span><ExternalLink className="h-3 w-3 opacity-60 ml-auto" />
                </a>
                <a href="https://github.com/Leonlp9" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <GitBranch className="h-4 w-4 shrink-0" /><span>github.com/Leonlp9</span><ExternalLink className="h-3 w-3 opacity-60 ml-auto" />
                </a>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={async () => { setCheckingUpdate(true); await checkForUpdates(false); setCheckingUpdate(false); }} disabled={checkingUpdate}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${checkingUpdate ? 'animate-spin' : ''}`} />{checkingUpdate ? 'Suche...' : 'Nach Updates suchen'}
                </Button>
                <Button variant="outline" onClick={async () => {
                  setClearingCache(true);
                  try {
                    const deleted = await invoke<number>('cleanup_old_invoice_files', { days: 0 });
                    toast.success(deleted > 0 ? `Cache geleert – ${deleted} Datei${deleted === 1 ? '' : 'en'} gelöscht` : 'Cache ist bereits leer');
                  } catch (e) { toast.error('Fehler beim Leeren des Caches: ' + String(e)); }
                  finally { setClearingCache(false); }
                }} disabled={clearingCache}>
                  <Trash2 className={`mr-2 h-4 w-4 ${clearingCache ? 'animate-spin' : ''}`} />{clearingCache ? 'Leere...' : 'Cache leeren'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── DEV DEBUG ── */}
        {activeTab === 'dev' && import.meta.env.DEV && (
          <div className="space-y-5">
            <div className="rounded-xl border-2 border-yellow-400/50 bg-yellow-500/5 px-4 py-3 flex items-center gap-3">
              <FlaskConical className="h-6 w-6 text-yellow-500 shrink-0" />
              <div>
                <p className="text-sm font-bold text-yellow-600 dark:text-yellow-400">Dev Debug Panel</p>
                <p className="text-xs text-yellow-600/70 dark:text-yellow-500/70">Nur im Dev-Build sichtbar. Nicht für Endnutzer bestimmt.</p>
              </div>
            </div>

            {/* Toast Tester */}
            <Card className="rounded-xl border-yellow-400/30">
              <CardHeader><div className="flex items-center gap-2"><Zap className="h-4 w-4 text-yellow-500" /><CardTitle className="text-sm text-yellow-600 dark:text-yellow-400">Toast-Tester</CardTitle></div></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="border-green-500/40 text-green-600" onClick={() => triggerToast('success')}>✅ Success</Button>
                <Button size="sm" variant="outline" className="border-red-500/40 text-red-600" onClick={() => triggerToast('error')}>❌ Error</Button>
                <Button size="sm" variant="outline" className="border-blue-500/40 text-blue-600" onClick={() => triggerToast('info')}>ℹ️ Info</Button>
                <Button size="sm" variant="outline" className="border-yellow-500/40 text-yellow-600" onClick={() => triggerToast('warning')}>⚠️ Warning</Button>
              </CardContent>
            </Card>

            {/* UpdateDialog Preview */}
            <Card className="rounded-xl border-yellow-400/30">
              <CardHeader><div className="flex items-center gap-2"><RefreshCw className="h-4 w-4 text-yellow-500" /><CardTitle className="text-sm text-yellow-600 dark:text-yellow-400">UpdateDialog Vorschau</CardTitle></div></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => startPreview('confirm')}>Phase: confirm</Button>
                <Button variant="outline" size="sm" onClick={() => startPreview('downloading')}>Phase: downloading (animiert)</Button>
                <Button variant="outline" size="sm" onClick={() => startPreview('done')}>Phase: done</Button>
              </CardContent>
            </Card>

            {/* DB-Aktionen */}
            <Card className="rounded-xl border-yellow-400/30">
              <CardHeader><div className="flex items-center gap-2"><Database className="h-4 w-4 text-yellow-500" /><CardTitle className="text-sm text-yellow-600 dark:text-yellow-400">Datenbank-Aktionen & Statistiken</CardTitle></div></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button variant="destructive" size="sm" onClick={async () => {
                    const count = await deleteAllStornoInvoices();
                    const all = await getAllInvoices();
                    useAppStore.getState().setInvoices(all);
                    toast.success(`${count} Stornobuchung(en) gelöscht & Originalbelege entsperrt`);
                  }}>
                    <Trash2 className="mr-1 h-3 w-3" /> Alle Test-Stornos löschen
                  </Button>
                  <Button variant="outline" size="sm" onClick={loadDbStats} disabled={dbStatsLoading}>
                    <Activity className="mr-1 h-3 w-3" /> {dbStatsLoading ? 'Lädt…' : 'DB-Statistiken laden'}
                  </Button>
                </div>
                {dbStats && (
                  <div className="rounded-lg bg-muted/50 border p-3 grid grid-cols-2 gap-2">
                    {Object.entries(dbStats).map(([k, v]) => (
                      <div key={k} className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">{k}</span>
                        <span className="text-xs font-mono font-bold">{v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Store Inspector */}
            <Card className="rounded-xl border-yellow-400/30">
              <CardHeader><div className="flex items-center gap-2"><Server className="h-4 w-4 text-yellow-500" /><CardTitle className="text-sm text-yellow-600 dark:text-yellow-400">Zustand Store Inspector</CardTitle></div></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={captureStoreSnapshot}><ClipboardList className="mr-1 h-3 w-3" /> Store-Snapshot</Button>
                  {storeSnapshot && <Button variant="outline" size="sm" onClick={() => copyToClipboard(storeSnapshot)}>Kopieren</Button>}
                  {storeSnapshot && <Button variant="outline" size="sm" onClick={() => setStoreSnapshot(null)}>Schließen</Button>}
                </div>
                {storeSnapshot && (
                  <pre className="rounded-lg bg-muted/50 border p-3 text-[10px] font-mono overflow-auto max-h-64 leading-relaxed">{storeSnapshot}</pre>
                )}
              </CardContent>
            </Card>

            {/* LocalStorage Inspector */}
            <Card className="rounded-xl border-yellow-400/30">
              <CardHeader><div className="flex items-center gap-2"><HardDrive className="h-4 w-4 text-yellow-500" /><CardTitle className="text-sm text-yellow-600 dark:text-yellow-400">LocalStorage Inspector</CardTitle></div></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={loadLsKeys}>
                    <HardDrive className="mr-1 h-3 w-3" /> Keys laden ({Object.keys(localStorage).length})
                  </Button>
                  {lsKeys.length > 0 && <Button variant="outline" size="sm" onClick={() => { setLsKeys([]); setLsViewKey(null); setLsViewVal(null); }}>Schließen</Button>}
                </div>
                {lsKeys.length > 0 && (
                  <div className="rounded-lg border bg-muted/30 divide-y max-h-48 overflow-y-auto">
                    {lsKeys.map((k) => (
                      <button key={k} type="button" onClick={() => viewLsKey(k)}
                        className={cn('w-full px-3 py-1.5 text-left text-xs font-mono hover:bg-muted transition-colors', lsViewKey === k && 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400')}>
                        {k}
                      </button>
                    ))}
                  </div>
                )}
                {lsViewKey && lsViewVal && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-mono font-bold text-yellow-600 dark:text-yellow-400">{lsViewKey}</p>
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => copyToClipboard(lsViewVal)}>Kopieren</Button>
                    </div>
                    <pre className="rounded-lg bg-muted/50 border p-3 text-[10px] font-mono overflow-auto max-h-48 leading-relaxed">{lsViewVal}</pre>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Env Info */}
            <Card className="rounded-xl border-yellow-400/30">
              <CardHeader><div className="flex items-center gap-2"><Cpu className="h-4 w-4 text-yellow-500" /><CardTitle className="text-sm text-yellow-600 dark:text-yellow-400">Umgebungsinformationen</CardTitle></div></CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" size="sm" onClick={captureEnvInfo}><Terminal className="mr-1 h-3 w-3" /> Env-Info laden</Button>
                {envInfo && (
                  <div className="rounded-lg bg-muted/50 border divide-y overflow-hidden">
                    {Object.entries(envInfo).map(([k, v]) => (
                      <div key={k} className="flex gap-3 px-3 py-1.5">
                        <span className="text-[11px] font-mono text-muted-foreground shrink-0 w-44 truncate">{k}</span>
                        <span className="text-[11px] font-mono font-medium break-all">{v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Performance */}
            <Card className="rounded-xl border-yellow-400/30">
              <CardHeader><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-yellow-500" /><CardTitle className="text-sm text-yellow-600 dark:text-yellow-400">Performance Marks</CardTitle></div></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={capturePerfMarks}><Activity className="mr-1 h-3 w-3" /> Marks erfassen</Button>
                  <Button variant="outline" size="sm" onClick={() => { performance.clearMarks(); setPerfMarks([]); toast.info('Performance Marks geleert'); }}>Marks löschen</Button>
                </div>
                {perfMarks.length > 0 && (
                  <div className="rounded-lg bg-muted/50 border divide-y max-h-40 overflow-auto">
                    {perfMarks.map((m, i) => (
                      <div key={i} className="flex justify-between px-3 py-1.5">
                        <span className="text-[11px] font-mono">{m.name}</span>
                        <span className="text-[11px] font-mono text-muted-foreground">{m.startTime.toFixed(2)} ms</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Memory & Quick Actions */}
            <Card className="rounded-xl border-yellow-400/30">
              <CardHeader><div className="flex items-center gap-2"><MemoryStick className="h-4 w-4 text-yellow-500" /><CardTitle className="text-sm text-yellow-600 dark:text-yellow-400">Browser Memory & Schnellaktionen</CardTitle></div></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => {
                    // @ts-expect-error non-standard chromium API
                    const mem = performance.memory;
                    if (mem) toast.info(`JS Heap: ${(mem.usedJSHeapSize / 1048576).toFixed(1)} MB / ${(mem.jsHeapSizeLimit / 1048576).toFixed(1)} MB`);
                    else toast.info('Memory API nicht verfügbar (nur in Chromium)');
                  }}><MemoryStick className="mr-1 h-3 w-3" /> Heap-Größe anzeigen</Button>
                  <Button variant="outline" size="sm" onClick={() => window.location.reload()}><RotateCcw className="mr-1 h-3 w-3" /> App neu laden</Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    const info = { version, url: window.location.href, timestamp: new Date().toISOString() };
                    copyToClipboard(JSON.stringify(info, null, 2));
                  }}><Code2 className="mr-1 h-3 w-3" /> App-Info kopieren</Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    toast.info(`${Object.keys(localStorage).length} LocalStorage-Keys · ${document.cookie ? 'Cookies vorhanden' : 'Keine Cookies'}`);
                  }}><Database className="mr-1 h-3 w-3" /> Storage-Überblick</Button>
                </div>

                {/* Quick stats grid */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {([
                    ['Aktiver Tab', activeTab],
                    ['Theme', theme],
                    ['Dark Mode', darkMode ? 'ja' : 'nein'],
                    ['Animationen', animations ? 'an' : 'aus'],
                    ['Steuerregelung', steuerregelung],
                    ['Rechtsform', rechtsform],
                    ['Branchenprofil', branchenprofil],
                    ['App-Version', version || '…'],
                  ] as [string, string][]).map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-muted/50 border px-3 py-2 flex justify-between items-center">
                      <span className="text-[11px] text-muted-foreground">{label}</span>
                      <span className="text-[11px] font-mono font-bold">{value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Error Boundary Tester */}
            <Card className="rounded-xl border-yellow-400/30">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <CardTitle className="text-sm text-yellow-600 dark:text-yellow-400">Error Boundary Tester</CardTitle>
                </div>
                <p className="text-xs text-yellow-600/60 dark:text-yellow-500/60 mt-1">
                  Fehler werden im <strong>Render</strong> geworfen (nicht im Event-Handler) – so fängt die <code className="font-mono">AppErrorBoundary</code> sie korrekt ab.
                </p>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm"
                  className="border-yellow-400/50 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10"
                  onClick={() => setPendingThrow(new Error('Test-Fehler: Normaler Error aus Settings'))}>
                  🔥 Normalen Error
                </Button>
                <Button variant="outline" size="sm"
                  className="border-yellow-400/50 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10"
                  onClick={() => setPendingThrow(new TypeError("Test-Fehler: TypeError – Cannot read properties of undefined (reading 'foo')"))}>
                  🔥 TypeError
                </Button>
                <Button variant="outline" size="sm"
                  className="border-yellow-400/50 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10"
                  onClick={() => {
                    const e = new Error('Test-Fehler: Simulierter Hooks-Fehler\n\nRendered fewer hooks than expected.');
                    e.stack = e.message + '\n    at finishRenderingHooks\n    at renderWithHooks\n    at updateFunctionComponent\n    at beginWork';
                    setPendingThrow(e);
                  }}>
                  🔥 Hooks-Fehler
                </Button>
                <Button variant="outline" size="sm"
                  className="border-yellow-400/50 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10"
                  onClick={() => setPendingThrow(new RangeError('Test-Fehler: Maximum call stack size exceeded'))}>
                  🔥 RangeError
                </Button>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="rounded-xl border-red-400/30 bg-red-500/5">
              <CardHeader>
                <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" /><CardTitle className="text-sm text-red-600 dark:text-red-400">Danger Zone</CardTitle></div>
                <p className="text-xs text-red-500/70 mt-1">Nur für Testing – diese Aktionen können Datenverlust verursachen!</p>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button variant="destructive" size="sm" onClick={() => { localStorage.clear(); toast.success('LocalStorage geleert – App-Reload empfohlen!'); }}>
                  <Trash2 className="mr-1 h-3 w-3" /> LocalStorage leeren
                </Button>
                <Button variant="destructive" size="sm" onClick={async () => {
                  try {
                    const deleted = await invoke<number>('cleanup_old_invoice_files', { days: 0 });
                    toast.success(`${deleted} Invoice-Dateien gelöscht`);
                  } catch (e) { toast.error(String(e)); }
                }}>
                  <HardDrive className="mr-1 h-3 w-3" /> Alle Invoice-Dateien löschen
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Ende des Tabs: Scroll-Footer ── */}
        <div className="mt-8 mb-4 rounded-xl border border-border bg-muted/20 px-5 py-4 flex items-center justify-between gap-4">
          {/* Zurück */}
          {prevTab ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setActiveTab(prevTab.id); contentRef.current?.scrollTo({ top: 0 }); }}
              className="gap-2"
            >
              ← {prevTab.label}
            </Button>
          ) : <span />}

          <p className="text-xs text-muted-foreground select-none">Du hast das Ende erreicht</p>

          {/* Weiter */}
          {nextTab ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setActiveTab(nextTab.id); contentRef.current?.scrollTo({ top: 0 }); }}
              className={cn('gap-2', nextTab.devOnly && 'border-yellow-400/50 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10')}
            >
              {nextTab.label} →
            </Button>
          ) : <span />}
        </div>
        </div>{/* end space-y-6 */}
      </div>{/* end scrollable */}

      {/* Audit-Log Dialog */}
      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-primary" />
              Audit-Log – Änderungshistorie ({auditLog.length} Einträge)
            </DialogTitle>
          </DialogHeader>
          {auditLog.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Noch keine Einträge vorhanden.</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Zeitpunkt</TableHead>
                    <TableHead className="w-[80px]">Aktion</TableHead>
                    <TableHead>Beleg-ID</TableHead>
                    <TableHead>Feld</TableHead>
                    <TableHead>Alter Wert</TableHead>
                    <TableHead>Neuer Wert</TableHead>
                    <TableHead>Notiz</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLog.map((entry) => (
                    <TableRow key={entry.id} className="text-xs">
                      <TableCell className="font-mono text-[10px]">{new Date(entry.timestamp).toLocaleString('de-DE')}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${entry.action === 'created' ? 'bg-green-500/10 text-green-700 dark:text-green-400' : entry.action === 'deleted' ? 'bg-red-500/10 text-red-700 dark:text-red-400' : entry.action === 'updated' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400' : 'bg-muted text-muted-foreground'}`}>
                          {entry.action === 'created' ? 'Erstellt' : entry.action === 'deleted' ? 'Gelöscht' : entry.action === 'updated' ? 'Geändert' : entry.action === 'restored' ? 'Wiederhergestellt' : entry.action}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-[10px] max-w-[100px] truncate" title={entry.invoice_id}>{entry.invoice_id.slice(0, 12)}…</TableCell>
                      <TableCell className="text-muted-foreground">{entry.field_name ?? '–'}</TableCell>
                      <TableCell className="max-w-[120px] truncate text-red-600/70" title={entry.old_value ?? ''}>{entry.old_value ?? '–'}</TableCell>
                      <TableCell className="max-w-[120px] truncate text-green-600/70" title={entry.new_value ?? ''}>{entry.new_value ?? '–'}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[100px] truncate" title={entry.user_note}>{entry.user_note || '–'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

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

      <BackupProgressOverlay open={exportingBackup} />
    </div>
  );
}

// ── Helper: ThemeButton ──
function ThemeButton({ id: _id, label, desc, active, onClick, children }: {
  id: string; label: string; desc: string; active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`relative rounded-xl border-2 p-3 text-left transition-all hover:shadow-md focus:outline-none ${active ? 'border-primary shadow-md' : 'border-border hover:border-primary/50'}`}>
      {active && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" /></span>}
      {children}
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </button>
  );
}
