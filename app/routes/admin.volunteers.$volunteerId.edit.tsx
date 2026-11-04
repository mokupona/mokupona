import { Link, redirect, useLocation } from "react-router";

import type { Route } from "./+types/admin.volunteers.$volunteerId.edit";

import { withParsedImageForm } from "~/features/images/image-form-action.server";
import {
  destroyImages,
  storeImage,
} from "~/features/images/image-storage.server";
import { AdminVolunteerForm } from "~/features/volunteers/admin-volunteer-form";
import { VolunteerSchema } from "~/features/volunteers/schema";
import { getVolunteerById, updateVolunteer } from "~/models/volunteer.server";
import { requireFound } from "~/shared/http.server";

export async function loader({ params }: Route.LoaderArgs) {
  const { volunteerId } = params;

  const volunteer = requireFound(await getVolunteerById(volunteerId));

  return { volunteer };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { volunteerId } = params;

  return withParsedImageForm(request, {
    fieldName: "image",
    schema: VolunteerSchema,
    async onSuccess({ value }) {
      const { name, role, bio, image } = value;

      const { replacedImageKey } = await updateVolunteer(volunteerId, {
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

      await destroyImages([replacedImageKey]);

      return redirect("/admin/volunteers");
    },
  });
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  return [
    {
      title: loaderData
        ? `Admin - Volunteer - ${loaderData.volunteer.name} - Edit`
        : "Admin - Volunteer - Edit",
    },
  ];
};

export default function VolunteerEditRoute({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const location = useLocation();

  return (
    <AdminVolunteerForm
      key={location.key}
      lastResult={actionData}
      defaultValue={{
        name: loaderData.volunteer.name,
        role: loaderData.volunteer.role ?? "",
        bio: loaderData.volunteer.bio ?? "",
      }}
      heading={
        <>
          Edit <span className="text-primary">{loaderData.volunteer.name}</span>
        </>
      }
      description={
        <>
          Or{" "}
          <Link to="/admin/volunteers/new" className="underline">
            add a new one
          </Link>
        </>
      }
      submitText={`Update ${loaderData.volunteer.name}`}
    />
  );
}
