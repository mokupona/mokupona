import { OptimizedImage } from "~/components/optimized-image";
import { cn } from "~/lib/utils";
import type { ImageMetadata } from "~/models/image.server";

/** Square portraits keep the grid honest whatever aspect the upload had. */
const PORTRAIT_SIZE = 320;

export interface Person {
  id: string;
  name: string;
  /** the line under the name — a board position or a volunteer's role */
  subtitle: string | null;
  bio: string | null;
  image: ImageMetadata | null;
}

/** The public people grid: board members, volunteers, the evening's helpers. */
export function PersonGrid({
  people,
  size = "default",
}: {
  people: Person[];
  /** "compact" packs more portraits per row, for credits under an event */
  size?: "default" | "compact";
}) {
  return (
    <ul
      className={cn(
        "grid gap-x-5",
        size === "compact"
          ? "grid-cols-3 gap-y-8 sm:grid-cols-4 lg:grid-cols-6"
          : "grid-cols-2 gap-y-10 sm:grid-cols-3 lg:grid-cols-4",
      )}
    >
      {people.map((person) => (
        <PersonCard
          key={person.id}
          person={person}
          showBio={size === "default"}
          sizes={
            size === "compact"
              ? "(min-width: 1024px) 160px, (min-width: 640px) 22vw, 30vw"
              : "(min-width: 1024px) 260px, (min-width: 640px) 30vw, 45vw"
          }
        />
      ))}
    </ul>
  );
}

function PersonCard({
  person,
  showBio,
  sizes,
}: {
  person: Person;
  showBio: boolean;
  sizes: string;
}) {
  return (
    <li className="flex flex-col gap-3">
      {/* torn paper like the other photos; the sage fill is the
          placeholder's own backdrop, so it only shows without a portrait */}
      <div className="paper-photo">
        {person.image ? (
          <OptimizedImage
            image={person.image}
            alt={person.name}
            width={PORTRAIT_SIZE}
            height={PORTRAIT_SIZE}
            loading="lazy"
            sizes={sizes}
            className="w-full"
          />
        ) : (
          <PortraitPlaceholder name={person.name} />
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <h3 className="text-base leading-tight font-light md:text-lg">
          {person.name}
        </h3>
        {person.subtitle ? (
          <p className="text-muted-foreground text-xs md:text-sm">
            {person.subtitle}
          </p>
        ) : null}
        {showBio && person.bio ? (
          <p className="text-foreground/80 mt-2 text-sm font-light whitespace-pre-line">
            {person.bio}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/** Stands in until someone uploads a portrait — initials on a sage card. */
function PortraitPlaceholder({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      className="bg-sage/40 text-ink/60 flex aspect-square items-center justify-center text-3xl font-light"
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
