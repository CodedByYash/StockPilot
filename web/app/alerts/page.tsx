"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Stamp } from "@/components/Stamp";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { AlertLog } from "@/lib/types";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AlertsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [alerts, setAlerts] = useState<AlertLog[]>([]);
  const [filter, setFilter] = useState<"open" | "resolved" | "all">("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const canRunChecks = user?.role === "admin" || user?.role === "manager";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = filter === "all" ? {} : { resolved: filter === "resolved" ? "true" : "false" };
      const res = await apiFetch<{ alerts: AlertLog[] }>("/alerts", { query });
      setAlerts(res.alerts);
    } catch {
      setError("Couldn't load alerts. Is the API running?");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function handleResolve(alert: AlertLog) {
    try {
      await apiFetch(`/alerts/${alert._id}/resolve`, { method: "PATCH" });
      await load();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  }

  async function handleRunChecks() {
    setChecking(true);
    try {
      await Promise.all([
        apiFetch("/alerts/run-check", { method: "POST" }),
        apiFetch("/forecast/run-check", { method: "POST" }),
      ]);
      await load();
    } catch {
      setError("Couldn't run the checks right now.");
    } finally {
      setChecking(false);
    }
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center text-paper-dim text-sm">
        Loading…
      </div>
    );
  }

  return (
    <AppShell>
      <div className="px-8 py-6 max-w-4xl">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-paper-dim mb-1">Attention needed</div>
            <h1 className="text-2xl text-paper" style={{ fontFamily: "var(--font-display)" }}>
              Alerts
            </h1>
          </div>
          {canRunChecks && (
            <button
              onClick={handleRunChecks}
              disabled={checking}
              className="px-4 py-2 bg-amber text-ink font-medium text-sm rounded-sm hover:brightness-110 transition disabled:opacity-50"
            >
              {checking ? "Running…" : "Run checks now"}
            </button>
          )}
        </div>

        <div className="flex gap-1 mb-4 text-xs">
          {(["open", "resolved", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-sm uppercase tracking-wide transition-colors ${
                filter === f ? "bg-surface-2 text-paper border border-rule" : "text-paper-dim hover:text-paper"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 text-sm text-red border border-red-dim bg-red-dim/40 rounded-sm px-4 py-3">
            {error}
          </div>
        )}

        <div className="bg-surface border border-rule rounded-sm divide-y divide-rule/60">
          {loading ? (
            <div className="px-4 py-10 text-center text-paper-dim text-sm">Loading…</div>
          ) : alerts.length === 0 ? (
            <div className="px-4 py-10 text-center text-paper-dim text-sm">
              {filter === "open" ? "Nothing flagged right now — the tape is quiet." : "No alerts here."}
            </div>
          ) : (
            alerts.map((alert) => (
              <div key={alert._id} className="px-4 py-4 flex items-start gap-4">
                <Stamp
                  label={alert.type === "low_stock" ? "Low Stock" : "Reorder"}
                  tone={alert.type === "low_stock" ? "red" : "amber"}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-paper-dim leading-relaxed">{alert.message}</p>
                  <p className="text-[11px] text-paper-dim/70 mt-1 font-mono">{formatTime(alert.createdAt)}</p>
                </div>
                {!alert.resolved && (
                  <button
                    onClick={() => handleResolve(alert)}
                    className="shrink-0 text-xs text-paper-dim hover:text-teal transition-colors underline underline-offset-2"
                  >
                    Mark resolved
                  </button>
                )}
                {alert.resolved && <span className="shrink-0 text-xs text-teal">Resolved</span>}
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
