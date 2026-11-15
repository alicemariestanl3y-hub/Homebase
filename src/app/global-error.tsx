"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-AU">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#1f3d2f",
          color: "#1c1c1c",
          padding: "1.25rem",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "24rem",
            background: "#f7f5f1",
            borderRadius: "1rem",
            padding: "1.35rem",
          }}
        >
          <p style={{ margin: 0, letterSpacing: "0.12em", fontWeight: 700 }}>
            HOMEBASE
          </p>
          <h1 style={{ margin: "0.5rem 0 0", fontSize: "1.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#6b6a66", lineHeight: 1.45 }}>
            The app hit a server error while loading. Tap try again, or reopen
            the app from Cursor.
          </p>
          {error?.digest ? (
            <p style={{ fontSize: "0.8rem", color: "#6b6a66" }}>
              Error id: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "0.75rem",
              width: "100%",
              border: 0,
              borderRadius: "0.75rem",
              background: "#1f3d2f",
              color: "#fff",
              fontWeight: 700,
              padding: "0.85rem",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
