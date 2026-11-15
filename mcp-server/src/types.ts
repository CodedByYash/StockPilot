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
  reorderPoint: number;
  reorderQty: number;
  leadTimeDays: number;
  trackLots: boolean;
  isActive: boolean;
}

export interface ProductListResponse {
  items: Product[];
  total: number;
  page: number;
  limit: number;
}

export interface WarehouseListResponse {
  warehouses: Warehouse[];
}

export interface StockQuantityResponse {
  productId: string;
  warehouseId: string;
  quantity: number;
}

export type AlertType = 'low_stock' | 'reorder_suggested';

export interface AlertLog {
  _id: string;
  productId: string;
  warehouseId: string;
  type: AlertType;
  message: string;
  resolved: boolean;
  createdAt: string;
}

export interface AlertListResponse {
  alerts: AlertLog[];
}

export interface ForecastResult {
  productId: string;
  warehouseId: string;
  currentStock: number;
  dailyVelocity: number;
  daysOfStockRemaining: number | null;
  leadTimeDays: number;
  reorderSuggested: boolean;
  suggestedReorderQty: number;
  reason: string;
}

export interface ForecastResponse {
  forecasts: ForecastResult[];
}

export interface TopMoverRow {
  productId: string;
  productName: string;
  sku: string;
  totalOutbound: number;
}

export type POStatus = 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled';

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

export interface PurchaseOrderListResponse {
  orders: PurchaseOrder[];
}

export interface PurchaseOrderResponse {
  purchaseOrder: PurchaseOrder;
}

export interface StockMovementRecord {
  _id: string;
  productId: string;
  warehouseId: string;
  type: string;
  quantity: number;
  referenceType: string;
  createdAt: string;
}

export interface ProductStockRecord {
  _id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  lastMovementAt: string;
}

export interface RecordMovementResponse {
  movement: StockMovementRecord;
  stock: ProductStockRecord;
}

export interface DashboardSummary {
  totalStockValue: number;
  totalUnits: number;
  lowStockOpenAlerts: number;
  topMovers: TopMoverRow[];
  recentActivity: unknown[];
}
