"""
GroceryIQ — Synthetic Data Generator for CE1 Notebook
=====================================================
Mirrors the seed.ts logic from core-service but outputs CSV files
so the Colab notebook can run standalone without a database.

Generates:
 - products.csv        ~40 products across 5 grocery categories
 - transactions.csv    90 days of daily sales with weekly seasonality
 - transaction_items.csv  line items linking transactions → products → batches
 - batches.csv         multiple batches per product with staggered expiry
 - stock_movements.csv  including deliberate anomalies for ML demo
"""

import os
import random
import uuid
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

# ── reproducible results ──
SEED = 42
random.seed(SEED)
np.random.seed(SEED)

# ── output directory ──
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "csv")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── product catalogue ──
CATEGORIES: dict[str, list[str]] = {
    "Dairy": ["Whole Milk 1L", "Cheddar Cheese 200g", "Greek Yogurt 500g",
              "Butter 250g", "Cream Cheese 150g", "Mozzarella 200g",
              "Skimmed Milk 1L", "Paneer 200g"],
    "Produce": ["Bananas 1kg", "Tomatoes 1kg", "Spinach 200g", "Apples 1kg",
                "Onions 1kg", "Potatoes 2kg", "Carrots 500g", "Lemons 500g"],
    "Bakery": ["White Bread", "Whole Wheat Bread", "Croissants (4pk)",
               "Dinner Rolls (6pk)", "Bagels (4pk)", "Muffins (4pk)"],
    "Snacks": ["Potato Chips 150g", "Salsa Dip 250g", "Tortilla Chips 200g",
               "Chocolate Bar", "Mixed Nuts 200g", "Popcorn 100g",
               "Cookies 300g", "Granola Bar (6pk)"],
    "Pantry": ["Rice 1kg", "Pasta 500g", "Cooking Oil 1L", "Canned Tomatoes",
               "Sugar 1kg", "Salt 500g", "Flour 1kg", "Soy Sauce 250ml",
               "Instant Noodles (5pk)", "Tea Bags (100pk)"],
}

# co-purchase pairs for market basket analysis
BASKET_PAIRS = [
    ("Potato Chips 150g", "Salsa Dip 250g"),
    ("White Bread", "Butter 250g"),
    ("Pasta 500g", "Canned Tomatoes"),
    ("Tea Bags (100pk)", "Sugar 1kg"),
    ("Rice 1kg", "Cooking Oil 1L"),
]


def _uid() -> str:
    return uuid.uuid4().hex[:12]


def _rand_int(lo: int, hi: int) -> int:
    return random.randint(lo, hi)


# ═══════════════════════════════════════════════════
# 1. Generate products
# ═══════════════════════════════════════════════════
def generate_products() -> pd.DataFrame:
    rows = []
    for category, names in CATEGORIES.items():
        for name in names:
            rows.append({
                "product_id": _uid(),
                "sku": name.upper().replace(" ", "-").replace("(", "").replace(")", ""),
                "name": name,
                "category": category,
                "unit": "each",
                "reorder_point": _rand_int(10, 30),
                "unit_cost_cents": _rand_int(50, 400),
                "unit_price_cents": _rand_int(100, 700),
            })
    return pd.DataFrame(rows)


# ═══════════════════════════════════════════════════
# 2. Generate batches (3 per product, staggered expiry)
# ═══════════════════════════════════════════════════
def generate_batches(products: pd.DataFrame) -> pd.DataFrame:
    today = datetime.now()
    rows = []
    for _, prod in products.iterrows():
        for b in range(3):
            days_to_expiry = _rand_int(-5, 25)
            expiry = today + timedelta(days=days_to_expiry)
            received = today - timedelta(days=_rand_int(5, 60))
            rows.append({
                "batch_id": _uid(),
                "product_id": prod["product_id"],
                "supplier_id": f"supplier-{_rand_int(1, 3)}",
                "quantity": _rand_int(20, 120),
                "received_date": received.strftime("%Y-%m-%d"),
                "expiry_date": expiry.strftime("%Y-%m-%d"),
                "cost_per_unit_cents": _rand_int(50, 400),
            })
    return pd.DataFrame(rows)


# ═══════════════════════════════════════════════════
# 3. Generate 90 days of transactions
# ═══════════════════════════════════════════════════
def generate_transactions(products: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    product_names = products["name"].tolist()
    product_ids = dict(zip(products["name"], products["product_id"]))
    product_prices = dict(zip(products["name"], products["unit_price_cents"]))

    today = datetime.now()
    txn_rows = []
    item_rows = []

    for days_ago in range(90, -1, -1):
        date = today - timedelta(days=days_ago)
        is_weekend = date.weekday() >= 5
        n_txn = _rand_int(15, 28) if is_weekend else _rand_int(8, 18)

        for _ in range(n_txn):
            txn_id = _uid()

            # 25% chance of using a deliberate basket pair
            use_pair = random.random() < 0.25
            if use_pair:
                pair = random.choice(BASKET_PAIRS)
                item_names = list(pair)
            else:
                item_names = [random.choice(product_names)]

            # occasionally add 1-2 extra items
            for _ in range(_rand_int(0, 2)):
                item_names.append(random.choice(product_names))

            total_cents = 0
            for name in item_names:
                qty = _rand_int(1, 4)
                price = product_prices[name]
                total_cents += price * qty
                item_rows.append({
                    "item_id": _uid(),
                    "transaction_id": txn_id,
                    "product_id": product_ids[name],
                    "product_name": name,
                    "quantity": qty,
                    "unit_price_cents": price,
                })

            txn_rows.append({
                "transaction_id": txn_id,
                "store_id": "demo-store",
                "cashier_id": "demo-cashier",
                "total_amount_cents": total_cents,
                "payment_method": random.choice(["card", "card", "card", "cash", "cash"]),
                "created_at": date.strftime("%Y-%m-%d %H:%M:%S"),
            })

    return pd.DataFrame(txn_rows), pd.DataFrame(item_rows)


# ═══════════════════════════════════════════════════
# 4. Generate stock movements (+ deliberate anomalies)
# ═══════════════════════════════════════════════════
def generate_stock_movements(products: pd.DataFrame, batches: pd.DataFrame) -> pd.DataFrame:
    today = datetime.now()
    rows = []

    # normal movements
    for _, prod in products.iterrows():
        prod_batches = batches[batches["product_id"] == prod["product_id"]]
        for days_ago in range(90, -1, -1):
            if random.random() < 0.7:  # not every product moves every day
                date = today - timedelta(days=days_ago)
                batch = prod_batches.iloc[_rand_int(0, len(prod_batches) - 1)]
                rows.append({
                    "movement_id": _uid(),
                    "product_id": prod["product_id"],
                    "batch_id": batch["batch_id"],
                    "type": "SALE",
                    "quantity": -_rand_int(1, 8),
                    "reason": None,
                    "created_at": date.strftime("%Y-%m-%d %H:%M:%S"),
                })

    # deliberate anomalies — sudden unexplained stock drops
    anomaly_products = products.head(5)
    for _, prod in anomaly_products.iterrows():
        prod_batches = batches[batches["product_id"] == prod["product_id"]]
        if len(prod_batches) == 0:
            continue
        batch = prod_batches.iloc[0]
        anomaly_date = today - timedelta(days=_rand_int(5, 30))
        rows.append({
            "movement_id": _uid(),
            "product_id": prod["product_id"],
            "batch_id": batch["batch_id"],
            "type": "SHRINKAGE",
            "quantity": -_rand_int(20, 50),
            "reason": "Unexplained count discrepancy (anomaly)",
            "created_at": anomaly_date.strftime("%Y-%m-%d %H:%M:%S"),
        })

    return pd.DataFrame(rows)


# ═══════════════════════════════════════════════════
# 5. Inject realistic data-quality issues (for cleaning demo)
# ═══════════════════════════════════════════════════
def inject_data_quality_issues(
    products: pd.DataFrame,
    transactions: pd.DataFrame,
    items: pd.DataFrame,
    batches: pd.DataFrame,
    movements: pd.DataFrame,
) -> tuple:
    """Add missing values, duplicates, and type issues so the notebook
    has real problems to clean."""

    # --- Missing values ---
    # ~5% of batch expiry dates set to NaN
    mask = np.random.random(len(batches)) < 0.05
    batches.loc[mask, "expiry_date"] = np.nan

    # ~3% of product reorder_points set to NaN
    mask = np.random.random(len(products)) < 0.03
    products.loc[mask, "reorder_point"] = np.nan

    # ~2% of transaction payment_method set to NaN
    mask = np.random.random(len(transactions)) < 0.02
    transactions.loc[mask, "payment_method"] = np.nan

    # ~4% of stock movement reasons set to NaN (some already are)
    mask = np.random.random(len(movements)) < 0.04
    movements.loc[mask, "reason"] = np.nan

    # --- Duplicates ---
    # duplicate ~1% of transaction_items
    n_dup = max(1, int(len(items) * 0.01))
    dup_rows = items.sample(n=n_dup, random_state=SEED)
    items = pd.concat([items, dup_rows], ignore_index=True)

    # --- Type issues ---
    # a handful of unit_price_cents stored as strings
    items["unit_price_cents"] = items["unit_price_cents"].astype(object)
    str_indices = items.sample(n=min(10, len(items)), random_state=SEED).index
    for idx in str_indices:
        items.at[idx, "unit_price_cents"] = str(items.at[idx, "unit_price_cents"])

    return products, transactions, items, batches, movements


# ═══════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════
def main():
    print("Generating GroceryIQ synthetic data …")

    products = generate_products()
    batches = generate_batches(products)
    transactions, items = generate_transactions(products)
    movements = generate_stock_movements(products, batches)

    # inject realistic data-quality issues
    products, transactions, items, batches, movements = inject_data_quality_issues(
        products, transactions, items, batches, movements
    )

    # save CSVs
    products.to_csv(os.path.join(OUTPUT_DIR, "products.csv"), index=False)
    batches.to_csv(os.path.join(OUTPUT_DIR, "batches.csv"), index=False)
    transactions.to_csv(os.path.join(OUTPUT_DIR, "transactions.csv"), index=False)
    items.to_csv(os.path.join(OUTPUT_DIR, "transaction_items.csv"), index=False)
    movements.to_csv(os.path.join(OUTPUT_DIR, "stock_movements.csv"), index=False)

    print(f"  Products:          {len(products):>6}")
    print(f"  Batches:           {len(batches):>6}")
    print(f"  Transactions:      {len(transactions):>6}")
    print(f"  Transaction items: {len(items):>6}")
    print(f"  Stock movements:   {len(movements):>6}")
    print(f"\nCSVs saved to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
