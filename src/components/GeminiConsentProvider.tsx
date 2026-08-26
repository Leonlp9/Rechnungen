// Hält den Datenschutz-Hinweis zur KI-Nutzung bereit und beantwortet die
// Anfrage aus `ensureGeminiConsent()`.
//
// Der Knackpunkt: Der Zustimmen-Knopf schließt den Dialog von sich aus. Das
// Schließen meldete bisher „abgebrochen" – und weil das Merken der Zustimmung
// erst danach fertig wurde, gewann die Absage das Rennen. Ergebnis: „KI-Nutzung
// wurde nicht bestätigt", obwohl gerade zugestimmt wurde (und beim nächsten
// Versuch lief es dann, weil die Zustimmung ja gespeichert war).
//
// Deshalb hier zwei Regeln:
//   1. Die Entscheidung wird vermerkt, bevor der Dialog schließt – ein
//      Schließen nach der Zustimmung ist kein Abbruch mehr.
//   2. Die wartende Zusage wird genau einmal beantwortet.

import { useEffect, useState, useCallback, useRef } from 'react';
import { GeminiConsentDialog } from '@/components/GeminiConsentDialog';
import { geminiConsentEmitter, setGeminiConsent } from '@/lib/gemini';

export function GeminiConsentProvider() {
  const [open, setOpen] = useState(false);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);
  /** null = noch offen, true = zugestimmt, false = abgelehnt */
  const decisionRef = useRef<boolean | null>(null);

  /** Antwortet der wartenden Anfrage – nur beim ersten Aufruf. */
  const settle = useCallback((value: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(value);
  }, []);

  useEffect(() => {
    return geminiConsentEmitter.on((resolve) => {
      // Eine noch offene Anfrage nicht liegen lassen, sonst wartet ihr
      // Aufrufer für immer.
      settle(false);
      resolverRef.current = resolve;
      decisionRef.current = null;
      setOpen(true);
    });
  }, [settle]);

  const handleConsent = useCallback(async () => {
    decisionRef.current = true;
    setOpen(false);
    try {
      await setGeminiConsent(true);
    } catch {
      // Konnte nicht gespeichert werden – die Zustimmung gilt trotzdem für
      // diesen Aufruf, gefragt wird dann eben beim nächsten Mal erneut.
    }
    settle(true);
  }, [settle]);

  const handleCancel = useCallback(() => {
    // Das automatische Schließen nach „Einverstanden" darf die Zustimmung
    // nicht überschreiben.
    if (decisionRef.current === true) return;
    decisionRef.current = false;
    setOpen(false);
    settle(false);
  }, [settle]);

  return (
    <GeminiConsentDialog
      open={open}
      onConsent={handleConsent}
      onCancel={handleCancel}
    />
  );
}
