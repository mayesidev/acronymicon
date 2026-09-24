import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ getAppConfig: vi.fn() }));

vi.mock("../../../platform/config/runtime.server", () => ({
  getAppConfig: dependencies.getAppConfig,
}));

import { isAccessNoticeFormValid, loadAccessNotice } from "./api";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-24T10:00:00.000Z"));
  dependencies.getAppConfig.mockReset().mockReturnValue({
    oidc: { clientId: "test" },
    notices: { access: "Authorized access only." },
    session: { secret: "test-session-secret" },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("access notice presentation token", () => {
  it("allows the submitted notice form for the same sign-in destination", async () => {
    const notice = loadAccessNotice();

    expect(notice?.text).toBe("Authorized access only.");
    expect(notice?.token).toBeTruthy();
    expect(
      await isAccessNoticeFormValid(loginRequest("POST", notice?.token)),
    ).toBe(true);
  });

  it("rejects missing, forged, and expired presentation tokens", async () => {
    const token = loadAccessNotice()?.token;

    expect(await isAccessNoticeFormValid(loginRequest("POST"))).toBe(false);
    const [issuedAt, signature] = token?.split(".") ?? [];
    const forgedToken = `${issuedAt}.${signature?.startsWith("A") ? "B" : "A"}${signature?.slice(1)}`;
    expect(await isAccessNoticeFormValid(loginRequest("POST", forgedToken))).toBe(
      false,
    );

    vi.setSystemTime(new Date("2026-09-24T10:06:00.000Z"));
    expect(await isAccessNoticeFormValid(loginRequest("POST", token))).toBe(
      false,
    );
  });

  it("does not require a token when no notice is configured", async () => {
    dependencies.getAppConfig.mockReturnValue({
      oidc: { clientId: "test" },
      notices: { access: undefined },
      session: { secret: "test-session-secret" },
    });

    expect(loadAccessNotice()).toBeNull();
    expect(await isAccessNoticeFormValid(loginRequest("POST"))).toBe(true);
  });
});

function loginRequest(method = "GET", token?: string) {
  return new Request("https://app.example.test/auth/login?returnTo=%2Fsubmit", {
    method,
    ...(method === "POST"
      ? { body: new URLSearchParams(token ? { noticeToken: token } : {}) }
      : {}),
  });
}
