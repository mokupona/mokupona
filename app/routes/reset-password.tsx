import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { CircleCheckIcon, Link2OffIcon } from "lucide-react";
import { useMemo } from "react";
import { data, Form, Link, redirect } from "react-router";
import { z } from "zod";

import type { Route } from "./+types/reset-password";

import { AuthShell } from "~/components/auth-layout";
import { AuthStatus } from "~/components/auth-status";
import { Field } from "~/components/forms";
import { Button, buttonVariants } from "~/components/ui/button";
import { auth } from "~/features/auth/auth.server";
import { parseRequestForm } from "~/features/auth/form-schemas";
import { requestLoggerContext } from "~/features/auth/middleware.server";
import { withPasswordConfirmation } from "~/features/auth/password-schema";
import { textFromMatches } from "~/features/site-text/meta";
import { RichText } from "~/features/site-text/rich-text";
import { useText } from "~/features/site-text/site-text-context";
import { getText } from "~/features/site-text/site-text.server";
import type { Text } from "~/features/site-text/text";
import { cn } from "~/lib/utils";
import { getPasswordResetEmail } from "~/models/password-reset.server";
import { getClientIPAddress } from "~/shared/http.server";

function resetSchema(t: Text) {
  return withPasswordConfirmation({ token: z.string() }, t);
}

export const loader = async ({ request }: Route.LoaderArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.has("done")) return { state: "done" as const };

  const token = url.searchParams.get("token");
  if (!token || url.searchParams.has("error")) {
    return { state: "invalid" as const };
  }

  const email = await getPasswordResetEmail(token);
  if (!email) return { state: "invalid" as const };

  return { state: "form" as const, token, email };
};

export const action = async ({ request, context }: Route.ActionArgs) => {
  const logger = context.get(requestLoggerContext);
  const submission = await parseRequestForm(
    request,
    resetSchema(await getText()),
  );

  if (submission.status !== "success") {
    return data({ result: submission.reply() });
  }

  const { password, token } = submission.value;
  const email = await getPasswordResetEmail(token);

  try {
    await auth.api.resetPassword({
      body: { newPassword: password, token },
    });
  } catch (error) {
    logger.warn(
      {
        ip: getClientIPAddress(request),
        email,
        error,
      },
      "Password reset failed (stale token)",
    );
    return redirect("/reset-password?error=INVALID_TOKEN");
  }

  logger.info(
    {
      ip: getClientIPAddress(request),
      email,
    },
    "Password reset completed",
  );

  return redirect("/reset-password?done");
};

export const meta: Route.MetaFunction = ({ matches }) => [
  { title: textFromMatches(matches)("auth.reset.metaTitle") },
];

export default function ResetPassword({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const t = useText();
  const schema = useMemo(() => resetSchema(t), [t]);
  const [form, fields] = useForm({
    lastResult: actionData?.result,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
  });

  if (loaderData.state === "done") {
    return (
      <AuthStatus
        standalone
        icon={<CircleCheckIcon className="size-7" />}
        heading={t("auth.reset.doneHeading")}
        body={t("auth.reset.doneBody")}
      >
        <Link
          to="/login"
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          {t("auth.continueToLogin")}
        </Link>
      </AuthStatus>
    );
  }

  if (loaderData.state === "invalid") {
    return (
      <AuthStatus
        standalone
        tone="neutral"
        icon={<Link2OffIcon className="size-7" />}
        heading={t("auth.reset.invalidHeading")}
        body={t("auth.reset.invalidBody")}
      >
        <Link
          to="/forgot-password"
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          {t("auth.reset.invalidCta")}
        </Link>
      </AuthStatus>
    );
  }

  return (
    <AuthShell
      brand={{
        eyebrow: t("auth.reset.eyebrow"),
        heading: t("auth.reset.panelHeading"),
        body: t("auth.reset.panelBody"),
      }}
    >
      <div className="mt-1 flex flex-col gap-2">
        <h1 className="text-3xl leading-tight font-light tracking-tight">
          {t("auth.reset.title")}
        </h1>
        {loaderData.email ? (
          <p className="text-muted-foreground text-sm">
            <RichText
              text={t("auth.reset.resettingFor")}
              vars={{
                email: (
                  <strong className="text-foreground font-semibold">
                    {loaderData.email}
                  </strong>
                ),
              }}
            />
          </p>
        ) : null}
      </div>

      <Form
        method="post"
        className="flex flex-col gap-4"
        {...getFormProps(form)}
      >
        <input type="hidden" name="token" value={loaderData.token} />

        <div className="flex flex-col gap-1">
          <Field
            labelProps={{ children: t("auth.field.newPassword") }}
            inputProps={{
              ...getInputProps(fields.password, { type: "password" }),
            }}
            errors={fields.password.errors}
          />
          {fields.password.errors?.length ? null : (
            <p className="text-muted-foreground text-sm">
              {t("auth.reset.passwordHint")}
            </p>
          )}
        </div>

        <Field
          labelProps={{ children: t("auth.field.confirmNewPassword") }}
          inputProps={{
            ...getInputProps(fields.confirmPassword, { type: "password" }),
          }}
          errors={fields.confirmPassword.errors}
        />

        <Button type="submit" size="lg" className="w-full">
          {t("auth.reset.submit")}
        </Button>
      </Form>
    </AuthShell>
  );
}
