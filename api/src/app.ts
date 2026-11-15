import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/authRoutes';
import productRoutes from './routes/productRoutes';
import warehouseRoutes from './routes/warehouseRoutes';
import stockRoutes from './routes/stockRoutes';
import purchaseOrderRoutes from './routes/purchaseOrderRoutes';
import salesOrderRoutes from './routes/salesOrderRoutes';
import alertRoutes from './routes/alertRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import barcodeRoutes from './routes/barcodeRoutes';
import forecastRoutes from './routes/forecastRoutes';
import cronRoutes from './routes/cronRoutes';
import { errorHandler } from './middleware/errorHandler';

export function createApp(): Application {
  const app = express();

  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/auth', authRoutes);
  app.use('/products', productRoutes);
  app.use('/warehouses', warehouseRoutes);
  app.use('/stock', stockRoutes);
  app.use('/purchase-orders', purchaseOrderRoutes);
  app.use('/sales-orders', salesOrderRoutes);
  app.use('/alerts', alertRoutes);
  app.use('/dashboard', dashboardRoutes);
  app.use('/barcode', barcodeRoutes);
  app.use('/forecast', forecastRoutes);
  app.use('/cron', cronRoutes);

  // Keep last: catches thrown/rejected errors from every route above
  app.use(errorHandler);

  return app;
}
