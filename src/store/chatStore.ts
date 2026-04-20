import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  followUps?: string[];
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}

interface ChatState {
  sessions: ChatSession[];
  activeChatId: string | null;
  isOpen: boolean;
  position: { x: number; y: number };
  // Per-message PDF attachment (only in InvoiceDetail)
  pendingPdfBase64: string | null;
  setPendingPdf: (base64: string | null) => void;
  // Visible invoices for table context
  visibleInvoiceIds: string[];
  setVisibleInvoiceIds: (ids: string[]) => void;
  useAllInvoicesForContext: boolean;
  setUseAllInvoicesForContext: (v: boolean) => void;
  // Chat session management
  createSession: () => string;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  addMessage: (sessionId: string, msg: ChatMessage) => void;
  updateLastAssistantMessage: (sessionId: string, patch: Partial<ChatMessage>) => void;
  setSessionTitle: (sessionId: string, title: string) => void;
  setOpen: (open: boolean) => void;
  setPosition: (pos: { x: number; y: number }) => void;
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      sessions: [],
      activeChatId: null,
      isOpen: false,
      position: { x: 0, y: 0 },
      pendingPdfBase64: null,
      visibleInvoiceIds: [],
      useAllInvoicesForContext: false,

      setPendingPdf: (base64) => set({ pendingPdfBase64: base64 }),
      setVisibleInvoiceIds: (ids) => set({ visibleInvoiceIds: ids }),
      setUseAllInvoicesForContext: (v) => set({ useAllInvoicesForContext: v }),

      createSession: () => {
        const MAX_SESSIONS = 20;
        const id = newId();
        const session: ChatSession = {
          id,
          title: 'Neuer Chat',
          messages: [],
          createdAt: Date.now(),
        };
        set((s) => ({
          sessions: [session, ...s.sessions].slice(0, MAX_SESSIONS),
          activeChatId: id,
        }));
        return id;
      },

      deleteSession: (id) => {
        set((s) => {
          const sessions = s.sessions.filter((sess) => sess.id !== id);
          const activeChatId =
            s.activeChatId === id ? (sessions[0]?.id ?? null) : s.activeChatId;
          return { sessions, activeChatId };
        });
      },

      setActiveSession: (id) => set({ activeChatId: id }),

      addMessage: (sessionId, msg) => {
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId
              ? { ...sess, messages: [...sess.messages, msg] }
              : sess,
          ),
        }));
      },

      updateLastAssistantMessage: (sessionId, patch) => {
        set((s) => ({
          sessions: s.sessions.map((sess) => {
            if (sess.id !== sessionId) return sess;
            const msgs = [...sess.messages];
            for (let i = msgs.length - 1; i >= 0; i--) {
              if (msgs[i].role === 'assistant') {
                msgs[i] = { ...msgs[i], ...patch };
                break;
              }
            }
            return { ...sess, messages: msgs };
          }),
        }));
      },

      setSessionTitle: (sessionId, title) => {
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId ? { ...sess, title } : sess,
          ),
        }));
      },

      setOpen: (open) => set({ isOpen: open }),
      setPosition: (pos) => set({ position: pos }),
    }),
    {
      name: 'rechnungs-manager-chat',
      partialize: (s) => ({
        sessions: s.sessions,
        activeChatId: s.activeChatId,
        position: s.position,
      }),
    },
  ),
);

// Selector helpers
export const getActiveSession = (state: ChatState) =>
  state.sessions.find((s) => s.id === state.activeChatId) ?? null;


