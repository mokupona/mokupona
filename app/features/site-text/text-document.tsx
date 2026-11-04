import { Fragment, type ReactNode } from "react";
import { Link } from "react-router";

import {
  parseDocument,
  type DocumentBlock,
  type DocumentInline,
} from "./document";

const linkClassName = "text-primary hover:underline";

function renderInline(nodes: DocumentInline[]): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.kind) {
      case "text":
        return <Fragment key={index}>{node.text}</Fragment>;
      case "break":
        return <br key={index} />;
      case "bold":
        return (
          <strong key={index} className="font-semibold">
            {renderInline(node.children)}
          </strong>
        );
      case "link":
        return node.href.startsWith("/") ? (
          <Link key={index} to={node.href} className={linkClassName}>
            {renderInline(node.children)}
          </Link>
        ) : (
          <a
            key={index}
            href={node.href}
            className={linkClassName}
            {...(/^https?:/i.test(node.href)
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
          >
            {renderInline(node.children)}
          </a>
        );
    }
  });
}

function Block({ block }: { block: DocumentBlock }) {
  if (block.kind === "paragraph") {
    return (
      <p className="text-foreground/80 text-base font-light">
        {renderInline(block.content)}
      </p>
    );
  }

  const ListTag = block.ordered ? "ol" : "ul";
  return (
    <ListTag
      className={
        block.ordered
          ? "text-foreground/80 list-decimal space-y-1 pl-5 text-base font-light"
          : "text-foreground/80 list-disc space-y-1 pl-5 text-base font-light"
      }
    >
      {block.items.map((item, index) => (
        <li key={index}>{renderInline(item)}</li>
      ))}
    </ListTag>
  );
}

/**
 * A long page an admin writes as one text (see ./document.ts for the
 * markup): `##` sections, `###` sub-sections, paragraphs and lists.
 */
export function TextDocument({ source }: { source: string }) {
  const sections = parseDocument(source);

  return (
    <div className="flex flex-col gap-10 md:gap-12">
      {sections.map((section, sectionIndex) => (
        <section key={sectionIndex} className="flex flex-col gap-6">
          {section.title ? (
            <h2 className="text-2xl leading-tight font-light tracking-tight md:text-3xl">
              {section.title}
            </h2>
          ) : null}
          {section.blocks.map((block, index) => (
            <Block key={index} block={block} />
          ))}
          {section.subsections.map((subsection, index) => (
            <div key={index} className="flex flex-col gap-3">
              <h3 className="text-xl font-light tracking-tight">
                {subsection.title}
              </h3>
              {subsection.blocks.map((block, blockIndex) => (
                <Block key={blockIndex} block={block} />
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
