import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Product } from '../models/Product';
import { AlertLog } from '../models/AlertLog';
import { recordMovement } from '../services/stockService';
import { runLowStockCheck } from '../services/alertService';

let replSet: MongoMemoryReplSet;

const warehouseId = new Types.ObjectId().toString();
const userId = new Types.ObjectId().toString();

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key]?.deleteMany({});
  }
});

async function makeProduct(reorderPoint: number) {
  return Product.create({
    sku: `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: 'Test Product',
    costPrice: 10,
    sellPrice: 16,
    reorderPoint,
    reorderQty: 50,
  });
}

describe('alertService.runLowStockCheck', () => {
  it('creates a low_stock alert when quantity is at or below reorderPoint', async () => {
    const product = await makeProduct(20);
    await recordMovement({
      productId: product._id,
      warehouseId,
      type: 'inbound',
      quantity: 15, // below reorderPoint of 20
      referenceType: 'manual',
      createdBy: userId,
    });

    const result = await runLowStockCheck();
    expect(result.created).toBe(1);

    const alerts = await AlertLog.find({ productId: product._id });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.resolved).toBe(false);
  });

  it('does not create a duplicate alert if one is already open', async () => {
    const product = await makeProduct(20);
    await recordMovement({
      productId: product._id,
      warehouseId,
      type: 'inbound',
      quantity: 15,
      referenceType: 'manual',
      createdBy: userId,
    });

    await runLowStockCheck();
    const second = await runLowStockCheck();

    expect(second.created).toBe(0);
    const alerts = await AlertLog.find({ productId: product._id });
    expect(alerts).toHaveLength(1);
  });

  it('does not alert on products above their reorder point', async () => {
    const product = await makeProduct(20);
    await recordMovement({
      productId: product._id,
      warehouseId,
      type: 'inbound',
      quantity: 100, // well above threshold
      referenceType: 'manual',
      createdBy: userId,
    });

    const result = await runLowStockCheck();
    expect(result.created).toBe(0);
  });

  it('ignores products with reorderPoint left at 0 (not opted into alerting)', async () => {
    const product = await makeProduct(0);
    await recordMovement({
      productId: product._id,
      warehouseId,
      type: 'inbound',
      quantity: 1,
      referenceType: 'manual',
      createdBy: userId,
    });

    const result = await runLowStockCheck();
    expect(result.created).toBe(0);
  });

  it('auto-resolves an open alert once stock is replenished above the threshold', async () => {
    const product = await makeProduct(20);
    await recordMovement({
      productId: product._id,
      warehouseId,
      type: 'inbound',
      quantity: 10,
      referenceType: 'manual',
      createdBy: userId,
    });

    await runLowStockCheck();
    let alerts = await AlertLog.find({ productId: product._id });
    expect(alerts[0]?.resolved).toBe(false);

    // restock above threshold
    await recordMovement({
      productId: product._id,
      warehouseId,
      type: 'inbound',
      quantity: 50,
      referenceType: 'manual',
      createdBy: userId,
    });

    const result = await runLowStockCheck();
    expect(result.resolved).toBe(1);

    alerts = await AlertLog.find({ productId: product._id });
    expect(alerts[0]?.resolved).toBe(true);
  });
});
