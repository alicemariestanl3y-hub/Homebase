"use client";

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
          The app hit a server error while loading. This is often a Supabase
          connection or auth configuration issue.
        </p>
        {error?.digest ? (
          <p className="inventory-demo-note">Error id: {error.digest}</p>
        ) : null}
        <button type="button" className="auth-submit" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
