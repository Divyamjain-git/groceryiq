from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import forecast, anomaly, markdown, basket, insights

app = FastAPI(title="GroceryIQ ML Service", description="Self-hosted AI/ML microservice for GroceryIQ")

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(forecast.router, prefix="/forecast", tags=["forecast"])
app.include_router(anomaly.router, prefix="/anomaly", tags=["anomaly"])
app.include_router(markdown.router, prefix="/markdown", tags=["markdown"])
app.include_router(basket.router, prefix="/basket-analysis", tags=["basket"])
app.include_router(insights.router, prefix="/insights", tags=["insights"])


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "GroceryIQ ML Engine",
        "algorithms": ["XGBoost", "Isolation Forest", "Ridge Regression", "Apriori"]
    }
