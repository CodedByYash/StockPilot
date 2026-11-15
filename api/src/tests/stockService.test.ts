import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { recordMovement, getCurrentStock, InsufficientStockError } from '../services/stockService';

// Transactions require a replica set, even in the in-memory test DB —
// this mirrors production (MongoDB Atlas is always a replica set).
let replSet: MongoMemoryReplSet;

const productId = new Types.ObjectId().toString();
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

describe('stockService.recordMovement', () => {
  it('applies a single inbound movement correctly', async () => {
    await recordMovement({
      productId,
      warehouseId,
      type: 'inbound',
      quantity: 100,
      referenceType: 'manual',
      createdBy: userId,
    });

    const qty = await getCurrentStock(productId, warehouseId);
    expect(qty).toBe(100);
  });

  it('rejects outbound movements that would take stock negative', async () => {
    await recordMovement({
      productId,
      warehouseId,
      type: 'inbound',
      quantity: 10,
      referenceType: 'manual',
      createdBy: userId,
    });

    await expect(
      recordMovement({
        productId,
        warehouseId,
        type: 'outbound',
        quantity: 15,
        referenceType: 'manual',
        createdBy: userId,
      })
    ).rejects.toThrow(InsufficientStockError);

    // stock must be unchanged after the rejected attempt
    const qty = await getCurrentStock(productId, warehouseId);
    expect(qty).toBe(10);
  });

  it('stays exactly correct under 50 concurrent inbound writes (the core proof)', async () => {
    const concurrentWrites = 50;
    const qtyEach = 3;

    await Promise.all(
      Array.from({ length: concurrentWrites }, () =>
        recordMovement({
          productId,
          warehouseId,
          type: 'inbound',
          quantity: qtyEach,
          referenceType: 'manual',
          createdBy: userId,
        })
      )
    );

    const qty = await getCurrentStock(productId, warehouseId);
    expect(qty).toBe(concurrentWrites * qtyEach);
  });

  it('stays exactly correct under mixed concurrent inbound/outbound writes', async () => {
    // Seed enough stock that outbound writes won't race into insufficiency
    await recordMovement({
      productId,
      warehouseId,
      type: 'inbound',
      quantity: 1000,
      referenceType: 'manual',
      createdBy: userId,
    });

    const inbound = Array.from({ length: 25 }, () =>
      recordMovement({
        productId,
        warehouseId,
        type: 'inbound',
        quantity: 4,
        referenceType: 'manual',
        createdBy: userId,
      })
    );
    const outbound = Array.from({ length: 25 }, () =>
      recordMovement({
        productId,
        warehouseId,
        type: 'outbound',
        quantity: 2,
        referenceType: 'manual',
        createdBy: userId,
      })
    );

    await Promise.all([...inbound, ...outbound]);

    // 1000 + (25*4) - (25*2) = 1050
    const qty = await getCurrentStock(productId, warehouseId);
    expect(qty).toBe(1050);
  });
});
