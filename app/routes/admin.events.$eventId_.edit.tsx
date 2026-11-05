import { redirect } from "react-router";

import type { Route } from "./+types/admin.events.$eventId_.edit";

import { userContext } from "~/features/auth/middleware.server";
import { AdminEventRouteForm } from "~/features/events/components/admin-event-route-form";
import { EventEditSchema } from "~/features/events/event-schema";
import {
  toDisplayEventDate,
  toUtcEventDate,
} from "~/features/events/event-timezone.server";
import { toAddressOptions } from "~/features/events/view-models";
import { parseStoredFormSchemaOrLog } from "~/features/forms/serialization.server";
import { withParsedImageForm } from "~/features/images/image-form-action.server";
import {
  destroyImages,
  storeImage,
} from "~/features/images/image-storage.server";
import {
  builderRowsToDescriptors,
  defaultBuilderRows,
  descriptorsToBuilderRows,
  syncChangedFieldKeys,
} from "~/features/signup-form/builder";
import { getAnswerCountsByFieldKey } from "~/features/signup-form/read.server";
import { requestLogger } from "~/logger/request-context.server";
import { getAddresses } from "~/models/address.server";
import {
  getEventWithCurrentFormVersion,
  updateEvent,
} from "~/models/event.server";
import { setImageCrop } from "~/models/image.server";
import { requireFound } from "~/shared/http.server";
import { cropColumns } from "~/shared/image-crop";
import { nullableStringUpdateValue } from "~/utils/nullable-update-field.server";

export async function loader({ params }: Route.LoaderArgs) {
  const { eventId } = params;

  const [addresses, eventWithVersion, answerData] = await Promise.all([
    getAddresses(),
    getEventWithCurrentFormVersion(eventId).then(requireFound),
    getAnswerCountsByFieldKey(eventId),
  ]);
  const { event, version } = eventWithVersion;
  const { counts: answerCounts, hasResponses: formHasSubmissions } = answerData;

  const storedFields = parseStoredFormSchemaOrLog(version);

  return {
    addresses,
    formHasSubmissions,
    answerCounts,
    signupForm: storedFields
      ? descriptorsToBuilderRows(storedFields)
      : defaultBuilderRows(),
    event: {
      ...event,
      date: toDisplayEventDate(event.date),
    },
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const user = context.get(userContext);

  const { eventId } = params;

  return withParsedImageForm(request, {
    fieldName: "cover",
    schema: EventEditSchema,
    async onSuccess({ value, formData }) {
      const {
        title,
        description,
        date,
        slots,
        price,
        studentDiscount,
        vegetarianDiscount,
        discounts,
        confirmedMailSubject,
        confirmedMailMessage,
        waitlistMailSubject,
        waitlistMailMessage,
        cover,
        coverCrop,
        addressId,
        signupForm,
      } = value;

      const changedKeys = syncChangedFieldKeys(signupForm);
      if (changedKeys.length > 0) {
        requestLogger.warn(
          { event: eventId, fieldKeys: changedKeys },
          "Linked-field sync changed submitted rows before persistence",
        );
      }

      const menuDescriptionUpdateValue = nullableStringUpdateValue({
        formData,
        fieldName: "menuDescription",
      });
      const donationDescriptionUpdateValue = nullableStringUpdateValue({
        formData,
        fieldName: "donationDescription",
      });

      const { event, replacedImageKey } = await updateEvent(
        eventId,
        {
          title,
          description,
          ...(menuDescriptionUpdateValue !== undefined && {
            menuDescription: menuDescriptionUpdateValue,
          }),
          ...(donationDescriptionUpdateValue !== undefined && {
            donationDescription: donationDescriptionUpdateValue,
          }),
          date: toUtcEventDate(date),
          slots,
          price,
          // the form always sends these, so an empty field means "clear it"
          studentDiscount: studentDiscount ?? null,
          vegetarianDiscount: vegetarianDiscount ?? null,
          // a draft's form offers "Save & publish"; otherwise the
          // published state is left as it is
          ...(formData.get("intent") === "publish" && { published: true }),
          discounts,
          confirmedMailSubject: confirmedMailSubject ?? null,
          confirmedMailMessage: confirmedMailMessage ?? null,
          waitlistMailSubject: waitlistMailSubject ?? null,
          waitlistMailMessage: waitlistMailMessage ?? null,
          addressId,
          ...(cover && {
            image: {
              contentType: cover.type,
              ...(await storeImage(cover, "events")),
              ...cropColumns(coverCrop ?? null),
            },
          }),
          createdById: user.id,
        },
        builderRowsToDescriptors(signupForm),
      );

      await destroyImages([replacedImageKey]);

      // the current cover, framed anew without a new file
      if (!cover && coverCrop !== undefined && event.imageId) {
        await setImageCrop(event.imageId, coverCrop);
      }

      return redirect(`/admin/events/${event.id}`);
    },
  });
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  return [
    {
      title: loaderData
        ? `Admin - Event - ${loaderData.event.title} - Edit`
        : "Admin - Event - Edit",
    },
  ];
};

export default function AdminEventEditPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { addresses, event, signupForm, formHasSubmissions, answerCounts } =
    loaderData;
  const addressOptions = toAddressOptions(addresses);

  return (
    <AdminEventRouteForm
      schema={EventEditSchema}
      lastResult={actionData}
      defaultValue={{ ...event, signupForm }}
      addressOptions={addressOptions}
      // a draft can be saved as it is or published in the same step; a
      // published event just saves
      submitText={event.published ? "Save event" : "Save & publish"}
      draftText={event.published ? undefined : "Save draft"}
      pageTitle={event.published ? "Edit event" : "Edit draft"}
      cancelHref={`/admin/events/${event.id}`}
      lockFieldKeys={formHasSubmissions}
      answerCounts={answerCounts}
      currentImage={event.image}
    />
  );
}
