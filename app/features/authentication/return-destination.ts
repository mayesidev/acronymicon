const applicationOrigin = "https://acronymicon.invalid";
const entryIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function controlledReturnDestination(value: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  let url: URL;
  try {
    url = new URL(value, applicationOrigin);
  } catch {
    return "/";
  }

  if (url.origin !== applicationOrigin || url.pathname.endsWith(".data")) {
    return "/";
  }

  const pathname =
    url.pathname !== "/" && url.pathname.endsWith("/")
      ? url.pathname.slice(0, -1)
      : url.pathname;

  if (["/", "/submit", "/about"].includes(pathname)) {
    return pathname;
  }

  if (pathname === "/define") {
    return url.searchParams.has("acr") || url.searchParams.has("var")
      ? "/"
      : "/define";
  }

  const entryId = pathname.match(/^\/define\/([^/]+)$/)?.[1];
  if (!entryId || !entryIdPattern.test(entryId)) {
    return "/";
  }

  const parameters = new URLSearchParams();
  if (url.searchParams.get("view") === "all") {
    parameters.set("view", "all");
  }
  if (url.searchParams.get("sort") === "recent") {
    parameters.set("sort", "recent");
  }

  const query = parameters.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}
