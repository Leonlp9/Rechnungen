import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { InvoiceTemplate, TemplateElement, TemplateVariable } from '@/types/template';
import { DEFAULT_RECHNUNG, DEFAULT_GUTSCHRIFT } from '@/lib/defaultTemplates';

const BUILTIN_DEFAULTS: Record<string, InvoiceTemplate> = {
  [DEFAULT_RECHNUNG.id]: DEFAULT_RECHNUNG,
  [DEFAULT_GUTSCHRIFT.id]: DEFAULT_GUTSCHRIFT,
};

const LEGACY_BUILTIN_TIMESTAMPS = new Set([
  '2024-01-01T00:00:00.000Z',
]);

function shouldUpgradeBuiltinTemplate(stored: InvoiceTemplate, fresh: InvoiceTemplate): boolean {
  const looksLegacy =
    LEGACY_BUILTIN_TIMESTAMPS.has(stored.updatedAt) ||
    LEGACY_BUILTIN_TIMESTAMPS.has(stored.createdAt);
  if (!looksLegacy) return false;
  return stored.updatedAt !== fresh.updatedAt;
}

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

      // Called on app mount – upgrades untouched legacy builtins to the latest shipped defaults
      autoUpdateBuiltins: () =>
        set((s) => ({
          templates: s.templates.map((t) => {
            const fresh = BUILTIN_DEFAULTS[t.id];
            if (!fresh) return t;
            if (shouldUpgradeBuiltinTemplate(t, fresh)) {
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

        // Bring untouched legacy builtins up-to-date to current shipped defaults.
        const upgraded = stored.map((t) => {
          const fresh = BUILTIN_DEFAULTS[t.id];
          if (!fresh) return t; // custom template – keep as-is
          if (shouldUpgradeBuiltinTemplate(t, fresh)) {
            return { ...fresh, updatedAt: new Date().toISOString() };
          }
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

