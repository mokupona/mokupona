import React from "react";

import { cn } from "~/lib/utils";

export const fieldShellClassName = "h-11 border px-3 transition-colors";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  ref?: React.Ref<HTMLInputElement>;
}

const Input = ({ className, type, ref, ...props }: InputProps) => {
  return (
    <input
      type={type}
      className={cn(
        fieldShellClassName,
        "placeholder:text-muted-foreground file:text-foreground focus-visible:inset-ring-ring flex w-full py-1 file:border-0 file:bg-transparent file:text-sm file:font-semibold focus-visible:border-0 focus-visible:inset-ring-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
};

Input.displayName = "Input";

export { Input };
