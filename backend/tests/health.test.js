process.env.NODE_ENV = 'test';
// Valores de relleno: el servidor los exige al arrancar, pero /api/health no consulta Supabase.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-test-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-test-key';

const request = require('supertest');
const app = require('../src/server');

describe('Health Check', () => {
  it('should return health status', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Servidor funcionando correctamente');
    expect(response.body.uptime).toBeDefined();
    expect(response.body.timestamp).toBeDefined();
    expect(response.body.environment).toBe('test');
  });

  it('exige autenticación en rutas protegidas', async () => {
    await request(app).get('/api/documents').expect(401);
    await request(app).get('/api/notifications').expect(401);
    await request(app).get('/api/norms/compliance-report').expect(401);
  });
});
