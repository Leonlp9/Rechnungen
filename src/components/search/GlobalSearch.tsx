import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from 'cmdk';
import { Loader2, FileSearch, X } from 'lucide-react'; // Loader2 für Ladespinner im Input
import { useAppStore } from '@/store';
import { getProviders, registerSearchProvider, searchAll } from '@/lib/search/registry';
import { createNavigationProvider } from '@/lib/search/providers/navigationProvider';
import { createSettingsProvider } from '@/lib/search/providers/settingsProvider';
import { createInvoiceProvider } from '@/lib/search/providers/invoiceProvider';
import { createPdfProvider } from '@/lib/search/providers/pdfProvider';
import { createHelpProvider } from '@/lib/search/providers/helpProvider';
import type { SearchResult } from '@/lib/search/types';

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const navigate = useNavigate();
  const darkMode = useAppStore((s) => s.darkMode);
  const setDarkMode = useAppStore((s) => s.setDarkMode);
  const privacyMode = useAppStore((s) => s.privacyMode);
  const togglePrivacyMode = useAppStore((s) => s.togglePrivacyMode);
  const invoices = useAppStore((s) => s.invoices);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Map<string, SearchResult[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [pdfEnabled, setPdfEnabled] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const providersRegistered = useRef(false);

  // Provider einmalig registrieren
  useEffect(() => {
    if (providersRegistered.current) return;
    providersRegistered.current = true;

    const nav = (path: string) => {
      navigate(path);
      onClose();
    };

    const toggleDark = () => {
      const next = !darkMode;
      setDarkMode(next);
      document.documentElement.classList.toggle('dark', next);
      onClose();
    };

    registerSearchProvider(createNavigationProvider(nav));
    registerSearchProvider(
      createSettingsProvider({
        navigate: nav,
        darkMode,
        toggleDark,
        privacyMode,
        togglePrivacyMode: () => { togglePrivacyMode(); onClose(); },
      })
    );
    registerSearchProvider(createInvoiceProvider(nav, () => invoices));
    registerSearchProvider(createPdfProvider(nav, () => invoices));
    registerSearchProvider(createHelpProvider(nav));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const runSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults(new Map());
        setLoading(false);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);

      const enabled = getProviders()
        .filter((p) => p.defaultEnabled !== false || (pdfEnabled && p.id === 'pdf'))
        .map((p) => p.id);

      try {
        const res = await searchAll(q, enabled, controller.signal);
        if (!controller.signal.aborted) {
          setResults(res);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [pdfEnabled]
  );

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => runSearch(query), 200);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults(new Map());
      setLoading(false);
      abortRef.current?.abort();
    }
  }, [open]);

  if (!open) return null;

  const allProviders = getProviders();
  const totalResults = [...results.values()].reduce((sum, r) => sum + r.length, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/50 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl rounded-xl border border-border bg-background shadow-2xl overflow-hidden">
        <Command shouldFilter={false} className="flex flex-col">
          {/* Input row */}
          <div className="flex items-center border-b border-border px-4 gap-2">
            {loading ? (
              <Loader2 className="h-4 w-4 shrink-0 text-muted-foreground animate-spin" />
            ) : (
              <FileSearch className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Suchen nach Rechnungen, Seiten, Einstellungen, Hilfe…"
              className="flex h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
            <kbd className="hidden sm:flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 text-[10px] text-muted-foreground ml-2">
              Esc
            </kbd>
          </div>

          {/* PDF-Volltextsuche Option */}
          <div className="border-b border-border bg-muted/40">
            <div className="flex items-center gap-2 px-4 py-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={pdfEnabled}
                  onChange={(e) => setPdfEnabled(e.target.checked)}
                  className="rounded"
                />
                <FileSearch className="h-3.5 w-3.5" />
                PDF-Volltextsuche
              </label>
              {query && (
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {loading ? 'Suche läuft…' : `${totalResults} Treffer`}
                </span>
              )}
            </div>
          </div>

          {/* Results */}
          <CommandList className="max-h-[60vh] overflow-y-auto p-2">
            {!query && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <p className="text-base mb-1">🔍 Suche starten</p>
                <p className="text-xs">Rechnungen, Seiten, Einstellungen, Hilfe und mehr</p>
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {['Rechnung', 'Dashboard', 'Einstellungen', 'PDF hochladen', 'Dark Mode'].map((hint) => (
                    <button
                      key={hint}
                      onClick={() => setQuery(hint)}
                      className="text-xs rounded-full border border-border px-3 py-1 hover:bg-muted transition-colors"
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {query && !loading && totalResults === 0 && (
              <CommandEmpty className="py-10 text-center text-sm text-muted-foreground">
                Keine Ergebnisse für „{query}"
              </CommandEmpty>
            )}

            {allProviders.map((provider, idx) => {
              const providerResults = results.get(provider.id);
              if (!providerResults || providerResults.length === 0) return null;

              return (
                <div key={provider.id}>
                  {idx > 0 && <CommandSeparator className="my-1" />}
                  <CommandGroup
                    heading={
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-2 py-1">
                        {provider.label}
                      </span>
                    }
                  >
                    {providerResults.map((result) => {
                      const Icon = result.icon;
                      return (
                        <CommandItem
                          key={result.id}
                          value={result.id}
                          onSelect={() => { result.onSelect(); onClose(); }}
                          className="flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-accent data-[selected=true]:bg-accent transition-colors"
                        >
                          {Icon && (
                            <div className="shrink-0 flex h-7 w-7 items-center justify-center rounded-md bg-muted">
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{result.title}</p>
                            {result.subtitle && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{result.subtitle}</p>
                            )}
                          </div>
                          {result.categoryColor && (
                            <span className={`shrink-0 text-[10px] rounded px-1.5 py-0.5 font-medium ${result.categoryColor}`}>
                              {result.category}
                            </span>
                          )}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </div>
              );
            })}
          </CommandList>

          {/* Footer */}
          <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><kbd className="rounded border border-border bg-muted px-1">↑↓</kbd> Navigieren</span>
            <span className="flex items-center gap-1"><kbd className="rounded border border-border bg-muted px-1">↵</kbd> Auswählen</span>
            <span className="flex items-center gap-1"><kbd className="rounded border border-border bg-muted px-1">Esc</kbd> Schließen</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
