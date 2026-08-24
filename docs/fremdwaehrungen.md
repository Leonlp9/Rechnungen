# Fremdwährungen

Alle Auswertungen – Dashboard, EÜR, USt, AfA, Kleinunternehmergrenze, Exporte –
rechnen ausschließlich in **Euro**. Ein Beleg über 100 USD darf also nicht als
„100" in dieselbe Summe wandern wie ein Beleg über 100 €. Deshalb speichert
Klevr pro Beleg **zwei** Beträge.

## Datenmodell

| Spalte | Bedeutung |
| --- | --- |
| `netto`, `ust`, `brutto`, `fee` | **immer Euro** – damit rechnet die gesamte App |
| `netto_original`, `ust_original`, `brutto_original`, `fee_original` | Betrag so, wie er auf dem Beleg steht |
| `currency` | Belegwährung (ISO 4217) |
| `fx_rate` | Euro je 1 Einheit der Belegwährung. `0` = Umrechnung steht aus |
| `fx_date` | tatsächliches Kursdatum (EZB-Bankarbeitstag) |
| `fx_source` | `identity` \| `ecb` \| `manual` \| `pending` |

Bei Euro-Belegen – dem Normalfall – sind beide Beträge identisch und
`fx_rate = 1`. Es ändert sich für sie also rein gar nichts.

## Der Kurs wird genau einmal ermittelt

Maßgeblich ist der Kurs zum **Belegdatum**, nicht der heutige. Er wird beim
Speichern geholt und danach eingefroren – ein späterer Kursverfall verändert
die Buchhaltung nicht mehr. Das ist auch der Grund, warum die Euro-Beträge
gespeichert und nicht bei jeder Anzeige neu berechnet werden.

Kursquelle sind die **EZB-Referenzkurse** über die Frankfurter-API
(kostenlos, kein API-Schlüssel). Die EZB veröffentlicht nur an
Bankarbeitstagen; für Belege an Wochenenden und Feiertagen wird automatisch
der letzte davorliegende Kurs verwendet und sein echtes Datum in `fx_date`
festgehalten.

Jede Kombination aus Währung und Datum wird höchstens **einmal** abgerufen und
danach in der Tabelle `fx_rates` zwischengespeichert. Beim Nachrechnen großer
Altbestände holt `prefetchRates()` zusätzlich eine ganze Zeitreihe pro Währung
in einem einzigen Abruf statt hunderter Einzelabfragen.

> **Umsatzsteuer:** § 16 Abs. 6 UStG erlaubt alternativ die monatlichen
> BMF-Durchschnittskurse. Wer die braucht, kann den Kurs pro Beleg
> überschreiben (`fx_source = 'manual'`) – die App rechnet dann damit statt
> mit dem EZB-Kurs.

## Automatische Migration

Die Datenbank-Migration v10 → v11 läuft beim ersten Start der neuen Version
und erledigt alles ohne Zutun:

1. Währungsangaben werden vereinheitlicht (`''`, `'€'`, `'eur'`, `' USD '` →
   `EUR` bzw. `USD`).
2. **Euro-Belege** bekommen `*_original = *`, `fx_rate = 1`,
   `fx_source = 'identity'`. Kein Netzzugriff, keine Wertänderung – die
   Summen stimmen sofort weiter.
3. **Fremdwährungsbelege** behalten ihre bisherigen Beträge als
   `*_original` (das *sind* die Originalbeträge – sie wurden bisher
   fälschlich als Euro aufsummiert) und werden auf `fx_source = 'pending'`
   gesetzt.

Kurz nach dem Start holt `ensureCurrencyConversions()` die fehlenden
Stichtagskurse nach, schreibt die Euro-Beträge und protokolliert jede
Umrechnung im GoBD-Änderungsprotokoll:

```
currency_converted | brutto | 100.00 USD → 93.48 EUR
                   | Notiz: EZB-Referenzkurs 0.93475 EUR/USD vom 2024-05-02
```

Ohne Internetverbindung bleiben die Belege auf `pending`, werden weiter mit
ihrem Fremdwährungsbetrag gezählt und erscheinen im **Hinweis-Indikator** in
der Topbar mit einem „Jetzt umrechnen"-Knopf. Beim nächsten Start wird es
ohnehin automatisch erneut versucht.

## Erfassung

- Die Währung ist ein **Auswahlfeld**, kein Freitext – nur für die gelisteten
  Währungen gibt es EZB-Kurse, also nur für die kann nachvollziehbar
  umgerechnet werden.
- Die Betragsfelder erfassen den Betrag **in der Belegwährung**; direkt darunter
  zeigt ein Hinweis, welcher Euro-Betrag mit welchem Kurs gebucht wird.
- Die KI-Erkennung bekommt die Codeliste als festes Schema plus explizite
  Regeln: Steht kein Währungszeichen auf dem Beleg, ist es `EUR` – sie soll
  nicht „USD" raten, nur weil der Anbieter amerikanisch ist. Zusätzlich wird
  jede Antwort über `normalizeCurrency()` auf einen gültigen Code gezwungen.
- **Stornobuchungen** erben Kurs und Kursdatum des Originalbelegs
  (`fx_source = 'manual'`). Sonst würde der Storno mit dem heutigen Kurs
  umgerechnet und der Saldo ginge nicht auf null auf.

## Anzeige

Beträge erscheinen weiterhin überall in Euro. Zusätzlich sichtbar wird die
Belegwährung dort, wo es um den einzelnen Beleg geht:

- **Belegliste:** Zeile „Beleg: 100,00 $" unter dem Euro-Betrag
- **Belegdetail:** „Gebucht: 93,48 € · Beleg: 100,00 $" samt Kurs und Kursdatum
- **Excel-, CSV- und GoBD-Export:** eigene Spalten für Originalbetrag,
  Umrechnungskurs und Kursdatum – die Umrechnung ist damit prüfbar
- **DATEV-Export:** Euro-Betrag mit Währungsschlüssel `EUR`
- **XRechnung:** die XML ist ein Dokument *in* der Belegwährung und verwendet
  deshalb die Originalbeträge

## Code-Landkarte

- `src/lib/currency.ts` – Währungsliste, Kursabruf + Cache, Umrechnung, Backfill
- `src/lib/db.ts` – Migration v10 → v11, `withConversion()` beim Schreiben
- `src/components/ui/CurrencySelect.tsx` – Auswahlfeld
- `src/components/invoices/CurrencyConversionHint.tsx` – Vorschau beim Erfassen
- `src/components/layout/DataIssuesIndicator.tsx` – offene Umrechnungen
