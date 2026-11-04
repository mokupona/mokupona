import type { Route } from "./+types/_index";

import type { RouteHandle } from "~/root";

import {
  TextSectionBlockView,
  type TextSectionBlockType,
} from "~/features/cms/blocks/text-section";
import {
  TitleCardBlockView,
  type TitleCardBlockType,
} from "~/features/cms/blocks/title-card";
import { LandingDinnersSection } from "~/features/events/components/landing-dinners-section";
import {
  orderEventsByStatus,
  partitionEvents,
} from "~/features/events/event-status";
import { toEventCardModel } from "~/features/events/view-models";
import { textFromMatches } from "~/features/site-text/meta";
import { useText } from "~/features/site-text/site-text-context";
import { getEventsWithAddress } from "~/models/event.server";
import { getImageUrl } from "~/shared/image";
import { withOpenGraphUrls } from "~/shared/meta";
import { getImageConfig } from "~/shared/root-data";

const HERO_IMAGE_ID = "static/hero-image";
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

/** Three past dinners, then a "see more" tile fills the fourth slot. */
const PAST_DINNERS_ON_LANDING = 3;

export const handle: RouteHandle = { glyphs: "full", hideHeaderAtTop: true };

export const loader = async () => {
  const events = await getEventsWithAddress();

  return { events: events.map(toEventCardModel) };
};

export const meta: Route.MetaFunction = ({ matches, location }) => {
  const t = textFromMatches(matches);
  const metaTags = [
    { title: t("landing.meta.title") },
    { name: "description", content: t("landing.meta.description") },
  ] satisfies ReturnType<Route.MetaFunction>;

  const tags = [
    ...metaTags,
    { property: "og:title", content: metaTags[0].title },
    { property: "og:type", content: "website" },
  ];

  const ogImageUrl = getImageUrl(
    { storageKey: HERO_IMAGE_ID },
    getImageConfig(matches),
    { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT },
  );

  return withOpenGraphUrls(tags, {
    matches,
    imagePath: ogImageUrl || undefined,
    pagePath: location.pathname,
  });
};

export default function Index({ loaderData }: Route.ComponentProps) {
  const { events } = loaderData;
  const t = useText();

  const titleCardData: TitleCardBlockType = {
    type: "title-card",
    version: 1,
    data: {
      title: t("landing.titleCard.title"),
      // hand-drawn wordmark; `title` above is its alt text
      logo: { src: "/naive-title.svg?v=alpha", width: 1258, height: 368 },
      scrollTo: "#vision",
    },
  };

  const visionSectionData: TextSectionBlockType = {
    type: "text-section",
    version: 1,
    data: {
      // the drawn heading's words are a site text of their own
      eyebrowHandwritten: "ourVision",
      headline: t("landing.vision.headline"),
      body: t("landing.vision.body"),
      variant: "plain",
    },
  };

  const now = new Date();
  const { upcoming, past } = partitionEvents(events, now);
  const orderedPast = orderEventsByStatus(past, now);
  const pastDinners = orderedPast.slice(0, PAST_DINNERS_ON_LANDING);

  return (
    // text sits over the glyph backdrop, so give it a halo of frosted paper
    <main className="[&_:is(h1,h2,h3,p)]:text-halo [&_a[href^='#']]:text-halo">
      {/* no header at the top of this page (it slides in on scroll), so the
          title card gets the whole first screen */}
      <TitleCardBlockView blockData={titleCardData} className="min-h-svh" />

      <TextSectionBlockView id="vision" blockData={visionSectionData} />

      <LandingDinnersSection
        upcoming={upcoming}
        past={pastDinners}
        hasMore={orderedPast.length > pastDinners.length}
      />
    </main>
  );
}
