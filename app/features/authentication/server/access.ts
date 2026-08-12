import { redirect } from "react-router";

import {
  getAppConfig,
  type AppConfig,
} from "../../../platform/config/runtime.server";
import { getOptionalUser } from "./session";
import { safeReturnTo } from "./workflow";

export async function authorizeDictionaryAccess(
  request: Request,
  config: AppConfig = getAppConfig(),
) {
  const user = await getOptionalUser(request);

  if (user || config.deployment.dictionaryAccess === "open") {
    return user;
  }

  const requestUrl = new URL(request.url);
  const returnTo = safeReturnTo(`${requestUrl.pathname}${requestUrl.search}`);

  return redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
}
