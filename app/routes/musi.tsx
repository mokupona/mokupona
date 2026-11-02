import type { Route } from "./+types/musi";

import { BackLink, PageContainer } from "~/components/section";
import { Arcade } from "~/features/musi/arcade";

export const meta: Route.MetaFunction = () => [
  { title: "musi · moku pona" },
  // an easter egg: found by clicking moku or pona on the landing page
  { name: "robots", content: "noindex" },
];

export default function MusiPage() {
  return (
    <PageContainer className="grow pt-6 pb-20">
      <BackLink to="/">moku pona</BackLink>
      <Arcade />
    </PageContainer>
  );
}
