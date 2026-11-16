"use client";

import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <p className="inventory-kicker">HomeBase</p>
        <h1 className="inventory-brand">Something went wrong</h1>
        <p className="auth-lead">
          The app hit an unexpected error while loading. Tap try again, or go
          back to sign in.
        </p>
        {error?.digest ? (
          <p className="inventory-demo-note">Error id: {error.digest}</p>
        ) : null}
        <button type="button" className="auth-submit" onClick={reset}>
          Try again
        </button>
        <p className="auth-switch">
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
