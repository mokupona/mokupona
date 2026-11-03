import { Fragment, type ReactNode } from "react";

import { parseTemplate, type TextToken } from "./format";

export type RichTextVars = Record<string, ReactNode>;
export type RichTextTags = Record<string, (children: ReactNode) => ReactNode>;

function renderTokens(
  tokens: TextToken[],
  vars: RichTextVars,
  tags: RichTextTags,
): ReactNode[] {
  return tokens.map((token, index) => {
    switch (token.kind) {
      case "text":
        return <Fragment key={index}>{token.text}</Fragment>;
      case "var":
        return (
          <Fragment key={index}>
            {Object.prototype.hasOwnProperty.call(vars, token.name)
              ? vars[token.name]
              : `{${token.name}}`}
          </Fragment>
        );
      case "tag": {
        const children = renderTokens(token.children, vars, tags);
        const wrap = tags[token.name];
        return (
          <Fragment key={index}>{wrap ? wrap(children) : children}</Fragment>
        );
      }
    }
  });
}

/**
 * Renders a site text whose `{name}` placeholders or `<tag>` spans stand for
 * markup, e.g. a bold address or a link:
 *
 *   <RichText
 *     text={t("signup.privacy")}
 *     tags={{ link: (children) => <Link to="/privacy">{children}</Link> }}
 *   />
 */
export function RichText({
  text,
  vars = {},
  tags = {},
}: {
  text: string;
  vars?: RichTextVars;
  tags?: RichTextTags;
}) {
  return <>{renderTokens(parseTemplate(text), vars, tags)}</>;
}
