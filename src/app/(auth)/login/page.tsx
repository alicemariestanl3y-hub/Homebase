import { Suspense } from "react";
import { connection } from "next/server";
import { signIn } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/AuthForm";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type LoginContentProps = {
  searchParams: Promise<{ error?: string }>;
};

async function LoginContent({ searchParams }: LoginContentProps) {
  // Secrets exist only at request time on the published host — never decide
  // configured/demo from the build-time prerender.
  await connection();
  const configured = isSupabaseConfigured();
  const params = await searchParams;
  const configError =
    params.error === "supabase_auth" ||
    params.error === "supabase_unreachable";

  return (
    <div className="auth-card">
      <p className="inventory-kicker">Household food</p>
      <h1 className="inventory-brand">HOMEBASE</h1>
      <p className="auth-lead">Sign in to your household inventory.</p>

      {configError ? (
        <p className="auth-error">
          Couldn’t reach your household database. Check that the Project URL
          and publishable key in App Secrets match your Supabase project, then
          try again.
        </p>
      ) : null}

      {configured ? (
        <AuthForm mode="login" action={signIn} />
      ) : (
        <p className="auth-error">
          HomeBase can’t see your household database yet. Open Cursor → App
          Secrets, confirm SUPABASE_URL and SUPABASE_ANON_KEY are saved, then
          pull to refresh this page.
        </p>
      )}
    </div>
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <main className="auth-page">
      <Suspense
        fallback={
          <div className="auth-card">
            <p className="inventory-kicker">Household food</p>
            <h1 className="inventory-brand">HOMEBASE</h1>
            <p className="auth-lead">Loading…</p>
          </div>
        }
      >
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
