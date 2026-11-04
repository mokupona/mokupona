import { PersonGrid, type Person } from "~/components/person-card";
import { SectionDivider } from "~/components/section";

/**
 * The thank-you under a past event: who cooked, hosted and washed up that
 * evening. Renders nothing when nobody has been credited, like the gallery.
 */
export function EventVolunteersSection({ people }: { people: Person[] }) {
  if (people.length === 0) return null;

  return (
    <section className="mt-14 flex flex-col gap-5">
      <SectionDivider>made possible by</SectionDivider>

      <PersonGrid people={people} size="compact" />
    </section>
  );
}
