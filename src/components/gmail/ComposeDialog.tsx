import { useState, useCallback } from 'react';
import { useGmailStore, selectActiveAccount } from '@/store/gmailStore';
import { sendEmail, getValidToken } from '@/lib/gmail';
import { smtpSendEmail } from '@/lib/imap';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Send, X, Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Link as LinkIcon, Undo, Redo, Heading2, Quote } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExt from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import LinkExt from '@tiptap/extension-link';
import { cn } from '@/lib/utils';

interface ComposeDialogProps {
  open: boolean;
  onClose: () => void;
  replyTo?: {
    to: string;
    subject: string;
    messageId?: string;
    threadId?: string;
  };
}

function ToolbarBtn({
  active, disabled, onClick, title, children,
}: {
  active?: boolean; disabled?: boolean; onClick: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded p-1.5 transition-colors hover:bg-muted disabled:opacity-40',
        active && 'bg-muted text-primary'
      )}
    >
      {children}
    </button>
  );
}

export function ComposeDialog({ open, onClose, replyTo }: ComposeDialogProps) {
  const activeAccount = useGmailStore(selectActiveAccount);
  const updateAccountToken = useGmailStore((s) => s.updateAccountToken);

  const [to, setTo] = useState(replyTo?.to ?? '');
  const [subject, setSubject] = useState(
    replyTo?.subject
      ? replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`
      : ''
  );
  const [sending, setSending] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExt,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      LinkExt.configure({ openOnClick: false }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'min-h-[180px] px-3 py-2 text-sm focus:outline-none prose prose-sm max-w-none dark:prose-invert',
      },
    },
  });

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href ?? '';
    const url = window.prompt('URL eingeben:', prev);
    if (url === null) return;
    if (url === '') { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().setLink({ href: url }).run();
  }, [editor]);

  const handleSend = async () => {
    if (!activeAccount || !editor) return;
    if (!to.trim()) { toast.error('Bitte einen Empfänger angeben.'); return; }
    if (!subject.trim()) { toast.error('Bitte einen Betreff angeben.'); return; }
    setSending(true);
    try {
      const html = editor.getHTML();
      if (activeAccount.type === 'imap' && activeAccount.imapConfig) {
        await smtpSendEmail(
          activeAccount.imapConfig,
          activeAccount.email,
          activeAccount.email,
          to.trim(),
          subject.trim(),
          html
        );
      } else {
        const at = await getValidToken(activeAccount.token!, (t) => updateAccountToken(activeAccount.email, t));
        await sendEmail(at, to.trim(), subject.trim(), html, activeAccount.email, replyTo?.messageId, replyTo?.threadId);
      }
      toast.success('E-Mail gesendet!');
      onClose();
    } catch (e: any) {
      toast.error('Fehler: ' + (e?.message ?? String(e)));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl w-full" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{replyTo ? 'Antworten' : 'Neue E-Mail schreiben'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Von */}
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
            <span className="text-xs text-muted-foreground w-14 shrink-0">Von:</span>
            <span className="text-sm">{activeAccount?.email ?? '–'}</span>
          </div>

          {/* An */}
          <div className="space-y-1">
            <Label htmlFor="compose-to" className="text-xs text-muted-foreground">An</Label>
            <Input id="compose-to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="empfaenger@beispiel.de" disabled={sending} />
          </div>

          {/* Betreff */}
          <div className="space-y-1">
            <Label htmlFor="compose-subject" className="text-xs text-muted-foreground">Betreff</Label>
            <Input id="compose-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Betreff" disabled={sending} />
          </div>

          {/* Editor */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nachricht</Label>
            <div className="rounded-lg border border-input overflow-hidden">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/30 px-2 py-1">
                <ToolbarBtn title="Rückgängig" onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()}>
                  <Undo className="h-3.5 w-3.5" />
                </ToolbarBtn>
                <ToolbarBtn title="Wiederholen" onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()}>
                  <Redo className="h-3.5 w-3.5" />
                </ToolbarBtn>
                <div className="mx-1 h-4 w-px bg-border" />
                <ToolbarBtn title="Überschrift" active={editor?.isActive('heading', { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
                  <Heading2 className="h-3.5 w-3.5" />
                </ToolbarBtn>
                <ToolbarBtn title="Fett" active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()}>
                  <Bold className="h-3.5 w-3.5" />
                </ToolbarBtn>
                <ToolbarBtn title="Kursiv" active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()}>
                  <Italic className="h-3.5 w-3.5" />
                </ToolbarBtn>
                <ToolbarBtn title="Unterstrichen" active={editor?.isActive('underline')} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
                  <UnderlineIcon className="h-3.5 w-3.5" />
                </ToolbarBtn>
                <ToolbarBtn title="Durchgestrichen" active={editor?.isActive('strike')} onClick={() => editor?.chain().focus().toggleStrike().run()}>
                  <Strikethrough className="h-3.5 w-3.5" />
                </ToolbarBtn>
                <div className="mx-1 h-4 w-px bg-border" />
                <ToolbarBtn title="Aufzählung" active={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
                  <List className="h-3.5 w-3.5" />
                </ToolbarBtn>
                <ToolbarBtn title="Nummerierte Liste" active={editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
                  <ListOrdered className="h-3.5 w-3.5" />
                </ToolbarBtn>
                <ToolbarBtn title="Zitat" active={editor?.isActive('blockquote')} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
                  <Quote className="h-3.5 w-3.5" />
                </ToolbarBtn>
                <div className="mx-1 h-4 w-px bg-border" />
                <ToolbarBtn title="Links ausrichten" active={editor?.isActive({ textAlign: 'left' })} onClick={() => editor?.chain().focus().setTextAlign('left').run()}>
                  <AlignLeft className="h-3.5 w-3.5" />
                </ToolbarBtn>
                <ToolbarBtn title="Zentrieren" active={editor?.isActive({ textAlign: 'center' })} onClick={() => editor?.chain().focus().setTextAlign('center').run()}>
                  <AlignCenter className="h-3.5 w-3.5" />
                </ToolbarBtn>
                <ToolbarBtn title="Rechts ausrichten" active={editor?.isActive({ textAlign: 'right' })} onClick={() => editor?.chain().focus().setTextAlign('right').run()}>
                  <AlignRight className="h-3.5 w-3.5" />
                </ToolbarBtn>
                <div className="mx-1 h-4 w-px bg-border" />
                <ToolbarBtn title="Link einfügen" active={editor?.isActive('link')} onClick={setLink}>
                  <LinkIcon className="h-3.5 w-3.5" />
                </ToolbarBtn>
              </div>
              {/* Editor area */}
              <EditorContent editor={editor} className="bg-background" />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            <X className="mr-2 h-4 w-4" />
            Abbrechen
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Senden…</> : <><Send className="mr-2 h-4 w-4" />Senden</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
