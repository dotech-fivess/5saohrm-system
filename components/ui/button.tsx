import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-btn font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "bg-primary text-white shadow-btn hover:bg-primary-press",
        secondary:
          "bg-surface text-brand border border-input hover:bg-app",
        danger: "bg-tint-danger text-danger hover:bg-tint-danger/70",
        ghost: "text-brand hover:bg-app",
        disabled: "bg-[#F0F3F1] text-muted cursor-not-allowed",
      },
      size: {
        sm: "text-[13px] px-3.5 py-2",
        md: "text-sm px-[18px] py-2.5",
        lg: "text-[15px] px-5 py-3.5",
        block: "w-full text-[15px] px-5 py-3.5",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
