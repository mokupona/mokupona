import type { Route } from "./+types/about";

import { PersonGrid } from "~/components/person-card";
import { RouteErrorContent } from "~/components/route-error-content";
import {
  Eyebrow,
  PageContainer,
  pageTitleClassName,
  SectionDivider,
} from "~/components/section";
import {
  TextSectionBlockView,
  type TextSectionBlockType,
} from "~/features/cms/blocks/text-section";
import { listBoardMembers } from "~/models/board-member.server";
import { listVolunteers } from "~/models/volunteer.server";

export async function loader() {
  const [boardMembers, volunteers] = await Promise.all([
    listBoardMembers(),
    listVolunteers(),
  ]);

  return {
    boardMembers: boardMembers.map(({ position, ...member }) => ({
      ...member,
      subtitle: position,
    })),
    volunteers: volunteers.map(({ role, ...volunteer }) => ({
      ...volunteer,
      subtitle: role,
    })),
  };
}

export const meta: Route.MetaFunction = () => [
  { title: "About" },
  {
    name: "description",
    content:
      "The people behind moku pona — a dinner society in Zurich built on community, creativity, and hospitality.",
  },
];

const whoWeAreSectionData: TextSectionBlockType = {
  type: "text-section",
  version: 1,
  data: {
    eyebrow: "who we are",
    headline: "a community of around fifteen",
    body: "what started as a shared love of cooking has grown into a community who come together to create, host, and share meals. as an association, moku pona is about community, creativity, and hospitality, not just dining, but making people feel welcome.",
    variant: "feature",
  },
};

export default function AboutPage({ loaderData }: Route.ComponentProps) {
  const { boardMembers, volunteers } = loaderData;

  return (
    // TextSectionBlockView carries its own PageContainer, so the sections sit
    // side by side under <main> rather than nested inside a second container
    // — nesting them would indent the block past the rest of the page.
    <main className="grow pt-14 pb-32 md:pt-20">
      <PageContainer as="div">
        <div className="flex flex-col gap-4">
          <Eyebrow variant="tracked" tone="primary">
            the people
          </Eyebrow>
          <h1 className={pageTitleClassName}>about</h1>
          <p className="text-muted-foreground max-w-2xl text-base font-light md:text-lg">
            moku pona runs on volunteers — the ones who cook, host, wash up, and
            somehow still have room for dessert.
          </p>
        </div>
      </PageContainer>

      <TextSectionBlockView blockData={whoWeAreSectionData} />

      <PageContainer as="div">
        <SectionDivider className="mb-8">
          the moku pona hall of fame
        </SectionDivider>

        {boardMembers.length > 0 ? (
          <PersonGrid people={boardMembers} />
        ) : (
          <p className="text-muted-foreground max-w-md text-base font-light md:text-lg">
            the hall is still being hung. check back once we&apos;ve persuaded
            everyone to sit still for a photograph.
          </p>
        )}
      </PageContainer>

      {volunteers.length > 0 ? (
        <PageContainer as="section" className="mt-20">
          <SectionDivider className="mb-4">our volunteers</SectionDivider>
          <p className="text-muted-foreground mb-8 max-w-2xl text-base font-light md:text-lg">
            the hands in the kitchen, at the door and at the sink — every
            evening happens because of them.
          </p>

          <PersonGrid people={volunteers} />
        </PageContainer>
      ) : null}
    </main>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <PageContainer className="grow pt-14 pb-32 md:pt-20">
      <RouteErrorContent error={error} />
    </PageContainer>
  );
}
