import type { TopMoverRow } from "@/lib/types";

export function TopMovers({ rows }: { rows: TopMoverRow[] }) {
  const max = Math.max(...rows.map((r) => r.totalOutbound), 1);

  return (
    <div className="bg-surface border border-rule rounded-sm">
      <div className="px-4 py-3 border-b border-rule">
        <h2 className="text-sm text-paper" style={{ fontFamily: "var(--font-display)" }}>
          Top Movers
        </h2>
        <span className="text-[10px] uppercase tracking-[0.15em] text-paper-dim">Last 30 days</span>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-paper-dim text-sm">
          No outbound movement in the last 30 days yet.
        </div>
      ) : (
        <div className="px-4 py-3 space-y-3">
          {rows.map((row, i) => (
            <div key={row.productId} className="flex items-center gap-3">
              <span className="text-paper-dim font-mono text-xs w-4 shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-sm text-paper truncate">{row.productName}</span>
                  <span className="text-xs font-mono text-paper-dim shrink-0">{row.totalOutbound} units</span>
                </div>
                <div className="h-1.5 bg-ink rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber rounded-full"
                    style={{ width: `${(row.totalOutbound / max) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
