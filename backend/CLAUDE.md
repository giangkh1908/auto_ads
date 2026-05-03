# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🛠 Commands
- **Development**: `npm run dev` (runs with nodemon)
- **Start**: `npm start`
- **Tests**: 
  - All tests: `npm test`
  - Watch mode: `npm run test:watch`
  - Coverage: `npm run test:coverage`
- **Note**: Tests use Jest and require `--experimental-vm-modules` for ESM support.

## 🏗 Architecture
The project is a Node.js backend using Express, MongoDB (Mongoose), and Redis. It follows a layered architecture:

- `src/server.js`: Entry point, middleware configuration, and route registration.
- `src/routes/`: API endpoint definitions, organized by module (e.g., `ads`, `user`, `ai`).
- `src/controllers/`: Request handling and orchestration.
- `src/services/`: Business logic and external API integrations (LangChain, OpenAI, Google GenAI, Stripe, etc.).
- `src/models/`: Mongoose schemas for MongoDB.
- `src/jobs/`: Cron jobs for background tasks (payment expiry, user package expiry, etc.).
- `src/middlewares/`: Custom Express middlewares (auth, validation, etc.).
- `src/utils/`: Shared utility functions.
- `src/config/`: Database and Redis configurations.

## 📌 Key Context
- **Language**: JavaScript (ES Modules).
- **Database**: MongoDB via Mongoose.
- **Caching**: Redis.
- **AI Integration**: Uses LangChain, OpenAI, and Google Generative AI.
- **Payments**: Integrates Stripe, ZaloPay, and VNPay.
- **Security**: Uses `helmet`, `cors`, and `express-mongo-sanitize`.
- **Cron Jobs**: Controlled by `CRON_ENABLED` environment variable.
