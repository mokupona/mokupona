import {
  AUTH_TOGGLES,
  type AuthSettings,
  type AuthToggle,
} from "./auth-settings";

import {
  deleteAuthSettingRows,
  findAuthSettingRow,
  listAuthSettingRows,
  saveAuthSettingRow,
} from "~/models/auth-setting.server";

// The switches live in the database (the AuthSetting table), so what an
// admin set at /admin/settings holds across restarts and deploys. Each read
// goes to the database: it's one small lookup, and it never disagrees with
// what was last saved.

/** A toggle nobody has switched is open, as it was before there were any. */
const DEFAULT_ENABLED = true;

function isAuthToggle(value: string): value is AuthToggle {
  return (AUTH_TOGGLES as readonly string[]).includes(value);
}

export async function getAuthSettings(): Promise<AuthSettings> {
  const settings = Object.fromEntries(
    AUTH_TOGGLES.map((toggle) => [toggle, DEFAULT_ENABLED]),
  ) as AuthSettings;
  // a row for a toggle this code no longer knows is left alone
  for (const row of await listAuthSettingRows()) {
    if (isAuthToggle(row.toggle)) settings[row.toggle] = row.enabled;
  }
  return settings;
}

export async function isAuthToggleEnabled(
  toggle: AuthToggle,
): Promise<boolean> {
  const row = await findAuthSettingRow(toggle);
  return row?.enabled ?? DEFAULT_ENABLED;
}

export async function setAuthToggleEnabled(
  toggle: AuthToggle,
  enabled: boolean,
): Promise<AuthSettings> {
  await saveAuthSettingRow(toggle, enabled);
  return getAuthSettings();
}

/** Back to every toggle open, as on a site nobody has switched anything on. */
export async function resetAuthSettings(): Promise<AuthSettings> {
  await deleteAuthSettingRows();
  return getAuthSettings();
}
