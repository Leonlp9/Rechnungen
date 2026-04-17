import type { LucideIcon } from 'lucide-react';

export interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  category: string;
  /** Badge-Farbe für die Kategorie (tailwind bg-xxx Klasse) */
  categoryColor?: string;
  onSelect: () => void;
}

export interface ProgressInfo {
  current: number;
  total: number;
  label?: string;
}

export type ProgressCallback = (info: ProgressInfo) => void;

export interface SearchProvider {
  id: string;
  label: string;
  /** Ob dieser Provider standardmäßig aktiv ist */
  defaultEnabled?: boolean;
  /** Ob dieser Provider als "langsam" markiert werden soll */
  slow?: boolean;
  search(query: string, signal?: AbortSignal, onProgress?: ProgressCallback): Promise<SearchResult[]>;
}

