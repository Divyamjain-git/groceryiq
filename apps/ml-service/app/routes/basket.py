import json
import os
from fastapi import APIRouter

router = APIRouter()

STATS_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "web", "src", "data", "real_dataset_stats.json")
)


@router.get("/{store_id}")
def get_basket_analysis(store_id: str):
    """Returns real Apriori association rules mined from 9,835 grocery baskets."""
    with open(STATS_PATH, "r") as f:
        stats = json.load(f)
    return {
        "store_id": store_id,
        "algorithm": "Apriori Co-Purchase Mining (groceries_market_basket.csv)",
        "total_transactions_analyzed": stats["datasets"]["groceries_baskets"],
        "associations": stats["basket_rules_9835"],
    }
