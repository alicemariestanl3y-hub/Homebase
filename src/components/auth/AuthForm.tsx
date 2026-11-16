"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

type AuthFormProps = {
  mode: "login" | "signup";
};

type AuthResponse = {
  error: string | null;
  message: string | null;
  redirectTo: string | null;
  reachedAuthApi?: boolean;
};

export function AuthForm({ mode }: AuthFormProps) {
  const isSignup = mode === "signup";
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const endpoint = isSignup ? "/api/auth/signup" : "/api/auth/signin";

    startTransition(async () => {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          body: formData,
          credentials: "same-origin",
        });

        let payload: AuthResponse;
        try {
          payload = (await response.json()) as AuthResponse;
        } catch {
          setError(
            `Auth request failed (${response.status}). The server did not return JSON — signup likely never reached Supabase.`,
          );
          return;
        }

        if (payload.error) {
          const hint =
            payload.reachedAuthApi === false
              ? " (Supabase Auth was not contacted — check App Secrets URL/key and /api/status.)"
              : "";
          setError(`${payload.error}${hint}`);
          return;
        }

        if (payload.message) {
          setMessage(payload.message);
          return;
        }

        if (payload.redirectTo) {
          setRedirecting(true);
          setMessage("Signed in — opening your kitchen…");
          window.location.assign(payload.redirectTo);
          return;
        }

        setError("Unexpected auth response. Please try again.");
      } catch (err) {
        const text =
          err instanceof Error ? err.message : "Network error during signup.";
        setError(text);
      }
    });
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      {isSignup ? (
        <label className="auth-field">
          <span>Household name</span>
          <input
            name="householdName"
            type="text"
            placeholder="Stanley Kitchen"
            autoComplete="organization"
            defaultValue="My Kitchen"
          />
        </label>
      ) : null}

      <label className="auth-field">
        <span>Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
      </label>

      <label className="auth-field">
        <span>Password</span>
        <input
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete={isSignup ? "new-password" : "current-password"}
          placeholder="At least 6 characters"
        />
      </label>

      {error ? <p className="auth-error">{error}</p> : null}
      {message ? <p className="auth-success">{message}</p> : null}

      <button
        className="auth-submit"
        type="submit"
        disabled={pending || redirecting}
      >
        {pending || redirecting
          ? "Please wait…"
          : isSignup
            ? "Create account"
            : "Sign in"}
      </button>

      <p className="auth-switch">
        {isSignup ? (
          <>
            Already have an account? <Link href="/login">Sign in</Link>
          </>
        ) : (
          <>
            New here? <Link href="/signup">Create an account</Link>
          </>
        )}
      </p>
    </form>
  );
}
