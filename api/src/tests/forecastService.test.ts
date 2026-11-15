import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Product } from '../models/Product';
import { AlertLog } from '../models/AlertLog';
import { StockMovement } from '../models/StockMovement';
import { recordMovement } from '../services/stockService';
import { getForecastForProduct, runReorderCheck } from '../services/forecastService';

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

async function makeProduct(leadTimeDays: number) {
  return Product.create({
    sku: `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: 'Forecast Widget',
    costPrice: 10,
    sellPrice: 16,
    leadTimeDays,
  });
}

/**
 * Backdates a StockMovement's createdAt so we can simulate sales history
 * spread across the 30-day velocity window without waiting real time.
 * recordMovement always stamps "now", so this directly patches the
 * document afterward — test-only, never done in application code.
 */
async function backdateLastMovement(productId: Types.ObjectId, daysAgo: number) {
  const movement = await StockMovement.findOne({ productId }).sort({ createdAt: -1 });
  if (!movement) throw new Error('no movement to backdate');
  movement.createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  await movement.save();
}

describe('forecastService.getForecastForProduct', () => {
  it('reports zero velocity and no suggestion when there is no sales history', async () => {
    const product = await makeProduct(7);
    await recordMovement({
      productId: product._id,
      warehouseId,
      type: 'inbound',
      quantity: 100,
      referenceType: 'manual',
      createdBy: userId,
    });

    const forecast = await getForecastForProduct(product._id.toString(), warehouseId);
    expect(forecast.dailyVelocity).toBe(0);
    expect(forecast.daysOfStockRemaining).toBeNull();
    expect(forecast.reorderSuggested).toBe(false);
  });

  it('computes velocity from outbound movements in the last 30 days and suggests reorder when stock will run out before lead time', async () => {
    const product = await makeProduct(10); // 10-day lead time

    await recordMovement({
      productId: product._id,
      warehouseId,
      type: 'inbound',
      quantity: 100,
      referenceType: 'manual',
      createdBy: userId,
    });

    // simulate selling 60 units total within the last 30 days -> velocity = 2/day
    await recordMovement({
      productId: product._id,
      warehouseId,
      type: 'outbound',
      quantity: 60,
      referenceType: 'manual',
      createdBy: userId,
    });
    await backdateLastMovement(product._id, 15); // well within the 30-day window

    // remaining stock: 100 - 60 = 40. velocity = 60/30 = 2/day.
    // daysOfStockRemaining = 40 / 2 = 20 days, which is > 10-day lead time -> NOT due yet
    const forecast = await getForecastForProduct(product._id.toString(), warehouseId);
    expect(forecast.dailyVelocity).toBeCloseTo(2, 5);
    expect(forecast.daysOfStockRemaining).toBeCloseTo(20, 5);
    expect(forecast.reorderSuggested).toBe(false);
  });

  it('suggests reorder when days of stock remaining drops at or below lead time', async () => {
    const product = await makeProduct(15); // 15-day lead time

    await recordMovement({
      productId: product._id,
      warehouseId,
      type: 'inbound',
      quantity: 40,
      referenceType: 'manual',
      createdBy: userId,
    });

    // sell 30 of the 40 units -> 10 remain
    await recordMovement({
      productId: product._id,
      warehouseId,
      type: 'outbound',
      quantity: 30,
      referenceType: 'manual',
      createdBy: userId,
    });
    await backdateLastMovement(product._id, 10);

    // velocity = 30/30 = 1/day. daysOfStockRemaining = 10/1 = 10 days <= 15-day lead time -> due
    const forecast = await getForecastForProduct(product._id.toString(), warehouseId);
    expect(forecast.dailyVelocity).toBeCloseTo(1, 5);
    expect(forecast.daysOfStockRemaining).toBeCloseTo(10, 5);
    expect(forecast.reorderSuggested).toBe(true);
    expect(forecast.suggestedReorderQty).toBeGreaterThan(0);
    expect(forecast.reason).toContain('Forecast Widget');
  });

  it('ignores outbound movements outside the 30-day velocity window', async () => {
    const product = await makeProduct(7);
    await recordMovement({
      productId: product._id,
      warehouseId,
      type: 'inbound',
      quantity: 50,
      referenceType: 'manual',
      createdBy: userId,
    });
    await recordMovement({
      productId: product._id,
      warehouseId,
      type: 'outbound',
      quantity: 50,
      referenceType: 'manual',
      createdBy: userId,
    });
    // this sale happened 45 days ago - outside the 30-day window
    await backdateLastMovement(product._id, 45);

    const forecast = await getForecastForProduct(product._id.toString(), warehouseId);
    expect(forecast.dailyVelocity).toBe(0);
  });
});

describe('forecastService.runReorderCheck', () => {
  it('creates a reorder_suggested alert for a product due to run out, and dedupes on repeat runs', async () => {
    const product = await makeProduct(15);
    await recordMovement({
      productId: product._id,
      warehouseId,
      type: 'inbound',
      quantity: 40,
      referenceType: 'manual',
      createdBy: userId,
    });
    await recordMovement({
      productId: product._id,
      warehouseId,
      type: 'outbound',
      quantity: 30,
      referenceType: 'manual',
      createdBy: userId,
    });
    await backdateLastMovement(product._id, 10);

    const first = await runReorderCheck();
    expect(first.created).toBe(1);

    const second = await runReorderCheck();
    expect(second.created).toBe(0); // already has an open alert

    const alerts = await AlertLog.find({ productId: product._id, type: 'reorder_suggested' });
    expect(alerts).toHaveLength(1);
  });

  it('auto-resolves a reorder alert once velocity/stock no longer justify it', async () => {
    const product = await makeProduct(15);
    await recordMovement({
      productId: product._id,
      warehouseId,
      type: 'inbound',
      quantity: 40,
      referenceType: 'manual',
      createdBy: userId,
    });
    await recordMovement({
      productId: product._id,
      warehouseId,
      type: 'outbound',
      quantity: 30,
      referenceType: 'manual',
      createdBy: userId,
    });
    await backdateLastMovement(product._id, 10);

    await runReorderCheck();
    let alerts = await AlertLog.find({ productId: product._id, type: 'reorder_suggested' });
    expect(alerts[0]?.resolved).toBe(false);

    // big restock pushes daysOfStockRemaining well past lead time
    await recordMovement({
      productId: product._id,
      warehouseId,
      type: 'inbound',
      quantity: 500,
      referenceType: 'manual',
      createdBy: userId,
    });

    const result = await runReorderCheck();
    expect(result.resolved).toBe(1);

    alerts = await AlertLog.find({ productId: product._id, type: 'reorder_suggested' });
    expect(alerts[0]?.resolved).toBe(true);
  });
});
