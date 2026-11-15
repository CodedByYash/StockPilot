import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createSalesOrder, fulfillSalesOrder, cancelSalesOrder, SalesOrderError } from '../services/salesOrderService';
import { recordMovement, getCurrentStock } from '../services/stockService';

let replSet: MongoMemoryReplSet;

const warehouseId = new Types.ObjectId().toString();
const userId = new Types.ObjectId().toString();
const productA = new Types.ObjectId().toString();
const productB = new Types.ObjectId().toString();

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

async function seedStock(productId: string, qty: number) {
  await recordMovement({
    productId,
    warehouseId,
    type: 'inbound',
    quantity: qty,
    referenceType: 'manual',
    createdBy: userId,
  });
}

async function makeSO() {
  return createSalesOrder({
    orderNumber: `SO-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    warehouseId,
    lines: [
      { productId: productA, qty: 20, unitPrice: 15 },
      { productId: productB, qty: 10, unitPrice: 40 },
    ],
    createdBy: userId,
  });
}

describe('salesOrderService', () => {
  it('creates a pending SO with zero fulfilled quantities', async () => {
    const so = await makeSO();
    expect(so.status).toBe('pending');
    expect(so.lines.every((l) => l.fulfilledQty === 0)).toBe(true);
  });

  it('fully fulfills when enough stock exists', async () => {
    await seedStock(productA, 20);
    await seedStock(productB, 10);
    const so = await makeSO();

    const updated = await fulfillSalesOrder(
      so._id.toString(),
      [
        { productId: productA, qty: 20 },
        { productId: productB, qty: 10 },
      ],
      userId
    );

    expect(updated.status).toBe('fulfilled');
    expect(await getCurrentStock(productA, warehouseId)).toBe(0);
    expect(await getCurrentStock(productB, warehouseId)).toBe(0);
  });

  it('partially fulfills a line when stock is insufficient, leaving it backordered', async () => {
    // only 12 of the 20 requested units of product A exist
    await seedStock(productA, 12);
    await seedStock(productB, 10);
    const so = await makeSO();

    const updated = await fulfillSalesOrder(
      so._id.toString(),
      [
        { productId: productA, qty: 20 }, // requests full line qty
        { productId: productB, qty: 10 },
      ],
      userId
    );

    expect(updated.status).toBe('partially_fulfilled');

    const lineA = updated.lines.find((l) => l.productId.toString() === productA);
    const lineB = updated.lines.find((l) => l.productId.toString() === productB);
    expect(lineA?.fulfilledQty).toBe(12); // fulfilled what was available
    expect(lineB?.fulfilledQty).toBe(10); // fully fulfilled

    // backordered amount for A is derived: qty (20) - fulfilledQty (12) = 8
    expect((lineA?.qty ?? 0) - (lineA?.fulfilledQty ?? 0)).toBe(8);

    // stock genuinely went to zero, no oversell
    expect(await getCurrentStock(productA, warehouseId)).toBe(0);
  });

  it('leaves a line fully backordered (0 fulfilled) when there is zero stock', async () => {
    // no stock seeded for product A at all
    await seedStock(productB, 10);
    const so = await makeSO();

    const updated = await fulfillSalesOrder(
      so._id.toString(),
      [
        { productId: productA, qty: 20 },
        { productId: productB, qty: 10 },
      ],
      userId
    );

    expect(updated.status).toBe('partially_fulfilled');
    const lineA = updated.lines.find((l) => l.productId.toString() === productA);
    expect(lineA?.fulfilledQty).toBe(0);
  });

  it('supports fulfilling a second batch later, topping up a partially fulfilled order', async () => {
    await seedStock(productA, 12);
    await seedStock(productB, 10);
    const so = await makeSO();

    await fulfillSalesOrder(
      so._id.toString(),
      [{ productId: productA, qty: 20 }, { productId: productB, qty: 10 }],
      userId
    );

    // more stock arrives later, fulfill the rest of product A's backorder
    await seedStock(productA, 8);
    const updated = await fulfillSalesOrder(so._id.toString(), [{ productId: productA, qty: 8 }], userId);

    expect(updated.status).toBe('fulfilled');
    const lineA = updated.lines.find((l) => l.productId.toString() === productA);
    expect(lineA?.fulfilledQty).toBe(20);
  });

  it('rejects fulfilling more than the remaining quantity on a line', async () => {
    await seedStock(productA, 100);
    await seedStock(productB, 100);
    const so = await makeSO();

    await expect(
      fulfillSalesOrder(so._id.toString(), [{ productId: productA, qty: 999 }], userId)
    ).rejects.toThrow(SalesOrderError);
  });

  it('cancels a pending order', async () => {
    const so = await makeSO();
    const cancelled = await cancelSalesOrder(so._id.toString());
    expect(cancelled.status).toBe('cancelled');
  });

  it('refuses to cancel a fully fulfilled order', async () => {
    await seedStock(productA, 20);
    await seedStock(productB, 10);
    const so = await makeSO();
    await fulfillSalesOrder(
      so._id.toString(),
      [{ productId: productA, qty: 20 }, { productId: productB, qty: 10 }],
      userId
    );

    await expect(cancelSalesOrder(so._id.toString())).rejects.toThrow(SalesOrderError);
  });
});
