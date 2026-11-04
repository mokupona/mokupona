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
import { textFromMatches } from "~/features/site-text/meta";
import { useText } from "~/features/site-text/site-text-context";
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

export const meta: Route.MetaFunction = ({ matches }) => {
  const t = textFromMatches(matches);
  return [
    { title: t("about.meta.title") },
    { name: "description", content: t("about.meta.description") },
  ];
};

export default function AboutPage({ loaderData }: Route.ComponentProps) {
  const { boardMembers, volunteers } = loaderData;
  const t = useText();

  const whoWeAreSectionData: TextSectionBlockType = {
    type: "text-section",
    version: 1,
    data: {
      eyebrow: t("about.whoWeAre.eyebrow"),
      headline: t("about.whoWeAre.headline"),
      body: t("about.whoWeAre.body"),
      variant: "feature",
    },
  };

  return (
    // TextSectionBlockView carries its own PageContainer, so the sections sit
    // side by side under <main> rather than nested inside a second container
    // — nesting them would indent the block past the rest of the page.
    <main className="grow pt-14 pb-32 md:pt-20">
      <PageContainer as="div">
        <div className="flex flex-col gap-4">
          <Eyebrow variant="tracked" tone="primary">
            {t("about.eyebrow")}
          </Eyebrow>
          <h1 className={pageTitleClassName}>{t("about.title")}</h1>
          <p className="text-muted-foreground max-w-2xl text-base font-light whitespace-pre-line md:text-lg">
            {t("about.intro")}
          </p>
        </div>
      </PageContainer>

      <TextSectionBlockView blockData={whoWeAreSectionData} />

      <PageContainer as="div">
        <SectionDivider className="mb-8">
          {t("about.hallOfFame")}
        </SectionDivider>

        {boardMembers.length > 0 ? (
          <PersonGrid people={boardMembers} />
        ) : (
          <p className="text-muted-foreground max-w-md text-base font-light whitespace-pre-line md:text-lg">
            {t("about.hallEmpty")}
          </p>
        )}
      </PageContainer>

      {volunteers.length > 0 ? (
        <PageContainer as="section" className="mt-20">
          <SectionDivider className="mb-4">
            {t("about.volunteers.heading")}
          </SectionDivider>
          <p className="text-muted-foreground mb-8 max-w-2xl text-base font-light whitespace-pre-line md:text-lg">
            {t("about.volunteers.body")}
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
