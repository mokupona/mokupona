import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-base font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        "destructive-outline":
          "border border-destructive/35 text-destructive-light hover:bg-destructive/10",
        outline: "border border-foreground/20 hover:bg-foreground/5",
        secondary: "bg-card text-card-foreground hover:bg-card/80",
        ghost: "text-foreground/80 hover:bg-foreground/5",
        link: "text-primary underline-offset-4 hover:underline",
        // public CTAs only: torn paper like the sitelen glyphs, with a
        // little lift on hover the way a glyph pops
        paper:
          "paper-torn rounded-none -rotate-1 transition-transform duration-300 ease-[cubic-bezier(.3,1.6,.5,1)] hover:scale-105 hover:rotate-0 motion-reduce:transition-none",
      },
      size: {
        default: "h-11 px-6",
        sm: "h-9 px-4 text-sm",
        lg: "h-12 px-6",
        icon: "size-9",
        "icon-sm": "size-7",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends ButtonPrimitive.Props, VariantProps<typeof buttonVariants> {}

const Button = ({ className, variant, size, type, ...props }: ButtonProps) => (
  <ButtonPrimitive
    className={cn(buttonVariants({ variant, size, className }))}
    {...props}
    type={type}
  />
);

Button.displayName = "Button";

export { Button, buttonVariants };
