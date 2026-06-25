import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "w-full appearance-none rounded-input border border-input bg-surface px-3.5 py-3 text-sm text-ink",
      "focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15",
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
