"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center border border-[var(--t-border)] bg-[var(--t-bg)] transition-colors",
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--t-info)]",
      "disabled:cursor-not-allowed disabled:opacity-40",
      "data-[state=checked]:border-[var(--t-info)] data-[state=checked]:bg-[var(--t-info)]/20",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 translate-x-0.5 bg-[var(--t-muted)] transition-transform",
        "data-[state=checked]:translate-x-4 data-[state=checked]:bg-[var(--t-info)]",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
