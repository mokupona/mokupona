import { MosaicGallery } from "../layouts/mosaic";
import type { GalleryImageModel } from "../view-models";

import { SectionDivider } from "~/components/section";
import { useText } from "~/features/site-text/site-text-context";

/**
 * The gallery as it appears on a past event's page. Renders nothing at all
 * when that event has no images — an empty state here would be noise on a
 * page that is about the evening, not about its photos.
 */
export function EventGallerySection({
  images,
}: {
  images: GalleryImageModel[];
}) {
  const t = useText();
  if (images.length === 0) return null;

  return (
    <section className="mt-14 flex flex-col gap-5">
      <SectionDivider>{t("gallery.event.heading")}</SectionDivider>

      <MosaicGallery images={images} variant="section" />
    </section>
  );
}
