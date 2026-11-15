"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Modal } from "@/components/Modal";
import { ProductForm, ProductFormValues } from "@/components/ProductForm";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Product, ProductListResponse } from "@/lib/types";

function formatMoney(n: number): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function ProductsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);

  const limit = 25;
  const canManage = user?.role === "admin" || user?.role === "manager";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<ProductListResponse>("/products", {
        query: { search: search || undefined, page: String(page), limit: String(limit) },
      });
      setItems(res.items);
      setTotal(res.total);
    } catch {
      setError("Couldn't load products. Is the API running?");
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  function openCreate() {
    setEditingProduct(undefined);
    setModalOpen(true);
  }

  function openEdit(product: Product) {
    setEditingProduct(product);
    setModalOpen(true);
  }

  async function handleSubmit(values: ProductFormValues) {
    if (editingProduct) {
      await apiFetch(`/products/${editingProduct._id}`, { method: "PATCH", body: values });
    } else {
      await apiFetch("/products", { method: "POST", body: values });
    }
    setModalOpen(false);
    await load();
  }

  async function handleDeactivate(product: Product) {
    if (!confirm(`Deactivate ${product.name}? It'll be hidden from active listings.`)) return;
    try {
      await apiFetch(`/products/${product._id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Couldn't deactivate this product.");
    }
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center text-paper-dim text-sm">
        Loading…
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <AppShell>
      <div className="px-8 py-6 max-w-6xl">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-paper-dim mb-1">Catalog</div>
            <h1 className="text-2xl text-paper" style={{ fontFamily: "var(--font-display)" }}>
              Products
            </h1>
          </div>
          {canManage && (
            <button
              onClick={openCreate}
              className="px-4 py-2 bg-amber text-ink font-medium text-sm rounded-sm hover:brightness-110 transition"
            >
              New Product
            </button>
          )}
        </div>

        <div className="mb-4">
          <input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Search by name or SKU…"
            className="w-full max-w-sm bg-surface border border-rule rounded-sm px-3 py-2 text-paper text-sm outline-none focus:border-amber transition-colors"
          />
        </div>

        {error && (
          <div className="mb-4 text-sm text-red border border-red-dim bg-red-dim/40 rounded-sm px-4 py-3">
            {error}
          </div>
        )}

        <div className="bg-surface border border-rule rounded-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-[11px] uppercase tracking-wide text-paper-dim">
                <th className="px-4 py-3 font-normal">SKU</th>
                <th className="px-4 py-3 font-normal">Name</th>
                <th className="px-4 py-3 font-normal">Category</th>
                <th className="px-4 py-3 font-normal text-right">Cost</th>
                <th className="px-4 py-3 font-normal text-right">Sell</th>
                <th className="px-4 py-3 font-normal text-right">Reorder Pt</th>
                {canManage && <th className="px-4 py-3 font-normal text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="font-mono text-[13px]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-paper-dim font-sans">
                    Loading…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-paper-dim font-sans">
                    {search ? `No products match "${search}".` : "No products yet — add the first one."}
                  </td>
                </tr>
              ) : (
                items.map((p) => (
                  <tr key={p._id} className="border-b border-rule/60 last:border-b-0 hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-3 text-paper-dim">{p.sku}</td>
                    <td className="px-4 py-3 text-paper font-sans">{p.name}</td>
                    <td className="px-4 py-3 text-paper-dim font-sans">{p.category || "—"}</td>
                    <td className="px-4 py-3 text-right text-paper">{formatMoney(p.costPrice)}</td>
                    <td className="px-4 py-3 text-right text-paper">{formatMoney(p.sellPrice)}</td>
                    <td className="px-4 py-3 text-right text-paper-dim">{p.reorderPoint || "—"}</td>
                    {canManage && (
                      <td className="px-4 py-3 text-right font-sans">
                        <button
                          onClick={() => openEdit(p)}
                          className="text-paper-dim hover:text-amber transition-colors mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeactivate(p)}
                          className="text-paper-dim hover:text-red transition-colors"
                        >
                          Deactivate
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-xs text-paper-dim">
            <span>
              Page {page} of {totalPages} · {total} products
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 border border-rule rounded-sm hover:text-paper hover:border-paper-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 border border-rule rounded-sm hover:text-paper hover:border-paper-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingProduct ? "Edit Product" : "New Product"}>
        <ProductForm product={editingProduct} onSubmit={handleSubmit} onCancel={() => setModalOpen(false)} />
      </Modal>
    </AppShell>
  );
}
