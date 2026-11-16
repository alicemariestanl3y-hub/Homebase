import { Suspense } from "react";
import { connection } from "next/server";
import { signIn } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/AuthForm";
import {
  diagnoseSupabaseEnv,
  getSupabaseEnv,
  supabaseConfigUserMessage,
} from "@/lib/supabase/env";

type LoginContentProps = {
  searchParams: Promise<{ error?: string }>;
};

async function LoginContent({ searchParams }: LoginContentProps) {
  // Secrets exist only at request time on the published host.
  await connection();
  const env = getSupabaseEnv();
  const diagnosis = diagnoseSupabaseEnv();
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
          Couldn’t verify your session with Supabase. Try signing in below. If
          it keeps failing, re-save App Secrets: SUPABASE_URL =
          https://YOUR_REF.supabase.co and SUPABASE_ANON_KEY = the
          anon/publishable key (not the service-role key), then republish.
        </p>
      ) : null}

      {env ? (
        <AuthForm mode="login" action={signIn} />
      ) : (
        <>
          <p className="auth-error">
            {supabaseConfigUserMessage(diagnosis.reason)} Re-save both App
            Secrets, then ask me to republish.
          </p>
          <p className="inventory-demo-note">
            Check: URL {diagnosis.hasUrl ? "present" : "missing"}
            {diagnosis.hasUrl
              ? diagnosis.urlOk
                ? " (shape ok)"
                : " (shape invalid)"
              : ""}
            ; key {diagnosis.hasAnonKey ? "present" : "missing"}
            {diagnosis.hasAnonKey
              ? diagnosis.keyLooksLikeJwt
                ? " (length ok)"
                : " (too short)"
              : ""}
            .
          </p>
        </>
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
