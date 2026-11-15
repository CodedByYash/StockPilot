import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createPurchaseOrder, receivePurchaseOrder, markOrdered, PurchaseOrderError } from '../services/purchaseOrderService';
import { getCurrentStock } from '../services/stockService';

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

async function makePO() {
  return createPurchaseOrder({
    poNumber: `PO-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    supplierName: 'Acme Supplies',
    warehouseId,
    lines: [
      { productId: productA, orderedQty: 100, unitCost: 10 },
      { productId: productB, orderedQty: 50, unitCost: 25 },
    ],
    createdBy: userId,
  });
}

describe('purchaseOrderService', () => {
  it('creates a PO in draft status with zero received quantities', async () => {
    const po = await makePO();
    expect(po.status).toBe('draft');
    expect(po.lines.every((l) => l.receivedQty === 0)).toBe(true);
  });

  it('marks a draft PO as ordered', async () => {
    const po = await makePO();
    const updated = await markOrdered(po._id.toString());
    expect(updated.status).toBe('ordered');
  });

  it('partially receives a PO and updates status + stock correctly', async () => {
    const po = await makePO();
    await markOrdered(po._id.toString());

    const updated = await receivePurchaseOrder(
      po._id.toString(),
      [{ productId: productA, qty: 60 }],
      userId
    );

    expect(updated.status).toBe('partially_received');
    const lineA = updated.lines.find((l) => l.productId.toString() === productA);
    expect(lineA?.receivedQty).toBe(60);

    const stockA = await getCurrentStock(productA, warehouseId);
    expect(stockA).toBe(60);
  });

  it('marks a PO fully received once every line is complete', async () => {
    const po = await makePO();
    await markOrdered(po._id.toString());

    await receivePurchaseOrder(po._id.toString(), [{ productId: productA, qty: 100 }], userId);
    const final = await receivePurchaseOrder(
      po._id.toString(),
      [{ productId: productB, qty: 50 }],
      userId
    );

    expect(final.status).toBe('received');
    expect(await getCurrentStock(productA, warehouseId)).toBe(100);
    expect(await getCurrentStock(productB, warehouseId)).toBe(50);
  });

  it('rejects receiving more than the remaining ordered quantity', async () => {
    const po = await makePO();
    await markOrdered(po._id.toString());

    await expect(
      receivePurchaseOrder(po._id.toString(), [{ productId: productA, qty: 150 }], userId)
    ).rejects.toThrow(PurchaseOrderError);

    // nothing should have been recorded
    expect(await getCurrentStock(productA, warehouseId)).toBe(0);
  });

  it('rejects receiving against a product not on the PO', async () => {
    const po = await makePO();
    const rogueProductId = new Types.ObjectId().toString();

    await expect(
      receivePurchaseOrder(po._id.toString(), [{ productId: rogueProductId, qty: 5 }], userId)
    ).rejects.toThrow(PurchaseOrderError);
  });
});
