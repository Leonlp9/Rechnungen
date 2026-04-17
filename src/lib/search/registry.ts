import type { SearchProvider, SearchResult, ProgressCallback } from './types';

const providers: SearchProvider[] = [];

export function registerSearchProvider(provider: SearchProvider) {
  providers.push(provider);
}

export function getProviders(): SearchProvider[] {
  return [...providers];
}

export async function searchAll(
  query: string,
  enabledProviderIds: string[],
  signal?: AbortSignal,
  onProgress?: (providerId: string, info: import('./types').ProgressInfo) => void
): Promise<Map<string, SearchResult[]>> {
  const results = new Map<string, SearchResult[]>();
  if (!query.trim()) return results;

  const active = providers.filter((p) => enabledProviderIds.includes(p.id));

  await Promise.all(
    active.map(async (provider) => {
      try {
        const progressCb: ProgressCallback | undefined = onProgress
          ? (info) => onProgress(provider.id, info)
          : undefined;
        const res = await provider.search(query, signal, progressCb);
        if (res.length > 0) {
          results.set(provider.id, res);
        }
      } catch {
        // Provider-Fehler ignorieren
      }
    })
  );

  return results;
}

