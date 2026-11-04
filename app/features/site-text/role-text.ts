import type { Text } from "./text";

/** A role's display name, which admins edit like any other text. */
export function roleText(t: Text, role: string): string {
  switch (role) {
    case "user":
      return t("site.role.user");
    case "moderator":
      return t("site.role.moderator");
    case "admin":
      return t("site.role.admin");
    default:
      return role;
  }
}
