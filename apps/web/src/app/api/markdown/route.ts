import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const productName = typeof body.productName === "string" ? body.productName : "Cheddar Cheese 200g";
    const days = Number.isFinite(Number(body.daysToExpiry)) ? Number(body.daysToExpiry) : 4;
    const str = Number.isFinite(Number(body.sellThroughRate)) ? Number(body.sellThroughRate) : 0.45;
    const stock = Number.isFinite(Number(body.currentStock)) ? Number(body.currentStock) : 50;
    const price = Number.isFinite(Number(body.originalPrice)) ? Number(body.originalPrice) : 4.5;
    const category = typeof body.category === "string" ? body.category : "Dairy";

    // Ridge Regression Equation (from CE2 model fitting):
    // Discount% = 54.2 - 1.73 * days - 14.8 * sellThrough + 0.04 * stock + categoryBonus
    const categoryBonus = category === "Dairy" ? 5 : category === "Produce" ? 8 : category === "Bakery" ? 6 : 0;
    const rawDiscount = 54.2 - 1.73 * days - 14.8 * str + 0.04 * stock + categoryBonus;
    const discountPct = Math.max(0, Math.min(65, Math.round(rawDiscount)));

    const discountedPrice = Number((price * (1 - discountPct / 100)).toFixed(2));
    const potentialWasteLoss = Number((stock * price).toFixed(2));
    const projectedRecoveredRevenue = Number((stock * discountedPrice * 0.92).toFixed(2));

    let urgency = "LOW";
    if (days <= 3) urgency = "CRITICAL";
    else if (days <= 7) urgency = "HIGH";
    else if (days <= 14) urgency = "MEDIUM";

    return NextResponse.json({
      productName,
      daysToExpiry: days,
      currentStock: stock,
      originalPrice: price,
      recommendedDiscountPct: discountPct,
      discountedPrice,
      urgency,
      projectedRecoveredRevenue,
      potentialWasteLoss,
      netRecoveryGain: projectedRecoveredRevenue,
      modelFormula: "Discount% = 54.2 - 1.73·Days - 14.8·SellThrough + 0.04·Stock + CatBonus",
      modelUsed: "Ridge Regression (alpha=10.0, R²=0.940)",
    });
  } catch (err: unknown) {
    console.error("[/api/markdown] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
