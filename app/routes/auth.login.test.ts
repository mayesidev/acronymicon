import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  beginSignIn: vi.fn(),
  isAccessNoticeFormValid: vi.fn(),
  loadAccessNotice: vi.fn(),
}));

vi.mock("../features/authentication/server/workflow", () => ({
  authenticationWorkflow: { beginSignIn: dependencies.beginSignIn },
  safeReturnTo: (value: string | null) => value ?? "/",
}));

vi.mock("../features/deployment-notices/server/api", () => ({
  isAccessNoticeFormValid: dependencies.isAccessNoticeFormValid,
  loadAccessNotice: dependencies.loadAccessNotice,
}));

import { action, loader } from "./auth.login";

beforeEach(() => {
  dependencies.beginSignIn.mockReset().mockResolvedValue({
    status: "redirect",
    location: "https://identity.example.test/authorize",
    cookies: ["flow=state; HttpOnly"],
  });
  dependencies.loadAccessNotice.mockReset();
  dependencies.isAccessNoticeFormValid.mockReset().mockResolvedValue(true);
});

describe("sign-in notice route", () => {
  it("returns the notice before starting the identity flow", async () => {
    dependencies.loadAccessNotice.mockReturnValue({
      text: "Authorized access only.",
      token: "signed-token",
    });

    await expect(loader({ request: loginRequest() } as never)).resolves.toEqual({
      text: "Authorized access only.",
      token: "signed-token",
      returnTo: "/submit",
    });
    expect(dependencies.beginSignIn).not.toHaveBeenCalled();
  });

  it("starts sign-in after the notice form is submitted", async () => {
    const request = loginRequest("POST");
    const response = await action({ request } as never);

    expect(dependencies.beginSignIn).toHaveBeenCalledWith(request);
    if (!(response instanceof Response)) {
      throw new Error("Expected the sign-in redirect.");
    }
    expect(response.headers.get("Location")).toBe(
      "https://identity.example.test/authorize",
    );
    expect(response.headers.get("Set-Cookie")).toBe("flow=state; HttpOnly");
  });

  it("returns to the notice without starting sign-in for an invalid form", async () => {
    dependencies.isAccessNoticeFormValid.mockResolvedValue(false);
    const response = await action({ request: loginRequest("POST") } as never);

    expect(dependencies.beginSignIn).not.toHaveBeenCalled();
    if (!(response instanceof Response)) {
      throw new Error("Expected a redirect back to the notice.");
    }
    expect(response.headers.get("Location")).toBe(
      "/auth/login?returnTo=%2Fsubmit",
    );
  });

  it("preserves direct sign-in for deployments without a notice", async () => {
    const request = loginRequest();
    const response = await loader({ request } as never);

    expect(dependencies.beginSignIn).toHaveBeenCalledWith(request);
    if (!(response instanceof Response)) {
      throw new Error("Expected the sign-in redirect.");
    }
    expect(response.headers.get("Location")).toBe(
      "https://identity.example.test/authorize",
    );
  });
});

function loginRequest(method = "GET") {
  return new Request("https://app.example.test/auth/login?returnTo=%2Fsubmit", {
    method,
  });
}
