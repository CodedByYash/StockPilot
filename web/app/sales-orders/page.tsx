"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Modal } from "@/components/Modal";
import { Field, inputClass } from "@/components/Field";
import { StatusBadge } from "@/components/StatusBadge";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { SalesOrder, Product, Warehouse } from "@/lib/types";

interface DraftLine {
  productId: string;
  qty: string;
  unitPrice: string;
}

function CreateSOForm({
  products,
  warehouses,
  onSubmit,
  onCancel,
}: {
  products: Product[];
  warehouses: Warehouse[];
  onSubmit: (data: { orderNumber: string; warehouseId: string; lines: DraftLine[] }) => Promise<void>;
  onCancel: () => void;
}) {
  const [orderNumber, setOrderNumber] = useState("");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?._id ?? "");
  const [lines, setLines] = useState<DraftLine[]>([
    { productId: products[0]?._id ?? "", qty: "1", unitPrice: products[0]?.sellPrice.toString() ?? "0" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateLine(i: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { productId: products[0]?._id ?? "", qty: "1", unitPrice: "0" }]);
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ orderNumber, warehouseId, lines });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (products.length === 0 || warehouses.length === 0) {
    return (
      <p className="text-sm text-paper-dim">
        You need at least one product and one warehouse before creating a sales order.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Order Number" htmlFor="orderNumber">
          <input id="orderNumber" required value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} className={inputClass} placeholder="SO-2001" />
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
              onChange={(e) => {
                const product = products.find((p) => p._id === e.target.value);
                updateLine(i, { productId: e.target.value, unitPrice: product?.sellPrice.toString() ?? "0" });
              }}
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
              value={line.qty}
              onChange={(e) => updateLine(i, { qty: e.target.value })}
              className={`${inputClass} w-20`}
              placeholder="Qty"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={line.unitPrice}
              onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
              className={`${inputClass} w-24`}
              placeholder="Price"
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
          {submitting ? "Creating…" : "Create sales order"}
        </button>
      </div>
    </form>
  );
}

function FulfillForm({
  so,
  products,
  onSubmit,
  onCancel,
}: {
  so: SalesOrder;
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
      <p className="text-[11px] text-paper-dim mb-3 leading-relaxed">
        Fulfilling more than what&apos;s in stock isn&apos;t possible — if there isn&apos;t enough on hand, only what&apos;s
        available gets shipped and the rest stays backordered on this order.
      </p>
      <div className="space-y-3 mb-5">
        {so.lines.map((line) => {
          const remaining = line.qty - line.fulfilledQty;
          if (remaining <= 0) return null;
          return (
            <div key={line.productId} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-paper truncate">{productName(line.productId)}</div>
                <div className="text-[11px] text-paper-dim font-mono">
                  {line.fulfilledQty} / {line.qty} fulfilled · {remaining} remaining
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
          {submitting ? "Fulfilling…" : "Fulfill order"}
        </button>
      </div>
    </form>
  );
}

export default function SalesOrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [fulfillingSO, setFulfillingSO] = useState<SalesOrder | null>(null);

  const canManage = user?.role === "admin" || user?.role === "manager" || user?.role === "staff";
  const canCancel = user?.role === "admin" || user?.role === "manager";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, productsRes, warehousesRes] = await Promise.all([
        apiFetch<{ orders: SalesOrder[] }>("/sales-orders"),
        apiFetch<{ items: Product[] }>("/products", { query: { limit: "100" } }),
        apiFetch<{ warehouses: Warehouse[] }>("/warehouses"),
      ]);
      setOrders(ordersRes.orders);
      setProducts(productsRes.items);
      setWarehouses(warehousesRes.warehouses);
    } catch {
      setError("Couldn't load sales orders. Is the API running?");
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

  async function handleCreate(data: { orderNumber: string; warehouseId: string; lines: DraftLine[] }) {
    await apiFetch("/sales-orders", {
      method: "POST",
      body: {
        orderNumber: data.orderNumber,
        warehouseId: data.warehouseId,
        lines: data.lines.map((l) => ({
          productId: l.productId,
          qty: Number(l.qty),
          unitPrice: Number(l.unitPrice),
        })),
      },
    });
    setCreateOpen(false);
    await load();
  }

  async function handleFulfill(lines: { productId: string; qty: number }[]) {
    if (!fulfillingSO) return;
    await apiFetch(`/sales-orders/${fulfillingSO._id}/fulfill`, { method: "PATCH", body: { lines } });
    setFulfillingSO(null);
    await load();
  }

  async function handleCancel(so: SalesOrder) {
    if (!confirm(`Cancel order ${so.orderNumber}?`)) return;
    try {
      await apiFetch(`/sales-orders/${so._id}/cancel`, { method: "PATCH" });
      await load();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
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
            <div className="text-[11px] uppercase tracking-[0.2em] text-paper-dim mb-1">Outbound</div>
            <h1 className="text-2xl text-paper" style={{ fontFamily: "var(--font-display)" }}>
              Sales Orders
            </h1>
          </div>
          {canManage && (
            <button
              onClick={() => setCreateOpen(true)}
              className="px-4 py-2 bg-amber text-ink font-medium text-sm rounded-sm hover:brightness-110 transition"
            >
              New Sales Order
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
              No sales orders yet — create one to ship stock out.
            </div>
          ) : (
            orders.map((so) => (
              <div key={so._id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm text-paper">{so.orderNumber}</span>
                      <StatusBadge status={so.status} />
                    </div>
                    <div className="text-xs text-paper-dim">{warehouseName(so.warehouseId)}</div>
                  </div>
                  {so.status !== "fulfilled" && so.status !== "cancelled" && (
                    <div className="flex gap-2 shrink-0">
                      {canManage && (
                        <button
                          onClick={() => setFulfillingSO(so)}
                          className="text-xs text-paper-dim hover:text-teal transition-colors underline underline-offset-2"
                        >
                          Fulfill
                        </button>
                      )}
                      {canCancel && (
                        <button
                          onClick={() => handleCancel(so)}
                          className="text-xs text-paper-dim hover:text-red transition-colors underline underline-offset-2"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-2 space-y-1">
                  {so.lines.map((line) => (
                    <div key={line.productId} className="flex justify-between text-xs font-mono text-paper-dim">
                      <span>{productName(line.productId)}</span>
                      <span>
                        {line.fulfilledQty} / {line.qty}
                        {line.fulfilledQty < line.qty && (
                          <span className="text-amber ml-2">{line.qty - line.fulfilledQty} backordered</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Sales Order">
        <CreateSOForm products={products} warehouses={warehouses} onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} />
      </Modal>

      <Modal open={!!fulfillingSO} onClose={() => setFulfillingSO(null)} title={`Fulfill ${fulfillingSO?.orderNumber ?? ""}`}>
        {fulfillingSO && (
          <FulfillForm so={fulfillingSO} products={products} onSubmit={handleFulfill} onCancel={() => setFulfillingSO(null)} />
        )}
      </Modal>
    </AppShell>
  );
}
