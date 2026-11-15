"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Modal } from "@/components/Modal";
import { Field, inputClass } from "@/components/Field";
import { StatusBadge } from "@/components/StatusBadge";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { PurchaseOrder, Product, Warehouse } from "@/lib/types";

interface DraftLine {
  productId: string;
  orderedQty: string;
  unitCost: string;
}

function CreatePOForm({
  products,
  warehouses,
  onSubmit,
  onCancel,
}: {
  products: Product[];
  warehouses: Warehouse[];
  onSubmit: (data: { poNumber: string; supplierName: string; warehouseId: string; lines: DraftLine[] }) => Promise<void>;
  onCancel: () => void;
}) {
  const [poNumber, setPoNumber] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?._id ?? "");
  const [lines, setLines] = useState<DraftLine[]>([{ productId: products[0]?._id ?? "", orderedQty: "1", unitCost: "0" }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateLine(i: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { productId: products[0]?._id ?? "", orderedQty: "1", unitCost: "0" }]);
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ poNumber, supplierName, warehouseId, lines });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (products.length === 0 || warehouses.length === 0) {
    return (
      <p className="text-sm text-paper-dim">
        You need at least one product and one warehouse before creating a purchase order.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label="PO Number" htmlFor="poNumber">
          <input id="poNumber" required value={poNumber} onChange={(e) => setPoNumber(e.target.value)} className={inputClass} placeholder="PO-1001" />
        </Field>
        <Field label="Warehouse" htmlFor="warehouseId">
          <select id="warehouseId" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={inputClass}>
            {warehouses.map((w) => (
              <option key={w._id} value={w._id}>
                {w.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Supplier" htmlFor="supplierName">
        <input id="supplierName" required value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className={inputClass} placeholder="Acme Supplies" />
      </Field>

      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-paper-dim">Line items</span>
        <button type="button" onClick={addLine} className="text-xs text-amber hover:brightness-110">
          + Add line
        </button>
      </div>

      <div className="space-y-2 mb-5">
        {lines.map((line, i) => (
          <div key={i} className="flex gap-2 items-center">
            <select
              value={line.productId}
              onChange={(e) => updateLine(i, { productId: e.target.value })}
              className={`${inputClass} flex-1`}
            >
              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.sku} — {p.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              value={line.orderedQty}
              onChange={(e) => updateLine(i, { orderedQty: e.target.value })}
              className={`${inputClass} w-20`}
              placeholder="Qty"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={line.unitCost}
              onChange={(e) => updateLine(i, { unitCost: e.target.value })}
              className={`${inputClass} w-24`}
              placeholder="Cost"
            />
            {lines.length > 1 && (
              <button type="button" onClick={() => removeLine(i)} className="text-paper-dim hover:text-red text-lg leading-none px-1">
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 text-sm text-red border border-red-dim bg-red-dim/40 rounded-sm px-3 py-2">{error}</div>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-paper-dim hover:text-paper transition-colors">
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-amber text-ink font-medium text-sm rounded-sm hover:brightness-110 transition disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create purchase order"}
        </button>
      </div>
    </form>
  );
}

function ReceiveForm({
  po,
  products,
  onSubmit,
  onCancel,
}: {
  po: PurchaseOrder;
  products: Product[];
  onSubmit: (lines: { productId: string; qty: number }[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function productName(id: string) {
    return products.find((p) => p._id === id)?.name ?? id;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const lines = Object.entries(quantities)
      .map(([productId, qty]) => ({ productId, qty: Number(qty) }))
      .filter((l) => l.qty > 0);

    if (lines.length === 0) {
      setError("Enter a quantity for at least one line.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(lines);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-3 mb-5">
        {po.lines.map((line) => {
          const remaining = line.orderedQty - line.receivedQty;
          if (remaining <= 0) return null;
          return (
            <div key={line.productId} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-paper truncate">{productName(line.productId)}</div>
                <div className="text-[11px] text-paper-dim font-mono">
                  {line.receivedQty} / {line.orderedQty} received · {remaining} remaining
                </div>
              </div>
              <input
                type="number"
                min="0"
                max={remaining}
                placeholder="0"
                value={quantities[line.productId] ?? ""}
                onChange={(e) => setQuantities((q) => ({ ...q, [line.productId]: e.target.value }))}
                className={`${inputClass} w-24 shrink-0`}
              />
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mb-4 text-sm text-red border border-red-dim bg-red-dim/40 rounded-sm px-3 py-2">{error}</div>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-paper-dim hover:text-paper transition-colors">
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-teal text-ink font-medium text-sm rounded-sm hover:brightness-110 transition disabled:opacity-50"
        >
          {submitting ? "Receiving…" : "Receive stock"}
        </button>
      </div>
    </form>
  );
}

export default function PurchaseOrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null);

  const canManage = user?.role === "admin" || user?.role === "manager";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, productsRes, warehousesRes] = await Promise.all([
        apiFetch<{ orders: PurchaseOrder[] }>("/purchase-orders"),
        apiFetch<{ items: Product[] }>("/products", { query: { limit: "100" } }),
        apiFetch<{ warehouses: Warehouse[] }>("/warehouses"),
      ]);
      setOrders(ordersRes.orders);
      setProducts(productsRes.items);
      setWarehouses(warehousesRes.warehouses);
    } catch {
      setError("Couldn't load purchase orders. Is the API running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  function productName(id: string) {
    return products.find((p) => p._id === id)?.name ?? id;
  }
  function warehouseName(id: string) {
    return warehouses.find((w) => w._id === id)?.name ?? id;
  }

  async function handleCreate(data: { poNumber: string; supplierName: string; warehouseId: string; lines: DraftLine[] }) {
    await apiFetch("/purchase-orders", {
      method: "POST",
      body: {
        poNumber: data.poNumber,
        supplierName: data.supplierName,
        warehouseId: data.warehouseId,
        lines: data.lines.map((l) => ({
          productId: l.productId,
          orderedQty: Number(l.orderedQty),
          unitCost: Number(l.unitCost),
        })),
      },
    });
    setCreateOpen(false);
    await load();
  }

  async function handleMarkOrdered(po: PurchaseOrder) {
    try {
      await apiFetch(`/purchase-orders/${po._id}/mark-ordered`, { method: "PATCH" });
      await load();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  }

  async function handleReceive(lines: { productId: string; qty: number }[]) {
    if (!receivingPO) return;
    await apiFetch(`/purchase-orders/${receivingPO._id}/receive`, { method: "PATCH", body: { lines } });
    setReceivingPO(null);
    await load();
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center text-paper-dim text-sm">Loading…</div>
    );
  }

  return (
    <AppShell>
      <div className="px-8 py-6 max-w-5xl">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-paper-dim mb-1">Inbound</div>
            <h1 className="text-2xl text-paper" style={{ fontFamily: "var(--font-display)" }}>
              Purchase Orders
            </h1>
          </div>
          {canManage && (
            <button
              onClick={() => setCreateOpen(true)}
              className="px-4 py-2 bg-amber text-ink font-medium text-sm rounded-sm hover:brightness-110 transition"
            >
              New Purchase Order
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 text-sm text-red border border-red-dim bg-red-dim/40 rounded-sm px-4 py-3">{error}</div>
        )}

        <div className="bg-surface border border-rule rounded-sm divide-y divide-rule/60">
          {loading ? (
            <div className="px-4 py-10 text-center text-paper-dim text-sm">Loading…</div>
          ) : orders.length === 0 ? (
            <div className="px-4 py-10 text-center text-paper-dim text-sm">
              No purchase orders yet — create one to bring stock in.
            </div>
          ) : (
            orders.map((po) => (
              <div key={po._id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm text-paper">{po.poNumber}</span>
                      <StatusBadge status={po.status} />
                    </div>
                    <div className="text-xs text-paper-dim">
                      {po.supplierName} · {warehouseName(po.warehouseId)}
                    </div>
                  </div>
                  {canManage && po.status !== "received" && po.status !== "cancelled" && (
                    <div className="flex gap-2 shrink-0">
                      {po.status === "draft" && (
                        <button
                          onClick={() => handleMarkOrdered(po)}
                          className="text-xs text-paper-dim hover:text-amber transition-colors underline underline-offset-2"
                        >
                          Mark ordered
                        </button>
                      )}
                      <button
                        onClick={() => setReceivingPO(po)}
                        className="text-xs text-paper-dim hover:text-teal transition-colors underline underline-offset-2"
                      >
                        Receive
                      </button>
                    </div>
                  )}
                </div>
                <div className="mt-2 space-y-1">
                  {po.lines.map((line) => (
                    <div key={line.productId} className="flex justify-between text-xs font-mono text-paper-dim">
                      <span>{productName(line.productId)}</span>
                      <span>
                        {line.receivedQty} / {line.orderedQty}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Purchase Order">
        <CreatePOForm products={products} warehouses={warehouses} onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} />
      </Modal>

      <Modal open={!!receivingPO} onClose={() => setReceivingPO(null)} title={`Receive ${receivingPO?.poNumber ?? ""}`}>
        {receivingPO && (
          <ReceiveForm po={receivingPO} products={products} onSubmit={handleReceive} onCancel={() => setReceivingPO(null)} />
        )}
      </Modal>
    </AppShell>
  );
}
