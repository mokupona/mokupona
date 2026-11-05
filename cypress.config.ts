import { defineConfig } from "cypress";

import { callHelper, stopHelpers } from "./cypress/support/node/client";

export default defineConfig({
  allowCypressEnv: false,
  e2e: {
    setupNodeEvents: (on, config) => {
      const isDev = config.watchForFileChanges;
      const port = process.env.PORT ?? (isDev ? "3000" : "8811");
      const configOverrides: Partial<Cypress.PluginConfigOptions> = {
        baseUrl: `http://localhost:${port}`,
        screenshotOnRunFailure: !process.env.CI,
      };

      // the server-side helpers (cypress/support/node/helpers.ts), all
      // answered by one helper process that stays up for the whole run
      const helper = (name: string) => (arg: unknown) =>
        callHelper(config.projectRoot, name, arg);

      on("task", {
        log: (message) => {
          console.log(message);

          return null;
        },
        createUserSession: helper("createUserSession"),
        createRoleSession: helper("createRoleSession"),
        deleteUser: helper("deleteUser"),
        createInvite: helper("createInvite"),
        records: helper("records"),
      });

      on("after:run", () => stopHelpers());

      return { ...config, ...configOverrides };
    },
  },
});
