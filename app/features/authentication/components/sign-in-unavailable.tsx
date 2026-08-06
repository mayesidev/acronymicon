import { TextLink } from "../../../ui/components/link";

export function SignInUnavailable() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <section className="mx-auto max-w-xl rounded border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold tracking-normal">
          Sign-in is not configured
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Browsing is available, but acronym submission requires OIDC
          configuration. Set the OIDC environment variables before using
          sign-in.
        </p>
        <TextLink href="/" className="mt-5 inline-block text-sm">
          Return to dictionary
        </TextLink>
      </section>
    </main>
  );
}
