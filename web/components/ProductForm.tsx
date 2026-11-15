"use client";

import { useState, FormEvent } from "react";
import { Field, inputClass } from "./Field";
import type { Product } from "@/lib/types";

const UNITS = ["pcs", "kg", "g", "l", "ml", "box", "pair"] as const;

export interface ProductFormValues {
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unit: string;
  barcode?: string;
  costPrice: number;
  sellPrice: number;
  reorderPoint: number;
  reorderQty: number;
  leadTimeDays: number;
  trackLots: boolean;
}

function toFormValues(product?: Product): ProductFormValues {
  if (!product) {
    return {
      sku: "",
      name: "",
      description: "",
      category: "",
      unit: "pcs",
      barcode: "",
      costPrice: 0,
      sellPrice: 0,
      reorderPoint: 0,
      reorderQty: 0,
      leadTimeDays: 7,
      trackLots: false,
    };
  }
  return {
    sku: product.sku,
    name: product.name,
    description: product.description ?? "",
    category: product.category ?? "",
    unit: product.unit,
    barcode: product.barcode ?? "",
    costPrice: product.costPrice,
    sellPrice: product.sellPrice,
    reorderPoint: product.reorderPoint,
    reorderQty: product.reorderQty,
    leadTimeDays: product.leadTimeDays,
    trackLots: product.trackLots,
  };
}

interface ProductFormProps {
  product?: Product;
  onSubmit: (values: ProductFormValues) => Promise<void>;
  onCancel: () => void;
}

export function ProductForm({ product, onSubmit, onCancel }: ProductFormProps) {
  const [values, setValues] = useState<ProductFormValues>(() => toFormValues(product));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label="SKU" htmlFor="sku">
          <input
            id="sku"
            required
            disabled={!!product}
            value={values.sku}
            onChange={(e) => update("sku", e.target.value)}
            className={`${inputClass} ${product ? "opacity-60 cursor-not-allowed" : ""}`}
            placeholder="SKU-0001"
          />
        </Field>
        <Field label="Barcode" htmlFor="barcode" hint="Optional — for scan lookup">
          <input
            id="barcode"
            value={values.barcode}
            onChange={(e) => update("barcode", e.target.value)}
            className={inputClass}
            placeholder="8901234567890"
          />
        </Field>
      </div>

      <Field label="Name" htmlFor="name">
        <input
          id="name"
          required
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          className={inputClass}
          placeholder="Product name"
        />
      </Field>

      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Category" htmlFor="category">
          <input
            id="category"
            value={values.category}
            onChange={(e) => update("category", e.target.value)}
            className={inputClass}
            placeholder="Apparel"
          />
        </Field>
        <Field label="Unit" htmlFor="unit">
          <select
            id="unit"
            value={values.unit}
            onChange={(e) => update("unit", e.target.value)}
            className={inputClass}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Cost Price" htmlFor="costPrice">
          <input
            id="costPrice"
            type="number"
            step="0.01"
            min="0"
            required
            value={values.costPrice}
            onChange={(e) => update("costPrice", Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Sell Price" htmlFor="sellPrice">
          <input
            id="sellPrice"
            type="number"
            step="0.01"
            min="0"
            required
            value={values.sellPrice}
            onChange={(e) => update("sellPrice", Number(e.target.value))}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-x-4">
        <Field label="Reorder Point" htmlFor="reorderPoint" hint="0 = alerts off">
          <input
            id="reorderPoint"
            type="number"
            min="0"
            value={values.reorderPoint}
            onChange={(e) => update("reorderPoint", Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Reorder Qty" htmlFor="reorderQty">
          <input
            id="reorderQty"
            type="number"
            min="0"
            value={values.reorderQty}
            onChange={(e) => update("reorderQty", Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Lead Time (days)" htmlFor="leadTimeDays">
          <input
            id="leadTimeDays"
            type="number"
            min="0"
            value={values.leadTimeDays}
            onChange={(e) => update("leadTimeDays", Number(e.target.value))}
            className={inputClass}
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-paper-dim mb-5 cursor-pointer">
        <input
          type="checkbox"
          checked={values.trackLots}
          onChange={(e) => update("trackLots", e.target.checked)}
          className="accent-amber"
        />
        Track lot/batch numbers for this product
      </label>

      {error && (
        <div className="mb-4 text-sm text-red border border-red-dim bg-red-dim/40 rounded-sm px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-paper-dim hover:text-paper transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-amber text-ink font-medium text-sm rounded-sm hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Saving…" : product ? "Save changes" : "Create product"}
        </button>
      </div>
    </form>
  );
}
