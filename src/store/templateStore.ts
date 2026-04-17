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
  autoUpdateBuiltins: () => void;
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

      // Called on app mount – silently upgrades any builtin that is missing an 'items' element
      autoUpdateBuiltins: () =>
        set((s) => ({
          templates: s.templates.map((t) => {
            const fresh = BUILTIN_DEFAULTS[t.id];
            if (!fresh) return t;
            if (!t.elements.some((el) => el.type === 'items')) {
              return { ...fresh, updatedAt: new Date().toISOString() };
            }
            return t;
          }),
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
      merge: (persisted: unknown, current) => {
        const p = persisted as TemplateStoreState | undefined;
        if (!p?.templates?.length) return current;
        const stored = p.templates;

        // Always bring builtins up-to-date: replace stored builtin if it lacks an 'items' element
        const upgraded = stored.map((t) => {
          const fresh = BUILTIN_DEFAULTS[t.id];
          if (!fresh) return t; // custom template – keep as-is
          const hasItemsEl = t.elements.some((el) => el.type === 'items');
          if (!hasItemsEl) return { ...fresh, updatedAt: new Date().toISOString() };
          return t;
        });

        const hasRechnung = upgraded.some((t) => t.id === DEFAULT_RECHNUNG.id);
        const hasGutschrift = upgraded.some((t) => t.id === DEFAULT_GUTSCHRIFT.id);
        const missing = [
          ...(!hasRechnung ? [DEFAULT_RECHNUNG] : []),
          ...(!hasGutschrift ? [DEFAULT_GUTSCHRIFT] : []),
        ];
        return { ...current, templates: [...missing, ...upgraded] };
      },
    }
  )
);

