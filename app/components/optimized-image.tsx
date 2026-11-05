import type { ComponentProps } from "react";
import { useEffect, useRef, useState } from "react";

import { cn } from "~/lib/utils";
import {
  deliversFramedImage,
  getImageUrl,
  RESPONSIVE_IMAGE_WIDTHS,
  type ImageDisplaySource,
  type ImageFit,
} from "~/shared/image";
import { cropOf, framedImageStyle } from "~/shared/image-crop";
import { useImageConfig } from "~/shared/root-data";

type ImageInputProps = {
  image: ImageDisplaySource;
  width: number;
  height: number;
  fit?: ImageFit;
};

type ImageProps = Omit<ComponentProps<"img">, "width" | "height" | "src"> &
  ImageInputProps;

export function OptimizedImage({
  image,
  width,
  height,
  fit = "cover",
  className,
  style,
  alt,
  loading = "eager",
  ...props
}: ImageProps) {
  const config = useImageConfig();
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true);
  }, []);

  const aspect = width / height;

  const src = getImageUrl(image, config, { width, height, fit });

  const srcSet = RESPONSIVE_IMAGE_WIDTHS.map((w) => {
    const h = Math.round(w / aspect);
    return `${getImageUrl(image, config, { width: w, height: h, fit })} ${w}w`;
  }).join(", ");

  // an admin's framing the delivered file doesn't carry (the local provider
  // serves files as stored): place the whole file so the frame shows it
  const crop = cropOf(image);
  const framing =
    crop &&
    fit === "cover" &&
    image.width &&
    image.height &&
    !deliversFramedImage(image, config)
      ? framedImageStyle(
          crop,
          { width: image.width, height: image.height },
          aspect,
        )
      : undefined;
  const fill = framing ? "absolute" : "absolute inset-0 size-full object-cover";

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{ aspectRatio: `${width} / ${height}`, ...style }}
    >
      {image.blurDataUrl ? (
        <>
          <img
            src={image.blurDataUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 size-full object-cover"
          />
          <div aria-hidden className="absolute inset-0 backdrop-blur-2xl" />
        </>
      ) : (
        <div aria-hidden className="bg-primary/10 absolute inset-0" />
      )}
      {src ? (
        <>
          <img
            ref={imgRef}
            srcSet={srcSet}
            src={src}
            width={width}
            height={height}
            alt={alt}
            loading={loading}
            onLoad={() => setLoaded(true)}
            className={cn(
              fill,
              "transition-opacity duration-300",
              loaded ? "opacity-100" : "opacity-0",
            )}
            style={framing}
            {...props}
          />
          <noscript>
            <img
              srcSet={srcSet}
              src={src}
              width={width}
              height={height}
              alt={alt}
              loading={loading}
              className={fill}
              style={framing}
            />
          </noscript>
        </>
      ) : null}
    </div>
  );
}
