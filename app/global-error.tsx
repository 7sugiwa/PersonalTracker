"use client";

// Fires when the ROOT layout itself fails, so it can't rely on
// globals.css tokens, AppShell, or any other app chrome — it must
// define its own <html>/<body> and stay dependency-free. Per the Next
// docs, global-error renders its own document and doesn't inherit the
// app's theme class, so this uses plain inline styles rather than
// Tailwind utility classes that assume the token layer is present.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          color: "#0b0b0b",
          background: "#f7f7f6",
        }}
      >
        <p style={{ fontSize: 14, fontWeight: 500 }}>Something went wrong.</p>
        {error.digest && (
          <p style={{ fontSize: 12, fontFamily: "ui-monospace, monospace", color: "#898781" }}>
            {error.digest}
          </p>
        )}
        <button
          onClick={() => retry()}
          style={{
            marginTop: 8,
            padding: "8px 12px",
            fontSize: 14,
            fontWeight: 500,
            borderRadius: 8,
            border: "1px solid #d3d3ce",
            background: "#ffffff",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
