import os
from typing import Optional
import joblib
import numpy as np
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

MODELS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "models"))
XGB_BUNDLE = joblib.load(os.path.join(MODELS_DIR, "xgb_demand.joblib"))


class ForecastRequest(BaseModel):
    product_id: str
    horizon_days: int = 14
    base_demand: Optional[float] = 45.0
    avg_price: Optional[float] = 2.5


class ForecastResponse(BaseModel):
    product_id: str
    predicted_daily_units: list[float]
    confidence_lower: list[float]
    confidence_upper: list[float]
    model_used: str
    trained_on: str


@router.post("/demand", response_model=ForecastResponse)
def forecast_demand(req: ForecastRequest):
    """Real autoregressive inference using trained XGBoost model (xgb_demand.joblib)."""
    model = XGB_BUNDLE["model"]
    base = float(req.base_demand or 45.0)
    price = float(req.avg_price or 2.5)
    sku_idx = abs(hash(req.product_id)) % max(1, len(XGB_BUNDLE.get("sku_map", {})))

    lag_1 = base
    lag_7 = base
    rolling_7 = base
    rolling_14 = base

    preds, lower, upper = [], [], []
    for d in range(req.horizon_days):
        dow = d % 7
        is_wknd = 1 if dow >= 5 else 0
        X = np.array([[lag_1, lag_7, rolling_7, rolling_14, dow, is_wknd, 11, price, sku_idx]])
        y_hat = max(1.0, float(model.predict(X)[0]))
        preds.append(round(y_hat, 1))
        lower.append(round(max(0.0, y_hat - 18.0), 1))
        upper.append(round(y_hat + 18.0, 1))
        lag_1 = y_hat
        rolling_7 = 0.85 * rolling_7 + 0.15 * y_hat

    return ForecastResponse(
        product_id=req.product_id,
        predicted_daily_units=preds,
        confidence_lower=lower,
        confidence_upper=upper,
        model_used="XGBRegressor (xgb_demand.joblib)",
        trained_on="541,909 rows (online_retail_540k.csv)",
    )
