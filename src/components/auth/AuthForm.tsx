"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { AuthActionState } from "@/app/actions/auth";

type AuthFormProps = {
  mode: "login" | "signup";
  action: (
    prev: AuthActionState,
    formData: FormData,
  ) => Promise<AuthActionState>;
};

const initialState: AuthActionState = { error: null, message: null };

export function AuthForm({ mode, action }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const isSignup = mode === "signup";

  return (
    <form className="auth-form" action={formAction}>
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

      {state.error ? <p className="auth-error">{state.error}</p> : null}
      {state.message ? <p className="auth-success">{state.message}</p> : null}

      <button className="auth-submit" type="submit" disabled={pending}>
        {pending ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
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
