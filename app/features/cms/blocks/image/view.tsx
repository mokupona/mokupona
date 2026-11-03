import type { ImageBlockType } from "./model";

import { OptimizedImage } from "~/components/optimized-image";
import { PageContainer } from "~/components/section";
import { cn } from "~/lib/utils";

type ImageBlockViewProps = {
  blockData: ImageBlockType;
  className?: string;
};

export function ImageBlockView({ blockData, className }: ImageBlockViewProps) {
  const { data } = blockData;
  const { image, variant } = data;
  const { src, alt, width, height, blurDataUrl } = image;

  const imageClasses =
    variant === "full-width" ? "h-64 w-full md:h-96" : "h-auto w-full";

  return (
    <PageContainer as="div">
      <OptimizedImage
        image={{ storageKey: src, blurDataUrl }}
        width={width ?? 1080}
        height={height ?? 382}
        alt={alt ?? ""}
        className={cn(imageClasses, className)}
      />
    </PageContainer>
  );
}
