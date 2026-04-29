import * as React from "react";
import { cn } from '@/lib/utils';
import { Tooltip as TooltipPrimitive } from 'radix-ui';

export function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root {...props} />;
}

export function TooltipProvider({ children, ...props }: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider {...props}>{children}</TooltipPrimitive.Provider>;
}

export function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger {...props} />;
}

export function TooltipContent({ className, side = 'top', sideOffset = 6, ...props }: React.ComponentProps<typeof TooltipPrimitive.Content> & { className?: string }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        side={side}
        sideOffset={sideOffset}
        className={cn(
          // Base
          'z-50 rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10',
          // Enter animation – fade + zoom + directional slide
          'data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=delayed-open]:duration-150 data-[state=delayed-open]:ease-out',
          'data-[state=instant-open]:animate-in data-[state=instant-open]:fade-in-0 data-[state=instant-open]:zoom-in-95 data-[state=instant-open]:duration-150 data-[state=instant-open]:ease-out',
          // Exit animation
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-100 data-[state=closed]:ease-in',
          // Directional slide origin
          'data-[side=top]:slide-in-from-bottom-1',
          'data-[side=bottom]:slide-in-from-top-1',
          'data-[side=left]:slide-in-from-right-1',
          'data-[side=right]:slide-in-from-left-1',
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip as TooltipRoot, TooltipTrigger as TooltipTriggerRoot, TooltipContent as TooltipContentRoot };

