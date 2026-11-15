import { Suspense } from "react";
import { signIn } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/AuthForm";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type LoginContentProps = {
  searchParams: Promise<{ error?: string }>;
};

async function LoginContent({ searchParams }: LoginContentProps) {
  const configured = isSupabaseConfigured();
  const params = await searchParams;
  const configError =
    params.error === "supabase_auth" ||
    params.error === "supabase_unreachable";

  return (
    <div className="auth-card">
      <p className="inventory-kicker">Household food</p>
      <h1 className="inventory-brand">HomeBase</h1>
      <p className="auth-lead">Sign in to your household inventory.</p>

      {configError ? (
        <p className="auth-error">
          Couldn’t reach Supabase with the configured URL/key. Confirm
          SUPABASE_URL is the Project URL and SUPABASE_ANON_KEY is the
          publishable/anon key (not the secret service-role key).
        </p>
      ) : null}

      {configured ? (
        <AuthForm mode="login" action={signIn} />
      ) : (
        <p className="auth-error">
          Supabase is not connected yet. Add SUPABASE_URL and
          SUPABASE_ANON_KEY, then refresh.
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
            <h1 className="inventory-brand">HomeBase</h1>
            <p className="auth-lead">Loading…</p>
          </div>
        }
      >
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
