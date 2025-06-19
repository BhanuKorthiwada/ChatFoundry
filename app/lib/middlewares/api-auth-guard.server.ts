import type { unstable_MiddlewareFunction } from "react-router";
import { serverAuth } from "~/lib/auth/auth.server";
import { authSessionContext } from "~/lib/contexts";

export async function getAuthSession(request: Request) {
  const auth = serverAuth();
  const authSession = await auth.api.getSession({
    headers: request.headers,
    query: {
      disableCookieCache: true,
    },
  });
  return authSession;
}

export const authApiMiddleware: unstable_MiddlewareFunction = async ({ request, context }, next) => {
  const authSession = await getAuthSession(request);

  if (!authSession) {
    console.log("Unauthorized");
    throw Response.json(
      {
        success: false,
        message: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  context.set(authSessionContext, authSession);

  return await next();
};

export const noAuthApiMiddleware: unstable_MiddlewareFunction = async ({ request }, next) => {
  const authSession = await getAuthSession(request);

  if (authSession) {
    console.log("Unauthorized");
    throw Response.json(
      {
        success: false,
        message: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  return await next();
};
