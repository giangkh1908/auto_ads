import request from 'supertest';
import express from 'express';
import cors from 'cors';

describe('CORS Security Tests', () => {
  let app;

  beforeEach(() => {
    app = express();
    // Replicate the CORS configuration from server.js
    app.use(cors({ 
      origin: true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'Cache-Control',
        'X-Requested-With',
        'Accept',
        'Origin'
      ]
    }));
    app.use(express.json());

    app.get('/test-endpoint', (req, res) => {
      res.json({ success: true, message: 'Test endpoint' });
    });

    app.post('/test-post', (req, res) => {
      res.json({ success: true, data: req.body });
    });
  });

  describe('CORS Headers', () => {
    test('should include CORS headers in response', async () => {
      const response = await request(app)
        .get('/test-endpoint')
        .set('Origin', 'http://localhost:5173');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    test('should allow requests from any origin (origin: true)', async () => {
      const origins = [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://example.com',
        'https://test.com',
      ];

      for (const origin of origins) {
        const response = await request(app)
          .get('/test-endpoint')
          .set('Origin', origin);

        expect(response.status).toBe(200);
        expect(response.headers['access-control-allow-origin']).toBe(origin);
      }
    });

    test('should support credentials', async () => {
      const response = await request(app)
        .get('/test-endpoint')
        .set('Origin', 'http://localhost:5173')
        .set('Cookie', 'session=test');

      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('Allowed HTTP Methods', () => {
    test('should allow GET requests', async () => {
      const response = await request(app)
        .get('/test-endpoint')
        .set('Origin', 'http://localhost:5173');

      expect(response.status).toBe(200);
    });

    test('should allow POST requests', async () => {
      const response = await request(app)
        .post('/test-post')
        .set('Origin', 'http://localhost:5173')
        .send({ test: 'data' });

      expect(response.status).toBe(200);
    });

    test('should handle OPTIONS preflight requests', async () => {
      const response = await request(app)
        .options('/test-endpoint')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });
  });

  describe('Allowed Headers', () => {
    test('should allow Authorization header', async () => {
      const response = await request(app)
        .options('/test-endpoint')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Headers', 'authorization');

      expect(response.headers['access-control-allow-headers']).toContain('Authorization');
    });

    test('should allow Content-Type header', async () => {
      const response = await request(app)
        .options('/test-endpoint')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Headers', 'content-type');

      expect(response.headers['access-control-allow-headers']).toContain('Content-Type');
    });

    test('should allow custom headers specified in config', async () => {
      const response = await request(app)
        .options('/test-endpoint')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Headers', 'X-Requested-With');

      expect(response.headers['access-control-allow-headers']).toContain('X-Requested-With');
    });
  });

  describe('CORS Security Considerations', () => {
    test('should be aware of wildcard origin security implications', async () => {
      // Note: origin: true accepts all origins, which is less secure
      // This test documents the current behavior
      const response = await request(app)
        .get('/test-endpoint')
        .set('Origin', 'https://malicious-site.com');

      // Currently allows any origin
      expect(response.headers['access-control-allow-origin']).toBe('https://malicious-site.com');
      
      // SECURITY NOTE: In production, should use a whitelist instead:
      // origin: ['https://approved-site.com', 'https://another-approved.com']
    });

    test('should document credential security with wildcard origins', async () => {
      // SECURITY WARNING: Combining credentials: true with origin: true
      // allows any origin to send credentials, which is a security risk
      
      const response = await request(app)
        .get('/test-endpoint')
        .set('Origin', 'https://untrusted-site.com')
        .set('Cookie', 'session=secret');

      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.headers['access-control-allow-origin']).toBe('https://untrusted-site.com');
      
      // RECOMMENDATION: Use a whitelist of trusted origins in production
    });
  });

  describe('Preflight Request Handling', () => {
    test('should handle complex preflight requests', async () => {
      const response = await request(app)
        .options('/test-post')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type,authorization');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });
  });

  describe('CORS Error Scenarios', () => {
    test('should handle requests without Origin header', async () => {
      const response = await request(app)
        .get('/test-endpoint');

      // Should still work (same-origin requests don't need CORS)
      expect(response.status).toBe(200);
    });
  });

  describe('Security Best Practices Documentation', () => {
    test('should document recommended CORS configuration', () => {
      // RECOMMENDED: More secure CORS configuration for production
      const recommendedConfig = {
        origin: [
          'https://production-frontend.com',
          'https://app.production-frontend.com',
        ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'X-Requested-With',
        ],
        exposedHeaders: ['X-Total-Count'],
        maxAge: 86400, // 24 hours
      };

      expect(recommendedConfig.origin).toBeInstanceOf(Array);
      expect(recommendedConfig.credentials).toBe(true);
      expect(recommendedConfig.methods).not.toContain('OPTIONS'); // Auto-handled
    });
  });
});
