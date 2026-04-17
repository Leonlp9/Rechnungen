# 📄 Rechnungs-Manager

Eine Desktop-Anwendung für persönliches Rechnungs-Management – gebaut mit **Tauri**, **React**, **TypeScript** und **SQLite**.

![Tauri](https://img.shields.io/badge/Tauri-2.x-blue?logo=tauri)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)
![License](https://img.shields.io/badge/License-Private-gray)

---

## ✨ Features

### 📊 Dashboard
- **4 KPI-Cards**: Einnahmen YTD, Ausgaben YTD, Saldo, Belege (30 Tage) – jeweils mit Delta-Indikator zum Vorjahr
- **Line-Chart**: Einnahmen vs. Ausgaben pro Monat (Recharts)
- **Donut-Chart**: Ausgaben nach Kategorie
- **Letzte 10 Belege** als Schnellübersicht
- Jahres-Switcher (2025, 2026, ...)

### 🤖 KI-gestützte Rechnungserfassung
- PDF hochladen → **✨ Automatische KI-Erfassung** per Gemini API
- Erkennt automatisch: Datum, Partner, Beträge, Typ (Einnahme/Ausgabe/Info), Kategorie
- Nutzt hinterlegte **Profildaten** (Name, Steuernummer, Branche), um korrekt zwischen Einnahme und Ausgabe zu unterscheiden
- Alle Felder nach KI-Erfassung manuell anpassbar

### 📑 Rechnungsverwaltung
- **Sortierbare Tabelle** (Datum, Partner, Kategorie, Brutto, Typ)
- **Live-Suche** über Beschreibung, Partner und Notizen
- **Filter-Chips** für Jahr, Kategorie und Typ
- **Detail-Ansicht** mit Split-View: PDF-Viewer links, editierbares Formular rechts
- **Keyboard-Navigation**: Pfeil-Links/Rechts blättert zwischen Rechnungen
- **Im Explorer anzeigen** – öffnet den Ordner der PDF-Datei

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

### 🎨 Design-System
- **Light + Dark Mode** per Toggle
- **Primärfarbe** anpassbar (ColorPicker in Einstellungen)
- Font: **Geist** (Variable)
- Durchgängig abgerundete Ecken, subtile Shadows
- shadcn/ui Komponenten

### ⚙️ Einstellungen
- **Persönliche Daten**: Name, Adresse, Steuernummer, USt-IdNr., IBAN, BIC, Branche – werden der KI als Kontext mitgegeben
- **Gemini API-Key**: Lokal in SQLite gespeichert, nicht hardcoded
- **Erscheinungsbild**: Dark Mode, Primärfarbe

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
| Font | Geist Variable |

---

## 📁 Projektstruktur

```
src/
├── components/
│   ├── ui/              # shadcn/ui Komponenten
│   ├── layout/          # Sidebar, Topbar, AppLayout
│   ├── dashboard/       # KPICard, RevenueChart, CategoryDonut
│   └── invoices/        # InvoiceTable, InvoiceDetail, NewInvoiceDialog, ExportDialog
├── pages/               # Dashboard, AllInvoices, ByYear, ByCategory, Settings
├── lib/
│   ├── db.ts            # SQLite-Setup, Migrationen, CRUD-Queries
│   ├── gemini.ts        # Gemini API-Wrapper mit Profil-Kontext
│   ├── export.ts        # XLSX-Export mit ExcelJS
│   ├── pdf.ts           # PDF-Helpers (kopieren, base64, Pfade)
│   └── utils.ts         # cn(), Formatter
├── store/               # Zustand-Store (UI-State)
├── types/               # TypeScript-Interfaces & Enums
├── App.tsx              # Router
└── main.tsx             # Entry + DB-Init

src-tauri/
├── src/lib.rs           # Tauri-Plugins (SQL, Dialog, FS)
├── tauri.conf.json      # App-Konfiguration
└── capabilities/        # Berechtigungen (AppData-Scope)
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

PDFs werden in `AppData/pdfs/` kopiert, der relative Pfad in der DB gespeichert.

---

## 📄 Lizenz

Privates Projekt.
