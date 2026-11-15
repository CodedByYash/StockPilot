import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Product } from '../models/Product';
import { Warehouse } from '../models/Warehouse';
import { recordMovement, getCurrentStock } from '../services/stockService';
import { lookupByBarcode, recordMovementByBarcode, BarcodeNotFoundError } from '../services/barcodeService';

let replSet: MongoMemoryReplSet;

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

async function makeProductWithBarcode(barcode: string) {
  return Product.create({
    sku: `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: 'Scannable Widget',
    barcode,
    costPrice: 20,
    sellPrice: 32,
  });
}

describe('barcodeService', () => {
  it('looks up a product and its per-warehouse stock by barcode', async () => {
    const warehouse = await Warehouse.create({ name: 'Pune Main' });
    const product = await makeProductWithBarcode('8901234567890');

    await recordMovement({
      productId: product._id,
      warehouseId: warehouse._id,
      type: 'inbound',
      quantity: 25,
      referenceType: 'manual',
      createdBy: userId,
    });

    const result = await lookupByBarcode('8901234567890');
    expect(result.product.name).toBe('Scannable Widget');
    expect(result.stockByWarehouse).toHaveLength(1);
    expect(result.stockByWarehouse[0]?.quantity).toBe(25);
  });

  it('throws BarcodeNotFoundError for an unknown code', async () => {
    await expect(lookupByBarcode('0000000000000')).rejects.toThrow(BarcodeNotFoundError);
  });

  it('does not match a barcode belonging to an inactive product', async () => {
    const product = await makeProductWithBarcode('1112223334445');
    product.isActive = false;
    await product.save();

    await expect(lookupByBarcode('1112223334445')).rejects.toThrow(BarcodeNotFoundError);
  });

  it('records a stock movement by scanning a barcode, without the caller knowing the product id', async () => {
    const warehouse = await Warehouse.create({ name: 'Mumbai Hub' });
    await makeProductWithBarcode('5556667778889');

    await recordMovementByBarcode({
      barcode: '5556667778889',
      warehouseId: warehouse._id.toString(),
      type: 'inbound',
      quantity: 40,
      createdBy: userId,
    });

    const product = await Product.findOne({ barcode: '5556667778889' });
    const qty = await getCurrentStock(product!._id.toString(), warehouse._id.toString());
    expect(qty).toBe(40);
  });

  it('rejects recording a movement for an unrecognized barcode', async () => {
    const warehouse = await Warehouse.create({ name: 'Mumbai Hub' });

    await expect(
      recordMovementByBarcode({
        barcode: 'does-not-exist',
        warehouseId: warehouse._id.toString(),
        type: 'inbound',
        quantity: 10,
        createdBy: userId,
      })
    ).rejects.toThrow(BarcodeNotFoundError);
  });
});
