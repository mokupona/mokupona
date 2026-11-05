// Starts the helper process (server.ts) on the first cy.task that needs it
// and relays calls to it. Imported by cypress.config.ts, so it uses Node
// built-ins only: the helper process does the TypeScript and app imports
// through tsx, the same way the old one-off `npx tsx` scripts did.

import { fork, type ChildProcess } from "node:child_process";
import path from "node:path";

type Reply = { id: number; value?: unknown; error?: string };

let child: ChildProcess | null = null;
let nextId = 0;
const pending = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>();

function start(projectRoot: string) {
  const proc = fork(
    path.join(projectRoot, "cypress/support/node/server.ts"),
    [],
    {
      cwd: projectRoot,
      // the Node that npm runs the scripts with, should Cypress's own config
      // process run on a bundled one
      execPath: process.env.npm_node_execpath || process.execPath,
      execArgv: ["--import", "tsx"],
      env: {
        ...process.env,
        // users made here aren't mailed into the capture the specs read, and
        // the app's request logging stays out of the Cypress output
        MAIL_PROVIDER: "console",
        LOG_LEVEL: "silent",
      },
      stdio: ["ignore", "inherit", "inherit", "ipc"],
    },
  );

  proc.on("message", (reply: Reply) => {
    const call = pending.get(reply.id);
    if (!call) return;
    pending.delete(reply.id);
    if (reply.error) call.reject(new Error(reply.error));
    else call.resolve(reply.value ?? null);
  });

  proc.on("exit", (code, signal) => {
    if (child === proc) child = null;
    const error = new Error(
      `The Cypress helper process exited (${signal ?? `code ${code}`})`,
    );
    pending.forEach((call) => call.reject(error));
    pending.clear();
  });

  return proc;
}

/** Runs one helper in the helper process, starting it if needed. */
export function callHelper(projectRoot: string, name: string, arg: unknown) {
  child ??= start(projectRoot);
  const proc = child;
  const id = nextId++;
  return new Promise<unknown>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    proc.send({ id, name, arg }, (error) => {
      if (!error) return;
      pending.delete(id);
      reject(error);
    });
  });
}

export function stopHelpers() {
  if (child?.connected) child.disconnect();
  child = null;
}
