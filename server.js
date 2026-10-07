import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const project = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.join(project, 'public');
const toolsRoot = path.join(project, 'tools');
const allowTools = process.env.DEV_TOOLS === '1';
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.jpg':'image/jpeg', '.png':'image/png', '.svg':'image/svg+xml', '.md':'text/plain; charset=utf-8' };
const server = http.createServer(async (req,res) => {
  try {
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405);res.end();return; }
    const url = new URL(req.url, 'http://localhost');
    const name = decodeURIComponent(url.pathname);
    const toolRequest = allowTools && name.startsWith('/tools/');
    const root = toolRequest ? toolsRoot : publicRoot;
    const relative = toolRequest ? name.slice('/tools'.length) : name;
    const file = path.resolve(root, `.${relative === '/' ? '/index.html' : relative}`);
    if (!file.startsWith(root + path.sep) || name.includes('\\') || name.split('/').some(p=>p.startsWith('.')) || file.includes(`${path.sep}node_modules${path.sep}`)) { res.writeHead(403);res.end();return; }
    const info = await stat(file); if (!info.isFile()) throw new Error('Not a file');
    res.writeHead(200, { 'Content-Type':types[path.extname(file)]||'application/octet-stream', 'Content-Length':info.size, 'X-Content-Type-Options':'nosniff', 'Cache-Control':'no-cache' });
    if(req.method==='HEAD')res.end();else res.end(await readFile(file));
  } catch { res.writeHead(404);res.end('Not found'); }
});
const port = process.env.PORT === undefined ? 3000 : Number(process.env.PORT);
server.listen(port, '127.0.0.1', () => console.log(`melodia is running at http://localhost:${server.address().port}`));