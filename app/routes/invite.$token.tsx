import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { ArrowRightIcon, InfoIcon, Link2OffIcon, LockIcon } from "lucide-react";
import { useMemo } from "react";
import { data, Form, Link, redirect } from "react-router";
import { z } from "zod";

import type { Route } from "./+types/invite.$token";

import { AuthShell } from "~/components/auth-layout";
import { AuthStatus } from "~/components/auth-status";
import { ErrorList, Field } from "~/components/forms";
import { pillVariants } from "~/components/section";
import { Button, buttonVariants } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { isAuthToggleEnabled } from "~/features/auth/auth-settings.server";
import { auth, googleAuthEnabled } from "~/features/auth/auth.server";
import { GoogleSignInButton } from "~/features/auth/components/google-button";
import { createDisplayNameSchema } from "~/features/auth/form-schemas";
import { logout } from "~/features/auth/guards.server";
import {
  optionalUserContext,
  requestLoggerContext,
} from "~/features/auth/middleware.server";
import { createPasswordSchema } from "~/features/auth/password-schema";
import { landingPathForRole } from "~/features/auth/roles";
import { textFromMatches } from "~/features/site-text/meta";
import { RichText } from "~/features/site-text/rich-text";
import { roleText } from "~/features/site-text/role-text";
import { useText } from "~/features/site-text/site-text-context";
import { getText } from "~/features/site-text/site-text.server";
import type { Text } from "~/features/site-text/text";
import { normalizeInvitableRole } from "~/features/users/invite.shared";
import { cn } from "~/lib/utils";
import { requestLogger } from "~/logger/request-context.server";
import {
  acceptInvite,
  getInviteByToken,
  InviteNoLongerValidError,
  inviteValidity,
} from "~/models/invite.server";
import { getUserByEmail } from "~/models/user.server";
import { getClientIPAddress, unknownIntent } from "~/shared/http.server";

function inviteSignupSchema(t: Text) {
  return z.object({
    intent: z.literal("signup"),
    name: createDisplayNameSchema(t),
    password: createPasswordSchema(t),
  });
}

async function acceptCurrentInvite(
  invite: Parameters<typeof acceptInvite>[0]["invite"],
  userId: string,
  token: string,
) {
  try {
    await acceptInvite({ invite, userId });
  } catch (error) {
    if (error instanceof InviteNoLongerValidError) {
      requestLogger.warn(
        { userId, inviteId: invite.id },
        "Invite acceptance lost the single-use race",
      );
      throw redirect(`/invite/${token}`);
    }
    throw error;
  }
}

export const loader = async ({ params, context }: Route.LoaderArgs) => {
  const invite = await getInviteByToken(params.token);
  const validity = inviteValidity(invite);

  if (validity !== "valid" || !invite) {
    return { state: "dead-end" as const, reason: validity };
  }

  const user = await context.get(optionalUserContext)();

  if (!user) {
    return {
      state: "signup" as const,
      email: invite.email,
      roleName: invite.roleName,
      inviterName: invite.createdBy.name,
      googleEnabled: googleAuthEnabled && isAuthToggleEnabled("google"),
    };
  }

  if (user.email === invite.email) {
    return {
      state: "confirm" as const,
      email: user.email,
      currentRole: user.role.name,
      roleName: invite.roleName,
    };
  }

  return {
    state: "mismatch" as const,
    invitedEmail: invite.email,
    currentEmail: user.email,
  };
};

export const action = async ({
  request,
  params,
  context,
}: Route.ActionArgs) => {
  const formData = await request.formData();
  const intent = formData.get("intent");
  const log = context.get(requestLoggerContext);

  if (intent === "logout-retry") {
    const mismatched = await context.get(optionalUserContext)();
    const response = await logout(request);
    log.warn(
      { userId: mismatched?.id },
      "Invite retried after signing out a mismatched account",
    );
    response.headers.set("Location", `/invite/${params.token}`);
    return response;
  }

  const invite = await getInviteByToken(params.token);
  const validity = inviteValidity(invite);
  if (validity !== "valid" || !invite) {
    log.warn(
      { inviteId: invite?.id, reason: validity },
      "Invite submitted with a token that is no longer valid",
    );
    return redirect(`/invite/${params.token}`);
  }

  const landingPath = landingPathForRole(
    normalizeInvitableRole(invite.roleName),
  );

  if (intent === "accept") {
    const user = await context.get(optionalUserContext)();
    if (!user || user.email !== invite.email) {
      log.warn(
        {
          userId: user?.id,
          inviteId: invite.id,
          reason: user ? "identity-mismatch" : "anonymous",
        },
        "Invite acceptance refused for a different identity",
      );
      return redirect(`/invite/${params.token}`);
    }
    await acceptCurrentInvite(invite, user.id, params.token);
    log.warn(
      {
        ip: getClientIPAddress(request),
        userId: user.id,
        inviteId: invite.id,
        email: user.email,
        role: invite.roleName,
      },
      "Invite accepted (existing user)",
    );
    return redirect(landingPath);
  }

  if (intent === "signup") {
    const t = await getText();
    const submission = parseWithZod(formData, {
      schema: inviteSignupSchema(t),
    });
    if (submission.status !== "success") {
      return data({ result: submission.reply(), formError: null });
    }

    if (await getUserByEmail(invite.email)) {
      return data({
        result: submission.reply(),
        formError: t("invite.signup.accountExists"),
      });
    }

    const { name, password } = submission.value;
    await auth.api.signUpEmail({
      body: { name, email: invite.email, password },
      headers: request.headers,
    });

    const created = await getUserByEmail(invite.email);
    if (!created) throw new Error("signup did not create a user");

    await acceptCurrentInvite(invite, created.id, params.token);

    const { headers } = await auth.api.signInEmail({
      body: { email: invite.email, password },
      headers: request.headers,
      returnHeaders: true,
    });

    log.warn(
      {
        ip: getClientIPAddress(request),
        userId: created.id,
        inviteId: invite.id,
        email: invite.email,
        role: invite.roleName,
      },
      "Invite accepted (new user)",
    );

    return redirect(landingPath, { headers });
  }

  throw unknownIntent();
};

export const meta: Route.MetaFunction = ({ matches }) => [
  { title: textFromMatches(matches)("invite.metaTitle") },
];

function deadEndCopy(t: Text, reason: string) {
  switch (reason) {
    case "expired":
      return {
        heading: t("invite.expired.heading"),
        body: t("invite.expired.body"),
      };
    case "used":
      return { heading: t("invite.used.heading"), body: t("invite.used.body") };
    default:
      return {
        heading: t("invite.invalid.heading"),
        body: t("invite.invalid.body"),
      };
  }
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="text-foreground font-semibold">{children}</strong>;
}

export default function InvitePage({
  loaderData,
  actionData,
  params,
}: Route.ComponentProps) {
  const t = useText();

  if (loaderData.state === "dead-end") {
    const copy = deadEndCopy(t, loaderData.reason);
    return (
      <AuthStatus
        standalone
        tone="neutral"
        icon={<Link2OffIcon className="size-7" />}
        heading={copy.heading}
        body={copy.body}
      >
        <Link
          to="/events"
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          {t("invite.browseEvents")}
        </Link>
        <Link
          to="/login"
          className="text-primary text-sm font-semibold hover:underline"
        >
          {t("invite.goToLogin")}
        </Link>
      </AuthStatus>
    );
  }

  if (loaderData.state === "confirm") {
    const { email, currentRole, roleName } = loaderData;
    const upgrades = currentRole === "user" && roleName === "moderator";
    return (
      <AuthStatus
        standalone
        icon={<LockIcon className="size-7" />}
        heading={t("invite.acceptTitle")}
        body={
          <RichText
            text={
              upgrades
                ? t("invite.confirm.bodyUpgrade")
                : t("invite.confirm.body")
            }
            vars={{ email: <Strong>{email}</Strong> }}
          />
        }
      >
        {upgrades ? (
          <div className="flex items-center gap-3" aria-hidden>
            <RolePill>{roleText(t, currentRole)}</RolePill>
            <ArrowRightIcon className="text-muted-foreground size-4" />
            <RolePill accent>
              <LockIcon className="size-3" />
              {roleText(t, roleName)}
            </RolePill>
          </div>
        ) : null}
        <Form method="post" className="w-full">
          <input type="hidden" name="intent" value="accept" />
          <Button type="submit" size="lg" className="w-full">
            {upgrades
              ? t("invite.confirm.acceptUpgrade", {
                  role: roleText(t, roleName),
                })
              : t("invite.confirm.accept")}
          </Button>
        </Form>
        <Link
          to="/"
          className="text-primary text-sm font-semibold hover:underline"
        >
          {t("invite.confirm.notNow")}
        </Link>
      </AuthStatus>
    );
  }

  if (loaderData.state === "mismatch") {
    const { invitedEmail, currentEmail } = loaderData;
    return (
      <AuthStatus
        standalone
        tone="neutral"
        icon={<InfoIcon className="size-7" />}
        heading={t("invite.mismatch.heading")}
        body={
          <RichText
            text={t("invite.mismatch.body")}
            vars={{
              invitedEmail: <Strong>{invitedEmail}</Strong>,
              currentEmail: <Strong>{currentEmail}</Strong>,
            }}
          />
        }
      >
        <Form method="post" className="w-full">
          <input type="hidden" name="intent" value="logout-retry" />
          <Button type="submit" size="lg" className="w-full">
            {t("invite.mismatch.retry")}
          </Button>
        </Form>
        <Link
          to="/"
          className="text-primary text-sm font-semibold hover:underline"
        >
          {t("invite.mismatch.stay")}
        </Link>
      </AuthStatus>
    );
  }

  return (
    <InviteSignup
      loaderData={loaderData}
      actionData={actionData}
      token={params.token}
    />
  );
}

function RolePill({
  accent = false,
  children,
}: {
  accent?: boolean;
  children: React.ReactNode;
}) {
  return <span className={pillVariants({ accent })}>{children}</span>;
}

function InviteSignup({
  loaderData,
  actionData,
  token,
}: {
  loaderData: Extract<Awaited<ReturnType<typeof loader>>, { state: "signup" }>;
  actionData: Route.ComponentProps["actionData"];
  token: string;
}) {
  const { email, roleName, inviterName, googleEnabled } = loaderData;
  const t = useText();
  const signupSchema = useMemo(() => inviteSignupSchema(t), [t]);
  const [form, fields] = useForm({
    lastResult: actionData?.result ?? null,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(signupSchema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: signupSchema });
    },
  });

  const brandBody =
    roleName === "moderator"
      ? t("invite.signup.bodyModerator", { inviter: inviterName })
      : t("invite.signup.bodyUser", { inviter: inviterName });

  return (
    <AuthShell
      brand={{
        eyebrow: t("invite.signup.eyebrow"),
        heading: (
          <RichText
            text={t("invite.signup.heading")}
            vars={{
              role: (
                <span className="text-primary">{roleText(t, roleName)}</span>
              ),
            }}
          />
        ),
        body: brandBody,
      }}
    >
      <h1 className="mt-1 text-3xl leading-tight font-light tracking-tight">
        {t("invite.acceptTitle")}
      </h1>

      <Form
        method="post"
        className="flex flex-col gap-4"
        {...getFormProps(form)}
      >
        <input type="hidden" name="intent" value="signup" />

        {actionData?.formError ? (
          <ErrorList errors={[actionData.formError]} />
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-email">{t("auth.field.email")}</Label>
          <div className="relative">
            <Input
              id="invite-email"
              type="email"
              value={email}
              disabled
              className="text-muted-foreground pr-10"
            />
            <LockIcon
              aria-hidden
              className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2"
            />
          </div>
          <p className="text-muted-foreground text-sm">
            {t("invite.signup.emailHint")}
          </p>
        </div>

        <Field
          labelProps={{ children: t("auth.field.name") }}
          inputProps={{
            ...getInputProps(fields.name, { type: "text" }),
            placeholder: t("invite.signup.namePlaceholder"),
          }}
          errors={fields.name.errors}
        />

        <Field
          labelProps={{ children: t("auth.field.password") }}
          inputProps={{
            ...getInputProps(fields.password, { type: "password" }),
          }}
          errors={fields.password.errors}
        />

        <Button type="submit" size="lg" className="w-full">
          {t("invite.signup.submit")}
        </Button>

        {googleEnabled ? (
          <GoogleSignInButton callbackURL={`/invite/${token}`} />
        ) : null}

        <p className="text-muted-foreground text-center text-xs">
          {googleEnabled ? (
            <>
              <RichText
                text={t("invite.signup.googleNote")}
                vars={{
                  email: (
                    <strong className="text-foreground/80 font-semibold">
                      {email}
                    </strong>
                  ),
                }}
              />{" "}
            </>
          ) : null}
          <RichText
            text={t("invite.signup.privacy")}
            tags={{
              link: (children) => (
                <Link to="/privacy" className="text-primary hover:underline">
                  {children}
                </Link>
              ),
            }}
          />
        </p>
      </Form>
    </AuthShell>
  );
}
