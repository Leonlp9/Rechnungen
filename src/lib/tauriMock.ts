// Dev-only: Minimaler Tauri-Mock für den reinen Browser-Betrieb (npm run dev
// ohne `tauri dev`). In der echten App (Tauri-WebView) ist er inaktiv, in
// Produktions-Builds wird er von Vite komplett wegoptimiert.
//
// Liegt unter src/lib/devdaten/backup.json ein Auszug einer echten Datenbank,
// bedient der Mock die Abfragen daraus – dann sieht man im Browser dieselben
// Zahlen wie in der App. Der Ordner steht in .gitignore: Der Bezug ist
// öffentlich, und die Datei enthält Anschrift, Steuernummer und alle Belege.
// Fehlt sie, bleibt es bei einer einzelnen Demo-Buchung.
//
// So legt man sie an: In der App unter Einstellungen → Daten & Backup ein
// Backup schreiben, die .rmbackup-Datei entpacken (es ist ein ZIP) und die
// Tabellen aus rechnungen.db als JSON in diesem Format ablegen:
//   { "invoices": [...], "fahrtenbuch": [...], "settings": [...] }

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

/**
 * Echte Daten, falls hinterlegt. `eager: false` und der Zugriff über glob
 * sorgen dafür, dass Vite nicht meckert, wenn die Datei gar nicht existiert.
 */
type DevDaten = Record<string, Array<Record<string, unknown>>>;
const devDatenModule = import.meta.glob<{ default: DevDaten }>('./devdaten/backup.json', { eager: true });
const devDaten: DevDaten | null =
  Object.values(devDatenModule)[0]?.default ?? null;

/**
 * Ermittelt aus einer SQL-Abfrage die Tabelle, die gemeint ist. Der Mock
 * versteht kein SQL – er braucht nur den Namen, um die passende Liste
 * zurückzugeben.
 */
function tabelleAus(query: string): string | null {
  const treffer = /\bFROM\s+"?([a-z_]+)"?/i.exec(query);
  return treffer ? treffer[1] : null;
}

if (import.meta.env.DEV && !('__TAURI_INTERNALS__' in window)) {
  let callbackId = 0;

  if (devDaten) {
    const anzahl = Object.entries(devDaten)
      .map(([t, r]) => `${t}: ${r.length}`)
      .join(', ');
    console.info(`[tauriMock] Browser-Modus mit echten Daten aus devdaten/backup.json (${anzahl})`);
  }

  // Einstellungen im Speicher halten – sonst lassen sich Dinge wie der
  // Keyring-Fallback im Browser gar nicht ausprobieren.
  const settings = new Map<string, string>();

  // Die hinterlegten Einstellungen gleich übernehmen, damit Profil und
  // Steuerregelung stimmen.
  for (const zeile of devDaten?.settings ?? []) {
    if (typeof zeile.key === 'string') settings.set(zeile.key, String(zeile.value ?? ''));
  }

  const invoke = async (cmd: string, _args?: unknown): Promise<any> => {
    switch (cmd) {
      // SQL-Plugin: leere Datenbank simulieren
      case 'plugin:sql|load':
        return 'sqlite:mock.db';
      // Kein OS-Schlüsselbund auf Mobilgeräten – dort sind diese Kommandos
      // per #[cfg(desktop)] nicht kompiliert. Der Mock bildet das nach, damit
      // der Fallback auf die Datenbank auch im Browser durchlaufen wird.
      case 'keyring_set':
      case 'keyring_get':
      case 'keyring_delete':
        throw new Error(`Command ${cmd} not found`);

      case 'plugin:sql|select': {
        const query = String((_args as { query?: string })?.query ?? '');

        // Einstellungen liegen im Speicher, damit Änderungen im Browser halten.
        if (query.includes('FROM settings')) {
          const key = String((_args as { values?: unknown[] })?.values?.[0] ?? '');
          const value = settings.get(key);
          return value === undefined ? [] : [{ value }];
        }

        // Mit hinterlegten Daten: die passende Tabelle ausliefern. Der Mock
        // versteht kein SQL – WHERE, ORDER BY und LIMIT ignoriert er. Für
        // Layout und Rechenwege reicht das, weil die App fast überall die
        // ganze Tabelle lädt und selbst filtert.
        const tabelle = tabelleAus(query);
        if (devDaten && tabelle && devDaten[tabelle]) {
          if (/\bCOUNT\s*\(/i.test(query)) return [{ count: devDaten[tabelle].length }];
          return devDaten[tabelle];
        }

        if (query.includes('FROM invoices')) {
          // Ohne hinterlegte Daten bleibt eine Demo-Buchung, damit Liste und
          // Detailseite überhaupt etwas zeigen.
          return [
            {
              id: 'demo-1',
              date: '2026-07-01',
              year: 2026,
              month: 7,
              category: 'software_abos',
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
      case 'plugin:sql|execute': {
        const query = String((_args as { query?: string })?.query ?? '');
        if (query.includes('INTO settings')) {
          const vals = (_args as { values?: unknown[] })?.values ?? [];
          settings.set(String(vals[0]), String(vals[1] ?? ''));
        }
        return [0, 0];
      }
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

  console.info(devDaten
    ? '[tauriMock] Browser-Modus: Tauri-Backend wird gemockt, Daten aus devdaten/backup.json.'
    : '[tauriMock] Browser-Modus: Tauri-Backend wird gemockt (leere Daten – lege src/lib/devdaten/backup.json an, um mit echten Zahlen zu arbeiten).');
}

export {};
