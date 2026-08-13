import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import { getErrorPresentation } from "./platform/http/error-presentation";
import { applyDeploymentSecurityHeaders } from "./platform/http/security-headers.server";
import { Card } from "./ui/components/card";
import { PageShell } from "./ui/components/page-shell";
import { ThemeToggle } from "./ui/components/theme-toggle";
import "./app.css";

export const links: Route.LinksFunction = () => [];

export const headers: Route.HeadersFunction = ({
  actionHeaders,
  errorHeaders,
  loaderHeaders,
  parentHeaders,
}) => {
  const responseHeaders = new Headers(parentHeaders);

  for (const source of [loaderHeaders, actionHeaders, errorHeaders]) {
    source?.forEach((value, name) => {
      if (name.toLowerCase() !== "set-cookie") {
        responseHeaders.set(name, value);
      }
    });
  }

  return applyDeploymentSecurityHeaders(responseHeaders);
};

const themeInitializer = `(() => {
  try {
    const stored = window.localStorage.getItem("acronymicon-theme");
    const dark = stored === "dark" ||
      (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  } catch {}
})()`;

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ThemeToggle />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { message, details, stack } = getErrorPresentation(
    error,
    import.meta.env.DEV,
  );

  return (
    <PageShell contentClassName="pt-16">
      <Card className="p-4">
        <h1 className="text-2xl font-semibold">{message}</h1>
        <p className="mt-2 text-muted-foreground">{details}</p>
        {stack ? (
          <pre className="mt-4 w-full overflow-x-auto rounded-md bg-muted p-4 text-sm">
            <code>{stack}</code>
          </pre>
        ) : null}
      </Card>
    </PageShell>
  );
}
