import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const eurFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

export function fmtCurrency(value: number, privacyMode: boolean): string {
  if (privacyMode) return "••••";
  return eurFormatter.format(value);
}

const eurChartFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export const fmtEurChart = (v: number): string => eurChartFormatter.format(v);

export const MONTH_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'] as const;

/**
 * Zeigt einen nativen Speichern-Dialog und schreibt den CSV-Inhalt an den gewählten Ort.
 * Gibt `true` zurück wenn erfolgreich, `false` wenn der Nutzer abbricht.
 */
export async function saveCsvFile(defaultName: string, csvContent: string): Promise<boolean> {
  const path = await save({
    defaultPath: defaultName,
    filters: [{ name: 'CSV-Datei', extensions: ['csv'] }],
  });
  if (!path) return false;
  await writeTextFile(path, csvContent);
  toast.success('Datei gespeichert.');
  return true;
}
