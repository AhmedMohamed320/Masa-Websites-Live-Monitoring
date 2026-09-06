import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import proxyHandler from './api/proxy.js';
import checkHandler from './api/check.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8088;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // API Endpoints
  if (parsedUrl.pathname === '/api/proxy') {
    return proxyHandler(req, res);
  }

  if (parsedUrl.pathname === '/api/check') {
    return checkHandler(req, res);
  }

  // Static File Serving
  let relativePath = parsedUrl.pathname === '/' ? 'index.html' : parsedUrl.pathname;
  let safePath = path.normalize(path.join(__dirname, relativePath));
  if (!safePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden');
  }

  const ext = path.extname(safePath).toLowerCase();

  try {
    const stats = await fs.promises.stat(safePath);
    if (stats.isDirectory()) {
      safePath = path.join(safePath, 'index.html');
    }
    const data = await fs.promises.readFile(safePath);
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
});

let currentPort = DEFAULT_PORT;

function startServer(port) {
  currentPort = port;
  server.listen(port, '0.0.0.0', () => {
    console.log(`\n==================================================`);
    console.log(`🚀 Masa Pulse Monitor Server is running!`);
    console.log(`🌐 Local URL: http://localhost:${port}/`);
    console.log(`📡 Network:   http://127.0.0.1:${port}/`);
    console.log(`==================================================\n`);
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const nextPort = currentPort + 1;
    console.warn(`⚠️ Port ${currentPort} is already in use. Automatically switching to port ${nextPort}...`);
    setTimeout(() => startServer(nextPort), 400);
  } else {
    console.error('Server error:', err);
  }
});

startServer(DEFAULT_PORT);
