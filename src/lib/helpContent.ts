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
Kategorien sind nach Typ getrennt – jede Kategorie steht nur für den passenden Typ zur Verfügung.

**Einnahmen (type=einnahme):**
- umsatz_pflichtig: Umsatzerlöse steuerpflichtig (19% / 7% MwSt) – Standard für Rechnungen mit MwSt
- umsatz_steuerfrei: Umsatzerlöse steuerfrei (Kleinunternehmer §19 UStG, Reverse-Charge, Exporte)
- ust_erstattung: USt-Erstattung vom Finanzamt (Zeile 18 EÜR)
- privateinlage: Privates Geld ins Unternehmen eingelegt (kein steuerpflichtiger Gewinn)
- anlagenverkauf: Erlös aus Verkauf von Firmenvermögen (Laptop, Möbel usw.)
- erstattungen: Erstattungen / Auslagen (durchlaufender Posten – mindert zuvor gebuchte Ausgaben)
- sonstige_einnahmen: Alle anderen Einnahmen (Donations, Crowdfunding, sonstige Erträge)

**Betriebsausgaben (type=ausgabe):**
- anlagevermoegen_afa: Anschaffungen > 800€ netto (AfA über mehrere Jahre)
- gwg: Geringwertige Wirtschaftsgüter ≤ 800€ netto (Sofortabschreibung)
- software_abos: Software-Lizenzen, SaaS, Cloud-Dienste
- fremdleistungen: Subunternehmer, Freelancer, externe Agenturen
- buerobedarf: Büromaterial, Druckerpatronen, Papier
- reisekosten: Fahrtkosten, Hotel, Flüge, Spesen
- marketing: Werbung, Anzeigen, Messen, PR
- weiterbildung: Kurse, Seminare, Fachbücher
- miete: Büromiete, Co-Working, Lagermiete
- versicherungen_betrieb: Betriebliche Versicherungen
- fahrzeugkosten: KFZ-Kosten, Benzin, Leasing
- kommunikation: Telefon, Internet, Mobilfunk
- Sonderausgaben: spenden, krankenkasse, sozialversicherung
- Privat: privat (nicht absetzbar), privatentnahme

**Info-Dokumente (type=info):**
- vertraege: Verträge, AGBs, Bestätigungen, Informationsschreiben
- sonstiges: Sonstige Info-Dokumente

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

