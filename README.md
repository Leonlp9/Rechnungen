# 📄 Rechnungs-Manager

Eine Desktop-Anwendung für persönliches Rechnungs-Management – gebaut mit **Tauri**, **React**, **TypeScript** und **SQLite**.

![Tauri](https://img.shields.io/badge/Tauri-2.x-blue?logo=tauri)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)
![License](https://img.shields.io/badge/License-Private-gray)

---

## ✨ Features

### 📊 Dashboard (vollständig anpassbar)
Das Dashboard ist ein **drag-and-drop-fähiges Widget-System** mit 7 Standard-Seiten:

| Seite | Inhalt |
|---|---|
| 📊 Übersicht | Kernkennzahlen, Cash-Gewinn, Steuerlicher Gewinn, letzte Belege, Prognosen |
| 📅 Monat | Monatliche KPIs, Monats-Chart, 28-Tage-Ansicht, Prognose-Listen |
| 📈 Jahr | YTD-KPIs, Umsatz-Chart, Kategorie-Donut, Cashflow, Jahresprognose, Vergleich |
| 🧾 Steuer & AfA | Steuerlicher Gewinn, Steuerrücklage, USt, AfA-Zeitverlauf, GWG, Kleinunternehmergrenze |
| 💰 Cashflow | Liquiditätskennzahlen, kumulierter Cashflow, 28-Tage-Chart, Prognosen |
| 📋 Analyse | Top-Listen, Partner, Abos, AfA nach Typ, Vermögens-Check, Investitions-Spiegel |
| 🌍 Gesamt | Jahresübergreifende KPIs, Charts, Durchschnitte, Vermögensübersicht |

**Widget-Typen (47 Elemente):** KPI-Cards, Charts (Revenue, Cashflow, Donut, 28 Tage, Jahresprognose), Listen, Monatsübersicht, Jahresvergleich, Abo-Liste, Partner-Card u.v.m.

**Layout-Typen:** `grid-bento`, `grid-sidebar`, `grid-vertical`, `grid-horizontal`, `grid-pages`, `grid-masonry`, `grid-accordion`

Über die **Dashboard-Edit-Sidebar** können Elemente hinzugefügt, verschoben und entfernt werden.

### 🤖 KI-gestützte Rechnungserfassung
- PDF hochladen → **✨ Automatische KI-Erfassung** per Gemini API
- Erkennt automatisch: Datum, Partner, Beträge, Typ (Einnahme/Ausgabe/Info), Kategorie
- Nutzt hinterlegte **Profildaten** (Name, Steuernummer, Branche), um korrekt zwischen Einnahme und Ausgabe zu unterscheiden
- Alle Felder nach KI-Erfassung manuell anpassbar
- **KI-Fix**: Kategorie/Typ einzelner Belege nachträglich per KI korrigieren

### 💬 KI-Chat-Assistent
- Floating-Button öffnet **KI-Chat-Panel** (Gemini-basiert)
- Kontext-aware: Kennt die aktuellen Finanzdaten
- Persistente Chat-Historie via `chatStore`

### 📑 Rechnungsverwaltung
- **Sortierbare Tabelle** (Datum, Partner, Kategorie, Brutto, Typ)
- **Live-Suche** über Beschreibung, Partner und Notizen
- **Filter-Chips** für Jahr, Kategorie und Typ
- **Detail-Ansicht** mit Split-View: PDF-Viewer links, editierbares Formular rechts
- **Keyboard-Navigation**: Pfeil-Links/Rechts blättert zwischen Rechnungen
- **Im Explorer anzeigen** – öffnet den Ordner der PDF-Datei
- **Globale Suche** (Cmd/Strg+K) über alle Seiten

### ✍️ Rechnungen schreiben
- Seite `/write-invoice`: Neue ausgehende Rechnungen erstellen
- Wählt eine **Vorlage** aus dem Invoice Designer
- Generiert und exportiert **PDF** via `pdfExport.ts`

### 🎨 Rechnungs-Designer
- Visueller Template-Editor unter `/invoice-designer`
- Vorlagen speichern, laden, duplizieren, löschen
- Eingebaute Standardvorlagen (`defaultTemplates.ts`) mit automatischer Aktualisierung
- Typen: `src/types/template.ts`

### 📋 Listen
- Verwaltung benutzerdefinierter Listen unter `/lists`
- State via `listsStore`

### 📧 Gmail / IMAP-Integration
- Verbindung zu Gmail via `lib/gmail.ts`
- IMAP-Unterstützung via `lib/imap.ts`
- E-Mail-Vorschau direkt im Dashboard (Widget `list-recent-emails`)
- Eigene Seite `/gmail` mit `gmailStore`

### 📅 Google Calendar
- Integration via `lib/googleCalendar.ts`
- Kalender-Ansicht unter `/calendar`
- State via `calendarStore`
- Muster-Erkennung via `lib/patternDetection.ts`

### 📂 Kategorien
| Kategorie | Beschreibung |
|---|---|
| Einnahmen | Umsätze / Erlöse |
| Erstattungen / Auslagen | Rückerstattungen, verauslagte Kosten |
| Anlagevermögen / AfA | Anschaffungen > 800 € netto |
| GWG | Geringwertige Wirtschaftsgüter ≤ 800 € netto |
| Software & Abos | Lizenzen, SaaS, Cloud-Dienste |
| Fremdleistungen | Subunternehmer, Freelancer, Agenturen |
| Verträge | Vereinbarungen, Rahmenverträge (kein Geldfluss) |
| Sonstiges | Alles andere |

### 📤 XLSX-Export
- Export per Jahr mit **ExcelJS**
- 4 Sheets: *Alle Belege*, *Zusammenfassung* (nach Kategorie), *Nach Monat*, *Hinweise*
- Ausgabepfad frei wählbar per Save-Dialog

### 💾 Backup & Restore
- Backup erzeugt `.rmbackup`-Datei (SQLite-DB + localStorage)
- Wiederherstellung per Doppelklick auf `.rmbackup` oder in den Einstellungen
- Fortschrittsanzeige via `BackupProgressOverlay`

### 🔄 Auto-Updater
- Prüft beim Start automatisch auf neue Versionen
- Download & Installation ohne Browser via `@tauri-apps/plugin-updater`
- Fortschritts-Dialog via `UpdateDialog`

### 🎓 Tutorial-System
- Interaktives Onboarding via `tutorialStore` und `tutorialSteps.ts`
- Highlight-Overlays, Schritt-für-Schritt-Führung

### ❓ Hilfe
- In-App Hilfe unter `/help` via `lib/helpContent.ts`

### 🎨 Design-System
- **Light + Dark Mode** per Toggle
- **8 Themes**: `default`, `liquid-glass`, `aurora-borealis`, `crimson-dusk`, `zinc`, `stone`, `windows11`, `chroma`
- **Privacy Mode**: Geldbeträge werden ausgeblendet (Augen-Symbol)
- Animationen an/aus schaltbar
- Font: **Geist** (Variable)
- Durchgängig abgerundete Ecken, subtile Shadows
- shadcn/ui Komponenten

### ⚙️ Einstellungen
- **Persönliche Daten**: Name, Adresse, Steuernummer, USt-IdNr., IBAN, BIC, Branche – werden der KI als Kontext mitgegeben
- **Steuerregelung**: Kleinunternehmer (§ 19 UStG) oder Regelbesteuerung – beeinflusst KPI-Widgets
- **Gemini API-Key**: Lokal in SQLite gespeichert, nicht hardcoded
- **Erscheinungsbild**: Dark Mode, Theme-Auswahl, Animationen
- **Navigation**: Einzelne Nav-Einträge aus der Sidebar ausblenden
- **GoBD Audit-Trail**: Änderungshistorie einsehen und als CSV exportieren
- **Backup**: Export/Import der gesamten App-Daten

---

## 🛠 Tech-Stack

| Komponente | Technologie |
|---|---|
| Framework | [Tauri 2](https://tauri.app) |
| Frontend | React 19 + TypeScript |
| Styling | Tailwind CSS 4 + [shadcn/ui](https://ui.shadcn.com) |
| Datenbank | SQLite via `@tauri-apps/plugin-sql` |
| Charts | [Recharts](https://recharts.org) |
| State | [Zustand](https://zustand.docs.pmnd.rs) |
| Forms | react-hook-form + Zod |
| KI | Google Gemini 2.5 Flash API |
| Export | ExcelJS |
| PDF-Generierung | pdfExport.ts (benutzerdefinierte Vorlagen) |
| E-Mail | Gmail API + IMAP |
| Kalender | Google Calendar API |
| Auto-Updater | `@tauri-apps/plugin-updater` |
| Font | Geist Variable |

---

## 📁 Projektstruktur

```
src/
├── components/
│   ├── ui/              # shadcn/ui Komponenten
│   ├── layout/          # Sidebar, Topbar, AppLayout
│   ├── dashboard/       # KPICard, Charts, Listen, DashboardRenderer, DashboardElementNode
│   ├── invoices/        # InvoiceTable, InvoiceDetail, NewInvoiceDialog, ExportDialog
│   ├── designer/        # Invoice Template Designer
│   ├── chat/            # AIChatFloat, ChatPanel, ChatMessage
│   ├── bank/            # Bank-Integration
│   ├── gmail/           # Gmail-Komponenten
│   ├── lists/           # Listen-Komponenten
│   ├── search/          # Globale Suche
│   └── tutorial/        # Tutorial-Overlays
├── pages/
│   ├── Dashboard.tsx
│   ├── AllInvoices.tsx
│   ├── WriteInvoice.tsx
│   ├── InvoiceDesigner.tsx
│   ├── Lists.tsx
│   ├── Gmail.tsx
│   ├── Calendar.tsx
│   ├── Settings.tsx
│   └── Help.tsx
├── lib/
│   ├── db.ts            # SQLite-Setup, Migrationen, CRUD-Queries
│   ├── gemini.ts        # Gemini API-Wrapper mit Profil-Kontext
│   ├── export.ts        # XLSX-Export mit ExcelJS
│   ├── pdf.ts           # PDF-Helpers (kopieren, base64, Pfade)
│   ├── pdfExport.ts     # PDF-Generierung aus Templates
│   ├── backup.ts        # Backup/Restore (.rmbackup)
│   ├── updater.ts       # Auto-Updater
│   ├── gmail.ts         # Gmail API
│   ├── imap.ts          # IMAP-Client
│   ├── googleCalendar.ts # Google Calendar API
│   ├── patternDetection.ts # Muster-Erkennung
│   ├── helpContent.ts   # Hilfe-Inhalte
│   ├── defaultTemplates.ts # Standard-Rechnungsvorlagen
│   └── utils.ts         # cn(), Formatter, fmtCurrency()
├── store/
│   ├── index.ts         # useAppStore (UI-State, Theme, Privacy, Steuerregelung)
│   ├── dashboardStore.ts
│   ├── chatStore.ts
│   ├── calendarStore.ts
│   ├── gmailStore.ts
│   ├── listsStore.ts
│   ├── templateStore.ts
│   └── tutorialStore.ts
├── types/
│   ├── index.ts         # Invoice, Kategorie, Typ, Labels
│   ├── dashboard.ts     # ElementType, NodeType, GridType, DashboardNode, DEFAULT_LAYOUT
│   └── template.ts      # Invoice-Template-Typen
├── hooks/
│   ├── useDashboardData.ts
│   └── useChatContext.ts
├── tutorial/
│   └── tutorialSteps.ts
├── App.tsx              # Router + Theme-Setup + Updater + Backup
└── main.tsx             # Entry + DB-Init
```

---

## 🚀 Entwicklung

### Voraussetzungen

- [Node.js](https://nodejs.org) ≥ 20
- [Rust](https://rustup.rs)
- [Tauri CLI](https://tauri.app/start/prerequisites/)

### Setup

```bash
# Dependencies installieren
npm install

# Entwicklungsserver starten
npm run tauri dev
```

### Gemini API einrichten

1. [Google AI Studio](https://aistudio.google.com/apikey) → API-Key erstellen
2. App starten → Einstellungen → API-Key einfügen
3. Optional: Persönliche Daten hinterlegen für bessere KI-Erkennung

---

## 📦 Build

### Lokal (Windows)

```bash
npm run tauri build
```

Erzeugt Installer in `src-tauri/target/release/bundle/`:
- `msi/` – Windows MSI-Installer
- `nsis/` – Windows EXE-Setup

### GitHub Actions (Windows + Mac + Linux)

Der Workflow `.github/workflows/build.yml` baut automatisch für alle Plattformen:

```bash
git tag v0.1.0
git push --tags
```

Erzeugt:
| Plattform | Format |
|---|---|
| Windows | `.msi`, `.exe` |
| macOS (ARM) | `.dmg`, `.app` |
| macOS (Intel) | `.dmg`, `.app` |
| Linux | `.deb`, `.rpm`, `.AppImage` |

Die Installer sind als **Draft-Release** auf der Releases-Seite und als **Artifacts** im Workflow-Run verfügbar.

---

## 📋 Datenbank

SQLite-Datenbank wird beim ersten Start automatisch im App-Data-Ordner erstellt.

**Tabelle `invoices`**: id, date, year, month, category, description, partner, netto, ust, brutto, type, currency, pdf_path, note, created_at, updated_at

**Tabelle `settings`**: key/value Store für API-Key, Profildaten, Theme-Einstellungen

**Tabelle `drafts`**: id, file_path, file_name, added_at – zwischengespeicherte PDF-Entwürfe

**Tabelle `audit_log`**: id, invoice_id, action, field_name, old_value, new_value, timestamp, user_note – GoBD-konformes Änderungsprotokoll

PDFs werden in `AppData/pdfs/` kopiert, der relative Pfad in der DB gespeichert.

---

## 📄 Lizenz

Privates Projekt.
