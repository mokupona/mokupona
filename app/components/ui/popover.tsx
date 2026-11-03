"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import React from "react";

import { cn } from "~/lib/utils";

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = ({
  className,
  align = "center",
  alignOffset,
  side,
  sideOffset = 4,
  ref,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Positioner
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      className="isolate z-50"
    >
      <PopoverPrimitive.Popup
        ref={ref}
        className={cn(
          "bg-popover text-popover-foreground w-72 origin-[var(--transform-origin)] border p-4 shadow-md outline-hidden transition-[opacity,scale] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Positioner>
  </PopoverPrimitive.Portal>
);

PopoverContent.displayName = "PopoverContent";

export { Popover, PopoverContent, PopoverTrigger };
