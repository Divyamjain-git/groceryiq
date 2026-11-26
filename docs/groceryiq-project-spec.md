# GroceryIQ — AI-Powered Grocery Store Management Platform

## Project brief (give this whole document to your AI coding assistant)

Build a full-stack, multi-service web platform called **GroceryIQ** that lets a grocery/supermarket manage its entire operation — inventory, POS, suppliers, and analytics — from one system, with a self-hosted AI/ML layer providing demand forecasting, anomaly detection, and natural-language insights.

This is a portfolio project by an intermediate developer aiming for an advanced, production-style architecture (multiple services, not a single monolith). Prioritize clean separation of concerns, typed code end-to-end, and a working demo over exhaustive feature coverage.

**Scope boundaries:**
- No IoT or hardware dependencies. All stock updates come from software only — POS transactions and manual/camera-based barcode scans. No sensors, RFID shelves, or smart devices.
- No external AI APIs. All AI/ML — including the natural-language layer — runs self-hosted, inside your own infrastructure. Nothing calls out to Claude, OpenAI, or any third-party model provider.

---

## 1. Tech stack

**Frontend**
- Next.js 15 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Tremor or Recharts for charts
- TanStack Query for data fetching/caching
- Socket.io-client for real-time updates

**Core backend service** (`core-service`)
- NestJS (Node.js + TypeScript), modular architecture
- Prisma ORM
- JWT auth with role-based access control (owner, manager, cashier)
- Socket.io server for real-time stock/alert broadcasts

**ML/AI service** (`ml-service`) — separate microservice, fully self-hosted
- Python 3.11 + FastAPI
- Prophet or statsmodels (SARIMA) — demand forecasting
- scikit-learn (Isolation Forest) — anomaly/shrinkage detection
- mlxtend (Apriori / FP-Growth) — market basket analysis
- pandas / numpy for data prep
- **Ollama** running a local open-source model (Llama 3.2 3B or Mistral 7B, quantized) — natural-language insights, no external API calls
- (Optional, recommended) a lightweight scikit-learn/DistilBERT **intent classifier** for common questions, with the local LLM as fallback for open-ended ones

**Data layer**
- PostgreSQL — transactional data (products, batches, orders, suppliers, users)
- Redis — cache, live stock counters, pub/sub for real-time alerts
- TimescaleDB extension on Postgres (or ClickHouse) — sales time-series for fast analytics queries

**Infra**
- Docker + docker-compose for local dev (all services containerized, including the Ollama model server)
- GitHub Actions for CI/CD
- Deploy target: Vercel (frontend) + Railway/Render (core-service, Postgres, Redis) + a GPU-capable host or your own machine for `ml-service` + Ollama, since local LLM inference needs more compute than a typical free-tier box. A CPU-only quantized model works too, just slower.

---

## 2. Architecture overview

```
Web dashboard (Next.js)      POS / cashier app (Next.js)
              \                    /
               \                  /
              API gateway (NestJS — auth, routing, rate limits)
              /                                    \
   Core service (NestJS)                    ML service (FastAPI)
   - Inventory, sales, suppliers            - Forecasting
   - Batches, expiry tracking               - Anomaly detection
   - Purchase orders, users                 - Market basket analysis
   - WebSocket broadcasts                    - Ollama (local LLM, NL insights)
        |            |                              |
   PostgreSQL      Redis                      Analytics DB (Timescale)
   (products,    (cache, live                 (sales time-series,
   orders, users) stock counters)              read via core-service)
```

The core-service and ml-service communicate over internal REST calls (ml-service reads sales/inventory data from core-service or a shared read replica; it never writes directly to the transactional DB). Ollama runs as its own container inside the same Docker network as `ml-service` — no traffic ever leaves your infrastructure.

---

## 3. Database schema (core entities)

```
stores            (id, name, address, timezone)
users              (id, store_id, name, email, password_hash, role)  -- role: owner | manager | cashier
suppliers          (id, store_id, name, contact_info)
products           (id, store_id, sku, name, category, unit, reorder_point, unit_cost, unit_price)
batches            (id, product_id, supplier_id, quantity, received_date, expiry_date, cost_per_unit)
                    -- supports FEFO (first-expired-first-out) stock rotation
purchase_orders    (id, store_id, supplier_id, status, created_at, expected_delivery)
purchase_order_items (id, purchase_order_id, product_id, quantity, unit_cost)
transactions       (id, store_id, cashier_id, total_amount, payment_method, created_at)
transaction_items  (id, transaction_id, product_id, batch_id, quantity, unit_price)
stock_movements    (id, product_id, batch_id, type, quantity, reason, created_at)
                    -- type: sale | restock | markdown | shrinkage | adjustment
alerts             (id, store_id, type, message, severity, resolved, created_at)
                    -- type: low_stock | expiring_soon | anomaly_detected
```

Analytics DB (Timescale hypertable): `sales_events (time, store_id, product_id, quantity, revenue)` — populated via a scheduled sync job from `transaction_items`.

---

## 4. Feature list

### Core store management
- Product & category management
- Batch/lot tracking with expiry dates, FEFO stock rotation
- Supplier management + purchase orders
- POS: barcode scanning, checkout, receipt generation
- Real-time stock deduction on sale
- Role-based dashboards (owner, manager, cashier)
- Multi-branch support (stores table scopes everything)

### AI/ML analytics (all self-hosted, no external APIs)
- **Demand forecasting** — per-SKU forecast for next 7/14/30 days, used to auto-suggest reorder quantities
- **Expiry-based markdown engine** — flags batches nearing expiry and recommends a discount % based on days-to-expiry and current sell-through rate
- **Anomaly/shrinkage detection** — flags unusual stock-count drops vs. expected sales velocity
- **Market basket analysis** — "frequently bought together" recommendations for shelf placement/bundling
- **Natural-language insights** — chat interface backed by a locally-run LLM (via Ollama) that answers questions like "what's expiring this week that's also slow-moving?" over the store's live data, using a retrieval-augmented pattern (real data fetched first, model only narrates it)
- **Auto-generated weekly summary** — plain-English report of key trends (top sellers, at-risk stock, revenue change), generated by the local model

### Real-time
- WebSocket-driven low-stock and expiring-soon alerts
- Live dashboard refresh without polling

---

## 5. How ML/AI is used — summary table

| Feature | Technique | Input | Output / business value |
|---|---|---|---|
| Demand forecasting | Time-series model (Prophet/SARIMA) | Historical daily sales per product | Predicted units needed next 7–30 days → auto-suggests reorder quantities |
| Expiry markdown suggestions | Rule-based + light regression | Days-until-expiry + recent sell-through rate | Recommended discount % → reduces waste, recovers revenue |
| Shrinkage/anomaly detection | Isolation Forest (unsupervised ML) | Stock movement history per product | Flags unusual drops not explained by sales → catches theft/spoilage/errors |
| Market basket analysis | Apriori / FP-Growth | All past transactions | "Frequently bought together" pairs → shelf placement, bundle deals |
| Natural-language insights | Self-hosted LLM (Ollama) + optional intent classifier, RAG pattern | User's question + relevant data pulled from Postgres/Timescale | Plain-English answers over real store data + auto weekly summaries |

The first four are trained statistical/ML models, served instantly and retrained periodically (e.g. nightly). The fifth is generative AI, but fully self-hosted — it never guesses numbers on its own, only narrates data already fetched from the database, so it can't hallucinate a stock count that doesn't exist.

---

## 6. Core API endpoints (core-service)

```
Auth
POST   /auth/login
POST   /auth/refresh

Products
GET    /products
POST   /products
GET    /products/:id
PATCH  /products/:id

Batches
GET    /products/:id/batches
POST   /batches
GET    /batches/expiring?within_days=7

Suppliers & purchase orders
GET    /suppliers
POST   /purchase-orders
PATCH  /purchase-orders/:id/status

POS / transactions
POST   /transactions              -- creates sale, deducts stock (FEFO), emits socket event
GET    /transactions?store_id=

Alerts
GET    /alerts?resolved=false
PATCH  /alerts/:id/resolve
```

## 7. ML service endpoints (ml-service)

```
POST /forecast/demand           { product_id, horizon_days } -> predicted units/day
POST /anomaly/check              { product_id, recent_movements } -> anomaly score
POST /markdown/suggest           { batch_id } -> suggested discount %
GET  /basket-analysis/:store_id  -> top product associations
POST /insights/ask                { store_id, question } -> natural-language answer (local LLM via Ollama)
GET  /insights/weekly-summary/:store_id -> auto-generated summary text (local LLM via Ollama)
```

---

## 8. Build roadmap (phased)

| Phase | Focus | Duration | Key deliverables |
|---|---|---|---|
| 0 | Planning | 3–5 days | DB schema finalized, wireframes, repo scaffolded |
| 1 | Core backend + auth | 1.5–2 weeks | NestJS + Prisma + Postgres, RBAC auth, product/supplier CRUD |
| 2 | POS & transactions | 1–1.5 weeks | Barcode scanning, sale/stock-deduction flow, receipts |
| 3 | Dashboard frontend | 2 weeks | Next.js UI: inventory views, alerts, POS screen, role-based nav |
| 4 | ML service | 2–3 weeks | FastAPI service: forecasting, anomaly detection, basket analysis |
| 5 | Self-hosted AI insights | 1.5–2 weeks | Ollama set up, local LLM serving RAG-based Q&A + weekly summaries |
| 6 | Real-time layer | 1 week | WebSocket alerts, live dashboard updates |
| 7 | Polish, tests, deploy | 1.5–2 weeks | Tests, Docker Compose, CI/CD, deployment, README + demo |

**Total: ~10.5–13.5 weeks**

---

## 9. Week-by-week checkpoints

| Week | Focus | Checkpoint (what should work by end of week) |
|---|---|---|
| 1 | Planning + repo setup | Monorepo scaffolded, DB schema finalized & migrated, wireframes done, basic auth (login/JWT) running |
| 2 | Core CRUD | Full product/supplier/purchase-order CRUD working; RBAC enforced (owner/manager/cashier routes) |
| 3 | POS core | Barcode scan → sale transaction → stock deducted via FEFO → receipt generated |
| 4 | POS polish + dashboard start | Stock movement history logging correctly; dashboard shell built (auth-protected layout, nav, routing) |
| 5 | Inventory UI | Inventory screens live: add/edit products, view batches with expiry dates, low-stock indicators |
| 6 | POS UI + roles | POS terminal UI wired end-to-end; owner/manager/cashier see different dashboard views |
| 7 | ML service + forecasting | FastAPI service scaffolded, 90-day synthetic sales data seeded, demand forecasting model serving predictions |
| 8 | Anomaly + basket analysis | Anomaly detection flags unusual stock drops on seed data; market basket analysis returns product pairings |
| 9 | Markdown engine + Ollama setup | Expiry-markdown suggestion endpoint done; Ollama running locally in Docker, model pulled and responding to test prompts |
| 10 | AI insights (RAG) | "Ask your data" chat feature working end-to-end against the local model; auto-generated weekly summary produced |
| 11 | Real-time layer | WebSocket alerts live: low-stock/expiring-soon notifications push instantly, no polling |
| 12 | Polish + deploy | Core tests passing, `docker-compose up` runs everything (including Ollama container), CI green, deployed, README + demo done |

Notes:
- Weeks 7–10 (the ML/AI service) tend to run long — build in slack there rather than the frontend weeks.
- Don't start week 7 without the seed data from week 1 fully populated, or forecasting/RAG output will look broken in the demo.
- Local LLM inference is slower than a hosted API — test response times early (week 9) so you know if you need a smaller/more quantized model before the demo.
- Treat each checkpoint as go/no-go: fix it before moving to the next week rather than stacking incomplete work.

---

## 10. Suggested repo structure

```
groceryiq/
  apps/
    web/                 # Next.js frontend
    core-service/        # NestJS API
    ml-service/          # FastAPI ML/AI microservice
  packages/
    shared-types/        # shared TS types between web and core-service
  docker-compose.yml      # includes ollama service
  .github/workflows/ci.yml
  README.md
```

---

## 11. Non-functional requirements

- Type safety end-to-end (TypeScript strict mode, Pydantic models in FastAPI)
- All monetary values stored as integers (cents) to avoid float rounding issues
- Idempotent sale transactions (avoid double stock deduction on retry)
- Seed script for synthetic/demo grocery data (products, 90 days of historical sales) so forecasting and RAG features have data to work with without a real store
- Basic test coverage on: stock deduction logic, forecasting endpoint, auth guards
- No external network calls from `ml-service` — verify this in CI/tests to keep the "fully self-hosted" claim honest

---

## 12. Instructions for the AI assistant building this

1. Start with Phase 0 and Phase 1 only. Scaffold the monorepo structure above, set up the Prisma schema from section 3, and implement auth + product/supplier CRUD before touching anything else.
2. Use the seed script (non-functional requirements) early so every later phase has realistic data to work against.
3. Build core-service and ml-service as separate deployable units from day one, even in local dev — don't merge them "temporarily," since the split is a deliberate architecture decision for this project.
4. For the AI insights feature, set up Ollama and pull a small quantized model (Llama 3.2 3B or Mistral 7B) before writing the RAG logic — confirm local inference works first, then build the retrieval + prompting layer on top.
5. Do not integrate any external AI API (Claude, OpenAI, etc.) anywhere in this project — all AI/ML must run self-hosted.
6. Do not add any IoT/hardware integrations — stock tracking is software-only (POS + barcode scans).
7. After each phase, produce a short demo (screenshot or GIF) and a one-paragraph note on any design decisions or trade-offs made — these get compiled into the final portfolio README.
8. Ask before introducing new dependencies not listed in the tech stack above.
