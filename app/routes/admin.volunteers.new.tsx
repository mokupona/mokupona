import { redirect, useLocation } from "react-router";

import type { Route } from "./+types/admin.volunteers.new";

import { withParsedImageForm } from "~/features/images/image-form-action.server";
import { storeImage } from "~/features/images/image-storage.server";
import { AdminVolunteerForm } from "~/features/volunteers/admin-volunteer-form";
import { VolunteerSchema } from "~/features/volunteers/schema";
import { createVolunteer } from "~/models/volunteer.server";

export async function action({ request }: Route.ActionArgs) {
  return withParsedImageForm(request, {
    fieldName: "image",
    schema: VolunteerSchema,
    async onSuccess({ value }) {
      const { name, role, bio, image } = value;

      await createVolunteer({
        name,
        role,
        bio,
        ...(image && {
          image: {
            contentType: image.type,
            ...(await storeImage(image, "volunteers")),
          },
        }),
      });

      return redirect("/admin/volunteers/new");
    },
  });
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin - Create Volunteer" }];
};

export default function VolunteerNewRoute({
  actionData,
}: Route.ComponentProps) {
  const location = useLocation();

  return (
    <AdminVolunteerForm
      key={location.key}
      lastResult={actionData}
      heading="Add a volunteer"
      description="This will add a new volunteer. Careful, information entered here will be displayed on the website."
      submitText="Add new volunteer"
    />
  );
}
