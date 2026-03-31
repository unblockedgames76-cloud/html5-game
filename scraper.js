#!/usr/bin/env node

/**
 * Game Scraper - Lấy tất cả game từ unblockedgames76-pro.github.io
 * 
 * Bước 1: Parse HTML templates → lấy game IDs (class-XXX)
 * Bước 2: Fetch từng trang game → lấy iframe src
 * Bước 3: Tải toàn bộ source files của mỗi game
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const BASE_DIR = path.join(__dirname, 'games');
const TEMPLATE_DIR = path.join(__dirname, 'template');
const GAMES_JSON = path.join(__dirname, 'games.json');
const CONCURRENT_DOWNLOADS = 5;
const RETRY_COUNT = 3;
const DELAY_MS = 500; // delay between batches

// ============================================================
// STEP 1: Extract all game IDs from template HTML files
// ============================================================
function extractGameIds() {
    const gameIds = new Set();
    const htmlFiles = ['home.html', 'game.html'];

    for (const file of htmlFiles) {
        const filePath = path.join(TEMPLATE_DIR, file);
        if (!fs.existsSync(filePath)) continue;

        const html = fs.readFileSync(filePath, 'utf-8');

        // Pattern 1: href="/go/class-XXX.html"
        const hrefRegex = /href="\/go\/(class-\d+)\.html"/g;
        let match;
        while ((match = hrefRegex.exec(html)) !== null) {
            gameIds.add(match[1]);
        }

        // Pattern 2: iframe src containing class-XXX
        const iframeRegex = /src="https:\/\/inkyedu118\.github\.io\/[^"]*\/(class-\d+)"/g;
        while ((match = iframeRegex.exec(html)) !== null) {
            gameIds.add(match[1]);
        }

        // Pattern 3: img src containing class-XXX
        const imgRegex = /src="https:\/\/inkyedu118\.github\.io\/img\/(class-\d+)\.png"/g;
        while ((match = imgRegex.exec(html)) !== null) {
            gameIds.add(match[1]);
        }
    }

    return Array.from(gameIds).sort((a, b) => {
        const numA = parseInt(a.replace('class-', ''));
        const numB = parseInt(b.replace('class-', ''));
        return numA - numB;
    });
}

// ============================================================
// HTTP helper
// ============================================================
function fetchUrl(url, options = {}) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const req = protocol.get(url, { timeout: 30000, ...options }, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                return fetchUrl(res.headers.location, options).then(resolve).catch(reject);
            }
            if (res.statusCode === 404) {
                return resolve(null);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
            }

            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                if (options.binary) {
                    resolve(Buffer.concat(chunks));
                } else {
                    resolve(Buffer.concat(chunks).toString('utf-8'));
                }
            });
            res.on('error', reject);
        });
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Timeout for ${url}`));
        });
    });
}

async function fetchWithRetry(url, options = {}, retries = RETRY_COUNT) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fetchUrl(url, options);
        } catch (err) {
            if (i === retries - 1) throw err;
            await sleep(1000 * (i + 1));
        }
    }
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// ============================================================
// STEP 2: Fetch game pages to get iframe src URLs
// ============================================================
async function fetchGameIframeSrc(gameId) {
    const url = `https://unblockedgames76-pro.github.io/go/${gameId}.html`;
    try {
        const html = await fetchWithRetry(url);
        if (!html) return null;

        // Extract iframe src
        const iframeMatch = html.match(/class="game-iframe"[^>]*src="([^"]+)"/);
        if (iframeMatch) {
            return iframeMatch[1];
        }

        // Alternative pattern
        const altMatch = html.match(/id="game-area"[^>]*src="([^"]+)"/);
        if (altMatch) {
            return altMatch[1];
        }

        return null;
    } catch (err) {
        console.error(`  ❌ Error fetching ${gameId}: ${err.message}`);
        return null;
    }
}

// ============================================================
// STEP 3: Download game source files
// ============================================================

// Standard Construct 3 game files
const STANDARD_FILES = [
    'index.html',
    'style.css',
    'file.css',
    'file2.css',
    'appmanifest.json',
    'GameAnalytics.js',
    'removeSW.js',
    'box2d.wasm.js',
    'box2d.wasm.wasm',
    'scripts/supportcheck.js',
    'scripts/offlineclient.js',
    'scripts/main.js',
    'sw.js',
    'workermain.js',
    'data.json',
    'offline.json',
];

// Additional files that might exist in some games
const EXTRA_FILES = [
    'scripts/c3runtime.js',
    'scripts/dispatchworker.js',
    'scripts/jobworker.js',
    'scripts/register-sw.js',
    'icons/icon-16.png',
    'icons/icon-32.png',
    'icons/icon-64.png',
    'icons/icon-128.png',
    'icons/icon-256.png',
    'icons/icon-512.png',
    'icons/loading-logo.png',
];

async function discoverFilesFromOfflineJson(baseUrl) {
    const extraFiles = [];
    try {
        const offlineJson = await fetchWithRetry(`${baseUrl}/offline.json`);
        if (offlineJson) {
            const data = JSON.parse(offlineJson);
            if (data.files) {
                for (const fileEntry of data.files) {
                    if (typeof fileEntry === 'string') {
                        extraFiles.push(fileEntry);
                    } else if (Array.isArray(fileEntry) && fileEntry.length > 0) {
                        extraFiles.push(fileEntry[0]);
                    }
                }
            }
        }
    } catch (err) {
        // offline.json may not exist for all games
    }
    return extraFiles;
}

async function discoverFilesFromDataJson(baseUrl) {
    const extraFiles = [];
    try {
        const dataJson = await fetchWithRetry(`${baseUrl}/data.json`);
        if (dataJson) {
            const data = JSON.parse(dataJson);
            // Look for media files
            if (data.resources) {
                for (const res of data.resources) {
                    if (res.file) extraFiles.push(res.file);
                }
            }
        }
    } catch (err) {
        // data.json may not exist
    }
    return extraFiles;
}

async function downloadGameFiles(gameId, iframeSrc) {
    // Normalize base URL
    let baseUrl = iframeSrc.replace(/\/+$/, '');
    if (baseUrl.endsWith('/index.html')) {
        baseUrl = baseUrl.replace('/index.html', '');
    }

    const gameDir = path.join(BASE_DIR, gameId);

    // Check if already downloaded
    if (fs.existsSync(path.join(gameDir, 'index.html'))) {
        console.log(`  ⏭  ${gameId} already downloaded, skipping`);
        return { gameId, status: 'skipped' };
    }

    console.log(`  📥 Downloading ${gameId} from ${baseUrl}`);

    // Discover all files
    let allFiles = [...STANDARD_FILES, ...EXTRA_FILES];

    // Try to discover more files from offline.json
    const offlineFiles = await discoverFilesFromOfflineJson(baseUrl);
    allFiles = [...allFiles, ...offlineFiles];

    // Remove duplicates
    allFiles = [...new Set(allFiles)];

    let downloadedCount = 0;
    let failedFiles = [];

    // Download files in batches
    for (let i = 0; i < allFiles.length; i += CONCURRENT_DOWNLOADS) {
        const batch = allFiles.slice(i, i + CONCURRENT_DOWNLOADS);
        const results = await Promise.allSettled(
            batch.map(async (filePath) => {
                const fileUrl = `${baseUrl}/${filePath}`;
                const destPath = path.join(gameDir, filePath);

                // Create directories
                const dir = path.dirname(destPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                // Skip if already exists
                if (fs.existsSync(destPath)) {
                    downloadedCount++;
                    return;
                }

                const isBinary = /\.(png|jpg|jpeg|gif|webp|wasm|ogg|mp3|wav|mp4|webm|ttf|woff|woff2|ico)$/i.test(filePath);
                const content = await fetchWithRetry(fileUrl, { binary: isBinary });

                if (content !== null) {
                    if (isBinary) {
                        fs.writeFileSync(destPath, content);
                    } else {
                        fs.writeFileSync(destPath, content, 'utf-8');
                    }
                    downloadedCount++;
                } else {
                    failedFiles.push(filePath);
                }
            })
        );

        // Small delay between batches
        if (i + CONCURRENT_DOWNLOADS < allFiles.length) {
            await sleep(200);
        }
    }

    console.log(`  ✅ ${gameId}: ${downloadedCount} files downloaded, ${failedFiles.length} not found`);
    return { gameId, status: 'done', downloaded: downloadedCount, failed: failedFiles.length };
}

// ============================================================
// STEP 4: Also crawl ALL game pages from site categories
// ============================================================
async function crawlAllGameIdsFromSite() {
    const categories = [
        'new', 'popular', 'shooting', 'car', 'sports', 'skill', 'running',
        'action', '3d', '2-player', 'multiplayer', 'racing', 'moto',
        'stickman', 'adventure', 'puzzle', 'animal', 'platform',
        'simulation', 'management', 'survival', 'strategy', 'board', 'girls'
    ];

    const allIds = new Set();
    console.log('\n🌐 Crawling all categories from site...');

    for (const cat of categories) {
        const url = `https://unblockedgames76-pro.github.io/category/${cat}.html`;
        try {
            const html = await fetchWithRetry(url);
            if (!html) continue;

            const regex = /href="\/go\/(class-\d+)\.html"/g;
            let match;
            while ((match = regex.exec(html)) !== null) {
                allIds.add(match[1]);
            }
            console.log(`  📂 ${cat}: found games (total unique so far: ${allIds.size})`);
        } catch (err) {
            console.error(`  ❌ Error crawling ${cat}: ${err.message}`);
        }
        await sleep(300);
    }

    return Array.from(allIds);
}

// ============================================================
// MAIN
// ============================================================
async function main() {
    console.log('🎮 Game Scraper - unblockedgames76-pro.github.io\n');

    // Create output directory
    if (!fs.existsSync(BASE_DIR)) {
        fs.mkdirSync(BASE_DIR, { recursive: true });
    }

    // Step 1: Get game IDs from templates
    console.log('📋 Step 1: Extracting game IDs from template HTML files...');
    const templateIds = extractGameIds();
    console.log(`   Found ${templateIds.length} games from templates\n`);

    // Step 2: Crawl ALL categories from site
    const siteIds = await crawlAllGameIdsFromSite();

    // Merge all IDs
    const allGameIds = [...new Set([...templateIds, ...siteIds])].sort((a, b) => {
        const numA = parseInt(a.replace('class-', ''));
        const numB = parseInt(b.replace('class-', ''));
        return numA - numB;
    });

    console.log(`\n📊 Total unique games found: ${allGameIds.length}\n`);

    // Step 3: Fetch iframe sources for each game
    console.log('🔍 Step 2: Fetching iframe sources...');
    const gameData = {};

    // Load existing data if available
    if (fs.existsSync(GAMES_JSON)) {
        const existing = JSON.parse(fs.readFileSync(GAMES_JSON, 'utf-8'));
        Object.assign(gameData, existing);
        console.log(`   Loaded ${Object.keys(existing).length} cached entries`);
    }

    // Fetch in batches
    const idsToFetch = allGameIds.filter(id => !gameData[id]);
    console.log(`   Need to fetch ${idsToFetch.length} new game pages...\n`);

    for (let i = 0; i < idsToFetch.length; i += CONCURRENT_DOWNLOADS) {
        const batch = idsToFetch.slice(i, i + CONCURRENT_DOWNLOADS);
        const results = await Promise.all(
            batch.map(async (gameId) => {
                const iframeSrc = await fetchGameIframeSrc(gameId);
                if (iframeSrc) {
                    gameData[gameId] = {
                        pageUrl: `https://unblockedgames76-pro.github.io/go/${gameId}.html`,
                        iframeSrc: iframeSrc,
                        imageUrl: `https://inkyedu118.github.io/img/${gameId}.png`
                    };
                    console.log(`  ✅ ${gameId} → ${iframeSrc}`);
                } else {
                    gameData[gameId] = { pageUrl: `https://unblockedgames76-pro.github.io/go/${gameId}.html`, iframeSrc: null };
                    console.log(`  ⚠️  ${gameId} → no iframe found`);
                }
            })
        );

        // Save progress
        fs.writeFileSync(GAMES_JSON, JSON.stringify(gameData, null, 2));

        if (i + CONCURRENT_DOWNLOADS < idsToFetch.length) {
            await sleep(DELAY_MS);
        }

        // Progress
        const done = Math.min(i + CONCURRENT_DOWNLOADS, idsToFetch.length);
        console.log(`  📈 Progress: ${done}/${idsToFetch.length}\n`);
    }

    // Save final game data
    fs.writeFileSync(GAMES_JSON, JSON.stringify(gameData, null, 2));

    // Step 4: Download game sources
    const gamesWithIframe = Object.entries(gameData).filter(([_, data]) => data.iframeSrc);
    console.log(`\n📦 Step 3: Downloading ${gamesWithIframe.length} game sources...\n`);

    let completed = 0;
    for (let i = 0; i < gamesWithIframe.length; i += 3) {
        const batch = gamesWithIframe.slice(i, i + 3);
        await Promise.all(
            batch.map(([gameId, data]) => downloadGameFiles(gameId, data.iframeSrc))
        );

        completed += batch.length;
        console.log(`\n  📈 Overall progress: ${completed}/${gamesWithIframe.length}\n`);
        await sleep(DELAY_MS);
    }

    // Also download game thumbnail images
    console.log('\n🖼  Step 4: Downloading game thumbnails...');
    const imgDir = path.join(__dirname, 'images');
    if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

    for (let i = 0; i < allGameIds.length; i += CONCURRENT_DOWNLOADS) {
        const batch = allGameIds.slice(i, i + CONCURRENT_DOWNLOADS);
        await Promise.all(
            batch.map(async (gameId) => {
                const imgPath = path.join(imgDir, `${gameId}.png`);
                if (fs.existsSync(imgPath)) return;

                try {
                    const imgData = await fetchWithRetry(
                        `https://inkyedu118.github.io/img/${gameId}.png`,
                        { binary: true }
                    );
                    if (imgData) {
                        fs.writeFileSync(imgPath, imgData);
                    }
                } catch (err) {
                    // Skip failed images
                }
            })
        );
        await sleep(200);
    }

    console.log('\n🎉 Done! All games scraped successfully.');
    console.log(`📁 Games saved to: ${BASE_DIR}`);
    console.log(`📁 Images saved to: ${imgDir}`);
    console.log(`📁 Game data saved to: ${GAMES_JSON}`);
    console.log(`📊 Total games: ${allGameIds.length}`);
    console.log(`📊 Games with iframe: ${gamesWithIframe.length}`);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
