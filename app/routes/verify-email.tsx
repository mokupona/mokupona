import { CircleCheckIcon, Link2OffIcon } from "lucide-react";
import { Link } from "react-router";

import type { Route } from "./+types/verify-email";

import { AuthShell } from "~/components/auth-layout";
import { AuthStatus } from "~/components/auth-status";
import { buttonVariants } from "~/components/ui/button";
import { textFromMatches } from "~/features/site-text/meta";
import { RichText } from "~/features/site-text/rich-text";
import { useText } from "~/features/site-text/site-text-context";
import { cn } from "~/lib/utils";

export const loader = async ({ request }: Route.LoaderArgs) => {
  const url = new URL(request.url);
  return {
    failed: url.searchParams.has("error"),
    email: url.searchParams.get("email"),
  };
};

export const meta: Route.MetaFunction = ({ matches }) => [
  { title: textFromMatches(matches)("auth.verify.metaTitle") },
];

export default function VerifyEmail({ loaderData }: Route.ComponentProps) {
  const { failed, email } = loaderData;
  const t = useText();

  if (failed) {
    return (
      <AuthStatus
        standalone
        tone="neutral"
        icon={<Link2OffIcon className="size-7" />}
        heading={t("auth.verify.failedHeading")}
        body={t("auth.verify.failedBody")}
      >
        <Link
          to="/login"
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          {t("auth.backToLogin")}
        </Link>
      </AuthStatus>
    );
  }

  return (
    <AuthShell
      brand={{
        eyebrow: t("auth.verify.eyebrow"),
        heading: t("auth.verify.panelHeading"),
        body: t("auth.verify.panelBody"),
      }}
    >
      <AuthStatus
        icon={<CircleCheckIcon className="size-7" />}
        heading={t("auth.verify.heading")}
        body={
          email ? (
            <RichText
              text={t("auth.verify.bodyWithEmail")}
              vars={{
                email: (
                  <strong className="text-foreground font-semibold">
                    {email}
                  </strong>
                ),
              }}
            />
          ) : (
            t("auth.verify.body")
          )
        }
      >
        <Link
          to="/login"
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          {t("auth.continueToLogin")}
        </Link>
        <Link
          to="/events"
          className="text-primary text-sm font-semibold hover:underline"
        >
          {t("auth.verify.browse")}
        </Link>
      </AuthStatus>
    </AuthShell>
  );
}
