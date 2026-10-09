import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { spawn } from 'node:child_process';
import { publicFiles, safePublicFile } from './static-assets.mjs';
import { assertEntryReady } from './server-health.mjs';
import { createPlatform } from '../server/platform.mjs';

const root = resolve(process.argv.includes('--dist') ? 'dist' : '.');
const port = Number(process.env.PORT || 8765);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be an integer between 1024 and 65535.');
const allowed = await publicFiles(root);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest':'application/manifest+json', '.glb':'model/gltf-binary', '.mp4':'video/mp4', '.webm':'video/webm', '.mp3':'audio/mpeg', '.ogg':'audio/ogg', '.wav':'audio/wav', '.ktx2':'image/ktx2', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.md': 'text/plain; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };
const configuredOrigin=process.env.CAMPUS_PUBLIC_ORIGIN;
if(process.env.NODE_ENV==='production'&&process.argv.includes('--platform')&&!configuredOrigin)throw new Error('Production API requires CAMPUS_PUBLIC_ORIGIN.');
if(configuredOrigin){const url=new URL(configuredOrigin);if(url.origin!==configuredOrigin||url.username||url.password||!['https:','http:'].includes(url.protocol))throw new Error('CAMPUS_PUBLIC_ORIGIN must be an explicit HTTP(S) origin.');if(process.env.NODE_ENV==='production'&&url.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('Production public origin requires HTTPS.');}
const bindHost=process.env.CAMPUS_BIND_HOST||'127.0.0.1';
if(!['127.0.0.1','0.0.0.0'].includes(bindHost))throw new Error('CAMPUS_BIND_HOST must be 127.0.0.1 or 0.0.0.0.');
const embedOrigins=(process.env.CAMPUS_EMBED_ORIGINS||'').split(',').filter(Boolean).map(value=>{const url=new URL(value);if(url.protocol!=='https:'||url.origin!==value||url.username||url.password)throw new Error('CAMPUS_EMBED_ORIGINS must list explicit HTTPS origins.');return url.origin;});
const platform=process.argv.includes('--platform')?await createPlatform({root:resolve('.'),assetRoot:root,databasePath:process.env.CAMPUS_DB_PATH,providersFile:process.env.CAMPUS_PROVIDERS_FILE,origins:configuredOrigin?[configuredOrigin]:[`http://127.0.0.1:${port}`,`http://localhost:${port}`],secureCookies:configuredOrigin?.startsWith('https:'),trustedProxyIPs:(process.env.CAMPUS_TRUSTED_PROXY_IPS||'').split(',').filter(Boolean),log:(record)=>process.stdout.write(JSON.stringify(record)+'\n')}):null;
const server = http.createServer(async (request, response) => {
  const headers = {
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors ${request.url?.split('?')[0]==='/admin.html'?"'none'":["'self'",...embedOrigins].join(' ')}`,
    'Cache-Control': 'no-cache',
    ...(platform ? {'X-Campus-Api':'/api/v1'} : {}),
    ...(configuredOrigin?.startsWith('https:') ? {'Strict-Transport-Security':'max-age=31536000'} : {}),
  };
  if(configuredOrigin?.startsWith('https:'))response.setHeader('Strict-Transport-Security','max-age=31536000');
  try {
    if(platform&&await platform.handle(request,response))return;
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { ...headers, Allow: 'GET, HEAD' }); response.end(); return; }
    // Preserve the raw path until validation: URL parsing normalizes dot segments.
    const pathname = decodeURIComponent(request.url.split('?')[0]);
    const name = pathname === '/' ? 'index.html' : pathname.slice(1);
    const contentType = types[extname(name)];
    if (!pathname.startsWith('/') || pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some((part) => part.startsWith('.')) || !allowed.has(name) || !contentType) {
      response.writeHead(404, headers); response.end('Not found'); return;
    }
    const file = await safePublicFile(root, name);
    if (!file) { response.writeHead(404, headers); response.end('Not found'); return; }
    if (!(await stat(file)).isFile()) { response.writeHead(404, headers); response.end('Not found'); return; }
    const body = await readFile(file);
    response.writeHead(200, { ...headers, 'Content-Type': contentType, 'Content-Length': body.length });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    const code = error instanceof URIError ? 400 : ['ENOENT', 'ENOTDIR', 'ELOOP'].includes(error.code) ? 404 : 500;
    response.writeHead(code, headers);
    response.end(code === 400 ? 'Bad request' : code === 404 ? 'Not found' : 'Unable to serve this file');
    if (code === 500) process.stderr.write('Static file read failed.\n');
  }
});
server.on('error', (error) => { process.stderr.write(`Local server failed (${error.code}). URL: http://127.0.0.1:${port}/\n`); process.exitCode = 1; });
server.listen(port, bindHost, async () => {
  const url = `http://127.0.0.1:${port}/`;
  process.stdout.write(`Hanshin campus: ${url}\nPress Ctrl+C to stop.\n`);
  if (process.argv.includes('--open') && process.platform === 'win32') {
    try {
      await assertEntryReady(url);
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Start-Process '${url}'`], { windowsHide: true, stdio: 'ignore' });
      child.once('error', () => process.stderr.write(`Open the browser manually: ${url}\n`));
      child.once('exit', (code) => { if (code) process.stderr.write(`Open the browser manually: ${url}\n`); });
    } catch {
      process.stderr.write(`The local page is not ready. Open the browser manually after checking it: ${url}\n`);
    }
  }
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { server.close(() => { platform?.close(); process.exitCode = 0; }); server.closeIdleConnections(); });
