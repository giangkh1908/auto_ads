# AAMS — Auto Ads Management System

Hệ thống SaaS quản lý quảng cáo Facebook Ads full-stack: tạo campaign, theo dõi performance, automation rules, AI chat phân tích, thanh toán đa kênh.

Hệ thống được phát triển tiếp dựa trên đồ án nhóm đã làm. 
---

## 🏗️ Kiến trúc hệ thống

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Frontend   │────▶│   Backend    │────▶│  MongoDB    │
│  React 18   │◀────│  Express 5   │◀────│  Mongoose    │
│  Vite 7     │     │  Port: 5001  │     └─────────────┘
└─────────────┘     └──────┬───────┘     ┌─────────────┐
                           │              │   Redis     │
                    ┌──────┴───────┐      │  Cache/Lock │
                    │ Facebook     │      └─────────────┘
                    │ Marketing    │
                    │ API          │      ┌─────────────┐
                    └──────────────┘      │  AI (LLM)   │
                                          │ OpenAI/     │
                     ┌──────────────┐     │ Gemini      │
                     │ Payment      │     └─────────────┘
                     │ Stripe/VNPay │
                     │ ZaloPay      │     ┌─────────────┐
                     └──────────────┘     │ Cloudinary  │
                                          │ Storage     │
                                          └─────────────┘
```

## 🧩 Tính năng chính

| Module | Mô tả |
|---|---|
| **Ads Management** | CRUD campaign/adset/ad qua Facebook Marketing API, wizard tạo ads 4 bước |
| **Analytics** | Dashboard thống kê performance, biểu đồ Recharts, filter theo ngày/campaign/ad |
| **Automation Rules** | Tự động bật/tắt ads theo điều kiện (spend, CTR, ROAS, conversions...) |
| **AI Chat** | Chat phân tích analytics, generate ad content (GPT-4, Gemini) |
| **Shop Management** | Quản lý shop, nhân viên, Facebook pages, phân quyền |
| **Payment** | Gói dịch vụ, thanh toán Stripe/VNPay/ZaloPay, invoice |
| **Admin Panel** | 3 role (System Admin, CS Staff, Accountant) với các trang quản lý riêng |
| **i18n** | Hỗ trợ tiếng Việt và tiếng Anh |

## 🛠️ Tech Stack

### Backend
| Component | Technology |
|---|---|
| Runtime | Node.js 20 |
| Framework | Express 5 |
| Database | MongoDB + Mongoose 8 |
| Cache/Queue | Redis (ioredis + @node-redis) |
| Auth | JWT (jsonwebtoken) |
| AI | Langchain + OpenAI + Google Gemini |
| Payment | Stripe, VNPay, ZaloPay |
| Storage | Cloudinary |
| Security | Helmet, CORS, express-mongo-sanitize, rate limiter |
| Cron | node-cron |
| Testing | Jest |

### Frontend
| Component | Technology |
|---|---|
| Framework | React 18 + Vite 7 |
| Routing | React Router 6 |
| State | React Context + Custom Hooks |
| i18n | i18next (VI/EN, 8 namespaces) |
| Charts | Recharts |
| Maps | Mapbox GL + react-map-gl |
| Animation | Framer Motion |
| Icons | Lucide React |
| Forms | React Hook Form |
| Testing | Vitest + Testing Library |

### Infrastructure
| Component | Technology |
|---|---|
| Container | Docker + Docker Compose |
| CI/CD | GitHub Actions |
| Registry | GitHub Container Registry (ghcr.io) |
| Deploy | VPS Ubuntu + Nginx + SSL (Certbot) |
| Monitoring | Health check endpoint `/health` |

## 📂 Cấu trúc project

```
D:\auto_ads/
├── backend/
│   ├── src/
│   │   ├── config/           # DB, Redis config
│   │   ├── controllers/      # 30 controllers (ads, auth, admin, payments...)
│   │   ├── middlewares/      # JWT auth, RBAC, rate limiter, feature gate
│   │   ├── models/           # 25 MongoDB models
│   │   │   ├── user/         # User, UserRole
│   │   │   ├── shop/         # Shop, ShopUser
│   │   │   ├── ads/          # AdsAccount, Campaign, AdSet, Ad, Creative, AdPerformance
│   │   │   └── admin/        # Package, Log, Note, Lead, SystemLog
│   │   ├── routes/           # 24 route files
│   │   ├── services/
│   │   │   ├── ads/          # FB sync (entities, insights), fbAdsService
│   │   │   ├── auto/         # Automation rules engine + scheduler
│   │   │   ├── chat/         # AI chat context, analytics tools
│   │   │   └── payment/      # Stripe, VNPay, ZaloPay
│   │   ├── jobs/             # Cron: sync, payment expiry, package expiry
│   │   ├── utils/            # Helpers, formatters, validators
│   │   └── server.js         # Entry point
│   ├── Dockerfile
│   ├── compose.yml           # Docker Compose (backend + worker + redis)
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/       # Layout, AdsWizard, AutoRule, ChatAI, Admin...
│   │   ├── pages/            # 25+ pages (Home, Dashboard, Ads, Analytics, Admin...)
│   │   ├── hooks/            # 20+ custom hooks
│   │   ├── services/         # API service layer (axios)
│   │   ├── contexts/         # AuthContext
│   │   ├── locales/          # i18n (vi/en, 8 namespaces)
│   │   └── App.jsx           # Router + guards
│   └── vite.config.js
└── .github/workflows/deploy.yml
```

## 🚀 Cài đặt & Chạy local

### Yêu cầu
- Node.js 20+
- MongoDB (local hoặc Atlas)
- Redis
- Facebook Developer Account (Marketing API access)

### Backend

```bash
cd backend

# Cài dependencies
npm install

# Tạo file .env từ mẫu
cp .env.example .env
# → Điền thông tin MongoDB, JWT, Facebook App, payment keys...

# Chạy development
npm run dev

# Chạy production
npm start
```

Backend chạy tại `http://localhost:5001`

### Frontend

```bash
cd frontend

# Cài dependencies
npm install

# Chạy development
npm run dev

# Build production
npm run build
```

Frontend chạy tại `http://localhost:5173`

## 🐳 Docker Deployment

### Cấu trúc Docker

```
compose.yml
├── backend (4 replicas)  → API server, CRON_ENABLED=false
├── worker (1 replica)    → Cron jobs, CRON_ENABLED=true
└── redis (1 replica)     → Cache + distributed locks
```

### Chạy với Docker Compose

```bash
cd backend

# Đảm bảo có file .env
# CRON_ENABLED=true  → cho worker
# CRON_ENABLED=false → cho backend replicas

docker compose up -d
```

### CI/CD Pipeline

Mỗi khi push lên branch `main`:
1. **Build** Docker image từ `backend/`
2. **Push** lên GitHub Container Registry (ghcr.io)
3. **Deploy** lên VPS qua SSH → `docker compose pull && docker compose up -d`

## ⚙️ Cron Jobs

| Job | Tần suất | Mô tả |
|---|---|---|
| **Ads Insights Sync** | Mỗi giờ | Sync daily breakdown từ Facebook → AdPerformance + entity insights |
| **Entity Sync** | Mỗi 4 giờ | Sync campaigns/adsets/ads từ Facebook |
| **Auto Rules** | Mỗi 5 phút | Evaluate automation rules → bật/tắt ads |
| **Payment Expiry** | Mỗi giờ | Hủy thanh toán quá hạn |
| **Package Expiry** | Mỗi giờ | Xử lý gói dịch vụ hết hạn |

### Distributed Lock

Mỗi account có Redis lock (`lock:sync:account:{id}`) → tránh sync trùng lặp khi chạy nhiều worker.

### Cache

- **Ads mapping**: Redis cache 55 phút → giảm MongoDB query
- **Insights endpoints**: DB-first với TTL 1 giờ → chỉ gọi Facebook khi data stale

## 📊 Data Flow — Insights Sync

```
Facebook API (daily breakdown, time_increment=1)
    ↓
Cron Job (mỗi giờ)
    ↓
saveDailyInsightsToAdPerformance()
    → Redis buffer → flush → MongoDB AdPerformance (1 record = 1 ngày)
    ↓
AdsCampaign/AdsSet/Ad.insights (lifetime totals)
    ↓
Frontend:
    → AdsManagement: đọc entity.insights (lifetime)
    → Analytics: query AdPerformance, SUM theo khoảng thời gian
    → Insights API: DB-first (TTL 1h), chỉ gọi Facebook khi stale
```

## 🔐 Bảo mật

- **JWT** authentication với access + refresh tokens
- **RBAC** (Role-Based Access Control): System Admin, CS Staff, Accountant, Shop Admin, Shop User
- **Rate limiting** per IP
- **MongoDB sanitization** chống NoSQL injection
- **Helmet** security headers
- **CORS** whitelist origins

## ⚡ Load Test (k6)

| Chỉ số | Giá trị |
|---|---|
| Total requests | 125,470 |
| Throughput | ~1,039 req/s |
| HTTP errors | 0.00% |
| Median latency | 33 ms |
| p95 latency | 3.02 s |

```bash
# Chạy load test
k6 run load_test.js
```

Workflow GitHub Actions đã có thể chạy tự động mỗi 15 phút sau khi bạn push lên `main`.
Bạn có thể xem kết quả trong tab **Actions** của repository, hoặc bấm **Run workflow** để chạy thử ngay.

## 📄 License

MIT

---

**Built with React, Express, MongoDB, Redis & Facebook Marketing API**
