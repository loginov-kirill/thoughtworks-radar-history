/**
 * Build a comprehensive, cumulative ThoughtWorks Radar visualization.
 * Downloads ALL quadrants (Techniques, Tools, Platforms, Languages & Frameworks)
 * from all 34 volumes and generates an interactive HTML with cumulative state tracking.
 *
 * Cumulative rule: once a blip reaches a ring, it persists at that ring in all
 * subsequent volumes unless a newer volume explicitly changes its ring.
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// ── Volume metadata ───────────────────────────────────────────────────────────
const VOLUMES = [];
for (let v = 1; v <= 34; v++) {
  const meta = [
    [1,"Jan 2010"],[2,"Apr 2010"],[3,"Aug 2010"],[4,"Jan 2011"],[5,"Jul 2011"],
    [6,"Mar 2012"],[7,"Oct 2012"],[8,"May 2013"],[9,"Jan 2014"],[10,"Jul 2014"],
    [11,"Jan 2015"],[12,"May 2015"],[13,"Nov 2015"],[14,"Apr 2016"],[15,"Nov 2016"],
    [16,"Mar 2017"],[17,"Nov 2017"],[18,"May 2018"],[19,"Nov 2018"],[20,"Apr 2019"],
    [21,"Nov 2019"],[22,"May 2020"],[23,"Oct 2020"],[24,"Apr 2021"],[25,"Oct 2021"],
    [26,"Mar 2022"],[27,"Oct 2022"],[28,"Apr 2023"],[29,"Sep 2023"],[30,"Apr 2024"],
    [31,"Oct 2024"],[32,"Apr 2025"],[33,"Nov 2025"],[34,"Apr 2026"],
  ].find(m => m[0] === v);
  VOLUMES.push({ vol: v, date: meta[1] });
}

const BASE = "https://raw.githubusercontent.com/setchy/thoughtworks-tech-radar-volumes/main/volumes/json/";

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "node" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
        return fetchJSON(res.headers.location).then(resolve, reject);
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      let d = ""; res.on("data", c => d += c); res.on("end", () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } }); res.on("error", reject);
    }).on("error", reject);
  });
}

function stripHtml(h) {
  if (!h) return "";
  return h.replace(/\\"/g,'"').replace(/<br\s*\/?>/gi,"\n").replace(/<[^>]+>/g,"")
    .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"')
    .replace(/&#39;/g,"'").replace(/\n{3,}/g,"\n\n").replace(/^"|"$/g,"").trim();
}

// ── Quadrant display names ────────────────────────────────────────────────────
const QUAD_DISPLAY = {
  "techniques": "Techniques",
  "tools": "Tools",
  "platforms": "Platforms",
  "languages-and-frameworks": "Languages & Frameworks",
  "languages & frameworks": "Languages & Frameworks",
};
function normQuad(q) {
  const low = (q || "").toLowerCase().trim();
  if (low.includes("language") || low.includes("framework")) return "languages-and-frameworks";
  if (low.includes("technique")) return "techniques";
  if (low.includes("tool")) return "tools";
  if (low.includes("platform")) return "platforms";
  return low;
}

async function main() {
  // ── Download all volumes ──────────────────────────────────────────────────
  const allItems = {};  // key -> { quadrant, history: [{v, r, isNew, status}] }
  const volumeBlipCounts = {};

  for (const vol of VOLUMES) {
    const fn = `Thoughtworks Technology Radar Volume ${String(vol.vol).padStart(2,"0")} (${vol.date}).json`;
    const url = BASE + encodeURIComponent(fn);
    process.stdout.write(`V${vol.vol} (${vol.date})...`);

    try {
      const blips = await fetchJSON(url);
      let count = 0;
      for (const b of blips) {
        const quad = normQuad(b.quadrant);
        const key = b.name + "|||" + quad;  // unique by name+quadrant
        if (!allItems[key]) {
          allItems[key] = { name: b.name, quadrant: quad, history: [] };
        }
        allItems[key].history.push({
          v: vol.vol,
          r: (b.ring || "").toLowerCase(),
          n: b.isNew === "TRUE",
          s: b.status || null,
          d: b.description || ""
        });
        count++;
      }
      volumeBlipCounts[vol.vol] = count;
      console.log(` ${count} blips`);
    } catch (e) {
      console.error(` ERROR: ${e.message}`);
      volumeBlipCounts[vol.vol] = 0;
    }
  }

  // ── Build compact data for embedding ────────────────────────────────────
  const items = Object.values(allItems).map(item => ({
    n: item.name,
    q: item.quadrant,
    h: item.history,
  }));

  const quadrants = [...new Set(items.map(i => i.q))].sort();

  const embeddedData = {
    volumes: VOLUMES,
    items,
    quadrants,
    volumeBlipCounts,
  };

  const uniqueCount = items.length;
  console.log(`\n${uniqueCount} unique items across ${quadrants.length} quadrants and ${VOLUMES.length} volumes`);

  // ── Generate HTML ─────────────────────────────────────────────────────────
  const html = buildHTML(embeddedData);
  const outPath = path.join(__dirname, "index.html");
  fs.writeFileSync(outPath, html, "utf-8");
  console.log(`Output: ${outPath}`);
}

function buildHTML(data) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ThoughtWorks Radar — Complete Cumulative Archive</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#08090e;--surface:#0e1018;--surface2:#151822;--surface3:#1c2030;
  --border:#252838;--border2:#333750;
  --text:#e2e4ed;--text2:#9398b0;--text3:#5c6180;
  --adopt:#00e676;--trial:#40c4ff;--assess:#ffab40;--hold:#ff5252;--caution:#e040fb;
  --adopt-bg:rgba(0,230,118,.10);--trial-bg:rgba(64,196,255,.10);
  --assess-bg:rgba(255,171,64,.10);--hold-bg:rgba(255,82,82,.10);--caution-bg:rgba(224,64,251,.10);
  --adopt-bg2:rgba(0,230,118,.18);--trial-bg2:rgba(64,196,255,.18);
  --assess-bg2:rgba(255,171,64,.18);--hold-bg2:rgba(255,82,82,.18);--caution-bg2:rgba(224,64,251,.18);
  --accent:#7c4dff;
  --q-techniques:#26c6da;--q-tools:#ff7043;--q-platforms:#ab47bc;--q-lang:#66bb6a;
}
html,body{height:100%;font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text);overflow:hidden}
a{color:var(--accent);text-decoration:none}

/* Layout */
.app{display:grid;grid-template-rows:auto auto auto 1fr auto;height:100vh}

/* Top bar */
.topbar{padding:14px 24px 10px;background:var(--surface);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:20px}
.topbar h1{font-size:17px;font-weight:700;white-space:nowrap}
.topbar h1 span{background:linear-gradient(135deg,var(--accent),#e040fb);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.search-box{position:relative;width:240px}
.search-box input{width:100%;padding:7px 12px 7px 32px;border-radius:7px;border:1px solid var(--border);
  background:var(--surface2);color:var(--text);font-size:12px;font-family:inherit;outline:none;transition:.2s}
.search-box input:focus{border-color:var(--accent);box-shadow:0 0 12px rgba(124,77,255,.2)}
.search-box svg{position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--text3);width:14px;height:14px}

/* Volume slider */
.vol-bar{padding:10px 24px 12px;background:var(--surface);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:16px}
.vol-label{font-size:22px;font-weight:800;min-width:200px;font-family:'JetBrains Mono',monospace}
.vol-label .vol-date{color:var(--text2);font-weight:500;font-size:14px;margin-left:6px}
.vol-slider{flex:1;-webkit-appearance:none;height:6px;border-radius:3px;
  background:linear-gradient(90deg,var(--border),var(--accent));outline:none;cursor:pointer}
.vol-slider::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;
  background:var(--accent);border:3px solid var(--bg);cursor:pointer;box-shadow:0 0 10px rgba(124,77,255,.4)}
.vol-nav{background:var(--surface2);border:1px solid var(--border);color:var(--text);
  width:32px;height:32px;border-radius:6px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;transition:.15s}
.vol-nav:hover{background:var(--surface3);border-color:var(--accent)}

/* Quadrant tabs + stats */
.tab-bar{padding:0 24px;background:var(--surface);border-bottom:1px solid var(--border);display:flex;align-items:stretch;gap:0}
.quad-tab{padding:10px 20px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;
  cursor:pointer;border-bottom:2px solid transparent;color:var(--text3);transition:.2s;display:flex;align-items:center;gap:8px}
.quad-tab:hover{color:var(--text2)}
.quad-tab.active{color:var(--text);border-bottom-color:var(--accent)}
.quad-tab .tab-count{font-size:10px;padding:2px 7px;border-radius:10px;background:var(--surface2);
  font-family:'JetBrains Mono',monospace;color:var(--text3)}
.quad-tab.active .tab-count{background:rgba(124,77,255,.15);color:var(--accent)}
.tab-spacer{flex:1}
.summary-stats{display:flex;align-items:center;gap:16px;padding:0 20px;font-size:11px;color:var(--text3)}
.summary-stats .stat{display:flex;align-items:center;gap:4px}
.summary-stats .stat-num{font-family:'JetBrains Mono',monospace;font-weight:600;color:var(--text2)}
.summary-stats .stat-dot{width:8px;height:8px;border-radius:50%}
.cumulative-toggle{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text2);cursor:pointer;user-select:none}
.cumulative-toggle input{accent-color:var(--accent)}

/* Main content */
.main{overflow-y:auto;padding:20px 24px 100px}
.main::-webkit-scrollbar{width:8px}
.main::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}

/* Ring sections */
.ring-section{margin-bottom:20px}
.ring-header{display:flex;align-items:center;gap:10px;margin-bottom:10px;cursor:pointer;user-select:none}
.ring-dot{width:12px;height:12px;border-radius:50%}
.ring-name{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
.ring-count{font-size:11px;padding:2px 8px;border-radius:8px;font-family:'JetBrains Mono',monospace;font-weight:600}
.ring-header .collapse-icon{color:var(--text3);font-size:12px;margin-left:auto;transition:transform .2s}
.ring-header.collapsed .collapse-icon{transform:rotate(-90deg)}

.ring-items{display:flex;flex-wrap:wrap;gap:6px;padding:4px 0}
.ring-items.collapsed{display:none}

/* Item chips */
.item-chip{padding:5px 12px;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;
  transition:all .15s;border:1px solid transparent;position:relative;white-space:nowrap}
.item-chip:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.3)}
.item-chip.active-vol{font-weight:600}
.item-chip.carried{opacity:.55}
.item-chip.carried:hover{opacity:1}
.item-chip .new-badge{font-size:8px;font-weight:700;padding:1px 4px;border-radius:3px;
  background:rgba(255,255,255,.15);color:#fff;margin-left:4px;vertical-align:middle}
.item-chip .move-arrow{font-size:10px;margin-left:3px}

/* Ring-specific chip styles */
.chip-adopt{background:var(--adopt-bg);color:var(--adopt);border-color:rgba(0,230,118,.15)}
.chip-adopt.active-vol{background:var(--adopt-bg2);border-color:rgba(0,230,118,.3)}
.chip-trial{background:var(--trial-bg);color:var(--trial);border-color:rgba(64,196,255,.15)}
.chip-trial.active-vol{background:var(--trial-bg2);border-color:rgba(64,196,255,.3)}
.chip-assess{background:var(--assess-bg);color:var(--assess);border-color:rgba(255,171,64,.15)}
.chip-assess.active-vol{background:var(--assess-bg2);border-color:rgba(255,171,64,.3)}
.chip-hold{background:var(--hold-bg);color:var(--hold);border-color:rgba(255,82,82,.15)}
.chip-hold.active-vol{background:var(--hold-bg2);border-color:rgba(255,82,82,.3)}
.chip-caution{background:var(--caution-bg);color:var(--caution);border-color:rgba(224,64,251,.15)}
.chip-caution.active-vol{background:var(--caution-bg2);border-color:rgba(224,64,251,.3)}

/* Detail panel */
.detail{position:fixed;bottom:0;left:0;right:0;z-index:20;
  background:linear-gradient(180deg,rgba(14,16,24,.97),rgba(14,16,24,.99));
  border-top:1px solid var(--border);padding:16px 24px;
  transform:translateY(100%);transition:transform .3s ease;backdrop-filter:blur(20px)}
.detail.open{transform:translateY(0)}
.detail-top{display:flex;align-items:center;gap:12px;margin-bottom:10px}
.detail-top h3{font-size:16px;font-weight:700}
.detail-top .detail-quad{font-size:11px;padding:3px 10px;border-radius:5px;background:var(--surface2);color:var(--text2);text-transform:uppercase;letter-spacing:.5px}
.detail-close{background:none;border:none;color:var(--text3);cursor:pointer;font-size:18px;padding:4px 8px;border-radius:4px;margin-left:auto}
.detail-close:hover{color:var(--text);background:var(--surface2)}
.detail-history{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:13px}
.detail-history .step{display:flex;align-items:center;gap:4px}
.detail-history .step-ring{padding:3px 10px;border-radius:5px;font-size:11px;font-weight:600;text-transform:uppercase}
.detail-history .step-vol{font-size:10px;color:var(--text3);font-family:'JetBrains Mono',monospace}
.detail-history .arrow{color:var(--text3)}
.detail-history .arrow{color:var(--text3)}

/* Detail Description */
.detail-desc { font-size: 13px; color: var(--text2); line-height: 1.5; margin: 12px 0; max-height: 180px; overflow-y: auto; padding-right: 10px; }
.detail-desc::-webkit-scrollbar { width: 6px; }
.detail-desc::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }
.detail-desc a { color: var(--accent); text-decoration: underline; text-decoration-color: rgba(124,77,255,.4); }
.detail-desc a:hover { text-decoration-color: var(--accent); }

/* Markers */
.item-chip.mark-known { border-left: 3px solid #00e676; padding-left: 9px; }
.item-chip.mark-learn { border-left: 3px solid #ffab40; padding-left: 9px; }
.item-chip.mark-ignore { border-left: 3px solid #757575; padding-left: 9px; opacity: 0.5; }
.marker-filters { display: flex; gap: 12px; margin-left: auto; align-items: center; }
.filter-cb { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text2); cursor: pointer; user-select: none; }
.filter-cb input { accent-color: var(--accent); cursor: pointer; width: 14px; height: 14px; }
.filter-cb:hover { color: var(--text); }
.detail-actions { display: flex; gap: 8px; margin-top: 12px; }
.btn-action { padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface2); color: var(--text); font-size: 12px; cursor: pointer; transition: .2s; }
.btn-action:hover { background: var(--surface3); }
.btn-action.active-known { background: rgba(0,230,118,.15); border-color: #00e676; color: #00e676; }
.btn-action.active-learn { background: rgba(255,171,64,.15); border-color: #ffab40; color: #ffab40; }
.btn-action.active-ignore { background: rgba(117,117,117,.15); border-color: #757575; color: #757575; }

/* Tooltip */
.tooltip{position:fixed;pointer-events:none;z-index:100;padding:10px 14px;border-radius:8px;
  background:rgba(14,16,24,.95);border:1px solid var(--border);backdrop-filter:blur(16px);
  box-shadow:0 8px 24px rgba(0,0,0,.4);max-width:320px;opacity:0;transition:opacity .12s;font-size:12px}
.tooltip.visible{opacity:1}
.tooltip .tt-name{font-weight:600;margin-bottom:4px}
.tooltip .tt-meta{color:var(--text2);line-height:1.5}

/* Empty */
.empty-msg{padding:60px;text-align:center;color:var(--text3);font-size:14px}
</style>
</head>
<body>
<div class="app">
  <div class="topbar">
    <h1>🔭 <span>Radar</span> Complete Archive</h1>
    <div class="search-box">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input type="text" id="search" placeholder="Search across all quadrants..." autocomplete="off">
    </div>
    <div class="cumulative-toggle">
      <input type="checkbox" id="cumulative" checked>
      <label for="cumulative">Cumulative view (persist items from previous volumes)</label>
    </div>
    <div class="marker-filters">
      <label class="filter-cb" title="Hotkey: 0/C/Backspace to clear"><input type="checkbox" id="filter-unmarked" checked> Show Unmarked</label>
      <label class="filter-cb" title="Hotkey: 1/K to mark"><input type="checkbox" id="filter-known" checked> Show Known</label>
      <label class="filter-cb" title="Hotkey: 2/L to mark"><input type="checkbox" id="filter-learn" checked> Show To Learn</label>
      <label class="filter-cb" title="Hotkey: 3/I to ignore"><input type="checkbox" id="filter-ignore" checked> Show Not Interesting</label>
    </div>
  </div>

  <div class="vol-bar">
    <button class="vol-nav" id="vol-prev" title="Previous volume">◀</button>
    <div class="vol-label" id="vol-label">Vol 34 <span class="vol-date">Apr 2026</span></div>
    <input type="range" class="vol-slider" id="vol-slider" min="1" max="${data.volumes.length}" value="${data.volumes.length}">
    <button class="vol-nav" id="vol-next" title="Next volume">▶</button>
  </div>

  <div class="tab-bar" id="tab-bar">
    <div class="quad-tab active" data-q="all">All <span class="tab-count" id="count-all">0</span></div>
    <div class="quad-tab" data-q="techniques">Techniques <span class="tab-count" id="count-techniques">0</span></div>
    <div class="quad-tab" data-q="tools">Tools <span class="tab-count" id="count-tools">0</span></div>
    <div class="quad-tab" data-q="platforms">Platforms <span class="tab-count" id="count-platforms">0</span></div>
    <div class="quad-tab" data-q="languages-and-frameworks">Languages & Frameworks <span class="tab-count" id="count-languages-and-frameworks">0</span></div>
    <div class="tab-spacer"></div>
    <div class="summary-stats" id="summary-stats"></div>
  </div>

  <div class="main" id="main-content"></div>

  <div class="detail" id="detail">
    <div class="detail-top">
      <h3 id="detail-name"></h3>
      <span class="detail-quad" id="detail-quad"></span>
      <button class="detail-close" id="detail-close">✕</button>
    </div>
    <div class="detail-history" id="detail-history"></div>
    <div class="detail-desc" id="detail-desc"></div>
    <div class="detail-actions">
      <button class="btn-action" id="btn-mark-known">✓ Mark as Known</button>
      <button class="btn-action" id="btn-mark-learn">★ Mark To Learn</button>
      <button class="btn-action" id="btn-mark-ignore">⛔ Not Interesting</button>
      <button class="btn-action" id="btn-mark-clear">Clear Mark</button>
    </div>
  </div>
</div>

<div class="tooltip" id="tooltip">
  <div class="tt-name" id="tt-name"></div>
  <div class="tt-meta" id="tt-meta"></div>
</div>

<script>
const DATA = ${JSON.stringify(data)};

const RING_ORDER = ['adopt','trial','assess','hold','caution'];
const RING_COLORS = {adopt:'#00e676',trial:'#40c4ff',assess:'#ffab40',hold:'#ff5252',caution:'#e040fb'};
const RING_BG = {adopt:'var(--adopt-bg)',trial:'var(--trial-bg)',assess:'var(--assess-bg)',hold:'var(--hold-bg)',caution:'var(--caution-bg)'};
const QUAD_NAMES = {"techniques":"Techniques","tools":"Tools","platforms":"Platforms","languages-and-frameworks":"Languages & Frameworks"};

let currentVol = DATA.volumes.length;
let currentQuad = 'all';
let showUnmarked = true;
let showKnown = true;
let showLearn = true;
let showIgnore = true;
let searchQuery = '';
let cumulative = true;
let selectedItem = null;
let hoveredItem = null;
let collapsedRings = {};

const markers = JSON.parse(localStorage.getItem('radar_markers') || '{}');
function saveMarkers() { localStorage.setItem('radar_markers', JSON.stringify(markers)); }

const mainEl = document.getElementById('main-content');
const volSlider = document.getElementById('vol-slider');
const volLabel = document.getElementById('vol-label');
const detailEl = document.getElementById('detail');
const tooltipEl = document.getElementById('tooltip');

// ── Compute state at a volume ─────────────────────────────────────────────
function getStateAtVolume(targetVol) {
  const state = [];
  for (const item of DATA.items) {
    let ring = null, lastV = 0, firstV = null, wasNew = false, status = null;
    let prevRing = null;
    for (const h of item.h) {
      if (h.v <= targetVol) {
        prevRing = ring;
        ring = h.r;
        lastV = h.v;
        if (!firstV) firstV = h.v;
        if (h.v === targetVol) { wasNew = h.n; status = h.s; }
      }
    }
    if (!ring) continue;
    // In non-cumulative mode, only show items that appeared in THIS volume
    if (!cumulative && lastV !== targetVol) continue;

    const activeInThisVol = lastV === targetVol;
    const movedInThisVol = activeInThisVol && prevRing && prevRing !== ring;
    state.push({
      name: item.n,
      quadrant: item.q,
      ring,
      firstVol: firstV,
      lastChangedVol: lastV,
      activeInThisVol,
      wasNew: wasNew && activeInThisVol,
      movedInThisVol,
      prevRing: movedInThisVol ? prevRing : null,
      status,
      history: item.h.filter(hh => hh.v <= targetVol),
    });
  }
  return state;
}

// ── Render ─────────────────────────────────────────────────────────────────
function render() {
  const state = getStateAtVolume(currentVol);
  const vol = DATA.volumes[currentVol - 1];
  volLabel.innerHTML = 'Vol ' + currentVol + ' <span class="vol-date">' + vol.date + '</span>';
  volSlider.value = currentVol;

  // Filter by quadrant and search
  let filtered = state;
  if (currentQuad !== 'all') filtered = filtered.filter(i => i.quadrant === currentQuad);
  filtered = filtered.filter(i => {
    const m = markers[i.name + "|||" + i.quadrant];
    if (!m) return showUnmarked;
    if (m === 'known') return showKnown;
    if (m === 'learn') return showLearn;
    if (m === 'ignore') return showIgnore;
    return true;
  });
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(i => i.name.toLowerCase().includes(q));
  }

  // Update tab counts
  const allState = state; // unfiltered by quadrant
  let searchFiltered = allState;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    searchFiltered = searchFiltered.filter(i => i.name.toLowerCase().includes(q));
  }
  document.getElementById('count-all').textContent = searchFiltered.length;
  for (const qk of DATA.quadrants) {
    const el = document.getElementById('count-' + qk);
    if (el) el.textContent = searchFiltered.filter(i => i.quadrant === qk).length;
  }

  // Summary stats
  const statsEl = document.getElementById('summary-stats');
  const ringCounts = {};
  for (const r of RING_ORDER) ringCounts[r] = filtered.filter(i => i.ring === r).length;
  const newCount = filtered.filter(i => i.wasNew).length;
  const changedCount = filtered.filter(i => i.movedInThisVol).length;
  statsEl.innerHTML = RING_ORDER.filter(r => ringCounts[r] > 0).map(r =>
    '<span class="stat"><span class="stat-dot" style="background:' + RING_COLORS[r] + '"></span>' +
    '<span class="stat-num">' + ringCounts[r] + '</span> ' + r + '</span>'
  ).join('') +
    (newCount ? '<span class="stat">🆕 <span class="stat-num">' + newCount + '</span> new</span>' : '') +
    (changedCount ? '<span class="stat">↕ <span class="stat-num">' + changedCount + '</span> moved</span>' : '');

  // Group by ring
  const groups = {};
  for (const r of RING_ORDER) groups[r] = [];
  for (const item of filtered) {
    if (!groups[item.ring]) groups[item.ring] = [];
    groups[item.ring].push(item);
  }
  // Sort within each ring: active items first, then alphabetical
  for (const r of RING_ORDER) {
    groups[r].sort((a, b) => {
      if (a.activeInThisVol !== b.activeInThisVol) return a.activeInThisVol ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  // Render ring sections
  let html = '';
  if (filtered.length === 0) {
    html = '<div class="empty-msg">No items match the current filters.</div>';
  } else {
    for (const r of RING_ORDER) {
      const items = groups[r];
      if (items.length === 0) continue;
      const isCollapsed = collapsedRings[r];
      html += '<div class="ring-section">';
      html += '<div class="ring-header' + (isCollapsed ? ' collapsed' : '') + '" data-ring="' + r + '">';
      html += '<span class="ring-dot" style="background:' + RING_COLORS[r] + '"></span>';
      html += '<span class="ring-name" style="color:' + RING_COLORS[r] + '">' + r + '</span>';
      html += '<span class="ring-count" style="background:' + RING_COLORS[r] + '22;color:' + RING_COLORS[r] + '">' + items.length + '</span>';
      html += '<span class="collapse-icon">▾</span>';
      html += '</div>';
      html += '<div class="ring-items' + (isCollapsed ? ' collapsed' : '') + '">';
      for (const item of items) {
        const chipClass = 'chip-' + r + (item.activeInThisVol ? ' active-vol' : ' carried');
        let extra = '';
        if (item.wasNew) extra += '<span class="new-badge">NEW</span>';
        if (item.movedInThisVol) {
          const dir = RING_ORDER.indexOf(item.prevRing) > RING_ORDER.indexOf(r) ? '↑' : '↓';
          extra += '<span class="move-arrow">' + dir + '</span>';
        }
        const mark = markers[item.name + "|||" + item.quadrant];
        const markClass = mark ? ' mark-' + mark : '';
        const esc = item.name.replace(/"/g, '&quot;').replace(/</g, '&lt;');
        html += '<span class="item-chip ' + chipClass + markClass + '" data-name="' + esc + '" data-quad="' + item.quadrant + '" tabindex="0">';
        html += esc + extra + '</span>';
      }
      html += '</div></div>';
    }
  }
  mainEl.innerHTML = html;

  // Attach event listeners
  mainEl.querySelectorAll('.ring-header').forEach(h => {
    h.addEventListener('click', () => {
      const r = h.dataset.ring;
      collapsedRings[r] = !collapsedRings[r];
      h.classList.toggle('collapsed');
      h.nextElementSibling.classList.toggle('collapsed');
    });
  });
  mainEl.querySelectorAll('.item-chip').forEach(chip => {
    chip.addEventListener('click', () => showDetail(chip.dataset.name, chip.dataset.quad));
    chip.addEventListener('mouseenter', (e) => {
      hoveredItem = { name: chip.dataset.name, quad: chip.dataset.quad };
      showTooltip(e, chip.dataset.name, chip.dataset.quad);
    });
    chip.addEventListener('mouseleave', () => {
      hoveredItem = null;
      tooltipEl.classList.remove('visible');
    });
    chip.addEventListener('focus', (e) => {
      hoveredItem = { name: chip.dataset.name, quad: chip.dataset.quad };
      showTooltip(e, chip.dataset.name, chip.dataset.quad);
    });
    chip.addEventListener('blur', () => {
      hoveredItem = null;
      tooltipEl.classList.remove('visible');
    });
  });
}

function showDetail(name, quad) {
  const item = DATA.items.find(i => i.n === name && i.q === quad);
  if (!item) return;
  document.getElementById('detail-name').textContent = name;
  document.getElementById('detail-quad').textContent = QUAD_NAMES[quad] || quad;
  const hEl = document.getElementById('detail-history');
  hEl.innerHTML = item.h.map((a, i) => {
    const vol = DATA.volumes.find(v => v.vol === a.v);
    const arrow = i < item.h.length - 1 ? '<span class="arrow"> → </span>' : '';
    const bg = RING_COLORS[a.r] + '18';
    return '<span class="step"><span class="step-ring" style="background:' + bg + ';color:' + RING_COLORS[a.r] + '">' +
      a.r + '</span><span class="step-vol">V' + a.v + ' (' + (vol ? vol.date : '') + ')' +
      (a.n ? ' 🆕' : '') + '</span></span>' + arrow;
  }).join('');
  
  const filteredHistory = item.h.filter(hh => hh.v <= currentVol);
  const latestEntry = filteredHistory[filteredHistory.length - 1];
  const descEl = document.getElementById('detail-desc');
  if (latestEntry && latestEntry.d) {
    descEl.innerHTML = latestEntry.d;
  } else {
    descEl.innerHTML = '<em>No description available for this volume.</em>';
  }
  
  const mark = markers[name + "|||" + quad];
  document.getElementById('btn-mark-known').className = 'btn-action' + (mark === 'known' ? ' active-known' : '');
  document.getElementById('btn-mark-learn').className = 'btn-action' + (mark === 'learn' ? ' active-learn' : '');
  document.getElementById('btn-mark-ignore').className = 'btn-action' + (mark === 'ignore' ? ' active-ignore' : '');

  detailEl.classList.add('open');
  selectedItem = { name, quad };
}

function showTooltip(e, name, quad) {
  const item = DATA.items.find(i => i.n === name && i.q === quad);
  if (!item) return;
  const first = item.h[0];
  const last = item.h[item.h.length - 1];
  const firstVol = DATA.volumes.find(v => v.vol === first.v);
  const lastVol = DATA.volumes.find(v => v.vol === last.v);
  document.getElementById('tt-name').textContent = name;
  document.getElementById('tt-meta').innerHTML =
    (QUAD_NAMES[quad] || quad) + '<br>' +
    'First: V' + first.v + ' (' + (firstVol ? firstVol.date : '') + ') as <strong>' + first.r + '</strong><br>' +
    'Latest: V' + last.v + ' (' + (lastVol ? lastVol.date : '') + ') as <strong>' + last.r + '</strong><br>' +
    'Appeared in ' + item.h.length + ' volume(s)';
  tooltipEl.classList.add('visible');
  const tw = tooltipEl.offsetWidth, th = tooltipEl.offsetHeight;
  let tx = e.clientX + 12, ty = e.clientY - th - 8;
  if (tx + tw > window.innerWidth - 10) tx = e.clientX - tw - 12;
  if (ty < 10) ty = e.clientY + 20;
  tooltipEl.style.left = tx + 'px';
  tooltipEl.style.top = ty + 'px';
}

// ── Events ────────────────────────────────────────────────────────────────
volSlider.addEventListener('input', () => { currentVol = parseInt(volSlider.value); render(); });
document.getElementById('vol-prev').addEventListener('click', () => { if (currentVol > 1) { currentVol--; render(); } });
document.getElementById('vol-next').addEventListener('click', () => { if (currentVol < DATA.volumes.length) { currentVol++; render(); } });

document.querySelectorAll('.quad-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.quad-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentQuad = tab.dataset.q;
    render();
  });
});

document.getElementById('search').addEventListener('input', (e) => {
  searchQuery = e.target.value;
  render();
});

document.getElementById('cumulative').addEventListener('change', (e) => {
  cumulative = e.target.checked;
  render();
});

document.getElementById('detail-close').addEventListener('click', () => {
  detailEl.classList.remove('open');
  selectedItem = null;
});

['unmarked', 'known', 'learn', 'ignore'].forEach(k => {
  document.getElementById('filter-' + k).addEventListener('change', (e) => {
    if (k === 'unmarked') showUnmarked = e.target.checked;
    if (k === 'known') showKnown = e.target.checked;
    if (k === 'learn') showLearn = e.target.checked;
    if (k === 'ignore') showIgnore = e.target.checked;
    render();
  });
});

document.getElementById('btn-mark-known').addEventListener('click', () => {
  if(!selectedItem) return;
  markers[selectedItem.name + "|||" + selectedItem.quad] = 'known';
  saveMarkers();
  showDetail(selectedItem.name, selectedItem.quad);
  render();
});

document.getElementById('btn-mark-learn').addEventListener('click', () => {
  if(!selectedItem) return;
  markers[selectedItem.name + "|||" + selectedItem.quad] = 'learn';
  saveMarkers();
  showDetail(selectedItem.name, selectedItem.quad);
  render();
});

document.getElementById('btn-mark-ignore').addEventListener('click', () => {
  if(!selectedItem) return;
  markers[selectedItem.name + "|||" + selectedItem.quad] = 'ignore';
  saveMarkers();
  showDetail(selectedItem.name, selectedItem.quad);
  render();
});

document.getElementById('btn-mark-clear').addEventListener('click', () => {
  if(!selectedItem) return;
  delete markers[selectedItem.name + "|||" + selectedItem.quad];
  saveMarkers();
  showDetail(selectedItem.name, selectedItem.quad);
  render();
});

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input')) return;

  const active = document.activeElement;
  let target = hoveredItem || selectedItem;
  if (!target && active && active.classList.contains('item-chip')) {
    target = { name: active.dataset.name, quad: active.dataset.quad };
  }

  if (target) {
    const key = e.key.toLowerCase();
    const mapKey = target.name + "|||" + target.quad;
    let changed = false;
    if (key === '1' || key === 'k') { markers[mapKey] = 'known'; changed = true; }
    else if (key === '2' || key === 'l') { markers[mapKey] = 'learn'; changed = true; }
    else if (key === '3' || key === 'i') { markers[mapKey] = 'ignore'; changed = true; }
    else if (key === '0' || key === 'c' || key === 'backspace') { delete markers[mapKey]; changed = true; }
    
    if (changed) {
      e.preventDefault();
      saveMarkers();
      
      // Save current focus to restore it after render
      const focusedBefore = document.activeElement && document.activeElement.classList.contains('item-chip') ? target : null;
      
      if (selectedItem && selectedItem.name === target.name && selectedItem.quad === target.quad) {
        showDetail(target.name, target.quad);
      }
      render();
      
      // Restore focus
      if (focusedBefore) {
        const esc = focusedBefore.name.replace(/"/g, '&quot;').replace(/</g, '&lt;');
        const newEl = document.querySelector('.item-chip[data-name="' + esc + '"][data-quad="' + focusedBefore.quad + '"]');
        if (newEl) {
          newEl.focus();
          hoveredItem = { name: focusedBefore.name, quad: focusedBefore.quad };
        }
      }
      return;
    }
  }

  if (e.key === 'Escape') {
    detailEl.classList.remove('open');
    selectedItem = null;
    document.getElementById('search').value = '';
    searchQuery = '';
    render();
  }
  if (e.key === 'ArrowLeft' && !e.target.matches('input')) { if (currentVol > 1) { currentVol--; render(); } }
  if (e.key === 'ArrowRight' && !e.target.matches('input')) { if (currentVol < DATA.volumes.length) { currentVol++; render(); } }
});

// ── Init ──────────────────────────────────────────────────────────────────
render();
</script>
</body>
</html>`;
}

main().catch(e => { console.error(e); process.exit(1); });
