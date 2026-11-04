import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { useMemo } from "react";
import { data, Form, Link, redirect, useSearchParams } from "react-router";
import { z } from "zod";

import type { Route } from "./+types/join";

import { AuthShell } from "~/components/auth-layout";
import { AuthNotice } from "~/components/auth-notice";
import { ErrorList, Field } from "~/components/forms";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { isAuthToggleEnabled } from "~/features/auth/auth-settings.server";
import { auth } from "~/features/auth/auth.server";
import { GoogleSignInButton } from "~/features/auth/components/google-button";
import {
  createDisplayNameSchema,
  createEmailSchema,
} from "~/features/auth/form-schemas";
import {
  anonymousAuthPageLoader,
  requestLoggerContext,
} from "~/features/auth/middleware.server";
import { withPasswordConfirmation } from "~/features/auth/password-schema";
import { HoneypotField } from "~/features/forms/honeypot-field";
import { checkHoneypot } from "~/features/forms/honeypot.server";
import { textFromMatches } from "~/features/site-text/meta";
import { RichText } from "~/features/site-text/rich-text";
import { useText } from "~/features/site-text/site-text-context";
import { getText } from "~/features/site-text/site-text.server";
import type { Text } from "~/features/site-text/text";
import { getUserByEmail } from "~/models/user.server";
import { getClientIPAddress } from "~/shared/http.server";

function joinSchema(t: Text) {
  return withPasswordConfirmation(
    {
      name: createDisplayNameSchema(t),
      email: createEmailSchema(t),
      redirectTo: z.string().optional(),
    },
    t,
  );
}

export const loader = anonymousAuthPageLoader;

export const action = async ({ request, context }: Route.ActionArgs) => {
  const logger = context.get(requestLoggerContext);
  const formData = await request.formData();
  const t = await getText();
  const schema = joinSchema(t);

  // Answered with the success path's redirect: a caught bot must not learn it
  // was caught. Checked before the signup gate so it cannot learn whether
  // sign-ups are open either.
  const honeypot = checkHoneypot(formData);
  if (honeypot.outcome === "trapped") {
    logger.warn(
      { ip: getClientIPAddress(request), reason: honeypot.reason },
      "Blocked signup request caught by the spam trap",
    );

    const search = new URLSearchParams({
      email: formData.get("email")?.toString() ?? "",
    });
    return redirect(`/check-your-inbox?${search}`);
  }

  if (honeypot.outcome === "unverified") {
    logger.info(
      { ip: getClientIPAddress(request), reason: honeypot.reason },
      "Rejected signup request with an unverifiable spam-trap stamp",
    );

    const rejected = parseWithZod(formData, { schema });
    return data(rejected.reply({ formErrors: [t("site.forms.retry")] }), {
      status: 400,
    });
  }

  if (!isAuthToggleEnabled("emailSignup")) {
    logger.warn(
      { ip: getClientIPAddress(request) },
      "Blocked signup request while self-signup is disabled",
    );
    const rejected = parseWithZod(formData, { schema });
    return data(rejected.reply({ formErrors: [t("auth.join.closed")] }), {
      status: 403,
    });
  }

  const submission = await parseWithZod(formData, {
    schema: schema.check(async (ctx) => {
      const existingUser = await getUserByEmail(ctx.value.email);

      if (existingUser) {
        ctx.issues.push({
          code: "custom",
          path: ["email"],
          message: t("auth.join.accountExists"),
          input: ctx.value.email,
        });
      }
    }),
    async: true,
  });

  if (submission.status !== "success" || !submission.value) {
    logger.info(
      {
        ip: getClientIPAddress(request),
        email:
          submission.payload["email"]?.toString() ?? "unknown@no-domain.com",
        reason: submission.status === "error" ? submission.error : null,
      },
      "Failed signup request",
    );

    return submission.reply();
  }

  const { name, email, password, redirectTo } = submission.value;

  await auth.api.signUpEmail({
    body: { name, email, password },
    headers: request.headers,
  });

  await auth.api.sendVerificationEmail({
    body: {
      email,
      callbackURL: `/verify-email?email=${encodeURIComponent(email)}`,
    },
    headers: request.headers,
  });

  logger.info(
    {
      ip: getClientIPAddress(request),
      email,
    },
    "Successful signup request",
  );

  const search = new URLSearchParams({ email });
  if (redirectTo) search.set("redirectTo", redirectTo);
  return redirect(`/check-your-inbox?${search}`);
};

export const meta: Route.MetaFunction = ({ matches }) => [
  { title: textFromMatches(matches)("auth.join.metaTitle") },
];

export default function Join({ loaderData, actionData }: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? undefined;
  const t = useText();
  const schema = useMemo(() => joinSchema(t), [t]);
  const [form, fields] = useForm({
    lastResult: actionData,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(schema),
    defaultValue: { redirectTo },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
  });

  const emailSignupOpen = loaderData.emailSignupEnabled;
  const googleOpen = loaderData.googleEnabled;

  return (
    <AuthShell mode="join" search={searchParams.toString()}>
      <h1 className="mt-1 text-3xl leading-tight font-light tracking-tight">
        {t("auth.join.title")}
      </h1>

      <Form
        method="post"
        className="flex flex-col gap-4"
        {...getFormProps(form)}
      >
        {emailSignupOpen ? (
          <ErrorList id={form.errorId} errors={form.errors} />
        ) : (
          <AuthNotice variant="destructive">
            {googleOpen ? t("auth.join.emailClosed") : t("auth.join.closed")}
          </AuthNotice>
        )}

        <fieldset
          disabled={!emailSignupOpen}
          className="flex flex-col gap-4 disabled:opacity-60"
        >
          <Field
            labelProps={{ children: t("auth.field.name") }}
            inputProps={{
              ...getInputProps(fields.name, { type: "text" }),
              placeholder: t("auth.join.namePlaceholder"),
            }}
            errors={fields.name.errors}
          />

          <Field
            labelProps={{ children: t("auth.field.email") }}
            inputProps={{
              ...getInputProps(fields.email, { type: "email" }),
              placeholder: t("auth.field.emailPlaceholder"),
            }}
            errors={fields.email.errors}
          />

          <Field
            labelProps={{ children: t("auth.field.password") }}
            inputProps={{
              ...getInputProps(fields.password, { type: "password" }),
            }}
            errors={fields.password.errors}
          />

          <Field
            labelProps={{ children: t("auth.join.confirmPassword") }}
            inputProps={{
              ...getInputProps(fields.confirmPassword, { type: "password" }),
            }}
            errors={fields.confirmPassword.errors}
          />

          <Input type="hidden" name="redirectTo" value={redirectTo} />

          <HoneypotField />

          <p className="text-muted-foreground text-center text-xs">
            <RichText
              text={t("auth.join.privacy")}
              tags={{
                link: (children) => (
                  <Link to="/privacy" className="text-primary hover:underline">
                    {children}
                  </Link>
                ),
              }}
            />
          </p>

          <Button type="submit" size="lg" className="w-full">
            {t("auth.join.submit")}
          </Button>
        </fieldset>

        {googleOpen ? (
          <GoogleSignInButton callbackURL={redirectTo ?? "/"} />
        ) : null}

        <p className="text-muted-foreground text-center text-sm">
          <RichText
            text={t("auth.join.haveAccount")}
            tags={{
              link: (children) => (
                <Link
                  to={{
                    pathname: "/login",
                    search: searchParams.toString(),
                  }}
                  className="text-primary font-semibold hover:underline"
                >
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
