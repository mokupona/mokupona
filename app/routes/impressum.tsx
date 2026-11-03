import type { ReactNode } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/impressum";

import { PageContainer, pageTitleClassName } from "~/components/section";
import { cn } from "~/lib/utils";

export const meta: Route.MetaFunction = () => [{ title: "Impressum" }];

export default function ImpressumPage() {
  return (
    <PageContainer className="grow pt-7 pb-20">
      <h1 className={cn("mb-9 md:mb-12", pageTitleClassName)}>Impressum</h1>

      <div className="flex flex-col gap-10 md:gap-12">
        <Section title="Contact Address">
          <P>
            moku pona
            <br />
            Regensbergstrasse 24
            <br />
            8050 Zürich
            <br />
            Switzerland
          </P>
          <P>
            Email:{" "}
            <a
              href="mailto:mokuponadinnerclub@gmail.com"
              className="text-primary hover:underline"
            >
              mokuponadinnerclub@gmail.com
            </a>
            <br />
            Website: https://mokupona.ch
          </P>
        </Section>

        <Section title="Disclaimer">
          <P>
            The author assumes no liability for the correctness, accuracy,
            timeliness, reliability, or completeness of the information on this
            website.
          </P>
          <P>
            Liability claims against the author for material or immaterial
            damage resulting from access to, use or non-use of the published
            information, from misuse of the connection, or from technical faults
            are excluded.
          </P>
          <P>
            All offers are non-binding. The author expressly reserves the right
            to change, supplement, or delete parts of the pages or the entire
            offer without prior notice, or to discontinue publication
            temporarily or permanently.
          </P>
        </Section>

        <Section title="Liability for Links">
          <P>
            References and links to third-party websites are outside our area of
            responsibility. Any responsibility for such websites is declined.
            Access to and use of such websites is at the user’s own risk.
          </P>
        </Section>

        <Section title="Copyright">
          <P>
            The copyright and all other rights to the content, images, photos,
            and other files on this website belong exclusively to moku pona or
            the specifically named rights holders. The written consent of the
            copyright holder must be obtained in advance for the reproduction of
            any elements.
          </P>
        </Section>

        <Section title="Data Protection">
          <P>
            Information on how we process personal data can be found in our{" "}
            <Link to="/privacy" className="text-primary hover:underline">
              privacy policy
            </Link>
            .
          </P>
        </Section>
      </div>
    </PageContainer>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-2xl leading-tight font-light tracking-tight md:text-3xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="text-foreground/80 text-base font-light">{children}</p>;
}
