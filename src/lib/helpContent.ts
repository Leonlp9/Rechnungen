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
- **Kleinunternehmer (§ 19 UStG):** Umsatz ≤ 25.000 € Vorjahr (ab 2025), ≤ 100.000 € lfd. Jahr. Kein USt-Ausweis, Pflichthinweis auf § 19 UStG.
- Die 25.000 € gelten fürs VORJAHR, die 100.000 € fürs LAUFENDE Jahr. Ein Überschreiten der Vorjahresgrenze wirkt ab dem 01.01. des Folgejahres, ein Überschreiten der 100.000 € dagegen sofort und mitten im Jahr – ab dem Umsatz, der die Grenze reißt.
- Anlagenverkäufe und echte durchlaufende Posten zählen nicht zum Gesamtumsatz.
- Seit dem Besteuerungszeitraum 2024 müssen Kleinunternehmer keine Umsatzsteuer-Jahreserklärung mehr abgeben, außer das Finanzamt fordert sie an oder es liegt ein Fall des § 18 Abs. 4a UStG vor (z. B. Steuerschuld nach § 13b UStG).
- **Regelbesteuerung:** USt wird ausgewiesen und an das Finanzamt abgeführt. Vorsteuerabzug möglich.
- Einstellung unter Einstellungen → Steuerregelung.

### Tätigkeitsart
- **Freiberufler (§ 18 EStG):** Katalogberufe, keine Gewerbesteuer, Anlage S.
- **Gewerbetreibend (§ 15 EStG):** Gewerbeanmeldung, IHK, Gewerbesteuer ab 24.500 € Gewinn, Anlage G.
- **Content Creator:** Streamer/YouTuber/Influencer – gewerblich, mit speziellen Kategorien für Donations, Sponsoring, Affiliate, Reverse Charge.
- Einstellung unter Einstellungen → Tätigkeitsart.

### Die EÜR und deine Steuererklärung
- Die Einnahmen-Überschuss-Rechnung (§ 4 Abs. 3 EStG) ist die einfache Gewinnermittlung: Betriebseinnahmen minus Betriebsausgaben, ohne Bilanz und ohne Inventur.
- Nutzen darf sie, wer nicht buchführungspflichtig ist. Freiberufler dürfen sie immer. Gewerbetreibende, solange sie unter den Grenzen des § 141 AO bleiben: seit Wirtschaftsjahren nach dem 31.12.2023 mehr als 800.000 € Umsatz oder mehr als 80.000 € Gewinn. Erst wenn das Finanzamt zur Buchführung auffordert, wird bilanziert.
- Zufluss-/Abflussprinzip (§ 11 EStG): Entscheidend ist der Tag der Zahlung, nicht das Rechnungsdatum. Eine im Dezember gestellte, im Januar bezahlte Rechnung gehört ins neue Jahr.
- Zehn-Tage-Regel: Regelmäßig wiederkehrende Zahlungen (Miete, Beiträge, Umsatzsteuer-Vorauszahlung) innerhalb von zehn Tagen um den Jahreswechsel zählen zu dem Jahr, zu dem sie wirtschaftlich gehören – nicht zu dem, in dem sie fließen.
- Die Anlage EÜR ist Pflicht und muss elektronisch übermittelt werden (§ 60 Abs. 4 EStDV), auch für Kleinunternehmer. Eine formlose Gewinnermittlung gibt es seit dem Formular 2017 nicht mehr.
- Die EÜR ist nur eine ANLAGE zur privaten Einkommensteuererklärung, keine eigene Erklärung. Selbständige sind immer zur Einkommensteuererklärung verpflichtet (§ 56 EStDV), auch bei einem Verlust.
- Dazu gehören: Hauptvordruck ESt 1 A, Anlage EÜR, Anlage S (Freiberufler) oder Anlage G (Gewerbe), Anlage Vorsorgeaufwand, bei Gewerbe zusätzlich die Gewerbesteuererklärung.
- Fristen für 2025: 31.07.2026 ohne Steuerberater, 01.03.2027 mit Steuerberater.
- Betriebsausgabe oder Sonderausgabe: Die Betriebsausgabe mindert den Gewinn und steht in der EÜR. Die Sonderausgabe (Kranken- und Pflegeversicherung, Altersvorsorge, Spenden) mindert erst eine Stufe später das zu versteuernde Einkommen und steht in der Anlage Vorsorgeaufwand oder im Hauptvordruck. Beides ist absetzbar, aber an ganz verschiedenen Stellen.

### E-Rechnung
- Empfangspflicht seit dem 01.01.2025 für alle inländischen Unternehmen – auch für Kleinunternehmer. Ein E-Mail-Postfach genügt dafür.
- Versandpflicht gestaffelt: ab 01.01.2027 für Unternehmen mit über 800.000 € Vorjahresumsatz, ab 01.01.2028 für alle übrigen.
- Kleinunternehmer sind vom Versand dauerhaft befreit; sie dürfen weiter PDF oder Papier ausstellen, müssen E-Rechnungen aber annehmen können.
- Beim Empfang ist die XML-Datei (XRechnung, ZUGFeRD) das Original und muss in dieser Form archiviert werden. Ein daraus erzeugtes PDF ist nur eine Ansicht und ersetzt die Aufbewahrung des XML nicht.

### Kategorien
Kategorien sind nach Typ getrennt – jede Kategorie steht nur für den passenden Typ zur Verfügung.

**Einnahmen (type=einnahme):**
- umsatz_pflichtig: Umsatzerlöse steuerpflichtig (19% / 7% MwSt) – Standard für Rechnungen mit MwSt
- umsatz_steuerfrei: Umsatzerlöse steuerfrei (Kleinunternehmer §19 UStG, Exporte)
- reverse_charge: Reverse Charge (§ 13b UStG) – Einnahmen von ausländischen Plattformen (Twitch, YouTube, Amazon), Steuerschuldumkehr
- ust_erstattung: USt-Erstattung vom Finanzamt
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
- gwg: Geringwertige Wirtschaftsgüter ≤ 800€ netto (Sofortabschreibung) – nur, wenn das Gut selbständig nutzbar ist
- software_abos: Software-Lizenzen, SaaS, Cloud-Dienste
- fremdleistungen: Subunternehmer, Freelancer, externe Agenturen
- buerobedarf: Büromaterial, Druckerpatronen, Papier
- reisekosten: Hotel, Flüge, Bahn und Dienstfahrten mit dem eigenen Pkw (0,30 € je tatsächlich gefahrenem Kilometer, ohne Höchstbetrag – nicht mit der Entfernungspauschale der Angestellten verwechseln). Verpflegungsmehraufwand im Inland: 28 € je vollem Tag, 14 € bei mehr als 8 Stunden sowie an An- und Abreisetagen
- bewirtungskosten: Geschäftliche Bewirtung – nur 70 % mindern den Gewinn (§ 4 Abs. 5 S. 1 Nr. 2 EStG), die Vorsteuer bleibt zu 100 % abziehbar. Angaben zu Teilnehmern und Anlass erforderlich
- marketing: Werbung, Anzeigen, Messen, PR
- weiterbildung: Kurse, Seminare, Fachbücher
- miete: Büromiete, Co-Working, Lagermiete, häusliches Arbeitszimmer
- versicherungen_betrieb: Betriebliche Versicherungen. Auch die Beiträge zur Berufsgenossenschaft (gesetzliche Unfallversicherung) gehören hierher. Eine Berufsunfähigkeitsversicherung dagegen nicht – sie ist sonstige Vorsorgeaufwendung und damit Sonderausgabe.
- fahrzeugkosten: KFZ-Kosten, Benzin, Leasing
- kommunikation: Telefon, Internet, Mobilfunk (bei privater Mitbenutzung: Anteil abziehen)

**Sonderausgaben (type=ausgabe, aber KEIN Betriebsaufwand):**
Diese drei Kategorien werden am häufigsten verwechselt. Sie sind absetzbar, aber an einer anderen Stelle: Sie mindern NICHT den Gewinn der EÜR, sondern erst eine Stufe später das zu versteuernde Einkommen in der Einkommensteuererklärung (§ 10 EStG). Deshalb tauchen sie in der EÜR gar nicht auf, wohl aber in der Anlage Vorsorgeaufwand.
- krankenkasse: Kranken- und Pflegeversicherung – Sonderausgabe nach § 10 Abs. 1 Nr. 3 EStG. Die Basisabsicherung wirkt in voller Höhe, der Krankenversicherungsbeitrag wird um 4 % gekürzt, soweit er Krankengeld einschließt.
- sozialversicherung: Altersvorsorge (Rentenversicherung, Versorgungswerk, Rürup) – Sonderausgabe nach § 10 Abs. 1 Nr. 2 EStG.
- spenden: Geldspenden an gemeinnützige Organisationen – Sonderausgabe bis 20 % des Gesamtbetrags der Einkünfte, kein Betriebsaufwand.

**Privat (type=ausgabe, gar nicht absetzbar):**
Der Unterschied zu den Sonderausgaben ist wichtig: Sonderausgaben wirken sich steuerlich aus, nur eben nicht auf den Gewinn. „Privat" wirkt sich überhaupt nicht aus.
- privat: Rein private Ausgaben ohne Geschäftsbezug (Netflix, Gaming-Abos, Einkäufe). Weder Betriebsausgabe noch Sonderausgabe – steuerlich vollkommen wirkungslos.
- privatentnahme: Überweisung vom Firmen- aufs Privatkonto. Nur eine Umbuchung, kein Aufwand.

**Info-Dokumente (type=info):**
- vertraege: Verträge, AGBs, Bestätigungen, Informationsschreiben
- sonstiges: Sonstige Info-Dokumente

### Reverse Charge (§ 13b UStG)
- Bei Leistungen von/an ausländische Plattformen wird die Steuerschuld umgekehrt.
- Netto-Rechnung + USt-IdNr. beider Parteien + Hinweis auf Reverse Charge.
- Wichtige Plattformen: Google Ireland Ltd. (IE 6388047V), Twitch Interactive Inc. (USA), Amazon Media EU S.à r.l. (LU 20944528).
- **Wichtig für Kleinunternehmer:** § 19 UStG schützt NICHT vor § 13b UStG. Wer als Kleinunternehmer Leistungen aus dem Ausland bezieht (Google Ads, Twitch, Amazon, Meta), schuldet die deutsche Umsatzsteuer selbst.
- Folgen für den Kleinunternehmer: Umsatzsteuer-Voranmeldung für den betroffenen Zeitraum ist Pflicht, die Steuer ist abzuführen, und ein Vorsteuerabzug steht ihm nicht zu – die Steuer bleibt echte Kosten.
- Dafür wird eine USt-IdNr. gebraucht; sie ist beim BZSt zu beantragen und der Plattform mitzuteilen. Dasselbe gilt beim innergemeinschaftlichen Erwerb von Waren.

### AfA & GWG-Schwellen
- Bis 250 € netto: Direkter Betriebsausgabenabzug, kein Verzeichnis.
- 250,01–800 € netto: GWG-Sofortabschreibung möglich.
- 250,01–1.000 € netto: Alternativ Sammelposten (Pool) über 5 Jahre.
- Über 800 € netto: Lineare AfA über Nutzungsdauer (z.B. PC = 3 Jahre, digitale WG = 1 Jahr).
- Pro Jahr: Entweder GWG-Sofortabschreibung ODER Poolabschreibung – nicht beides.
- Die Wertgrenzen (250 / 800 / 1.000 €) werden IMMER am Nettobetrag geprüft, auch beim Kleinunternehmer. Abgeschrieben wird beim Kleinunternehmer dagegen der Bruttobetrag, weil die Umsatzsteuer mangels Vorsteuerabzug zu den Anschaffungskosten gehört (§ 9b Abs. 1 EStG).
- Monitore, Drucker und Tastaturen sind nicht selbständig nutzungsfähig (§ 6 Abs. 2 S. 2 EStG) und deshalb KEIN GWG, auch unter 800 €. Als Computerhardware dürfen sie aber über ein Jahr abgeschrieben werden (BMF vom 22.02.2022), was praktisch auf dasselbe hinausläuft.
- Degressive AfA (§ 7 Abs. 2 EStG): 30 % vom Restbuchwert für bewegliche Wirtschaftsgüter, die zwischen dem 01.07.2025 und dem 31.12.2027 angeschafft werden. Die 30 % sind die Obergrenze; erlaubt ist höchstens das Dreifache des linearen Satzes (bei 13 Jahren Nutzungsdauer also nur 23,1 %). Im ersten Jahr monatsgenau gezwölftelt. Software ist ausgenommen. Der Wechsel zur linearen AfA ist erlaubt, sobald sie mehr bringt; der Rückweg nicht.

### GoBD-Audit-Trail
- Jede Anlage, Änderung und Löschung einer Rechnung wird automatisch protokolliert.
- Änderungshistorie zeigt Zeitstempel, geändertes Feld, alter und neuer Wert.
- Festgeschriebene Belege dürfen nur über Stornobuchungen korrigiert werden.
- Aufbewahrungspflicht: 8 Jahre für Buchungsbelege und Rechnungen (verkürzt durch das BEG IV, erstmals 2025). Bücher, Aufzeichnungen, Inventare und Jahresabschlüsse bleiben bei 10 Jahren – die 8 Jahre gelten nicht pauschal für alles.

### Buchungs-CSV für den Steuerberater
- CSV mit Konto, Gegenkonto, BU-Schlüssel, Belegdatum, Buchungstext, USt-Satz, Netto, Umsatzsteuer, Kategorie und steuerlicher Wirkung.
- Die Sachkonten sind ein Vorschlag nach SKR03: Erlöse mit 19 % auf 8400, mit 7 % auf 8300, ohne ausgewiesene Steuer (Kleinunternehmer, steuerfrei) auf 8200, § 13b UStG auf 8195.
- Sonderausgaben und Privates laufen als Privatentnahme (1800), nicht als Betriebsausgabe – sie mindern den Gewinn nicht.
- Kein fertiger DATEV-Buchungsstapel: Dafür fehlt der EXTF-Kopfsatz mit Berater- und Mandantennummer, Wirtschaftsjahr und Kontenrahmen. Die Kanzlei liest die Datei ein und ordnet die Konten zu.
- Export über Alle Rechnungen → Exportieren → Buchungen für den Steuerberater.

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

### Rechnung schreiben
- Seite "Rechnung schreiben": Empfänger, Eckdaten, Positionen und Texte in getrennten Abschnitten; rechts die Vorschau des fertigen Blatts.
- Der Absender kommt aus den Einstellungen und wird nicht jedes Mal neu eingetippt.
- Positionen: Beschreibung, Menge, Einheit, Einzelpreis und Zeilenrabatt. Der Betrag je Zeile rechnet sich selbst, ebenso Zwischensumme, Steuer und Endsumme.
- Am Handy liegt die Vorschau hinter einem Knopf, die Positionen stehen als Karten untereinander.
- Ergebnis wahlweise als PDF speichern oder direkt als Beleg buchen.
- Kleinunternehmer: kein Umsatzsteuerausweis, dafür der Pflichthinweis auf § 19 UStG.

### Vorlagen gestalten (Baukasten)
- Eine Vorlage besteht aus Bausteinen in einer Reihenfolge: Kopfzeile, Anschriftfeld, Eckdaten, Betreff, Text, Positionen, Zahlung, Fußzeile.
- Bausteine lassen sich ziehen, ausblenden und einzeln einstellen. Wo etwas auf dem Blatt landet, rechnet die App aus – Ränder und Ausrichtung sind deshalb immer sauber.
- Das Aussehen gilt für das ganze Dokument: Akzentfarbe, Schriftart, Schriftgröße, Seitenränder, Abstand zwischen den Bausteinen und das Logo.
- Mitgeliefert sind drei Vorlagen: "Klar" (farbiger Tabellenkopf), "Ruhig" (zurückhaltend, viel Weißraum) und "Kompakt" (kleinere Schrift, für viele Positionen).
- Wer eine mitgelieferte Vorlage ändert, bekommt automatisch eine eigene Kopie – das Original bleibt erhalten.
- Vorschau und PDF entstehen aus derselben Berechnung. Was in der Vorschau steht, steht auch im PDF.

### Export
- Excel-Export: alle Rechnungen als .xlsx Tabelle (Sheets: Alle Belege, Zusammenfassung, Nach Monat).
- Buchungs-CSV: Buchungssätze mit SKR03-Konten für die Steuerkanzlei – kein fertiger DATEV-Buchungsstapel.
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

