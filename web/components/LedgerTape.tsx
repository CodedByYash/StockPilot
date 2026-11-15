"use client";

import { motion, AnimatePresence } from "motion/react";
import type { RecentActivityRow } from "@/lib/types";

const TYPE_META: Record<
  RecentActivityRow["type"],
  { sign: string; color: string; label: string }
> = {
  inbound: { sign: "+", color: "text-teal", label: "IN" },
  outbound: { sign: "−", color: "text-red", label: "OUT" },
  adjustment: { sign: "±", color: "text-amber", label: "ADJ" },
  transfer: { sign: "→", color: "text-paper-dim", label: "XFER" },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Perforation() {
  return (
    <div
      aria-hidden
      className="h-2 w-full"
      style={{
        backgroundImage: "radial-gradient(circle, var(--color-ink) 2.5px, transparent 3px)",
        backgroundSize: "14px 100%",
        backgroundPosition: "7px 0",
      }}
    />
  );
}

export function LedgerTape({ rows }: { rows: RecentActivityRow[] }) {
  return (
    <div className="bg-surface border border-rule rounded-sm overflow-hidden">
      <Perforation />
      <div className="px-4 py-3 border-b border-rule flex items-baseline justify-between">
        <h2 className="text-sm text-paper" style={{ fontFamily: "var(--font-display)" }}>
          Ledger Tape
        </h2>
        <span className="text-[10px] uppercase tracking-[0.15em] text-paper-dim">Live activity</span>
      </div>

      <div className="max-h-[420px] overflow-y-auto font-mono text-[13px]">
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-paper-dim text-sm">
            No movements recorded yet — the tape starts printing once stock moves.
          </div>
        ) : (
          <AnimatePresence initial={true}>
            {rows.map((row, i) => {
              const meta = TYPE_META[row.type];
              const product = typeof row.productId === "string" ? null : row.productId;
              const warehouse = typeof row.warehouseId === "string" ? null : row.warehouseId;

              return (
                <motion.div
                  key={row._id}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
                  className="flex items-center gap-3 px-4 py-2 border-b border-rule/60 last:border-b-0 hover:bg-surface-2 transition-colors"
                >
                  <span className="text-paper-dim shrink-0 w-[108px]">{formatTime(row.createdAt)}</span>
                  <span className={`shrink-0 w-10 font-bold ${meta.color}`}>{meta.label}</span>
                  <span className="flex-1 min-w-0 truncate text-paper">
                    {product?.name ?? "Unknown product"}
                    <span className="text-paper-dim ml-1.5">{product?.sku ?? ""}</span>
                  </span>
                  <span className="shrink-0 text-paper-dim text-xs hidden sm:inline">
                    {warehouse?.name ?? ""}
                  </span>
                  <span className={`shrink-0 w-16 text-right font-bold ${meta.color}`}>
                    {meta.sign}
                    {row.quantity}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
      <Perforation />
    </div>
  );
}
