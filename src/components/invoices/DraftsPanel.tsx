// Entwürfe: am Desktop eine Seitenleiste, am Handy ein Blatt von unten.
//
// Die Seitenleiste war auf dem Handy fast bildschirmfüllend, hatte aber
// weiterhin Kopfzeile, Schließkreuz und zwei Symbolknöpfe pro Zeile – auf
// dem Handy war das dicht gedrängt und nirgends zum Wegziehen. Deshalb dort
// dasselbe Blatt wie überall sonst, mit Griff und Gruppenliste.

import { useState } from 'react';
import { useAppStore } from '@/store';
import type { InvoiceDraft } from '@/store';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useSheetDrag, SheetGrabber } from '@/components/ui/sheet-drag';
import { Button } from '@/components/ui/button';
import { FileText, Trash2, ArrowRight, Trash } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { NewInvoiceDialog } from './NewInvoiceDialog';
import { DraftListGroup } from './DraftListGroup';
import { ListGroup, ListRow } from '@/components/ui/list-group';
import { useIsMobile } from '@/hooks/useIsMobile';
import { deleteDraftDb, deleteAllDraftsDb } from '@/lib/db';
import { deleteDraftFile } from '@/lib/pdf';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props {
  open: boolean;
  onClose: () => void;
}

const EMPTY_HINT =
  'Wenn du beim Upload mehrere PDFs auswählst oder „Als Entwurf speichern" tippst, liegen sie hier.';

export function DraftsPanel({ open, onClose }: Props) {
  const drafts = useAppStore((s) => s.drafts ?? []);
  const removeDraft = useAppStore((s) => s.removeDraft);
  const clearDrafts = useAppStore((s) => s.clearDrafts);
  const isMobile = useIsMobile();
  const [activeDraft, setActiveDraft] = useState<InvoiceDraft | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [confirmDeleteDraft, setConfirmDeleteDraft] = useState<InvoiceDraft | null>(null);
  const { contentRef, onGrabberMouseDown } = useSheetDrag(onClose);

  const handleDelete = async (draft: InvoiceDraft) => {
    await deleteDraftDb(draft.id).catch(() => {});
    if (draft.relativePath) await deleteDraftFile(draft.relativePath).catch(() => {});
    removeDraft(draft.id);
    setConfirmDeleteDraft(null);
  };

  const handleClearAll = async () => {
    await deleteAllDraftsDb().catch(() => {});
    for (const d of drafts) {
      if (d.relativePath) await deleteDraftFile(d.relativePath).catch(() => {});
    }
    clearDrafts();
    setConfirmClearOpen(false);
  };

  const handleDraftClose = (saved?: boolean) => {
    if (saved && activeDraft) {
      deleteDraftDb(activeDraft.id).catch(() => {});
      if (activeDraft.relativePath) deleteDraftFile(activeDraft.relativePath).catch(() => {});
      removeDraft(activeDraft.id);
    }
    setActiveDraft(null);
  };

  const dialogs = (
    <>
      {/* Bestätigung: Alle löschen */}
      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alle Entwürfe löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {drafts.length} Entwurf{drafts.length !== 1 ? 'e werden' : ' wird'} unwiderruflich gelöscht. Die zugehörigen Dateien werden ebenfalls entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleClearAll}
            >
              Alle löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bestätigung: Einzelnen Entwurf löschen */}
      <AlertDialog open={!!confirmDeleteDraft} onOpenChange={(v) => { if (!v) setConfirmDeleteDraft(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Entwurf löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{confirmDeleteDraft?.fileName}" wird unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteDraft && handleDelete(confirmDeleteDraft)}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {activeDraft && (
        <NewInvoiceDialog
          open={!!activeDraft}
          onClose={handleDraftClose}
          initialPdfPath={activeDraft.filePath}
          initialPdfName={activeDraft.fileName}
        />
      )}
    </>
  );

  // ── Handy ──
  if (isMobile) {
    return (
      <>
        <Sheet open={open} onOpenChange={(v: boolean) => { if (!v) onClose(); }}>
          <SheetContent
            ref={contentRef}
            side="bottom"
            showCloseButton={false}
            aria-describedby={undefined}
            className="max-h-[85dvh] gap-0 rounded-t-2xl p-0"
          >
            <SheetTitle className="sr-only">Entwürfe</SheetTitle>
            <SheetGrabber onMouseDown={onGrabberMouseDown} />

            <div
              className="min-h-0 flex-1 space-y-8 overflow-y-auto overscroll-contain px-4 pt-1"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
            >
              <div className="flex items-baseline justify-between px-1">
                <h2 className="text-[22px] font-bold tracking-tight">Entwürfe</h2>
                <span className="text-[13px] text-muted-foreground">
                  {drafts.length === 0 ? 'keine' : `${drafts.length} offen`}
                </span>
              </div>

              {drafts.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-[15px] text-muted-foreground">Keine Entwürfe vorhanden</p>
                  <p className="text-[13px] leading-snug text-muted-foreground/70">{EMPTY_HINT}</p>
                </div>
              ) : (
                <>
                  <DraftListGroup
                    drafts={drafts}
                    onOpen={setActiveDraft}
                    onDelete={setConfirmDeleteDraft}
                    footer="Tippe einen Entwurf an, um ihn als Beleg zu erfassen."
                  />
                  <ListGroup>
                    <ListRow
                      tint="red"
                      icon={<Trash />}
                      label="Alle Entwürfe löschen"
                      destructive
                      noChevron
                      onClick={() => setConfirmClearOpen(true)}
                    />
                  </ListGroup>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
        {dialogs}
      </>
    );
  }

  // ── Desktop ──
  return (
    <>
      <Sheet open={open} onOpenChange={(v: boolean) => { if (!v) onClose(); }}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-[420px] sm:w-[460px] p-0 flex flex-col overflow-hidden"
        >
          {/* Sticky header */}
          <div className="flex items-center justify-between px-5 py-4 border-b bg-background shrink-0">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <SheetTitle className="font-semibold text-base">Entwürfe</SheetTitle>
              <span className="text-sm text-muted-foreground">({drafts.length})</span>
            </div>
            <div className="flex items-center gap-1">
              {drafts.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-muted-foreground hover:text-destructive gap-1.5"
                  onClick={() => setConfirmClearOpen(true)}
                >
                  <Trash className="h-3.5 w-3.5" />
                  Alle löschen
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </Button>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {drafts.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center gap-3 py-20 px-6">
                <FileText className="h-12 w-12 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">Keine Entwürfe vorhanden</p>
                <p className="text-xs text-muted-foreground/60 max-w-xs">{EMPTY_HINT}</p>
              </div>
            ) : (
              <div className="px-4 py-3 space-y-1">
                {drafts.map((draft) => (
                  <div
                    key={draft.id}
                    className="flex items-center justify-between p-3 group hover:bg-muted/50 rounded-xl transition-colors cursor-pointer"
                    onClick={() => setActiveDraft(draft)}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{draft.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(draft.addedAt), 'dd.MM.yyyy, HH:mm', { locale: de })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title="Öffnen & erfassen"
                        onClick={(e) => { e.stopPropagation(); setActiveDraft(draft); }}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        title="Entwurf löschen"
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteDraft(draft); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
      {dialogs}
    </>
  );
}
