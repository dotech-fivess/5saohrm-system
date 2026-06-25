import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "w-full rounded-input border border-input bg-surface px-3.5 py-3 text-sm text-ink",
      "placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("block text-[13px] font-medium text-neutral mb-1.5", className)}
      {...props}
    />
  );
}
