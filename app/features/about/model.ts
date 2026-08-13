export const sourceRepositoryUrl =
  "https://github.com/mayesidev/acronymicon";
export const licenseUrl = `${sourceRepositoryUrl}/blob/main/LICENSE`;

const applicationOrigin = "https://acronymicon.invalid";

export function buildAboutHref(returnTo: string) {
  const searchParameters = new URLSearchParams({
    returnTo: resolveAboutReturnTo(returnTo),
  });

  return `/about?${searchParameters.toString()}`;
}

export function resolveAboutReturnTo(value: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  try {
    const url = new URL(value, applicationOrigin);

    if (
      url.origin !== applicationOrigin ||
      url.pathname.endsWith(".data") ||
      (url.pathname === "/define" &&
        (url.searchParams.has("acr") || url.searchParams.has("var")))
    ) {
      return "/";
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
