import { Suspense } from "react";
import { connection } from "next/server";
import { signUp } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/AuthForm";
import { isSupabaseConfigured } from "@/lib/supabase/env";

async function SignupContent() {
  await connection();
  const configured = isSupabaseConfigured();

  return (
    <div className="auth-card">
      <p className="inventory-kicker">Household food</p>
      <h1 className="inventory-brand">HOMEBASE</h1>
      <p className="auth-lead">
        Create an account. We&apos;ll set up your pantry, fridge and freezer.
      </p>

      {configured ? (
        <AuthForm mode="signup" action={signUp} />
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

export default function SignupPage() {
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
        <SignupContent />
      </Suspense>
    </main>
  );
}
