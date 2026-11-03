import { Link } from "react-router";

import { BrandLockup } from "./brand-lockup";
import { Eyebrow } from "./section";

import { useText } from "~/features/site-text/site-text-context";

const linkClasses = "text-sm text-foreground/80 hover:text-foreground";

export function Footer() {
  const t = useText();

  return (
    <footer className="relative border-t">
      <div className="flex items-start justify-between gap-8 px-10 py-11 max-md:hidden">
        <div className="flex flex-col gap-3">
          <BrandLockup logoClassName="size-5" />
          <span className="text-muted-foreground text-xs">
            {t("site.footer.tagline")}
          </span>
        </div>
        <div className="flex gap-14">
          <div className="flex flex-col gap-2">
            <Eyebrow variant="tracked" tone="label">
              {t("site.footer.explore")}
            </Eyebrow>
            <Link to="/events" className={linkClasses}>
              {t("site.nav.events")}
            </Link>
            <Link to="/gallery" className={linkClasses}>
              {t("site.nav.gallery")}
            </Link>
            <Link to="/about" className={linkClasses}>
              {t("site.nav.about")}
            </Link>
            <Link to="/privacy" className={linkClasses}>
              {t("site.footer.privacy")}
            </Link>
            <Link to="/impressum" className={linkClasses}>
              {t("site.footer.impressum")}
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <Eyebrow variant="tracked" tone="label">
              {t("site.footer.follow")}
            </Eyebrow>
            <a
              href="https://instagram.com/mokupona"
              target="_blank"
              rel="noopener noreferrer"
              className={linkClasses}
            >
              {t("site.nav.instagram")}
            </a>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-5 pt-7 pb-10 md:hidden">
        <BrandLockup logoClassName="size-4" wordmarkClassName="text-base" />
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Link to="/events" className={linkClasses}>
            {t("site.nav.events")}
          </Link>
          <Link to="/gallery" className={linkClasses}>
            {t("site.nav.gallery")}
          </Link>
          <Link to="/about" className={linkClasses}>
            {t("site.nav.about")}
          </Link>
          <Link to="/privacy" className={linkClasses}>
            {t("site.footer.privacy")}
          </Link>
          <Link to="/impressum" className={linkClasses}>
            {t("site.footer.impressum")}
          </Link>
          <a
            href="https://instagram.com/mokupona"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClasses}
          >
            {t("site.nav.instagram")}
          </a>
        </div>
        <span className="text-muted-foreground text-xs">
          {t("site.footer.tagline")}
        </span>
      </div>
    </footer>
  );
}
