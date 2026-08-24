# Klevr auf Android & iOS

Klevr ist eine Tauri-2-App – dieselbe Codebase läuft auf Windows, macOS, Linux,
**Android und iOS**. Der Code ist bereits mobile-fähig:

- `src-tauri/src/lib.rs` hat den `mobile_entry_point`; Desktop-only-Features
  (IMAP/Gmail, Keyring, Auto-Updater, Systemstatistiken) sind per `#[cfg(desktop)]`
  ausgeklammert und werden auf dem Handy gar nicht erst kompiliert.
- Die UI schaltet auf schmalen Viewports (< 768 px) automatisch in ein
  Mobile-Layout um – siehe „Die Handy-Oberfläche" weiter unten.
- Unter **Scannen** können Belege direkt mit der Handykamera fotografiert werden.
  Sie werden als PDF in die Entwürfe gelegt und per Cloud-Sync an alle Geräte
  verteilt (Einstellungen → Cloud-Sync).

## Android

### Voraussetzungen (einmalig)

1. [Android Studio](https://developer.android.com/studio) installieren.
2. Im SDK Manager installieren: **Android SDK Platform**, **SDK Build-Tools**,
   **NDK (Side by side)**, **CMake**, **Platform-Tools**.
3. Umgebungsvariablen setzen (Pfade ggf. anpassen):
   ```powershell
   [Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Android\Android Studio\jbr", "User")
   [Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
   [Environment]::SetEnvironmentVariable("NDK_HOME", "$env:LOCALAPPDATA\Android\Sdk\ndk\<version>", "User")
   ```
4. Rust-Targets hinzufügen:
   ```
   rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
   ```

### Projekt initialisieren & bauen

```
npm run tauri android init
npm run tauri android dev      # auf angeschlossenem Gerät/Emulator
npm run tauri android build    # signierbares APK/AAB
```

### Kamera-Berechtigung

Nach `android init` in `src-tauri/gen/android/app/src/main/AndroidManifest.xml`
ergänzen (damit `<input capture="environment">` die Kamera öffnen darf):

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
```

### APK signieren & verteilen

Für die Verteilung außerhalb des Play Stores reicht ein selbstsigniertes APK
(`keytool -genkey …`, dann in `gen/android` die Signing-Config eintragen –
siehe [Tauri-Doku: Android Signing](https://tauri.app/distribute/sign/android/)).
Das APK kann dann einfach als GitHub-Release angeboten werden.

## Automatischer Build über GitHub Actions

Der Workflow `.github/workflows/build.yml` baut bei jedem `v*`-Tag (und per
manuellem „Run workflow“) **zusätzlich zu den Desktop-Versionen ein Android-APK**
und hängt es als `Klevr_<version>_android.apk` an dasselbe GitHub-Release an.
Lokal ist dafür nichts nötig – kein Android Studio, kein SDK.

Damit das APK **stabil signiert** ist (Pflicht für Updates ohne Neuinstallation),
einmalig einen Keystore erzeugen und als Repository-Secrets hinterlegen:

```powershell
# Keystore erzeugen (Passwort merken!)
keytool -genkeypair -keystore klevr.jks -alias klevr -keyalg RSA -keysize 2048 -validity 10000
# Base64 für das Secret erzeugen
[Convert]::ToBase64String([IO.File]::ReadAllBytes("klevr.jks")) | Set-Clipboard
```

| Secret | Inhalt |
| --- | --- |
| `ANDROID_KEYSTORE_B64` | Base64 der `.jks`-Datei (aus der Zwischenablage) |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore-Passwort |
| `ANDROID_KEY_ALIAS` | `klevr` |
| `ANDROID_KEY_PASSWORD` | Key-Passwort (falls abweichend) |

Ohne diese Secrets baut der Workflow trotzdem – dann mit einem Wegwerf-Key:
Das APK ist installierbar, aber jedes Update erfordert eine Neuinstallation.
Die `.jks`-Datei sicher aufbewahren und **niemals committen**.

## iOS

Voraussetzungen: ein **Mac** mit Xcode + ein
[Apple-Developer-Konto](https://developer.apple.com) (99 $/Jahr).

```
rustup target add aarch64-apple-ios aarch64-apple-ios-sim
npm run tauri ios init
npm run tauri ios dev        # Simulator oder Gerät
npm run tauri ios build      # IPA für TestFlight/App Store
```

In Xcode (einmal `gen/apple` öffnen) das Signing-Team auswählen. Für die
Kamera in `Info.plist` den Schlüssel `NSCameraUsageDescription` mit einer
Begründung ergänzen. Für den Portrait-Lock in `Info.plist` unter
`UISupportedInterfaceOrientations` nur `UIInterfaceOrientationPortrait`
eintragen (Android macht das der CI-Workflow automatisch über
`android:screenOrientation="portrait"`).

## Die Handy-Oberfläche

### Kopfzeile

Ersetzt die Desktop-Topbar und ist auf jeder Seite sichtbar:
Zurück-Pfeil bzw. Logo, Seitentitel, **Suche**, **Sync-Indikator**,
Entwurfs-Zähler, **KI-Assistent** und ein Überlaufmenü (Beträge
aus-/einblenden, helles/dunkles Design, Beleg aus PDF anlegen, Export,
Entwürfe).

Der KI-Knopf ist als gefüllter Kreis hervorgehoben – im Light-Mode schwarz,
im Dark-Mode hell, dieselbe Sprache wie die Scan-Aktion unten. Bewusst keine
eigene Akzentfarbe.

### Untere Leiste + „Mehr"

Vier Tabs (Start, Belege, **Scannen**, Steuer) plus **Mehr**. Alle fünf
Einträge haben dieselbe Geometrie: ein 40-px-Kreis als Icon-Slot, darunter das
Label. Nur die Füllung unterscheidet sich – „Scannen" ist als Hauptaktion
dauerhaft gefüllt (Light: schwarz, Dark: hell), der aktive Tab bekommt eine
zarte Tönung. Dadurch liegen alle Icons trotz Hervorhebung auf einer Linie.

„Mehr" öffnet ein Bottom-Sheet mit dem Sync-Status, Schnellschaltern
(KI-Chat, Suche, Beträge, Design, Export, Beleg aus PDF) und **allen** Seiten,
gruppiert nach Belege / Organisation / Auswertung / System. Damit ist auf dem
Handy jede Seite erreichbar, die es auch am Desktop gibt (außer den
Desktop-only-Features Mail, Kalender und Template-Designer).

Die Leiste ist bewusst kein `position: fixed`, sondern ein regulärer
Flex-Nachbar des Inhalts – dadurch bekommt der Scrollbereich exakt die
verbleibende Höhe und es entsteht kein leerer Scrollbereich unter der Seite.

### KI-Assistent

Am Desktop ist der Chat ein frei verschiebbares Fenster, auf dem Handy ein
Bottom-Sheet über 92 % der Höhe (`MobileAIChat`). Beide teilen sich denselben
`chatStore`, sodass Kopfzeile und „Mehr"-Menü denselben Zustand öffnen.
`ChatPanel` hat dafür einen `mobile`-Modus: größere Touch-Ziele, 16-px-Eingabe
(sonst zoomt iOS beim Fokus hinein) und Safe-Area-Abstand unter dem Eingabefeld.

### Hilfe

Statt zweispaltig (Liste links, Artikel rechts) auf dem Handy als
Master/Detail: erst die durchsuchbare Artikelliste mit Kategorie-Chips,
nach dem Antippen der Artikel mit Zurück-Pfeil in der Kopfzeile.

### Dashboard bauen

Das Handy hat ein **eigenes Dashboard-Layout** (`mobileLayout` im
`dashboardStore`), das unabhängig vom Desktop-Layout gespeichert wird.
Über **Anpassen** öffnet sich der Touch-Editor:

- **+ Element** – Bottom-Sheet mit dem kompletten Widget-Katalog (durchsuchbar)
- pro Widget: nach oben / nach unten / halbe ↔ volle Breite / entfernen
- **Seiten** – Seiten anlegen, umbenennen, sortieren, löschen
- **Zurücksetzen** – setzt nur das Handy-Layout zurück

Bewusst kein Drag & Drop: Ziehen konkurriert auf dem Touchscreen mit dem
Seiten-Scrolling. Antippen ist zuverlässiger.

### Belegliste

Statt der achtspaltigen Tabelle zeigt das Handy antippbare Karten mit Partner,
Betrag (farbig nach Einnahme/Ausgabe), Beschreibung, Datum, Kategorie und
GoBD-Status. Suche, Jahr-/Monats-/Kategorie-/Typ-Filter und Seitenwechsel
bleiben identisch.

### Sync-Indikator

Der Indikator sitzt in der Kopfzeile (Handy) bzw. in der Topbar (Desktop) und
ist damit auf **jeder** Seite sichtbar. Er zeigt: läuft gerade / eingehende
Daten / Fehler / aus. Angetippt öffnet er ein Panel mit Anbieter,
Verschlüsselung, letztem Sync, empfangenen Änderungen, Intervall und
Geräte-ID – samt „Jetzt syncen".

## Was auf dem Handy anders ist

| Feature | Desktop | Mobile |
| --- | --- | --- |
| Dashboard, Rechnungen ansehen/anlegen | ✅ | ✅ |
| Beleg-Scan per Kamera | – | ✅ |
| Cloud-Sync (alle Anbieter) | ✅ | ✅ |
| Dashboard frei zusammenstellen | ✅ (Drag & Drop) | ✅ (Touch-Editor) |
| Alle Seiten erreichbar | Sidebar | „Mehr"-Menü |
| Sync-Indikator auf allen Seiten | ✅ | ✅ |
| KI-Assistent | schwebendes Fenster | Bottom-Sheet |
| Gmail/IMAP, Kalender, Template-Designer | ✅ | ❌ (Desktop-only) |
| Auto-Updater | ✅ | ❌ (Store/APK-Update) |
| Secrets | OS-Keyring | lokale DB (Gerät sperren!) |

## Sync einrichten

Auf jedem Gerät: **Einstellungen → Cloud-Sync**, denselben Speicherort und
(falls aktiviert) dieselbe Passphrase eintragen. Der Sync ist konfliktsicher:

- Es wird nie eine Datei überschrieben (append-only Change-Log, Blobs nach SHA-256).
- Gelöschtes wandert in `papierkorb/` statt verloren zu gehen.
- Nicht automatisch zusammenführbare Änderungen landen in der Konfliktablage.
