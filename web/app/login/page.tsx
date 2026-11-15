"use client";

import { useState, FormEvent } from "react";
import { useAuth, ApiError } from "@/lib/auth-context";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-[11px] uppercase tracking-[0.25em] text-paper-dim mb-1">Vol. I — Est. 2026</div>
          <h1 className="text-3xl text-paper" style={{ fontFamily: "var(--font-display)" }}>
            Ledger
          </h1>
          <p className="text-sm text-paper-dim mt-1">Sign in to your inventory ledger</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface border border-rule rounded-sm p-6">
          <div className="mb-4">
            <label htmlFor="email" className="block text-xs uppercase tracking-wide text-paper-dim mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-ink border border-rule rounded-sm px-3 py-2 text-paper text-sm outline-none focus:border-amber transition-colors"
              placeholder="you@company.com"
            />
          </div>

          <div className="mb-5">
            <label htmlFor="password" className="block text-xs uppercase tracking-wide text-paper-dim mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-ink border border-rule rounded-sm px-3 py-2 text-paper text-sm outline-none focus:border-amber transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="mb-4 text-sm text-red border border-red-dim bg-red-dim/40 rounded-sm px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-amber text-ink font-medium text-sm rounded-sm py-2.5 hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-xs text-paper-dim mt-4">
          First time? Registering the first user makes them an admin — see the API README.
        </p>
      </div>
    </div>
  );
}
