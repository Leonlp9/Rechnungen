import { useEffect, useState, useCallback } from 'react';
import { GeminiConsentDialog } from '@/components/GeminiConsentDialog';
import { geminiConsentEmitter, setGeminiConsent } from '@/lib/gemini';

export function GeminiConsentProvider() {
  const [open, setOpen] = useState(false);
  const [resolver, setResolver] = useState<((v: boolean) => void) | null>(null);

  useEffect(() => {
    return geminiConsentEmitter.on((resolve) => {
      setResolver(() => resolve);
      setOpen(true);
    });
  }, []);

  const handleConsent = useCallback(async () => {
    await setGeminiConsent(true);
    setOpen(false);
    resolver?.(true);
    setResolver(null);
  }, [resolver]);

  const handleCancel = useCallback(() => {
    setOpen(false);
    resolver?.(false);
    setResolver(null);
  }, [resolver]);

  return (
    <GeminiConsentDialog
      open={open}
      onConsent={handleConsent}
      onCancel={handleCancel}
    />
  );
}

