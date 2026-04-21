import { useEffect, useRef, useState } from 'react';
import { getSetting, setSetting } from '@/lib/db';
import { getGeminiApiKey, saveGeminiApiKey } from '@/lib/gemini';
import type { AuditLogEntry } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAppStore } from '@/store';
import { useTutorialStore } from '@/store/tutorialStore';
import { TUTORIAL_STEPS } from '@/tutorial/tutorialSteps';
import { User, Bot, Palette, DatabaseBackup, Info, Bug } from 'lucide-react';
import { getVersion } from '@tauri-apps/api/app';
import { BackupProgressOverlay } from '@/components/BackupProgressOverlay';
import { cn } from '@/lib/utils';
import type { UpdatePhase } from '@/components/UpdateDialog';

import { ProfilTab } from '@/components/settings/tabs/ProfilTab';
import { PROFILE_FIELDS } from '@/components/settings/tabs/ProfilTab';
import { KiTab } from '@/components/settings/tabs/KiTab';
import { ErscheinungsbildTab } from '@/components/settings/tabs/ErscheinungsbildTab';
import { DatenTab } from '@/components/settings/tabs/DatenTab';
import { UeberTab } from '@/components/settings/tabs/UeberTab';
import { DevTab } from '@/components/settings/tabs/DevTab';

// Type alias exported for DevTab (PerformanceMark is a global Web API type)
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type { };

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

const PROFILE_FIELDS_LOCAL = PROFILE_FIELDS;

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('profil');
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
      PROFILE_FIELDS_LOCAL.map(async (f) => {
        const v = await getSetting(f.key);
        return [f.key, v ?? ''] as const;
      })
    ).then((entries) => setProfile(Object.fromEntries(entries))).catch(console.error);
  }, []);

  const saveProfile = async () => {
    setProfileSaving(true);
    try {
      await Promise.all(PROFILE_FIELDS_LOCAL.map((f) => setSetting(f.key, profile[f.key] ?? '')));
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

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left tab nav */}
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

      {/* Content – scrollable */}
      <div ref={contentRef} className="flex-1 min-w-0 overflow-y-auto">
        <div className="space-y-6 pb-2 max-w-2xl pt-6 pr-6">

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

