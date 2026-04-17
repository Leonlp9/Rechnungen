import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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
