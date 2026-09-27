import { applicationVersion } from "../../../platform/config/build-metadata";
import { getAppConfig } from "../../../platform/config/runtime.server";
import { resolveAboutReturnTo } from "../model";

export function loadAboutPage(
  request: Request,
  controlled = getAppConfig().deployment.profile === "controlled",
) {
  const searchParameters = new URL(request.url).searchParams;

  return {
    returnTo: resolveAboutReturnTo(searchParameters.get("returnTo"), controlled),
    version: applicationVersion,
  };
}
