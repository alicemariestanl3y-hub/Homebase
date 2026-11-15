import { signUp } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/AuthForm";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default function SignupPage() {
  const configured = isSupabaseConfigured();

  return (
    <main className="auth-page">
      <div className="auth-card">
        <p className="inventory-kicker">Household food</p>
        <h1 className="inventory-brand">HomeBase</h1>
        <p className="auth-lead">
          Create an account. We&apos;ll set up your pantry, fridge and freezer.
        </p>

        {configured ? (
          <AuthForm mode="signup" action={signUp} />
        ) : (
          <p className="auth-error">
            Supabase is not connected yet. Add SUPABASE_URL and
            SUPABASE_ANON_KEY, then refresh.
          </p>
        )}
      </div>
    </main>
  );
}
