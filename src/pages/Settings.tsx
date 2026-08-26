import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getSetting, setSetting } from '@/lib/db';
import { getGeminiApiKey, saveGeminiApiKey } from '@/lib/gemini';
import type { AuditLogEntry } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAppStore } from '@/store';
import { useTutorialStore } from '@/store/tutorialStore';
import { TUTORIAL_STEPS } from '@/tutorial/tutorialSteps';
import { User, Bot, Palette, DatabaseBackup, Info, Bug, Cloud } from 'lucide-react';
import { getVersion } from '@tauri-apps/api/app';
import { BackupProgressOverlay } from '@/components/BackupProgressOverlay';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useIsMobile';
import { PageHeader } from '@/components/layout/PageHeader';
import { ListGroup, ListRow, type ListTint } from '@/components/ui/list-group';
import type { UpdatePhase } from '@/components/UpdateDialog';

import { ProfilTab } from '@/components/settings/tabs/ProfilTab';
import { PROFILE_FIELDS } from '@/components/settings/tabs/ProfilTab';
import { KiTab } from '@/components/settings/tabs/KiTab';
import { ErscheinungsbildTab } from '@/components/settings/tabs/ErscheinungsbildTab';
import { DatenTab } from '@/components/settings/tabs/DatenTab';
import { SyncTab } from '@/components/settings/tabs/SyncTab';
import { UeberTab } from '@/components/settings/tabs/UeberTab';
import { DevTab } from '@/components/settings/tabs/DevTab';

// Type alias exported for DevTab (PerformanceMark is a global Web API type)
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type { };

type TabId = 'profil' | 'ki' | 'erscheinungsbild' | 'daten' | 'sync' | 'ueber' | 'dev';

interface SettingsTab {
  id: TabId;
  label: string;
  icon: React.ElementType;
  devOnly?: boolean;
  tint: ListTint;
  hint?: string;
}

const TABS: SettingsTab[] = [
  { id: 'profil', label: 'Profil & Steuer', icon: User, tint: 'gray', hint: 'Firmendaten, Steuerregelung' },
  { id: 'ki', label: 'KI & API', icon: Bot, tint: 'purple', hint: 'Gemini-Schlüssel, Assistent' },
  { id: 'erscheinungsbild', label: 'Erscheinungsbild', icon: Palette, tint: 'blue', hint: 'Design, Themes, Animationen' },
  { id: 'daten', label: 'Daten & Backup', icon: DatabaseBackup, tint: 'green', hint: 'Sichern, wiederherstellen' },
  { id: 'sync', label: 'Cloud-Sync', icon: Cloud, tint: 'teal', hint: 'Geräte synchronisieren' },
  { id: 'ueber', label: 'Über', icon: Info, tint: 'indigo', hint: 'Version und Updates' },
  { id: 'dev', label: 'Dev Debug', icon: Bug, devOnly: true, tint: 'yellow' },
];

const TAB_IDS = TABS.map((t) => t.id);

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Deep-Link: /settings?tab=sync – u. a. vom Sync-Indikator genutzt
  const paramTab = searchParams.get('tab') as TabId | null;
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeTab, setActiveTabState] = useState<TabId>(
    paramTab && TAB_IDS.includes(paramTab) ? paramTab : 'profil',
  );
  const setActiveTab = (id: TabId) => {
    setActiveTabState(id);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', id);
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    if (paramTab && TAB_IDS.includes(paramTab) && paramTab !== activeTab) setActiveTabState(paramTab);
  }, [paramTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const contentRef = useRef<HTMLDivElement>(null);

  // Profil
  const [profile, setProfile] = useState<Record<string, string>>({});
  const [profileSaving, setProfileSaving] = useState(false);

  // KI
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [aiInstructions, setAiInstructions] = useState('');
  const [aiInstructionsSaving, setAiInstructionsSaving] = useState(false);
  const showAiChat = useAppStore((s) => s.showAiChat);
  const setShowAiChat = useAppStore((s) => s.setShowAiChat);

  // Erscheinungsbild
  const darkMode = useAppStore((s) => s.darkMode);
  const setDarkMode = useAppStore((s) => s.setDarkMode);

  // Über
  const [version, setVersion] = useState('');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  // Daten
  const [exportingBackup, setExportingBackup] = useState(false);
  const [importingBackup, setImportingBackup] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);

  // Dev state
  const [storeSnapshot, setStoreSnapshot] = useState<string | null>(null);
  const [lsKeys, setLsKeys] = useState<string[]>([]);
  const [lsViewKey, setLsViewKey] = useState<string | null>(null);
  const [lsViewVal, setLsViewVal] = useState<string | null>(null);
  const [pendingThrow, setPendingThrow] = useState<Error | null>(null);
  if (pendingThrow) throw pendingThrow;
  const [dbStatsLoading, setDbStatsLoading] = useState(false);
  const [envInfo, setEnvInfo] = useState<Record<string, string> | null>(null);
  const [perfMarks, setPerfMarks] = useState<PerformanceMark[]>([]);
  const [dbStats, setDbStats] = useState<Record<string, number> | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPhase, setPreviewPhase] = useState<UpdatePhase>('confirm');
  const [previewProgress, setPreviewProgress] = useState(0);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Dev: animate download progress
  useEffect(() => {
    if (previewPhase === 'downloading') {
      if (progressRef.current) clearInterval(progressRef.current);
      progressRef.current = setInterval(() => {
        setPreviewProgress((p) => {
          if (p >= 100) { clearInterval(progressRef.current!); return 100; }
          return p + 2;
        });
      }, 80);
    }
    return () => { if (progressRef.current) clearInterval(progressRef.current); };
  }, [previewPhase]);

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

  const visibleTabs = TABS.filter((t) => !t.devOnly || import.meta.env.DEV);
  const activeIdx = visibleTabs.findIndex((t) => t.id === activeTab);
  const prevTab = activeIdx > 0 ? visibleTabs[activeIdx - 1] : null;
  const nextTab = activeIdx < visibleTabs.length - 1 ? visibleTabs[activeIdx + 1] : null;

  const tutorialActive = useTutorialStore((s) => s.isActive);
  const tutorialStep = useTutorialStore((s) => s.currentStep);
  useEffect(() => {
    if (!tutorialActive) return;
    const step = TUTORIAL_STEPS[tutorialStep];
    if (step?.route === '/settings' && step.settingsTab) {
      setActiveTab(step.settingsTab as TabId);
    }
  }, [tutorialActive, tutorialStep]);

  // Der Inhalt des gewählten Bereichs – identisch für Desktop-Spalte und
  // Handy-Detailansicht.
  const tabContent = (
    <>
          {activeTab === 'profil' && (
        <ProfilTab profile={profile} setProfile={setProfile} profileSaving={profileSaving} saveProfile={saveProfile} />
      )}

      {activeTab === 'ki' && (
        <KiTab
          apiKey={apiKey} setApiKey={setApiKey}
          showKey={showKey} setShowKey={setShowKey}
          saveApiKey={saveApiKey}
          aiInstructions={aiInstructions} setAiInstructions={setAiInstructions}
          aiInstructionsSaving={aiInstructionsSaving} saveAiInstructions={saveAiInstructions}
          showAiChat={showAiChat} setShowAiChat={setShowAiChat}
        />
      )}

      {activeTab === 'erscheinungsbild' && (
        <ErscheinungsbildTab toggleDark={toggleDark} />
      )}

      {activeTab === 'daten' && (
        <DatenTab
          exportingBackup={exportingBackup} setExportingBackup={setExportingBackup}
          importingBackup={importingBackup} setImportingBackup={setImportingBackup}
          auditLog={auditLog} setAuditLog={setAuditLog}
          auditOpen={auditOpen} setAuditOpen={setAuditOpen}
          auditLoading={auditLoading} setAuditLoading={setAuditLoading}
        />
      )}

      {activeTab === 'sync' && <SyncTab />}

      {activeTab === 'ueber' && (
        <UeberTab
          version={version}
          checkingUpdate={checkingUpdate} setCheckingUpdate={setCheckingUpdate}
          clearingCache={clearingCache} setClearingCache={setClearingCache}
        />
      )}

      {activeTab === 'dev' && import.meta.env.DEV && (
        <DevTab
          version={version}
          activeTab={activeTab}
          storeSnapshot={storeSnapshot} setStoreSnapshot={setStoreSnapshot}
          lsKeys={lsKeys} setLsKeys={setLsKeys}
          lsViewKey={lsViewKey} setLsViewKey={setLsViewKey}
          lsViewVal={lsViewVal} setLsViewVal={setLsViewVal}
          dbStats={dbStats} setDbStats={setDbStats}
          dbStatsLoading={dbStatsLoading} setDbStatsLoading={setDbStatsLoading}
          envInfo={envInfo} setEnvInfo={setEnvInfo}
          perfMarks={perfMarks} setPerfMarks={setPerfMarks}
          setPendingThrow={setPendingThrow}
          previewOpen={previewOpen} setPreviewOpen={setPreviewOpen}
          previewPhase={previewPhase} setPreviewPhase={setPreviewPhase}
          previewProgress={previewProgress} setPreviewProgress={setPreviewProgress}
        />
      )}

    </>
  );

  // Auf dem Handy ist die Einstellungsseite eine Gruppenliste zum Reintippen –
  // die waagerechte Chip-Leiste war auf kleinen Displays unübersichtlich.
  if (isMobile) {
    if (!mobileOpen) {
      // Oben bewusst ohne Innenabstand: Die Kopfleiste klebt im Scrollbereich,
      // und ein Innenabstand hält sie darunter fest – in dem Streifen darüber
      // liefe der Inhalt ungehindert vorbei. Die Luft über dem Titel bringt
      // die Überschrift selbst mit (siehe App.css).
      return (
        <div className="h-full overflow-y-auto px-4 pb-8" style={{ paddingBottom: 'var(--app-main-pb, 2rem)' }}>
          {/* Dieselbe Überschrift wie auf jeder anderen Seite – damit sitzt
              der Titel dort, wo das Theme ihn erwartet (One UI: mittig). */}
          <PageHeader title="Einstellungen" className="mb-4" />
          <div className="space-y-8">
            <ListGroup>
              {visibleTabs.map((tab) => (
                <ListRow
                  key={tab.id}
                  tint={tab.tint}
                  icon={<tab.icon />}
                  label={tab.label}
                  hint={tab.hint}
                  onClick={() => { setActiveTab(tab.id); setMobileOpen(true); }}
                />
              ))}
            </ListGroup>
          </div>
        </div>
      );
    }

    const openTab = TABS.find((t) => t.id === activeTab);
    return (
      <div className="flex h-full flex-col overflow-hidden">
        {/* Dieselbe Kopfzeile wie überall sonst – die Unterseite gibt nur
            ihren eigenen Weg zurück mit, weil hier kein Verlaufseintrag
            existiert, zu dem man springen könnte. */}
        <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <div className="space-y-6" style={{ paddingBottom: 'var(--app-main-pb, 2rem)' }}>
            <PageHeader
              title={openTab?.label ?? 'Einstellungen'}
              back={{ label: 'Einstellungen', onClick: () => setMobileOpen(false) }}
            />
            {tabContent}
          </div>
        </div>
        <BackupProgressOverlay open={exportingBackup} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden md:flex-row">
      {/* Tab-Navigation: Desktop links als Spalte, Mobile oben als scrollbare Leiste */}
      <nav className="flex shrink-0 gap-1 overflow-x-auto px-2 py-2 md:w-52 md:flex-col md:space-y-1 md:gap-0 md:overflow-y-auto md:overflow-x-visible md:px-3 md:py-6">
        <h1 className="hidden md:block text-xl font-bold mb-4 px-2">Einstellungen</h1>
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
                'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all text-left whitespace-nowrap md:w-full md:py-2.5',
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
      <div className="h-px w-full bg-border shrink-0 md:h-auto md:w-px md:mr-6" />

      {/* Content – scrollable */}
      <div ref={contentRef} className="flex-1 min-w-0 overflow-y-auto">
        <div className="space-y-6 pb-6 max-w-2xl px-3 pt-4 md:px-0 md:pt-6 md:pr-6 md:pb-2">

          {tabContent}

          {/* Scroll-Footer */}
          <div className="mt-8 mb-4 rounded-xl border border-border bg-muted/20 px-5 py-4 flex items-center justify-between gap-4">
            {prevTab ? (
              <Button variant="outline" size="sm" onClick={() => { setActiveTab(prevTab.id); contentRef.current?.scrollTo({ top: 0 }); }} className="gap-2">
                ← {prevTab.label}
              </Button>
            ) : <span />}
            <p className="text-xs text-muted-foreground select-none">Du hast das Ende erreicht</p>
            {nextTab ? (
              <Button variant="outline" size="sm"
                onClick={() => { setActiveTab(nextTab.id); contentRef.current?.scrollTo({ top: 0 }); }}
                className={cn('gap-2', nextTab.devOnly && 'border-yellow-400/50 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10')}>
                {nextTab.label} →
              </Button>
            ) : <span />}
          </div>

        </div>
      </div>

      <BackupProgressOverlay open={exportingBackup} />
    </div>
  );
}

