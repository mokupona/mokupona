import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { MailIcon } from "lucide-react";
import { useMemo } from "react";
import { data, Form, Link } from "react-router";
import { z } from "zod";

import type { Route } from "./+types/forgot-password";

import { AuthShell } from "~/components/auth-layout";
import { AuthStatus } from "~/components/auth-status";
import { Field } from "~/components/forms";
import { Button, buttonVariants } from "~/components/ui/button";
import { auth } from "~/features/auth/auth.server";
import {
  createEmailSchema,
  parseRequestForm,
} from "~/features/auth/form-schemas";
import { requestLoggerContext } from "~/features/auth/middleware.server";
import { textFromMatches } from "~/features/site-text/meta";
import { RichText } from "~/features/site-text/rich-text";
import { useText } from "~/features/site-text/site-text-context";
import { getText } from "~/features/site-text/site-text.server";
import type { Text } from "~/features/site-text/text";
import { cn } from "~/lib/utils";
import { getClientIPAddress } from "~/shared/http.server";

function forgotSchema(t: Text) {
  return z.object({ email: createEmailSchema(t) });
}

export const action = async ({ request, context }: Route.ActionArgs) => {
  const logger = context.get(requestLoggerContext);
  const submission = await parseRequestForm(
    request,
    forgotSchema(await getText()),
  );

  if (submission.status !== "success") {
    return data({ result: submission.reply(), sentTo: null });
  }

  const { email } = submission.value;

  await auth.api.requestPasswordReset({
    body: { email, redirectTo: "/reset-password" },
    headers: request.headers,
  });

  logger.info(
    {
      ip: getClientIPAddress(request),
      email,
    },
    "Password reset requested",
  );

  return data({ result: submission.reply(), sentTo: email });
};

export const meta: Route.MetaFunction = ({ matches }) => [
  { title: textFromMatches(matches)("auth.forgot.metaTitle") },
];

export default function ForgotPassword({ actionData }: Route.ComponentProps) {
  const sentTo = actionData?.sentTo ?? null;
  const t = useText();
  const schema = useMemo(() => forgotSchema(t), [t]);
  const [form, fields] = useForm({
    lastResult: actionData?.result,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
  });

  if (sentTo) {
    return (
      <AuthStatus
        standalone
        icon={<MailIcon className="size-7" />}
        heading={t("auth.forgot.sentHeading")}
        body={
          <RichText
            text={t("auth.forgot.sentBody")}
            vars={{
              email: (
                <strong className="text-foreground font-semibold">
                  {sentTo}
                </strong>
              ),
            }}
          />
        }
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
        eyebrow: t("auth.forgot.eyebrow"),
        heading: t("auth.forgot.panelHeading"),
        body: t("auth.forgot.panelBody"),
      }}
    >
      <div className="mt-1 flex flex-col gap-2">
        <h1 className="text-3xl leading-tight font-light tracking-tight">
          {t("auth.forgot.title")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t("auth.forgot.intro")}
        </p>
      </div>

      <Form
        method="post"
        className="flex flex-col gap-4"
        {...getFormProps(form)}
      >
        <Field
          labelProps={{ children: t("auth.field.email") }}
          inputProps={{
            ...getInputProps(fields.email, { type: "email" }),
            placeholder: t("auth.field.emailPlaceholder"),
          }}
          errors={fields.email.errors}
        />

        <Button type="submit" size="lg" className="w-full">
          {t("auth.forgot.submit")}
        </Button>

        <p className="text-muted-foreground text-center text-sm">
          <RichText
            text={t("auth.forgot.remembered")}
            tags={{
              link: (children) => (
                <Link
                  to="/login"
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
