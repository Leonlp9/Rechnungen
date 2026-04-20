import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/store/chatStore';
import { sendChatMessage } from '@/lib/gemini';
import type { GeminiChatMessage } from '@/lib/gemini';
import { ChatMessage } from './ChatMessage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Plus, Trash2, Send, Loader2, Paperclip, PaperclipIcon, X,
  Database, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useParams } from 'react-router-dom';import { useAppStore } from '@/store';
import { readFile } from '@tauri-apps/plugin-fs';
import { getAbsolutePdfPath } from '@/lib/pdf';

interface Props {
  pageContext: string;
  hasPdf: boolean;
  isInvoiceList: boolean;
}

export function ChatPanel({ pageContext, hasPdf, isInvoiceList }: Props) {
  const {
    sessions, activeChatId, createSession, deleteSession, setActiveSession,
    addMessage, updateLastAssistantMessage, setSessionTitle,
    pendingPdfBase64, setPendingPdf,
    useAllInvoicesForContext, setUseAllInvoicesForContext,
  } = useChatStore();
  const invoices = useAppStore((s) => s.invoices);
  const { id: invoiceId } = useParams<{ id: string }>();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeChatId) ?? null;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeSession?.messages.length, loading]);

  // Ensure there's always an active session
  useEffect(() => {
    if (!activeChatId && sessions.length === 0) {
      createSession();
    } else if (!activeChatId && sessions.length > 0) {
      setActiveSession(sessions[0].id);
    }
  }, [activeChatId, sessions.length]);

  async function handleAttachPdf() {
    if (!invoiceId) return;
    try {
      const inv = invoices.find((i) => String(i.id) === invoiceId);
      if (!inv?.pdf_path) return;
      const absPath = await getAbsolutePdfPath(inv.pdf_path);
      const bytes = await readFile(absPath);
      const b64 = btoa(String.fromCharCode(...bytes));
      setPendingPdf(b64);
    } catch (e) {
      console.error('PDF attach error:', e);
    }
  }

  async function handleSend(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    await doSend(msg);
  }

  async function doSend(msg: string) {
    let sessionId = activeChatId;
    if (!sessionId) {
      sessionId = createSession();
    }

    setInput('');
    const isFirst = (activeSession?.messages.length ?? 0) === 0;

    // Add user message
    const userMsg = {
      id: `${Date.now()}`,
      role: 'user' as const,
      content: msg,
      timestamp: Date.now(),
    };
    addMessage(sessionId, userMsg);

    // Add placeholder assistant message
    const assistantId = `${Date.now() + 1}`;
    addMessage(sessionId, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    });

    setLoading(true);

    try {
      // Build history from messages (exclude placeholder)
      const session = useChatStore.getState().sessions.find((s) => s.id === sessionId);
      const history: GeminiChatMessage[] = (session?.messages ?? [])
        .filter((m) => m.content) // exclude placeholder
        .slice(0, -1) // exclude the last placeholder assistant msg
        .map((m) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        }));
      // Add current user message
      history.push({ role: 'user', parts: [{ text: msg }] });

      const pdfAttach = pendingPdfBase64;
      if (pdfAttach) setPendingPdf(null);

      const response = await sendChatMessage(history, pageContext, isFirst, pdfAttach);

      updateLastAssistantMessage(sessionId, {
        content: response.answer,
        followUps: response.followUps,
      });

      if (isFirst && response.title) {
        setSessionTitle(sessionId, response.title);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      updateLastAssistantMessage(sessionId, {
        content: `❌ Fehler: ${errMsg}`,
        followUps: [],
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0">
        <button
          onClick={() => setSidebarOpen((o) => !o)}
          className="flex items-center gap-1 text-sm font-medium truncate flex-1 hover:text-primary transition-colors text-left"
        >
          <span className="truncate">{activeSession?.title ?? 'Neuer Chat'}</span>
          <ChevronDown className={cn('h-3 w-3 shrink-0 transition-transform', sidebarOpen && 'rotate-180')} />
        </button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0"
          onClick={() => { createSession(); setSidebarOpen(false); }}
          title="Neuer Chat"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Session Sidebar */}
      {sidebarOpen && (
        <div className="border-b bg-muted/30 max-h-36 overflow-y-auto shrink-0">
          {sessions.length === 0 && (
            <p className="text-xs text-muted-foreground px-3 py-2">Keine Chats vorhanden.</p>
          )}
          {sessions.map((sess) => (
            <div
              key={sess.id}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted transition-colors',
                sess.id === activeChatId && 'bg-muted'
              )}
              onClick={() => { setActiveSession(sess.id); setSidebarOpen(false); }}
            >
              <span className="flex-1 text-xs truncate">{sess.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteSession(sess.id); }}
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Context toggles */}
      {(isInvoiceList || hasPdf) && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/20 shrink-0 flex-wrap">
          {isInvoiceList && (
            <button
              onClick={() => setUseAllInvoicesForContext(!useAllInvoicesForContext)}
              className={cn(
                'flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors',
                useAllInvoicesForContext
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              <Database className="h-2.5 w-2.5" />
              Alle Rechnungen als Kontext
            </button>
          )}
          {hasPdf && (
            <button
              onClick={pendingPdfBase64 ? () => setPendingPdf(null) : handleAttachPdf}
              className={cn(
                'flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors',
                pendingPdfBase64
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {pendingPdfBase64 ? <X className="h-2.5 w-2.5" /> : <Paperclip className="h-2.5 w-2.5" />}
              {pendingPdfBase64 ? 'PDF entfernen' : 'PDF anhängen'}
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0"
      >
        {(!activeSession || activeSession.messages.length === 0) && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <p className="text-xs text-muted-foreground">
              Stelle eine Frage zu deinen Rechnungen oder zur App.
            </p>
            <div className="flex flex-col gap-1.5 w-full">
              {['Was sind meine Einnahmen dieses Jahr?', 'Wie füge ich eine Rechnung hinzu?', 'Zeige mir meine größten Ausgaben'].map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {activeSession?.messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            onFollowUp={(q) => handleSend(q)}
          />
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            </div>
            <div className="flex items-center gap-1 bg-muted rounded-2xl rounded-tl-sm px-3 py-2">
              <span className="text-xs text-muted-foreground animate-pulse">Denkt nach…</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 shrink-0 border-t">
        {pendingPdfBase64 && (
          <div className="flex items-center gap-1.5 text-xs text-primary mb-2">
            <PaperclipIcon className="h-3 w-3" />
            <span>PDF angehängt</span>
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Nachricht eingeben…"
            className="text-sm h-8"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={loading}
          />
          <Button
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}





