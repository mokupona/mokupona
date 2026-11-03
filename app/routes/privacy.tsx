import type { Route } from "./+types/privacy";

import { PageContainer, pageTitleClassName } from "~/components/section";
import { textFromMatches } from "~/features/site-text/meta";
import { useText } from "~/features/site-text/site-text-context";
import { TextDocument } from "~/features/site-text/text-document";
import { cn } from "~/lib/utils";

export const meta: Route.MetaFunction = ({ matches }) => [
  { title: textFromMatches(matches)("privacy.meta.title") },
];

export default function PrivacyPage() {
  const t = useText();

  return (
    <PageContainer className="grow pt-7 pb-20">
      <h1 className={cn("mb-9 md:mb-12", pageTitleClassName)}>
        {t("privacy.title")}
      </h1>

      <TextDocument source={t("privacy.body")} />
    </PageContainer>
  );
}
