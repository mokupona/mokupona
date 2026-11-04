import { redirect } from "react-router";

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
          },
          createdById: user.id,
        },
        builderRowsToDescriptors(signupForm),
      );

      return redirect(`/admin/events/${event.id}`);
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
