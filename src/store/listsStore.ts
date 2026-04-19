import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ListType = 'todo' | 'kanban' | 'pinboard';

// ── Todo ────────────────────────────────────────────────────────────────────
export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
  doneAt?: string;
  images?: string[];
}

export interface TodoListData {
  items: TodoItem[];
}

// ── Kanban ──────────────────────────────────────────────────────────────────
export interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  color?: string;
  images?: string[];
}

export interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  cards: KanbanCard[];
}

export interface KanbanListData {
  columns: KanbanColumn[];
}

// ── Pinboard ─────────────────────────────────────────────────────────────────
export interface PinItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  color: string;
  type: 'note' | 'image';
}

export interface PinboardData {
  items: PinItem[];
  offsetX: number;
  offsetY: number;
}

// ── Generic List ──────────────────────────────────────────────────────────────
export interface AppList {
  id: string;
  name: string;
  type: ListType;
  createdAt: string;
  data: TodoListData | KanbanListData | PinboardData;
}

interface ListsState {
  lists: AppList[];
  addList: (list: AppList) => void;
  updateList: (id: string, patch: Partial<Omit<AppList, 'id'>>) => void;
  deleteList: (id: string) => void;
  renameList: (id: string, name: string) => void;
}

function newId() {
  return `lst-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function defaultKanbanData(): KanbanListData {
  return {
    columns: [
      { id: newId(), title: 'Backlog', color: '#6b7280', cards: [] },
      { id: newId(), title: 'Todo', color: '#3b82f6', cards: [] },
      { id: newId(), title: 'In Progress', color: '#f59e0b', cards: [] },
      { id: newId(), title: 'Done', color: '#22c55e', cards: [] },
    ],
  };
}

export function defaultTodoData(): TodoListData {
  return { items: [] };
}

export function defaultPinboardData(): PinboardData {
  return { items: [], offsetX: 0, offsetY: 0 };
}

export const useListsStore = create<ListsState>()(
  persist(
    (set) => ({
      lists: [],
      addList: (list) => set((s) => ({ lists: [...s.lists, list] })),
      updateList: (id, patch) =>
        set((s) => ({
          lists: s.lists.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        })),
      deleteList: (id) => set((s) => ({ lists: s.lists.filter((l) => l.id !== id) })),
      renameList: (id, name) =>
        set((s) => ({
          lists: s.lists.map((l) => (l.id === id ? { ...l, name } : l)),
        })),
    }),
    { name: 'rechnungs-manager-lists' }
  )
);

export function newListId() {
  return newId();
}


