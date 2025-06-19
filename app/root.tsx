import { Links, Meta, Outlet, Scripts, ScrollRestoration, data } from "react-router";
import { getToast } from "remix-toast";
import { Toaster, toast as notify } from "sonner";

import { ProgressBar } from "./components/progress-bar";
import { useNonce } from "./hooks/use-nonce";
import "./styles/app.css";
import { useEffect } from "react";
import type { Route } from "./+types/root";
import { GeneralErrorBoundary } from "./components/error-boundary";
import { ColorSchemeScript, useColorScheme } from "./lib/color-scheme/components";
import { parseColorScheme } from "./lib/color-scheme/server";
import { getPublicEnv } from "./lib/env.server";
import { requestMiddleware } from "./lib/http.server";

export const links: Route.LinksFunction = () => [
  {
    rel: "preconnect",
    href: "https://fonts.bunny.net",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.bunny.net/css2?family=Geist:wght@100..900&display=swap",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.bunny.net/css2?family=Geist+Mono:wght@100..900&display=swap",
  },
];

export async function loader({ request }: Route.LoaderArgs) {
  await requestMiddleware(request);
  const colorScheme = await parseColorScheme(request);
  const { toast, headers } = await getToast(request);

  return data({ ENV: getPublicEnv(), colorScheme, toast }, { headers });
}

export function Layout({ children }: { children: React.ReactNode }) {
  const nonce = useNonce();
  const colorScheme = useColorScheme();

  return (
    <html
      lang="en"
      className={`${colorScheme === "dark" ? "dark" : ""} touch-manipulation overflow-x-hidden`}
      suppressHydrationWarning
    >
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="application-name" content="ChatFoundry" />
        <meta name="theme-color" content="#ffffff" />
        <link rel="icon" type="image/png" href="/icons/favicon-96x96.png" sizes="96x96" />
        <link rel="icon" type="image/svg+xml" href="/icons/favicon.svg" />
        <link rel="shortcut icon" href="/icons/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-title" content="ChatFoundry" />
        <link rel="manifest" href="/icons/site.webmanifest" />
        <Meta />
        <Links />
        <ColorSchemeScript nonce={nonce} />
      </head>
      <body>
        <ProgressBar />
        {children}
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
        <Toaster position="top-center" theme={colorScheme} />
      </body>
    </html>
  );
}

export default function App(_: Route.ComponentProps) {
  const { ENV, toast } = _.loaderData;
  const nonce = useNonce();

  useEffect(() => {
    if (toast?.type === "error") {
      notify.error(toast.message);
    }
    if (toast?.type === "success") {
      notify.success(toast.message);
    }
  }, [toast]);

  return (
    <>
      <Outlet />
      <script
        nonce={nonce}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
        dangerouslySetInnerHTML={{
          __html: `window.ENV = ${JSON.stringify(ENV)}`,
        }}
      />
    </>
  );
}

export function ErrorBoundary() {
  return <GeneralErrorBoundary />;
}
