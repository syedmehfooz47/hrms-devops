const request = require('supertest');
const app = require('../server');

describe('Health Check API', () => {
  it('should return a 200 OK status on the root route', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Pulse HRMS Backend Running');
    expect(response.body).toHaveProperty('version');
  });

  it('should return 404 for unknown routes', async () => {
    const response = await request(app).get('/api/unknown-route-12345');
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message', 'Route not found');
  });
});
