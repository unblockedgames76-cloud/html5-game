#!/usr/bin/env node

/**
 * Smart Game Downloader v2
 * - Reads games.json (already populated with 1022 games)
 * - For each game: fetches index.html, parses it, discovers ALL referenced files
 * - Downloads everything needed to play the game offline
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const BASE_DIR = path.join(__dirname, 'games');
const GAMES_JSON = path.join(__dirname, 'games.json');
const PROGRESS_JSON = path.join(__dirname, 'download_progress.json');
const CONCURRENT = 8;
const BATCH_GAMES = 5;
const RETRY = 3;

// ============================================================
// HTTP helpers
// ============================================================
function fetchUrl(url, binary = false) {
    return new Promise((resolve, reject) => {
        const doFetch = (u, redirects = 0) => {
            if (redirects > 5) return reject(new Error('Too many redirects'));
            const mod = u.startsWith('https') ? https : http;
            const req = mod.get(u, { timeout: 30000 }, (res) => {
                if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 308) {
                    let loc = res.headers.location;
                    if (loc && !loc.startsWith('http')) {
                        const parsed = new URL(u);
                        loc = parsed.origin + loc;
                    }
                    return doFetch(loc, redirects + 1);
                }
                if (res.statusCode === 404 || res.statusCode === 403) {
                    res.resume();
                    return resolve(null);
                }
                if (res.statusCode !== 200) {
                    res.resume();
                    return reject(new Error(`HTTP ${res.statusCode} for ${u}`));
                }
                const chunks = [];
                res.on('data', c => chunks.push(c));
                res.on('end', () => resolve(binary ? Buffer.concat(chunks) : Buffer.concat(chunks).toString('utf-8')));
                res.on('error', reject);
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${u}`)); });
        };
        doFetch(url);
    });
}

async function fetchRetry(url, binary = false) {
    for (let i = 0; i < RETRY; i++) {
        try {
            return await fetchUrl(url, binary);
        } catch (e) {
            if (i === RETRY - 1) return null; // give up silently
            await sleep(500 * (i + 1));
        }
    }
    return null;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ============================================================
// Discover files from game index.html
// ============================================================
function parseFilesFromHtml(html) {
    const files = new Set();
    // CSS: href="xxx.css"
    const cssRe = /href="([^"]+\.css)"/gi;
    let m;
    while ((m = cssRe.exec(html)) !== null) {
        if (!m[1].startsWith('http')) files.add(m[1]);
    }
    // JS: src="xxx.js"
    const jsRe = /src="([^"]+\.js)"/gi;
    while ((m = jsRe.exec(html)) !== null) {
        if (!m[1].startsWith('http') && !m[1].startsWith('//') && !m[1].startsWith('/poki')) files.add(m[1]);
    }
    // manifest: href="appmanifest.json" or similar
    const manifestRe = /href="([^"]+\.json)"/gi;
    while ((m = manifestRe.exec(html)) !== null) {
        if (!m[1].startsWith('http')) files.add(m[1]);
    }
    // Icons: href="icons/xxx"
    const iconRe = /href="(icons\/[^"]+)"/gi;
    while ((m = iconRe.exec(html)) !== null) {
        files.add(m[1]);
    }
    // Wasm files
    files.add('box2d.wasm.wasm');
    files.add('data.json');
    files.add('offline.json');
    files.add('sw.js');
    files.add('workermain.js');

    return Array.from(files);
}

async function discoverFromOfflineJson(baseUrl) {
    const files = [];
    try {
        const text = await fetchRetry(`${baseUrl}/offline.json`);
        if (!text) return files;
        const data = JSON.parse(text);
        if (data.files) {
            for (const entry of data.files) {
                if (typeof entry === 'string') {
                    files.push(entry);
                } else if (Array.isArray(entry) && entry.length > 0) {
                    files.push(entry[0]);
                }
            }
        }
    } catch (e) {}
    return files;
}

async function discoverFromDataJson(baseUrl) {
    const files = [];
    try {
        const text = await fetchRetry(`${baseUrl}/data.json`);
        if (!text) return files;
        // data.json can be huge, just look for file references
        const data = JSON.parse(text);
        // Construct 3 data.json has projectData with layouts, plugins etc
        // Media files are typically in "media/" subfolder
        // Check for font files
        if (text.includes('fonts/')) {
            const fontRe = /fonts\/[^"',\s\]]+/g;
            let m;
            while ((m = fontRe.exec(text)) !== null) {
                files.push(m[0]);
            }
        }
        // Check for media files
        if (text.includes('media/')) {
            const mediaRe = /media\/[^"',\s\]]+/g;
            let m;
            while ((m = mediaRe.exec(text)) !== null) {
                files.push(m[0]);
            }
        }
        // Check for images pattern
        if (text.includes('images/')) {
            const imgRe = /images\/[^"',\s\]]+/g;
            let m;
            while ((m = imgRe.exec(text)) !== null) {
                files.push(m[0]);
            }
        }
    } catch (e) {}
    return files;
}

// ============================================================
// Download single file
// ============================================================
async function downloadFile(baseUrl, filePath, gameDir) {
    const destPath = path.join(gameDir, filePath);
    if (fs.existsSync(destPath)) return true;

    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const isBinary = /\.(png|jpg|jpeg|gif|webp|wasm|ogg|mp3|wav|mp4|webm|ttf|woff|woff2|ico|svg|bin|dat|mem)$/i.test(filePath);
    const url = `${baseUrl}/${filePath}`;
    const content = await fetchRetry(url, isBinary);
    if (content === null) return false;

    fs.writeFileSync(destPath, content);
    return true;
}

// ============================================================
// Download one game
// ============================================================
async function downloadGame(gameId, iframeSrc) {
    let baseUrl = iframeSrc.replace(/\/+$/, '');
    if (baseUrl.endsWith('/index.html')) baseUrl = baseUrl.replace('/index.html', '');

    const gameDir = path.join(BASE_DIR, gameId);

    // Check if already fully done
    const doneFile = path.join(gameDir, '.done');
    if (fs.existsSync(doneFile)) {
        return { gameId, status: 'skipped', files: 0 };
    }

    if (!fs.existsSync(gameDir)) fs.mkdirSync(gameDir, { recursive: true });

    // Step 1: Download index.html
    let indexHtml = null;
    const indexPath = path.join(gameDir, 'index.html');
    if (fs.existsSync(indexPath)) {
        indexHtml = fs.readFileSync(indexPath, 'utf-8');
    } else {
        indexHtml = await fetchRetry(`${baseUrl}/`);
        if (!indexHtml) {
            indexHtml = await fetchRetry(`${baseUrl}/index.html`);
        }
        if (indexHtml) {
            fs.writeFileSync(indexPath, indexHtml, 'utf-8');
        } else {
            console.log(`  ❌ ${gameId}: Cannot fetch index.html`);
            return { gameId, status: 'failed', files: 0 };
        }
    }

    // Step 2: Parse files from HTML
    let allFiles = parseFilesFromHtml(indexHtml);

    // Step 3: Discover more files from offline.json
    const offlineFiles = await discoverFromOfflineJson(baseUrl);
    allFiles = [...allFiles, ...offlineFiles];

    // Step 4: Discover fonts/media from data.json
    const dataFiles = await discoverFromDataJson(baseUrl);
    allFiles = [...allFiles, ...dataFiles];

    // Common Construct 3 extra files
    const c3extras = [
        'scripts/c3runtime.js',
        'scripts/dispatchworker.js',
        'scripts/jobworker.js',
        'scripts/register-sw.js',
        'scripts/supportcheck.js',
        'scripts/offlineclient.js',
        'scripts/main.js',
    ];
    allFiles = [...allFiles, ...c3extras];

    // Deduplicate
    allFiles = [...new Set(allFiles)].filter(f => f && !f.startsWith('http') && !f.startsWith('//'));

    // Step 5: Download all files
    let downloaded = 0;
    let failed = 0;

    for (let i = 0; i < allFiles.length; i += CONCURRENT) {
        const batch = allFiles.slice(i, i + CONCURRENT);
        const results = await Promise.all(
            batch.map(f => downloadFile(baseUrl, f, gameDir))
        );
        for (const ok of results) {
            if (ok) downloaded++;
            else failed++;
        }
    }

    // Mark as done
    fs.writeFileSync(doneFile, JSON.stringify({ downloaded, failed, totalFiles: allFiles.length, timestamp: new Date().toISOString() }));

    return { gameId, status: 'done', files: downloaded, failed };
}

// ============================================================
// Main
// ============================================================
async function main() {
    console.log('🎮 Smart Game Downloader v2\n');

    if (!fs.existsSync(GAMES_JSON)) {
        console.error('❌ games.json not found! Run scraper.js first.');
        process.exit(1);
    }

    const gamesData = JSON.parse(fs.readFileSync(GAMES_JSON, 'utf-8'));
    const games = Object.entries(gamesData)
        .filter(([_, d]) => d.iframeSrc)
        .sort((a, b) => {
            const na = parseInt(a[0].replace('class-', ''));
            const nb = parseInt(b[0].replace('class-', ''));
            return na - nb;
        });

    console.log(`📊 Total games to download: ${games.length}\n`);

    // Load progress
    let progress = {};
    if (fs.existsSync(PROGRESS_JSON)) {
        progress = JSON.parse(fs.readFileSync(PROGRESS_JSON, 'utf-8'));
    }

    if (!fs.existsSync(BASE_DIR)) fs.mkdirSync(BASE_DIR, { recursive: true });

    let completed = 0;
    let totalDownloaded = 0;
    const startTime = Date.now();

    for (let i = 0; i < games.length; i += BATCH_GAMES) {
        const batch = games.slice(i, i + BATCH_GAMES);
        const results = await Promise.all(
            batch.map(([gameId, data]) => downloadGame(gameId, data.iframeSrc))
        );

        for (const r of results) {
            completed++;
            totalDownloaded += r.files || 0;
            progress[r.gameId] = r;

            if (r.status === 'done') {
                console.log(`  ✅ ${r.gameId}: ${r.files} files (${r.failed} missing)`);
            } else if (r.status === 'skipped') {
                // silent
            } else {
                console.log(`  ❌ ${r.gameId}: ${r.status}`);
            }
        }

        // Save progress periodically
        if (completed % 20 === 0 || i + BATCH_GAMES >= games.length) {
            fs.writeFileSync(PROGRESS_JSON, JSON.stringify(progress, null, 2));
        }

        const elapsed = (Date.now() - startTime) / 1000;
        const rate = completed / elapsed;
        const eta = Math.round((games.length - completed) / rate);
        console.log(`  📈 ${completed}/${games.length} | ${totalDownloaded} files | ETA: ${eta}s\n`);

        await sleep(300);
    }

    // Save final progress
    fs.writeFileSync(PROGRESS_JSON, JSON.stringify(progress, null, 2));

    // Summary
    const doneCount = Object.values(progress).filter(p => p.status === 'done').length;
    const skipCount = Object.values(progress).filter(p => p.status === 'skipped').length;
    const failCount = Object.values(progress).filter(p => p.status === 'failed').length;

    console.log('\n' + '='.repeat(50));
    console.log('📊 DOWNLOAD SUMMARY');
    console.log('='.repeat(50));
    console.log(`  ✅ Downloaded: ${doneCount}`);
    console.log(`  ⏭  Skipped (already done): ${skipCount}`);
    console.log(`  ❌ Failed: ${failCount}`);
    console.log(`  📁 Output: ${BASE_DIR}`);
    console.log(`  📊 Total files: ${totalDownloaded}`);
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
