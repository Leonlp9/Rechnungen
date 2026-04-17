import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { InvoiceTemplate, TemplateElement, TemplateVariable } from '@/types/template';
import { DEFAULT_RECHNUNG, DEFAULT_GUTSCHRIFT } from '@/lib/defaultTemplates';

const BUILTIN_DEFAULTS: Record<string, InvoiceTemplate> = {
  [DEFAULT_RECHNUNG.id]: DEFAULT_RECHNUNG,
  [DEFAULT_GUTSCHRIFT.id]: DEFAULT_GUTSCHRIFT,
};

interface TemplateStoreState {
  templates: InvoiceTemplate[];
  addTemplate: (t: InvoiceTemplate) => void;
  updateTemplate: (id: string, patch: Partial<InvoiceTemplate>) => void;
  deleteTemplate: (id: string) => void;
  resetBuiltin: (id: string) => void;
  updateElement: (templateId: string, element: TemplateElement) => void;
  deleteElement: (templateId: string, elementId: string) => void;
  addElement: (templateId: string, element: TemplateElement) => void;
  updateVariables: (templateId: string, variables: TemplateVariable[]) => void;
}

export const useTemplateStore = create<TemplateStoreState>()(
  persist(
    (set) => ({
      templates: [DEFAULT_RECHNUNG, DEFAULT_GUTSCHRIFT],

      addTemplate: (t) => set((s) => ({ templates: [...s.templates, t] })),

      updateTemplate: (id, patch) =>
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t
          ),
        })),

      deleteTemplate: (id) =>
        set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),

      resetBuiltin: (id) =>
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === id && BUILTIN_DEFAULTS[id]
              ? { ...BUILTIN_DEFAULTS[id], updatedAt: new Date().toISOString() }
              : t
          ),
        })),

      updateElement: (templateId, element) =>
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === templateId
              ? { ...t, elements: t.elements.map((el) => (el.id === element.id ? element : el)) }
              : t
          ),
        })),

      deleteElement: (templateId, elementId) =>
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === templateId
              ? { ...t, elements: t.elements.filter((el) => el.id !== elementId) }
              : t
          ),
        })),

      addElement: (templateId, element) =>
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === templateId ? { ...t, elements: [...t.elements, element] } : t
          ),
        })),

      updateVariables: (templateId, variables) =>
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === templateId ? { ...t, variables } : t
          ),
        })),
    }),
    {
      name: 'invoice-templates',
      // On first load (no stored data), use defaults; otherwise keep stored state as-is
      merge: (persisted: unknown, current) => {
        const p = persisted as TemplateStoreState | undefined;
        if (!p?.templates?.length) return current;
        // Ensure builtins always exist (add if missing, but keep stored version)
        const stored = p.templates;
        const hasRechnung = stored.some((t) => t.id === DEFAULT_RECHNUNG.id);
        const hasGutschrift = stored.some((t) => t.id === DEFAULT_GUTSCHRIFT.id);
        const missing = [
          ...(!hasRechnung ? [DEFAULT_RECHNUNG] : []),
          ...(!hasGutschrift ? [DEFAULT_GUTSCHRIFT] : []),
        ];
        return { ...current, templates: [...missing, ...stored] };
      },
    }
  )
);

