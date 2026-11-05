import type { Route } from "./+types/admin.events.new";

import { userContext } from "~/features/auth/middleware.server";
import { AdminEventRouteForm } from "~/features/events/components/admin-event-route-form";
import { EventSchema } from "~/features/events/event-schema";
import { toUtcEventDate } from "~/features/events/event-timezone.server";
import { toAddressOptions } from "~/features/events/view-models";
import { withParsedImageForm } from "~/features/images/image-form-action.server";
import { storeImage } from "~/features/images/image-storage.server";
import {
  builderRowsToDescriptors,
  defaultBuilderRows,
  syncChangedFieldKeys,
} from "~/features/signup-form/builder";
import { requestLogger } from "~/logger/request-context.server";
import { getAddresses } from "~/models/address.server";
import { createEvent } from "~/models/event.server";
import { cropColumns } from "~/shared/image-crop";
import { redirectWithToast } from "~/utils/toast.server";

export async function loader() {
  const addresses = await getAddresses();

  return { addresses };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);

  return withParsedImageForm(request, {
    fieldName: "cover",
    schema: EventSchema,
    async onSuccess({ value }) {
      const {
        title,
        description,
        menuDescription,
        donationDescription,
        date,
        slots,
        price,
        studentPrice,
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
          { fieldKeys: changedKeys },
          "Linked-field sync changed submitted rows before persistence",
        );
      }

      const event = await createEvent(
        {
          title,
          description,
          menuDescription,
          donationDescription,
          date: toUtcEventDate(date),
          slots,
          price,
          studentPrice,
          discounts,
          confirmedMailSubject,
          confirmedMailMessage,
          waitlistMailSubject,
          waitlistMailMessage,
          addressId,
          image: {
            contentType: cover.type,
            ...(await storeImage(cover, "events")),
            ...cropColumns(coverCrop ?? null),
          },
          createdById: user.id,
        },
        builderRowsToDescriptors(signupForm),
      );

      return redirectWithToast(`/admin/events/${event.id}`, {
        title: "Event created",
        description: "Its QR code is ready to copy or download.",
        type: "success",
      });
    },
  });
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin - Create Event" }];
};

export default function AdminEventNewPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { addresses } = loaderData;
  const addressOptions = toAddressOptions(addresses);

  return (
    <AdminEventRouteForm
      schema={EventSchema}
      lastResult={actionData}
      defaultValue={{ signupForm: defaultBuilderRows() }}
      addressOptions={addressOptions}
      submitText="Save event"
      pageTitle="New event"
      cancelHref="/admin/events"
    />
  );
}
