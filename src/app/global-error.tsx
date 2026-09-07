"use client";

/**
 * Replaces the entire document when the root layout itself fails, so it must
 * render its own <html> and inline its styles.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          background: "#f7f8fa",
          color: "#1f2233",
        }}
      >
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>
            AGS Dismissals is temporarily unavailable
          </h1>
          <p style={{ marginTop: 12, lineHeight: 1.6, color: "#5c6076" }}>
            Please reload the page. If this continues, contact your school administrator.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              padding: "12px 22px",
              borderRadius: 14,
              border: "none",
              background: "#5b4bdb",
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
