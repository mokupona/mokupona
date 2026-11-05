// The long-lived helper process (started by client.ts). It loads the app's
// server modules and database client once, then answers one message per
// cy.task call over the IPC channel, so a call costs a database round trip
// instead of booting Node, tsx and Prisma again.

import { disconnectHelpers, helpers, type HelperName } from "./helpers";

interface Request {
  id: number;
  name: HelperName;
  arg: unknown;
}

const send = (message: object) => process.send?.(message);

process.on("message", async ({ id, name, arg }: Request) => {
  try {
    if (!(name in helpers)) throw new Error(`Unknown test helper "${name}"`);
    const run = helpers[name] as (arg: unknown) => Promise<unknown>;
    // cy.task treats undefined as a mistake; null is a valid "nothing"
    send({ id, value: (await run(arg)) ?? null });
  } catch (error) {
    send({
      id,
      error:
        error instanceof Error ? (error.stack ?? error.message) : String(error),
    });
  }
});

// Cypress is done (or gone): let go of the database and leave
process.on("disconnect", () => {
  void disconnectHelpers().finally(() => process.exit(0));
});

send({ ready: true });
