# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands
- Develop: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Run all tests: `npm run test`
- Run tests once: `npm run test:run`
- Preview build: `npm run preview`

## Architecture & Structure
The project is a React application built with Vite, using a modular directory structure organized by functionality:

- `src/pages/`: Contains top-level page components, organized by feature (e.g., `Dashboard`, `AdsManagement`, `Shop`).
- `src/components/`: UI components split into `common` (reusable), `layout` (wrappers), `feature` (domain-specific), and `admin`.
- `src/services/`: API interaction layer organized by domain (`ads`, `auth`, `auto`, `chat`, `leads`, `shop`, `system`).
- `src/hooks/`: Custom React hooks categorized by feature (e.g., `ads`, `auth`, `targeting`, `wizard`).
- `src/contexts/`: Global state management (e.g., `AuthContext.jsx` for user session).
- `src/utils/` & `src/constants/`: Shared utility functions and static configuration.
- `src/locales/` & `i18n.js`: Internationalization setup using `i18next`.

## Tech Stack
- **Core**: React 18, Vite
- **Routing**: react-router-dom
- **State**: React Context, custom hooks
- **Styling/UI**: Lucide React, Framer Motion, Sonner (notifications), React Toastify
- **Maps**: Mapbox GL, react-map-gl, Turf.js
- **Forms**: react-hook-form
- **Charts**: Recharts
- **Testing**: Vitest, React Testing Library, MSW
