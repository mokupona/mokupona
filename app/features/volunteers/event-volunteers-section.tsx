import { PersonGrid, type Person } from "~/components/person-card";
import { SectionDivider } from "~/components/section";
import { useText } from "~/features/site-text/site-text-context";

/**
 * The thank-you under a past event: who cooked, hosted and washed up that
 * evening. Renders nothing when nobody has been credited, like the gallery.
 */
export function EventVolunteersSection({ people }: { people: Person[] }) {
  const t = useText();

  if (people.length === 0) return null;

  return (
    <section className="mt-14 flex flex-col gap-5">
      <SectionDivider>{t("events.detail.volunteers")}</SectionDivider>

      <PersonGrid people={people} size="compact" />
    </section>
  );
}
