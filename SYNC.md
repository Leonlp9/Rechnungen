# Cloud-Sync – Architektur

Klevr synchronisiert alle Daten (Rechnungen, Kunden, Projekte, Fahrtenbuch,
Einstellungen, Listen, **PDFs und alle Belegdateien**) über einen vom Nutzer
gewählten Speicher – **ohne eigenen Server**. Der Speicher ist ein dummer
Dateiablageort; die gesamte Sync-Logik läuft in der App.

## Speicher-Anbieter

| Anbieter | Umsetzung |
| --- | --- |
| Lokaler Ordner / Netzlaufwerk | Rust (atomare Dateioperationen) |
| WebDAV (Nextcloud, Hetzner, Strato, …) | Rust/ureq (PROPFIND/GET/PUT/MKCOL) |
| Google Drive | Drive API v3, Scope `drive.file` (sieht nur eigene Dateien) |

Dropbox/OneDrive & Co. funktionieren sofort über deren Desktop-Clients:
einfach als „Lokaler Ordner“ einen von deren Client synchronisierten Ordner wählen.

## Aufbau des Sync-Ordners

```
changes/<geräte-id>/00000001.json   Änderungs-Log, append-only, ein Ordner PRO GERÄT
blobs/<aa>/<sha256>                 Dateiinhalte, content-addressed, unveränderlich
meta/encryption.json                Salt (Klartext) bei aktiver Verschlüsselung
meta/keycheck                       Passphrasen-Prüfdatei
```

## Warum keine Korruption möglich ist

1. **Append-only:** Change-Dateien und Blobs werden ausschließlich im
   Create-only-Modus geschrieben (`If-None-Match: *` bzw. Existenz-Check +
   atomares rename). Es wird **nie** eine Datei überschrieben oder gelöscht.
2. **Ein Schreib-Namespace pro Gerät:** Jedes Gerät schreibt nur in
   `changes/<eigene-id>/` – Schreibkonflikte sind per Design ausgeschlossen.
3. **Content-Addressing + Verifikation:** Blobs heißen wie der SHA-256 ihres
   Inhalts. Nach jedem Download wird der Hash geprüft; beschädigte Übertragungen
   werden erkannt und verworfen.
4. **Atomare lokale Schreibvorgänge:** temp-Datei + rename – nie halbe Dateien.
5. **Idempotenz:** Absturz mitten im Sync ⇒ beim nächsten Lauf wird derselbe
   Stand erneut übertragen/angewendet – Duplikate sind wirkungslos.
6. **Nichts geht verloren:**
   - Löschungen sind Tombstones; remote bleibt alles erhalten.
   - Remote gelöschte Dateien wandern lokal nach `papierkorb/`.
   - Kollidierende lokale Dateiänderungen werden vor dem Überschreiben nach
     `konflikte/` kopiert.
   - Zeilen, die nicht automatisch anwendbar sind (z. B. UNIQUE-Verletzung),
     landen vollständig in der Tabelle `_sync_conflicts`.

## Änderungs-Erfassung (lokal)

SQLite-Trigger auf allen synchronisierten Tabellen schreiben in:

- `_sync_rowmeta` – dauerhafte Last-Write-Wins-Uhr pro Zeile (+ Tombstones),
- `_sync_dirty` – Push-Warteschlange,
- `_sync_shipped` – Hash des zuletzt übertragenen Zustands (verhindert Echos).

Kein bestehender App-Code musste angepasst werden; auch künftige Schreibpfade
werden automatisch erfasst.

> **Achtung bei Trigger-Änderungen:** In SQLite ersetzt das äußere Statement
> die Konfliktbehandlung innerer Trigger-Statements. Deshalb nutzen die
> Trigger konfliktfreie `UPDATE` + `INSERT … WHERE NOT EXISTS`-Paare statt
> `INSERT OR REPLACE`.

## Konfliktlösung

- **Zeilen:** Last-Write-Wins über `mt` (ISO-Zeitstempel) mit deterministischem
  Hash-Tiebreak bei exakt gleichem Zeitstempel.
- **Rechnungsnummern-Sequenzen:** Merge über `MAX(last_number)` – Nummern
  werden nie zurückgedreht. Empfehlung: ausgehende (nummerierte) Rechnungen
  nur auf einem Gerät erstellen; das Handy ist für Eingangsbelege gedacht.
- **Audit-Log:** bewusst gerätelokal (Hash-Kette bleibt intakt); die Belege
  selbst syncen natürlich.

## Ende-zu-Ende-Verschlüsselung (optional, empfohlen)

AES-256-GCM, Schlüssel per PBKDF2-SHA256 (310k Iterationen) aus einer
Passphrase. Verschlüsselt werden Change-Dateien und Blobs. Der Cloud-Anbieter
sieht nur Zufallsdaten und Datei-Größen. Ohne Passphrase sind die Daten
unwiederbringlich – gut sichern!

## Sichtbarkeit in der Oberfläche

Ein Sync, den niemand sieht, ist wertlos. Deshalb:

- `useSyncStatus` (Zustand-Store) hält Anbieter, Intervall, Verschlüsselung,
  Geräte-ID, letzten Lauf, letzten Fehler und den Zeitpunkt der letzten
  eingehenden Änderung.
- Die Komponente `SyncIndicator` hängt in der Desktop-Topbar **und** in der
  Mobile-Kopfzeile – also auf jeder Seite. Zustände: aus / läuft / neue Daten /
  Fehler / bereit.
- Nach einem Pull mit Zugängen ruft `refreshAppData()` auf:
  `queryClient.invalidateQueries()` (React-Query-Caches) sowie ein Neuladen von
  Rechnungen und Entwürfen in den Zustand-Store. Ohne diesen Schritt landen
  fremde Änderungen zwar in der Datenbank, die offene Ansicht zeigt aber
  weiter den alten Stand.
- Zusätzlich meldet ein Toast, was von anderen Geräten übernommen wurde.

## Datenverkehr

Ein Sync überträgt nur neue Change-Dateien (wenige KB JSON) plus neue Blobs.
Unveränderte PDFs werden nie erneut übertragen (SHA-256-Dedupe). Cursor pro
Peer-Gerät sorgen dafür, dass jede Change-Datei genau einmal gelesen wird.

## Code-Landkarte

- `src-tauri/src/sync_storage.rs` – Speicher-Backends (lokal, WebDAV)
- `src-tauri/src/sync_files.rs` – Datei-Scan, Hashing, atomares Schreiben
- `src/lib/sync/tracking.ts` – Systemtabellen + Trigger
- `src/lib/sync/engine.ts` – Pull/Push, LWW, Datei-Sync
- `src/lib/sync/providers.ts` – Provider inkl. Google-Drive-OAuth
- `src/lib/sync/crypto.ts` – E2E-Verschlüsselung
- `src/lib/sync/index.ts` – Konfiguration, Secrets, Auto-Sync, Status
- `src/components/settings/tabs/SyncTab.tsx` – Einstellungs-UI
