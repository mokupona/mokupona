import type { Route } from "./+types/gallery";

import { RouteErrorContent } from "~/components/route-error-content";
import {
  Eyebrow,
  PageContainer,
  pageTitleClassName,
} from "~/components/section";
import { listGalleryImages } from "~/features/gallery/gallery.server";
import { MosaicGallery } from "~/features/gallery/layouts/mosaic";
import { textFromMatches } from "~/features/site-text/meta";
import { useText } from "~/features/site-text/site-text-context";

export async function loader() {
  // one roll of every photo from every past dinner, newest dinner first
  return { images: await listGalleryImages() };
}

export const meta: Route.MetaFunction = ({ matches }) => [
  { title: textFromMatches(matches)("gallery.meta.title") },
];

export default function GalleryPage({ loaderData }: Route.ComponentProps) {
  const { images } = loaderData;
  const t = useText();

  return (
    <PageContainer className="grow pt-14 pb-32 md:pt-20">
      <div className="mb-14 flex flex-col gap-4 md:mb-20">
        <Eyebrow variant="tracked" tone="primary">
          {t("gallery.eyebrow")}
        </Eyebrow>
        <h1 className={pageTitleClassName}>{t("gallery.title")}</h1>
        <p className="text-muted-foreground max-w-2xl text-base font-light whitespace-pre-line md:text-lg">
          {t("gallery.intro")}
        </p>
      </div>

      {images.length > 0 ? (
        <MosaicGallery images={images} variant="page" />
      ) : (
        <p className="text-muted-foreground max-w-md text-base font-light whitespace-pre-line md:text-lg">
          {t("gallery.empty")}
        </p>
      )}
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
