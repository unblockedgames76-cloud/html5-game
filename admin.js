#!/usr/bin/env node

/**
 * Admin Panel for Game Portal
 * Manage SEO, Games, Categories, and Build/Deploy
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 4000;
const ROOT = __dirname;
const CONFIG_PATH = path.join(ROOT, 'config.json');
const GAME_LIST_PATH = path.join(ROOT, 'game_list.json');

// ============================================================
// Load data
// ============================================================
function loadConfig() { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')); }
function saveConfig(config) { fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2)); }
function loadGameList() { return JSON.parse(fs.readFileSync(GAME_LIST_PATH, 'utf-8')); }
function saveGameList(list) { fs.writeFileSync(GAME_LIST_PATH, JSON.stringify(list, null, 2)); }

// ============================================================
// Admin HTML
// ============================================================
function adminHTML() {
    const config = loadConfig();
    const games = loadGameList();

return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>🎮 Admin Panel — Game Portal</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0e0e1a;--bg2:#161628;--bg3:#1e1e3a;--bg4:#282850;--ac:#7c6cf0;--acl:#a99cff;--ac2:#ff7eb3;--tx:#e8e8ff;--tx2:#8888bb;--ok:#4ade80;--warn:#fbbf24;--err:#f87171;--bd:rgba(120,100,240,.12);--r:12px}
body{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--tx);display:flex;min-height:100vh}

/* Sidebar */
.side{width:240px;background:var(--bg2);border-right:1px solid var(--bd);padding:20px 0;flex-shrink:0;position:fixed;top:0;bottom:0;overflow-y:auto;z-index:50}
.side .logo{padding:0 20px 24px;font-size:1.1rem;font-weight:800;background:linear-gradient(135deg,var(--acl),var(--ac2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;display:flex;align-items:center;gap:8px}
.side .logo span{font-size:1.4rem}
.side a{display:flex;align-items:center;gap:10px;padding:10px 20px;color:var(--tx2);text-decoration:none;font-size:.88rem;font-weight:600;border-left:3px solid transparent;transition:all .2s}
.side a:hover{background:var(--bg3);color:var(--tx)}
.side a.ac{background:rgba(120,100,240,.08);color:var(--acl);border-left-color:var(--ac)}
.side .sep{height:1px;background:var(--bd);margin:12px 20px}

/* Main */
.main{margin-left:240px;flex:1;min-height:100vh}
.topbar{padding:16px 32px;border-bottom:1px solid var(--bd);background:rgba(14,14,26,.8);backdrop-filter:blur(8px);position:sticky;top:0;z-index:40;display:flex;align-items:center;justify-content:space-between}
.topbar h2{font-size:1.15rem;font-weight:700}
.topbar .actions{display:flex;gap:8px}
.content{padding:24px 32px}

/* Cards */
.card{background:var(--bg2);border:1px solid var(--bd);border-radius:var(--r);padding:24px;margin-bottom:20px}
.card h3{font-size:.95rem;font-weight:700;margin-bottom:16px;color:var(--acl);display:flex;align-items:center;gap:8px}
.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;margin-bottom:20px}

/* Stats */
.stat{background:var(--bg3);border-radius:var(--r);padding:20px;text-align:center;border:1px solid var(--bd)}
.stat .num{font-size:2rem;font-weight:800;background:linear-gradient(135deg,var(--acl),var(--ac2));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.stat .label{font-size:.8rem;color:var(--tx2);margin-top:4px;font-weight:600}

/* Forms */
.form-group{margin-bottom:16px}
.form-group label{display:block;font-size:.82rem;font-weight:600;color:var(--tx2);margin-bottom:6px}
.form-group input,.form-group textarea,.form-group select{width:100%;padding:10px 14px;background:var(--bg3);border:1px solid var(--bd);border-radius:8px;color:var(--tx);font-size:.88rem;font-family:inherit;outline:none;transition:border .2s}
.form-group input:focus,.form-group textarea:focus{border-color:var(--ac)}
.form-group textarea{min-height:80px;resize:vertical}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.form-row-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}

/* Buttons */
.btn{padding:8px 18px;border-radius:8px;border:none;font-size:.85rem;font-weight:600;font-family:inherit;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:6px}
.btn-primary{background:linear-gradient(135deg,var(--ac),#6250e0);color:#fff}
.btn-primary:hover{opacity:.9;transform:translateY(-1px)}
.btn-success{background:var(--ok);color:#000}
.btn-success:hover{opacity:.9}
.btn-danger{background:var(--err);color:#fff}
.btn-danger:hover{opacity:.9}
.btn-outline{background:transparent;border:1px solid var(--bd);color:var(--tx2)}
.btn-outline:hover{border-color:var(--ac);color:var(--acl)}
.btn-sm{padding:5px 12px;font-size:.78rem}

/* Table */
.tbl{width:100%;border-collapse:collapse}
.tbl th{text-align:left;padding:10px 14px;font-size:.78rem;color:var(--tx2);font-weight:600;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid var(--bd);background:var(--bg3)}
.tbl td{padding:10px 14px;font-size:.85rem;border-bottom:1px solid rgba(120,100,240,.06)}
.tbl tr:hover td{background:rgba(120,100,240,.03)}
.tbl .thumb{width:40px;height:40px;border-radius:8px;object-fit:cover;background:var(--bg3)}

/* Tags */
.tag{display:inline-block;padding:3px 10px;border-radius:12px;font-size:.72rem;font-weight:600;margin:2px;background:var(--bg4);color:var(--tx2)}
.tag-action{background:rgba(248,113,113,.15);color:var(--err)}
.tag-puzzle{background:rgba(251,191,36,.15);color:var(--warn)}
.tag-racing{background:rgba(74,222,128,.15);color:var(--ok)}
.tag-cooking{background:rgba(255,126,179,.15);color:var(--ac2)}

/* Search */
.search-box{position:relative;margin-bottom:16px}
.search-box input{width:100%;padding:10px 14px 10px 38px;background:var(--bg3);border:1px solid var(--bd);border-radius:8px;color:var(--tx);font-size:.88rem;font-family:inherit;outline:none}
.search-box input:focus{border-color:var(--ac)}
.search-box::before{content:'🔍';position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:.8rem}

/* Toast */
.toast{position:fixed;bottom:24px;right:24px;padding:12px 24px;border-radius:10px;background:var(--ok);color:#000;font-weight:600;font-size:.88rem;z-index:999;transform:translateY(100px);opacity:0;transition:all .4s cubic-bezier(.4,0,.2,1)}
.toast.show{transform:translateY(0);opacity:1}
.toast.error{background:var(--err);color:#fff}

/* Tab */
.tab-bar{display:flex;gap:4px;margin-bottom:20px;border-bottom:1px solid var(--bd);padding-bottom:0}
.tab-btn{padding:10px 18px;font-size:.85rem;font-weight:600;color:var(--tx2);background:transparent;border:none;border-bottom:2px solid transparent;cursor:pointer;font-family:inherit;transition:all .2s}
.tab-btn:hover{color:var(--tx)}
.tab-btn.ac{color:var(--acl);border-bottom-color:var(--ac)}
.tab-content{display:none}
.tab-content.ac{display:block}

/* Section editor */
.sec-item{background:var(--bg3);border:1px solid var(--bd);border-radius:8px;padding:16px;margin-bottom:12px;position:relative}
.sec-item .sec-delete{position:absolute;top:12px;right:12px}

/* Badge */
.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:.7rem;font-weight:700}
.badge-on{background:rgba(74,222,128,.15);color:var(--ok)}
.badge-off{background:rgba(248,113,113,.15);color:var(--err)}

/* Log */
.log{background:#0a0a14;border:1px solid var(--bd);border-radius:8px;padding:16px;font-family:'SF Mono',monospace;font-size:.8rem;color:var(--ok);max-height:400px;overflow-y:auto;white-space:pre-wrap;line-height:1.6}

/* Pagination */
.pagi{display:flex;align-items:center;gap:8px;margin:16px 0}
.pagi span{font-size:.82rem;color:var(--tx2)}

/* Full-page modal editor */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:200;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)}
.modal-edit{background:var(--bg);border:1px solid var(--bd);border-radius:16px;width:900px;max-width:95vw;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.5)}
.modal-header{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:1px solid var(--bd);background:var(--bg2);flex-shrink:0}
.modal-header h3{font-size:1rem;font-weight:700;display:flex;align-items:center;gap:10px}
.modal-header .game-thumb{width:36px;height:36px;border-radius:8px;object-fit:cover}
.modal-tabs{display:flex;gap:0;border-bottom:1px solid var(--bd);background:var(--bg2);flex-shrink:0}
.modal-tab{padding:10px 20px;font-size:.83rem;font-weight:600;color:var(--tx2);background:transparent;border:none;border-bottom:2px solid transparent;cursor:pointer;font-family:inherit;transition:all .2s}
.modal-tab:hover{color:var(--tx);background:rgba(120,100,240,.04)}
.modal-tab.ac{color:var(--acl);border-bottom-color:var(--ac);background:rgba(120,100,240,.06)}
.modal-body{flex:1;overflow-y:auto;padding:20px 24px}
.modal-footer{display:flex;align-items:center;justify-content:space-between;padding:14px 24px;border-top:1px solid var(--bd);background:var(--bg2);flex-shrink:0}
.mtab-content{display:none}
.mtab-content.ac{display:block}
.field-hint{font-size:.75rem;color:var(--tx2);margin-top:4px;font-style:italic}
.preview-frame{background:var(--bg3);border:1px solid var(--bd);border-radius:8px;padding:20px;margin-top:12px}
.preview-frame h1{font-size:1.3rem;color:var(--acl);margin-bottom:8px}
.preview-frame h2{font-size:1rem;color:var(--acl);margin:16px 0 6px}
.preview-frame p{color:var(--tx2);font-size:.88rem;line-height:1.6;margin-bottom:8px}
.preview-meta{background:var(--bg);border:1px solid var(--bd);border-radius:8px;padding:12px;margin-bottom:12px}
.preview-meta .pm-title{color:var(--acl);font-size:1rem;font-weight:600;margin-bottom:2px}
.preview-meta .pm-url{color:var(--ok);font-size:.78rem;margin-bottom:2px}
.preview-meta .pm-desc{color:var(--tx2);font-size:.82rem}
.custom-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--ac);margin-right:4px;vertical-align:middle}

@media(max-width:900px){.side{width:60px}.side a span,.side .logo em{display:none}.main{margin-left:60px}.modal-edit{width:100%;max-width:100vw;max-height:100vh;border-radius:0}}
</style>
</head>
<body>

<!-- Sidebar -->
<nav class="side">
<div class="logo"><span>🎮</span><em>Admin Panel</em></div>
<a href="#" class="ac" onclick="showPage('dashboard')"><span>📊</span><em>Dashboard</em></a>
<a href="#" onclick="showPage('settings')"><span>⚙️</span><em>Site Settings</em></a>
<a href="#" onclick="showPage('seo')"><span>🔍</span><em>SEO Content</em></a>
<div class="sep"></div>
<a href="#" onclick="showPage('games')"><span>🎮</span><em>Games (${games.length})</em></a>
<a href="#" onclick="showPage('categories')"><span>📁</span><em>Categories</em></a>
<div class="sep"></div>
<a href="#" onclick="showPage('build')"><span>🚀</span><em>Build & Deploy</em></a>
<a href="http://localhost:3000" target="_blank"><span>🌐</span><em>View Site</em></a>
</nav>

<!-- Main Content -->
<div class="main">

<!-- DASHBOARD -->
<div id="page-dashboard" class="page-content">
<div class="topbar"><h2>📊 Dashboard</h2></div>
<div class="content">
<div class="card-grid">
<div class="stat"><div class="num">${games.length}</div><div class="label">Total Games</div></div>
<div class="stat"><div class="num">${config.categories.length}</div><div class="label">Categories</div></div>
<div class="stat"><div class="num">${config.seo.sections.length}</div><div class="label">SEO Sections</div></div>
<div class="stat"><div class="num">${fs.existsSync(path.join(ROOT,'dist')) ? '✅' : '❌'}</div><div class="label">Site Built</div></div>
</div>
<div class="card">
<h3>🎯 Quick Actions</h3>
<button class="btn btn-primary" onclick="showPage('settings')">⚙️ Edit Settings</button>
<button class="btn btn-primary" onclick="showPage('games')" style="margin-left:8px">🎮 Manage Games</button>
<button class="btn btn-success" onclick="buildSite()" style="margin-left:8px">🔨 Build Site</button>
</div>
<div class="card">
<h3>📁 Category Overview</h3>
<div id="cat-overview"></div>
</div>
</div></div>

<!-- SETTINGS -->
<div id="page-settings" class="page-content" style="display:none">
<div class="topbar"><h2>⚙️ Site Settings</h2><div class="actions"><button class="btn btn-primary" onclick="saveSettings()">💾 Save Settings</button></div></div>
<div class="content">
<div class="card">
<h3>🌐 Basic Settings</h3>
<div class="form-row">
<div class="form-group"><label>Site Name</label><input id="s-name" value="${escapeAttr(config.site.name)}"></div>
<div class="form-group"><label>Domain (GitHub Pages)</label><input id="s-domain" value="${escapeAttr(config.site.domain)}" placeholder="username.github.io"></div>
</div>
<div class="form-group"><label>Site Description</label><textarea id="s-desc">${escapeAttr(config.site.description)}</textarea></div>
<div class="form-group"><label>SEO Keywords (comma separated)</label><textarea id="s-keywords">${escapeAttr(config.site.keywords)}</textarea></div>
<div class="form-row">
<div class="form-group"><label>Games Per Page</label><input type="number" id="s-perpage" value="${config.site.gamesPerPage}"></div>
<div class="form-group"><label>Google Analytics ID (optional)</label><input id="s-ga" value="${escapeAttr(config.site.googleAnalytics || '')}" placeholder="G-XXXXXXX"></div>
</div>
<div class="form-group"><label>Footer Text</label><input id="s-footer" value="${escapeAttr(config.site.footer)}"></div>
<div class="form-group"><label>Custom Domain (optional, leave empty for GitHub Pages default)</label><input id="s-custom-domain" value="${escapeAttr(config.site.customDomain || '')}" placeholder="yourdomain.com"></div>
</div>
</div></div>

<!-- SEO CONTENT -->
<div id="page-seo" class="page-content" style="display:none">
<div class="topbar"><h2>🔍 SEO Content</h2><div class="actions"><button class="btn btn-primary" onclick="saveSEO()">💾 Save SEO</button></div></div>
<div class="content">
<div class="card">
<h3>📝 Homepage SEO</h3>
<div class="form-group"><label>Homepage Title (use {siteName}, {gameCount} as placeholders)</label><input id="seo-title" value="${escapeAttr(config.seo.homepageTitle)}"></div>
<div class="form-group"><label>Homepage H1 Heading</label><input id="seo-h1" value="${escapeAttr(config.seo.homepageH1)}"></div>
</div>
<div class="card">
<h3>📄 Content Sections (displayed on homepage)</h3>
<div id="seo-sections"></div>
<button class="btn btn-outline" onclick="addSEOSection()">+ Add Section</button>
</div>
<div class="card">
<h3>🎮 Game Page Templates (default content for all games)</h3>
<p style="color:var(--tx2);font-size:.82rem;margin-bottom:16px">Use placeholders: <code style="color:var(--acl)">{title}</code> = game name, <code style="color:var(--acl)">{category}</code> = category name, <code style="color:var(--acl)">{categoryLower}</code> = category lowercase, <code style="color:var(--acl)">{siteName}</code> = site name, <code style="color:var(--acl)">{gameCount}</code> = total games</p>
<div class="form-group"><label>Meta Title Template (browser tab & Google title)</label><input id="gt-metaTitle" value="${escapeAttr((config.gameTemplates||{}).metaTitle||'')}"></div>
<div class="form-group"><label>Meta Description Template (Google snippet)</label><textarea id="gt-metaDesc" rows="2">${escapeAttr((config.gameTemplates||{}).metaDesc||'')}</textarea></div>
<div class="form-group"><label>H1 Heading Template</label><input id="gt-h1" value="${escapeAttr((config.gameTemplates||{}).h1||'')}"></div>
<div class="form-group"><label>Introduction Paragraph Template</label><textarea id="gt-intro" rows="3">${escapeAttr((config.gameTemplates||{}).introText||'')}</textarea></div>
<div class="form-group"><label>How to Play Section Title Template</label><input id="gt-howTitle" value="${escapeAttr((config.gameTemplates||{}).howToPlayTitle||'')}"></div>
<div class="form-group"><label>How to Play Content Template</label><textarea id="gt-howTo" rows="3">${escapeAttr((config.gameTemplates||{}).howToPlay||'')}</textarea></div>
<div class="form-group"><label>About Section Title Template</label><input id="gt-aboutTitle" value="${escapeAttr((config.gameTemplates||{}).aboutTitle||'')}"></div>
<div class="form-group"><label>About Content Template</label><textarea id="gt-about" rows="3">${escapeAttr((config.gameTemplates||{}).aboutContent||'')}</textarea></div>
<div style="margin-top:12px;padding:12px;background:var(--bg3);border:1px solid var(--bd);border-radius:8px">
<strong style="font-size:.82rem">📌 Preview with example game "Zooplop" (Puzzle):</strong>
<div id="gt-preview" style="font-size:.82rem;color:var(--tx2);margin-top:8px"></div>
</div>
</div>
</div></div>

<!-- GAMES -->
<div id="page-games" class="page-content" style="display:none">
<div class="topbar"><h2>🎮 Games Manager</h2><div class="actions">
<button class="btn btn-outline btn-sm" onclick="exportGames()">📥 Export</button>
</div></div>
<div class="content">
<div class="search-box"><input id="game-search" placeholder="Search games by title or ID..." oninput="filterGames()"></div>
<div class="pagi"><span>Showing <strong id="game-count">0</strong> games</span>
<select id="game-cat-filter" onchange="filterGames()" style="margin-left:12px;padding:6px 12px;background:var(--bg3);border:1px solid var(--bd);border-radius:6px;color:var(--tx);font-size:.82rem">
<option value="">All Categories</option>
${config.categories.map(c => `<option value="${c.slug}">${c.name}</option>`).join('')}
<option value="other">Other / Uncategorized</option>
</select>
<select id="game-status-filter" onchange="filterGames()" style="margin-left:8px;padding:6px 12px;background:var(--bg3);border:1px solid var(--bd);border-radius:6px;color:var(--tx);font-size:.82rem">
<option value="">All Status</option>
<option value="active">Active</option>
<option value="disabled">Disabled</option>
</select>
</div>
<div class="card" style="padding:0;overflow:hidden">
<table class="tbl">
<thead><tr><th style="width:40px"></th><th>Title</th><th>ID</th><th>Category</th><th>Status</th><th>Actions</th></tr></thead>
<tbody id="games-tbody"></tbody>
</table>
</div>
<div class="pagi" id="games-pagination"></div>
</div></div>

<!-- CATEGORIES -->
<div id="page-categories" class="page-content" style="display:none">
<div class="topbar"><h2>📁 Categories</h2><div class="actions"><button class="btn btn-primary" onclick="saveCategories()">💾 Save</button></div></div>
<div class="content">
<div id="cats-list"></div>
<button class="btn btn-outline" onclick="addCategory()" style="margin-top:12px">+ Add Category</button>
</div></div>

<!-- BUILD -->
<div id="page-build" class="page-content" style="display:none">
<div class="topbar"><h2>🚀 Build & Deploy</h2></div>
<div class="content">
<div class="card">
<h3>🔨 Build Static Site</h3>
<p style="color:var(--tx2);font-size:.85rem;margin-bottom:16px">Generate all HTML pages, sitemap, and robots.txt from current configuration.</p>
<button class="btn btn-success" onclick="buildSite()" id="build-btn">🔨 Build Now</button>
<div id="build-log" class="log" style="margin-top:16px;display:none"></div>
</div>
<div class="card">
<h3>📤 Deploy to GitHub</h3>
<p style="color:var(--tx2);font-size:.85rem;margin-bottom:16px">After building, follow these steps:</p>
<ol style="color:var(--tx2);font-size:.85rem;padding-left:20px;line-height:2">
<li>Build the site (↑ button above)</li>
<li>Open terminal: <code style="background:var(--bg3);padding:2px 8px;border-radius:4px">cd dist</code></li>
<li>Initialize git: <code style="background:var(--bg3);padding:2px 8px;border-radius:4px">git init && git add . && git commit -m "Deploy"</code></li>
<li>Push to GitHub: <code style="background:var(--bg3);padding:2px 8px;border-radius:4px">git push -f origin main</code></li>
<li>Enable GitHub Pages in repo Settings</li>
</ol>
</div>
</div></div>

</div>

<div class="toast" id="toast"></div>

<script>
// ============================================================
// DATA
// ============================================================
let allGames = ${JSON.stringify(games)};
let config = ${JSON.stringify(config)};
let gamesPage = 1;
const GAMES_PER_TABLE = 20;

// ============================================================
// NAV
// ============================================================
function showPage(name) {
    document.querySelectorAll('.page-content').forEach(p => p.style.display = 'none');
    document.getElementById('page-'+name).style.display = '';
    document.querySelectorAll('.side a').forEach(a => a.classList.remove('ac'));
    event.target.closest('a')?.classList.add('ac');
    if (name === 'games') { gamesPage = 1; renderGames(); }
    if (name === 'categories') renderCategories();
    if (name === 'seo') renderSEOSections();
    if (name === 'dashboard') renderDashboard();
}

// ============================================================
// TOAST
// ============================================================
function toast(msg, isError) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show' + (isError ? ' error' : '');
    setTimeout(() => t.className = 'toast', 3000);
}

// ============================================================
// API calls
// ============================================================
async function api(endpoint, method='GET', body=null) {
    const opts = { method, headers: {'Content-Type':'application/json'} };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch('/api/'+endpoint, opts);
    return res.json();
}

// ============================================================
// DASHBOARD
// ============================================================
function categorizeGame(g) {
    const title = g.title.toLowerCase();
    for (const cat of config.categories) {
        if (cat.keywords.some(k => title.includes(k))) return cat.slug;
    }
    // Check overrides
    const ov = config.gameOverrides[g.id];
    if (ov && ov.category) return ov.category;
    return 'other';
}

function renderDashboard() {
    const counts = {};
    config.categories.forEach(c => counts[c.slug] = 0);
    counts['other'] = 0;
    allGames.forEach(g => {
        const cat = categorizeGame(g);
        counts[cat] = (counts[cat]||0) + 1;
    });
    let html = '<div style="display:flex;flex-wrap:wrap;gap:8px">';
    config.categories.forEach(c => {
        html += '<div class="tag" style="font-size:.82rem;padding:6px 14px">' + c.name + ': <strong>' + (counts[c.slug]||0) + '</strong></div>';
    });
    html += '<div class="tag" style="font-size:.82rem;padding:6px 14px">Other: <strong>' + (counts['other']||0) + '</strong></div>';
    html += '</div>';
    document.getElementById('cat-overview').innerHTML = html;
}

// ============================================================
// SETTINGS
// ============================================================
async function saveSettings() {
    config.site.name = document.getElementById('s-name').value;
    config.site.domain = document.getElementById('s-domain').value;
    config.site.description = document.getElementById('s-desc').value;
    config.site.keywords = document.getElementById('s-keywords').value;
    config.site.gamesPerPage = parseInt(document.getElementById('s-perpage').value) || 48;
    config.site.googleAnalytics = document.getElementById('s-ga').value;
    config.site.footer = document.getElementById('s-footer').value;
    config.site.customDomain = document.getElementById('s-custom-domain').value;
    const res = await api('config', 'POST', config);
    toast(res.ok ? '✅ Settings saved!' : '❌ Error saving');
}

// ============================================================
// SEO
// ============================================================
// Template helper: replace placeholders in a template string
function applyTemplate(tpl, vars) {
    if (!tpl) return '';
    return tpl.replace(/[{]([a-zA-Z0-9_]+)[}]/g, (m, key) => vars[key] !== undefined ? vars[key] : m);
}

function getTemplateVars(gameName, catName) {
    return {
        title: gameName,
        category: catName,
        categoryLower: catName.toLowerCase().replace(' games', ''),
        siteName: config.site.name,
        gameCount: String(allGames.length)
    };
}

function getDefaultFromTemplate(field, gameName, catName) {
    const tpl = (config.gameTemplates || {})[field] || '';
    if (!tpl) return '';
    return applyTemplate(tpl, getTemplateVars(gameName, catName));
}

function renderSEOSections() {
    const container = document.getElementById('seo-sections');
    let html = '';
    config.seo.sections.forEach((sec, i) => {
        html += '<div class="sec-item">' +
            '<button class="btn btn-danger btn-sm sec-delete" onclick="removeSEOSection('+i+')">✕</button>' +
            '<div class="form-group"><label>Section Title</label><input class="seo-sec-title" value="'+escapeAttr(sec.title)+'"></div>' +
            '<div class="form-group"><label>Content (HTML allowed)</label><textarea class="seo-sec-content" rows="4">'+escapeAttr(sec.content)+'</textarea></div>' +
            '</div>';
    });
    container.innerHTML = html;
    previewGameTemplates();
}

function addSEOSection() {
    config.seo.sections.push({ title: 'New Section', content: 'Enter content here...' });
    renderSEOSections();
}

function removeSEOSection(i) {
    config.seo.sections.splice(i, 1);
    renderSEOSections();
}

function previewGameTemplates() {
    const el = document.getElementById('gt-preview');
    if (!el) return;
    const vars = {
        title: 'Zooplop',
        category: 'Puzzle Games',
        categoryLower: 'puzzle',
        siteName: config.site.name,
        gameCount: String(allGames.length)
    };
    const mt = applyTemplate(document.getElementById('gt-metaTitle')?.value || '', vars);
    const md = applyTemplate(document.getElementById('gt-metaDesc')?.value || '', vars);
    const h1 = applyTemplate(document.getElementById('gt-h1')?.value || '', vars);
    const intro = applyTemplate(document.getElementById('gt-intro')?.value || '', vars);
    const htTitle = applyTemplate(document.getElementById('gt-howTitle')?.value || '', vars);
    const ht = applyTemplate(document.getElementById('gt-howTo')?.value || '', vars);
    const abTitle = applyTemplate(document.getElementById('gt-aboutTitle')?.value || '', vars);
    const ab = applyTemplate(document.getElementById('gt-about')?.value || '', vars);

    el.innerHTML = '<strong>Title:</strong> ' + escapeAttr(mt) + '<br>' +
        '<strong>Description:</strong> ' + escapeAttr(md) + '<br>' +
        '<strong>H1:</strong> ' + escapeAttr(h1) + '<br>' +
        '<strong>Intro:</strong> ' + escapeAttr(intro) + '<br>' +
        '<strong>' + escapeAttr(htTitle) + ':</strong> ' + escapeAttr(ht) + '<br>' +
        '<strong>' + escapeAttr(abTitle) + ':</strong> ' + escapeAttr(ab);
}

// Attach live preview to template fields
setTimeout(() => {
    ['gt-metaTitle','gt-metaDesc','gt-h1','gt-intro','gt-howTitle','gt-howTo','gt-aboutTitle','gt-about'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', previewGameTemplates);
    });
    previewGameTemplates();
}, 500);

async function saveSEO() {
    config.seo.homepageTitle = document.getElementById('seo-title').value;
    config.seo.homepageH1 = document.getElementById('seo-h1').value;
    const titles = document.querySelectorAll('.seo-sec-title');
    const contents = document.querySelectorAll('.seo-sec-content');
    config.seo.sections = [];
    titles.forEach((t, i) => {
        config.seo.sections.push({ title: t.value, content: contents[i].value });
    });

    // Save game templates
    if (!config.gameTemplates) config.gameTemplates = {};
    config.gameTemplates.metaTitle = document.getElementById('gt-metaTitle').value;
    config.gameTemplates.metaDesc = document.getElementById('gt-metaDesc').value;
    config.gameTemplates.h1 = document.getElementById('gt-h1').value;
    config.gameTemplates.introText = document.getElementById('gt-intro').value;
    config.gameTemplates.howToPlayTitle = document.getElementById('gt-howTitle').value;
    config.gameTemplates.howToPlay = document.getElementById('gt-howTo').value;
    config.gameTemplates.aboutTitle = document.getElementById('gt-aboutTitle').value;
    config.gameTemplates.aboutContent = document.getElementById('gt-about').value;

    const res = await api('config', 'POST', config);
    toast(res.ok ? '✅ SEO content & templates saved!' : '❌ Error saving');
}

// ============================================================
// GAMES
// ============================================================
function filterGames() {
    gamesPage = 1;
    renderGames();
}

function renderGames() {
    const query = (document.getElementById('game-search')?.value || '').toLowerCase();
    const catFilter = document.getElementById('game-cat-filter')?.value || '';
    const statusFilter = document.getElementById('game-status-filter')?.value || '';

    let filtered = allGames.filter(g => {
        if (query && !g.title.toLowerCase().includes(query) && !g.id.includes(query)) return false;
        if (catFilter) {
            const gameCat = categorizeGame(g);
            if (catFilter !== gameCat) return false;
        }
        if (statusFilter) {
            const ov = config.gameOverrides[g.id];
            const isDisabled = ov && ov.disabled;
            if (statusFilter === 'active' && isDisabled) return false;
            if (statusFilter === 'disabled' && !isDisabled) return false;
        }
        return true;
    });

    document.getElementById('game-count').textContent = filtered.length;

    const totalPages = Math.ceil(filtered.length / GAMES_PER_TABLE) || 1;
    gamesPage = Math.min(gamesPage, totalPages);
    const start = (gamesPage - 1) * GAMES_PER_TABLE;
    const pageGames = filtered.slice(start, start + GAMES_PER_TABLE);

    let html = '';
    pageGames.forEach(g => {
        const ov = config.gameOverrides[g.id] || {};
        const cat = ov.category || categorizeGame(g);
        const catName = config.categories.find(c => c.slug === cat)?.name || 'Other';
        const disabled = ov.disabled;
        const customTitle = ov.title || '';
        const hasCustom = ov.title || ov.description || ov.metaTitle || ov.h1 || ov.howToPlay || ov.aboutContent;

        html += '<tr>' +
            '<td><img class="thumb" src="'+g.img+'" alt="" onerror="this.style.display=\\'none\\'"></td>' +
            '<td><strong>'+(customTitle || g.title)+'</strong>' + (hasCustom ? ' <span class="custom-dot" title="Customized"></span>':'') + (customTitle ? '<br><small style="color:var(--tx2)">Original: '+g.title+'</small>':'') + '</td>' +
            '<td style="color:var(--tx2);font-size:.8rem">'+g.id+'</td>' +
            '<td><span class="tag">'+catName+'</span></td>' +
            '<td><span class="badge '+(disabled?'badge-off':'badge-on')+'">'+(disabled?'Disabled':'Active')+'</span></td>' +
            '<td>' +
            '<button class="btn btn-primary btn-sm" onclick="editGame(\\''+g.id+'\\')">✏️ Edit</button> ' +
            '<button class="btn btn-outline btn-sm" onclick="toggleGame(\\''+g.id+'\\')">'+( disabled?'✅':'🚫')+'</button>' +
            '</td></tr>';
    });
    document.getElementById('games-tbody').innerHTML = html;

    // Pagination
    let pagHtml = '<span>Page '+gamesPage+' / '+totalPages+'</span> ';
    if (gamesPage > 1) pagHtml += '<button class="btn btn-outline btn-sm" onclick="gamesPage--;renderGames()">← Prev</button> ';
    if (gamesPage < totalPages) pagHtml += '<button class="btn btn-outline btn-sm" onclick="gamesPage++;renderGames()">Next →</button>';
    document.getElementById('games-pagination').innerHTML = pagHtml;
}

function editGame(id) {
    const g = allGames.find(x => x.id === id);
    const ov = config.gameOverrides[id] || {};
    const currentTitle = ov.title || g.title;
    const currentCat = ov.category || categorizeGame(g);
    const catName = config.categories.find(c => c.slug === currentCat)?.name || 'Other';

    // All editable fields with defaults
    const fields = {
        title: ov.title || '',
        category: currentCat,
        description: ov.description || '',
        metaTitle: ov.metaTitle || '',
        metaDesc: ov.metaDesc || '',
        keywords: ov.keywords || '',
        h1: ov.h1 || '',
        introText: ov.introText || '',
        howToPlay: ov.howToPlay || '',
        aboutContent: ov.aboutContent || '',
    };

    // Default generated values from templates
    const defTitle = getDefaultFromTemplate('metaTitle', g.title, catName) || (g.title + ' - Play Free Unblocked | ' + config.site.name);
    const defDesc = getDefaultFromTemplate('metaDesc', g.title, catName) || ('Play ' + g.title + ' unblocked for free online.');
    const defH1 = getDefaultFromTemplate('h1', g.title, catName) || ('Play ' + g.title + ' Unblocked');
    const defIntro = getDefaultFromTemplate('introText', g.title, catName) || ('Play ' + g.title + ' for free online.');
    const defHowTo = getDefaultFromTemplate('howToPlay', g.title, catName) || 'Use your mouse and keyboard to control the game.';
    const defAbout = getDefaultFromTemplate('aboutContent', g.title, catName) || (g.title + ' is a free online game.');

    let catOpts = config.categories.map(c =>
        '<option value="'+c.slug+'"'+(c.slug===currentCat?' selected':'')+'>'+c.name+'</option>'
    ).join('') + '<option value="other"'+('other'===currentCat?' selected':'')+'>Other</option>';

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'game-editor-modal';
    modal.innerHTML = '<div class="modal-edit">' +
      '<div class="modal-header">' +
        '<h3><img class="game-thumb" src="'+g.img+'" onerror="this.style.display=\\'none\\'"> '+escapeAttr(g.title)+' <span style="color:var(--tx2);font-size:.8rem;font-weight:400">'+g.id+'</span></h3>' +
        '<button class="btn btn-outline btn-sm" onclick="closeEditor()">✕ Close</button>' +
      '</div>' +
      '<div class="modal-tabs">' +
        '<button class="modal-tab ac" onclick="switchEditorTab(this,\\'tab-basic\\')">📋 Basic Info</button>' +
        '<button class="modal-tab" onclick="switchEditorTab(this,\\'tab-seo\\')">🔍 SEO Meta</button>' +
        '<button class="modal-tab" onclick="switchEditorTab(this,\\'tab-content\\')">📝 Page Content</button>' +
        '<button class="modal-tab" onclick="switchEditorTab(this,\\'tab-preview\\')">👁️ Preview</button>' +
      '</div>' +
      '<div class="modal-body">' +

        '<div id="tab-basic" class="mtab-content ac">' +
          '<div class="form-row">' +
            '<div class="form-group"><label>Custom Title</label>' +
              '<input id="eg-title" value="'+escapeAttr(fields.title)+'" placeholder="'+escapeAttr(g.title)+'">' +
              '<div class="field-hint">Leave empty to use original: "'+escapeAttr(g.title)+'"</div></div>' +
            '<div class="form-group"><label>Category</label>' +
              '<select id="eg-cat">'+catOpts+'</select>' +
              '<div class="field-hint">Auto-detected: '+catName+'</div></div>' +
          '</div>' +
          '<div class="form-group"><label>Short Description</label>' +
            '<textarea id="eg-desc" rows="2" placeholder="Brief description...">'+escapeAttr(fields.description)+'</textarea></div>' +
          '<div class="form-group"><label>Original iframe Source</label>' +
            '<input value="'+escapeAttr(g.iframe)+'" readonly style="opacity:.6;cursor:default"></div>' +
        '</div>' +

        '<div id="tab-seo" class="mtab-content">' +
          '<div class="form-group"><label>Meta Title (browser tab & Google title)</label>' +
            '<input id="eg-metaTitle" value="'+escapeAttr(fields.metaTitle)+'" placeholder="'+escapeAttr(defTitle)+'">' +
            '<div class="field-hint">Default: '+escapeAttr(defTitle)+'</div></div>' +
          '<div class="form-group"><label>Meta Description (Google snippet)</label>' +
            '<textarea id="eg-metaDesc" rows="3" placeholder="'+escapeAttr(defDesc)+'">'+escapeAttr(fields.metaDesc)+'</textarea>' +
            '<div class="field-hint">Default: '+escapeAttr(defDesc)+'</div></div>' +
          '<div class="form-group"><label>Extra Keywords (comma separated)</label>' +
            '<input id="eg-keywords" value="'+escapeAttr(fields.keywords)+'" placeholder="'+escapeAttr(g.title.toLowerCase())+', '+escapeAttr(g.title.toLowerCase())+' unblocked">' +
            '<div class="field-hint">Example: game name, game name unblocked</div></div>' +
        '</div>' +

        '<div id="tab-content" class="mtab-content">' +
          '<div class="form-group"><label>H1 Heading (main title on page)</label>' +
            '<input id="eg-h1" value="'+escapeAttr(fields.h1)+'" placeholder="'+escapeAttr(defH1)+'">' +
            '<div class="field-hint">Default: '+escapeAttr(defH1)+'</div></div>' +
          '<div class="form-group"><label>Introduction Paragraph</label>' +
            '<textarea id="eg-intro" rows="3" placeholder="'+escapeAttr(defIntro)+'">'+escapeAttr(fields.introText)+'</textarea>' +
            '<div class="field-hint">Shown right below the game. Default: auto-generated.</div></div>' +
          '<div class="form-group"><label>How to Play Section</label>' +
            '<textarea id="eg-howto" rows="4" placeholder="'+escapeAttr(defHowTo)+'">'+escapeAttr(fields.howToPlay)+'</textarea>' +
            '<div class="field-hint">Instructions for this game. HTML allowed.</div></div>' +
          '<div class="form-group"><label>About This Game Section</label>' +
            '<textarea id="eg-about" rows="4" placeholder="'+escapeAttr(defAbout)+'">'+escapeAttr(fields.aboutContent)+'</textarea>' +
            '<div class="field-hint">Additional info. HTML allowed.</div></div>' +
        '</div>' +

        '<div id="tab-preview" class="mtab-content">' +
          '<p style="color:var(--tx2);font-size:.82rem;margin-bottom:12px">Custom values in <span style="color:var(--acl)">purple</span>, defaults in gray.</p>' +
          '<h3 style="font-size:.9rem;margin-bottom:8px">🔍 Google Search Preview</h3>' +
          '<div class="preview-meta" id="preview-google"></div>' +
          '<h3 style="font-size:.9rem;margin-bottom:8px;margin-top:20px">📄 Page Content Preview</h3>' +
          '<div class="preview-frame" id="preview-page"></div>' +
        '</div>' +

      '</div>' +
      '<div class="modal-footer">' +
        '<div style="font-size:.78rem;color:var(--tx2)">Click Save then Build to apply changes.</div>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-outline" onclick="resetGameOverride(\\''+g.id+'\\')">🔄 Reset to Default</button>' +
          '<button class="btn btn-primary" onclick="saveGameEdit(\\''+g.id+'\\')">💾 Save Changes</button>' +
        '</div>' +
      '</div>' +
    '</div>';

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeEditor(); });
    document.addEventListener('keydown', editorKeyHandler);
}

function editorKeyHandler(e) { if (e.key === 'Escape') closeEditor(); }
function closeEditor() {
    document.getElementById('game-editor-modal')?.remove();
    document.removeEventListener('keydown', editorKeyHandler);
}

function switchEditorTab(btn, tabId) {
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('ac'));
    document.querySelectorAll('.mtab-content').forEach(t => t.classList.remove('ac'));
    btn.classList.add('ac');
    document.getElementById(tabId).classList.add('ac');
    if (tabId === 'tab-preview') updatePreview();
}

function updatePreview() {
    const title = document.getElementById('eg-title')?.value || '';
    const metaTitle = document.getElementById('eg-metaTitle')?.value || '';
    const metaDesc = document.getElementById('eg-metaDesc')?.value || '';
    const h1 = document.getElementById('eg-h1')?.value || '';
    const intro = document.getElementById('eg-intro')?.value || '';
    const howto = document.getElementById('eg-howto')?.value || '';
    const about = document.getElementById('eg-about')?.value || '';

    // Find current game
    const modal = document.getElementById('game-editor-modal');
    const gameId = modal?.querySelector('.modal-footer .btn-primary')?.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
    const g = allGames.find(x => x.id === gameId);
    if (!g) return;
    const gameName = title || g.title;
    const catSlug = document.getElementById('eg-cat')?.value || 'other';
    const catObj = config.categories.find(c => c.slug === catSlug);
    const catName = catObj?.name || 'Other';

    const defMetaTitle = gameName + ' - Play Free Unblocked | ' + config.site.name;
    const defMetaDesc = 'Play ' + gameName + ' unblocked for free online. No download required.';
    const defH1 = 'Play ' + gameName + ' Unblocked';
    const defIntro = 'Play ' + gameName + ' for free online. This game is unblocked and can be played at school or work.';
    const defHowTo = 'Use your mouse and keyboard to control the game. Click the fullscreen button for the best experience.';
    const defAbout = gameName + ' is a free online ' + catName.toLowerCase().replace(' games','') + ' game.';

    const styled = (val, def) => val ? '<span style="color:var(--acl)">' + escapeAttr(val) + '</span>' : '<span style="opacity:.5">' + escapeAttr(def) + '</span>';

    document.getElementById('preview-google').innerHTML =
        '<div class="pm-title">' + styled(metaTitle, defMetaTitle) + '</div>' +
        '<div class="pm-url">' + config.site.domain + '/game/' + gameName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') + '/</div>' +
        '<div class="pm-desc">' + styled(metaDesc, defMetaDesc) + '</div>';

    document.getElementById('preview-page').innerHTML =
        '<h1>' + styled(h1, defH1) + '</h1>' +
        '<p>' + styled(intro, defIntro) + '</p>' +
        '<h2>How to Play ' + escapeAttr(gameName) + '</h2>' +
        '<p>' + styled(howto, defHowTo) + '</p>' +
        '<h2>About ' + escapeAttr(gameName) + '</h2>' +
        '<p>' + styled(about, defAbout) + '</p>';
}

async function saveGameEdit(id) {
    const g = allGames.find(x => x.id === id);
    if (!config.gameOverrides[id]) config.gameOverrides[id] = {};
    const ov = config.gameOverrides[id];

    // Basic
    const title = document.getElementById('eg-title').value.trim();
    const cat = document.getElementById('eg-cat').value;
    const desc = document.getElementById('eg-desc').value.trim();

    // SEO
    const metaTitle = document.getElementById('eg-metaTitle').value.trim();
    const metaDesc = document.getElementById('eg-metaDesc').value.trim();
    const keywords = document.getElementById('eg-keywords').value.trim();

    // Content
    const h1 = document.getElementById('eg-h1').value.trim();
    const introText = document.getElementById('eg-intro').value.trim();
    const howToPlay = document.getElementById('eg-howto').value.trim();
    const aboutContent = document.getElementById('eg-about').value.trim();

    // Save non-empty values, delete empty ones
    const setOrDelete = (key, val) => { if (val) ov[key] = val; else delete ov[key]; };
    setOrDelete('title', title && title !== g.title ? title : '');
    ov.category = cat;
    setOrDelete('description', desc);
    setOrDelete('metaTitle', metaTitle);
    setOrDelete('metaDesc', metaDesc);
    setOrDelete('keywords', keywords);
    setOrDelete('h1', h1);
    setOrDelete('introText', introText);
    setOrDelete('howToPlay', howToPlay);
    setOrDelete('aboutContent', aboutContent);

    // Clean up empty overrides
    const keys = Object.keys(ov).filter(k => k !== 'category');
    if (keys.length === 0 && ov.category === categorizeGame(g)) delete config.gameOverrides[id];

    const res = await api('config', 'POST', config);
    renderGames();
    toast(res.ok ? '✅ Game saved with all custom content!' : '❌ Error');
}

async function resetGameOverride(id) {
    if (!confirm('Reset all custom content for this game to defaults?')) return;
    delete config.gameOverrides[id];
    const res = await api('config', 'POST', config);
    closeEditor();
    renderGames();
    toast(res.ok ? '🔄 Game reset to defaults!' : '❌ Error');
}

async function toggleGame(id) {
    if (!config.gameOverrides[id]) config.gameOverrides[id] = {};
    config.gameOverrides[id].disabled = !config.gameOverrides[id].disabled;
    if (!config.gameOverrides[id].disabled) delete config.gameOverrides[id].disabled;
    if (Object.keys(config.gameOverrides[id]).length === 0) delete config.gameOverrides[id];
    const res = await api('config', 'POST', config);
    renderGames();
    toast(res.ok ? '✅ Status updated!' : '❌ Error');
}

// ============================================================
// CATEGORIES
// ============================================================
function renderCategories() {
    let html = '';
    config.categories.forEach((c, i) => {
        const count = allGames.filter(g => categorizeGame(g) === c.slug).length;
        html += '<div class="card">' +
            '<h3 style="justify-content:space-between">'+c.name+' ('+count+' games) <button class="btn btn-danger btn-sm" onclick="removeCategory('+i+')">Delete</button></h3>' +
            '<div class="form-row-3">' +
            '<div class="form-group"><label>Name</label><input class="cat-name" data-idx="'+i+'" value="'+escapeAttr(c.name)+'"></div>' +
            '<div class="form-group"><label>Slug</label><input class="cat-slug" data-idx="'+i+'" value="'+escapeAttr(c.slug)+'"></div>' +
            '<div class="form-group"><label>Description</label><input class="cat-desc" data-idx="'+i+'" value="'+escapeAttr(c.description || '')+'"></div>' +
            '</div>' +
            '<div class="form-group"><label>Keywords (comma separated — games matching these words are auto-categorized)</label>' +
            '<input class="cat-kw" data-idx="'+i+'" value="'+escapeAttr(c.keywords.join(', '))+'"></div>' +
            '</div>';
    });
    document.getElementById('cats-list').innerHTML = html;
}

function addCategory() {
    config.categories.push({ slug:'new-category', name:'New Category', keywords:['keyword1','keyword2'], description:'Description...' });
    renderCategories();
}

function removeCategory(i) {
    if (confirm('Delete "'+config.categories[i].name+'"?')) {
        config.categories.splice(i, 1);
        renderCategories();
    }
}

async function saveCategories() {
    document.querySelectorAll('.cat-name').forEach(el => {
        const i = parseInt(el.dataset.idx);
        config.categories[i].name = el.value;
    });
    document.querySelectorAll('.cat-slug').forEach(el => {
        const i = parseInt(el.dataset.idx);
        config.categories[i].slug = el.value;
    });
    document.querySelectorAll('.cat-desc').forEach(el => {
        const i = parseInt(el.dataset.idx);
        config.categories[i].description = el.value;
    });
    document.querySelectorAll('.cat-kw').forEach(el => {
        const i = parseInt(el.dataset.idx);
        config.categories[i].keywords = el.value.split(',').map(k => k.trim()).filter(Boolean);
    });
    const res = await api('config', 'POST', config);
    renderCategories();
    toast(res.ok ? '✅ Categories saved!' : '❌ Error');
}

// ============================================================
// BUILD
// ============================================================
async function buildSite() {
    const btn = document.getElementById('build-btn');
    const log = document.getElementById('build-log');
    btn.disabled = true;
    btn.textContent = '🔄 Building...';
    log.style.display = 'block';
    log.textContent = '> Starting build...\\n';

    try {
        const res = await api('build', 'POST');
        log.textContent = res.log || 'Build complete!';
        toast(res.ok ? '🎉 Build successful!' : '❌ Build failed');
    } catch (e) {
        log.textContent = 'Error: ' + e.message;
        toast('❌ Build failed', true);
    }
    btn.disabled = false;
    btn.textContent = '🔨 Build Now';
}

function exportGames() {
    const blob = new Blob([JSON.stringify(allGames, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'game_list.json';
    a.click();
}

function escapeAttr(s) { return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// Init
renderDashboard();
</script>
</body></html>`;
}

function escapeAttr(s) { return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ============================================================
// Admin Server
// ============================================================
const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, `http://${req.headers.host}`);
    const pathname = u.pathname;

    // Admin page
    if (pathname === '/' || pathname === '/admin') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(adminHTML());
        return;
    }

    // API: get/save config
    if (pathname === '/api/config') {
        if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(loadConfig()));
            return;
        }
        if (req.method === 'POST') {
            let body = '';
            req.on('data', c => body += c);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    saveConfig(data);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: e.message }));
                }
            });
            return;
        }
    }

    // API: get/save game list
    if (pathname === '/api/games') {
        if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(loadGameList()));
            return;
        }
        if (req.method === 'POST') {
            let body = '';
            req.on('data', c => body += c);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    saveGameList(data);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: e.message }));
                }
            });
            return;
        }
    }

    // API: Build site
    if (pathname === '/api/build' && req.method === 'POST') {
        try {
            const output = execSync('node build_site.js 2>&1', {
                cwd: ROOT,
                encoding: 'utf-8',
                timeout: 60000,
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, log: output }));
        } catch (e) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, log: e.stdout || e.message }));
        }
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

server.listen(PORT, () => {
    console.log(`\n🎛️  Admin Panel running at: http://localhost:${PORT}`);
    console.log(`   Open in your browser to manage games, SEO, and more\n`);
});
