import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

export function AuthStatus({
  tone = "positive",
  icon,
  heading,
  body,
  standalone = false,
  children,
}: {
  tone?: "positive" | "neutral";
  icon: ReactNode;
  heading: string;
  body: ReactNode;
  standalone?: boolean;
  children?: ReactNode;
}) {
  const content = (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 text-center">
      <div
        aria-hidden
        className={cn(
          "flex size-16 items-center justify-center",
          tone === "positive"
            ? "bg-primary/10 text-primary"
            : "bg-foreground/5 text-muted-foreground",
        )}
      >
        {icon}
      </div>
      <h1 className="text-3xl leading-tight font-light tracking-tight">
        {heading}
      </h1>
      <p className="text-foreground/80 font-light">{body}</p>
      {children}
    </div>
  );

  return standalone ? (
    <main className="flex grow items-center justify-center px-6 py-16">
      {content}
    </main>
  ) : (
    content
  );
}
