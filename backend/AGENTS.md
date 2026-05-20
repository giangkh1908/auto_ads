# AGENTS.md — Backend

## Commands
- `npm run dev` — start with nodemon (port 5001)
- `npm start` — production start
- `npm test` — run Jest (requires `--experimental-vm-modules` for ESM)
- `npm run test:watch` / `npm run test:coverage`

## ESM Quirks
- `"type": "module"` in package.json — all imports use `.js` extensions
- Jest ESM mocking requires `jest.unstable_mockModule()` + top-level `await import()` — see existing tests in `src/__tests__/` for the pattern
- `jest.config.js` has `transform: {}` (no Babel/SWC)

## Express 5 Gotcha
- `req.query` is a getter-only property in Express 5. `server.js` has a workaround middleware that makes it writable before `express-mongo-sanitize` runs. Do not remove or reorder this.

## Cron / Worker Split
- `CRON_ENABLED=true` runs cron jobs (sync, auto-rules, payment expiry, package expiry). Only the **worker** instance should have this set.
- `CRON_ENABLED=false` for API replicas (default in `compose.yml`).
- Docker: 4 backend replicas (ports 5001-5004) + 1 worker + 1 Redis.

## Auth & RBAC
- JWT via `Authorization: Bearer <token>` header. SSE endpoints use `?token=` query param (`authenticateSSE`).
- `authorize(module, action)` — RBAC check. System Admin bypasses all.
- `authorizeInShop(module, action)` — shop-scoped permissions. Shop ID from `req.params.id` or `req.body.shop_id`.
- `checkFeature(feature)` / `checkPackageLimit(resource)` — subscription gating.
- Token blacklist stored in Redis (`blacklist:{jti}`). Token version checked against `user.tokenVersion`.

## Key Env Vars (see `.env.example`)
- `MONGODB_URL`, `JWT_SECRET`, `REDIS_HOST` (defaults `127.0.0.1`)
- `FB_APP_ID`, `FB_APP_SECRET`, `FB_REDIRECT_URI` (callback: `/api/facebook/callback`)
- Payment: `STRIPE_SECRET_KEY`, `VNPAY_*`, ZaloPay keys
- AI: `OPENAI_API_KEY`, `GOOGLE_API_KEY`
- `FRONTEND_URL` — CORS whitelist (also allows `*.vercel.app` and localhost in dev)

## Architecture
- Entry: `src/server.js` — connects DB, conditionally starts cron, mounts all routes
- Routes → Controllers → Services → Models (Mongoose)
- Models organized by domain: `user/`, `shop/`, `ads/`, `admin/`, `package/`, `transaction/`, `ai/`, `analytics/`, `invoice/`, `auto/`
- DB config: `maxPoolSize: 1500`
- Redis: `ioredis` client, used for cache, locks (`lock:sync:account:{id}`), and token blacklist

## Testing
- Tests in `src/__tests__/`, pattern `*.test.js`
- Use `helpers/mockData.js` factory functions for test fixtures
- Mongoose models must be mocked with `jest.unstable_mockModule()` before importing the service under test
- No integration test setup — tests are unit-level with mocked DB

## Scripts
- `src/scripts/` — one-off scripts (seed packages, seed AI templates, backfill insights). Not part of normal flow.
