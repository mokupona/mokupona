import { MailIcon } from "lucide-react";
import { Link, redirect } from "react-router";

import type { Route } from "./+types/check-your-inbox";

import { AuthShell } from "~/components/auth-layout";
import { AuthStatus } from "~/components/auth-status";
import { buttonVariants } from "~/components/ui/button";
import { textFromMatches } from "~/features/site-text/meta";
import { RichText } from "~/features/site-text/rich-text";
import { useText } from "~/features/site-text/site-text-context";
import { cn } from "~/lib/utils";

export const loader = async ({ request }: Route.LoaderArgs) => {
  const url = new URL(request.url);
  const email = url.searchParams.get("email");
  if (!email) return redirect("/join");
  const redirectTo = url.searchParams.get("redirectTo");
  return { email, redirectTo };
};

export const meta: Route.MetaFunction = ({ matches }) => [
  { title: textFromMatches(matches)("auth.inbox.metaTitle") },
];

export default function CheckYourInbox({ loaderData }: Route.ComponentProps) {
  const { email, redirectTo } = loaderData;
  const t = useText();
  const loginSearch = redirectTo
    ? `?${new URLSearchParams({ redirectTo })}`
    : "";

  return (
    <AuthShell
      brand={{
        eyebrow: t("auth.inbox.eyebrow"),
        heading: t("auth.inbox.panelHeading"),
        body: t("auth.inbox.panelBody"),
      }}
    >
      <AuthStatus
        icon={<MailIcon className="size-7" />}
        heading={t("auth.inbox.heading")}
        body={
          <RichText
            text={t("auth.inbox.body")}
            vars={{
              email: (
                <strong className="text-foreground font-semibold">
                  {email}
                </strong>
              ),
            }}
          />
        }
      >
        <Link
          to={`/login${loginSearch}`}
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          {t("auth.backToLogin")}
        </Link>
        <p className="text-muted-foreground text-sm">{t("auth.inbox.hint")}</p>
      </AuthStatus>
    </AuthShell>
  );
}
