---
name: backend-conventions
description: Backend coding conventions and gotchas for Express 5 + MongoDB + Redis ESM project
---

## ESM Requirements
- `"type": "module"` in package.json — ALL imports must use `.js` extensions
- No CommonJS `require()` — use `import` only
- Jest ESM mocking: `jest.unstable_mockModule()` + top-level `await import()`

## Express 5 Critical Gotcha
`req.query` is a getter-only property in Express 5. `server.js` has a workaround middleware (lines 67-77) that makes it writable before `express-mongo-sanitize` runs. NEVER remove or reorder this middleware.

## Cron / Worker Split
- `CRON_ENABLED=true` → runs cron jobs (sync, auto-rules, payment/package expiry). Only the **worker** instance should have this.
- `CRON_ENABLED=false` → API replicas (default in compose.yml).
- Docker: 4 backend replicas (ports 5001-5004) + 1 worker + 1 Redis.

## Redis Usage
- Token blacklist: `blacklist:{jti}`
- Sync locks: `lock:sync:account:{id}`
- Ads mapping cache: 55-minute TTL
- Client: `ioredis`, host defaults to `127.0.0.1`

## MongoDB
- Connection: `maxPoolSize: 1500`
- Always use `.lean()` on queries that don't need Mongoose document methods
- Use `.select()` to limit returned fields

## Auth Pattern
- JWT via `Authorization: Bearer <token>` header
- SSE endpoints: `?token=` query param (`authenticateSSE`)
- Token version checked against `user.tokenVersion`
- Email verification required before access

## Commands
- `npm run dev` — nodemon (port 5001)
- `npm test` — Jest with `--experimental-vm-modules`
- `npm run test:watch` / `npm run test:coverage`
