import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const directory = path.resolve(process.argv[2] || '.');
const port = Number(process.argv[3] || 4173);
const host = '127.0.0.1';

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.md', 'text/markdown; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.xpi', 'application/x-xpinstall'],
]);

function isInside(file, parent) {
  const relative = path.relative(parent, file);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function resolveRequest(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  let file = path.resolve(directory, `.${decoded}`);
  if (!isInside(file, directory)) {
    return null;
  }
  try {
    if ((await stat(file)).isDirectory()) {
      file = path.join(file, 'index.html');
    }
    if (!(await stat(file)).isFile()) {
      return null;
    }
    return file;
  } catch {
    return null;
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${host}:${port}`);
  let file = await resolveRequest(url.pathname);
  let statusCode = 200;

  if (!file) {
    file = path.join(directory, '404.html');
    statusCode = 404;
  }

  try {
    const content = await readFile(file);
    response.writeHead(statusCode, {
      'Cache-Control': 'no-store',
      'Content-Type': contentTypes.get(path.extname(file).toLowerCase())
        || 'application/octet-stream',
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    response.writeHead(404, {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
    });
    response.end(request.method === 'HEAD' ? undefined : 'Not found');
  }
});

server.listen(port, host, () => {
  console.log(`Serving ${directory} at http://${host}:${port}/`);
});
