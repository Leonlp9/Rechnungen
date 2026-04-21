// Plain-text help content for AI context.
// Update this when adding new help articles so the AI always has the latest info.

export const HELP_CONTENT_TEXT = `
## Klevr – Hilfe & Dokumentation

### Erste Schritte
- Die App hilft beim Verwalten, Kategorisieren und Auswerten von Rechnungen.
- Empfohlene erste Schritte: Profildaten hinterlegen (Einstellungen → Persönliche Daten), Gemini API-Key eintragen, erste Rechnung hochladen oder manuell erfassen.

### PDF hochladen & KI-Erkennung
- Seite "Rechnung schreiben" öffnen → PDF auswählen → KI analysiert automatisch Datum, Betrag, Beschreibung, Partner und Kategorie.
- Voraussetzung: Gemini API-Key unter Einstellungen → Gemini API-Key eintragen.
- Auch ohne KI manuelles Erfassen möglich.

### Rechnung manuell erfassen
- Neues Formular über "Neue Rechnung" oder Strg+K → "Rechnung schreiben" öffnen.
- Felder: Datum, Beschreibung, Partner, Netto/USt/Brutto, Typ (Einnahme/Ausgabe/Info), Kategorie, Währung.

### Steuerregelung
- **Kleinunternehmer (§ 19 UStG):** Umsatz ≤ 25.000 € Vorjahr (ab 2025), < 100.000 € lfd. Jahr. Kein USt-Ausweis, Pflichthinweis auf § 19 UStG.
- **Regelbesteuerung:** USt wird ausgewiesen und an das Finanzamt abgeführt. Vorsteuerabzug möglich.
- Einstellung unter Einstellungen → Steuerregelung.

### Tätigkeitsart
- **Freiberufler (§ 18 EStG):** Katalogberufe, keine Gewerbesteuer, Anlage S.
- **Gewerbetreibend (§ 15 EStG):** Gewerbeanmeldung, IHK, Gewerbesteuer ab 24.500 € Gewinn, Anlage G.
- **Content Creator:** Streamer/YouTuber/Influencer – gewerblich, mit speziellen Kategorien für Donations, Sponsoring, Affiliate, Reverse Charge.
- Einstellung unter Einstellungen → Tätigkeitsart.

### Kategorien
Kategorien sind nach Typ getrennt – jede Kategorie steht nur für den passenden Typ zur Verfügung.

**Einnahmen (type=einnahme):**
- umsatz_pflichtig: Umsatzerlöse steuerpflichtig (19% / 7% MwSt) – Standard für Rechnungen mit MwSt
- umsatz_steuerfrei: Umsatzerlöse steuerfrei (Kleinunternehmer §19 UStG, Exporte)
- reverse_charge: Reverse Charge (§ 13b UStG) – Einnahmen von ausländischen Plattformen (Twitch, YouTube, Amazon), Steuerschuldumkehr
- ust_erstattung: USt-Erstattung vom Finanzamt (Zeile 18 EÜR)
- privateinlage: Privates Geld ins Unternehmen eingelegt (kein steuerpflichtiger Gewinn)
- anlagenverkauf: Erlös aus Verkauf von Firmenvermögen (Laptop, Möbel usw.)
- erstattungen: Erstattungen / Auslagen (durchlaufender Posten – mindert zuvor gebuchte Ausgaben)
- sponsoring: Sponsoring / Werbeleistung – Zahlungen von Sponsoren für Werbeplatzierungen
- affiliate: Affiliate / Vermittlungsprovision – Provisionen aus Affiliate-Links
- donations_tips: Donations / Tips (Streaming) – freiwillige Zuschauerzahlungen, sind Betriebseinnahmen wenn Gegenleistung (z.B. Vorlesen)
- sachzuwendungen: Sachzuwendungen (Marktwert) – erhaltene Produkte, Marktwert als Einnahme ansetzen (außer Rückgabepflicht/Pauschalversteuerung § 37b/Streuartikel < 10 €)
- sonstige_einnahmen: Alle anderen Einnahmen

**Betriebsausgaben (type=ausgabe):**
- anlagevermoegen_afa: Anschaffungen > 800€ netto (AfA über mehrere Jahre)
- gwg: Geringwertige Wirtschaftsgüter ≤ 800€ netto (Sofortabschreibung)
- software_abos: Software-Lizenzen, SaaS, Cloud-Dienste
- fremdleistungen: Subunternehmer, Freelancer, externe Agenturen
- buerobedarf: Büromaterial, Druckerpatronen, Papier
- reisekosten: Fahrtkosten (0,30 €/km), Hotel, Flüge, Verpflegungsmehraufwand
- bewirtungskosten: Geschäftliche Bewirtung – nur 70 % absetzbar, Angaben zu Teilnehmern und Anlass erforderlich
- marketing: Werbung, Anzeigen, Messen, PR
- weiterbildung: Kurse, Seminare, Fachbücher
- miete: Büromiete, Co-Working, Lagermiete, häusliches Arbeitszimmer
- versicherungen_betrieb: Betriebliche Versicherungen
- fahrzeugkosten: KFZ-Kosten, Benzin, Leasing
- kommunikation: Telefon, Internet, Mobilfunk (bei privater Mitbenutzung: Anteil abziehen)
- Sonderausgaben: spenden, krankenkasse, sozialversicherung
- Privat: privat (nicht absetzbar), privatentnahme

**Info-Dokumente (type=info):**
- vertraege: Verträge, AGBs, Bestätigungen, Informationsschreiben
- sonstiges: Sonstige Info-Dokumente

### Reverse Charge (§ 13b UStG)
- Bei Leistungen von/an ausländische Plattformen wird die Steuerschuld umgekehrt.
- Netto-Rechnung + USt-IdNr. beider Parteien + Hinweis auf Reverse Charge.
- Wichtige Plattformen: Google Ireland Ltd. (IE 6388047V), Twitch Interactive Inc. (USA), Amazon Media EU S.à r.l. (LU 20944528).

### AfA & GWG-Schwellen
- Bis 250 € netto: Direkter Betriebsausgabenabzug, kein Verzeichnis.
- 250,01–800 € netto: GWG-Sofortabschreibung möglich.
- 250,01–1.000 € netto: Alternativ Sammelposten (Pool) über 5 Jahre.
- Über 800 € netto: Lineare AfA über Nutzungsdauer (z.B. PC = 3 Jahre, digitale WG = 1 Jahr).
- Pro Jahr: Entweder GWG-Sofortabschreibung ODER Poolabschreibung – nicht beides.

### GoBD-Audit-Trail
- Jede Anlage, Änderung und Löschung einer Rechnung wird automatisch protokolliert.
- Änderungshistorie zeigt Zeitstempel, geändertes Feld, alter und neuer Wert.
- Festgeschriebene Belege dürfen nur über Stornobuchungen korrigiert werden.
- Aufbewahrungspflicht: 8 Jahre (seit BEG IV 2025 für Buchungsbelege/Rechnungen).

### DATEV-Export
- Export im DATEV-kompatiblen CSV-Format (Buchungsstapel).
- Felder: Umsatz, Soll/Haben, Konto, Gegenkonto, Belegdatum, Buchungstext, USt-Satz.
- Export über Alle Rechnungen → Exportieren → DATEV-CSV.

### Dashboard
- KPI-Karten: Einnahmen, Ausgaben, Gewinn, Rechnungsanzahl für das gewählte Jahr.
- Charts: Einnahmen vs. Ausgaben (Jahresübersicht), Letzte 28 Tage, Ausgaben nach Kategorie (Donut).
- Kleinunternehmergrenze: Fortschrittsbalken für 25.000 €-Vorjahresgrenze + 100.000 €-Jahresgrenze (ab 2025).
- Prognose: zeigt erwartete Einnahmen/Ausgaben basierend auf erkannten Mustern.
- Jahresauswahl oben rechts im Dashboard.

### Alle Rechnungen
- Tabellenansicht mit Suche, Filtern (Kategorie, Typ, Jahr), Sortierung und Paginierung.
- Klick auf eine Zeile öffnet die Detailansicht.
- Rechtsklick öffnet Kontextmenü (Bearbeiten, Löschen, PDF öffnen).
- Dubletten-Prüfung beim Speichern (Partner + Betrag + Datum).

### Rechnungsdetail
- Alle Felder bearbeitbar, PDF-Vorschau falls vorhanden.
- Navigation mit Pfeiltasten zu vorheriger/nächster Rechnung.
- Löschen mit Bestätigungsdialog.
- Änderungshistorie (Audit-Trail) einsehbar.

### Rechnung erstellen (Rechnungsdesigner)
- Erstellt druckfertige PDF-Rechnungen aus Templates.
- Empfänger, Positionen, Datum, Rechnungsnummer eingeben.
- Template auswählen → PDF generieren.
- Kleinunternehmer-Modus: USt-Ausweis automatisch gesperrt, Pflichthinweis § 19 UStG eingeblendet.

### Invoice Designer (Vorlagen-Editor)
- Drag-&-Drop-Canvas für Rechnungsvorlagen.
- Elemente: Text, Variable, Rechteck, Bild, Positionstabelle, Linie.
- Variablen: sender_name, receiver_name, doc_number, doc_date, total usw.
- KI-Analyse: Bild/PDF einer Rechnung hochladen → Template wird automatisch generiert.

### Export
- Excel-Export: alle Rechnungen als .xlsx Tabelle (Sheets: Alle Belege, Zusammenfassung, Nach Monat).
- DATEV-Export: CSV im DATEV-Buchungsstapel-Format für den Steuerberater.
- ZIP-Export: alle PDFs nach Monat/Kategorie strukturiert.
- Filterbarer Export nach Zeitraum, Typ, Kategorie.

### Verfahrensdokumentation (GoBD)
- Beschreibt, wie du die Software einsetzt, um GoBD-Konformität zu erreichen.
- Belege werden als PDF/A archiviert und mit Buchungssätzen verknüpft.
- Automatisches Änderungsprotokoll (Audit-Trail) mit Zeitstempel.
- Backup-Konzept: regelmäßige .rmbackup-Dateien erstellen.
- Aufbewahrungspflicht: 8 Jahre für Buchungsbelege/Rechnungen (seit BEG IV 2025), 10 Jahre für Handelsbücher und Jahresabschlüsse.

### Einstellungen
- Persönliche Daten: Name, Adresse, Steuernummer, IBAN usw. (werden in Rechnungen verwendet).
- Steuerregelung: Kleinunternehmer oder Regelbesteuerung.
- Tätigkeitsart: Freiberufler, Gewerbetreibend oder Content Creator.
- Gemini API-Key: kostenlos von Google, nötig für KI-Funktionen.
- Darstellung: Dark Mode, Theme auswählen, Animationen.
- Datensicherung: Datenbank exportieren/importieren.

### Globale Suche
- Strg+K öffnet die globale Suche.
- Suche nach Rechnungen, Partnern, Kategorien, Seiten.

### Keyboard Shortcuts
- Strg+K: Globale Suche
- Escape: Schließt offene Dialoge
`;

