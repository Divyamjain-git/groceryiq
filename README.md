# GroceryIQ

AI-powered grocery store management platform — inventory, POS, and self-hosted
AI/ML analytics in one system. See `docs/groceryiq-project-spec.md` (copy it in
from your earlier download) for the full design doc.

## Quickstart (Week 1 goal: this all runs locally)

1. Create a local `.env` file and configure the database, JWT, Redis, and API settings.
   Keep this file private; it is excluded by `.gitignore`.

2. Start infra (Postgres, Redis, Ollama):
   ```
   docker compose up -d postgres redis ollama
   ```

3. Pull a local model for Ollama (only needed once):
   ```
   docker exec -it groceryiq-ollama-1 ollama pull llama3.2
   ```

4. Core service (NestJS API):
   ```
   cd apps/core-service
   npm install
   npx prisma migrate dev --name init
   npm run start:dev
   ```
   Runs on http://localhost:4000

5. Web dashboard (Next.js):
   ```
   cd apps/web
   npm install
   npm run dev
   ```
   Runs on http://localhost:3000

6. ML service (FastAPI):
   ```
   cd apps/ml-service
   python -m venv venv && source venv/bin/activate
   pip install -r requirements.txt
   uvicorn app.main:app --reload --port 8000
   ```
   Runs on http://localhost:8000

## What's here vs. what you build next

Already scaffolded and working (Weeks 1-2 complete):
- Prisma schema for the full DB design (`apps/core-service/prisma/schema.prisma`)
- JWT auth + role-based access control (`apps/core-service/src/auth`) —
  login at `POST /auth/login`, demo users seeded with password `password123`
- Full CRUD for Products, Suppliers, Batches, and PurchaseOrders, all
  guarded with `JwtAuthGuard` + `RolesGuard` (owner/manager can write,
  cashiers read-only, purchase-orders manager+ only)
- Marking a PurchaseOrder `RECEIVED` automatically creates batches —
  see `purchase-orders.service.ts` for the pattern you'll reuse for sales
- Synthetic seed data: ~40 products, 90 days of sales, staggered batch
  expiry dates, deliberate anomalies, and baked-in basket patterns
- FastAPI skeleton in ml-service with all five endpoints stubbed out,
  plus an Ollama wrapper (`llm.py`) with the RAG prompt builder ready
- Next.js skeleton with Tailwind configured
- docker-compose for local Postgres (Timescale image), Redis, and Ollama

Your Week 3 job: POS & transactions — build the `Transactions` module
that creates a sale, calls `BatchesService.findOldestAvailable()` for
FEFO deduction, and decrements stock. Follow the same controller/service/
dto pattern as the other modules.

Demo login credentials (from the seed script):
```
owner@groceryiq.example    / password123   (OWNER)
cashier@groceryiq.example  / password123   (CASHIER)
```

## Repo structure

```
groceryiq/
  apps/
    web/            # Next.js frontend
    core-service/   # NestJS API (Products slice built, extend from here)
    ml-service/      # FastAPI ML/AI service (routes stubbed)
  packages/
    shared-types/    # shared TS types between web and core-service
  docker-compose.yml
```

# groceryiq
