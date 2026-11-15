export type Role = "admin" | "manager" | "staff";

export interface User {
  _id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Warehouse {
  _id: string;
  name: string;
  address?: string;
  isActive: boolean;
}

export interface Product {
  _id: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unit: string;
  barcode?: string;
  costPrice: number;
  sellPrice: number;
  images: string[];
  reorderPoint: number;
  reorderQty: number;
  leadTimeDays: number;
  trackLots: boolean;
  isActive: boolean;
}

export interface BarcodeStockRow {
  _id: string;
  productId: string;
  warehouseId: { _id: string; name: string } | string;
  quantity: number;
  lastMovementAt: string;
}

export interface BarcodeLookupResponse {
  product: Product;
  stockByWarehouse: BarcodeStockRow[];
}

export interface ProductListResponse {
  items: Product[];
  total: number;
  page: number;
  limit: number;
}

export interface TopMoverRow {
  productId: string;
  productName: string;
  sku: string;
  totalOutbound: number;
}

export interface RecentActivityRow {
  _id: string;
  type: "inbound" | "outbound" | "adjustment" | "transfer";
  quantity: number;
  createdAt: string;
  productId: { _id: string; name: string; sku: string } | string;
  warehouseId: { _id: string; name: string } | string;
}

export interface DashboardSummary {
  totalStockValue: number;
  totalUnits: number;
  lowStockOpenAlerts: number;
  topMovers: TopMoverRow[];
  recentActivity: RecentActivityRow[];
}

export interface AlertLog {
  _id: string;
  productId: string;
  warehouseId: string;
  type: "low_stock" | "reorder_suggested";
  message: string;
  resolved: boolean;
  createdAt: string;
}

export type POStatus = "draft" | "ordered" | "partially_received" | "received" | "cancelled";

export interface PurchaseOrderLine {
  productId: string;
  orderedQty: number;
  receivedQty: number;
  unitCost: number;
}

export interface PurchaseOrder {
  _id: string;
  poNumber: string;
  supplierName: string;
  warehouseId: string;
  status: POStatus;
  lines: PurchaseOrderLine[];
  createdAt: string;
}

export type SOStatus = "pending" | "partially_fulfilled" | "fulfilled" | "cancelled";

export interface SalesOrderLine {
  productId: string;
  qty: number;
  fulfilledQty: number;
  unitPrice: number;
}

export interface SalesOrder {
  _id: string;
  orderNumber: string;
  warehouseId: string;
  status: SOStatus;
  lines: SalesOrderLine[];
  createdAt: string;
}
