// Dev-only: Minimaler Tauri-Mock für den reinen Browser-Betrieb (npm run dev
// ohne `tauri dev`). Liefert leere Daten, damit das UI/Layout im Browser
// getestet werden kann. In der echten App (Tauri-WebView) ist er inaktiv,
// in Produktions-Builds wird er von Vite komplett wegoptimiert.

/* eslint-disable @typescript-eslint/no-explicit-any */

// Minimales gültiges PDF (eine Seite, "Demo PDF") für den Browser-Modus
const MINI_PDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 41>>stream
BT /F1 24 Tf 72 720 Td (Demo PDF) Tj ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R/Size 6>>
`;

if (import.meta.env.DEV && !('__TAURI_INTERNALS__' in window)) {
  let callbackId = 0;

  const invoke = async (cmd: string, _args?: unknown): Promise<any> => {
    switch (cmd) {
      // SQL-Plugin: leere Datenbank simulieren
      case 'plugin:sql|load':
        return 'sqlite:mock.db';
      case 'plugin:sql|select': {
        // Eine Demo-Rechnung, damit Liste + Detailseite im Browser testbar sind
        const query = String((_args as { query?: string })?.query ?? '');
        if (query.includes('FROM invoices')) {
          return [
            {
              id: 'demo-1',
              date: '2026-07-01',
              year: 2026,
              month: 7,
              category: 'software',
              description: 'Demo-Rechnung (Browser-Modus)',
              partner: 'Beispiel GmbH',
              netto: 84.03,
              fee: 0,
              ust: 15.97,
              brutto: 100,
              type: 'ausgabe',
              currency: 'EUR',
              pdf_path: 'pdfs/demo.pdf',
              note: '',
              created_at: '2026-07-01T10:00:00.000Z',
              updated_at: '2026-07-01T10:00:00.000Z',
              is_locked: 0,
              pdf_sha256: '',
              delivery_date: '',
              storno_of: '',
              pdf_text: '',
              project_id: '',
              xrechnung_path: '',
            },
          ];
        }
        return [];
      }
      case 'plugin:sql|execute':
        return [0, 0];
      case 'plugin:sql|close':
        return true;

      // Pfade
      case 'plugin:path|resolve_directory':
        return '/mock-appdata';
      case 'plugin:path|join':
        return ((_args as { paths: string[] })?.paths ?? []).join('/');

      // Events / Fenster
      case 'plugin:event|listen':
      case 'plugin:event|unlisten':
      case 'plugin:event|emit':
        return null;
      case 'plugin:window|set_theme':
      case 'plugin:window|theme':
        return null;

      // Dateisystem: Mini-Demo-PDF für die Detailseiten-Vorschau
      case 'plugin:fs|read_file':
        return Array.from(new TextEncoder().encode(MINI_PDF));
      case 'plugin:fs|exists':
        return false;
      case 'plugin:fs|mkdir':
      case 'plugin:fs|write_file':
      case 'plugin:fs|write_text_file':
        return null;

      // App-Infos
      case 'plugin:app|version':
        return 'dev';

      // Eigene Commands mit sinnvollen Leer-Antworten
      case 'get_pending_backup_path':
        return null;
      case 'cleanup_old_invoice_files':
        return 0;
      case 'keyring_get':
        return null;
      case 'sync_scan_app_files':
        return [];
      case 'get_system_stats':
        return null;

      default:
        console.warn(`[tauriMock] Unbekannter Befehl: ${cmd}`);
        return null;
    }
  };

  (window as any).__TAURI_INTERNALS__ = {
    metadata: {
      currentWindow: { label: 'main' },
      currentWebview: { label: 'main', windowLabel: 'main' },
    },
    plugins: {},
    invoke,
    transformCallback: (cb?: (payload: unknown) => void) => {
      const id = ++callbackId;
      (window as any)[`_${id}`] = cb;
      return id;
    },
    convertFileSrc: (path: string) => path,
  };

  console.info('[tauriMock] Browser-Modus: Tauri-Backend wird gemockt (leere Daten).');
}

export {};
