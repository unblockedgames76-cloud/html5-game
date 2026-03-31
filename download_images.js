#!/usr/bin/env node
// Download all game thumbnail images
const fs = require('fs');
const path = require('path');
const https = require('https');

const GAMES_JSON = path.join(__dirname, 'games.json');
const IMG_DIR = path.join(__dirname, 'images');
const CONCURRENT = 10;

function fetchBinary(url) {
    return new Promise((resolve, reject) => {
        const doFetch = (u, redirects = 0) => {
            if (redirects > 5) return reject(new Error('Too many redirects'));
            https.get(u, { timeout: 15000 }, (res) => {
                if (res.statusCode === 301 || res.statusCode === 302) {
                    return doFetch(res.headers.location, redirects + 1);
                }
                if (res.statusCode !== 200) { res.resume(); return resolve(null); }
                const chunks = [];
                res.on('data', c => chunks.push(c));
                res.on('end', () => resolve(Buffer.concat(chunks)));
                res.on('error', reject);
            }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')); });
        };
        doFetch(url);
    });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
    if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });
    const games = JSON.parse(fs.readFileSync(GAMES_JSON, 'utf-8'));
    const ids = Object.keys(games).sort((a, b) => parseInt(a.replace('class-','')) - parseInt(b.replace('class-','')));
    
    let done = 0, downloaded = 0;
    for (let i = 0; i < ids.length; i += CONCURRENT) {
        const batch = ids.slice(i, i + CONCURRENT);
        await Promise.all(batch.map(async (id) => {
            const dest = path.join(IMG_DIR, `${id}.png`);
            if (fs.existsSync(dest)) { done++; return; }
            try {
                const data = await fetchBinary(`https://inkyedu118.github.io/img/${id}.png`);
                if (data) { fs.writeFileSync(dest, data); downloaded++; }
            } catch(e) {}
            done++;
        }));
        if (done % 50 === 0) console.log(`  📈 ${done}/${ids.length} (${downloaded} new)`);
        await sleep(100);
    }
    console.log(`\n✅ Done! ${downloaded} thumbnails downloaded to ${IMG_DIR}`);
    console.log(`Total images: ${fs.readdirSync(IMG_DIR).length}`);
}
main();
