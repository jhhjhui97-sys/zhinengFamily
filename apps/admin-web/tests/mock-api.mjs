import { createServer } from 'node:http';

const user = { id: '11111111-1111-4111-8111-111111111111', merchant_id: '22222222-2222-4222-8222-222222222222', email: 'owner@example.test', role: 'owner', is_active: true, created_at: '2026-09-19T00:00:00Z' };
const error = (code, message, details = []) => ({ error: { code, message, details } });
createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  let input = {};
  try { input = JSON.parse(Buffer.concat(chunks).toString()); } catch { /* invalid request */ }
  let status = 200;
  let data;
  if (req.url === '/auth/login' && req.method === 'POST') {
    if (input.email === 'offline@example.test') { req.socket.destroy(); return; }
    const errors = {
      'forbidden@example.test': [403, 'forbidden'], 'missing@example.test': [404, 'missing'],
      'conflict@example.test': [409, 'conflict'], 'invalid@example.test': [422, 'validation_error'], 'broken@example.test': [500, 'private stack'],
    };
    if (errors[input.email]) { [status] = errors[input.email]; data = error(errors[input.email][1], 'private stack', status === 422 ? [{ loc: ['body', 'merchant_id'], message: 'Invalid UUID' }] : []); }
    else if (input.merchant_id !== user.merchant_id || input.email !== user.email || input.password !== 'correct-test-password') { status = 401; data = error('invalid_credentials', 'Invalid credentials'); }
    else data = { access_token: 'mock-valid-token', token_type: 'bearer', expires_in: 1800 };
  } else if (req.url === '/auth/me' && req.method === 'GET') {
    if (req.headers.authorization !== 'Bearer mock-valid-token') { status = 401; data = error('unauthorized', 'Invalid or expired token'); }
    else data = user;
  } else { status = 404; data = error('missing', 'Missing'); }
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}).listen(8765, '127.0.0.1');
