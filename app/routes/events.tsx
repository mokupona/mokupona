import { Outlet } from "react-router";

import type { Route } from "./+types/events";

import { textFromMatches } from "~/features/site-text/meta";

export const meta: Route.MetaFunction = ({ matches }) => [
  { title: textFromMatches(matches)("events.meta.title") },
];

export default function EventsPage() {
  return <Outlet />;
}
