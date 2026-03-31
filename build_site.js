#!/usr/bin/env node

/**
 * Static Site Generator for GitHub Pages
 * Generates SEO-optimized HTML for unblocked games portal
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// Configuration - loaded from config.json
// ============================================================
const CONFIG_PATH = path.join(__dirname, 'config.json');
const config = fs.existsSync(CONFIG_PATH) ? JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) : {};

const SITE_NAME = config.site?.name || 'Unblocked Games 76';
const SITE_DOMAIN = config.site?.domain || 'YOUR_USERNAME.github.io';
const SITE_URL = `https://${SITE_DOMAIN}`;
const SITE_DESCRIPTION = config.site?.description || 'Play 1000+ free unblocked games online.';
const GAMES_PER_PAGE = config.site?.gamesPerPage || 48;
const OUTPUT_DIR = path.join(__dirname, 'dist');

// ============================================================
// Load game data + apply overrides from config
// ============================================================
let gameList = JSON.parse(fs.readFileSync(path.join(__dirname, 'game_list.json'), 'utf-8'));

// Apply overrides (custom titles, disabled status)
const overrides = config.gameOverrides || {};
gameList = gameList.filter(g => {
    const ov = overrides[g.id];
    if (ov && ov.disabled) return false; // Skip disabled games
    if (ov && ov.title) g.title = ov.title; // Apply custom title
    return true;
});
console.log(`📊 Loaded ${gameList.length} games (after filtering disabled)`);

// Game page templates from config
const gameTemplates = config.gameTemplates || {};
function applyGameTemplate(field, title, catName, fallback) {
    const tpl = gameTemplates[field];
    if (!tpl) return fallback;
    return tpl
        .replace(/\{title\}/g, title)
        .replace(/\{category\}/g, catName)
        .replace(/\{categoryLower\}/g, catName.toLowerCase().replace(' games', ''))
        .replace(/\{siteName\}/g, SITE_NAME)
        .replace(/\{gameCount\}/g, String(gameList.length));
}

// Create output directory (preserve .git if exists)
if (fs.existsSync(OUTPUT_DIR)) {
    for (const item of fs.readdirSync(OUTPUT_DIR)) {
        if (item === '.git') continue; // Keep git repo intact
        fs.rmSync(path.join(OUTPUT_DIR, item), { recursive: true });
    }
} else {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ============================================================
// Helper: generate slug from title
// ============================================================
function slugify(text, fallbackId) {
    let slug = text
        .replace(/&#x[0-9a-f]+;/gi, '')  // Remove HTML entities like &#x1f3ae;
        .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')  // Remove emoji
        .replace(/[™®©]/g, '')  // Remove trademark symbols
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 60);
    // Fallback to ID-based slug if result is empty or too short
    if (!slug || slug.length < 2) {
        slug = fallbackId ? fallbackId.replace('class-', 'game-') : 'game';
    }
    return slug;
}

// Assign slugs to all games
for (const g of gameList) {
    g.slug = slugify(g.title, g.id);
    let count = gameList.filter(x => x.slug === g.slug).length;
    if (count > 1) g.slug = `${g.slug}-${g.id.replace('class-', '')}`;
}

// ============================================================
// Categories from config
// ============================================================
const CATEGORIES = config.categories || [];

// ============================================================
// Shared CSS
// ============================================================
const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0f0f23;--bg2:#1a1a35;--bg3:#252550;--bg3h:#303070;--ac:#7c6cf0;--acg:#b0a4ff;--ac2:#ff7eb3;--tx:#eeeeff;--tx2:#9999cc;--bd:rgba(120,100,240,.15);--r:14px}
body{font-family:'Inter',system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--tx);min-height:100vh;line-height:1.6}
a{color:var(--acg);text-decoration:none;transition:color .2s}
a:hover{color:var(--ac2)}
img{max-width:100%;height:auto}
.hdr{background:rgba(15,15,35,.95);backdrop-filter:blur(16px);border-bottom:1px solid var(--bd);padding:0 20px;position:sticky;top:0;z-index:100}
.hdr-in{max-width:1300px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;height:64px;gap:16px}
.logo{font-size:1.3rem;font-weight:900;background:linear-gradient(135deg,var(--acg),var(--ac2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;white-space:nowrap}
.logo:hover{opacity:.85}
.nav{display:flex;gap:16px;align-items:center}
.nav a{color:var(--tx2);font-size:.85rem;font-weight:600}
.nav a:hover{color:var(--acg)}
.hero{text-align:center;padding:48px 20px 32px;background:linear-gradient(180deg,rgba(120,100,240,.08),transparent)}
.hero h1{font-size:2.2rem;font-weight:900;margin-bottom:12px;background:linear-gradient(135deg,var(--acg),var(--ac2));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hero p{color:var(--tx2);font-size:1.05rem;max-width:640px;margin:0 auto}
.cnt{max-width:1300px;margin:0 auto;padding:24px 20px}
.gg{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:16px}
.gc{border-radius:var(--r);overflow:hidden;background:var(--bg2);border:1px solid transparent;transition:all .3s cubic-bezier(.4,0,.2,1)}
.gc:hover{transform:translateY(-5px);border-color:var(--ac);box-shadow:0 10px 30px rgba(120,100,240,.12)}
.gc .gt{position:relative;aspect-ratio:1;overflow:hidden;background:var(--bg3)}
.gc .gt img{width:100%;height:100%;object-fit:cover;transition:transform .4s}
.gc:hover .gt img{transform:scale(1.08)}
.gc .po{position:absolute;inset:0;background:rgba(15,15,35,.5);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .3s}
.gc:hover .po{opacity:1}
.gc .pb{width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,var(--ac),var(--ac2));display:flex;align-items:center;justify-content:center;font-size:1.4rem;color:#fff;box-shadow:0 4px 16px rgba(120,100,240,.3)}
.gc .gn{padding:10px 12px;font-size:.8rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pg{display:flex;justify-content:center;gap:6px;margin:32px 0;flex-wrap:wrap}
.pgb{padding:8px 14px;border-radius:8px;background:var(--bg2);color:var(--tx2);font-size:.85rem;font-weight:600;border:1px solid var(--bd);transition:all .2s}
.pgb:hover{background:var(--bg3);color:var(--tx);border-color:var(--ac)}
.pgb.ac{background:linear-gradient(135deg,var(--ac),var(--ac2));color:#fff;border-color:transparent}
.gp-bar{display:flex;align-items:center;justify-content:space-between;padding:10px 20px;background:rgba(15,15,35,.95);backdrop-filter:blur(12px);border-bottom:1px solid var(--bd)}
.gp-bar a{color:var(--tx2);font-size:.85rem;font-weight:600}
.gp-bar a:hover{color:var(--acg)}
.gp-title{font-size:1rem;font-weight:700;color:var(--acg)}
.gp-wrap{background:#000;display:flex;justify-content:center}
.gp-wrap iframe{width:100%;max-width:960px;height:75vh;border:none;background:#000}
.gp-ctrl{display:flex;justify-content:center;gap:10px;padding:12px;background:var(--bg2)}
.gp-btn{padding:8px 18px;border-radius:8px;border:1px solid var(--bd);background:var(--bg);color:var(--tx);font-size:.82rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s}
.gp-btn:hover{background:var(--ac);border-color:var(--ac);color:#fff}
.ginfo{max-width:900px;margin:32px auto;padding:0 20px}
.ginfo h1{font-size:1.6rem;margin-bottom:12px}
.ginfo h2{font-size:1.2rem;margin:20px 0 8px;color:var(--acg)}
.ginfo p{color:var(--tx2);margin-bottom:12px;line-height:1.7}
.rel{max-width:1300px;margin:24px auto;padding:0 20px}
.rel h2{font-size:1.1rem;margin-bottom:14px;color:var(--tx2)}
.rel-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
.rc{border-radius:10px;overflow:hidden;background:var(--bg2);border:1px solid transparent;transition:all .3s}
.rc:hover{border-color:var(--ac);transform:translateY(-3px)}
.rc img{width:100%;aspect-ratio:1;object-fit:cover}
.rc span{display:block;padding:6px 8px;font-size:.7rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.seo{max-width:900px;margin:40px auto;padding:0 20px}
.seo h2{font-size:1.3rem;margin-bottom:12px;color:var(--acg)}
.seo p,.seo ul{color:var(--tx2);margin-bottom:14px;line-height:1.7}
.seo ul{padding-left:20px}
.seo li{margin-bottom:6px}
.ftr{text-align:center;padding:32px 20px;color:var(--tx2);font-size:.75rem;border-top:1px solid var(--bd);margin-top:40px}
.ftr a{color:var(--tx2)}
.cats{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;padding:16px 20px}
.cat{padding:6px 16px;border-radius:20px;background:var(--bg2);color:var(--tx2);font-size:.8rem;font-weight:600;border:1px solid var(--bd);transition:all .2s}
.cat:hover,.cat.ac{background:var(--ac);color:#fff;border-color:var(--ac)}
@media(max-width:768px){
.hdr{padding:0 12px}
.hdr-in{height:52px;gap:8px}
.logo{font-size:.95rem}
.nav{gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;flex-shrink:1;min-width:0}
.nav::-webkit-scrollbar{display:none}
.nav a{font-size:.75rem;white-space:nowrap;padding:4px 8px;background:var(--bg3);border-radius:6px;flex-shrink:0}
.hero{padding:24px 16px 16px}
.hero h1{font-size:1.3rem}
.hero p{font-size:.85rem}
.cats{padding:10px 12px;gap:6px}
.cat{padding:5px 12px;font-size:.72rem}
.cnt{padding:16px 12px}
.gg{grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px}
.gc .gn{padding:7px 8px;font-size:.72rem}
.gc .pb{width:40px;height:40px;font-size:1.1rem}
.gp-bar{flex-wrap:wrap;gap:6px;padding:8px 12px;justify-content:center}
.gp-bar a{font-size:.78rem}
.gp-title{font-size:.88rem;width:100%;text-align:center;order:-1}
.gp-wrap iframe{width:100%;height:45vh;min-height:240px}
.gp-ctrl{gap:6px;padding:10px 12px;flex-wrap:wrap;justify-content:center}
.gp-btn{padding:10px 16px;font-size:.78rem;flex:1;min-width:0;text-align:center;border-radius:10px}
.ginfo{padding:0 16px;margin:20px auto}
.ginfo h1{font-size:1.2rem}
.ginfo h2{font-size:1rem;margin:16px 0 6px}
.ginfo p{font-size:.88rem}
.rel{padding:0 12px;margin:16px auto}
.rel h2{font-size:.95rem}
.rel-grid{grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:8px}
.rc span{font-size:.65rem;padding:5px 6px}
.seo{padding:0 16px;margin:24px auto}
.seo h2{font-size:1.1rem}
.seo p,.seo ul{font-size:.88rem}
.pg{margin:20px 0}
.pgb{padding:6px 12px;font-size:.8rem}
.ftr{padding:20px 16px;font-size:.7rem}
.ftr p+p{margin-top:6px}
}
@media(max-width:400px){
.gg{grid-template-columns:repeat(auto-fill,minmax(95px,1fr));gap:6px}
.gc .gn{font-size:.68rem;padding:5px 6px}
.nav a{font-size:.7rem;padding:3px 6px}
.hero h1{font-size:1.1rem}
.gp-wrap iframe{height:40vh;min-height:200px}
.rel-grid{grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:6px}
}
`;



function categorizeGame(game) {
    // Check override first
    const ov = overrides[game.id];
    if (ov && ov.category) {
        const cat = CATEGORIES.find(c => c.slug === ov.category);
        if (cat) return cat;
    }
    // Auto-categorize by keywords
    const title = game.title.toLowerCase();
    for (const cat of CATEGORIES) {
        if (cat.keywords && cat.keywords.some(k => title.includes(k))) return cat;
    }
    return { slug: 'other', name: 'Other Games' };
}

// ============================================================
// HTML generation helpers
// ============================================================
function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function header(currentPath = '/') {
    const navLinks = CATEGORIES.slice(0, 6).map(c =>
        `<a href="/category/${c.slug}/">${c.name.replace(' Games', '')}</a>`
    ).join('');

    return `<header class="hdr"><div class="hdr-in">
<a href="/" class="logo">🎮 ${SITE_NAME}</a>
<nav class="nav">${navLinks}</nav>
</div></header>`;
}

function footer() {
    const catLinks = CATEGORIES.map(c =>
        `<a href="/category/${c.slug}/">${c.name}</a>`
    ).join(' • ');

    return `<footer class="ftr">
<p>© 2026 ${SITE_NAME}. Play free unblocked games online.</p>
<p style="margin-top:8px">${catLinks}</p>
<p style="margin-top:8px">All games are provided by their respective owners.</p>
</footer>`;
}

function gameCard(g) {
    return `<a href="/game/${g.slug}/" class="gc">
<div class="gt">
<img src="${g.img}" alt="${escapeHtml(g.title)} Unblocked" loading="lazy" width="200" height="200"
onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22><rect fill=%22%23252550%22 width=%22200%22 height=%22200%22/><text x=%2250%25%22 y=%2250%25%22 fill=%22%23666%22 font-size=%2248%22 text-anchor=%22middle%22 dy=%22.3em%22>🎮</text></svg>'">
<div class="po"><div class="pb">▶</div></div>
</div>
<div class="gn">${escapeHtml(g.title)}</div>
</a>`;
}

function pagination(currentPage, totalPages, baseUrl) {
    if (totalPages <= 1) return '';
    const btns = [];
    const range = 3;
    if (currentPage > 1) btns.push(`<a href="${baseUrl}${currentPage === 2 ? '' : `page/${currentPage - 1}/`}" class="pgb">‹</a>`);
    for (let p = Math.max(1, currentPage - range); p <= Math.min(totalPages, currentPage + range); p++) {
        const url = p === 1 ? baseUrl : `${baseUrl}page/${p}/`;
        btns.push(`<a href="${url}" class="pgb${p === currentPage ? ' ac' : ''}">${p}</a>`);
    }
    if (currentPage < totalPages) btns.push(`<a href="${baseUrl}page/${currentPage + 1}/" class="pgb">›</a>`);
    return `<div class="pg">${btns.join('')}</div>`;
}

function htmlDoc({ title, description, canonical, ogImage, body, jsonLd, extraKeywords }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><linearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'><stop offset='0%25' stop-color='%237c6cf0'/><stop offset='100%25' stop-color='%23ff7eb3'/></linearGradient></defs><rect rx='14' width='64' height='64' fill='url(%23g)'/><text x='50%25' y='50%25' font-size='36' text-anchor='middle' dy='.35em'>🎮</text></svg>">
<link rel="icon" type="image/png" sizes="32x32" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect rx='7' width='32' height='32' fill='%237c6cf0'/><text x='50%25' y='50%25' font-size='18' text-anchor='middle' dy='.35em'>🎮</text></svg>">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index, follow">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${canonical}">
${ogImage ? `<meta property="og:image" content="${ogImage}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="keywords" content="${escapeHtml(config.site?.keywords || 'unblocked games, free games, online games, browser games, school games')}${extraKeywords || ''}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>${CSS}</style>
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-780CDB3KXM"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-780CDB3KXM');
</script>
</head>
<body>
${body}
</body>
</html>`;
}

// ============================================================
// Generate homepage (paginated)
// ============================================================
function generateHomepages() {
    const totalPages = Math.ceil(gameList.length / GAMES_PER_PAGE);

    for (let page = 1; page <= totalPages; page++) {
        const start = (page - 1) * GAMES_PER_PAGE;
        const pageGames = gameList.slice(start, start + GAMES_PER_PAGE);
        const cards = pageGames.map(gameCard).join('');
        const pag = pagination(page, totalPages, '/');

        const catButtons = CATEGORIES.map(c =>
            `<a href="/category/${c.slug}/" class="cat">${c.name}</a>`
        ).join('');

        const seoSections = config.seo?.sections || [];
        const seoContent = page === 1 && seoSections.length > 0 ? `
<section class="seo">
${seoSections.map(s => {
            const title = s.title.replace('{siteName}', SITE_NAME).replace('{gameCount}', String(gameList.length));
            const content = s.content.replace(/{siteName}/g, SITE_NAME).replace(/{gameCount}/g, String(gameList.length));
            return `<h2>${title}</h2>\n${content.startsWith('<') ? content : `<p>${content}</p>`}`;
        }).join('\n')}
</section>` : '';

        const h1Text = (config.seo?.homepageH1 || '🎮 {siteName} - Play Free Online')
            .replace('{siteName}', SITE_NAME).replace('{gameCount}', String(gameList.length));

        const body = `
${header('/')}
${page === 1 ? `
<section class="hero">
<h1>${h1Text}</h1>
<p>${SITE_DESCRIPTION}</p>
</section>
<div class="cats">${catButtons}</div>` : `
<section class="hero" style="padding:24px 20px 16px">
<h1>All Games - Page ${page}</h1>
</section>`}
<main class="cnt">
<div class="gg">${cards}</div>
${pag}
</main>
${seoContent}
${footer()}`;

        const homepageTitleTemplate = config.seo?.homepageTitle || '{siteName} - Play {gameCount}+ Free Unblocked Games Online';
        const title = page === 1
            ? homepageTitleTemplate.replace('{siteName}', SITE_NAME).replace('{gameCount}', String(gameList.length))
            : `All Games Page ${page} - ${SITE_NAME}`;
        const desc = page === 1
            ? SITE_DESCRIPTION
            : `Browse page ${page} of our collection of ${gameList.length}+ free unblocked games. Play online instantly.`;
        const canonical = page === 1 ? SITE_URL + '/' : `${SITE_URL}/page/${page}/`;

        const jsonLd = page === 1 ? {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": SITE_NAME,
            "url": SITE_URL,
            "description": SITE_DESCRIPTION,
            "potentialAction": {
                "@type": "SearchAction",
                "target": `${SITE_URL}/search?q={search_term_string}`,
                "query-input": "required name=search_term_string"
            }
        } : null;

        const html = htmlDoc({ title, description: desc, canonical, body, jsonLd });

        if (page === 1) {
            fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), html);
        } else {
            const dir = path.join(OUTPUT_DIR, 'page', String(page));
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, 'index.html'), html);
        }
    }
    console.log(`✅ Generated ${totalPages} homepage pages`);
}

// ============================================================
// Generate individual game pages
// ============================================================
function generateGamePages() {
    let count = 0;
    for (const g of gameList) {
        const cat = categorizeGame(g);
        const ov = overrides[g.id] || {};
        const related = gameList.filter(x => x.id !== g.id).sort(() => Math.random() - 0.5).slice(0, 18);
        const relatedCards = related.map(r =>
            `<a href="/game/${r.slug}/" class="rc"><img src="${r.img}" alt="${escapeHtml(r.title)}" loading="lazy" width="120" height="120"><span>${escapeHtml(r.title)}</span></a>`
        ).join('');

        // Custom content from overrides or template defaults
        const gameH1 = ov.h1 || applyGameTemplate('h1', escapeHtml(g.title), cat.name, `Play ${escapeHtml(g.title)} Unblocked`);
        const gameIntro = ov.introText || applyGameTemplate('introText', escapeHtml(g.title), cat.name, `Play ${escapeHtml(g.title)} for free online.`);
        const gameHowTo = ov.howToPlay || applyGameTemplate('howToPlay', escapeHtml(g.title), cat.name, `Use your mouse and keyboard to control the game.`);
        const gameAbout = ov.aboutContent || applyGameTemplate('aboutContent', escapeHtml(g.title), cat.name, `${escapeHtml(g.title)} is a free online game.`);
        const howToPlayH2 = applyGameTemplate('howToPlayTitle', escapeHtml(g.title), cat.name, `How to Play ${escapeHtml(g.title)}`);
        const aboutH2 = applyGameTemplate('aboutTitle', escapeHtml(g.title), cat.name, `About ${escapeHtml(g.title)}`);

        const body = `
${header()}
<div class="gp-bar">
<a href="/">← All Games</a>
<span class="gp-title">${escapeHtml(g.title)}</span>
<a href="/category/${cat.slug}/">${cat.name}</a>
</div>
<div class="gp-wrap">
<iframe src="${g.iframe}" allowfullscreen allow="autoplay; fullscreen; gamepad" scrolling="no" title="Play ${escapeHtml(g.title)} Unblocked"></iframe>
</div>
<div class="gp-ctrl">
<button class="gp-btn" onclick="document.querySelector('.gp-wrap iframe').requestFullscreen()">⛶ Fullscreen</button>
<button class="gp-btn" onclick="var f=document.querySelector('.gp-wrap iframe');f.src=f.src">🔄 Reload</button>
<button class="gp-btn" onclick="location.href='/'">🏠 Home</button>
</div>
<section class="ginfo">
<h1>${gameH1}</h1>
<p>${gameIntro}</p>
<h2>${howToPlayH2}</h2>
<p>${gameHowTo}</p>
<h2>${aboutH2}</h2>
<p>${gameAbout}</p>
</section>
<section class="rel">
<h2>🎮 Similar Games You Might Like</h2>
<div class="rel-grid">${relatedCards}</div>
</section>
${footer()}`;

        // Custom SEO from overrides or template defaults
        const title = ov.metaTitle || applyGameTemplate('metaTitle', g.title, cat.name, `${g.title} - Play Free Unblocked | ${SITE_NAME}`);
        const desc = ov.metaDesc || applyGameTemplate('metaDesc', g.title, cat.name, `Play ${g.title} unblocked for free online.`);
        const canonical = `${SITE_URL}/game/${g.slug}/`;
        const extraKeywords = ov.keywords ? `, ${ov.keywords}` : '';

        const jsonLd = {
            "@context": "https://schema.org",
            "@type": "VideoGame",
            "name": g.title,
            "url": canonical,
            "description": desc,
            "image": g.img,
            "genre": cat.name.replace(' Games', ''),
            "gamePlatform": "Web Browser",
            "applicationCategory": "Game",
            "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
        };

        const html = htmlDoc({ title, description: desc, canonical, ogImage: g.img, body, jsonLd, extraKeywords });

        const dir = path.join(OUTPUT_DIR, 'game', g.slug);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'index.html'), html);
        count++;
    }
    console.log(`✅ Generated ${count} game pages`);
}

// ============================================================
// Generate category pages
// ============================================================
function generateCategoryPages() {
    for (const cat of CATEGORIES) {
        const catGames = gameList.filter(g => categorizeGame(g).slug === cat.slug);
        if (catGames.length === 0) continue;

        const totalPages = Math.ceil(catGames.length / GAMES_PER_PAGE);
        for (let page = 1; page <= totalPages; page++) {
            const start = (page - 1) * GAMES_PER_PAGE;
            const pageGames = catGames.slice(start, start + GAMES_PER_PAGE);
            const cards = pageGames.map(gameCard).join('');
            const baseUrl = `/category/${cat.slug}/`;
            const pag = pagination(page, totalPages, baseUrl);

            const body = `
${header()}
<section class="hero" style="padding:32px 20px 20px">
<h1>${cat.name} - Play Free Unblocked</h1>
<p>${catGames.length} free ${cat.name.toLowerCase()} to play online. No downloads required.</p>
</section>
<main class="cnt">
<div class="gg">${cards}</div>
${pag}
</main>
<section class="seo">
<h2>Free ${cat.name} Unblocked</h2>
<p>Explore our collection of ${catGames.length} free ${cat.name.toLowerCase()} that you can play directly in your browser. All games are unblocked and work at school, work, or home. New games are added regularly!</p>
</section>
${footer()}`;

            const title = page === 1
                ? `${cat.name} Unblocked - Free Online | ${SITE_NAME}`
                : `${cat.name} Page ${page} | ${SITE_NAME}`;
            const desc = `Play ${catGames.length}+ free ${cat.name.toLowerCase()} unblocked. No download needed. ${cat.name.replace(' Games', '')} games online at ${SITE_NAME}.`;
            const canonical = page === 1
                ? `${SITE_URL}${baseUrl}`
                : `${SITE_URL}${baseUrl}page/${page}/`;

            const html = htmlDoc({ title, description: desc, canonical, body });

            if (page === 1) {
                const dir = path.join(OUTPUT_DIR, 'category', cat.slug);
                fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(path.join(dir, 'index.html'), html);
            } else {
                const dir = path.join(OUTPUT_DIR, 'category', cat.slug, 'page', String(page));
                fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(path.join(dir, 'index.html'), html);
            }
        }
        console.log(`  📁 ${cat.name}: ${catGames.length} games, ${totalPages} pages`);
    }
}

// ============================================================
// Generate sitemap.xml
// ============================================================
function generateSitemap() {
    let urls = [`<url><loc>${SITE_URL}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`];

    // Category pages
    for (const cat of CATEGORIES) {
        urls.push(`<url><loc>${SITE_URL}/category/${cat.slug}/</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
    }

    // Game pages
    for (const g of gameList) {
        urls.push(`<url><loc>${SITE_URL}/game/${g.slug}/</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>`);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

    fs.writeFileSync(path.join(OUTPUT_DIR, 'sitemap.xml'), xml);
    console.log(`✅ Generated sitemap.xml (${urls.length} URLs)`);
}

// ============================================================
// Generate robots.txt
// ============================================================
function generateRobots() {
    const robots = `User-agent: *
Allow: /
Sitemap: ${SITE_URL}/sitemap.xml

User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /
`;
    fs.writeFileSync(path.join(OUTPUT_DIR, 'robots.txt'), robots);
    console.log('✅ Generated robots.txt');
}

// ============================================================
// Generate 404 page
// ============================================================
function generate404() {
    const body = `
${header()}
<section class="hero" style="padding:80px 20px">
<h1>Page Not Found</h1>
<p>The page you're looking for doesn't exist. <a href="/">Browse all games →</a></p>
</section>
${footer()}`;

    const html = htmlDoc({
        title: `Page Not Found - ${SITE_NAME}`,
        description: 'Page not found',
        canonical: SITE_URL,
        body
    });
    fs.writeFileSync(path.join(OUTPUT_DIR, '404.html'), html);
    console.log('✅ Generated 404.html');
}

// ============================================================
// Generate CNAME (optional, if using custom domain)
// ============================================================
function generateCNAME() {
    // Uncomment and change if you have a custom domain:
    // fs.writeFileSync(path.join(OUTPUT_DIR, 'CNAME'), 'yourdomain.com');
}

// ============================================================
// Build everything
// ============================================================
console.log('\n🔨 Building static site...\n');

generateHomepages();
generateGamePages();
generateCategoryPages();
generateSitemap();
generateRobots();
generate404();
generateCNAME();

// Count total files
let totalFiles = 0;
function countDir(dir) {
    for (const f of fs.readdirSync(dir)) {
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) countDir(full);
        else totalFiles++;
    }
}
countDir(OUTPUT_DIR);

console.log('\n' + '='.repeat(50));
console.log('🎉 BUILD COMPLETE!');
console.log('='.repeat(50));
console.log(`📁 Output: ${OUTPUT_DIR}`);
console.log(`📄 Total HTML files: ${totalFiles}`);
console.log(`\n📋 NEXT STEPS:`);
console.log(`1. Edit SITE_DOMAIN in build_site.js (line 14)`);
console.log(`2. Create a new GitHub repo`);
console.log(`3. cd dist && git init && git add . && git commit -m "Initial"`);
console.log(`4. git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPO.git`);
console.log(`5. git push -u origin main`);
console.log(`6. Enable GitHub Pages in repo Settings → Pages → Branch: main`);
