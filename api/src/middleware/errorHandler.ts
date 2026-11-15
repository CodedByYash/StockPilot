import { Request, Response, NextFunction } from 'express';
import { InsufficientStockError } from '../services/stockService';
import { PurchaseOrderError } from '../services/purchaseOrderService';
import { SalesOrderError } from '../services/salesOrderService';
import { BarcodeNotFoundError } from '../services/barcodeService';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);

  if (err instanceof InsufficientStockError) {
    return res.status(409).json({ error: err.message });
  }

  if (err instanceof PurchaseOrderError) {
    return res.status(400).json({ error: err.message });
  }

  if (err instanceof SalesOrderError) {
    return res.status(400).json({ error: err.message });
  }

  if (err instanceof BarcodeNotFoundError) {
    return res.status(404).json({ error: err.message });
  }

  if (err instanceof Error && err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  if (err instanceof Error && (err as { code?: number }).code === 11000) {
    return res.status(409).json({ error: 'Duplicate value violates a unique constraint' });
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  return res.status(500).json({ error: message });
}
