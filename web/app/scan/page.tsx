"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { Field, inputClass } from "@/components/Field";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { BarcodeLookupResponse, Warehouse } from "@/lib/types";

const MOVEMENT_TYPES = [
  { value: "inbound", label: "Receive (inbound)" },
  { value: "outbound", label: "Ship / remove (outbound)" },
  { value: "adjustment", label: "Correct count (adjustment)" },
] as const;

function warehouseName(row: BarcodeLookupResponse["stockByWarehouse"][number]): string {
  return typeof row.warehouseId === "string" ? row.warehouseId : row.warehouseId.name;
}

export default function ScanPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [manualCode, setManualCode] = useState("");
  const [lookupCode, setLookupCode] = useState<string | null>(null);
  const [result, setResult] = useState<BarcodeLookupResponse | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [loadingLookup, setLoadingLookup] = useState(false);

  // record-movement mini form state
  const [moveWarehouseId, setMoveWarehouseId] = useState("");
  const [moveType, setMoveType] = useState<(typeof MOVEMENT_TYPES)[number]["value"]>("inbound");
  const [moveQty, setMoveQty] = useState("1");
  const [moveSubmitting, setMoveSubmitting] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moveSuccess, setMoveSuccess] = useState<string | null>(null);

  const canRecord = user?.role === "admin" || user?.role === "manager" || user?.role === "staff";

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    apiFetch<{ warehouses: Warehouse[] }>("/warehouses")
      .then((res) => {
        setWarehouses(res.warehouses);
        if (res.warehouses[0]) setMoveWarehouseId(res.warehouses[0]._id);
      })
      .catch(() => {
        /* warehouse list is only needed for the record-movement form; lookup still works without it */
      });
  }, [user]);

  const runLookup = useCallback(async (code: string) => {
    setLookupCode(code);
    setLoadingLookup(true);
    setLookupError(null);
    setResult(null);
    setMoveSuccess(null);
    try {
      const res = await apiFetch<BarcodeLookupResponse>(`/barcode/${encodeURIComponent(code)}`);
      setResult(res);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setLookupError(`No product found for barcode "${code}".`);
      } else {
        setLookupError("Couldn't look that up right now.");
      }
    } finally {
      setLoadingLookup(false);
    }
  }, []);

  function handleDetected(code: string) {
    if (code === lookupCode) return; // avoid re-firing on the same frame's repeat detections
    runLookup(code);
  }

  function handleManualSubmit(e: FormEvent) {
    e.preventDefault();
    if (manualCode.trim()) runLookup(manualCode.trim());
  }

  function reset() {
    setLookupCode(null);
    setResult(null);
    setLookupError(null);
    setMoveSuccess(null);
    setManualCode("");
  }

  async function handleRecordMovement(e: FormEvent) {
    e.preventDefault();
    if (!result || !lookupCode) return;
    setMoveError(null);
    setMoveSubmitting(true);
    try {
      await apiFetch("/barcode/movements", {
        method: "POST",
        body: {
          barcode: lookupCode,
          warehouseId: moveWarehouseId,
          type: moveType,
          quantity: Number(moveQty),
        },
      });
      setMoveSuccess(`Recorded: ${moveType} ${moveQty} unit(s).`);
      await runLookup(lookupCode); // refresh stock numbers
    } catch (err) {
      setMoveError(err instanceof ApiError ? err.message : "Couldn't record that movement.");
    } finally {
      setMoveSubmitting(false);
    }
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center text-paper-dim text-sm">Loading…</div>
    );
  }

  const scanningPaused = loadingLookup || !!result || !!lookupError;

  return (
    <AppShell>
      <div className="px-8 py-6 max-w-2xl">
        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-[0.2em] text-paper-dim mb-1">Quick lookup</div>
          <h1 className="text-2xl text-paper" style={{ fontFamily: "var(--font-display)" }}>
            Scan
          </h1>
        </div>

        {!result && !lookupError && (
          <>
            <BarcodeScanner onDetected={handleDetected} paused={scanningPaused} />
            <p className="text-xs text-paper-dim mt-2 text-center">
              Point the camera at a barcode, or enter it manually below.
            </p>

            <form onSubmit={handleManualSubmit} className="mt-4 flex gap-2">
              <input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Enter barcode manually…"
                className={`${inputClass} flex-1`}
              />
              <button
                type="submit"
                disabled={loadingLookup}
                className="px-4 py-2 bg-amber text-ink font-medium text-sm rounded-sm hover:brightness-110 transition disabled:opacity-50"
              >
                Look up
              </button>
            </form>
          </>
        )}

        {loadingLookup && <p className="text-sm text-paper-dim mt-4">Looking up…</p>}

        {lookupError && (
          <div className="mt-4">
            <div className="text-sm text-red border border-red-dim bg-red-dim/40 rounded-sm px-4 py-3 mb-4">
              {lookupError}
            </div>
            <button
              onClick={reset}
              className="px-4 py-2 border border-rule rounded-sm text-sm text-paper-dim hover:text-paper hover:border-paper-dim transition-colors"
            >
              Scan another
            </button>
          </div>
        )}

        {result && (
          <div className="mt-2">
            <div className="bg-surface border border-rule rounded-sm px-5 py-4 mb-4">
              <div className="flex items-baseline justify-between mb-1">
                <h2 className="text-lg text-paper">{result.product.name}</h2>
                <span className="font-mono text-xs text-paper-dim">{result.product.sku}</span>
              </div>
              {result.product.category && (
                <p className="text-xs text-paper-dim mb-3">{result.product.category}</p>
              )}

              <div className="text-[11px] uppercase tracking-wide text-paper-dim mb-2">Stock by warehouse</div>
              {result.stockByWarehouse.length === 0 ? (
                <p className="text-sm text-paper-dim">No stock recorded anywhere yet.</p>
              ) : (
                <div className="space-y-1">
                  {result.stockByWarehouse.map((row) => (
                    <div key={row._id} className="flex justify-between text-sm font-mono">
                      <span className="text-paper-dim">{warehouseName(row)}</span>
                      <span className="text-paper">{row.quantity}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {canRecord && warehouses.length > 0 && (
              <div className="bg-surface border border-rule rounded-sm px-5 py-4 mb-4">
                <div className="text-[11px] uppercase tracking-wide text-paper-dim mb-3">Record a movement</div>
                <form onSubmit={handleRecordMovement}>
                  <div className="grid grid-cols-3 gap-x-3">
                    <Field label="Warehouse" htmlFor="move-warehouse">
                      <select
                        id="move-warehouse"
                        value={moveWarehouseId}
                        onChange={(e) => setMoveWarehouseId(e.target.value)}
                        className={inputClass}
                      >
                        {warehouses.map((w) => (
                          <option key={w._id} value={w._id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Type" htmlFor="move-type">
                      <select
                        id="move-type"
                        value={moveType}
                        onChange={(e) => setMoveType(e.target.value as typeof moveType)}
                        className={inputClass}
                      >
                        {MOVEMENT_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Quantity" htmlFor="move-qty">
                      <input
                        id="move-qty"
                        type="number"
                        min="1"
                        step="1"
                        value={moveQty}
                        onChange={(e) => setMoveQty(e.target.value)}
                        className={inputClass}
                      />
                    </Field>
                  </div>

                  {moveError && (
                    <div className="mb-3 text-sm text-red border border-red-dim bg-red-dim/40 rounded-sm px-3 py-2">
                      {moveError}
                    </div>
                  )}
                  {moveSuccess && <div className="mb-3 text-sm text-teal">{moveSuccess}</div>}

                  <button
                    type="submit"
                    disabled={moveSubmitting}
                    className="w-full px-4 py-2 bg-teal text-ink font-medium text-sm rounded-sm hover:brightness-110 transition disabled:opacity-50"
                  >
                    {moveSubmitting ? "Recording…" : "Record movement"}
                  </button>
                </form>
              </div>
            )}

            <button
              onClick={reset}
              className="px-4 py-2 border border-rule rounded-sm text-sm text-paper-dim hover:text-paper hover:border-paper-dim transition-colors"
            >
              Scan another
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
