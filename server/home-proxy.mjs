// Chạy chính worker/index.js trên máy nhà (Node 18+, không cần npm install).
//   node server/home-proxy.mjs
// Rồi mở tunnel:  cloudflared tunnel --url http://localhost:8787
import http from 'node:http';
import worker from '../worker/index.js';

const PORT = Number(process.env.PORT || 8787);
const env = { ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || '*' };

http.createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(`http://${req.headers.host || 'localhost'}${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : body
    });
    const response = await worker.fetch(request, env);
    const headers = Object.fromEntries(response.headers);
    delete headers['content-encoding']; delete headers['content-length'];
    res.writeHead(response.status, headers);
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (e) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'home proxy error', detail: String(e?.message || e) }));
  }
}).listen(PORT, () => console.log(`Proxy chạy tại http://localhost:${PORT}  (thử /api/health)`));
