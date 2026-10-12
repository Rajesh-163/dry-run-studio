#!/usr/bin/env node
/* Dry Run Studio local server. No dependencies: `node server.js`, then open the printed address.
   It serves the site and forwards /proxy/<provider>/... to that provider's API, so the
   browser never runs into cross-origin limits. Your key passes through this process on its
   way to the provider and is not logged or stored. The server listens on this computer only. */
const http = require('http'), https = require('https'), fs = require('fs'), path = require('path');

const PORT = Number(process.env.PORT) || 5173;
const ROOT = __dirname;
const UPSTREAM = { anthropic: 'api.anthropic.com', openai: 'api.openai.com', gemini: 'generativelanguage.googleapis.com' };
const FORWARD = ['content-type', 'accept', 'x-api-key', 'anthropic-version', 'authorization'];
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.md': 'text/markdown; charset=utf-8' };
const send = (res, code, body, type) => { res.writeHead(code, { 'content-type': type || 'application/json', 'cache-control': 'no-store' }); res.end(body); };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/__drs') return send(res, 200, '{"drs":true}');

  const m = url.pathname.match(/^\/proxy\/(anthropic|openai|gemini)(\/.*)$/);
  if (m) {
    // Only this site may use the proxy.
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) return send(res, 403, '{"error":{"message":"Cross-site request refused."}}');
    const headers = {};
    for (const h of FORWARD) if (req.headers[h]) headers[h] = req.headers[h];
    const up = https.request({ host: UPSTREAM[m[1]], path: m[2] + url.search, method: req.method, headers }, r => {
      res.writeHead(r.statusCode, { 'content-type': r.headers['content-type'] || 'application/json', 'cache-control': 'no-store' });
      r.pipe(res);
    });
    up.on('error', e => { if (!res.headersSent) send(res, 502, JSON.stringify({ error: { message: 'The local server could not reach the provider: ' + e.message } })); else res.end(); });
    res.on('close', () => up.destroy());
    req.pipe(up);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', 'text/plain');
  let rel; try { rel = decodeURIComponent(url.pathname); } catch (e) { return send(res, 400, 'Bad request', 'text/plain'); }
  const file = path.normalize(path.join(ROOT, rel === '/' ? 'index.html' : rel));
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return send(res, 403, 'Forbidden', 'text/plain');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'Not found', 'text/plain');
    send(res, 200, data, TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Dry Run Studio is running.\n  Open  http://localhost:${PORT}\n\n  Press Ctrl+C to stop.\n`);
}).on('error', e => {
  console.error(e.code === 'EADDRINUSE' ? `Port ${PORT} is busy. Try:  PORT=${PORT + 1} node server.js` : e.message);
  process.exit(1);
});
