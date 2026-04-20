# AGENTS.md – Rechnungs-Manager

## Project Overview
Desktop invoice/accounting manager for German freelancers (Kleinunternehmer / Regelbesteuerung).
Stack: **Tauri v2** (Rust backend) + **React 19 + TypeScript** (Vite frontend) + **SQLite** via `@tauri-apps/plugin-sql`.

## Developer Commands
```bash
npm run dev          # Start Vite dev server (frontend only, no Tauri)
npm run tauri dev    # Start full Tauri desktop app (dev)
npm run build        # tsc + vite build (frontend)
npm run tauri build  # Build production Tauri installer
```
Rust backend lives in `src-tauri/`. After changing `src-tauri/src/lib.rs`, Tauri dev auto-recompiles.

## Architecture

### Data Layer
- **`src/lib/db.ts`** – singleton SQLite access via `getDb()`. Schema migrations run inline on first load. Tables: `invoices`, `settings`, `drafts`.
- Settings are stored as key-value in `settings` table; use `getSetting(key)` / `setSetting(key, value)`.
- PDF/invoice files are stored in Tauri's `app_data_dir/invoices/` and `app_data_dir/pdfs/`.

### State Management
- **`src/store/index.ts`** – main Zustand store (`useAppStore`). Persisted keys: `darkMode`, `theme`, `animations`, `hiddenNavItems`, `steuerregelung`, `privacyMode`. Drafts are intentionally NOT persisted (cleared on merge).
- Additional stores: `templateStore`, `dashboardStore`, `gmailStore`, `listsStore`, `calendarStore`, `chatStore`, `tutorialStore`.

**`AppTheme`-Werte** (vollständige Liste):
```ts
type AppTheme = 'default' | 'liquid-glass' | 'aurora-borealis' | 'crimson-dusk' | 'zinc' | 'stone' | 'windows11' | 'chroma';
```
Theme-Klassen werden auf das `<html>`-Element gesetzt.

### Domain Types

#### `Invoice`-Interface (`src/types/index.ts`)
Das zentrale Datenobjekt für alle Belege:

```ts
interface Invoice {
  id: string;
  date: string;        // ISO-Datum, z. B. "2024-03-15"
  year: number;
  month: number;
  category: Category;
  description: string;
  partner: string;
  netto: number;
  ust: number;
  brutto: number;
  type: InvoiceType;   // 'einnahme' | 'ausgabe' | 'info'
  currency: string;    // i. d. R. "EUR"
  pdf_path: string;
  note: string;
  created_at: string;
  updated_at: string;
}
```

#### Kategorie-Hilfsfunktionen
- `getCategoriesForType(type)` – gibt gültige Kategorien je Typ zurück
- `getCategoriesForTypeFiltered(type, currentCategory?)` – wie oben, aber ohne Legacy-Kategorien (außer wenn aktuelle Kategorie eine ist)
- `getDefaultCategoryForType(type)` – Standard-Kategorie je Typ
- `isCategoryValidForType(category, type)` – Validierungsprüfung
- `'einnahmen'` ist eine **Legacy-Kategorie** – bitte nicht für neue Einträge verwenden

### Rust ↔ Frontend Bridge
All custom Tauri commands are in **`src-tauri/src/lib.rs`** and registered in `run()`:
- `extract_pdf_text` – PDF text extraction via `pdf_extract`
- `save_pdf_attachment` – saves base64 PDF to `invoices/` dir
- `create_backup` / `restore_backup` / `get_pending_backup_path` – `.rmbackup` ZIP format
- `imap_*` / `smtp_send_email` – IMAP/SMTP email integration (native TLS)

Call from frontend with `invoke('command_name', { param })` from `@tauri-apps/api/core`.

## External Integrations
| Feature | Location | Auth method |
|---------|----------|-------------|
| Gmail | `src/lib/gmail.ts`, `src/pages/Gmail.tsx` | OAuth2 via `@fabianlars/tauri-plugin-oauth` |
| IMAP/SMTP | `src-tauri/src/lib.rs` | Username/password stored in `settings` table |
| Google Calendar | `src/lib/googleCalendar.ts` | OAuth2 |
| Gemini AI | `src/lib/gemini.ts` | API key stored in `settings` table |

## File Storage Paths (runtime)
- DB: `{app_data_dir}/rechnungen.db`
- Invoices/PDFs: `{app_data_dir}/invoices/`, `{app_data_dir}/pdfs/`
- Backup format: `.rmbackup` = ZIP containing `rechnungen.db`, `invoices/`, `pdfs/`, `localStorage.json`, `meta.json`

---

# 🤖 Agent Instructions – Rechnungs-Manager

Diese Datei beschreibt verbindliche Regeln, an die sich ein KI-Agent bei der Arbeit an diesem Projekt **immer** halten muss.

---

## 1. Neues Dashboard-Widget erstellen

Wenn ein neues Dashboard-Element (Widget) erstellt wird, müssen **immer alle 4 Stellen** gleichzeitig aktualisiert werden:

### 1.1 `src/types/dashboard.ts`
- Den neuen String-Literal zu **`ElementType`** hinzufügen
- Den neuen String-Literal zu **`NodeType`** hinzufügen (ist eine Kopie von `ElementType` + GridTypes)

> ⚠️ **Achtung:** `ElementType` und `NodeType` sind manuell synchron zu halten – sie sind bewusst dupliziert. Immer **beide** aktualisieren, sonst gibt es TypeScript-Fehler.

```ts
// ElementType und NodeType jeweils ergänzen:
| 'mein-neues-widget'
```

**Referenz: Alle vorhandenen Widget-IDs (`ElementType`)**

| ID | Beschreibung |
|----|-------------|
| `kpi-einnahmen-ytd` / `kpi-ausgaben-ytd` / `kpi-saldo-ytd` | YTD-KPIs |
| `kpi-einnahmen-monat` / `kpi-ausgaben-monat` / `kpi-saldo-monat` | Monatliche KPIs |
| `kpi-betriebsergebnis` | Betriebsergebnis (Netto-Saldo) |
| `kpi-belege-30d` | Anzahl Belege letzte 30 Tage |
| `kpi-saldo-prognose` | Saldo-Prognose aktueller Monat |
| `kpi-ust-jahr` | Umsatzsteuer (Jahr) – nur Regelbesteuerung |
| `kpi-steuerruecklage` | Steuerrücklage – nur Regelbesteuerung |
| `kpi-marge` | Nettomarge (%) |
| `kpi-avg-einnahmen-monat` / `kpi-avg-ausgaben-monat` | Monatsdurchschnitte |
| `kpi-kleinunternehmer` | Kleinunternehmergrenze-Gauge |
| `kpi-gesamt-*` | Gesamt-KPIs über alle Jahre |
| `chart-revenue` | Umsatz-Balkendiagramm (Jahr) |
| `chart-cashflow` | Kumulierter Cashflow (Jahr) |
| `chart-category-donut` | Kategorie-Donut |
| `chart-last28days` | Tagesumsätze letzte 28 Tage |
| `chart-month` | Monats-Chart |
| `chart-gesamt-revenue` / `chart-gesamt-cashflow` | Charts über alle Jahre |
| `chart-jahresprognose` | Jahresprognose-Chart |
| `list-forecast` / `list-forecast-28d` | Prognose-Listen |
| `list-recent-invoices` / `list-recent-emails` | Letzte Belege / E-Mails |
| `list-top-einnahmen` / `list-top-ausgaben` / `list-top-partner` | Top-Listen |
| `list-abos` | Abo-Übersicht |
| `card-sonderausgaben` | Sonderausgaben-Karte |
| `card-monatsuebersicht` | Monatsübersicht-Tabelle |
| `card-jahresvergleich` | Jahresvergleich |
| `card-partner` | Partner-Karte |

**Referenz: Grid-Typen (`GridType`) und ihre Props**

| Grid-Typ | Beschreibung | Wichtige Props |
|----------|-------------|----------------|
| `grid-bento` | Flexibles n-spaltiges Grid | `columns: number` (Standard 4); Kinder nutzen `colSpan: number` |
| `grid-vertical` | Vertikaler Stack | – |
| `grid-horizontal` | Horizontaler Stack (gleichbreite Spalten) | – |
| `grid-pages` | Mehrseitig mit Tab-Leiste | Kinder sind `PageDef`-Objekte |
| `grid-masonry` | Masonry-Layout | – |
| `grid-accordion` | Aufklappbare Sektionen | – |
| `grid-sidebar` | Sidebar + Hauptbereich | Erstes Kind = Sidebar (240 px), zweites Kind = Hauptbereich |

Kinder eines `grid-bento` geben ihre Breite über `props.colSpan` an:
```ts
{ id: 'e1', type: 'kpi-einnahmen-monat', props: { colSpan: 2 } }
```

### 1.2 `src/components/dashboard/DashboardElementNode.tsx`
- Einen neuen `case`-Zweig im großen `switch(type)`-Block hinzufügen, der die neue Komponente rendert
- Den neuen Label-Eintrag in `ELEMENT_LABELS` am Ende der Datei hinzufügen

```ts
case 'mein-neues-widget':
  return <MeinNeuesWidget ... />;

// In ELEMENT_LABELS:
'mein-neues-widget': 'Mein neues Widget',
```

### 1.3 `src/components/dashboard/DashboardEditSidebar.tsx`
- Das neue Widget in die **Liste der verfügbaren Elemente** eintragen, damit es im Edit-Modus per Drag & Drop hinzugefügt werden kann

### 1.4 Optional: `DEFAULT_LAYOUT` in `src/types/dashboard.ts`
- Falls das Widget standardmäßig auf dem Dashboard erscheinen soll, in das passende Page-Array eintragen

---

## 2. Neue Seite / Route erstellen

Wenn eine neue Seite erstellt wird, müssen **immer alle 4 Stellen** aktualisiert werden:

1. **Seiten-Komponente** erstellen unter `src/pages/MeineSeite.tsx`
2. **Route registrieren** in `src/App.tsx` im `createBrowserRouter`-Array
3. **Nav-Eintrag** in der Sidebar ergänzen (`src/components/layout/`)
4. Der Pfad muss mit dem `hiddenNavItems`-System kompatibel sein (der exakte `path`-String wird als Key verwendet)

---

## 3. Neuen Zustand-Store erstellen

Beim Erstellen eines neuen Zustand-Stores:

1. Datei `src/store/<feature>Store.ts` anlegen
2. `create()` mit `persist()`-Middleware verwenden (wie in bestehenden Stores)
3. Nur wirklich persistente Felder via `partialize` speichern
4. Einen typisierten Hook `use<Feature>Store` exportieren

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useFeatureStore = create<FeatureState>()(
  persist(
    (set) => ({ /* ... */ }),
    { name: 'rechnungs-manager-feature', partialize: (s) => ({ /* nur persistente Felder */ }) }
  )
);
```

---

## 4. Neues Dashboard-Datenelement

Wenn ein neues berechnetes Datum für Dashboard-Widgets benötigt wird:

1. Berechnung in **`src/hooks/useDashboardData.ts`** hinzufügen
2. Über **`src/components/dashboard/DashboardContext.tsx`** im Context bereitstellen (Interface erweitern + Wert zurückgeben)
3. In **`DashboardElementNode.tsx`** über `useDashboardContext()` konsumieren

---

## 5. Löschen – Immer eine Bestätigung verlangen ⚠️

**Jede Löschaktion** muss vom Nutzer explizit bestätigt werden. Ohne Bestätigung darf **nichts gelöscht** werden. Dies gilt für:

- Rechnungen / Belege löschen
- Entwürfe (Drafts) löschen – einzeln und "Alle löschen"
- Rechnungsvorlagen löschen (Invoice Designer)
- Dashboard-Elemente oder -Seiten entfernen
- Listen-Einträge löschen
- Chat-Verlauf löschen
- Kalendereinträge löschen
- E-Mails löschen
- Backup-Wiederherstellung (überschreibt alle Daten – Warnung muss deutlich sein)
- Datenbankeinträge jeglicher Art

**Implementierung:**
Verwende entweder das shadcn/ui `AlertDialog` oder ein inline-Bestätigungsmuster (z. B. Button erst rot + Text ändert sich zu "Wirklich löschen?"):

```tsx
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Löschen</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Wirklich löschen?</AlertDialogTitle>
      <AlertDialogDescription>
        Diese Aktion kann nicht rückgängig gemacht werden.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete}>Löschen</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## 6. Privacy Mode – Geldbeträge immer absichern

**Alle** Geldbeträge, die in Dashboard-Widgets oder Tabellen angezeigt werden, müssen `fmtCurrency(value, privacyMode)` aus `@/lib/utils` verwenden – niemals rohe Zahlenformatierung.

**Signatur:**
```ts
// src/lib/utils.ts
export function fmtCurrency(value: number, privacyMode: boolean): string
// Bei privacyMode=true → gibt "••••" zurück
// Bei privacyMode=false → gibt "1.234,56 €" (de-DE-Format) zurück
```

`privacyMode` kommt aus:
- `useDashboardContext()` (in Dashboard-Widgets)
- `useAppStore((s) => s.privacyMode)` (überall sonst)

```ts
import { fmtCurrency } from '@/lib/utils';
const { privacyMode } = useDashboardContext();

// ✅ Richtig:
<span>{fmtCurrency(betrag, privacyMode)}</span>

// ❌ Falsch:
<span>{betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
```

---

## 7. Steuerregelung-abhängige Widgets

Widgets, die für Kleinunternehmer (§ 19 UStG) nicht relevant sind (z. B. `kpi-ust-jahr`, `kpi-steuerruecklage`), müssen einen Guard einbauen:

```tsx
const steuerregelung = useAppStore((s) => s.steuerregelung);

if (steuerregelung === 'kleinunternehmer') {
  return <KPICard title="USt. (Jahr)" value="Nicht relevant" />;
}
```

---

## 8. Neue Datenbank-Tabelle / Migration

Wenn eine neue SQLite-Tabelle benötigt wird:

1. `CREATE TABLE IF NOT EXISTS` Statement in der `migrate()`-Funktion in `src/lib/db.ts` hinzufügen
2. Alle CRUD-Funktionen ebenfalls in `db.ts` ablegen
3. Die Tabelle in der README unter **📋 Datenbank** dokumentieren

---

## 9. Neue Einstellung

Wenn eine neue persistente Einstellung eingeführt wird:

- Booleans / Strings / Enums → `useAppStore` in `src/store/index.ts` (mit `partialize` absichern)
- Sensible Daten (API-Keys, Zugangsdaten) → SQLite `settings`-Tabelle via `lib/db.ts`
- Feature-spezifischer State → eigener Store (z. B. `gmailStore`, `calendarStore`)

**Aktuell persistierte Felder in `useAppStore`:**
`darkMode`, `theme`, `animations`, `hiddenNavItems`, `steuerregelung`, `privacyMode`

---

## 10. Rechnungsvorlage bearbeiten / neue Standardvorlage

Wenn eine neue Standardvorlage oder eine Änderung an bestehenden Standardvorlagen gemacht wird:

1. Vorlage in `src/lib/defaultTemplates.ts` anlegen / anpassen
2. Die `autoUpdateBuiltins()`-Logik in `src/store/templateStore.ts` berücksichtigen – sie aktualisiert beim App-Start automatisch veraltete Builtin-Vorlagen
3. Neue Felder im Vorlagen-Typ ggf. in `src/types/template.ts` ergänzen

---

## 11. Allgemeine Code-Qualitäts-Regeln

- **Immer TypeScript** – keine `any`-Typen ohne Begründung
- **shadcn/ui** für alle UI-Elemente verwenden (kein vanilla HTML ohne Klassen)
- **Tailwind CSS** für Styling – kein Inline-Style außer für dynamische Werte
- **Sonner Toasts** für Feedback (`import { toast } from 'sonner'`) – kein `alert()`
- **Fehler** immer mit `toast.error(...)` kommunizieren, Erfolge mit `toast.success(...)`
- **Ladestate** in Widgets via `Skeleton`-Komponente darstellen (`@/components/ui/skeleton`)
- **Keine hardcodierten API-Keys** – immer über SQLite `settings`-Tabelle laden

