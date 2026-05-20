# AGENTS.md — Frontend

## Commands
- `npm run dev` — start Vite dev server (port 5173)
- `npm run build` — production build → `dist/`
- `npm run lint` — ESLint (flat config, `eslint.config.js`)
- `npm run test` — Vitest watch mode
- `npm run test:run` — Vitest single run
- `npm run preview` — preview production build

## Env Vars
- All env vars must be prefixed with `VITE_` to be exposed to the client
- `VITE_API_URL` — backend URL (default `http://localhost:5001`)
- `VITE_MAPBOX_ACCESS_TOKEN` — Mapbox token
- `VITE_RECAPTCHA_SITE_KEY` — reCAPTCHA site key
- `FB_CONFIG_ID` — Facebook App ID (not prefixed, used in HTML)

## Architecture
- Entry: `src/main.jsx` — mounts `<App />` (StrictMode disabled to avoid double toast)
- `src/App.jsx` — all routes, auth guards, layout logic
- `src/contexts/AuthContext.jsx` — global auth state, user session
- `src/services/` — axios API layer organized by domain (`ads/`, `auth/`, `auto/`, `chat/`, `shop/`, `leads/`, `system/`)
- `src/hooks/` — custom hooks by feature (`auth/`, `ads/`, `targeting/`, `wizard/`)
- `src/pages/` — page components organized by feature
- `src/components/` — `common/` (reusable), `layout/` (Header, Sidebar, Footer), `feature/` (domain-specific), `admin/`

## Routing & Guards
- `ProtectedRoute` — requires authentication
- `AdminRouteGuard` — redirects admin users to admin dashboard
- `ProtectedRouteForRole` — role-based access (`System Admin`, `CS Staff`, `Accountant`)
- Admin routes prefixed with `/admin/`, use `AdminSidebar` + `AdminHeader`
- User routes use `Sidebar` + `Header`
- Header visibility logic in `App.jsx` — admins see `AdminHeader` on `/admin`, `/profile`, and `/`

## i18n
- `i18next` with 8 namespaces: `translation`, `ads`, `common`, `admin`, `guide`, `automationRule`, `analytics`, `wizard`
- Languages: `vi` (default), `en`
- Detection order: localStorage → cookie → navigator
- Use `useTranslation('namespace')` hook; default namespace is `translation`

## Key Conventions
- No Redux/ Zustand — state via React Context + custom hooks
- Forms use `react-hook-form`
- Notifications via `sonner` (Toaster in App.jsx) + `react-toastify`
- Charts via `recharts`
- Maps via `mapbox-gl` + `react-map-gl` + `@turf/turf`
- PDF export via `jspdf` + `html2canvas`
- Animations via `framer-motion`
- ESLint: unused vars starting with `A-Z_` are ignored (e.g., React components)

## Testing
- Vitest + React Testing Library + MSW for API mocking
- Tests co-located or in `__tests__/` directories
- `jsdom` environment for component tests
