import type { Route } from "./+types/musi";

import { BackLink, PageContainer } from "~/components/section";
import { Arcade } from "~/features/musi/arcade";
import { textFromMatches } from "~/features/site-text/meta";
import { useText } from "~/features/site-text/site-text-context";

export const meta: Route.MetaFunction = ({ matches }) => [
  { title: textFromMatches(matches)("musi.metaTitle") },
  // an easter egg: found by clicking moku or pona on the landing page
  { name: "robots", content: "noindex" },
];

export default function MusiPage() {
  const t = useText();

  return (
    <PageContainer className="grow pt-6 pb-20">
      <BackLink to="/">{t("musi.back")}</BackLink>
      <Arcade />
    </PageContainer>
  );
}
