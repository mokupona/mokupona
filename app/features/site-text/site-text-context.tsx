import { createContext, useContext, useMemo, type ReactNode } from "react";

import {
  createText,
  defaultText,
  type SiteTextOverrides,
  type Text,
} from "./text";

const SiteTextContext = createContext<Text>(defaultText);

/**
 * Hands the admin's text edits (from the root loader) to every component
 * below. Outside it, components fall back to the defaults, which keeps them
 * renderable in tests and in the root error boundary.
 */
export function SiteTextProvider({
  overrides,
  children,
}: {
  overrides: SiteTextOverrides | undefined;
  children: ReactNode;
}) {
  const t = useMemo(() => createText(overrides), [overrides]);
  return <SiteTextContext value={t}>{children}</SiteTextContext>;
}

/** `const t = useText(); t("landing.vision.headline")` */
export function useText(): Text {
  return useContext(SiteTextContext);
}
