"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { KpiCard } from "@/components/KpiCard";
import { LedgerTape } from "@/components/LedgerTape";
import { TopMovers } from "@/components/TopMovers";
import { AlertsPanel } from "@/components/AlertsPanel";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { DashboardSummary } from "@/lib/types";
import { useRouter } from "next/navigation";

function formatCurrency(n: number): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    apiFetch<DashboardSummary>("/dashboard/summary")
      .then(setSummary)
      .catch(() => setError("Couldn't load the dashboard. Is the API running?"));
  }, [user]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center text-paper-dim text-sm">
        Loading…
      </div>
    );
  }

  return (
    <AppShell>
      <div className="px-8 py-6 max-w-6xl">
        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-[0.2em] text-paper-dim mb-1">Overview</div>
          <h1 className="text-2xl text-paper" style={{ fontFamily: "var(--font-display)" }}>
            Good to see you, {user.name.split(" ")[0]}
          </h1>
        </div>

        {error && (
          <div className="mb-6 text-sm text-red border border-red-dim bg-red-dim/40 rounded-sm px-4 py-3">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <KpiCard
            label="Stock Value"
            value={summary ? formatCurrency(summary.totalStockValue) : "—"}
            hint="Across all active products"
          />
          <KpiCard
            label="Total Units"
            value={summary ? summary.totalUnits.toLocaleString() : "—"}
            hint="On hand right now"
          />
          <KpiCard
            label="Open Alerts"
            value={summary ? String(summary.lowStockOpenAlerts) : "—"}
            tone={summary && summary.lowStockOpenAlerts > 0 ? "red" : "default"}
            hint="Needing attention"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <LedgerTape rows={summary?.recentActivity ?? []} />
          </div>
          <div className="space-y-4">
            <AlertsPanel />
            <TopMovers rows={summary?.topMovers ?? []} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
