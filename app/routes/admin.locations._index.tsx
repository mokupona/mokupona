import { MapPinIcon, PlusIcon } from "lucide-react";
import { Link } from "react-router";

import type { Route } from "./+types/admin.locations._index";

import { AdminDeleteButton } from "~/components/admin-delete-button";
import { AdminEmptyState, AdminPageHeader } from "~/components/admin-ui";
import { buttonVariants } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { getAddressesWithEventCount } from "~/models/address.server";

export async function loader() {
  const addresses = await getAddressesWithEventCount();

  return { addresses };
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin - Locations" }];
};

export default function AdminLocationsPage({
  loaderData,
}: Route.ComponentProps) {
  const { addresses } = loaderData;

  return (
    <div className="animate-page-in">
      <AdminPageHeader
        eyebrow={`${addresses.length} total`}
        title="Locations"
        actions={
          <Link to="new" className={buttonVariants()}>
            <PlusIcon className="size-4" />
            New location
          </Link>
        }
      />

      {addresses.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {addresses.map((address) => (
            <LocationCard key={address.id} address={address} />
          ))}
        </div>
      ) : (
        <AdminEmptyState
          icon={<MapPinIcon className="size-6" />}
          title="No locations yet"
          description="Add the first venue address so events have somewhere to happen."
          action={
            <Link to="new" className={buttonVariants()}>
              New location
            </Link>
          }
        />
      )}
    </div>
  );
}

type AddressWithEventCount = Awaited<
  ReturnType<typeof loader>
>["addresses"][number];

function LocationCard({ address }: { address: AddressWithEventCount }) {
  const { id, streetName, houseNumber, zip, city, eventCount } = address;
  const inUse = eventCount > 0;

  return (
    <Card interactive className="p-4">
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-lg">
          <MapPinIcon className="text-primary size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold">
            {streetName} {houseNumber}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {zip} {city}
          </p>
        </div>
      </div>
      <div className="mt-4 flex gap-2 border-t pt-4">
        <Link
          to={`${id}/edit`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Edit
        </Link>
        <AdminDeleteButton action={`${id}/delete`} disabled={inUse} />
        {inUse ? (
          <span className="text-muted-foreground self-center text-xs">
            hosts {eventCount} {eventCount === 1 ? "event" : "events"}
          </span>
        ) : null}
      </div>
    </Card>
  );
}
