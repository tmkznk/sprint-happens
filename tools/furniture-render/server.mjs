import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

// Statyczny serwer renderera: /pack/ — paczka mebli, /three/ — three.js, / — strona renderera.
const HERE = fileURLToPath(new URL('.', import.meta.url));
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.obj': 'text/plain',
  '.mtl': 'text/plain',
};

export function startServer(packDir, port = 4401) {
  const server = createServer(async (req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file;
    if (url.startsWith('/pack/')) file = join(packDir, normalize(url.slice(6)));
    else if (url.startsWith('/three/'))
      file = join(HERE, 'node_modules/three', normalize(url.slice(7)));
    else file = join(HERE, normalize(url === '/' ? 'render.html' : url.slice(1)));
    try {
      const data = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}
