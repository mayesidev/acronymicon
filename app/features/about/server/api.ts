import { applicationVersion } from "../../../platform/config/build-metadata";
import { resolveAboutReturnTo } from "../model";

export function loadAboutPage(request: Request) {
  const searchParameters = new URL(request.url).searchParams;

  return {
    returnTo: resolveAboutReturnTo(searchParameters.get("returnTo")),
    version: applicationVersion,
  };
}
