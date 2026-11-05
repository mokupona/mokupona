import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { CheckIcon } from "lucide-react";
import { useEffect, useMemo } from "react";
import { data, useFetcher } from "react-router";
import { toast } from "sonner";
import { z } from "zod";

import type { Route } from "./+types/me";

import { InitialsAvatar } from "~/components/admin-ui";
import { ErrorList, Field } from "~/components/forms";
import {
  Eyebrow,
  PageContainer,
  pageTitleClassName,
  pillVariants,
} from "~/components/section";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { fieldShellClassName, Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { isAuthToggleEnabled } from "~/features/auth/auth-settings.server";
import { authClient } from "~/features/auth/auth.client";
import { auth, googleAuthEnabled } from "~/features/auth/auth.server";
import { GoogleMark } from "~/features/auth/components/google-button";
import { createDisplayNameSchema } from "~/features/auth/form-schemas";
import {
  requestLoggerContext,
  requireResolvedUser,
} from "~/features/auth/middleware.server";
import { withPasswordConfirmation } from "~/features/auth/password-schema";
import { textFromMatches } from "~/features/site-text/meta";
import { RichText } from "~/features/site-text/rich-text";
import { roleText } from "~/features/site-text/role-text";
import { useText } from "~/features/site-text/site-text-context";
import { getText } from "~/features/site-text/site-text.server";
import type { Text } from "~/features/site-text/text";
import { cn } from "~/lib/utils";
import {
  getLinkedAccountId,
  getUserAuthOverview,
  updateUserName,
} from "~/models/user.server";
import { unknownIntent } from "~/shared/http.server";

function nameSchema(t: Text) {
  return z.object({
    intent: z.literal("update-name"),
    name: createDisplayNameSchema(t),
  });
}

function passwordActionSchema(t: Text) {
  return withPasswordConfirmation(
    {
      intent: z.enum(["change-password", "set-password"]),
      currentPassword: z.string().optional(),
    },
    t,
  ).check((ctx) => {
    if (ctx.value.intent === "change-password" && !ctx.value.currentPassword) {
      ctx.issues.push({
        code: "custom",
        path: ["currentPassword"],
        message: t("account.password.currentRequired"),
        input: ctx.value.currentPassword,
      });
    }
  });
}

export const meta: Route.MetaFunction = ({ matches }) => [
  { title: textFromMatches(matches)("account.metaTitle") },
];

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const user = await requireResolvedUser(context, request);
  const authOverview = await getUserAuthOverview(user.id);

  return {
    user: {
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      role: { name: user.role.name },
    },
    ...authOverview,
    googleEnabled: googleAuthEnabled && isAuthToggleEnabled("google"),
  };
};

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { id: userId } = await requireResolvedUser(context, request);
  const log = context.get(requestLoggerContext);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const t = await getText();

  if (intent === "update-name") {
    const submission = parseWithZod(formData, { schema: nameSchema(t) });
    if (submission.status !== "success") {
      return data({ result: submission.reply(), done: null });
    }
    await updateUserName(userId, submission.value.name);
    return data({ result: submission.reply(), done: "name" as const });
  }

  if (intent === "change-password" || intent === "set-password") {
    const submission = parseWithZod(formData, {
      schema: passwordActionSchema(t),
    });
    if (submission.status !== "success") {
      return data({ result: submission.reply(), done: null });
    }

    try {
      if (intent === "change-password") {
        await auth.api.changePassword({
          body: {
            currentPassword: submission.value.currentPassword!,
            newPassword: submission.value.password,
            revokeOtherSessions: false,
          },
          headers: request.headers,
        });
      } else {
        await auth.api.setPassword({
          body: { newPassword: submission.value.password },
          headers: request.headers,
        });
      }
    } catch (error) {
      log.warn({ userId, intent, error }, "Password change failed");
      return data({
        result: submission.reply({
          fieldErrors:
            intent === "change-password"
              ? { currentPassword: [t("account.password.wrongCurrent")] }
              : { password: [t("account.password.alreadySet")] },
        }),
        done: null,
      });
    }
    return data({
      result: submission.reply({ resetForm: true }),
      done: "password" as const,
    });
  }

  if (intent === "unlink-google") {
    try {
      // better-auth 1.7 unlinks by account row id, not by provider.
      const accountId = await getLinkedAccountId(userId, "google");
      if (!accountId) throw new Error("No Google account is linked");
      await auth.api.unlinkAccount({
        body: { accountId },
        headers: request.headers,
      });
      return data({ result: null, done: "unlink" as const });
    } catch (error) {
      log.warn({ userId, error }, "Unlinking the Google account failed");
      return data({ result: null, done: null });
    }
  }

  if (intent === "revoke-others") {
    await auth.api.revokeOtherSessions({ headers: request.headers });
    return data({ result: null, done: "sessions" as const });
  }

  throw unknownIntent();
};

function useActionToast(
  actionData: Route.ComponentProps["actionData"],
  state: string,
  done: "name" | "password" | "unlink" | "sessions",
  message: string,
) {
  useEffect(() => {
    if (actionData?.done === done && state === "idle") toast.success(message);
  }, [actionData, done, message, state]);
}

export default function MeRoute({ loaderData }: Route.ComponentProps) {
  const { user, hasPassword, googleLinked, sessionCount, googleEnabled } =
    loaderData;
  const t = useText();

  return (
    <PageContainer className="animate-page-in flex grow flex-col gap-5 pt-7 pb-20">
      <div className="mb-1">
        <Eyebrow variant="tracked" tone="label" className="mb-2">
          {t("account.eyebrow")}
        </Eyebrow>
        <h1 className={pageTitleClassName}>{t("account.title")}</h1>
      </div>

      <ProfileCard user={user} />

      <PasswordCard hasPassword={hasPassword} />

      {googleEnabled || googleLinked ? (
        <ConnectedAccountsCard
          email={user.email}
          googleEnabled={googleEnabled}
          googleLinked={googleLinked}
          hasPassword={hasPassword}
        />
      ) : null}

      <SessionsCard sessionCount={sessionCount} />
    </PageContainer>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card as="section" className="flex flex-col gap-5 p-6 md:p-7">
      {title ? (
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          {subtitle ? (
            <p className="text-muted-foreground text-sm">{subtitle}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </Card>
  );
}

function ProfileCard({
  user,
}: {
  user: Route.ComponentProps["loaderData"]["user"];
}) {
  const fetcher = useFetcher<typeof action>();
  const t = useText();
  const schema = useMemo(() => nameSchema(t), [t]);
  const [form, fields] = useForm({
    lastResult: fetcher.data?.result ?? null,
    constraint: getZodConstraint(schema),
    defaultValue: { name: user.name },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
  });

  const { state } = fetcher;
  useActionToast(fetcher.data, state, "name", t("account.profile.saved"));

  return (
    <SectionCard>
      <div className="flex items-center gap-4">
        <InitialsAvatar
          name={user.name}
          seed={0}
          className="size-12 text-base"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{user.name}</p>
        </div>
        <span className={pillVariants({ accent: true })}>
          {roleText(t, user.role.name)}
        </span>
      </div>

      <fetcher.Form
        method="post"
        className="flex flex-col gap-4"
        {...getFormProps(form)}
      >
        <input type="hidden" name="intent" value="update-name" />
        <div className="flex flex-col gap-2">
          <Label htmlFor={fields.name.id}>{t("auth.field.name")}</Label>
          <div className="flex gap-2">
            <Input
              className="flex-1"
              {...getInputProps(fields.name, { type: "text" })}
            />
            <Button type="submit" variant="outline" disabled={state !== "idle"}>
              {t("account.profile.save")}
            </Button>
          </div>
          <ErrorList id={fields.name.errorId} errors={fields.name.errors} />
        </div>
      </fetcher.Form>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">
          {t("account.profile.emailLabel")}
        </span>
        <div
          className={cn(
            fieldShellClassName,
            "text-muted-foreground flex items-center justify-between text-sm",
          )}
        >
          <span className="truncate">{user.email}</span>
          {user.emailVerified ? (
            <Badge variant="info" pill className="ml-2 shrink-0 gap-1">
              <CheckIcon className="size-3" /> {t("account.profile.verified")}
            </Badge>
          ) : null}
        </div>
        <p className="text-muted-foreground text-sm">
          {t("account.profile.emailHint")}
        </p>
      </div>
    </SectionCard>
  );
}

function PasswordCard({ hasPassword }: { hasPassword: boolean }) {
  const fetcher = useFetcher<typeof action>();
  const t = useText();
  const schema = useMemo(() => passwordActionSchema(t), [t]);
  const [form, fields] = useForm({
    lastResult: fetcher.data?.result ?? null,
    constraint: getZodConstraint(schema),
    defaultValue: {
      intent: hasPassword ? "change-password" : "set-password",
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
  });
  const intent = hasPassword ? "change-password" : "set-password";
  const { state } = fetcher;
  useActionToast(
    fetcher.data,
    state,
    "password",
    hasPassword ? t("account.password.saved") : t("account.password.savedSet"),
  );

  return (
    <SectionCard
      title={
        hasPassword
          ? t("account.password.title")
          : t("account.password.titleSet")
      }
      subtitle={
        hasPassword
          ? t("account.password.subtitle")
          : t("account.password.subtitleSet")
      }
    >
      <fetcher.Form
        method="post"
        className="flex flex-col gap-4"
        {...getFormProps(form)}
      >
        <input type="hidden" name="intent" value={intent} />

        {hasPassword ? (
          <Field
            labelProps={{ children: t("account.password.current") }}
            inputProps={{
              ...getInputProps(fields.currentPassword, { type: "password" }),
              required: true,
            }}
            errors={fields.currentPassword.errors}
          />
        ) : null}

        <Field
          labelProps={{ children: t("auth.field.newPassword") }}
          inputProps={{
            ...getInputProps(fields.password, { type: "password" }),
          }}
          errors={fields.password.errors}
        />

        <Field
          labelProps={{ children: t("auth.field.confirmNewPassword") }}
          inputProps={{
            ...getInputProps(fields.confirmPassword, { type: "password" }),
          }}
          errors={fields.confirmPassword.errors}
        />

        <Button
          type="submit"
          className="self-start"
          disabled={state !== "idle"}
        >
          {hasPassword
            ? t("account.password.submit")
            : t("account.password.submitSet")}
        </Button>
      </fetcher.Form>
    </SectionCard>
  );
}

function ConnectedAccountsCard({
  email,
  googleEnabled,
  googleLinked,
  hasPassword,
}: {
  email: string;
  googleEnabled: boolean;
  googleLinked: boolean;
  hasPassword: boolean;
}) {
  const fetcher = useFetcher<typeof action>();
  const t = useText();
  const unlinkBlocked = googleLinked && !hasPassword;

  const { state } = fetcher;
  useActionToast(
    fetcher.data,
    state,
    "unlink",
    t("account.connected.unlinked"),
  );

  return (
    <SectionCard
      title={t("account.connected.title")}
      subtitle={t("account.connected.subtitle")}
    >
      <div className="flex items-center gap-4 rounded-lg border px-4 py-4">
        <GoogleMark className="size-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold">
            {t("account.connected.google")}
          </p>
          <p className="text-muted-foreground truncate text-sm">
            {googleLinked
              ? t("account.connected.linkedAs", { email })
              : t("account.connected.notLinked")}
          </p>
        </div>
        {googleLinked ? (
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="unlink-google" />
            <Button
              type="submit"
              size="sm"
              variant="destructive-outline"
              disabled={unlinkBlocked || state !== "idle"}
            >
              {t("account.connected.unlink")}
            </Button>
          </fetcher.Form>
        ) : googleEnabled ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              authClient.linkSocial({
                provider: "google",
                callbackURL: "/me",
              })
            }
          >
            {t("account.connected.link")}
          </Button>
        ) : null}
      </div>
      {unlinkBlocked ? (
        <p className="text-muted-foreground text-sm">
          {t("account.connected.unlinkBlocked")}
        </p>
      ) : null}
    </SectionCard>
  );
}

function SessionsCard({ sessionCount }: { sessionCount: number }) {
  const fetcher = useFetcher<typeof action>();
  const t = useText();

  const { state } = fetcher;
  useActionToast(
    fetcher.data,
    state,
    "sessions",
    t("account.sessions.signedOut"),
  );

  return (
    <SectionCard title={t("account.sessions.title")}>
      <p className="text-muted-foreground text-sm">
        <RichText
          text={t("account.sessions.body")}
          vars={{
            devices: (
              <strong className="text-foreground font-semibold">
                {sessionCount === 1
                  ? t("account.sessions.devices.one")
                  : t("account.sessions.devices.other", {
                      count: sessionCount,
                    })}
              </strong>
            ),
          }}
        />
      </p>
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="revoke-others" />
        <Button
          type="submit"
          variant="outline"
          disabled={sessionCount <= 1 || state !== "idle"}
        >
          {t("account.sessions.signOutOthers")}
        </Button>
      </fetcher.Form>
    </SectionCard>
  );
}
