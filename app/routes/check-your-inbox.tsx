import { MailIcon } from "lucide-react";
import { Link, redirect } from "react-router";

import type { Route } from "./+types/check-your-inbox";

import { AuthShell } from "~/components/auth-layout";
import { AuthStatus } from "~/components/auth-status";
import { buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export const loader = async ({ request }: Route.LoaderArgs) => {
  const url = new URL(request.url);
  const email = url.searchParams.get("email");
  if (!email) return redirect("/join");
  const redirectTo = url.searchParams.get("redirectTo");
  return { email, redirectTo };
};

export const meta: Route.MetaFunction = () => [{ title: "Check your inbox" }];

export default function CheckYourInbox({ loaderData }: Route.ComponentProps) {
  const { email, redirectTo } = loaderData;
  const loginSearch = redirectTo
    ? `?${new URLSearchParams({ redirectTo })}`
    : "";

  return (
    <AuthShell
      brand={{
        eyebrow: "one more step",
        heading: "you're almost at the table",
        body: "just confirm your email and your account is ready. we'll keep your seat warm.",
      }}
    >
      <AuthStatus
        icon={<MailIcon className="size-7" />}
        heading="check your inbox"
        body={
          <>
            we sent a verification link to{" "}
            <strong className="text-foreground font-semibold">{email}</strong>.
            open it to confirm your address, then log in.
          </>
        }
      >
        <Link
          to={`/login${loginSearch}`}
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          back to log in
        </Link>
        <p className="text-muted-foreground text-sm">
          no link yet? give it a minute, then check your spam folder.
        </p>
      </AuthStatus>
    </AuthShell>
  );
}
