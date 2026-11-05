import {
  getFormProps,
  getInputProps,
  getTextareaProps,
  useForm,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { useMemo, useState, type ReactNode } from "react";
import { data, useFetcher } from "react-router";

import type { Route } from "./+types/about";

import { ErrorList, Field, TextareaField } from "~/components/forms";
import { HandDrawnRule } from "~/components/hand-drawn";
import { PersonGrid } from "~/components/person-card";
import { RouteErrorContent } from "~/components/route-error-content";
import {
  Eyebrow,
  PageContainer,
  pageTitleClassName,
  SectionDivider,
} from "~/components/section";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { requestLoggerContext } from "~/features/auth/middleware.server";
import { HoneypotField } from "~/features/forms/honeypot-field";
import { checkHoneypot } from "~/features/forms/honeypot.server";
import { sendTemplate } from "~/features/mail/mail.server";
import { textFromMatches } from "~/features/site-text/meta";
import { RichText, type RichTextTags } from "~/features/site-text/rich-text";
import { useText } from "~/features/site-text/site-text-context";
import { getText } from "~/features/site-text/site-text.server";
import {
  createVolunteerSignupSchema,
  VOLUNTEER_INBOX,
} from "~/features/volunteers/schema";
import { cn } from "~/lib/utils";
import { listBoardMembers } from "~/models/board-member.server";
import { listVolunteers } from "~/models/volunteer.server";
import { getClientIPAddress } from "~/shared/http.server";

const TOKI_PONA_URL = "https://tokipona.org";

export async function loader() {
  const [boardMembers, volunteers] = await Promise.all([
    listBoardMembers(),
    listVolunteers(),
  ]);

  return {
    boardMembers: boardMembers.map(({ position, ...member }) => ({
      ...member,
      subtitle: position,
    })),
    volunteers: volunteers.map(({ role, ...volunteer }) => ({
      ...volunteer,
      subtitle: role,
    })),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const logger = context.get(requestLoggerContext);
  const formData = await request.formData();

  // a caught bot is told it worked, so it has nothing to learn from
  const honeypot = checkHoneypot(formData);
  if (honeypot.outcome === "trapped") {
    logger.warn(
      { ip: getClientIPAddress(request), reason: honeypot.reason },
      "Blocked volunteer sign-up caught by the spam trap",
    );
    return { status: "sent" as const };
  }

  const t = await getText();
  const submission = parseWithZod(formData, {
    schema: createVolunteerSignupSchema(t),
  });

  if (honeypot.outcome === "unverified") {
    logger.info(
      { ip: getClientIPAddress(request), reason: honeypot.reason },
      "Rejected volunteer sign-up with an unverifiable spam-trap stamp",
    );
    return data(submission.reply({ formErrors: [t("site.forms.retry")] }), {
      status: 400,
    });
  }

  if (submission.status !== "success") {
    return data(submission.reply(), { status: 400 });
  }

  const { name, email, message } = submission.value;

  try {
    await sendTemplate(
      "volunteerInterest",
      VOLUNTEER_INBOX,
      { name, email, message },
      { replyTo: email },
    );
  } catch {
    // sendTemplate has already logged the failure
    return data(
      submission.reply({
        formErrors: [t("about.signup.failed", { email: VOLUNTEER_INBOX })],
      }),
      { status: 500 },
    );
  }

  return { status: "sent" as const };
}

export const meta: Route.MetaFunction = ({ matches }) => {
  const t = textFromMatches(matches);
  return [
    { title: t("about.meta.title") },
    { name: "description", content: t("about.meta.description") },
  ];
};

export default function AboutPage({ loaderData }: Route.ComponentProps) {
  const { boardMembers, volunteers } = loaderData;
  const t = useText();
  const [signupOpen, setSignupOpen] = useState(false);
  const openSignup = () => setSignupOpen(true);
  const volunteersBody = t("about.volunteers.body");

  return (
    <main className="grow pt-14 pb-32 md:pt-20">
      <PageContainer as="div">
        <div className="flex flex-col gap-4">
          <Eyebrow variant="tracked" tone="primary">
            {t("about.eyebrow")}
          </Eyebrow>
          <h1 className={pageTitleClassName}>{t("about.title")}</h1>
          <p className="text-muted-foreground max-w-2xl text-base font-light whitespace-pre-line md:text-lg">
            {t("about.intro")}
          </p>
        </div>
      </PageContainer>

      <StorySection
        eyebrow={t("about.story.eyebrow")}
        headline={t("about.story.headline")}
      >
        <Paragraphs text={t("about.story.body")} />
      </StorySection>

      <FeatureSection
        eyebrow={t("about.why.eyebrow")}
        headline={t("about.why.headline")}
      >
        <Paragraphs text={t("about.why.body")} />
      </FeatureSection>

      <StorySection
        eyebrow={t("about.name.eyebrow")}
        headline={t("about.name.headline")}
      >
        <Paragraphs
          text={t("about.name.body")}
          tags={{
            link: (children) => (
              <a
                href={TOKI_PONA_URL}
                target="_blank"
                rel="noreferrer"
                className="text-foreground decoration-foreground/40 hover:decoration-foreground underline underline-offset-4 transition-colors"
              >
                {children}
              </a>
            ),
          }}
        />
      </StorySection>

      <StorySection
        eyebrow={t("about.what.eyebrow")}
        headline={t("about.what.headline")}
      >
        <Paragraphs text={t("about.what.body")} />
      </StorySection>

      <PageContainer as="section" className="pt-8 md:pt-12">
        <SectionDivider className="mb-8">
          {t("about.team.heading")}
        </SectionDivider>

        <div className="mb-14 flex max-w-2xl flex-col gap-5">
          <p className="text-muted-foreground text-base font-light whitespace-pre-line md:text-lg">
            {t("about.team.body")}
          </p>
          <Button className="w-fit" onClick={openSignup}>
            {t("about.team.button")}
          </Button>
        </div>

        <h2 className="mb-6 text-xl font-light tracking-tight md:text-2xl">
          {t("about.hallOfFame")}
        </h2>
        {boardMembers.length > 0 ? (
          <PersonGrid people={boardMembers} />
        ) : (
          <p className="text-muted-foreground max-w-md text-base font-light whitespace-pre-line md:text-lg">
            {t("about.hallEmpty")}
          </p>
        )}

        {volunteers.length > 0 ? (
          <div className="mt-16">
            <h2 className="mb-3 text-xl font-light tracking-tight md:text-2xl">
              {t("about.volunteers.heading")}
            </h2>
            {volunteersBody ? (
              <p className="text-muted-foreground mb-8 max-w-2xl text-base font-light whitespace-pre-line md:text-lg">
                {volunteersBody}
              </p>
            ) : null}
            <PersonGrid people={volunteers} />
          </div>
        ) : null}
      </PageContainer>

      <FeatureSection
        eyebrow={t("about.join.eyebrow")}
        headline={t("about.join.headline")}
        className="pb-0 md:pb-0"
      >
        <p className="whitespace-pre-line">{t("about.join.body")}</p>
        <Button size="lg" className="w-fit" onClick={openSignup}>
          {t("about.join.button")}
        </Button>
      </FeatureSection>

      <VolunteerSignupDialog open={signupOpen} onOpenChange={setSignupOpen} />
    </main>
  );
}

/** Splits a text on blank lines, so admins can write several paragraphs. */
function Paragraphs({ text, tags }: { text: string; tags?: RichTextTags }) {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph, index) => (
      <p key={index} className="whitespace-pre-line">
        <RichText text={paragraph} tags={tags} />
      </p>
    ));
}

/** Heading on the left, story on the right — the page's main rhythm. */
function StorySection({
  eyebrow,
  headline,
  children,
}: {
  eyebrow: string;
  headline: string;
  children: ReactNode;
}) {
  return (
    <PageContainer as="section">
      <div className="grid items-start gap-3 py-14 md:grid-cols-[1fr_1.2fr] md:gap-12 md:py-24">
        <div className="flex flex-col gap-3 md:gap-4">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="text-2xl leading-tight font-light tracking-tight md:text-3xl">
            {headline}
          </h2>
        </div>
        <div className="text-muted-foreground flex flex-col gap-4 text-base font-light md:text-lg">
          {children}
        </div>
      </div>
    </PageContainer>
  );
}

/** A single wide column with a larger headline, for the page's big moments. */
function FeatureSection({
  eyebrow,
  headline,
  className,
  children,
}: {
  eyebrow: string;
  headline: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <PageContainer as="section">
      <div
        className={cn(
          "flex max-w-3xl flex-col gap-5 py-16 md:gap-6 md:py-28",
          className,
        )}
      >
        <HandDrawnRule className="text-crayon/45 w-32" />
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="text-3xl leading-tight font-light tracking-tight text-balance md:text-4xl">
          {headline}
        </h2>
        <div className="text-muted-foreground flex flex-col gap-5 text-lg font-light md:text-xl">
          {children}
        </div>
      </div>
    </PageContainer>
  );
}

type SignupFetcher = ReturnType<typeof useFetcher<typeof action>>;
type SignupResult = NonNullable<SignupFetcher["data"]>;

function isSent(
  result: SignupResult | undefined,
): result is { status: "sent" } {
  return result !== undefined && "status" in result && result.status === "sent";
}

function VolunteerSignupDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useText();
  const fetcher = useFetcher<typeof action>();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {isSent(fetcher.data) ? (
          <>
            <DialogTitle>{t("about.signup.sentTitle")}</DialogTitle>
            <DialogDescription className="text-base font-light whitespace-pre-line">
              {t("about.signup.sentBody")}
            </DialogDescription>
            <Button className="w-fit" onClick={() => onOpenChange(false)}>
              {t("about.signup.close")}
            </Button>
          </>
        ) : (
          <>
            <DialogTitle>{t("about.signup.title")}</DialogTitle>
            <DialogDescription className="whitespace-pre-line">
              {t("about.signup.description")}
            </DialogDescription>
            <VolunteerSignupForm fetcher={fetcher} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function VolunteerSignupForm({ fetcher }: { fetcher: SignupFetcher }) {
  const t = useText();
  const schema = useMemo(() => createVolunteerSignupSchema(t), [t]);
  const lastResult =
    fetcher.data && !isSent(fetcher.data) ? fetcher.data : undefined;

  const [form, fields] = useForm({
    lastResult,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
  });

  return (
    <fetcher.Form
      method="POST"
      className="flex flex-col gap-5"
      {...getFormProps(form)}
    >
      <HoneypotField />

      <Field
        labelProps={{ children: t("about.signup.name") }}
        inputProps={{
          ...getInputProps(fields.name, { type: "text" }),
          autoComplete: "name",
        }}
        errors={fields.name.errors}
      />

      <Field
        labelProps={{ children: t("about.signup.email") }}
        inputProps={{
          ...getInputProps(fields.email, { type: "email" }),
          autoComplete: "email",
        }}
        errors={fields.email.errors}
      />

      <TextareaField
        labelProps={{ children: t("about.signup.message") }}
        description={t("about.signup.messageHint")}
        textareaProps={{ ...getTextareaProps(fields.message), rows: 3 }}
        errors={fields.message.errors}
      />

      <ErrorList id={form.errorId} errors={form.errors} />

      <Button type="submit" disabled={fetcher.state !== "idle"}>
        {fetcher.state === "idle"
          ? t("about.signup.submit")
          : t("about.signup.sending")}
      </Button>
    </fetcher.Form>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <PageContainer className="grow pt-14 pb-32 md:pt-20">
      <RouteErrorContent error={error} />
    </PageContainer>
  );
}
