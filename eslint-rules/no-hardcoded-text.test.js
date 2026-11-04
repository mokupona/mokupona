// @vitest-environment node

import { RuleTester } from "eslint";
import tseslint from "typescript-eslint";

import plugin from "./no-hardcoded-text.js";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const error = { messageId: "hardcoded" };

tester.run("no-hardcoded-text", plugin.rules["no-hardcoded-text"], {
  valid: [
    'const a = <p>{t("landing.vision.body")}</p>;',
    "const a = <p>{count} · {total}</p>;",
    'const a = <input placeholder={t("auth.field.emailPlaceholder")} />;',
    'const a = <a href="/privacy" className="text-primary" />;',
    'const meta = [{ property: "og:type", content: "website" }];',
    'const v = cva("x", { variants: { tone: { label: "text-muted-foreground" } } });',
    'const o = { classNames: { description: "group-[.toast]:text-muted-foreground" } };',
    'logger.info({ ip }, "Successful login request");',
  ],
  invalid: [
    { code: "const a = <p>hello there</p>;", errors: [error] },
    { code: 'const a = <p>{"hello"}</p>;', errors: [error] },
    {
      code: 'const a = <p>{open ? "open" : "closed"}</p>;',
      errors: [error, error],
    },
    { code: 'const a = <img alt="a long table" />;', errors: [error] },
    { code: 'const a = <button aria-label="Open menu" />;', errors: [error] },
    {
      code: 'const a = <Field labelProps={{ children: "email" }} />;',
      errors: [error],
    },
    { code: 'const toast = { title: "You\'re in!" };', errors: [error] },
    { code: "const toast = { title: `Event - ${title}` };", errors: [error] },
    { code: 'z.string({ error: "Name is required" });', errors: [error] },
    {
      code: 'const meta = [{ name: "description", content: "A culinary society" }];',
      errors: [error],
    },
  ],
});
