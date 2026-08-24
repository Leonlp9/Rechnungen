// Rückmeldung bei ungültigen Formularen.
//
// react-hook-form bricht beim Absenden still ab, wenn die Validierung
// fehlschlägt – ohne eigenen Handler sieht es dann so aus, als würde der
// Speichern-Knopf nichts tun. Häufigster Fall: ein geleertes Zahlenfeld wird
// per `valueAsNumber` zu NaN und scheitert an `z.number()`.

import { toast } from 'sonner';

const FIELD_LABELS: Record<string, string> = {
  date: 'Datum',
  delivery_date: 'Leistungsdatum',
  description: 'Beschreibung',
  partner: 'Partner',
  netto: 'Netto',
  fee: 'Gebühren',
  ust: 'USt',
  brutto: 'Brutto',
  type: 'Typ',
  category: 'Kategorie',
  currency: 'Währung',
  note: 'Notiz',
  project_id: 'Projekt',
};

/** Übersetzt die Fehlerschlüssel in lesbare Feldnamen. */
export function invalidFieldNames(errors: Record<string, unknown>): string[] {
  return Object.keys(errors).map((k) => FIELD_LABELS[k] ?? k);
}

/**
 * Als `onInvalid` an `handleSubmit(onValid, onInvalid)` übergeben.
 * Meldet dem Nutzer, warum nicht gespeichert wurde.
 */
export function reportInvalid(
  errors: Record<string, unknown>,
  onFields?: (names: string[]) => void,
): void {
  const names = invalidFieldNames(errors);
  onFields?.(names);
  if (names.length === 0) {
    toast.error('Nicht gespeichert – bitte Eingaben prüfen.');
    return;
  }
  toast.error(
    names.length === 1
      ? `„${names[0]}" ist nicht gültig – bitte prüfen.`
      : `Nicht gespeichert: ${names.join(', ')} prüfen.`,
    { description: 'Zahlenfelder dürfen nicht leer sein – trage 0 ein.' },
  );
}
