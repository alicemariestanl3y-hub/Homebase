import { Suspense } from "react";
import { connection } from "next/server";
import { AuthForm } from "@/components/auth/AuthForm";
import {
  diagnoseSupabaseEnv,
  getSupabaseEnv,
  getSupabasePublicStatus,
  supabaseConfigUserMessage,
} from "@/lib/supabase/env";

async function SignupContent() {
  await connection();
  const env = getSupabaseEnv();
  const diagnosis = diagnoseSupabaseEnv();
  const status = getSupabasePublicStatus();

  return (
    <div className="auth-card">
      <p className="inventory-kicker">Household food</p>
      <h1 className="inventory-brand">HOMEBASE</h1>
      <p className="auth-lead">
        Create an account. We&apos;ll set up your pantry, fridge and freezer.
      </p>

      {env ? (
        <>
          <AuthForm mode="signup" />
          {status.host ? (
            <p className="inventory-demo-note">
              Connected project host: {status.host}
            </p>
          ) : null}
        </>
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
