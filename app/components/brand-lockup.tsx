import { Link } from "react-router";

import { Logo } from "./logo";

import { useText } from "~/features/site-text/site-text-context";
import { cn } from "~/lib/utils";

export interface BrandLockupProps {
  to?: string;
  className?: string;
  logoClassName?: string;
  wordmarkClassName?: string;
  /**
   * The nav shows the drawn mark alone; the footer still spells the name out.
   * When the wordmark is hidden the name stays in the accessibility tree, so
   * the home link keeps a label instead of becoming an unnamed link.
   */
  showWordmark?: boolean;
}

export function BrandLockup({
  to,
  className,
  logoClassName,
  wordmarkClassName,
  showWordmark = true,
}: BrandLockupProps) {
  const t = useText();
  const content = (
    <>
      <Logo className={cn("size-5", logoClassName)} />
      {showWordmark ? (
        <span className={cn("font-semibold", wordmarkClassName)}>
          {t("site.brand.name")}
        </span>
      ) : (
        <span className="sr-only">{t("site.brand.name")}</span>
      )}
    </>
  );

  const classes = cn("flex items-center gap-3", className);

  if (to) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    );
  }

  return <span className={classes}>{content}</span>;
}
