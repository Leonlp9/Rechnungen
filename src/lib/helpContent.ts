// Plain-text help content for AI context.
// Update this when adding new help articles so the AI always has the latest info.

export const HELP_CONTENT_TEXT = `
## Rechnungs-Manager – Hilfe & Dokumentation

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

### Kategorien
- Einnahmen: einnahmen, erstattungen
- Betriebsausgaben: anlagevermoegen_afa, gwg, software_abos, fremdleistungen, buerobedarf, reisekosten, marketing, weiterbildung, miete, versicherungen_betrieb, fahrzeugkosten, kommunikation, vertraege
- Sonderausgaben: spenden, krankenkasse, sozialversicherung
- Privat: privat, privatentnahme
- Sonstiges: sonstiges

### Dashboard
- KPI-Karten: Einnahmen, Ausgaben, Gewinn, Rechnungsanzahl für das gewählte Jahr.
- Charts: Einnahmen vs. Ausgaben (Jahresübersicht), Letzte 28 Tage, Ausgaben nach Kategorie (Donut).
- Prognose: zeigt erwartete Einnahmen/Ausgaben basierend auf erkannten Mustern.
- Jahresauswahl oben rechts im Dashboard.

### Alle Rechnungen
- Tabellenansicht mit Suche, Filtern (Kategorie, Typ, Jahr), Sortierung und Paginierung.
- Klick auf eine Zeile öffnet die Detailansicht.
- Rechtsklick öffnet Kontextmenü (Bearbeiten, Löschen, PDF öffnen).

### Rechnungsdetail
- Alle Felder bearbeitbar, PDF-Vorschau falls vorhanden.
- Navigation mit Pfeiltasten zu vorheriger/nächster Rechnung.
- Löschen mit Bestätigungsdialog.

### Rechnung erstellen (Rechnungsdesigner)
- Erstellt druckfertige PDF-Rechnungen aus Templates.
- Empfänger, Positionen, Datum, Rechnungsnummer eingeben.
- Template auswählen → PDF generieren.

### Invoice Designer (Vorlagen-Editor)
- Drag-&-Drop-Canvas für Rechnungsvorlagen.
- Elemente: Text, Variable, Rechteck, Bild, Positionstabelle, Linie.
- Variablen: sender_name, receiver_name, doc_number, doc_date, total usw.
- KI-Analyse: Bild/PDF einer Rechnung hochladen → Template wird automatisch generiert.

### Export
- Excel-Export: alle Rechnungen als .xlsx Tabelle.
- PDF-Export: Sammelrechnung als PDF.
- Filterbarer Export nach Zeitraum, Typ, Kategorie.

### Einstellungen
- Persönliche Daten: Name, Adresse, Steuernummer, IBAN usw. (werden in Rechnungen verwendet).
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

