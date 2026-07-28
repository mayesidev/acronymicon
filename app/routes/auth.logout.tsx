import { Form, redirect } from "react-router";

import type { Route } from "./+types/auth.logout";
import { destroySession, getSession } from "../auth/session.server";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Sign out | Acronymicon" }];
}

export async function action({ request }: Route.ActionArgs) {
  const session = await getSession(request.headers.get("Cookie"));

  return redirect("/", {
    headers: {
      "Set-Cookie": await destroySession(session),
    },
  });
}

export default function Logout() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <section className="mx-auto max-w-xl rounded border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold tracking-normal">Sign out</h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          End your Acronymicon session on this browser.
        </p>
        <Form method="post" className="mt-5 flex gap-3">
          <button
            type="submit"
            className="rounded bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Sign out
          </button>
          <a
            href="/"
            className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Cancel
          </a>
        </Form>
      </section>
    </main>
  );
}
