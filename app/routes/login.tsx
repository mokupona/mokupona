import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { useMemo } from "react";
import { data, Form, Link, redirect, useSearchParams } from "react-router";
import { z } from "zod";

import type { Route } from "./+types/login";

import { AuthShell } from "~/components/auth-layout";
import { AuthNotice } from "~/components/auth-notice";
import { CheckboxField, ErrorList, Field } from "~/components/forms";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { GOOGLE_DISABLED_ERROR } from "~/features/auth/auth-settings";
import { auth } from "~/features/auth/auth.server";
import { GoogleSignInButton } from "~/features/auth/components/google-button";
import {
  createEmailSchema,
  parseRequestForm,
} from "~/features/auth/form-schemas";
import {
  anonymousAuthPageLoader,
  requestLoggerContext,
} from "~/features/auth/middleware.server";
import { textFromMatches } from "~/features/site-text/meta";
import { RichText } from "~/features/site-text/rich-text";
import { useText } from "~/features/site-text/site-text-context";
import { getText } from "~/features/site-text/site-text.server";
import type { Text } from "~/features/site-text/text";
import { getClientIPAddress, safeRedirect } from "~/shared/http.server";

function loginSchema(t: Text) {
  return z.object({
    email: createEmailSchema(t),
    password: z.string({ error: t("auth.validation.passwordRequired") }),
    redirectTo: z.string().optional(),
    remember: z.boolean().optional().default(false),
  });
}

export const loader = anonymousAuthPageLoader;

export const action = async ({ request, context }: Route.ActionArgs) => {
  const logger = context.get(requestLoggerContext);
  const submission = await parseRequestForm(
    request,
    loginSchema(await getText()),
  );

  if (submission.status !== "success") {
    return data({ result: submission.reply(), authError: null });
  }

  const { email, password, remember } = submission.value;
  const redirectTo = safeRedirect(submission.value.redirectTo, "/");

  try {
    const { headers } = await auth.api.signInEmail({
      body: {
        email,
        password,
        rememberMe: remember,
        callbackURL: `/verify-email?email=${encodeURIComponent(email)}`,
      },
      headers: request.headers,
      returnHeaders: true,
    });

    logger.info(
      {
        ip: getClientIPAddress(request),
        email,
      },
      "Successful login request",
    );

    return redirect(redirectTo, { headers });
  } catch (error) {
    const code =
      error instanceof Error && "body" in error
        ? (error as { body?: { code?: string } }).body?.code
        : undefined;

    logger.warn(
      {
        ip: getClientIPAddress(request),
        email,
        reason: code ?? "unknown",
      },
      "Failed login request",
    );

    if (code === "EMAIL_NOT_VERIFIED") {
      return data({
        result: submission.reply(),
        authError: { kind: "unverified" as const, email },
      });
    }

    return data({
      result: submission.reply(),
      authError: { kind: "credentials" as const, email },
    });
  }
};

export const meta: Route.MetaFunction = ({ matches }) => [
  { title: textFromMatches(matches)("auth.login.metaTitle") },
];

export default function LoginPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/events";
  const authError = actionData?.authError ?? null;
  const t = useText();
  const schema = useMemo(() => loginSchema(t), [t]);
  const [form, fields] = useForm({
    lastResult: actionData?.result,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(schema),
    defaultValue: { redirectTo },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
  });
  const credentialsRejected = authError?.kind === "credentials";
  // set by the OAuth callback when it turned a google sign-in away
  const googleRefused = searchParams.get("error") === GOOGLE_DISABLED_ERROR;

  return (
    <AuthShell mode="login" search={searchParams.toString()}>
      <h1 className="mt-1 text-3xl leading-tight font-light tracking-tight">
        {t("auth.login.title")}
      </h1>

      <Form
        method="post"
        className="flex flex-col gap-4"
        {...getFormProps(form)}
      >
        {credentialsRejected ? (
          <AuthNotice variant="destructive">
            {t("auth.login.rejected")}
          </AuthNotice>
        ) : null}
        {googleRefused ? (
          <AuthNotice
            variant="destructive"
            title={t("auth.login.googleOffTitle")}
          >
            {t("auth.login.googleOffBody")}
          </AuthNotice>
        ) : null}
        {authError?.kind === "unverified" ? (
          <AuthNotice variant="accent" title={t("auth.login.unverifiedTitle")}>
            <p>
              <RichText
                text={t("auth.login.unverifiedBody")}
                vars={{
                  email: (
                    <strong className="text-foreground font-semibold">
                      {authError.email}
                    </strong>
                  ),
                }}
              />
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {t("auth.login.unverifiedHint")}
            </p>
          </AuthNotice>
        ) : null}

        <Field
          labelProps={{ children: t("auth.field.email") }}
          inputProps={{
            ...getInputProps(fields.email, { type: "email" }),
            "aria-invalid":
              credentialsRejected || fields.email.errors?.length
                ? true
                : undefined,
          }}
          errors={fields.email.errors}
        />

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor={fields.password.id}>
              {t("auth.field.password")}
            </Label>
            <Link
              to="/forgot-password"
              className="text-primary font-semibold hover:underline"
            >
              {t("auth.login.forgot")}
            </Link>
          </div>
          <Input
            {...getInputProps(fields.password, { type: "password" })}
            aria-invalid={
              credentialsRejected || fields.password.errors?.length
                ? true
                : undefined
            }
          />
          <ErrorList
            id={fields.password.errorId}
            errors={fields.password.errors}
          />
        </div>

        <Input type="hidden" name="redirectTo" value={redirectTo} />

        <CheckboxField
          buttonProps={{ id: "remember", name: "remember" }}
          labelProps={{ children: t("auth.login.remember") }}
        />

        <Button type="submit" size="lg" className="w-full">
          {t("auth.login.submit")}
        </Button>

        {loaderData.googleEnabled ? (
          <GoogleSignInButton callbackURL={redirectTo} />
        ) : null}

        <p className="text-muted-foreground text-center text-xs">
          <RichText
            text={t("auth.login.privacy")}
            tags={{
              link: (children) => (
                <Link to="/privacy" className="text-primary hover:underline">
                  {children}
                </Link>
              ),
            }}
          />
        </p>

        <p className="text-muted-foreground text-center text-sm">
          <RichText
            text={t("auth.login.noAccount")}
            tags={{
              link: (children) => (
                <Link
                  to={{
                    pathname: "/join",
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
