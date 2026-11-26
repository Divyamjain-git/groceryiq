/**
 * Synthetic data generator — this is what makes Weeks 7-10 (forecasting,
 * anomaly detection, market basket, AI insights) demoable without a real
 * store. Run with: npx prisma db seed
 *
 * Generates:
 *  - ~40 products across a few grocery categories
 *  - 90 days of daily sales per product, with weekly seasonality + noise
 *  - batches with varying expiry dates
 *  - a handful of deliberately-inserted anomalies (sudden unexplained
 *    stock drops) for the anomaly-detection model to catch
 *  - transactions with baked-in co-purchase patterns (e.g. chips + salsa)
 *    for market basket analysis to surface
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'password123'; // login with this for owner@groceryiq.example / cashier@groceryiq.example

const CATEGORIES: Record<string, string[]> = {
  Dairy: ['Whole Milk 1L', 'Cheddar Cheese 200g', 'Greek Yogurt 500g', 'Butter 250g'],
  Produce: ['Bananas 1kg', 'Tomatoes 1kg', 'Spinach 200g', 'Apples 1kg'],
  Bakery: ['White Bread', 'Whole Wheat Bread', 'Croissants (4pk)'],
  Snacks: ['Potato Chips 150g', 'Salsa Dip 250g', 'Tortilla Chips 200g', 'Chocolate Bar'],
  Pantry: ['Rice 1kg', 'Pasta 500g', 'Cooking Oil 1L', 'Canned Tomatoes'],
};

// deliberate co-purchase pairs for market basket analysis to find
const BASKET_PAIRS = [
  ['Potato Chips 150g', 'Salsa Dip 250g'],
  ['White Bread', 'Butter 250g'],
  ['Pasta 500g', 'Canned Tomatoes'],
];

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  const store = await prisma.store.create({
    data: { name: 'GroceryIQ Demo Store', address: '123 Market St', timezone: 'UTC' },
  });

  const supplier = await prisma.supplier.create({
    data: { storeId: store.id, name: 'Fresh Foods Distribution', contactInfo: 'orders@freshfoods.example' },
  });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await prisma.user.create({
    data: {
      storeId: store.id,
      name: 'Demo Owner',
      email: 'owner@groceryiq.example',
      passwordHash,
      role: 'OWNER',
    },
  });
  const cashier = await prisma.user.create({
    data: {
      storeId: store.id,
      name: 'Demo Cashier',
      email: 'cashier@groceryiq.example',
      passwordHash,
      role: 'CASHIER',
    },
  });

  const productsByName: Record<string, string> = {}; // name -> id

  for (const [category, names] of Object.entries(CATEGORIES)) {
    for (const name of names) {
      const product = await prisma.product.create({
        data: {
          storeId: store.id,
          sku: name.toUpperCase().replace(/[^A-Z0-9]/g, '-'),
          name,
          category,
          unit: 'each',
          reorderPoint: randInt(10, 30),
          unitCostCents: randInt(50, 400),
          unitPriceCents: randInt(100, 700),
        },
      });
      productsByName[name] = product.id;

      // a few batches per product with staggered expiry dates
      for (let b = 0; b < 3; b++) {
        const daysToExpiry = randInt(-2, 21); // a couple already expired, for realism
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + daysToExpiry);
        await prisma.batch.create({
          data: {
            productId: product.id,
            supplierId: supplier.id,
            quantity: randInt(20, 100),
            expiryDate,
            costPerUnitCents: randInt(50, 400),
          },
        });
      }
    }
  }

  console.log(`Seeded ${Object.keys(productsByName).length} products with batches.`);

  // 90 days of transactions with weekly seasonality + a few deliberate anomalies
  const productNames = Object.keys(productsByName);
  const today = new Date();

  for (let daysAgo = 90; daysAgo >= 0; daysAgo--) {
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const transactionsToday = isWeekend ? randInt(15, 25) : randInt(8, 15);

    for (let t = 0; t < transactionsToday; t++) {
      // decide if this basket follows one of the deliberate co-purchase patterns
      const useBasketPair = Math.random() < 0.25;
      const itemNames: string[] = useBasketPair
        ? BASKET_PAIRS[randInt(0, BASKET_PAIRS.length - 1)]
        : [productNames[randInt(0, productNames.length - 1)]];

      // occasionally add 1-2 random extra items to the basket
      const extraItems = randInt(0, 2);
      for (let e = 0; e < extraItems; e++) {
        itemNames.push(productNames[randInt(0, productNames.length - 1)]);
      }

      let totalCents = 0;
      const itemsData = [];
      for (const name of itemNames) {
        const productId = productsByName[name];
        const product = await prisma.product.findUnique({ where: { id: productId } });
        const batch = await prisma.batch.findFirst({
          where: { productId, quantity: { gt: 0 } },
          orderBy: { expiryDate: 'asc' },
        });
        if (!product || !batch) continue;
        const qty = randInt(1, 3);
        totalCents += product.unitPriceCents * qty;
        itemsData.push({ productId, batchId: batch.id, quantity: qty, unitPriceCents: product.unitPriceCents });
      }
      if (itemsData.length === 0) continue;

      await prisma.transaction.create({
        data: {
          storeId: store.id,
          cashierId: cashier.id,
          totalAmountCents: totalCents,
          paymentMethod: Math.random() < 0.6 ? 'card' : 'cash',
          createdAt: date,
          items: { create: itemsData },
        },
      });
    }
  }

  // deliberate anomalies: a few sudden unexplained stock drops, for the
  // anomaly-detection model to have something real to catch in the demo
  const anomalyProducts = productNames.slice(0, 3);
  for (const name of anomalyProducts) {
    const productId = productsByName[name];
    const batch = await prisma.batch.findFirst({ where: { productId } });
    if (!batch) continue;
    await prisma.stockMovement.create({
      data: {
        productId,
        batchId: batch.id,
        type: 'SHRINKAGE',
        quantity: -randInt(15, 30),
        reason: 'Unexplained count discrepancy (synthetic anomaly for demo)',
      },
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
