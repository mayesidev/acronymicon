import { Form } from "react-router";

import type { AuthUser } from "../features/authentication/model";

export function HeaderActions({ user }: { user: AuthUser | null }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm md:justify-end">
      <a
        href="/submit"
        className="rounded bg-slate-950 px-4 py-2 font-medium text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
      >
        Submit acronym
      </a>

      {user ? (
        <div
          role="group"
          aria-label="Account"
          className="border-l border-slate-200 pl-4"
        >
          <p className="text-xs text-slate-500">Signed in as</p>
          <div className="mt-0.5 flex items-center gap-3">
            <span className="font-semibold text-slate-800">
              {user.displayName ?? user.username}
            </span>
            <Form method="post" action="/auth/logout">
              <button type="submit" className="text-link">
                Sign out
              </button>
            </Form>
          </div>
        </div>
      ) : (
        <a href="/auth/login" className="text-link">
          Sign in
        </a>
      )}
    </div>
  );
}
