import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { checkStockShape, checkStock } from "./tools/checkStock.js";
import { searchProductsShape, searchProducts } from "./tools/searchProducts.js";
import { lowStockAlertsShape, getLowStockAlerts } from "./tools/lowStockAlerts.js";
import { getForecastShape, getForecast } from "./tools/getForecast.js";
import { dashboardSummaryShape, getDashboardSummary } from "./tools/dashboardSummary.js";
import { createPurchaseOrderShape, createPurchaseOrder } from "./tools/createPurchaseOrder.js";
import { receivePurchaseOrderShape, receivePurchaseOrder } from "./tools/receivePurchaseOrder.js";
import { recordStockMovementShape, recordStockMovement } from "./tools/recordStockMovement.js";


export function createServer(): McpServer {
  const server = new McpServer({
    name: "inventory-mcp",
    version: "1.0.0",
  });

  // Read-only tools first, per the build plan — no risk of mutating real
  // inventory data while still confirming the registration/dispatch shape
  // works end to end. Write tools (create_purchase_order,
  // record_stock_movement, etc.) come in the next step.
  server.registerTool(
    "check_stock",
    {
      title: "Check stock",
      description: "Look up how much of a product is in stock, by SKU, across one or every warehouse.",
      inputSchema: checkStockShape,
    },
    checkStock
  );

  server.registerTool(
    "search_products",
    {
      title: "Search products",
      description: "Search the product catalog by name or SKU.",
      inputSchema: searchProductsShape,
    },
    searchProducts
  );

  server.registerTool(
    "get_low_stock_alerts",
    {
      title: "Get low-stock alerts",
      description: "List open (or all) low-stock and reorder-suggested alerts.",
      inputSchema: lowStockAlertsShape,
    },
    getLowStockAlerts
  );

  server.registerTool(
    "get_forecast",
    {
      title: "Get reorder forecast",
      description:
        "Get velocity-based reorder forecast for a product by SKU — days of stock remaining and whether a reorder is due, across one or every warehouse.",
      inputSchema: getForecastShape,
    },
    getForecast
  );

  server.registerTool(
    "get_dashboard_summary",
    {
      title: "Get dashboard summary",
      description: "Get overall stock value, unit count, open alerts, and top-selling products, optionally scoped to one warehouse.",
      inputSchema: dashboardSummaryShape,
    },
    getDashboardSummary
  );

  // Write tools. These mutate real inventory data, so each one validates
  // everything it can (every SKU, the warehouse, the PO number) before
  // calling the API, and the API's own business-rule errors
  // (InsufficientStockError, PurchaseOrderError, etc.) surface through
  // toolHelpers.runTool with their real message intact — never a generic
  // "something went wrong".
  server.registerTool(
    "create_purchase_order",
    {
      title: "Create purchase order",
      description: "Create a new purchase order with one or more line items, in draft status.",
      inputSchema: createPurchaseOrderShape,
    },
    createPurchaseOrder
  );

  server.registerTool(
    "receive_purchase_order",
    {
      title: "Receive purchase order",
      description:
        "Record stock arriving against an existing purchase order, by PO number. Supports partial receipt — receiving less than ordered is fine and leaves the order partially received.",
      inputSchema: receivePurchaseOrderShape,
    },
    receivePurchaseOrder
  );

  server.registerTool(
    "record_stock_movement",
    {
      title: "Record stock movement",
      description: "Record stock arriving, leaving, or being corrected for a product, identified by barcode.",
      inputSchema: recordStockMovementShape,
    },
    recordStockMovement
  );

  return server;
}
