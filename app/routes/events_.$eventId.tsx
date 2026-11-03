import {
  FormProvider,
  getFormProps,
  getInputProps,
  useForm,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { useMemo } from "react";
import { Form, Link } from "react-router";

import type { Route } from "./+types/events_.$eventId";

import { CheckboxField, ErrorList } from "~/components/forms";
import { RouteErrorContent } from "~/components/route-error-content";
import { BackLink, PageContainer } from "~/components/section";
import { Button } from "~/components/ui/button";
import { requestLoggerContext } from "~/features/auth/middleware.server";
import {
  EventFactList,
  EventStory,
} from "~/features/events/components/event-view";
import { isPastEvent } from "~/features/events/event-status";
import { toEventDetailModel } from "~/features/events/view-models";
import { getViewForField, type FieldDescriptor } from "~/features/forms/fields";
import { HONEYPOT_RETRY_MESSAGE } from "~/features/forms/honeypot";
import { HoneypotField } from "~/features/forms/honeypot-field";
import { checkHoneypot } from "~/features/forms/honeypot.server";
import { normalizeSubmissionValues } from "~/features/forms/normalize-submission";
import { parseStoredFormSchemaOrLog } from "~/features/forms/serialization.server";
import { EventGallerySection } from "~/features/gallery/components/event-gallery-section";
import { loadEventGallerySection } from "~/features/gallery/event-section.server";
import { buildSignupSchema } from "~/features/signup-form/build-schema";
import { sendSignupConfirmation } from "~/features/signup-form/confirmation-mail.server";
import { partySize, seatsLeft } from "~/features/signup-form/signup-status";
import { cn } from "~/lib/utils";
import {
  createEventSignup,
  DuplicateSignupError,
  getSeatCounts,
} from "~/models/event-signup.server";
import { getEventWithCurrentFormVersion } from "~/models/event.server";
import { FormVersionChangedError } from "~/models/form-submission.server";
import {
  getClientIPAddress,
  getDomainUrl,
  requireFound,
} from "~/shared/http.server";
import { getImageUrl } from "~/shared/image";
import { withOpenGraphUrls } from "~/shared/meta";
import { getImageConfig } from "~/shared/root-data";
import { redirectWithToast } from "~/utils/toast.server";

export async function loader({ params }: Route.LoaderArgs) {
  const { eventId } = params;

  const { event, version } = requireFound(
    await getEventWithCurrentFormVersion(eventId),
  );

  // the gallery belongs to evenings that already happened; upcoming events
  // pay nothing for it, and only they need the seat count
  const isPast = isPastEvent(event.date, new Date());
  const [gallery, seats] = await Promise.all([
    isPast ? loadEventGallerySection(event.id) : null,
    isPast ? null : getSeatCounts(event.id),
  ]);

  return {
    event: toEventDetailModel(event),
    formFields: parseStoredFormSchemaOrLog(version),
    formVersionId: version.id,
    // a snapshot for the page; the action decides again under a lock
    seatsLeft: seats ? seatsLeft(event.slots, seats.confirmed) : null,
    gallery,
  };
}

const FORM_CHANGED_ERROR =
  "The signup form was updated while you were filling it out. Please review your answers and submit again.";

const DUPLICATE_SIGNUP_ERROR =
  "This email address is already signed up for this event. If you'd like to change your signup, please get in touch with us.";

// also the spam-trap response, which must look like a real success
const CONFIRMED_TOAST = {
  title: "You're in!",
  description: "Your seat is confirmed. We've emailed you the details.",
  type: "success",
} as const;

const WAITLISTED_TOAST = {
  title: "You're on the waiting list",
  description:
    "There weren't enough seats left. We've emailed you the details and will let you know as soon as a seat is yours.",
  type: "message",
} as const;

export async function action({ params, request, context }: Route.ActionArgs) {
  const { eventId } = params;
  const logger = context.get(requestLoggerContext);

  const { event, version } = requireFound(
    await getEventWithCurrentFormVersion(eventId),
  );

  if (isPastEvent(event.date, new Date())) {
    throw new Response("Forbidden", { status: 403 });
  }

  const formFields = parseStoredFormSchemaOrLog(version);

  if (!formFields) {
    throw new Response("Internal Server Error", { status: 500 });
  }

  const schema = buildSignupSchema(formFields);
  const formData = await request.formData();

  // Answered with the success path's toast redirect: a caught bot must not
  // learn it was caught, so nothing is validated or stored.
  const honeypot = checkHoneypot(formData);
  if (honeypot.outcome === "trapped") {
    logger.warn(
      {
        ip: getClientIPAddress(request),
        event: event.id,
        reason: honeypot.reason,
      },
      "Blocked event signup caught by the spam trap",
    );

    return redirectWithToast("/events", CONFIRMED_TOAST);
  }

  const submission = parseWithZod(formData, { schema });

  if (honeypot.outcome === "unverified") {
    logger.info(
      {
        ip: getClientIPAddress(request),
        event: event.id,
        reason: honeypot.reason,
      },
      "Rejected event signup with an unverifiable spam-trap stamp",
    );

    return submission.reply({ formErrors: [HONEYPOT_RETRY_MESSAGE] });
  }

  if (formData.get("formVersionId") !== version.id) {
    logger.info(
      {
        event: event.id,
        submittedVersion: formData.get("formVersionId"),
        currentVersion: version.id,
      },
      "Event signup submitted against an outdated form version",
    );

    return submission.reply({ formErrors: [FORM_CHANGED_ERROR] });
  }

  if (submission.status !== "success" || !submission.value) {
    logger.info(
      {
        ip: getClientIPAddress(request),
        event: event.id,
        email:
          submission.payload["email"]?.toString() ?? "unknown@no-domain.com",
        reason: submission.status === "error" ? submission.error : null,
      },
      "Failed submission for event signup",
    );

    return submission.reply();
  }

  const { acceptedPrivacy: _acceptedPrivacy, ...values } = submission.value;
  const answers = normalizeSubmissionValues(formFields, values);

  const email =
    typeof values.email === "string" ? values.email : "unknown@no-domain.com";

  let signup: Awaited<ReturnType<typeof createEventSignup>>;
  try {
    signup = await createEventSignup({
      eventId: event.id,
      formVersionId: version.id,
      expectedVersionUpdatedAt: version.updatedAt,
      answers,
      email,
    });
  } catch (reason) {
    if (reason instanceof DuplicateSignupError) {
      logger.info(
        { ip: getClientIPAddress(request), event: event.id, email },
        "Rejected a second event signup from the same email",
      );

      return submission.reply({ formErrors: [DUPLICATE_SIGNUP_ERROR] });
    }

    if (reason instanceof FormVersionChangedError) {
      logger.warn(
        {
          event: event.id,
          formVersion: version.id,
        },
        "Event signup raced an in-place form update",
      );

      return submission.reply({ formErrors: [FORM_CHANGED_ERROR] });
    }

    logger.error(
      {
        ip: getClientIPAddress(request),
        event: event.id,
        email,
        error: reason,
      },
      "Failed to persist event signup",
    );

    return submission.reply({
      formErrors: ["Your signup could not be saved. Please try again."],
    });
  }

  logger.info(
    {
      ip: getClientIPAddress(request),
      event: event.id,
      email,
      status: signup.status,
      seats: signup.seats,
    },
    "Successful submission for event signup",
  );

  if (typeof values.email === "string") {
    try {
      await sendSignupConfirmation({
        to: values.email,
        status: signup.status,
        event,
        formFields,
        answers,
        origin: getDomainUrl(request),
      });
    } catch (error) {
      // the signup is stored, so the guest still sees the success toast
      logger.error(
        { event: event.id, email, error },
        "Failed to send the signup confirmation",
      );
    }
  }

  return redirectWithToast(
    "/events",
    signup.status === "confirmed" ? CONFIRMED_TOAST : WAITLISTED_TOAST,
  );
}

export const meta: Route.MetaFunction = ({ loaderData, matches, location }) => {
  const metaTags = [
    {
      title: "Event",
    },
  ];

  if (!loaderData) return metaTags;

  const { event } = loaderData;
  const tags = [
    { title: `Event - ${event.title}` },
    { property: "og:title", content: event.title },
    { property: "og:type", content: "website" },
  ];

  return withOpenGraphUrls(tags, {
    matches,
    imagePath: event.image
      ? getImageUrl(event.image, getImageConfig(matches))
      : undefined,
    pagePath: location.pathname,
  });
};

export default function EventPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { event, formFields, formVersionId, seatsLeft, gallery } = loaderData;

  const eventIsPast = isPastEvent(new Date(event.date), new Date());
  const signupFields = eventIsPast ? null : formFields;
  const gridClasses = cn(
    "grid items-start gap-8",
    !eventIsPast && "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]",
  );

  return (
    <PageContainer className="grow pt-7 pb-20">
      <BackLink to="/events" className="mb-6">
        all events
      </BackLink>

      <div className={gridClasses}>
        <EventStory event={event} />

        {signupFields ? (
          // no fill — a single rule separates the sidebar from the story,
          // stacking above it on mobile and beside it from lg up
          <aside
            id="sign-up"
            className="flex flex-col gap-4 border-t pt-8 lg:sticky lg:top-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8"
          >
            <EventFactList event={event} seatsLeft={seatsLeft} />

            <>
              <div aria-hidden className="bg-border h-px" />

              <h2 className="text-xl font-light">reserve your seat</h2>

              <SignupForm
                key={JSON.stringify(signupFields)}
                formFields={signupFields}
                formVersionId={formVersionId}
                seatsLeft={seatsLeft}
                lastResult={actionData}
              />
            </>
          </aside>
        ) : null}
      </div>

      {gallery ? <EventGallerySection {...gallery} /> : null}
    </PageContainer>
  );
}

function SignupForm({
  formFields,
  formVersionId,
  seatsLeft,
  lastResult,
}: {
  formFields: FieldDescriptor[];
  formVersionId: string;
  seatsLeft: number | null;
  lastResult: Route.ComponentProps["actionData"];
}) {
  const schema = useMemo(() => buildSignupSchema(formFields), [formFields]);

  const [form, fields] = useForm({
    lastResult,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
  });

  // the server decides again when the form arrives; this only says what to
  // expect with the seats left when the page loaded
  const party = partySize(form.value ?? {});
  const willWait = seatsLeft !== null && party > seatsLeft;

  return (
    <FormProvider context={form.context}>
      <Form
        method="post"
        {...getFormProps(form)}
        className="flex flex-col gap-3"
      >
        <button type="submit" hidden />

        <input type="hidden" name="formVersionId" value={formVersionId} />

        <HoneypotField />

        {formFields.map((descriptor) => {
          const FieldView = getViewForField(descriptor);

          return (
            <FieldView
              key={descriptor.data.name}
              fieldConfig={descriptor}
              fieldMetadata={fields[descriptor.data.name]}
            />
          );
        })}

        <CheckboxField
          labelProps={{
            children: (
              <span className="text-sm">
                i agree to the{" "}
                <Link to="/privacy" className="text-primary">
                  privacy policy
                </Link>
              </span>
            ),
          }}
          buttonProps={{
            ...getInputProps(fields.acceptedPrivacy, {
              type: "checkbox",
            }),
          }}
          errors={fields.acceptedPrivacy.errors}
        />

        <ErrorList id={form.errorId} errors={form.errors} />

        {willWait && seatsLeft !== null && seatsLeft > 0 ? (
          <p role="status" className="text-primary text-sm leading-normal">
            only {seatsLeft} {seatsLeft === 1 ? "seat" : "seats"} left, so a
            group of {party} goes on the waiting list.
          </p>
        ) : null}

        <Button type="submit" size="lg" className="w-full">
          {willWait ? "join the waiting list" : "join this event"}
        </Button>

        <p className="text-muted-foreground text-center text-xs leading-normal">
          {seatsLeft === 0
            ? "this event is fully booked. we'll email you as soon as a seat is yours."
            : "we'll email you right away whether you have a seat."}
        </p>
      </Form>
    </FormProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <RouteErrorContent error={error} />;
}
