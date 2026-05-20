---
name: testing-patterns
description: Testing patterns for Jest ESM (backend) and Vitest + MSW (frontend)
---

## Backend Testing (Jest + ESM)

### Mocking Pattern (REQUIRED)
```js
import { jest } from '@jest/globals';

// 1. Create mock functions BEFORE unstable_mockModule
const mockFind = jest.fn();

// 2. Mock the Mongoose model
jest.unstable_mockModule('../models/ads/ads.model.js', () => ({
  default: { find: mockFind }
}));

// 3. Dynamic import AFTER mocking
const { targetFunction } = await import('../services/ads/adsService.js');
```

### Mongoose Query Mocking
Return chainable objects matching the Mongoose API:
```js
mockFind.mockReturnValue({
  select: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue([mockData])
  })
});
```

### Test Fixtures
Use factory functions from `src/__tests__/helpers/mockData.js`:
- `createMockRule()`, `createMockCampaign()`, `createMockAdSet()`, `createMockAd()`
- `createMockAdPerformance()`, `createCondition()`

### Running Tests
- `npm test` — all tests
- `npm run test:watch` — watch mode
- `npm run test:coverage` — coverage report
- Jest config: `transform: {}` (no Babel/SWC)

## Frontend Testing (Vitest + RTL + MSW)

### Setup
- Vitest with jsdom environment
- React Testing Library for component queries
- MSW for API request mocking

### Running Tests
- `npm run test` — watch mode
- `npm run test:run` — single run

### Query Priority
- `findBy/findAllBy` — async operations (data fetching)
- `getBy/getAllBy` — sync elements
- `queryBy/queryAllBy` — checking absence

### MSW Pattern
```js
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer(
  http.get('/api/endpoint', () => HttpResponse.json({ data: [] }))
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```
