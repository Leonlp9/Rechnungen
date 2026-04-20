export const queryKeys = {
  invoices: {
    all: ['invoices'] as const,
    list: (filters?: Record<string, unknown>) => ['invoices', 'list', filters] as const,
    detail: (id: string) => ['invoices', 'detail', id] as const,
    stats: (year: number) => ['invoices', 'stats', year] as const,
  },
  partners: {
    all: ['partners'] as const,
  },
  settings: {
    all: ['settings'] as const,
    key: (key: string) => ['settings', key] as const,
  },
  customers: {
    all: ['customers'] as const,
    detail: (id: string) => ['customers', 'detail', id] as const,
  },
  fahrtenbuch: {
    all: ['fahrtenbuch'] as const,
  },
} as const;

