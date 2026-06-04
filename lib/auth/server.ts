import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";

export class AuthRequiredError extends Error {
  constructor() {
    super("Authentication is required.");
    this.name = "AuthRequiredError";
  }
}

export function isAuthRequiredError(error: unknown) {
  return error instanceof AuthRequiredError;
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export async function requireAuthenticatedUser(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    throw new AuthRequiredError();
  }

  const {
    data: { user },
    error
  } = await getSupabaseAdmin().auth.getUser(token);

  if (error || !user) {
    throw new AuthRequiredError();
  }

  return user;
}
