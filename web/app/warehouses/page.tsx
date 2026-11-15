"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Modal } from "@/components/Modal";
import { Field, inputClass } from "@/components/Field";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Warehouse } from "@/lib/types";

function WarehouseForm({ onSubmit, onCancel }: { onSubmit: (name: string, address: string) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(name, address);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Field label="Name" htmlFor="wh-name">
        <input
          id="wh-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          placeholder="Pune Main"
        />
      </Field>
      <Field label="Address" htmlFor="wh-address" hint="Optional">
        <input
          id="wh-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className={inputClass}
          placeholder="Pune, MH"
        />
      </Field>
      {error && (
        <div className="mb-4 text-sm text-red border border-red-dim bg-red-dim/40 rounded-sm px-3 py-2">
          {error}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-paper-dim hover:text-paper transition-colors">
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-amber text-ink font-medium text-sm rounded-sm hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Saving…" : "Create warehouse"}
        </button>
      </div>
    </form>
  );
}

export default function WarehousesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const isAdmin = user?.role === "admin";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ warehouses: Warehouse[] }>("/warehouses");
      setWarehouses(res.warehouses);
    } catch {
      setError("Couldn't load warehouses. Is the API running?");
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

  async function handleCreate(name: string, address: string) {
    await apiFetch("/warehouses", { method: "POST", body: { name, address: address || undefined } });
    setModalOpen(false);
    await load();
  }

  async function handleDeactivate(warehouse: Warehouse) {
    if (!confirm(`Deactivate ${warehouse.name}? It'll be hidden from active listings.`)) return;
    try {
      await apiFetch(`/warehouses/${warehouse._id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Couldn't deactivate this warehouse.");
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
            <div className="text-[11px] uppercase tracking-[0.2em] text-paper-dim mb-1">Locations</div>
            <h1 className="text-2xl text-paper" style={{ fontFamily: "var(--font-display)" }}>
              Warehouses
            </h1>
          </div>
          {isAdmin && (
            <button
              onClick={() => setModalOpen(true)}
              className="px-4 py-2 bg-amber text-ink font-medium text-sm rounded-sm hover:brightness-110 transition"
            >
              New Warehouse
            </button>
          )}
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
                <th className="px-4 py-3 font-normal">Name</th>
                <th className="px-4 py-3 font-normal">Address</th>
                {isAdmin && <th className="px-4 py-3 font-normal text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-paper-dim text-sm">
                    Loading…
                  </td>
                </tr>
              ) : warehouses.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-paper-dim text-sm">
                    No warehouses yet — add the first one.
                  </td>
                </tr>
              ) : (
                warehouses.map((w) => (
                  <tr key={w._id} className="border-b border-rule/60 last:border-b-0 hover:bg-surface-2 transition-colors text-sm">
                    <td className="px-4 py-3 text-paper">{w.name}</td>
                    <td className="px-4 py-3 text-paper-dim">{w.address || "—"}</td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeactivate(w)}
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
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Warehouse">
        <WarehouseForm onSubmit={handleCreate} onCancel={() => setModalOpen(false)} />
      </Modal>
    </AppShell>
  );
}
