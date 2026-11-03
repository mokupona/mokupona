// Keeps public-facing copy out of the code, so every text a visitor reads can
// be edited at /admin/texts. Add the text to app/features/site-text/registry
// and read it with t("…") instead (CLAUDE.md, "Public-facing text").
//
// Reported:
//   - text between JSX tags:              <p>hello</p>
//   - text-carrying JSX attributes:       alt="…" placeholder="…" aria-label="…"
//   - text-carrying object properties:    { title: "…" } { error: "…" }
//
// Strings without a letter (punctuation, numbers, "·") pass, and so does a
// `content` value without a space, which is how meta tags like
// `{ property: "og:type", content: "website" }` stay quiet. Class names in
// `cva(…)`/`cn(…)` and `classNames: {…}` are not text either.
//
// Something that really isn't copy (a hidden spam-trap label, an API error
// body nobody sees) takes an eslint-disable comment saying why.

const LETTER = /\p{L}/u;

const TEXT_ATTRIBUTES = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
  "body",
  "description",
  "eyebrow",
  "heading",
  "label",
  "placeholder",
  "subtitle",
  "title",
]);

const TEXT_PROPERTIES = new Set([
  "body",
  "children",
  "content",
  "description",
  "error",
  "eyebrow",
  "heading",
  "label",
  "message",
  "placeholder",
  "subtitle",
  "title",
]);

function isText(value, key) {
  if (!LETTER.test(value)) return false;
  if (key === "content") return /\s/.test(value.trim());
  return true;
}

/**
 * The plain strings a node can evaluate to, looking through `a ? "x" : "y"`
 * and `a || "x"`, with the node each one sits in.
 */
function literalTexts(node) {
  if (!node) return [];
  switch (node.type) {
    case "Literal":
      return typeof node.value === "string" ? [{ node, text: node.value }] : [];
    case "TemplateLiteral":
      return [
        {
          node,
          text: node.quasis.map((quasi) => quasi.value.cooked ?? "").join(" "),
        },
      ];
    case "JSXExpressionContainer":
      return literalTexts(node.expression);
    case "ConditionalExpression":
      return [
        ...literalTexts(node.consequent),
        ...literalTexts(node.alternate),
      ];
    case "LogicalExpression":
      return [...literalTexts(node.left), ...literalTexts(node.right)];
    default:
      return [];
  }
}

function propertyName(node) {
  if (node.computed) return null;
  if (node.key.type === "Identifier") return node.key.name;
  if (node.key.type === "Literal") return String(node.key.value);
  return null;
}

const CLASS_HELPERS = new Set(["cva", "cn", "clsx", "twMerge"]);
const CLASS_PROPERTIES = new Set(["className", "classNames"]);

/** Inside `cva(…)`, `cn(…)` or a `classNames: {…}` object, strings are classes. */
function isClassContext(context, node) {
  return context.sourceCode
    .getAncestors(node)
    .some(
      (ancestor) =>
        (ancestor.type === "CallExpression" &&
          ancestor.callee.type === "Identifier" &&
          CLASS_HELPERS.has(ancestor.callee.name)) ||
        (ancestor.type === "Property" &&
          CLASS_PROPERTIES.has(propertyName(ancestor) ?? "")),
    );
}

function attributeName(node) {
  return node.name.type === "JSXIdentifier" ? node.name.name : null;
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Public-facing text belongs in the site-text registry, where admins can edit it.",
    },
    messages: {
      hardcoded:
        'Hardcoded text "{{text}}". Add it to app/features/site-text/registry and use t("…") so admins can edit it.',
    },
    schema: [],
  },

  create(context) {
    function report(node, text) {
      const shown = text.trim().replace(/\s+/g, " ");
      context.report({
        node,
        messageId: "hardcoded",
        data: { text: shown.length > 40 ? `${shown.slice(0, 37)}…` : shown },
      });
    }

    return {
      JSXText(node) {
        if (isText(node.value)) report(node, node.value);
      },

      JSXExpressionContainer(node) {
        // {"text"} or {`text`} as a child, not as an attribute value
        if (node.parent.type === "JSXAttribute") return;
        for (const found of literalTexts(node.expression)) {
          if (isText(found.text)) report(found.node, found.text);
        }
      },

      JSXAttribute(node) {
        const name = attributeName(node);
        if (!name || !TEXT_ATTRIBUTES.has(name)) return;
        for (const found of literalTexts(node.value)) {
          if (isText(found.text, name)) report(found.node, found.text);
        }
      },

      Property(node) {
        const name = propertyName(node);
        if (!name || !TEXT_PROPERTIES.has(name)) return;
        if (isClassContext(context, node)) return;
        for (const found of literalTexts(node.value)) {
          if (isText(found.text, name)) report(found.node, found.text);
        }
      },
    };
  },
};

export default {
  rules: { "no-hardcoded-text": rule },
};
