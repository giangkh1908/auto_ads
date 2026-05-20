---
name: frontend-conventions
description: Frontend coding conventions for React 18 + Vite 7 project with i18n and role-based routing
---

## Environment Variables
- All client-exposed env vars MUST be prefixed with `VITE_`
- `VITE_API_URL` → backend URL (default `http://localhost:5001`)
- `VITE_MAPBOX_ACCESS_TOKEN` → Mapbox token
- `VITE_RECAPTCHA_SITE_KEY` → reCAPTCHA key
- `FB_CONFIG_ID` → Facebook App ID (not prefixed, used in HTML)

## State Management
- No Redux or Zustand — use React Context + custom hooks
- `src/contexts/AuthContext.jsx` — global auth state
- Custom hooks in `src/hooks/` organized by feature

## i18n (i18next)
- 8 namespaces: `translation`, `ads`, `common`, `admin`, `guide`, `automationRule`, `analytics`, `wizard`
- Languages: `vi` (default/fallback), `en`
- Detection order: localStorage → cookie → navigator
- Use `useTranslation('namespace')` for non-default namespaces
- Default namespace is `translation`
- Key separator: `.`, namespace separator: `:`

## Routing Guards
- `ProtectedRoute` — requires authentication
- `AdminRouteGuard` — redirects admin users to admin dashboard
- `ProtectedRouteForRole` — role-based: `System Admin`, `CS Staff`, `Accountant`
- Admin routes prefixed with `/admin/` use `AdminSidebar` + `AdminHeader`
- User routes use `Sidebar` + `Header`
- Header visibility logic in `App.jsx`

## StrictMode
- Disabled in `main.jsx` to avoid double toast in development
- Do not re-enable without testing notification behavior

## Key Libraries
- Forms: `react-hook-form`
- Notifications: `sonner` (Toaster in App.jsx) + `react-toastify`
- Charts: `recharts`
- Maps: `mapbox-gl` + `react-map-gl` + `@turf/turf`
- PDF: `jspdf` + `html2canvas`
- Animations: `framer-motion`

## ESLint
- Unused vars starting with `A-Z_` are ignored (React components)
- Flat config in `eslint.config.js`

## Commands
- `npm run dev` — Vite dev server (port 5173)
- `npm run build` — production build → `dist/`
- `npm run lint` — ESLint
- `npm run test` — Vitest watch mode
- `npm run test:run` — Vitest single run
