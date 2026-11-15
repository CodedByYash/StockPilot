/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../config/db';
import { User } from '../models/User';
import { Warehouse } from '../models/Warehouse';
import { Product } from '../models/Product';
import { recordMovement } from '../services/stockService';

const CATEGORIES = ['Apparel', 'Footwear', 'Accessories', 'Electronics'];

async function seed() {
  const uri = process.env.MONGO_URI as string;
  await connectDB(uri);

  console.log('[seed] clearing existing data...');
  await Promise.all([
    User.deleteMany({}),
    Warehouse.deleteMany({}),
    Product.deleteMany({}),
    mongoose.connection.collection('stockmovements').deleteMany({}),
    mongoose.connection.collection('productstocks').deleteMany({}),
  ]);

  console.log('[seed] creating admin user...');
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const admin = await User.create({
    name: 'Admin',
    email: 'admin@example.com',
    passwordHash,
    role: 'admin',
  });

  console.log('[seed] creating warehouses...');
  const warehouses = await Warehouse.insertMany([
    { name: 'Pune Main', address: 'Pune, MH' },
    { name: 'Mumbai Hub', address: 'Mumbai, MH' },
  ]);

  console.log('[seed] creating products...');
  const products = [];
  for (let i = 1; i <= 40; i++) {
    const category = CATEGORIES[i % CATEGORIES.length];
    const cost = Math.round((50 + Math.random() * 500) * 100) / 100;
    products.push({
      sku: `SKU-${String(i).padStart(4, '0')}`,
      name: `${category} Item ${i}`,
      category,
      barcode: `890${String(1000000000 + i).slice(1)}`, // fake but unique EAN-like code
      costPrice: cost,
      sellPrice: Math.round(cost * 1.6 * 100) / 100,
      reorderPoint: 10,
      reorderQty: 50,
    });
  }
  const createdProducts = await Product.insertMany(products);

  console.log('[seed] generating 90 days of stock movement history...');
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  for (const product of createdProducts) {
    for (const warehouse of warehouses) {
      // initial stock load, 90 days ago
      await recordMovement({
        productId: product._id,
        warehouseId: warehouse._id,
        type: 'inbound',
        quantity: 100 + Math.floor(Math.random() * 200),
        referenceType: 'manual',
        createdBy: admin._id,
        occurredAt: new Date(now - 90 * DAY_MS),
      });

      // simulate ~90 days of intermittent sales, backdated day by day so
      // forecastService's 30-day velocity window has real historical spread
      // to work with instead of everything landing on "right now"
      for (let d = 90; d > 0; d--) {
        if (Math.random() < 0.4) {
          const qty = 1 + Math.floor(Math.random() * 5);
          try {
            await recordMovement({
              productId: product._id,
              warehouseId: warehouse._id,
              type: 'outbound',
              quantity: qty,
              referenceType: 'manual',
              createdBy: admin._id,
              occurredAt: new Date(now - d * DAY_MS),
            });
          } catch {
            // ran out of stock in the simulation for this product/day — fine, skip
          }
        }
      }
    }
  }

  console.log('[seed] done. Login with admin@example.com / Password123!');
  await disconnectDB();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
