#!/usr/bin/env node

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;
const GAMES_DIR = path.join(ROOT, 'games');
const IMAGES_DIR = path.join(ROOT, 'images');
const GAMES_JSON = path.join(ROOT, 'games.json');

// ============================================================
// Load game origin mapping for proxy fallback
// ============================================================
let gameOrigins = {};
if (fs.existsSync(GAMES_JSON)) {
    const raw = JSON.parse(fs.readFileSync(GAMES_JSON, 'utf-8'));
    for (const [id, data] of Object.entries(raw)) {
        if (data.iframeSrc) {
            gameOrigins[id] = data.iframeSrc.replace(/\/+$/, '');
        }
    }
}
console.log(`📡 Loaded ${Object.keys(gameOrigins).length} game origin URLs for proxy fallback`);

// ============================================================
// Build game index
// ============================================================
function buildGameIndex() {
    const games = [];
    const folders = fs.readdirSync(GAMES_DIR).filter(f =>
        f.startsWith('class-') && fs.statSync(path.join(GAMES_DIR, f)).isDirectory()
    );
    for (const folder of folders) {
        const indexPath = path.join(GAMES_DIR, folder, 'index.html');
        if (!fs.existsSync(indexPath)) continue;
        const html = fs.readFileSync(indexPath, 'utf-8');
        const titleMatch = html.match(/<title>([^<]+)<\/title>/);
        const title = titleMatch ? titleMatch[1].trim() : folder;
        const num = parseInt(folder.replace('class-', ''));
        const fileCount = countFilesQuick(path.join(GAMES_DIR, folder));
        games.push({ id: folder, num, title: title === folder ? `Game ${num}` : title, thumbnail: `/images/${folder}.png`, playUrl: `/play/${folder}`, fileCount });
    }
    games.sort((a, b) => a.num - b.num);
    return games;
}

function countFilesQuick(dir) {
    let count = 0;
    try {
        const items = fs.readdirSync(dir);
        for (const item of items) {
            if (item.startsWith('.')) continue;
            const full = path.join(dir, item);
            try {
                const stat = fs.statSync(full);
                if (stat.isFile()) count++;
                else if (stat.isDirectory()) count += countFilesQuick(full);
            } catch (e) {}
        }
    } catch (e) {}
    return count;
}

// ============================================================
// MIME types
// ============================================================
const MIME = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.mjs': 'application/javascript', '.json': 'application/json',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
    '.ico': 'image/x-icon', '.wasm': 'application/wasm',
    '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
    '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.webm': 'audio/webm',
    '.mp4': 'video/mp4', '.ttf': 'font/ttf', '.woff': 'font/woff',
    '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain',
    '.bin': 'application/octet-stream', '.dat': 'application/octet-stream',
    '.mem': 'application/octet-stream', '.data': 'application/octet-stream',
    '.unityweb': 'application/octet-stream',
};

function getMime(p) { return MIME[path.extname(p).toLowerCase()] || 'application/octet-stream'; }

// ============================================================
// Proxy fetch from origin (fetch missing files and cache them)
// ============================================================
function proxyFetch(originUrl, localPath) {
    return new Promise((resolve, reject) => {
        const doFetch = (url, redirects = 0) => {
            if (redirects > 5) return reject(new Error('Too many redirects'));
            const mod = url.startsWith('https') ? https : http;
            mod.get(url, { timeout: 15000 }, (res) => {
                if ([301, 302, 307, 308].includes(res.statusCode)) {
                    let loc = res.headers.location;
                    if (loc && !loc.startsWith('http')) {
                        const u = new URL(url);
                        loc = u.origin + loc;
                    }
                    res.resume();
                    return doFetch(loc, redirects + 1);
                }
                if (res.statusCode !== 200) {
                    res.resume();
                    return reject(new Error(`${res.statusCode}`));
                }
                const chunks = [];
                res.on('data', c => chunks.push(c));
                res.on('end', () => {
                    const buf = Buffer.concat(chunks);
                    // Cache locally
                    try {
                        const dir = path.dirname(localPath);
                        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                        fs.writeFileSync(localPath, buf);
                    } catch (e) { /* ignore cache write errors */ }
                    resolve(buf);
                });
                res.on('error', reject);
            }).on('error', reject).on('timeout', function () { this.destroy(); reject(new Error('timeout')); });
        };
        doFetch(originUrl);
    });
}

// ============================================================
// Serve file - local first, proxy fallback if missing
// ============================================================
async function serveGameFile(req, res, pathname) {
    const localPath = path.join(ROOT, pathname);

    // Security: must be inside games dir
    if (!localPath.startsWith(GAMES_DIR)) {
        res.writeHead(403); res.end('Forbidden'); return;
    }

    // Extract game ID and relative file path
    const parts = pathname.replace(/^\/games\//, '').split('/');
    const gameId = parts[0]; // e.g. "class-969"
    const relPath = parts.slice(1).join('/'); // e.g. "css/aria.css"

    // Try local first
    let filePath = localPath;
    if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            filePath = path.join(filePath, 'index.html');
            if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
        }
        const content = fs.readFileSync(filePath);
        res.writeHead(200, {
            'Content-Type': getMime(filePath),
            'Content-Length': content.length,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600',
        });
        res.end(content);
        return;
    }

    // Not found locally → proxy from origin
    const originBase = gameOrigins[gameId];
    if (!originBase || !relPath) {
        res.writeHead(404); res.end('Not found'); return;
    }

    const originUrl = `${originBase}/${relPath}`;
    try {
        const buf = await proxyFetch(originUrl, localPath);
        console.log(`  📥 Proxied & cached: ${gameId}/${relPath} (${(buf.length / 1024).toFixed(1)}KB)`);
        res.writeHead(200, {
            'Content-Type': getMime(localPath),
            'Content-Length': buf.length,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600',
        });
        res.end(buf);
    } catch (err) {
        // Also try without the /games/classXXX prefix - some games reference /poki-sdk.js etc globally
        res.writeHead(404);
        res.end('Not found');
    }
}

function serveStaticFile(res, filePath) {
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
        if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
    }
    const content = fs.readFileSync(filePath);
    res.writeHead(200, {
        'Content-Type': getMime(filePath), 'Content-Length': content.length,
        'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=3600',
    });
    res.end(content);
}

// ============================================================
// HTML Templates
// ============================================================
function escapeHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function homePage(games, query = '', page = 1) {
    const PER_PAGE = 60;
    let filtered = games;
    if (query) { const q = query.toLowerCase(); filtered = games.filter(g => g.title.toLowerCase().includes(q) || g.id.includes(q)); }
    const totalPages = Math.ceil(filtered.length / PER_PAGE);
    page = Math.max(1, Math.min(page, totalPages || 1));
    const pageGames = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    const cards = pageGames.map(g => `
        <a href="${g.playUrl}" class="gc">
            <div class="gt">
                <img src="${g.thumbnail}" alt="${escapeHtml(g.title)}" loading="lazy"
                    onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22><rect fill=%22%23222%22 width=%22200%22 height=%22200%22/><text x=%2250%25%22 y=%2250%25%22 fill=%22%23666%22 font-size=%2248%22 text-anchor=%22middle%22 dy=%22.3em%22>🎮</text></svg>'">
                <div class="po"><div class="pb">▶</div></div>
            </div>
            <div class="gn">${escapeHtml(g.title)}</div>
        </a>`).join('');

    let pag = '';
    if (totalPages > 1) {
        const qp = query ? `&q=${encodeURIComponent(query)}` : '';
        let btns = [];
        const range = 3;
        if (page > 1) btns.push(`<a href="/?page=${page-1}${qp}" class="pgb">‹</a>`);
        for (let p = Math.max(1, page - range); p <= Math.min(totalPages, page + range); p++) {
            btns.push(`<a href="/?page=${p}${qp}" class="pgb${p===page?' ac':''}">${p}</a>`);
        }
        if (page < totalPages) btns.push(`<a href="/?page=${page+1}${qp}" class="pgb">›</a>`);
        pag = `<div class="pg">${btns.join('')}</div>`;
    }

    return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>🎮 Game Portal — ${filtered.length} Games</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0a0a1a;--bg2:#12122a;--bg3:#1a1a3e;--bg3h:#252560;--ac:#6c5ce7;--acg:#a29bfe;--ac2:#fd79a8;--tx:#e8e8ff;--tx2:#9090c0;--bd:rgba(108,92,231,.2);--r:16px}
body{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--tx);min-height:100vh}
body::before{content:'';position:fixed;inset:0;background:radial-gradient(ellipse at 20% 50%,rgba(108,92,231,.08) 0%,transparent 50%),radial-gradient(ellipse at 80% 20%,rgba(253,121,168,.06) 0%,transparent 50%);pointer-events:none;z-index:0}
.hd{position:sticky;top:0;z-index:100;background:rgba(10,10,26,.88);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid var(--bd);padding:0 24px}
.hi{max-width:1400px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;height:72px;gap:20px}
.logo{font-size:1.5rem;font-weight:900;background:linear-gradient(135deg,var(--acg),var(--ac2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;text-decoration:none;white-space:nowrap;letter-spacing:-.5px}
.logo span{font-size:1.8rem;margin-right:6px}
.sb{flex:1;max-width:480px;position:relative}
.sb input{width:100%;padding:12px 20px 12px 48px;background:var(--bg2);border:1px solid var(--bd);border-radius:50px;color:var(--tx);font-size:.95rem;font-family:inherit;outline:none;transition:all .3s}
.sb input:focus{border-color:var(--ac);box-shadow:0 0 0 3px rgba(108,92,231,.15)}
.sb::before{content:'🔍';position:absolute;left:18px;top:50%;transform:translateY(-50%);font-size:1rem;pointer-events:none}
.st{font-size:.85rem;color:var(--tx2);white-space:nowrap}
.st strong{color:var(--acg);font-weight:700}
.ct{max-width:1400px;margin:0 auto;padding:32px 24px;position:relative;z-index:1}
.gg{display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:18px}
.gc{text-decoration:none;color:inherit;border-radius:var(--r);overflow:hidden;background:var(--bg3);border:1px solid transparent;transition:all .3s cubic-bezier(.4,0,.2,1);position:relative}
.gc:hover{transform:translateY(-6px) scale(1.02);border-color:var(--ac);box-shadow:0 12px 40px rgba(108,92,231,.15),0 4px 12px rgba(0,0,0,.3);background:var(--bg3h)}
.gt{position:relative;aspect-ratio:1;overflow:hidden;background:var(--bg2)}
.gt img{width:100%;height:100%;object-fit:cover;transition:transform .4s}
.gc:hover .gt img{transform:scale(1.1)}
.po{position:absolute;inset:0;background:rgba(10,10,26,.5);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .3s}
.gc:hover .po{opacity:1}
.pb{width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,var(--ac),var(--ac2));display:flex;align-items:center;justify-content:center;font-size:1.5rem;color:#fff;box-shadow:0 4px 20px rgba(108,92,231,.4);transform:scale(.8);transition:transform .3s}
.gc:hover .pb{transform:scale(1)}
.gn{padding:12px 14px;font-size:.83rem;font-weight:600;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pg{display:flex;justify-content:center;gap:6px;margin-top:40px;flex-wrap:wrap}
.pgb{padding:8px 14px;border-radius:10px;background:var(--bg3);color:var(--tx2);text-decoration:none;font-size:.85rem;font-weight:600;border:1px solid var(--bd);transition:all .2s}
.pgb:hover{background:var(--bg3h);color:var(--tx);border-color:var(--ac)}
.pgb.ac{background:linear-gradient(135deg,var(--ac),var(--ac2));color:#fff;border-color:transparent}
.nr{text-align:center;padding:80px 20px;color:var(--tx2)}
.nr .em{font-size:4rem;margin-bottom:16px}
.nr h2{font-size:1.5rem;margin-bottom:8px;color:var(--tx)}
.ft{text-align:center;padding:40px 24px;color:var(--tx2);font-size:.8rem;border-top:1px solid var(--bd);margin-top:40px}
@media(max-width:768px){.hi{height:60px;gap:12px}.logo{font-size:1.1rem}.st{display:none}.gg{grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px}.ct{padding:16px 12px}}
</style></head><body>
<div class="hd"><div class="hi">
<a href="/" class="logo"><span>🎮</span>Game Portal</a>
<div class="sb"><input type="text" id="si" placeholder="Search ${filtered.length} games..." value="${escapeHtml(query)}" autofocus></div>
<div class="st"><strong>${filtered.length}</strong> games</div>
</div></div>
<div class="ct">
${pageGames.length > 0 ? `<div class="gg">${cards}</div>${pag}` : `<div class="nr"><div class="em">🔍</div><h2>No games found</h2><p>Try a different search</p></div>`}
</div>
<div class="ft">Game Portal — ${games.length} games • Files auto-proxied from origin if missing locally</div>
<script>
let d;document.getElementById('si').addEventListener('input',function(e){clearTimeout(d);d=setTimeout(()=>{const q=e.target.value.trim();window.location.href=q?'/?q='+encodeURIComponent(q):'/'},400)});
</script></body></html>`;
}

function playPage(game, games) {
    const idx = games.findIndex(g => g.id === game.id);
    const prev = idx > 0 ? games[idx - 1] : null;
    const next = idx < games.length - 1 ? games[idx + 1] : null;
    const related = games.filter(g => g.id !== game.id).sort(() => Math.random() - .5).slice(0, 18);

    const relCards = related.map(g => `
        <a href="${g.playUrl}" class="rc">
            <img src="${g.thumbnail}" alt="${escapeHtml(g.title)}" loading="lazy" onerror="this.style.display='none'">
            <span>${escapeHtml(g.title)}</span>
        </a>`).join('');

    return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(game.title)} — Game Portal</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0a0a1a;--bg2:#12122a;--ac:#6c5ce7;--acg:#a29bfe;--ac2:#fd79a8;--tx:#e8e8ff;--tx2:#9090c0;--bd:rgba(108,92,231,.2)}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--tx);min-height:100vh}
.tb{display:flex;align-items:center;justify-content:space-between;padding:10px 24px;background:rgba(10,10,26,.92);backdrop-filter:blur(16px);border-bottom:1px solid var(--bd);position:sticky;top:0;z-index:100}
.tb a{color:var(--tx2);text-decoration:none;font-size:.9rem;font-weight:600;transition:color .2s;display:flex;align-items:center;gap:6px}
.tb a:hover{color:var(--acg)}
.tt{font-size:1.1rem;font-weight:700;background:linear-gradient(135deg,var(--acg),var(--ac2));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.nb{display:flex;gap:8px}
.nn{padding:6px 16px;border-radius:8px;background:var(--bg2);color:var(--tx2);text-decoration:none;font-size:.8rem;font-weight:600;border:1px solid var(--bd);transition:all .2s}
.nn:hover{background:var(--ac);color:#fff;border-color:var(--ac)}
.gw{display:flex;justify-content:center;padding:0;background:#000;position:relative}
.gf{width:100%;max-width:100vw;height:calc(100vh - 52px - 52px);border:none;background:#000;display:block}
.cc{display:flex;justify-content:center;gap:12px;padding:12px;background:var(--bg2);border-bottom:1px solid var(--bd)}
.cb{padding:8px 20px;border-radius:10px;border:1px solid var(--bd);background:var(--bg);color:var(--tx);font-size:.85rem;font-weight:600;font-family:inherit;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:6px}
.cb:hover{background:var(--ac);border-color:var(--ac);color:#fff}
.rs{max-width:1400px;margin:32px auto;padding:0 24px}
.rs h3{font-size:1.1rem;margin-bottom:16px;color:var(--tx2)}
.rg{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
.rc{text-decoration:none;color:inherit;border-radius:12px;overflow:hidden;background:var(--bg2);border:1px solid transparent;transition:all .3s}
.rc:hover{transform:translateY(-3px);border-color:var(--ac);box-shadow:0 8px 20px rgba(108,92,231,.12)}
.rc img{width:100%;aspect-ratio:1;object-fit:cover}
.rc span{display:block;padding:8px 10px;font-size:.72rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media(max-width:768px){.gf{height:55vh}.tt{display:none}.cc{gap:8px;padding:8px}.cb{padding:6px 12px;font-size:.8rem}}
</style></head><body>
<div class="tb">
<a href="/">← Back</a>
<span class="tt">${escapeHtml(game.title)}</span>
<div class="nb">
${prev ? `<a href="${prev.playUrl}" class="nn">◀ Prev</a>` : ''}
${next ? `<a href="${next.playUrl}" class="nn">Next ▶</a>` : ''}
</div></div>
<div class="gw"><iframe class="gf" id="gf" src="/games/${game.id}/index.html" allowfullscreen allow="autoplay;fullscreen;gamepad" scrolling="no"></iframe></div>
<div class="cc">
<button class="cb" onclick="toggleFs()">⛶ Fullscreen</button>
<button class="cb" onclick="document.getElementById('gf').src=document.getElementById('gf').src">🔄 Reload</button>
<button class="cb" onclick="location.href='/'">🏠 Home</button>
</div>
<div class="rs"><h3>🎮 You might also like</h3><div class="rg">${relCards}</div></div>
<script>
function toggleFs(){const f=document.getElementById('gf');if(f.requestFullscreen)f.requestFullscreen();else if(f.webkitRequestFullscreen)f.webkitRequestFullscreen()}
document.addEventListener('keydown',e=>{if(e.key==='f'&&!e.ctrlKey&&!e.metaKey&&document.activeElement.tagName!=='INPUT')toggleFs()});
</script></body></html>`;
}

// ============================================================
// Server with proxy fallback
// ============================================================
console.log('🎮 Building game index...');
const gameIndex = buildGameIndex();
console.log(`✅ Found ${gameIndex.length} games\n`);

const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, `http://${req.headers.host}`);
    const pathname = decodeURIComponent(u.pathname);

    // Home
    if (pathname === '/' || pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(homePage(gameIndex, u.searchParams.get('q') || '', parseInt(u.searchParams.get('page')) || 1));
        return;
    }

    // Play page
    const playMatch = pathname.match(/^\/play\/(class-\d+)\/?$/);
    if (playMatch) {
        const game = gameIndex.find(g => g.id === playMatch[1]);
        if (game) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(playPage(game, gameIndex));
        } else { res.writeHead(404); res.end('Game not found'); }
        return;
    }

    // Game files with proxy fallback
    if (pathname.startsWith('/games/')) {
        await serveGameFile(req, res, pathname);
        return;
    }

    // Thumbnail images
    if (pathname.startsWith('/images/')) {
        const filePath = path.join(ROOT, pathname);
        if (!filePath.startsWith(IMAGES_DIR)) { res.writeHead(403); res.end('Forbidden'); return; }
        serveStaticFile(res, filePath);
        return;
    }

    // Serve local root-level files (Unity loaders)
    if (pathname === '/master-loader.js' || pathname === '/unity-2020.js') {
        const filePath = path.join(ROOT, pathname);
        if (fs.existsSync(filePath)) {
            serveStaticFile(res, filePath);
            return;
        }
    }

    // PokiSDK stub - many games need this
    if (pathname === '/poki-sdk.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(`window.PokiSDK={init:()=>Promise.resolve(),gameLoadingStart:()=>{},gameLoadingFinished:()=>{},gameLoadingProgress:()=>{},gameplayStart:()=>{},gameplayStop:()=>{},commercialBreak:()=>Promise.resolve(),rewardedBreak:()=>Promise.resolve({success:true}),setDebug:()=>{},isAdBlocked:()=>false,getURLParam:()=>null,shareableURL:()=>Promise.resolve(""),displayAd:()=>Promise.resolve()};`);
        return;
    }

    // API
    if (pathname === '/api/games') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(gameIndex));
        return;
    }

    // Root-level fallback proxy: /master-loader.js, /unity-2020.js, /UnityLoader.js, etc.
    // Many Unity/Poki games reference scripts from the root of inkyedu118.github.io
    const SHARED_DIR = path.join(ROOT, 'shared_assets');
    const localSharedPath = path.join(SHARED_DIR, pathname);

    // Security: only allow safe file extensions
    const ext = path.extname(pathname).toLowerCase();
    const safeExts = ['.js', '.css', '.json', '.png', '.jpg', '.gif', '.svg', '.woff', '.woff2', '.ttf', '.wasm', '.gz', '.data', '.unityweb', '.mem'];
    if (ext && safeExts.includes(ext)) {
        // Check local cache first
        if (fs.existsSync(localSharedPath)) {
            const content = fs.readFileSync(localSharedPath);
            res.writeHead(200, {
                'Content-Type': getMime(localSharedPath),
                'Content-Length': content.length,
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=86400',
            });
            res.end(content);
            return;
        }

        // Proxy from inkyedu118.github.io root
        const originUrl = `https://inkyedu118.github.io${pathname}`;
        try {
            const buf = await proxyFetch(originUrl, localSharedPath);
            console.log(`  📥 Root proxy & cached: ${pathname} (${(buf.length / 1024).toFixed(1)}KB)`);
            res.writeHead(200, {
                'Content-Type': getMime(localSharedPath),
                'Content-Length': buf.length,
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=86400',
            });
            res.end(buf);
            return;
        } catch (err) {
            // Silent fallback
        }
    }

    res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
    console.log(`🚀 Game Portal running at: http://localhost:${PORT}`);
    console.log(`   ${gameIndex.length} games ready`);
    console.log(`   📡 Missing files auto-proxied from origin & cached locally`);
    console.log(`   📡 Root-level files (Unity loaders, etc.) also proxied`);
    console.log(`\nPress Ctrl+C to stop\n`);
});
