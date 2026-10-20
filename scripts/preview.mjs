import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const base = new URL('../', import.meta.url);
const routes = new Map([
  ['/', ['preview/index.html', 'text/html; charset=utf-8']],
  ['/demo.js', ['preview/demo.js', 'text/javascript; charset=utf-8']],
  ['/lib/client.js', ['lib/client.js', 'text/javascript; charset=utf-8']],
]);
const port = Number(process.env.PORT ?? 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be between 1024 and 65535');
createServer(async (req, res) => {
  try {
    const route = routes.get(new URL(req.url, 'http://localhost').pathname);
    if (!route || (req.method !== 'GET' && req.method !== 'HEAD')) { res.writeHead(404); res.end(); return; }
    const data = await readFile(new URL(route[0], base));
    res.writeHead(200, { 'Content-Type': route[1], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(500); res.end('Build first: npm run build'); }
}).listen(port, '127.0.0.1', () => console.log(`Moyu Meter demo: http://127.0.0.1:${port} (simulated Agent, no model calls)`));
