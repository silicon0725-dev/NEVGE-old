import {resolve, sep, extname} from 'node:path';

const root = resolve(process.cwd(), 'build');
const hostname = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8602);

const MIME = Object.freeze({
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.wasm': 'application/wasm',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.mp4': 'video/mp4'
});

const isInsideRoot = filePath => filePath === root || filePath.startsWith(`${root}${sep}`);

const responseForFile = async (filePath, method) => {
    if (!isInsideRoot(filePath)) return new Response('Forbidden', {status: 403});

    const file = Bun.file(filePath);
    if (!(await file.exists())) return null;

    const headers = new Headers();
    const contentType = MIME[extname(filePath).toLowerCase()];
    if (contentType) headers.set('Content-Type', contentType);

    // Performance testing should exercise the production bundle without stale
    // HTML. Hashed/static assets may still be cached by the browser naturally.
    if (filePath.endsWith(`${sep}index.html`)) {
        headers.set('Cache-Control', 'no-cache');
    }

    if (method === 'HEAD') return new Response(null, {status: 200, headers});
    return new Response(file, {status: 200, headers});
};

const server = Bun.serve({
    hostname,
    port,
    async fetch(request) {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            return new Response('Method Not Allowed', {
                status: 405,
                headers: {'Allow': 'GET, HEAD'}
            });
        }

        const url = new URL(request.url);
        let pathname;
        try {
            pathname = decodeURIComponent(url.pathname);
        } catch {
            return new Response('Bad Request', {status: 400});
        }

        if (pathname === '/') pathname = '/index.html';

        const candidate = resolve(root, `.${pathname}`);
        const direct = await responseForFile(candidate, request.method);
        if (direct) return direct;

        // Scratch GUI is effectively an SPA. Browser-navigation routes should
        // fall back to the production index, while missing asset requests stay 404.
        const acceptsHtml = (request.headers.get('accept') || '').includes('text/html');
        if (acceptsHtml) {
            const fallback = await responseForFile(resolve(root, 'index.html'), request.method);
            if (fallback) return fallback;
        }

        return new Response('Not Found', {status: 404});
    }
});

console.log(`[NGVGE] Production static server: http://${server.hostname}:${server.port}/`);
console.log(`[NGVGE] Root: ${root}`);
console.log('[NGVGE] Ctrl+C to stop.');
