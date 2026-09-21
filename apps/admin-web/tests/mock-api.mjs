import { createServer } from 'node:http';

const user = { id: '11111111-1111-4111-8111-111111111111', merchant_id: '22222222-2222-4222-8222-222222222222', email: 'owner@example.test', role: 'owner', is_active: true, created_at: '2026-09-19T00:00:00Z' };
const now = '2026-09-20T08:30:00Z';
const customers = [
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', merchant_id: user.merchant_id, owner_user_id: user.id, name: '张先生', phone: '13800000000', wechat: 'zhang-home', source: '门店到访', address: '上海市浦东新区', budget: '80000.00', status: 'following', notes: '偏好原木风', last_follow_up_at: now, created_at: now, updated_at: now },
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', merchant_id: user.merchant_id, owner_user_id: user.id, name: '李女士', phone: null, wechat: null, source: null, address: null, budget: null, status: 'new', notes: null, last_follow_up_at: null, created_at: now, updated_at: now },
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', merchant_id: user.merchant_id, owner_user_id: user.id, name: '王先生', phone: '13900000000', wechat: 'wang-home', source: '转介绍', address: '杭州市', budget: '80000.50', status: 'won', notes: '已成交', last_follow_up_at: now, created_at: now, updated_at: now },
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', merchant_id: user.merchant_id, owner_user_id: user.id, name: '赵女士', phone: null, wechat: null, source: null, address: null, budget: '12345.67', status: 'new', notes: null, last_follow_up_at: null, created_at: now, updated_at: now },
  ...Array.from({ length: 17 }, (_, index) => ({ id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(index + 5).padStart(12, '0')}`, merchant_id: user.merchant_id, owner_user_id: user.id, name: `分页客户${index + 1}`, phone: null, wechat: null, source: null, address: null, budget: null, status: 'new', notes: null, last_follow_up_at: null, created_at: now, updated_at: now })),
];
const products = [
  { id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', merchant_id: user.merchant_id, category: 'sofa', brand: '示例品牌', name: '三人沙发', sku: 'SOFA-001', price: '6800.50', width_mm: 2400, depth_mm: 950, height_mm: 850, thumbnail: 'https://example.test/sofa.jpg', model_url: 'https://example.test/sofa.glb', metadata: { color: '浅灰', material: '科技布' }, created_at: now, updated_at: now },
  { id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2', merchant_id: user.merchant_id, category: 'table', brand: '木作', name: '餐桌', sku: 'TABLE-001', price: '3999.90', width_mm: 1800, depth_mm: 900, height_mm: 760, thumbnail: null, model_url: null, metadata: {}, created_at: now, updated_at: now },
  ...Array.from({ length: 19 }, (_, index) => ({ id: `dddddddd-dddd-4ddd-8ddd-${String(index + 3).padStart(12, '0')}`, merchant_id: user.merchant_id, category: index % 2 ? 'sofa' : 'appliance', brand: '分页品牌', name: `分页商品${index + 1}`, sku: `PAGE-${index + 1}`, price: '80000.00', width_mm: 1000, depth_mm: 500, height_mm: 700, thumbnail: null, model_url: null, metadata: {}, created_at: now, updated_at: now })),
];
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
  } else if ((req.url?.startsWith('/customers') || req.url?.startsWith('/products')) && req.headers.authorization !== 'Bearer mock-valid-token') {
    status = 401; data = error('unauthorized', 'Invalid or expired token');
  } else if (req.url?.startsWith('/customers') && req.method === 'GET') {
    const url = new URL(req.url, 'http://mock');
    const id = url.pathname.split('/')[2];
    if (id) {
      const customer = customers.find(item => item.id === id);
      if (!customer || id === 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') { status = 404; data = error('not_found', 'Record not found'); }
      else data = customer;
    } else {
      const search = (url.searchParams.get('search') ?? '').toLowerCase();
      const filtered = customers.filter(item => [item.name, item.phone, item.wechat].some(value => value?.toLowerCase().includes(search)));
      const limit = Number(url.searchParams.get('limit') ?? 20);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      data = { items: filtered.slice(offset, offset + limit), total: filtered.length, limit, offset };
    }
  } else if (req.url === '/customers' && req.method === 'POST') {
    if (!input.name?.trim()) { status = 422; data = error('validation_error', 'Invalid request', [{ loc: ['body', 'name'], message: 'Field required' }]); }
    else if (input.name === '冲突客户') { status = 409; data = error('conflict', 'Conflict'); }
    else {
      const customer = { id: `cccccccc-cccc-4ccc-8ccc-${String(customers.length + 1).padStart(12, '0')}`, merchant_id: user.merchant_id, owner_user_id: user.id, phone: null, wechat: null, source: null, address: null, budget: null, status: 'new', notes: null, last_follow_up_at: null, created_at: now, updated_at: now, ...input };
      customers.push(customer); status = 201; data = customer;
    }
  } else if (req.url?.startsWith('/customers/') && req.method === 'PATCH') {
    const id = req.url.split('/')[2];
    const customer = customers.find(item => item.id === id);
    if (!customer) { status = 404; data = error('not_found', 'Record not found'); }
    else if (input.name === '') { status = 422; data = error('validation_error', 'Invalid request', [{ loc: ['body', 'name'], message: 'String should have at least 1 character' }]); }
    else { Object.assign(customer, input, { updated_at: now }); data = customer; }
  } else if (req.url?.startsWith('/products') && req.method === 'GET') {
    const url = new URL(req.url, 'http://mock');
    const id = url.pathname.split('/')[2];
    if (id) {
      const product = products.find(item => item.id === id);
      if (!product || id === 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') { status = 404; data = error('not_found', 'Record not found'); }
      else data = product;
    } else {
      const search = (url.searchParams.get('search') ?? '').toLowerCase();
      const category = url.searchParams.get('category') ?? '';
      const filtered = products.filter(item => [item.name, item.sku, item.brand].some(value => value.toLowerCase().includes(search)) && (!category || item.category === category));
      const limit = Number(url.searchParams.get('limit') ?? 20);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      data = { items: filtered.slice(offset, offset + limit), total: filtered.length, limit, offset };
    }
  } else if (req.url === '/products' && req.method === 'POST') {
    if (!input.name || !input.sku || !input.category || !input.brand || !input.price || !input.width_mm || !input.depth_mm || !input.height_mm) { status = 422; data = error('validation_error', 'Invalid request'); }
    else if (products.some(item => item.sku === input.sku)) { status = 409; data = error('conflict', 'SKU already exists'); }
    else { const product = { id: `ffffffff-ffff-4fff-8fff-${String(products.length + 1).padStart(12, '0')}`, merchant_id: user.merchant_id, thumbnail: null, model_url: null, metadata: {}, created_at: now, updated_at: now, ...input }; products.push(product); status = 201; data = product; }
  } else if (req.url?.startsWith('/products/') && req.method === 'PATCH') {
    const id = req.url.split('/')[2]; const product = products.find(item => item.id === id);
    if (!product) { status = 404; data = error('not_found', 'Record not found'); }
    else if (products.some(item => item.id !== id && item.sku === input.sku)) { status = 409; data = error('conflict', 'SKU already exists'); }
    else { Object.assign(product, input, { updated_at: now }); data = product; }
  } else { status = 404; data = error('missing', 'Missing'); }
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}).listen(8765, '127.0.0.1');
