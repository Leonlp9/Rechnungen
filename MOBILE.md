# Klevr auf Android & iOS

Klevr ist eine Tauri-2-App – dieselbe Codebase läuft auf Windows, macOS, Linux,
**Android und iOS**. Der Code ist bereits mobile-fähig:

- `src-tauri/src/lib.rs` hat den `mobile_entry_point`; Desktop-only-Features
  (IMAP/Gmail, Keyring, Auto-Updater, Systemstatistiken) sind per `#[cfg(desktop)]`
  ausgeklammert und werden auf dem Handy gar nicht erst kompiliert.
- Die UI schaltet auf schmalen Viewports automatisch in ein Mobile-Layout um
  (Bottom-Navigation: Dashboard, Rechnungen, Scannen, Einstellungen).
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
Begründung ergänzen.

## Was auf dem Handy anders ist

| Feature | Desktop | Mobile |
| --- | --- | --- |
| Dashboard, Rechnungen ansehen/anlegen | ✅ | ✅ |
| Beleg-Scan per Kamera | – | ✅ |
| Cloud-Sync (alle Anbieter) | ✅ | ✅ |
| Gmail/IMAP, Kalender | ✅ | ❌ (Desktop-only) |
| Auto-Updater | ✅ | ❌ (Store/APK-Update) |
| Secrets | OS-Keyring | lokale DB (Gerät sperren!) |

## Sync einrichten

Auf jedem Gerät: **Einstellungen → Cloud-Sync**, denselben Speicherort und
(falls aktiviert) dieselbe Passphrase eintragen. Der Sync ist konfliktsicher:

- Es wird nie eine Datei überschrieben (append-only Change-Log, Blobs nach SHA-256).
- Gelöschtes wandert in `papierkorb/` statt verloren zu gehen.
- Nicht automatisch zusammenführbare Änderungen landen in der Konfliktablage.
