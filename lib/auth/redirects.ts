const DEFAULT_AUTH_REDIRECT_TARGET = "/chat";
const AUTH_REDIRECT_TARGETS = new Set(["/chat", "/memories"]);

export function getAuthRedirectTarget(nextPath?: string | null) {
  const rawPath = typeof nextPath === "string" ? nextPath.trim() : "";
  const pathname = rawPath.split(/[?#]/)[0].replace(/\/+$/, "");

  if (AUTH_REDIRECT_TARGETS.has(pathname)) {
    return pathname;
  }

  return DEFAULT_AUTH_REDIRECT_TARGET;
}
