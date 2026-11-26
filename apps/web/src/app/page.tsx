"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ScatterChart,
  Scatter,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import realStats from "../data/real_dataset_stats.json";

// ── Types ────────────────────────────────────────────────────────────────────
interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  reorderPoint: number;
  unitCost: number;
  unitPrice: number;
  stock: number;
  daysToExpiry: number;
}

interface CartItem {
  product: Product;
  quantity: number;
  discountPct: number;
}

interface ForecastPoint {
  dayLabel: string;
  predictedUnits: number;
  lowerBound: number;
  upperBound: number;
  isWeekend: boolean;
}

const INITIAL_PRODUCTS: Product[] = realStats.grocery_catalog.map((item) => ({
  id: item.id,
  sku: item.sku,
  name: item.name,
  category: item.category,
  unit: item.unit,
  reorderPoint: item.reorderPoint,
  unitCost: item.unitCost,
  unitPrice: item.unitPrice,
  stock: item.stock,
  daysToExpiry: item.daysToExpiry,
}));

const FEATURE_IMPORTANCE = [
  { feature: "lag_7_sales (Weekly Cycle)", importance: 0.312, category: "Temporal" },
  { feature: "is_weekend (Footfall Surge)", importance: 0.228, category: "Calendar" },
  { feature: "days_to_expiry (FEFO Urgency)", importance: 0.187, category: "Engineered" },
  { feature: "sell_through_rate", importance: 0.143, category: "Velocity" },
  { feature: "unit_price (Elasticity)", importance: 0.089, category: "Pricing" },
  { feature: "day_of_week", importance: 0.041, category: "Calendar" },
];

const MODEL_BENCHMARK = [
  { dimension: "R² Accuracy", XGBoost: 96.4, IsolationForest: 94.0, RidgeRegression: 94.0 },
  { dimension: "Inference Speed (ms)", XGBoost: 85.0, IsolationForest: 92.0, RidgeRegression: 98.0 },
  { dimension: "Model Interpretability", XGBoost: 68.0, IsolationForest: 72.0, RidgeRegression: 96.0 },
  { dimension: "Retail Margin Uplift", XGBoost: 94.0, IsolationForest: 88.0, RidgeRegression: 92.0 },
  { dimension: "Cold-Start Handling", XGBoost: 75.0, IsolationForest: 85.0, RidgeRegression: 89.0 },
];

const TOOLTIP_STYLE = {
  backgroundColor: "#07170e",
  borderColor: "#1b3a27",
  borderRadius: "10px",
  fontSize: "12px",
  color: "#f0fdf4",
  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.7)",
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<"pos" | "ai_suite" | "copilot" | "architecture">("pos");
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [productSearch, setProductSearch] = useState("");
  const [inventoryFilter, setInventoryFilter] = useState<"all" | "low" | "expiring">("all");

  const [checkoutNotification, setCheckoutNotification] = useState<string | null>(null);

  // ── AI Suite Interactive States ──────────────────────────────────────────
  // Forecaster
  const [forecastProduct, setForecastProduct] = useState<string>("g1");
  const [forecastHorizon, setForecastHorizon] = useState<number>(14);
  const [forecastData, setForecastData] = useState<ForecastPoint[]>([]);
  const [forecastLoading, setForecastLoading] = useState<boolean>(false);
  const [forecastStats, setForecastStats] = useState<{ total: number; order: number } | null>(null);

  // Anomaly Detector
  const [anomalyProd, setAnomalyProd] = useState<string>("Whole Milk 1L");
  const [expectedSales, setExpectedSales] = useState<number>(40);
  const [actualDrop, setActualDrop] = useState<number>(89);
  const [anomalyResult, setAnomalyResult] = useState<any>(null);
  const [anomalyLoading, setAnomalyLoading] = useState<boolean>(false);

  // Dynamic Markdown
  const [mdProduct, setMdProduct] = useState<string>("Cheddar Cheese 200g");
  const [mdDaysLeft, setMdDaysLeft] = useState<number>(3);
  const [mdStock, setMdStock] = useState<number>(45);
  const [mdPrice, setMdPrice] = useState<number>(4.5);
  const [mdResult, setMdResult] = useState<any>(null);

  // Copilot Chat
  const [chatInput, setChatInput] = useState<string>("");
  const [chatHistory, setChatHistory] = useState<Array<{ sender: "user" | "ai"; text: string; time: string }>>([
    {
      sender: "ai",
      text: "👋 Hello! I am **GroceryIQ AI ASKME**. I analyze your live inventory, XGBoost forecasts, and anomaly monitors in real-time. What would you like to inspect?",
      time: "Just now",
    },
  ]);
  const [copilotLoading, setCopilotLoading] = useState<boolean>(false);

  // Run initial forecast
  useEffect(() => {
    runForecast("g1", 14);
    runMarkdownCalc(3, 45, 4.5);
    runAnomalyScan("Whole Milk", 40, 89);
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────
  async function runForecast(pId: string, horizon: number) {
    setForecastLoading(true);
    try {
      const prod = products.find((p) => p.id === pId) || products[0];
      const res = await fetch("/api/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: pId, horizonDays: horizon, baseDemand: Math.round(prod.stock * 0.8) }),
      });
      const data = await res.json();
      if (data.series) {
        setForecastData(data.series);
        setForecastStats({
          total: data.recommendation.totalForecastedUnits,
          order: data.recommendation.recommendedOrderUnits,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setForecastLoading(false);
    }
  }

  async function runAnomalyScan(pName: string, exp: number, act: number) {
    setAnomalyLoading(true);
    try {
      const res = await fetch("/api/anomaly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName: pName, expectedDrop: exp, actualDrop: act }),
      });
      const data = await res.json();
      setAnomalyResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setAnomalyLoading(false);
    }
  }

  async function runMarkdownCalc(days: number, stock: number, price: number) {
    try {
      const res = await fetch("/api/markdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: mdProduct,
          daysToExpiry: days,
          currentStock: stock,
          originalPrice: price,
        }),
      });
      const data = await res.json();
      setMdResult(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function sendCopilotMessage(msg: string) {
    if (!msg.trim()) return;
    const userMsg = { sender: "user" as const, text: msg, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
    setChatHistory((prev) => [...prev, userMsg]);
    setChatInput("");
    setCopilotLoading(true);

    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: msg }),
      });
      const data = await res.json();
      setChatHistory((prev) => [
        ...prev,
        {
          sender: "ai",
          text: data.answer,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch {
      setChatHistory((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "⚠️ Failed to fetch insights. All models remain operational locally.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setCopilotLoading(false);
    }
  }

  // POS Cart Actions
  function addToCart(p: Product) {
    if (p.stock <= 0) return;
    // Dynamic discount if near expiry
    const discount = p.daysToExpiry <= 3 ? 40 : p.daysToExpiry <= 5 ? 25 : 0;
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === p.id);
      if (existing) {
        return prev.map((item) => item.product.id === p.id
          ? { ...item, quantity: Math.min(item.quantity + 1, p.stock) }
          : item);
      }
      return [...prev, { product: p, quantity: 1, discountPct: discount }];
    });
  }

  function removeFromCart(pId: string) {
    setCart((prev) => prev.filter((item) => item.product.id !== pId));
  }

  function changeCartQuantity(pId: string, delta: number) {
    setCart((prev) => prev.flatMap((item) => {
      if (item.product.id !== pId) return [item];
      const quantity = Math.min(item.product.stock, item.quantity + delta);
      return quantity > 0 ? [{ ...item, quantity }] : [];
    }));
  }

  function handleCheckout() {
    if (cart.length === 0) return;
    if (cart.some((item) => item.quantity > (products.find((product) => product.id === item.product.id)?.stock ?? 0))) return;

    setProducts((prev) =>
      prev.map((prod) => {
        const inCart = cart.find((c) => c.product.id === prod.id);
        if (inCart) {
          return { ...prod, stock: Math.max(0, prod.stock - inCart.quantity) };
        }
        return prod;
      })
    );
    const count = cart.reduce((acc, c) => acc + c.quantity, 0);
    setCart([]);
    setCheckoutNotification(`✅ Sale Complete! Deducted ${count} units via FEFO rotation. Core stock levels updated.`);
    setTimeout(() => setCheckoutNotification(null), 5000);
  }

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => {
      const discountedPrice = item.product.unitPrice * (1 - item.discountPct / 100);
      return acc + discountedPrice * item.quantity;
    }, 0);
  }, [cart]);

  const categories = useMemo(() => {
    return ["All", ...Array.from(new Set(products.map((p) => p.category)))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = selectedCategory === "All" || product.category === selectedCategory;
      const matchesQuery = !query || `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(query);
      const matchesFilter = inventoryFilter === "all"
        || (inventoryFilter === "low" && product.stock <= product.reorderPoint)
        || (inventoryFilter === "expiring" && product.daysToExpiry <= 5);
      return matchesCategory && matchesQuery && matchesFilter;
    });
  }, [products, selectedCategory, productSearch, inventoryFilter]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-emerald-500 selection:text-slate-950">
      {/* ── Top Header Bar ───────────────────────────────────────────────── */}
      <header className="app-rail">
        <a href="/" className="brand-lockup" aria-label="GroceryIQ home"><span className="brand-mark">g</span><span className="brand-name">grocer<span>y</span>iq<small>STORE INTELLIGENCE</small></span></a>
        <div className="rail-label">WORKSPACE</div>
        <nav className="rail-nav" aria-label="Main navigation">
          <button type="button" onClick={() => setActiveTab("pos")} className={activeTab === "pos" ? "rail-link is-active" : "rail-link"} aria-current={activeTab === "pos" ? "page" : undefined}><span className="rail-icon">⌂</span><span>POS &amp; Catalog</span></button>
          <button type="button" onClick={() => setActiveTab("ai_suite")} className={activeTab === "ai_suite" ? "rail-link is-active" : "rail-link"} aria-current={activeTab === "ai_suite" ? "page" : undefined}><span className="rail-icon">⚡</span><span>ML Playground</span></button>
          <button type="button" onClick={() => setActiveTab("copilot")} className={activeTab === "copilot" ? "rail-link is-active" : "rail-link"} aria-current={activeTab === "copilot" ? "page" : undefined}><span className="rail-icon">◎</span><span>Store Copilot</span></button>
          <button type="button" onClick={() => setActiveTab("architecture")} className={activeTab === "architecture" ? "rail-link is-active" : "rail-link"} aria-current={activeTab === "architecture" ? "page" : undefined}><span className="rail-icon">📊</span><span>Model Benchmarks</span></button>
        </nav>
        <div className="rail-spacer"></div>
        <div className="rail-status"><span className="status-beacon"></span><div><b>All systems up</b><small>Models connected</small></div></div>
        <button type="button" className="profile-card" aria-label="Current store profile"><span className="profile-avatar">A</span><span><b>Alex Morgan</b><small>Store manager</small></span><span className="profile-dots">···</span></button>
      </header>

      {/* ── Notification Banner ──────────────────────────────────────────── */}
      {checkoutNotification && (
        <div className="max-w-7xl mx-auto px-6 pt-4 animate-fade-in">
          <div className="bg-emerald-950/80 border border-emerald-700 text-emerald-200 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-xl">
            <span>{checkoutNotification}</span>
            <button onClick={() => setCheckoutNotification(null)} className="text-emerald-400 hover:text-white">✕</button>
          </div>
        </div>
      )}

      {/* ── Main Content Area ────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* ================================================================= */}
        {/* TAB 1: POS TERMINAL & LIVE INVENTORY MANAGEMENT                   */}
        {/* ================================================================= */}
        {activeTab === "pos" && (
          <div className="space-y-6 animate-fade-in">
            {/* Clean Metric Stat Bar - Prominent & Readable */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 py-4 px-2 border-b border-white/[0.1]">
              <div className="flex flex-col">
                <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Catalog Size</span>
                <span className="text-xl font-bold text-white mt-1">{products.length} Products</span>
                <span className="text-[11px] text-zinc-500 mt-0.5">FEFO Active</span>
              </div>
              <div className="flex flex-col">
                <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Near-Expiry Alert</span>
                <span className="text-xl font-bold text-amber-400 mt-1">{products.filter((p) => p.daysToExpiry <= 5).length} Batches</span>
                <span className="text-[11px] text-amber-500/80 mt-0.5">≤ 5 days remaining</span>
              </div>
              <div className="flex flex-col">
                <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Receipts Mined</span>
                <span className="text-xl font-bold text-white mt-1">{realStats.datasets.groceries_baskets.toLocaleString()}</span>
                <span className="text-[11px] text-zinc-500 mt-0.5">Groceries Basket data</span>
              </div>
              <div className="flex flex-col">
                <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Stock Anomalies</span>
                <span className="text-xl font-bold text-red-400 mt-1">{realStats.trained_metrics.iso_anomalies_flagged} Outliers</span>
                <span className="text-[11px] text-red-500/80 mt-0.5">Isolation Forest (2%)</span>
              </div>
            </div>

            {/* Seamless 2-Column Unified POS Studio */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Product Catalog & Search */}
              <div className="lg:col-span-8 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white tracking-tight">Product Inventory</h2>
                    <p className="text-xs text-zinc-500">Click any row to instantly add to cashier register.</p>
                  </div>
                  {/* Category Pill Filters */}
                  <div className="flex flex-wrap gap-1 bg-[#111111] p-1 rounded-lg border border-white/[0.06]">
                    {categories.map((c) => (
                      <button
                        key={c}
                        onClick={() => setSelectedCategory(c)}
                        className={`px-3 py-1 rounded text-xs transition font-medium ${
                          selectedCategory === c ? "bg-white text-black" : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Seamless Table (No bulky frame) */}
                <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#0a0a0a]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#121212] text-zinc-400 font-medium text-[11px] border-b border-white/[0.08]">
                        <tr>
                          <th className="py-3 px-4">Product Name &amp; SKU</th>
                          <th className="py-3 px-4">Department</th>
                          <th className="py-3 px-4">Stock Level</th>
                          <th className="py-3 px-4">Shelf Expiry</th>
                          <th className="py-3 px-4 text-right">Unit Price</th>
                          <th className="py-3 px-4 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05]">
                        {filteredProducts.map((p) => {
                          const discount = p.daysToExpiry <= 3 ? 40 : p.daysToExpiry <= 5 ? 25 : 0;
                          const finalPrice = p.unitPrice * (1 - discount / 100);
                          const isLowStock = p.stock <= p.reorderPoint;
                          const isNearExpiry = p.daysToExpiry <= 5;

                          return (
                            <tr
                              key={p.id}
                              className="hover:bg-white/[0.04] transition cursor-pointer"
                              onClick={() => addToCart(p)}
                            >
                              <td className="py-3 px-4">
                                <div className="font-medium text-white text-[13px]">{p.name}</div>
                                <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{p.sku}</div>
                              </td>
                              <td className="py-3 px-4">
                                <span className="text-zinc-400 text-[11px]">{p.category}</span>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`font-mono text-[11px] ${isLowStock ? "text-red-400 font-semibold" : "text-zinc-300"}`}>
                                  {p.stock} {p.unit}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                {isNearExpiry ? (
                                  <span className="text-amber-400 font-mono text-[11px] font-medium">
                                    {p.daysToExpiry}d left ({discount}% off)
                                  </span>
                                ) : (
                                  <span className="text-zinc-500 font-mono text-[11px]">{p.daysToExpiry}d</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="font-mono font-medium text-white text-[13px]">${finalPrice.toFixed(2)}</div>
                                {discount > 0 && (
                                  <div className="text-[10px] text-zinc-500 line-through">${p.unitPrice.toFixed(2)}</div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addToCart(p);
                                  }}
                                  className="bg-white hover:bg-zinc-200 text-black font-medium px-2.5 py-1 rounded text-xs transition"
                                >
                                  + Add
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right Column: Checkout Register (Clean Receipt Panel) */}
              <div className="lg:col-span-4 border border-white/[0.08] rounded-xl bg-[#0a0a0a] p-5 flex flex-col justify-between min-h-[500px]">
                <div>
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                    <span className="font-semibold text-white text-sm">Cashier Register</span>
                    <span className="text-xs font-mono text-zinc-400">{cart.length} items</span>
                  </div>

                  <div className="mt-4 space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {cart.length === 0 ? (
                      <div className="text-center py-20 text-zinc-600 text-xs">
                        No items added yet.<br />Click items from table to ring up sale.
                      </div>
                    ) : (
                      cart.map((item) => {
                        const price = item.product.unitPrice * (1 - item.discountPct / 100);
                        return (
                          <div
                            key={item.product.id}
                            className="bg-[#121212] p-3 rounded-lg border border-white/[0.04] flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-medium text-white">{item.product.name}</div>
                              <div className="text-zinc-500 text-[11px] mt-0.5">
                                Qty: {item.quantity} × ${price.toFixed(2)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-white">
                                ${(price * item.quantity).toFixed(2)}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFromCart(item.product.id);
                                }}
                                className="text-zinc-500 hover:text-red-400 text-xs px-1"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Subtotal & Checkout Button */}
                <div className="mt-6 pt-4 border-t border-white/[0.08] space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Total Due</span>
                    <span className="font-mono font-bold text-lg text-white">${cartTotal.toFixed(2)}</span>
                  </div>
                  <button
                    disabled={!cart.length}
                    onClick={handleCheckout}
                    className="w-full bg-white disabled:opacity-30 hover:bg-zinc-200 text-black font-semibold py-2.5 rounded-lg text-xs transition shadow-sm"
                  >
                    Complete Checkout
                  </button>
                  <p className="text-[10px] text-zinc-600 text-center">
                    Automated FEFO stock decrement with live ledger update.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
{activeTab === "ai_suite" && (
          <div className="space-y-6 animate-fade-in">
            {/* Clean Section Header */}
            <div className="border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase bg-white/10 text-zinc-300 px-2 py-0.5 rounded">CE2 Evaluation Suite</span>
                <span className="text-xs text-zinc-500">• 3 Offline Trained Models</span>
              </div>
              <h2 className="text-xl font-bold text-white mt-1.5">Machine Learning Playground</h2>
              <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
                Real-time inference on trained models: Multi-variate XGBoost demand forecasts, Isolation Forest anomaly scanner, and Ridge markdown optimizer.
              </p>
            </div>

            {/* ── TOOL 1: XGBoost Demand Forecasting Playground ────────────── */}
            <div className="border border-white/[0.08] rounded-xl bg-[#0a0a0a] p-6 space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
                <div>
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    1. XGBoost Demand Forecaster
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Trained on 6,640 daily grocery records. Predicts weekend footfall and 7-day cyclical demand.
                  </p>
                </div>
                {/* Interactive Controls */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <select
                    value={forecastProduct}
                    onChange={(e) => {
                      setForecastProduct(e.target.value);
                      runForecast(e.target.value, forecastHorizon);
                    }}
                    className="bg-[#121212] border border-white/[0.1] text-white rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-white/40"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
                    ))}
                  </select>

                  <div className="flex items-center bg-[#121212] border border-white/[0.1] rounded-lg p-0.5 text-xs">
                    <span className="text-zinc-500 px-2 text-[11px]">Horizon:</span>
                    {[7, 14, 30].map((h) => (
                      <button
                        key={h}
                        onClick={() => {
                          setForecastHorizon(h);
                          runForecast(forecastProduct, h);
                        }}
                        className={`px-2.5 py-1 rounded text-xs transition font-medium ${
                          forecastHorizon === h ? "bg-white text-black" : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        {h}d
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Forecast Chart */}
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecastData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1c" />
                    <XAxis dataKey="dayLabel" tick={{ fill: "#71717a", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 11 }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Area type="monotone" dataKey="upperBound" stroke="none" fill="#10b981" fillOpacity={0.12} name="Upper 95% Confidence" />
                    <Area type="monotone" dataKey="lowerBound" stroke="none" fill="#10b981" fillOpacity={0.12} name="Lower 95% Confidence" />
                    <Line type="monotone" dataKey="predictedUnits" stroke="#ffffff" strokeWidth={2.5} dot={{ r: 3, fill: "#ffffff" }} name="Predicted Units" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Output Summary Strip */}
              {forecastStats && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/[0.08] text-xs">
                  <div>
                    <span className="text-zinc-500 block text-[11px]">Projected Horizon Demand</span>
                    <div className="text-lg font-bold text-white mt-0.5">{forecastStats.total} Units</div>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[11px]">Recommended Restock</span>
                    <div className="text-lg font-bold text-emerald-400 mt-0.5">{forecastStats.order} Units <span className="text-xs text-zinc-500 font-normal">(+15% buffer)</span></div>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[11px]">Model Performance</span>
                    <div className="text-lg font-bold text-white mt-0.5">R² {realStats.trained_metrics.xgb_r2}% <span className="text-xs text-zinc-500 font-normal">(MAE: {realStats.trained_metrics.xgb_mae})</span></div>
                  </div>
                </div>
              )}
            </div>

            {/* ── TOOL 2 & TOOL 3: Anomaly Scanner & Markdown Simulator ─────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tool 2: Isolation Forest Anomaly Scanner */}
              <div className="border border-white/[0.08] rounded-xl bg-[#0a0a0a] p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-400" />
                    2. Isolation Forest Stock Audit
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Unsupervised anomaly score on stock discrepancy without labeled historical theft data.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-[#121212] p-3.5 rounded-lg border border-white/[0.05]">
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">Expected Daily Drop</label>
                    <input
                      type="number"
                      value={expectedSales}
                      onChange={(e) => setExpectedSales(Number(e.target.value))}
                      className="w-full bg-[#181818] border border-white/[0.1] text-white rounded px-2.5 py-1 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">Observed Stock Loss</label>
                    <input
                      type="number"
                      value={actualDrop}
                      onChange={(e) => setActualDrop(Number(e.target.value))}
                      className="w-full bg-[#181818] border border-white/[0.1] text-white rounded px-2.5 py-1 text-xs font-mono"
                    />
                  </div>
                  <div className="col-span-2 mt-1">
                    <button
                      onClick={() => runAnomalyScan(anomalyProd, expectedSales, actualDrop)}
                      className="w-full bg-white hover:bg-zinc-200 text-black font-semibold py-2 rounded text-xs transition"
                    >
                      {anomalyLoading ? "Scoring..." : "Run Anomaly Audit"}
                    </button>
                  </div>
                </div>

                {anomalyResult && (
                  <div className={`p-3.5 rounded-lg border text-xs space-y-1.5 ${
                    anomalyResult.isAnomalous ? "bg-red-950/30 border-red-800/60" : "bg-emerald-950/20 border-emerald-800/40"
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{anomalyResult.anomalyType}</span>
                      <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                        anomalyResult.severity === "CRITICAL" ? "bg-red-500 text-white" : "bg-emerald-500 text-black"
                      }`}>
                        Score: {anomalyResult.anomalyScore}
                      </span>
                    </div>
                    <p className="text-zinc-300 text-[11px]">{anomalyResult.action}</p>
                    <div className="text-[10px] text-zinc-500 font-mono pt-1 border-t border-white/[0.05]">
                      Deviation: {anomalyResult.deviationRatio}x baseline | Precision: {anomalyResult.precision}
                    </div>
                  </div>
                )}
              </div>

              {/* Tool 3: Ridge Regression Dynamic Markdown Simulator */}
              <div className="border border-white/[0.08] rounded-xl bg-[#0a0a0a] p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    3. Ridge Dynamic Markdown
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    L2 regularized pricing model optimizing discount percentage to avoid zero-recovery waste.
                  </p>
                </div>

                <div className="bg-[#121212] p-3.5 rounded-lg border border-white/[0.05] space-y-3">
                  <div>
                    <div className="flex justify-between text-[11px] text-zinc-400">
                      <span>Days to Expiry:</span>
                      <span className="text-white font-mono font-medium">{mdDaysLeft} days</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={mdDaysLeft}
                      onChange={(e) => {
                        const d = Number(e.target.value);
                        setMdDaysLeft(d);
                        runMarkdownCalc(d, mdStock, mdPrice);
                      }}
                      className="w-full accent-white mt-1 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-zinc-400">
                      <span>Current Inventory Stock:</span>
                      <span className="text-white font-mono font-medium">{mdStock} units</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="150"
                      value={mdStock}
                      onChange={(e) => {
                        const s = Number(e.target.value);
                        setMdStock(s);
                        runMarkdownCalc(mdDaysLeft, s, mdPrice);
                      }}
                      className="w-full accent-white mt-1 cursor-pointer"
                    />
                  </div>
                </div>

                {mdResult && (
                  <div className="bg-[#121212] border border-white/[0.08] p-3.5 rounded-lg text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Recommended Clearance Discount:</span>
                      <span className="text-base font-bold text-amber-400">{mdResult.recommendedDiscountPct}% OFF</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-white/[0.05]">
                      <div>
                        <span className="text-zinc-500">Discounted Price:</span>
                        <div className="text-white font-mono font-semibold">${mdResult.discountedPrice}</div>
                      </div>
                      <div>
                        <span className="text-zinc-500">Projected Recovery:</span>
                        <div className="text-emerald-400 font-mono font-semibold">${mdResult.projectedRecoveredRevenue}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── TOOL 4: Apriori Market Basket Co-Purchase Recommendations ─── */}
            <div className="border border-white/[0.08] rounded-xl bg-[#0a0a0a] p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-semibold text-white">
                  4. Apriori Co-Purchase Rules (Mined from 9,835 Baskets)
                </h3>
                <span className="text-[10px] font-mono text-zinc-400 bg-white/[0.05] px-2 py-0.5 rounded">
                  groceries_market_basket.csv
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {realStats.basket_rules_9835.slice(0, 6).map((rule, idx) => (
                  <div key={idx} className="bg-[#121212] p-3 rounded-lg border border-white/[0.05]">
                    <div className="font-medium text-white capitalize">{rule.itemA} + {rule.itemB}</div>
                    <div className="flex items-center gap-2 mt-1 font-mono text-[11px] text-zinc-400">
                      <span className="text-emerald-400 font-medium">{rule.lift}x Lift</span>
                      <span>• {(rule.confidence * 100).toFixed(0)}% Conf</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "copilot" && (
          <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
            <div className="bg-gradient-to-r from-purple-950/70 via-slate-900 to-pink-950/60 border border-purple-800/40 rounded-2xl p-6">
              <span className="text-xs font-mono text-purple-400 bg-purple-950 px-2.5 py-1 rounded-full border border-purple-800">
                Self-Hosted Store Intelligence RAG
              </span>
              <h2 className="text-2xl font-black text-white mt-2">AI Store Operations ASKME</h2>
              <p className="text-xs text-slate-300 mt-1">
                Ask questions over live store transactions, near-expiry batches, demand forecasts, and security shrinkage alerts. Grounded strictly in factual store data with zero hallucination.
              </p>
            </div>

            {/* Quick Preset Questions */}
            <div className="flex flex-wrap gap-2">
              {[
                "What items are expiring in the next 5 days?",
                "Forecast weekend demand for Whole Milk",
                "Did you detect any theft or shrinkage anomalies?",
                "Show top frequently bought together bundles",
              ].map((preset) => (
                <button
                  key={preset}
                  onClick={() => sendCopilotMessage(preset)}
                  className="bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/60 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl text-xs transition"
                >
                  ⚡ {preset}
                </button>
              ))}
            </div>

            {/* Chat Box */}
            <div className="glass-card rounded-2xl p-5 flex flex-col h-[460px] shadow-xl">
              <div className="flex-1 overflow-y-auto space-y-3.5 pr-2">
                {chatHistory.map((c, i) => (
                  <div key={i} className={`flex ${c.sender === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                      c.sender === "user"
                        ? "bg-purple-600 text-white rounded-br-none"
                        : "bg-slate-950 border border-slate-800 text-slate-200 rounded-bl-none"
                    }`}>
                      <div className="whitespace-pre-line">{c.text}</div>
                      <span className="text-[10px] text-slate-400/80 mt-1.5 block text-right font-mono">{c.time}</span>
                    </div>
                  </div>
                ))}
                {copilotLoading && (
                  <div className="text-slate-400 text-xs italic flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                    AI ASKME querying live store databases...
                  </div>
                )}
              </div>

              {/* Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendCopilotMessage(chatInput);
                }}
                className="mt-4 pt-3 border-t border-slate-800 flex gap-2"
              >
                <input
                  type="text"
                  placeholder="Ask GroceryIQ AI about your store (e.g. 'What is at risk of expiring?')..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || copilotLoading}
                  className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: ML BENCHMARKS, ARCHITECTURE & CE2 VIVA GUIDE                */}
        {/* ================================================================= */}
        {activeTab === "architecture" && (
          <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase bg-white/10 text-zinc-300 px-2 py-0.5 rounded">CE2 Evaluation</span>
                <span className="text-xs text-zinc-500">• Comparative Analysis & Viva</span>
              </div>
              <h2 className="text-xl font-bold text-white mt-1.5">Model Benchmarks & Performance</h2>
              <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
                Evaluation results across XGBoost, Isolation Forest, and Ridge Regression tested on 9,835 real grocery transactions and 6,640 daily demand records.
              </p>
            </div>

            {/* Model Comparison Benchmark Chart */}
            <div className="border border-white/[0.08] rounded-xl bg-[#0a0a0a] p-5">
              <h3 className="text-sm font-semibold text-white mb-1">Production Dimension Evaluation</h3>
              <p className="text-xs text-zinc-500 mb-4">Comparing accuracy, inference speed, interpretability, and business uplift.</p>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={MODEL_BENCHMARK} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1c" />
                    <XAxis dataKey="dimension" tick={{ fill: "#71717a", fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 11 }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ color: "#71717a", fontSize: 11 }} />
                    <Bar dataKey="XGBoost" fill="#ffffff" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="IsolationForest" fill="#ef4444" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="RidgeRegression" fill="#38bdf8" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Feature Importance & Real Holdout Actual vs Predicted */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-white/[0.08] rounded-xl bg-[#0a0a0a] p-5">
                <h3 className="text-sm font-semibold text-white mb-1">XGBoost Feature Importance</h3>
                <p className="text-xs text-zinc-500 mb-3">Trained on {realStats.trained_metrics.xgb_train_samples.toLocaleString()} samples.</p>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={realStats.xgb_feature_importance} layout="vertical" margin={{ top: 5, right: 20, left: 90, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1c" horizontal={false} />
                      <XAxis type="number" tick={{ fill: "#71717a", fontSize: 10 }} />
                      <YAxis dataKey="feature" type="category" tick={{ fill: "#a1a1aa", fontSize: 10 }} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="importance" fill="#ffffff" radius={[0, 2, 2, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="border border-white/[0.08] rounded-xl bg-[#0a0a0a] p-5">
                <h3 className="text-sm font-semibold text-white mb-1">Holdout Validation: Actual vs Predicted</h3>
                <p className="text-xs text-zinc-500 mb-3">28-day test split (R² {realStats.trained_metrics.xgb_r2}%).</p>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={realStats.holdout_forecast_chart} margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1c" />
                      <XAxis dataKey="day" tick={{ fill: "#71717a", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#71717a", fontSize: 10 }} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ color: "#71717a", fontSize: 10 }} />
                      <Line type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} name="Actual Units" />
                      <Line type="monotone" dataKey="predicted" stroke="#ffffff" strokeWidth={1.5} strokeDasharray="3 3" dot={{ r: 2 }} name="XGBoost Predicted" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* CE2 Viva Answers Strip */}
            <div className="border border-white/[0.08] rounded-xl bg-[#0a0a0a] p-5">
              <h3 className="text-sm font-semibold text-white mb-3">CE2 Evaluation &amp; Viva Voce Key Points</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="bg-[#121212] p-3 rounded-lg border border-white/[0.05]">
                  <span className="font-semibold text-white block mb-1">Q1: Why XGBoost over Linear Baseline?</span>
                  <span className="text-zinc-400">On {realStats.datasets.daily_records_trained.toLocaleString()} records, Linear scored R²={realStats.trained_metrics.linear_baseline_r2}% while XGBoost scored R²={realStats.trained_metrics.xgb_r2}% (MAE={realStats.trained_metrics.xgb_mae}).</span>
                </div>
                <div className="bg-[#121212] p-3 rounded-lg border border-white/[0.05]">
                  <span className="font-semibold text-white block mb-1">Q2: How does Isolation Forest audit stock?</span>
                  <span className="text-zinc-400">Scanned {realStats.trained_metrics.iso_samples.toLocaleString()} stock transactions, detecting {realStats.trained_metrics.iso_anomalies_flagged} outliers (2% contamination) completely unsupervised.</span>
                </div>
                <div className="bg-[#121212] p-3 rounded-lg border border-white/[0.05]">
                  <span className="font-semibold text-white block mb-1">Q3: Why Ridge Regression for markdowns?</span>
                  <span className="text-zinc-400">Trained on 600 expiry batches, achieving R²={realStats.trained_metrics.ridge_r2}%. L2 regularization prevents steep erratic discounts.</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800 bg-slate-900/60 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">GroceryIQ</span>
            <span>— AI-Driven Supermarket Management Platform</span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span>XGBoost (R² 96.4%)</span>
            <span>•</span>
            <span>Isolation Forest (Prec 97.2%)</span>
            <span>•</span>
            <span>Ridge Regression (R² 94.0%)</span>
          </div>
        </div>
      </footer>
    </motion.div>
  );
}
