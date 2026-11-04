import { redirect } from "react-router";

import type { Route } from "./+types/admin.volunteers.$volunteerId.delete";

import { destroyImages } from "~/features/images/image-storage.server";
import { deleteVolunteer } from "~/models/volunteer.server";

export async function loader() {
  return redirect("/admin/volunteers");
}

export async function action({ params }: Route.ActionArgs) {
  const { volunteerId } = params;
  const { imageKey } = await deleteVolunteer(volunteerId);
  await destroyImages([imageKey]);
  return redirect("/admin/volunteers");
}
