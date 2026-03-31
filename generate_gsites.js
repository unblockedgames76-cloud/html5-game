#!/usr/bin/env node

/**
 * Google Sites HTML Generator
 * Tạo HTML embed code để paste vào Google Sites
 * 
 * Usage: node generate_gsites.js [--games 50] [--site-name "Classroom G+"] [--site-url "your-site-url-path"]
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// Config
// ============================================================
const args = process.argv.slice(2);
const SITE_NAME = getArg('--site-name') || 'Classroom G+';
const MAX_GAMES = parseInt(getArg('--games') || '100');
const SITE_URL_PATH = getArg('--site-url') || 'drive-u-7-home-10'; // Phần path của Google Sites URL
const GSITE_BASE = `https://sites.google.com/view/${SITE_URL_PATH}`; // Base URL Google Sites
const OUTPUT_DIR = path.join(__dirname, 'gsites_output');

function getArg(name) {
    const idx = args.indexOf(name);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
}

// Load games
const gameList = JSON.parse(fs.readFileSync(path.join(__dirname, 'game_list.json'), 'utf-8'));
const selectedGames = gameList.slice(0, MAX_GAMES);

console.log(`\n🎮 Google Sites HTML Generator`);
console.log(`📊 Site: ${SITE_NAME}`);
console.log(`📊 Games: ${selectedGames.length} / ${gameList.length}\n`);

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ============================================================
// Generate Homepage Grid HTML (for Embed code in Google Sites)
// ============================================================
function generateHomepageHTML() {
    const gridItems = selectedGames.map(g => {
        // Mỗi game = 1 ảnh thumbnail có link
        const slug = g.title.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 50) || g.id;

        return `<a href="${GSITE_BASE}/${slug}" 
   style="text-decoration:none;color:#fff;text-align:center;display:block" 
   target="_top">
  <img src="${g.img}" 
       alt="${g.title}" 
       style="width:100%;border-radius:12px;aspect-ratio:1;object-fit:cover;transition:transform 0.3s"
       onmouseover="this.style.transform='scale(1.05)'"
       onmouseout="this.style.transform='scale(1)'"
       onerror="this.style.display='none'">
  <div style="padding:6px 4px;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${g.title}</div>
</a>`;
    }).join('\n');

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { 
  font-family: 'Segoe UI', Roboto, sans-serif; 
  background: transparent;
  color: #fff;
}
.title-bar {
  text-align: center;
  padding: 20px;
  background: linear-gradient(135deg, #6b21a8, #ec4899);
  border-radius: 16px;
  margin-bottom: 20px;
}
.title-bar h1 {
  font-size: 24px;
  color: #fff;
}
.title-bar p {
  font-size: 14px;
  color: rgba(255,255,255,0.8);
  margin-top: 8px;
}
.cat-buttons {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.cat-btn {
  padding: 8px 20px;
  border-radius: 20px;
  background: linear-gradient(135deg, #7c3aed, #a855f7);
  color: #fff;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
  transition: opacity 0.2s;
}
.cat-btn:hover { opacity: 0.85; }
.section-title {
  text-align: center;
  font-size: 22px;
  padding: 16px;
  background: linear-gradient(135deg, #581c87, #be185d);
  border-radius: 12px;
  margin-bottom: 16px;
  color: #fff;
}
.game-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  padding: 0 4px;
}
@media (max-width: 600px) {
  .game-grid { grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .title-bar h1 { font-size: 18px; }
}
</style>
</head>
<body>

<div class="title-bar">
  <h1>🎮 Unblocked Games - ${SITE_NAME}</h1>
  <p>Play ${selectedGames.length}+ free unblocked HTML5 games online!</p>
</div>

<div class="cat-buttons">
  <a class="cat-btn" href="#">Last Games</a>
  <a class="cat-btn" href="#">Flash Games</a>
  <a class="cat-btn" href="#">Driving Games</a>
</div>

<div class="section-title">🎄 Top Unblocked HTML5 Games Online! 🎄</div>

<div class="game-grid">
${gridItems}
</div>

<div style="text-align:center;padding:24px;color:rgba(255,255,255,0.5);font-size:12px">
  © 2026 ${SITE_NAME}. All games are provided by their respective owners.
</div>

</body>
</html>`;

    fs.writeFileSync(path.join(OUTPUT_DIR, 'homepage_grid.html'), html);
    console.log(`✅ Homepage grid → gsites_output/homepage_grid.html`);
}

// ============================================================
// Generate individual game page HTML (for Embed)
// ============================================================
function generateGamePages() {
    let count = 0;
    const gameDir = path.join(OUTPUT_DIR, 'games');
    if (!fs.existsSync(gameDir)) fs.mkdirSync(gameDir, { recursive: true });

    for (const g of selectedGames) {
        const slug = g.title.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 50) || g.id;

        const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', Roboto, sans-serif; background: #0a0a1a; color: #fff; }
.game-container {
  max-width: 960px;
  margin: 0 auto;
  padding: 0;
}
.game-frame {
  width: 100%;
  height: 70vh;
  min-height: 400px;
  border: none;
  border-radius: 0;
  background: #000;
}
.controls {
  display: flex;
  justify-content: center;
  gap: 10px;
  padding: 12px;
  background: #1a1a35;
}
.ctrl-btn {
  padding: 10px 20px;
  border-radius: 8px;
  border: 1px solid rgba(120,100,240,0.3);
  background: #0f0f23;
  color: #eee;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.ctrl-btn:hover {
  background: #7c6cf0;
  border-color: #7c6cf0;
  color: #fff;
}
.game-info {
  max-width: 800px;
  margin: 24px auto;
  padding: 0 16px;
}
.game-info h1 {
  font-size: 24px;
  margin-bottom: 12px;
  background: linear-gradient(135deg, #b0a4ff, #ff7eb3);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.game-info p {
  color: #9999cc;
  line-height: 1.7;
  margin-bottom: 12px;
}
.back-link {
  display: inline-block;
  padding: 8px 16px;
  color: #b0a4ff;
  text-decoration: none;
  font-weight: 600;
}
</style>
</head>
<body>

<div class="game-container">
  <iframe class="game-frame" src="${g.iframe}" 
    allowfullscreen 
    allow="autoplay; fullscreen; gamepad" 
    scrolling="no" 
    title="Play ${g.title}"></iframe>
  
  <div class="controls">
    <button class="ctrl-btn" onclick="document.querySelector('.game-frame').requestFullscreen()">⛶ Fullscreen</button>
    <button class="ctrl-btn" onclick="var f=document.querySelector('.game-frame');f.src=f.src">🔄 Reload</button>
    <button class="ctrl-btn" onclick="window.open('${GSITE_BASE}','_top')">🏠 More Games</button>
  </div>
</div>

<div class="game-info">
  <h1>Play ${g.title} Unblocked</h1>
  <p>Play ${g.title} for free online. This game is unblocked and can be played at school or work. No download required!</p>
  <p>Use your mouse and keyboard to control the game. Click the fullscreen button for the best experience.</p>
</div>

</body>
</html>`;

        fs.writeFileSync(path.join(gameDir, `${slug}.html`), html);
        count++;
    }
    console.log(`✅ Game pages (${count}) → gsites_output/games/`);
}

// ============================================================
// Generate a quick-reference list of all games + iframe URLs
// ============================================================
function generateGameList() {
    let md = `# 📋 Game List for Google Sites\n\n`;
    md += `| # | Game | Iframe URL | Image |\n`;
    md += `|---|------|-----------|-------|\n`;

    selectedGames.forEach((g, i) => {
        md += `| ${i + 1} | ${g.title} | ${g.iframe} | ${g.img} |\n`;
    });

    md += `\n## Embed mẫu cho Google Sites:\n\n`;
    md += `\`\`\`html\n<iframe src="IFRAME_URL_HERE" width="100%" height="600" style="border:none" allowfullscreen></iframe>\n\`\`\`\n`;

    fs.writeFileSync(path.join(OUTPUT_DIR, 'game_list_reference.md'), md);
    console.log(`✅ Game list reference → gsites_output/game_list_reference.md`);
}

// ============================================================
// Generate instructions
// ============================================================
function generateInstructions() {
    const txt = `
╔══════════════════════════════════════════════════╗
║    HƯỚNG DẪN SỬ DỤNG - Google Sites Generator   ║
╚══════════════════════════════════════════════════╝

📁 Thư mục gsites_output/ chứa:

1️⃣  homepage_grid.html
    → Mở file này, copy TOÀN BỘ nội dung
    → Google Sites → Insert → Embed → "Embed code"
    → Paste vào → Insert
    → Đây là grid game cho trang chủ

2️⃣  games/*.html (${selectedGames.length} files)
    → Mỗi file = 1 trang game
    → Tạo sub-page mới trên Google Sites
    → Insert → Embed → "Embed code"  
    → Paste nội dung file .html tương ứng

3️⃣  game_list_reference.md
    → Danh sách tất cả game + URL iframe
    → Dùng để tham khảo khi cần embed thủ công

═══════════════════════════════════════════════════

⚡ CÁCH NHANH NHẤT:
   1. Tạo Google Sites mới
   2. Set theme tím (Diplomat/Vision)
   3. Embed homepage_grid.html vào trang chủ
   4. Tạo sub-pages cho mỗi game phổ biến
   5. Embed game HTML vào mỗi sub-page
   6. Publish!

═══════════════════════════════════════════════════
`;
    fs.writeFileSync(path.join(OUTPUT_DIR, 'HUONG_DAN.txt'), txt);
    console.log(`✅ Instructions → gsites_output/HUONG_DAN.txt`);
}

// ============================================================
// Run
// ============================================================
generateHomepageHTML();
generateGamePages();
generateGameList();
generateInstructions();

console.log(`\n${'='.repeat(50)}`);
console.log(`🎉 DONE! Check thư mục: gsites_output/`);
console.log(`${'='.repeat(50)}`);
console.log(`\n📋 Số game: ${selectedGames.length}`);
console.log(`📁 Files tạo: ${selectedGames.length + 3}`);
console.log(`\n💡 Tiếp theo: node generate_gsites.js --games 30 --site-name "Tên Site" --site-url "your-site-path"`);
