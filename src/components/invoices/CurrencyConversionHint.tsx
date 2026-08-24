// Zeigt beim Erfassen/Bearbeitung eines Fremdwährungsbelegs, mit welchem Kurs
// und zu welchem Euro-Betrag gebucht wird – bevor gespeichert wird.

import { useEffect, useState } from 'react';
import { ArrowRight, Loader2, AlertTriangle } from 'lucide-react';
import { getRate, fmtOriginal, normalizeCurrency } from '@/lib/currency';
import { fmtCurrency } from '@/lib/utils';

interface Props {
  /** Bruttobetrag in der Belegwährung */
  brutto: number;
  currency: string;
  /** Belegdatum (YYYY-MM-DD) – bestimmt den Stichtagskurs */
  date: string;
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; rate: number; rateDate: string }
  | { kind: 'error'; message: string };

export function CurrencyConversionHint({ brutto, currency, date }: Props) {
  const code = normalizeCurrency(currency);
  const [state, setState] = useState<State>({ kind: 'idle' });

  useEffect(() => {
    if (code === 'EUR' || !date) {
      setState({ kind: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ kind: 'loading' });
    getRate(code, date)
      .then((r) => { if (!cancelled) setState({ kind: 'ok', rate: r.rate, rateDate: r.rateDate }); })
      .catch((e) => {
        if (!cancelled) setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
      });
    return () => { cancelled = true; };
  }, [code, date]);

  if (state.kind === 'idle') return null;

  if (state.kind === 'loading') {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Kurs wird ermittelt …
      </p>
    );
  }

  if (state.kind === 'error') {
    return (
      <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Kurs nicht abrufbar ({state.message}). Der Beleg wird gespeichert und automatisch
          umgerechnet, sobald wieder Netz da ist.
        </span>
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 px-2.5 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-1.5 font-medium">
        <span>{fmtOriginal(brutto, code)}</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <span className="text-primary">{fmtCurrency(brutto * state.rate, false)}</span>
      </div>
      <p className="mt-0.5 text-muted-foreground">
        EZB-Referenzkurs vom {new Date(state.rateDate).toLocaleDateString('de-DE')} ·{' '}
        1 {code} = {state.rate.toFixed(4)} EUR. Der Kurs wird mit dem Beleg eingefroren.
      </p>
    </div>
  );
}
