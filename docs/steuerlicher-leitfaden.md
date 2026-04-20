# Steuerlicher & Betriebswirtschaftlicher Leitfaden – Rechnungs-Manager

> Referenzdokument für die steuerrechtlichen Anforderungen, die diese Software abbilden muss.

---

## 1. Arten der Selbstständigkeit

| Merkmal | Freiberufler (§ 18 EStG) | Gewerbebetrieb (§ 15 EStG) |
|---------|--------------------------|---------------------------|
| Gewerbeanmeldung | Nicht erforderlich | Zwingend erforderlich |
| Gewerbesteuer | Nein | Ja (ab 24.500 € Gewinn) |
| Buchführung | EÜR | EÜR oder Bilanz |
| Kammerpflicht | Teils (z.B. Ärztekammer) | IHK- oder HWK-Pflicht |
| Steuererklärung | Anlage S | Anlage G |

**Content Creator** (Twitch, YouTube, Instagram) werden meist als **Gewerbetreibende** eingestuft.

---

## 2. Rechnungs-Pflichtangaben (§ 14 Abs. 4 UStG)

1. Name & Anschrift Leistender + Empfänger
2. Steuernummer oder USt-IdNr.
3. Ausstellungsdatum
4. Fortlaufende Rechnungsnummer (eindeutig)
5. Menge/Art der Leistung
6. Zeitpunkt der Lieferung/Leistung
7. Nettobetrag, aufgeschlüsselt nach Steuersätzen
8. Steuersatz (7 % / 19 %) + Steuerbetrag
9. Bei Kleinunternehmer: Hinweis auf § 19 UStG, **kein** USt-Ausweis

### Kleinbetragsrechnungen (≤ 250 € brutto, § 33 UStDV)
Vereinfachte Angaben: Name+Anschrift Leistender, Datum, Art der Leistung, Bruttobetrag inkl. Steuersatz.

---

## 3. Kleinunternehmerregelung (§ 19 UStG) – ab 2025

| Grenze | Betrag |
|--------|--------|
| **Vorjahresumsatz** | ≤ 25.000 € (vor 2025: 22.000 €) |
| **Laufendes Jahr (Prognose)** | < 100.000 € |

- Kein USt-Ausweis auf Rechnungen erlaubt
- Pflichthinweis: „Gemäß § 19 UStG wird keine Umsatzsteuer berechnet"
- Unberechtigter Steuerausweis → Abführungspflicht nach § 14c UStG
- Ab 2024 entfällt i.d.R. Pflicht zur USt-Erklärung

---

## 4. Einnahmearten für Content Creator

| Einnahmeart | Steuerliche Einordnung | USt-Behandlung |
|-------------|----------------------|----------------|
| Donations / Tips | Betriebseinnahme | Steuerpflichtig bei Gegenleistung |
| Subs / Bits | Betriebseinnahme | Meist Reverse Charge (§ 13b) |
| Sponsoring | Werbeleistung | Regelbesteuerung oder § 19 |
| Affiliate-Links | Vermittlungsprovision | Gewerbliche Einnahme |
| Sachgeschenke | Einnahme in Geldeswert | Marktwert ansetzen |

### Sachzuwendungen – Ausnahmen:
- **Rückgabepflicht** → keine steuerpflichtige Einnahme
- **Pauschalversteuerung § 37b EStG** (30 % vom Werbenden) → steuerfrei beim Creator
- **Streuartikel < 10 €** → steuerfrei

---

## 5. Reverse Charge (§ 13b UStG)

Bei Leistungen von/an ausländische Plattformen wird die Steuerschuld umgekehrt.
Netto-Rechnung + USt-IdNr. beider Parteien + Hinweis auf Reverse Charge.

### Plattform-Stammdaten

| Plattform | Vertragspartner | Sitz | USt-IdNr. |
|-----------|----------------|------|-----------|
| YouTube / AdSense | Google Ireland Limited | Dublin, Irland | IE 6388047V |
| Twitch | Twitch Interactive, Inc. | San Francisco, USA | – (US-Firma) |
| Amazon KDP | Amazon Media EU S.à r.l. | Luxemburg | LU 20944528 |

---

## 6. Betriebsausgaben & AfA

### GWG-Grenzen (2025/2026)

| Netto-Anschaffungskosten | Behandlung |
|--------------------------|------------|
| Bis 250 € | Direkter Betriebsausgaben-Abzug |
| 250,01 – 800 € | Sofortabschreibung möglich |
| 250,01 – 1.000 € | Alternativ: Sammelposten (Pool) über 5 Jahre |

> Pro Jahr: Entweder GWG-Sofortabschreibung ODER Poolabschreibung – nicht beides.

### Sonstige Betriebsausgaben
- **Reisekosten**: 0,30 €/km, Verpflegungspauschalen (>8h Abwesenheit)
- **Bewirtung**: 70 % absetzbar (Teilnehmer + Anlass dokumentieren)
- **Häusliches Arbeitszimmer**: Bei Erfüllung der Voraussetzungen
- **Telekommunikation**: Privat-Anteil abziehen
- **Digitale Wirtschaftsgüter**: Sonder-AfA über 1 Jahr (de facto Sofortabzug)

---

## 7. GoBD-Compliance

### Unveränderbarkeit
- Festgeschriebene Belege dürfen **nicht** gelöscht/spurlos geändert werden
- Korrekturen nur über **Stornobuchungen** / Korrekturbelege
- **Audit Trail** mit Zeitstempel + Benutzerkennung

### Ordnung & Auffindbarkeit
- Volltextsuche, Kategorisierung nach Datum/Belegnummer/Partner
- Buchungssatz ↔ Beleg fest verknüpft

### Aufbewahrung
- **8 Jahre** Aufbewahrungspflicht (seit BEG IV 2025 für Buchungsbelege/Rechnungen)
- Backup-Konzept
- Betriebsprüfer-Zugriff (IDEA-Export / strukturierte Daten)

### Verfahrensdokumentation
- Nutzer muss dokumentieren, wie er die Software einsetzt
- App sollte Vorlagen/Assistenten hierfür anbieten

---

## 8. Export-Anforderungen (Steuererklärung)

Pflicht-Exportfelder:
- Belegdatum + Buchungsdatum
- Belegnummer (intern + extern)
- Geschäftspartner (Name + Anschrift)
- Netto / Brutto / Steuerbetrag (getrennt)
- USt-Satz (0 %, 7 %, 19 %, § 19 Befreiung)
- Buchungskategorie (korreliert mit Anlage EÜR)

---

## 9. Handlungsempfehlungen (Software-Features)

- [x] Steuerregelung wählbar (Kleinunternehmer / Regelbesteuerung)
- [x] KU-Grenzwert-Tracking (25.000 €)
- [x] Privacy Mode für Beträge
- [x] 100.000 €-Jahresgrenze für Kleinunternehmer anzeigen
- [x] Tätigkeitsart (Freiberufler / Gewerbetreibend / Content Creator)
- [x] Reverse-Charge-Kategorie für internationale Plattformen
- [x] Content-Creator-Einnahmekategorien (Donations, Sponsoring, Affiliate, Sachzuwendungen)
- [x] Bewirtungskosten-Erfassung (70 % absetzbar)
- [x] Rechnungsnummern-Dubletten-Prüfung
- [x] GoBD-Audit-Trail (Änderungshistorie)
- [x] DATEV-Export (CSV-Buchungsstapel)
- [x] Verfahrensdokumentation-Assistent (Hilfe-Artikel)
- [x] AfA-Rechner / GWG-Schwellen-Logik


