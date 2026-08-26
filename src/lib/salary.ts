// Gehalt zusammenrechnen.
//
// Angestellte bekommen für ihr Gehalt keine Rechnung – es kommt jeden Monat
// von selbst. In der App steht deshalb nicht ein Beleg pro Monat, sondern die
// Angabe „ab diesem Monat so viel". Aus dieser Treppe (und den Einmalzahlungen
// daneben) errechnet sich, was in einem Monat oder Jahr aufs Konto kam.
//
// Eine Gehaltserhöhung ist ein neuer Eintrag, kein geänderter: Vergangene
// Monate müssen weiter das zeigen, was damals gezahlt wurde.

import type { Salary, SalaryExtra } from '@/types';

/** Monatsschlüssel, wie er in `valid_from` steht: „2026-08". */
export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Die Stufe, die in diesem Monat gilt – also die letzte, die nicht später
 * beginnt. Vor dem ersten Eintrag gibt es kein Gehalt.
 */
export function salaryForMonth(salaries: Salary[], year: number, month: number): Salary | null {
  const key = monthKey(year, month);
  const gültig = salaries
    .filter((s) => s.valid_from <= key)
    .sort((a, b) => b.valid_from.localeCompare(a.valid_from));
  return gültig[0] ?? null;
}

export interface SalaryMonth {
  month: number;
  gross: number;
  net: number;
  /** Tag im Monat, an dem gezahlt wird – 0 steht für „zum Monatsende". */
  payday: number;
  employer: string;
  /** Einmalzahlungen, die in diesem Monat dazukamen */
  extras: SalaryExtra[];
}

/** Alle zwölf Monate eines Jahres mit Gehalt und Einmalzahlungen. */
export function salaryYear(
  salaries: Salary[],
  extras: SalaryExtra[],
  year: number,
): { months: SalaryMonth[]; gross: number; net: number } {
  const months: SalaryMonth[] = [];
  let gross = 0;
  let net = 0;

  for (let month = 1; month <= 12; month++) {
    const stufe = salaryForMonth(salaries, year, month);
    const key = monthKey(year, month);
    const monatsExtras = extras.filter((e) => e.date.startsWith(key));
    const extraGross = monatsExtras.reduce((sum, e) => sum + e.gross, 0);
    const extraNet = monatsExtras.reduce((sum, e) => sum + e.net, 0);

    const monatBrutto = (stufe?.gross ?? 0) + extraGross;
    const monatNetto = (stufe?.net ?? 0) + extraNet;
    gross += monatBrutto;
    net += monatNetto;

    months.push({
      month,
      gross: monatBrutto,
      net: monatNetto,
      payday: stufe?.payday ?? 0,
      employer: stufe?.employer ?? '',
      extras: monatsExtras,
    });
  }

  return { months, gross, net };
}

/** „am 15." oder „zum Monatsende" – für die Anzeige. */
export function paydayLabel(payday: number): string {
  return payday > 0 ? `am ${payday}.` : 'zum Monatsende';
}
