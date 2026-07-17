import { useState, type FormEvent } from "react";
import { api } from "../api/client";

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.login(password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh", background: "var(--bg)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: "100%", maxWidth: 360, background: "var(--card, #1C1917)",
          border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12,
          padding: 28, display: "flex", flexDirection: "column", gap: 16,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "#D97757", fontWeight: 800, fontSize: 22, letterSpacing: "-0.3px" }}>Vanakias</div>
          <div style={{ color: "var(--muted, #A8A29E)", fontSize: 13, marginTop: 4 }}>Sign in to continue</div>
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          autoComplete="current-password"
          style={{
            padding: "10px 12px", borderRadius: 8, fontSize: 14,
            border: "1px solid rgba(255,255,255,0.15)", background: "var(--bg)",
            color: "var(--text, #FFF)", outline: "none",
          }}
        />
        {error && <div style={{ color: "#F87171", fontSize: 13 }}>{error}</div>}
        <button
          type="submit"
          disabled={submitting || !password}
          style={{
            padding: "10px 12px", borderRadius: 8, fontSize: 14, fontWeight: 600,
            border: "none", cursor: submitting || !password ? "not-allowed" : "pointer",
            background: "#D97757", color: "#FFF", opacity: submitting || !password ? 0.6 : 1,
          }}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
