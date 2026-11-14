import { signIn } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/AuthForm";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default function LoginPage() {
  const configured = isSupabaseConfigured();

  return (
    <main className="auth-page">
      <div className="auth-card">
        <p className="inventory-kicker">Household food</p>
        <h1 className="inventory-brand">HomeBase</h1>
        <p className="auth-lead">Sign in to your household inventory.</p>

        {configured ? (
          <AuthForm mode="login" action={signIn} />
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
