// Ein/Aus-Schalter.
//
// Für Einstellungen, die schlicht an oder aus sind. Vorher standen dort
// Knöpfe mit wechselnder Beschriftung („Aktivieren" / „Deaktivieren") – die
// muss man erst lesen, um den Zustand zu erkennen, und sie sagen zudem das
// Gegenteil dessen, was gerade gilt. Ein Schalter zeigt den Zustand selbst.
//
// Die Maße hier sind die neutrale Grundform; die Themes legen ihre eigenen
// darüber (iOS 51×31 pt und Systemgrün, One UI Akzentblau, Fluent 40×20 mit
// Kontur) – Haken dafür sind `data-slot="switch"` und `switch-thumb`.

import * as React from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-input transition-colors outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring/50',
        'disabled:cursor-not-allowed disabled:opacity-50',
        // Der eingeschaltete Zustand steht bewusst zweimal da – einmal für
        // hell, einmal für dunkel. Ohne die zweite Regel gewinnt der dunkle
        // Grundwert und der Schalter sähe im Dunkelmodus immer aus wie „aus".
        'dark:bg-input/60 data-[state=checked]:bg-primary dark:data-[state=checked]:bg-primary',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block size-5 rounded-full bg-background shadow-sm ring-0',
          'translate-x-0.5 transition-transform data-[state=checked]:translate-x-[1.375rem]',
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
