import { type ClassValue } from "clsx";

import { cn } from "~/lib/utils";

/** Native size of the artwork, used to keep the mark from being squashed. */
const LOGO_ASPECT = "603 / 526";

export interface LogoProps {
  className?: string | ClassValue[];
}

/**
 * The hand-drawn mark. Decorative in every call site — `BrandLockup` always
 * sets the name in text beside it — so it carries an empty alt.
 */
export function Logo({ className }: LogoProps) {
  return (
    <img
      src="/naive-logo.svg?v=alpha"
      alt=""
      style={{ aspectRatio: LOGO_ASPECT }}
      // The artwork's ground is transparent (scripts/artwork/transparent.py),
      // so it sits on whatever is behind it.
      // object-contain preserves the letterboxing the old inline SVG gave us,
      // since call sites size it with square `size-*` utilities.
      className={cn("art-warm w-auto object-contain", className)}
    />
  );
}
