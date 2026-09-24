import { createHmac, timingSafeEqual } from "node:crypto";

import { getAppConfig } from "../../../platform/config/runtime.server";

const noticeTokenLifetimeSeconds = 5 * 60;

export function loadAccessNotice() {
  const config = getAppConfig();
  if (!config.oidc || !config.notices.access) {
    return null;
  }

  const issuedAt = Math.floor(Date.now() / 1_000);
  return {
    text: config.notices.access,
    token: `${issuedAt}.${signNoticeToken(issuedAt, config.session.secret)}`,
  };
}

export async function isAccessNoticeFormValid(request: Request) {
  const config = getAppConfig();
  if (!config.oidc || !config.notices.access) {
    return true;
  }

  let token: FormDataEntryValue | null;
  try {
    token = (await request.formData()).get("noticeToken");
  } catch {
    return false;
  }
  if (typeof token !== "string") {
    return false;
  }

  const match = /^(\d+)\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match) {
    return false;
  }

  const issuedAt = Number(match[1]);
  const now = Math.floor(Date.now() / 1_000);
  if (
    !Number.isSafeInteger(issuedAt) ||
    issuedAt > now ||
    now - issuedAt > noticeTokenLifetimeSeconds
  ) {
    return false;
  }

  const actual = Buffer.from(match[2], "base64url");
  const expected = Buffer.from(
    signNoticeToken(issuedAt, config.session.secret),
    "base64url",
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function loadSensitivityLabel() {
  return getAppConfig().notices.sensitivityLabel;
}

function signNoticeToken(issuedAt: number, secret: string) {
  return createHmac("sha256", secret)
    .update(`access-notice:${issuedAt}`)
    .digest("base64url");
}
