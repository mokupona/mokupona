import type React from "react";
import { Link } from "react-router";

import type { HeroBlockType } from "./model";

import { OptimizedImage } from "~/components/optimized-image";
import { Eyebrow, SecondaryCTA } from "~/components/section";
import { buttonVariants } from "~/components/ui/button";

type HeroBlockViewProps = React.ComponentPropsWithoutRef<"section"> & {
  blockData: HeroBlockType;
};

export function HeroBlockView({ blockData, ...rest }: HeroBlockViewProps) {
  const { data } = blockData;
  const {
    eyebrow,
    headline,
    headlineAccent,
    description,
    actions = [],
    meta,
    image,
  } = data;
  const { src, alt, width, height, blurDataUrl } = image;

  return (
    <section
      className="mx-auto flex max-w-7xl flex-col md:grid md:min-h-128 md:grid-cols-[46fr_54fr]"
      {...rest}
    >
      <div className="flex flex-col justify-center gap-5 px-5 py-8 md:gap-6 md:px-10 md:py-16">
        {eyebrow ? (
          <Eyebrow variant="kicker" tone="primary">
            {eyebrow}
          </Eyebrow>
        ) : null}

        <h1 className="text-4xl leading-tight font-light tracking-tight text-balance md:text-5xl">
          {headline}
          {headlineAccent ? (
            <>
              {" "}
              <span className="text-primary italic">{headlineAccent}</span>
            </>
          ) : null}
        </h1>

        {description ? (
          <p className="text-foreground/80 max-w-md text-base font-light md:text-lg">
            {description}
          </p>
        ) : null}

        {actions.length > 0 ? (
          <div className="mt-1 flex flex-col gap-5 md:flex-row md:items-center md:gap-6">
            {actions.map((action, index) =>
              action.variant === "secondary" ? (
                <SecondaryCTA
                  key={index}
                  to={action.href}
                  className="max-md:self-center"
                >
                  {action.label}
                </SecondaryCTA>
              ) : (
                <Link key={index} to={action.href} className={buttonVariants()}>
                  {action.label}
                </Link>
              ),
            )}
          </div>
        ) : null}

        {meta ? (
          <Eyebrow variant="tracked" tone="label" className="mt-2">
            {meta}
          </Eyebrow>
        ) : null}
      </div>

      <div className="paper-photo h-72 max-md:order-first md:h-auto">
        <OptimizedImage
          image={{ storageKey: src, blurDataUrl }}
          width={width ?? 1080}
          height={height ?? 572}
          alt={alt ?? ""}
          className="absolute inset-0 size-full"
          fetchPriority="high"
        />
      </div>
    </section>
  );
}
