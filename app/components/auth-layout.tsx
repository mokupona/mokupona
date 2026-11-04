import type { ReactNode } from "react";
import { Link } from "react-router";

import {
  Eyebrow,
  Glow,
  segmentGroupClassName,
  segmentVariants,
} from "./section";

import { useText } from "~/features/site-text/site-text-context";

interface AuthShellBrandCopy {
  eyebrow: string;
  heading: ReactNode;
  body?: ReactNode;
}

interface AuthShellProps {
  mode?: "login" | "join";
  search?: string;
  brand?: AuthShellBrandCopy;
  children: ReactNode;
}

export function AuthShell({
  mode,
  search,
  brand: brandCopy,
  children,
}: AuthShellProps) {
  const t = useText();
  const brand = brandCopy ?? {
    eyebrow: t("auth.shell.eyebrow"),
    heading: t("auth.shell.heading"),
    body: t("auth.shell.body"),
  };

  return (
    <div className="flex grow flex-col md:flex-row">
      <div className="relative hidden flex-col justify-center overflow-hidden border-r p-12 md:flex md:w-1/2">
        <Glow className="-top-30 -right-24 size-80" />
        <div className="relative flex flex-col gap-4">
          <Eyebrow variant="kicker" tone="light">
            {brand.eyebrow}
          </Eyebrow>
          <h2 className="text-4xl leading-tight font-light tracking-tight">
            {brand.heading}
          </h2>
          {brand.body ? (
            <p className="text-muted-foreground max-w-md font-light">
              {brand.body}
            </p>
          ) : null}
        </div>
      </div>

      <div className="relative flex flex-col overflow-hidden border-b px-6 pt-6 pb-7 md:hidden">
        <Glow className="-top-24 -right-16 size-56" />
        <div className="relative flex flex-col gap-2">
          <Eyebrow variant="kicker" tone="light" className="text-xs">
            {brand.eyebrow}
          </Eyebrow>
          <h1 className="text-3xl leading-tight font-light tracking-tight">
            {brand.heading}
          </h1>
        </div>
      </div>

      <div className="flex flex-col px-6 py-6 md:w-1/2 md:justify-center md:px-20 md:py-16">
        <div className="mx-auto flex w-full max-w-md flex-col gap-4 md:gap-5">
          {mode ? <ModeToggle mode={mode} search={search} /> : null}
          {children}
        </div>
      </div>
    </div>
  );
}

function ModeToggle({ mode, search }: Pick<AuthShellProps, "mode" | "search">) {
  const t = useText();

  return (
    <div className={segmentGroupClassName}>
      <Link
        to={{ pathname: "/login", search }}
        className={segmentVariants({ active: mode === "login" })}
        aria-current={mode === "login" ? "page" : undefined}
      >
        {t("auth.toggle.login")}
      </Link>
      <Link
        to={{ pathname: "/join", search }}
        className={segmentVariants({ active: mode === "join" })}
        aria-current={mode === "join" ? "page" : undefined}
      >
        {t("auth.toggle.join")}
      </Link>
    </div>
  );
}
