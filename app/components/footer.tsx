import { Link } from "react-router";

import { BrandLockup } from "./brand-lockup";
import { Eyebrow } from "./section";

const linkClasses = "text-sm text-foreground/80 hover:text-foreground";

export function Footer() {
  return (
    <footer className="relative border-t">
      <div className="flex items-start justify-between gap-8 px-10 py-11 max-md:hidden">
        <div className="flex flex-col gap-3">
          <BrandLockup logoClassName="size-5" />
          <span className="text-muted-foreground text-xs">
            made with love in zürich
          </span>
        </div>
        <div className="flex gap-14">
          <div className="flex flex-col gap-2">
            <Eyebrow variant="tracked" tone="label">
              explore
            </Eyebrow>
            <Link to="/events" className={linkClasses}>
              events
            </Link>
            <Link to="/gallery" className={linkClasses}>
              gallery
            </Link>
            <Link to="/about" className={linkClasses}>
              about
            </Link>
            <Link to="/privacy" className={linkClasses}>
              privacy policy
            </Link>
            <Link to="/impressum" className={linkClasses}>
              impressum
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <Eyebrow variant="tracked" tone="label">
              follow
            </Eyebrow>
            <a
              href="https://instagram.com/mokupona"
              target="_blank"
              rel="noopener noreferrer"
              className={linkClasses}
            >
              instagram
            </a>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-5 pt-7 pb-10 md:hidden">
        <BrandLockup logoClassName="size-4" wordmarkClassName="text-base" />
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Link to="/events" className={linkClasses}>
            events
          </Link>
          <Link to="/gallery" className={linkClasses}>
            gallery
          </Link>
          <Link to="/about" className={linkClasses}>
            about
          </Link>
          <Link to="/privacy" className={linkClasses}>
            privacy policy
          </Link>
          <Link to="/impressum" className={linkClasses}>
            impressum
          </Link>
          <a
            href="https://instagram.com/mokupona"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClasses}
          >
            instagram
          </a>
        </div>
        <span className="text-muted-foreground text-xs">
          made with love in zürich
        </span>
      </div>
    </footer>
  );
}
