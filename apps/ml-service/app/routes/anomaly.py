import os
from typing import Optional
import joblib
import numpy as np
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

MODELS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "models"))
ISO_MODEL = joblib.load(os.path.join(MODELS_DIR, "iso_anomaly.joblib"))


class AnomalyCheckRequest(BaseModel):
    product_id: str
    recent_stock_drop: Optional[float] = 89.0
    expected_drop: Optional[float] = 40.0
    unit_price: Optional[float] = 2.5


class AnomalyCheckResponse(BaseModel):
    product_id: str
    anomaly_score: float
    is_anomalous: bool
    anomaly_type: str
    severity: str
    explanation: str


@router.post("/check", response_model=AnomalyCheckResponse)
def check_anomaly(req: AnomalyCheckRequest):
    """Real inference using trained IsolationForest (iso_anomaly.joblib)."""
    actual = float(req.recent_stock_drop or 89.0)
    expected = float(req.expected_drop or 40.0)
    price = float(req.unit_price or 2.5)

    X = np.array([[actual, price, actual * price]])
    pred = int(ISO_MODEL.predict(X)[0])
    raw_score = float(-ISO_MODEL.score_samples(X)[0])
    dev_ratio = abs(actual - expected) / max(expected, 1.0)
    is_anom = pred == -1 or dev_ratio > 1.4

    if is_anom and dev_ratio > 1.8:
        atype, sev = "Critical Shrinkage / Bulk Outlier", "CRITICAL"
    elif is_anom:
        atype, sev = "Spoilage / Unusual Movement", "HIGH"
    else:
        atype, sev = "Normal Stock Movement", "LOW"

    return AnomalyCheckResponse(
        product_id=req.product_id,
        anomaly_score=round(raw_score, 3),
        is_anomalous=is_anom,
        anomaly_type=atype,
        severity=sev,
        explanation=f"IsolationForest (iso_anomaly.joblib) score={raw_score:.3f}, deviation={dev_ratio:.2f}x.",
    )
