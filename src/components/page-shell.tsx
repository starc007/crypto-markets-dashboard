import type { ReactNode } from "react";

export function PageShell({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10"
    >
      {title && (
        <header className="animate-enter">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </header>
      )}
      {children}
    </main>
  );
}
