import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

const labelVariants = cva(
  "text-muted-foreground font-semibold select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
);

export interface LabelProps
  extends
    useRender.ComponentProps<"label">,
    VariantProps<typeof labelVariants> {}

const Label = ({ className, render, ref, ...props }: LabelProps) =>
  useRender({
    defaultTagName: "label",
    render,
    ref,
    props: mergeProps<"label">(
      { className: cn(labelVariants(), className) },
      props,
    ),
  });

Label.displayName = "Label";

export { Label };
