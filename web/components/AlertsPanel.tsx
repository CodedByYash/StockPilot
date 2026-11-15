"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { AlertLog } from "@/lib/types";
import { Stamp } from "./Stamp";

export function AlertsPanel() {
  const [alerts, setAlerts] = useState<AlertLog[] | null>(null);

  useEffect(() => {
    apiFetch<{ alerts: AlertLog[] }>("/alerts", { query: { resolved: "false" } })
      .then((res) => setAlerts(res.alerts))
      .catch(() => setAlerts([]));
  }, []);

  return (
    <div className="bg-surface border border-rule rounded-sm">
      <div className="px-4 py-3 border-b border-rule flex items-center justify-between">
        <h2 className="text-sm text-paper" style={{ fontFamily: "var(--font-display)" }}>
          Open Alerts
        </h2>
        {alerts && alerts.length > 0 && (
          <span className="text-[10px] uppercase tracking-[0.15em] text-red">{alerts.length} open</span>
        )}
      </div>

      {alerts === null ? (
        <div className="px-4 py-8 text-center text-paper-dim text-sm">Loading…</div>
      ) : alerts.length === 0 ? (
        <div className="px-4 py-8 text-center text-paper-dim text-sm">
          Nothing flagged right now — the tape is quiet.
        </div>
      ) : (
        <div className="px-4 py-3 space-y-3">
          {alerts.map((alert) => (
            <div key={alert._id} className="flex items-start gap-3">
              <Stamp
                label={alert.type === "low_stock" ? "Low Stock" : "Reorder"}
                tone={alert.type === "low_stock" ? "red" : "amber"}
              />
              <p className="text-xs text-paper-dim leading-relaxed pt-0.5">{alert.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
