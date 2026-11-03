import { redirect } from "react-router";

import type { Route } from "./+types/events_.$eventId_.gallery";

import { RouteErrorContent } from "~/components/route-error-content";
import {
  BackLink,
  Eyebrow,
  PageContainer,
  pageTitleClassName,
} from "~/components/section";
import { formatEventDateLine } from "~/features/events/date-format";
import { isPastEvent } from "~/features/events/event-status";
import { listGalleryImagesForEvent } from "~/features/gallery/gallery.server";
import { MosaicGallery } from "~/features/gallery/layouts/mosaic";
import { getEventById } from "~/models/event.server";
import { requireFound } from "~/shared/http.server";

export async function loader({ params }: Route.LoaderArgs) {
  const { eventId } = params;
  const event = requireFound(await getEventById(eventId));

  // An upcoming event has no album to show, and neither does a past one
  // nobody photographed — send both to the event itself rather than
  // presenting an empty room.
  if (!isPastEvent(event.date, new Date())) {
    throw redirect(`/events/${event.id}`);
  }

  const images = await listGalleryImagesForEvent(event.id);
  if (images.length === 0) {
    throw redirect(`/events/${event.id}`);
  }

  return {
    event: {
      id: event.id,
      title: event.title,
      description: event.description,
      date: event.date,
    },
    images,
  };
}

export const meta: Route.MetaFunction = ({ loaderData }) => [
  { title: loaderData ? `${loaderData.event.title} — gallery` : "Gallery" },
];

export default function EventGalleryPage({
  loaderData,
}: Route.ComponentProps) {
  const { event, images } = loaderData;
  const date = new Date(event.date);

  return (
    <PageContainer className="grow pt-14 pb-32 md:pt-20">
      <BackLink to="/gallery">all galleries</BackLink>

      <div className="mb-14 flex flex-col gap-4 md:mb-20">
        <Eyebrow variant="tracked" tone="primary">
          <time dateTime={date.toISOString()} suppressHydrationWarning>
            {formatEventDateLine(date, "long")}
          </time>
        </Eyebrow>
        <h1 className={pageTitleClassName}>{event.title}</h1>
        <p className="text-muted-foreground max-w-2xl text-base font-light md:text-lg">
          {event.description}
        </p>
      </div>

      <MosaicGallery images={images} variant="section" />
    </PageContainer>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <PageContainer className="grow pt-14 pb-32 md:pt-20">
      <RouteErrorContent error={error} />
    </PageContainer>
  );
}
