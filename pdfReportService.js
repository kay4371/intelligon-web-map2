// ============================================================
// FILE: pdfReportService.js  — Puppeteer HTML-to-PDF Edition
// World-class infographic security intelligence report
// Drop-in replacement: same generateEnhancedReport() + streamToBuffer() API
// ============================================================

const puppeteer   = require('puppeteer-core');
const nodemailer  = require('nodemailer');
const path        = require('path');
const fs          = require('fs');

// ── Chrome path (Windows) ────────────────────────────────────
const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe')
    : '',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
];

function getChromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const p of CHROME_PATHS) { if (p && fs.existsSync(p)) return p; }
  return null;
}

// ── Helpers shared with old service ─────────────────────────
function cleanText(str) {
  return (str || '')
    .replace(/&#8211;/g, '-').replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"').replace(/&#8221;/g, '"')
    .replace(/&#\d+;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/\*\*/g, '')
    .replace(/\*/g, '').trim();
}

function classifyIncident(title, summary) {
  const t = (title + ' ' + (summary || '')).toLowerCase();
  if (t.includes('boko') || t.includes('iswap') || t.includes('terror') ||
      t.includes('bomb') || t.includes('suicide vest') || t.includes('ied'))
    return 'Terrorism';
  if (t.includes('kidnap') || t.includes('abduct') || t.includes('hostage') ||
      t.includes('ransom'))
    return 'Kidnapping';
  if (t.includes('bandit')) return 'Banditry';
  if (t.includes('herdsmen') || t.includes('herder') || t.includes('fulani'))
    return 'Farmer-Herder';
  if (t.includes('communal') || t.includes('ethnic') || t.includes('village attack'))
    return 'Communal Clash';
  if (t.includes('cult') || t.includes('confraternity'))
    return 'Cult Violence';
  if (t.includes('robbery') || t.includes('robbers') || t.includes('gunmen rob'))
    return 'Armed Robbery';
  if (t.includes('soldier') || t.includes('troops') || t.includes('military') ||
      t.includes('army') || t.includes('airstrike'))
    return 'Military Operation';
  return 'Other';
}

function extractState(title, summary) {
  const text = (title + ' ' + (summary || '')).toLowerCase();
  const states = [
    ['Abia','abia'],['Adamawa','adamawa'],['Akwa Ibom','akwa ibom'],
    ['Anambra','anambra'],['Bauchi','bauchi'],['Bayelsa','bayelsa'],
    ['Benue','benue'],['Borno','borno'],['Cross River','cross river'],
    ['Delta','delta'],['Ebonyi','ebonyi'],['Edo','edo'],['Ekiti','ekiti'],
    ['Enugu','enugu'],['Gombe','gombe'],['Imo','imo'],['Jigawa','jigawa'],
    ['Kaduna','kaduna'],['Kano','kano'],['Katsina','katsina'],['Kebbi','kebbi'],
    ['Kogi','kogi'],['Kwara','kwara'],['Lagos','lagos'],['Nasarawa','nasarawa'],
    ['Niger','niger state','niger '],['Ogun','ogun'],['Ondo','ondo'],
    ['Osun','osun'],['Oyo','oyo'],['Plateau','plateau'],['Rivers','rivers'],
    ['Sokoto','sokoto'],['Taraba','taraba'],['Yobe','yobe'],['Zamfara','zamfara'],
    ['FCT','fct','abuja'],
  ];
  for (const [name, ...variants] of states) {
    for (const v of variants) { if (text.includes(v)) return name; }
  }
  return null;
}

function getSeverity(title, summary) {
  const t = (title + ' ' + (summary || '')).toLowerCase();
  if (t.match(/(\d{2,})\s*(kill|dead|casualt)/) || t.includes('massacre'))
    return 'Critical';
  if (t.includes('kill') || t.includes('dead') || t.includes('death'))
    return 'High';
  if (t.includes('injur') || t.includes('abduct') || t.includes('wound'))
    return 'Medium';
  return 'Low';
}

// ── Nigeria SVG map state IDs ─────────────────────────────────
const STATE_SVG_IDS = {
  'Abia':'NG-AB','Adamawa':'NG-AD','Akwa Ibom':'NG-AK','Anambra':'NG-AN',
  'Bauchi':'NG-BA','Benue':'NG-BE','Borno':'NG-BO','Bayelsa':'NG-BY',
  'Cross River':'NG-CR','Delta':'NG-DE','Ebonyi':'NG-EB','Edo':'NG-ED',
  'Ekiti':'NG-EK','Enugu':'NG-EN','FCT':'NG-FC','Gombe':'NG-GO',
  'Imo':'NG-IM','Jigawa':'NG-JI','Kaduna':'NG-KD','Kebbi':'NG-KE',
  'Kano':'NG-KN','Kogi':'NG-KO','Katsina':'NG-KT','Kwara':'NG-KW',
  'Lagos':'NG-LA','Nasarawa':'NG-NA','Niger':'NG-NI','Ogun':'NG-OG',
  'Ondo':'NG-ON','Osun':'NG-OS','Oyo':'NG-OY','Plateau':'NG-PL',
  'Rivers':'NG-RI','Sokoto':'NG-SO','Taraba':'NG-TA','Yobe':'NG-YO',
  'Zamfara':'NG-ZA',
};

const CAT_COLORS = {
  'Terrorism':'#9b5de5','Banditry':'#e63946','Kidnapping':'#f77f00',
  'Communal Clash':'#4361ee','Military Operation':'#2dc653',
  'Armed Robbery':'#fcbf49','Farmer-Herder':'#00b4d8',
  'Cult Violence':'#e040fb','Other':'#8b949e',
};

const CAT_ICONS = {
  'Terrorism':'💥','Banditry':'⚔️','Kidnapping':'🔒',
  'Communal Clash':'🛡️','Military Operation':'🎖️',
  'Armed Robbery':'🔫','Farmer-Herder':'🌾',
  'Cult Violence':'☠️','Other':'📌',
};

// ── Read Nigeria SVG once ─────────────────────────────────────
let NIGERIA_SVG = '';
const svgPath = path.join(__dirname, 'public', 'nigeria-map.svg');
if (fs.existsSync(svgPath)) {
  NIGERIA_SVG = fs.readFileSync(svgPath, 'utf-8');
}

// ═══════════════════════════════════════════════════════════════
class PDFReportService {

  constructor() {
    this.cfg = {
      org:    process.env.ORG_NAME           || 'Suntrenia Intelligence',
      phone:  process.env.CONTACT_PHONE      || '+234 703 499 5589',
      email:  process.env.CONTACT_EMAIL      || 'info@suntrenia.com',
      sender: process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER,
      site:   process.env.WEBSITE            || 'www.suntrenia.com',
    };

    if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
      this.smtp = nodemailer.createTransport({
        host:   process.env.EMAIL_HOST    || 'smtp.gmail.com',
        port:   parseInt(process.env.EMAIL_PORT) || 465,
        secure: process.env.EMAIL_SECURE  === 'true',
        auth:   { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
      });
    }

    if (process.env.BREVO_API_KEY) {
      try {
        const brevo = require('@getbrevo/brevo');
        this.brevo  = new brevo.TransactionalEmailsApi();
        this.brevo.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);
        this.useBrevo = true;
      } catch(e) { this.useBrevo = false; }
    } else {
      this.useBrevo = false;
    }
  }

  validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

  // ──────────────────────────────────────────────────────────
  // MAIN ENTRY POINT  (same signature as old service)
  // ──────────────────────────────────────────────────────────
  async generateEnhancedReport(rawData, opts = {}) {
    const { teaserOnly = false } = opts;
    if (!rawData || typeof rawData !== 'object') throw new Error('Invalid data');

    const incidents = (rawData.incidents || []).slice(0, 50).map(inc => ({
      ...inc,
      title:     cleanText(inc.title),
      summary:   cleanText(inc.summary),
      category:  classifyIncident(inc.title, inc.summary),
      severity:  inc.severity || getSeverity(inc.title, inc.summary),
      stateName: inc.stateName || inc.state || extractState(inc.title, inc.summary) || 'Unknown',
    }));

    const catCounts   = {};
    const stateCounts = {};
    incidents.forEach(inc => {
      catCounts[inc.category] = (catCounts[inc.category] || 0) + 1;
      if (inc.stateName && inc.stateName !== 'Unknown')
        stateCounts[inc.stateName] = (stateCounts[inc.stateName] || 0) + 1;
    });

    const d = {
      ...rawData, incidents, catCounts, stateCounts,
      statesAffected: rawData.statesAffected || Object.keys(stateCounts).length,
      casualties:     rawData.casualties  || 0,
      abductions:     rawData.abductions  || 0,
    };

    const html = this._buildHTML(d, teaserOnly);

    // Return a pseudo-doc with the html — actual PDF generated in streamToBuffer
    return { _html: html, _teaserOnly: teaserOnly };
  }

  // ──────────────────────────────────────────────────────────
  // streamToBuffer  (replaces the old PDFKit pipe)
  // ──────────────────────────────────────────────────────────
  async streamToBuffer(doc) {
    const html = doc._html;
    if (!html) throw new Error('No HTML — call generateEnhancedReport first');

    const chromePath = getChromePath();
    if (!chromePath) throw new Error('Chrome not found. Set CHROME_PATH env var.');

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        executablePath: chromePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu',
               '--disable-dev-shm-usage'],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
      // Wait for Chart.js to render
      await page.waitForTimeout(1500);

      const pdf = await page.pdf({
        format:          'A4',
        printBackground: true,
        margin:          { top: '0', right: '0', bottom: '0', left: '0' },
      });
      return Buffer.from(pdf);
    } finally {
      if (browser) await browser.close();
    }
  }

  // ══════════════════════════════════════════════════════════
  // HTML BUILDER — all pages in one HTML document
  // ══════════════════════════════════════════════════════════
  _buildHTML(d, teaserOnly) {
    const now    = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const period = `${this._fmtDate(weekAgo)} — ${this._fmtDate(now)}`;

    const incCount    = d.incidents.length;
    const { lvlColor, lvlLabel, lvlDesc } = this._threatLevel(incCount);

    const sortedCats   = Object.entries(d.catCounts).sort((a,b)=>b[1]-a[1]);
    const topStates    = Object.entries(d.stateCounts).sort((a,b)=>b[1]-a[1]).slice(0,10);
    const totalInc     = incCount || 1;

    // Build daily trend (distribute incidents across 7 days)
    const daily = new Array(7).fill(0);
    if (d.trendData?.data?.length > 0) {
      d.trendData.data.slice(0,7).forEach((v,i) => { daily[i]=v; });
    } else {
      d.incidents.forEach((inc,i) => { daily[i % 7]++; });
    }

    // Choropleth SVG
    const mapSvg = this._buildChoropleth(d.stateCounts);

    // Highlights
    const highlights = this._highlights(d);

    // Zones
    const zones = this._buildZones(d.stateCounts);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Inter:wght@300;400;600;700;900&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
@page { size: A4; margin: 0; }

:root {
  --bg:       #0d1117;
  --card:     #161b22;
  --cardalt:  #1c2333;
  --dark:     #0f1923;
  --accent:   #e63946;
  --orange:   #f77f00;
  --yellow:   #e3b341;
  --blue:     #4361ee;
  --green:    #2dc653;
  --purple:   #9b5de5;
  --teal:     #00b4d8;
  --text:     #f0f6fc;
  --sub:      #8b949e;
  --muted:    #484f58;
  --border:   #30363d;
}

body {
  font-family: 'Inter', sans-serif;
  background: var(--bg);
  color: var(--text);
  width: 210mm;
}

/* ── PAGE BREAKS ─────────────────────────────────── */
.page {
  width: 210mm;
  min-height: 297mm;
  position: relative;
  overflow: hidden;
  page-break-after: always;
  background: var(--bg);
}
.page-light { background: #f4f6f8; color: #1a1a2e; }

/* ── COMMON ──────────────────────────────────────── */
.page-header {
  background: var(--dark);
  border-top: 5px solid var(--accent);
  padding: 12px 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.page-header h2 {
  font-family: 'Oswald', sans-serif;
  font-size: 15px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--text);
}
.page-header .page-num {
  font-size: 9px;
  color: var(--sub);
  letter-spacing: 1px;
}
.section-title {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--sub);
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border);
}
.footer {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  background: var(--dark);
  border-top: 1px solid var(--border);
  padding: 8px 28px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 8px;
  color: var(--muted);
}

/* ═══════════════════════════════════════════
   PAGE 1 — COVER DASHBOARD
═══════════════════════════════════════════ */
#p1 { background: var(--bg); }

.cover-stripe {
  height: 5px;
  background: linear-gradient(90deg, var(--accent) 0%, var(--orange) 50%, var(--purple) 100%);
}
.cover-header {
  background: var(--dark);
  padding: 16px 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.logo-area { display: flex; align-items: center; gap: 14px; }
.logo-shield {
  width: 50px; height: 60px;
  background: rgba(230,57,70,0.12);
  border: 1.5px solid var(--accent);
  clip-path: polygon(50% 0%, 100% 20%, 100% 65%, 50% 100%, 0% 65%, 0% 20%);
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; font-weight: 900; color: var(--accent);
  font-family: 'Oswald', sans-serif;
}
.logo-text h1 {
  font-family: 'Oswald', sans-serif;
  font-size: 28px; letter-spacing: 3px;
  color: var(--text);
}
.logo-text p {
  font-size: 8px; letter-spacing: 3px;
  color: var(--accent); margin-top: 2px;
}
.confidential-badge {
  border: 1.5px solid var(--accent);
  background: rgba(230,57,70,0.1);
  padding: 8px 16px; text-align: center; border-radius: 2px;
}
.confidential-badge .conf-label {
  font-size: 11px; font-weight: 800;
  color: var(--accent); letter-spacing: 2px;
}
.confidential-badge .conf-sub {
  font-size: 8px; color: #ffaaaa; letter-spacing: 1px;
}

.report-title-band {
  background: #1c1228;
  padding: 14px 28px;
  text-align: center;
  border-bottom: 1px solid #3a2040;
}
.report-title-band h2 {
  font-family: 'Oswald', sans-serif;
  font-size: 14px; letter-spacing: 2px;
  text-transform: uppercase; color: var(--text);
}
.report-title-band p {
  font-size: 9px; color: var(--sub); margin-top: 3px;
}
.period-badge {
  display: inline-block;
  background: rgba(230,57,70,0.15);
  border: 1px solid rgba(230,57,70,0.4);
  padding: 4px 16px; border-radius: 20px;
  font-size: 9px; color: #ffbbbb; letter-spacing: 1px;
  margin-top: 6px;
}

/* Metric cards */
.metric-row {
  display: flex; gap: 10px; padding: 16px 28px;
}
.metric-card {
  flex: 1; border-radius: 4px; overflow: hidden;
  background: var(--card);
  border: 1px solid var(--border);
  padding: 14px 12px;
  position: relative;
}
.metric-card .mc-top-bar {
  position: absolute; top: 0; left: 0; right: 0; height: 3px;
}
.metric-card .mc-icon { font-size: 22px; margin-bottom: 6px; }
.metric-card .mc-value {
  font-family: 'Oswald', sans-serif;
  font-size: 38px; font-weight: 700; line-height: 1;
}
.metric-card .mc-label {
  font-size: 8px; font-weight: 700; letter-spacing: 2px;
  text-transform: uppercase; margin-top: 5px;
}
.metric-card .mc-sub { font-size: 8px; color: var(--sub); margin-top: 2px; }

/* Threat banner */
.threat-banner {
  margin: 0 28px;
  padding: 12px 16px;
  display: flex; align-items: center; gap: 16px;
  border-radius: 4px; border-left: 5px solid;
}
.threat-banner .tb-label {
  font-family: 'Oswald', sans-serif;
  font-size: 14px; letter-spacing: 1px;
}
.threat-banner .tb-desc { font-size: 9px; color: var(--sub); margin-top: 2px; }
.threat-steps { display: flex; align-items: flex-end; gap: 3px; margin-left: auto; }
.threat-step { width: 12px; border-radius: 2px 2px 0 0; }

/* Category bars on cover */
.cat-section { padding: 14px 28px 8px; }
.cat-row {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 8px;
}
.cat-icon { font-size: 14px; width: 18px; text-align: center; }
.cat-name { font-size: 9px; font-weight: 700; width: 120px; letter-spacing: 0.5px; }
.cat-bar-track { flex: 1; height: 12px; border-radius: 2px; background: rgba(255,255,255,0.06); }
.cat-bar-fill { height: 100%; border-radius: 2px; }
.cat-count-badge {
  font-size: 8px; font-weight: 700; padding: 2px 8px;
  border-radius: 10px; min-width: 48px; text-align: center;
}

/* Hotspot chips */
.hotspot-row {
  display: flex; gap: 8px;
  padding: 0 28px 16px;
}
.hs-chip {
  flex: 1; border-radius: 4px; overflow: hidden;
  text-align: center; padding: 10px 6px 8px;
  border: 1px solid; position: relative;
}
.hs-rank {
  font-size: 8px; font-weight: 700; letter-spacing: 1px;
  position: absolute; top: 5px; left: 7px;
  padding: 1px 5px; border-radius: 8px;
}
.hs-name { font-family: 'Oswald', sans-serif; font-size: 11px; font-weight: 600; margin-top: 14px; }
.hs-num { font-family: 'Oswald', sans-serif; font-size: 28px; font-weight: 700; line-height: 1; }
.hs-sub { font-size: 7px; color: var(--sub); }

/* ═══════════════════════════════════════════
   PAGE 2 — MAP + ZONE GRID
═══════════════════════════════════════════ */
.map-container {
  padding: 14px 28px;
  display: flex; gap: 16px;
}
.map-svg-wrap {
  flex: 2;
}
.map-svg-wrap svg {
  width: 100%; height: auto;
  max-height: 340px;
}
.map-legend { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.legend-title {
  font-size: 9px; font-weight: 700; letter-spacing: 2px;
  text-transform: uppercase; color: var(--sub); margin-bottom: 4px;
}
.legend-item { display: flex; align-items: center; gap: 8px; font-size: 9px; }
.legend-swatch { width: 14px; height: 14px; border-radius: 2px; }
.zone-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 8px; padding: 0 28px 14px;
}
.zone-card {
  border-radius: 4px; padding: 10px 12px;
  border: 1px solid; position: relative; overflow: hidden;
}
.zone-card .zone-name {
  font-family: 'Oswald', sans-serif;
  font-size: 10px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;
}
.zone-card .zone-stats { font-size: 9px; color: var(--sub); margin-top: 3px; }
.zone-card .zone-badge {
  position: absolute; top: 10px; right: 10px;
  font-size: 8px; font-weight: 800; padding: 2px 8px;
  border-radius: 10px; letter-spacing: 1px;
}
.state-dots { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
.state-dot {
  width: 20px; height: 20px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 5px; font-weight: 700; color: #fff;
}

/* ═══════════════════════════════════════════
   PAGE 3 — CHARTS
═══════════════════════════════════════════ */
.charts-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 14px; padding: 14px 28px;
}
.chart-card {
  background: var(--card); border: 1px solid var(--border);
  border-radius: 6px; padding: 14px;
}
.chart-card h3 {
  font-size: 9px; font-weight: 700; letter-spacing: 2px;
  text-transform: uppercase; color: var(--sub); margin-bottom: 12px;
  padding-bottom: 6px; border-bottom: 1px solid var(--border);
}
.chart-full {
  grid-column: 1 / -1;
}
canvas { max-width: 100%; }

/* Stacked proportional bar */
.prop-bar { display: flex; height: 28px; border-radius: 4px; overflow: hidden; margin-bottom: 8px; }
.prop-seg { display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 700; color: rgba(255,255,255,0.9); }
.prop-legend { display: flex; flex-wrap: wrap; gap: 10px; }
.prop-legend-item { display: flex; align-items: center; gap: 5px; font-size: 8px; }
.prop-legend-dot { width: 10px; height: 10px; border-radius: 2px; }

/* ═══════════════════════════════════════════
   PAGE 4 — SITUATION REPORT (light bg)
═══════════════════════════════════════════ */
.sitrep-header {
  background: #1a252f;
  border-top: 5px solid var(--accent);
  padding: 14px 28px;
  display: flex; justify-content: space-between; align-items: center;
}
.sitrep-header h2 {
  font-family: 'Oswald', sans-serif;
  font-size: 13px; color: #fff; letter-spacing: 2px;
}
.sitrep-header .sr-meta { font-size: 9px; color: #8ab4d4; }

.highlights-box {
  margin: 14px 28px 12px;
  border: 1px solid #dee2e6; border-radius: 4px; overflow: hidden;
}
.highlights-box .hl-header {
  background: #1a252f; color: #fff;
  font-size: 9px; font-weight: 700; letter-spacing: 2px;
  padding: 6px 14px;
}
.highlights-box .hl-body { padding: 12px 14px; background: #fff; }
.hl-item {
  display: flex; gap: 10px; margin-bottom: 10px;
  font-size: 9.5px; color: #2c3e50; line-height: 1.5;
}
.hl-dot {
  width: 12px; height: 12px; border-radius: 50%;
  background: var(--accent); flex-shrink: 0; margin-top: 2px;
}

.sitrep-body { padding: 0 28px; }
.sitrep-body h3 {
  font-size: 14px; font-weight: 800; color: #2c3e50; margin-bottom: 4px;
}
.sitrep-body .sr-underline {
  height: 2px; background: var(--accent); margin-bottom: 10px;
}
.sitrep-body .sr-sub { font-size: 10px; font-weight: 700; color: #555; margin-bottom: 6px; }
.sitrep-body p {
  font-size: 9.5px; color: #34495e; line-height: 1.7;
  text-align: justify; margin-bottom: 10px;
}

.ai-box {
  margin: 10px 28px;
  border-left: 4px solid var(--blue);
  background: #eef2ff; border-radius: 0 4px 4px 0;
  padding: 12px 14px;
}
.ai-box .ai-label {
  font-size: 8px; font-weight: 800; letter-spacing: 2px;
  color: var(--blue); margin-bottom: 6px;
}
.ai-box p { font-size: 9px; color: #2c3e50; line-height: 1.6; }

/* ═══════════════════════════════════════════
   PAGE 5 — INCIDENT DIGEST
═══════════════════════════════════════════ */
.incident-list { padding: 10px 28px; }
.incident-card {
  display: flex; gap: 0;
  background: var(--card); border: 1px solid var(--border);
  border-radius: 4px; margin-bottom: 8px; overflow: hidden;
}
.inc-severity-bar { width: 5px; flex-shrink: 0; }
.inc-body { flex: 1; padding: 9px 12px; }
.inc-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.inc-title { font-size: 9px; font-weight: 700; color: var(--text); flex: 1; line-height: 1.4; }
.inc-badges { display: flex; gap: 5px; flex-shrink: 0; }
.inc-cat-badge, .inc-sev-badge {
  font-size: 7px; font-weight: 700; padding: 2px 7px;
  border-radius: 10px; letter-spacing: 0.5px;
}
.inc-summary { font-size: 8px; color: var(--sub); margin-top: 5px; line-height: 1.5; }
.inc-meta { font-size: 7.5px; color: var(--muted); margin-top: 5px; display: flex; gap: 12px; }
.inc-num {
  width: 26px; flex-shrink: 0; display: flex;
  align-items: center; justify-content: center;
  font-family: 'Oswald', sans-serif; font-size: 12px;
  background: rgba(255,255,255,0.04); color: var(--sub);
}

/* ═══════════════════════════════════════════
   PAGE 6 — RECOMMENDATIONS
═══════════════════════════════════════════ */
.recs-section { padding: 14px 28px; }
.rec-card {
  display: flex; gap: 12px; align-items: flex-start;
  background: var(--card); border: 1px solid var(--border);
  border-radius: 4px; padding: 12px 14px; margin-bottom: 10px;
}
.rec-num {
  width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Oswald', sans-serif; font-size: 14px; font-weight: 700; color: #fff;
}
.rec-text { font-size: 10px; color: var(--text); line-height: 1.6; }
.rec-text strong { color: var(--yellow); }

.sources-box {
  margin: 12px 28px;
  background: var(--card); border: 1px solid var(--border); border-radius: 4px;
  padding: 12px 14px;
}
.sources-box h4 { font-size: 9px; font-weight: 700; letter-spacing: 2px; color: var(--sub); margin-bottom: 8px; }
.sources-box p { font-size: 8px; color: var(--muted); line-height: 1.6; }
</style>
</head>
<body>

<!-- ═══════════════════════════════════════
     PAGE 1 — COVER DASHBOARD
═══════════════════════════════════════ -->
<div class="page" id="p1">
  <div class="cover-stripe"></div>

  <div class="cover-header">
    <div class="logo-area">
      <div class="logo-shield">S</div>
      <div class="logo-text">
        <h1>SUNTRENIA</h1>
        <p>INTELLIGENCE PLATFORM  &nbsp;|&nbsp;  NIGERIA SECURITY MONITOR</p>
      </div>
    </div>
    <div class="confidential-badge">
      <div class="conf-label">CONFIDENTIAL</div>
      <div class="conf-sub">RESTRICTED ACCESS</div>
    </div>
  </div>

  <div class="report-title-band">
    <h2>WEEKLY SECURITY INTELLIGENCE REPORT</h2>
    <p>Nigeria — All 36 States + FCT  &nbsp;|&nbsp;  Multi-Source OSINT / AI Analysis</p>
    <div class="period-badge">📅 &nbsp; REPORTING PERIOD:  ${period}</div>
  </div>

  <!-- Metric Cards -->
  <div class="metric-row">
    ${this._metricCard(d.incidents.length, 'INCIDENTS', 'recorded this week', '💥', '#e63946')}
    ${this._metricCard(d.statesAffected, 'STATES HIT', 'affected', '📍', '#f77f00')}
    ${this._metricCard(d.casualties, 'CASUALTIES', 'est. deaths/injuries', '🏥', '#da3633')}
    ${this._metricCard(d.abductions, 'ABDUCTED', 'persons reported', '🔒', '#9b5de5')}
  </div>

  <!-- Threat Level Banner -->
  <div class="threat-banner" style="background:${lvlColor}18; border-color:${lvlColor}; margin-bottom:14px;">
    <div style="font-size:24px">⚠️</div>
    <div>
      <div class="tb-label" style="color:${lvlColor}">THREAT LEVEL: ${lvlLabel}</div>
      <div class="tb-desc">${lvlDesc}</div>
    </div>
    <div class="threat-steps">
      ${[1,2,3,4].map(i => `<div class="threat-step" style="height:${10+i*7}px; background:${i<=['LOW','MODERATE','HIGH','CRITICAL'].indexOf(lvlLabel)+1 ? lvlColor : lvlColor+'33'}"></div>`).join('')}
    </div>
  </div>

  <!-- Category Breakdown -->
  <div class="cat-section">
    <div class="section-title">INCIDENT CATEGORY BREAKDOWN</div>
    ${sortedCats.slice(0,6).map(([cat, count]) => {
      const col = CAT_COLORS[cat] || '#8b949e';
      const pct = ((count/totalInc)*100).toFixed(0);
      const bw  = (count/(sortedCats[0]?.[1]||1))*100;
      return `
      <div class="cat-row">
        <span class="cat-icon">${CAT_ICONS[cat]||'📌'}</span>
        <span class="cat-name" style="color:${col}">${cat.toUpperCase()}</span>
        <div class="cat-bar-track">
          <div class="cat-bar-fill" style="width:${bw}%; background:${col}cc"></div>
        </div>
        <span class="cat-count-badge" style="background:${col}25; color:${col}; border:1px solid ${col}55">
          ${count} &nbsp;·&nbsp; ${pct}%
        </span>
      </div>`;
    }).join('')}
  </div>

  <!-- Hotspot States -->
  ${topStates.length > 0 ? `
  <div class="cat-section" style="padding-bottom:0">
    <div class="section-title">TOP HOTSPOT STATES</div>
  </div>
  <div class="hotspot-row">
    ${topStates.slice(0,5).map(([state, count], i) => {
      const cols = ['#e63946','#f77f00','#e3b341','#4361ee','#2dc653'];
      const col  = cols[i];
      return `
      <div class="hs-chip" style="background:${col}10; border-color:${col}50">
        <span class="hs-rank" style="background:${col}; color:#fff">#${i+1}</span>
        <div class="hs-name" style="color:${col}">${state.toUpperCase()}</div>
        <div class="hs-num" style="color:${col}">${count}</div>
        <div class="hs-sub">incidents</div>
      </div>`;
    }).join('')}
  </div>` : ''}

  <div class="footer">
    <span>${this.cfg.org}  |  ${this.cfg.site}  |  ${this.cfg.phone}</span>
    <span>Generated: ${now.toLocaleString('en-NG', {timeZone:'Africa/Lagos'})}  |  Classification: CONFIDENTIAL  |  Page 1 of 6</span>
  </div>
</div>

<!-- ═══════════════════════════════════════
     PAGE 2 — GEOGRAPHIC THREAT MAP
═══════════════════════════════════════ -->
<div class="page" id="p2">
  <div class="page-header">
    <h2>GEOGRAPHIC THREAT ASSESSMENT</h2>
    <span class="page-num">PAGE 2 OF 6  |  ${this.cfg.org}  |  CONFIDENTIAL</span>
  </div>

  <div class="map-container">
    <div class="map-svg-wrap">${mapSvg}</div>
    <div class="map-legend">
      <div class="legend-title">THREAT LEVEL LEGEND</div>
      <div class="legend-item"><div class="legend-swatch" style="background:#3fb950"></div><span>Low (0–2 incidents)</span></div>
      <div class="legend-item"><div class="legend-swatch" style="background:#e3b341"></div><span>Moderate (3–5)</span></div>
      <div class="legend-item"><div class="legend-swatch" style="background:#e85c0d"></div><span>High (6–9)</span></div>
      <div class="legend-item"><div class="legend-swatch" style="background:#da3633"></div><span>Critical (10+)</span></div>
      <div class="legend-item"><div class="legend-swatch" style="background:#30363d"></div><span>No incidents</span></div>
      <div style="margin-top:14px; padding-top:10px; border-top:1px solid var(--border)">
        <div class="legend-title" style="margin-bottom:8px">TOP STATES</div>
        ${topStates.slice(0,8).map(([state, count], i) => {
          const col = count >= 5 ? '#da3633' : count >= 3 ? '#e3b341' : '#3fb950';
          return `<div class="legend-item" style="margin-bottom:5px">
            <div class="legend-swatch" style="background:${col}"></div>
            <span style="flex:1">${state}</span>
            <strong style="color:${col}">${count}</strong>
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>

  <div style="padding: 0 28px 10px">
    <div class="section-title">GEOPOLITICAL ZONE RISK ASSESSMENT</div>
  </div>
  <div class="zone-grid">
    ${zones.map(z => `
    <div class="zone-card" style="background:${z.color}12; border-color:${z.color}40">
      <span class="zone-badge" style="background:${z.color}; color:#fff">${z.label}</span>
      <div class="zone-name" style="color:${z.color}">${z.name}</div>
      <div class="zone-stats">${z.affected} of ${z.total} states with incidents</div>
      <div class="state-dots">
        ${z.states.map(s => {
          const aff = z.affectedStates.has(s.toLowerCase());
          return `<div class="state-dot" style="background:${aff ? z.color : z.color+'22'}; border: 1px solid ${z.color}55" title="${s}">${s.slice(0,2).toUpperCase()}</div>`;
        }).join('')}
      </div>
    </div>`).join('')}
  </div>

  <div class="footer">
    <span>${this.cfg.org}  |  ${this.cfg.site}  |  ${this.cfg.phone}</span>
    <span>Generated: ${now.toLocaleString('en-NG',{timeZone:'Africa/Lagos'})}  |  CONFIDENTIAL  |  Page 2 of 6</span>
  </div>
</div>

<!-- ═══════════════════════════════════════
     PAGE 3 — CHARTS & ANALYSIS
═══════════════════════════════════════ -->
<div class="page" id="p3">
  <div class="page-header">
    <h2>THREAT CATEGORY ANALYSIS & TRENDS</h2>
    <span class="page-num">PAGE 3 OF 6  |  ${this.cfg.org}  |  CONFIDENTIAL</span>
  </div>

  <div class="charts-grid">
    <!-- Donut chart -->
    <div class="chart-card">
      <h3>Threat Category Distribution</h3>
      <canvas id="donutChart" height="180"></canvas>
    </div>

    <!-- Bar chart: top states -->
    <div class="chart-card">
      <h3>Incidents by State (Top 10)</h3>
      <canvas id="stateBar" height="180"></canvas>
    </div>

    <!-- 7-day trend (full width) -->
    <div class="chart-card chart-full">
      <h3>7-Day Incident Frequency Trend</h3>
      <canvas id="trendChart" height="110"></canvas>
    </div>
  </div>

  <!-- Proportional bar -->
  <div style="padding: 0 28px 14px">
    <div class="section-title">PROPORTIONAL THREAT DISTRIBUTION</div>
    <div class="prop-bar">
      ${sortedCats.map(([cat, count]) => {
        const col = CAT_COLORS[cat] || '#8b949e';
        const pct = (count/totalInc)*100;
        return `<div class="prop-seg" style="width:${pct}%; background:${col}cc; min-width:${pct>3?'auto':'0'}">${pct>5 ? Math.round(pct)+'%' : ''}</div>`;
      }).join('')}
    </div>
    <div class="prop-legend">
      ${sortedCats.map(([cat]) => `
      <div class="prop-legend-item">
        <div class="prop-legend-dot" style="background:${CAT_COLORS[cat]||'#8b949e'}"></div>
        <span>${cat}</span>
      </div>`).join('')}
    </div>
  </div>

  <div class="footer">
    <span>${this.cfg.org}  |  ${this.cfg.site}</span>
    <span>CONFIDENTIAL  |  Page 3 of 6</span>
  </div>
</div>

<!-- ═══════════════════════════════════════
     PAGE 4 — SITUATION REPORT (OCHA style)
═══════════════════════════════════════ -->
<div class="page page-light" id="p4">
  <div class="sitrep-header">
    <h2>${this.cfg.org.toUpperCase()}  |  SITUATION REPORT</h2>
    <div class="sr-meta">Week of ${now.toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}  |  Page 4 of 6  |  CONFIDENTIAL</div>
  </div>

  <div class="highlights-box">
    <div class="hl-header">HIGHLIGHTS</div>
    <div class="hl-body">
      ${highlights.map(h => `
      <div class="hl-item">
        <div class="hl-dot"></div>
        <span>${h}</span>
      </div>`).join('')}
    </div>
  </div>

  <div class="sitrep-body">
    <h3>BACKGROUND</h3>
    <div class="sr-underline"></div>
    <div class="sr-sub">Situation Overview</div>
    <p>${cleanText(d.aiBriefing || 'Security conditions across Nigeria during the reporting period reflect ongoing multidimensional threats. Incidents spanning terrorism, banditry, kidnapping, and communal violence continue to affect multiple states. Law enforcement and military operations are ongoing across identified hotspot zones. Displacement and humanitarian access constraints persist in the most affected areas.')}</p>

    ${d.stateRiskAnalyses?.slice(0,2).map(a => `
    <div class="sr-sub">Hotspot Analysis: ${a.stateName || ''}</div>
    <p>${cleanText(a.analysis || '').substring(0,400)}</p>
    `).join('') || ''}
  </div>

  <div class="ai-box">
    <div class="ai-label">🤖  AI INTELLIGENCE ASSESSMENT</div>
    <p>${cleanText(d.executiveBrief || d.aiBriefing || 'Pattern recognition suggests concentrated threat activity in the northern geopolitical zones. Multi-source analysis indicates elevated operational tempo among non-state armed groups. Cross-border movements and internal displacement continue to exacerbate existing vulnerabilities. Longitudinal comparison suggests evolving operational tactics.').substring(0,500)}</p>
  </div>

  <div class="footer" style="background:#1a252f; color:#8ab4d4">
    <span>${this.cfg.org}  |  ${this.cfg.site}  |  ${this.cfg.phone}</span>
    <span>CONFIDENTIAL  |  Page 4 of 6</span>
  </div>
</div>

<!-- ═══════════════════════════════════════
     PAGE 5 — INCIDENT INTELLIGENCE DIGEST
═══════════════════════════════════════ -->
<div class="page" id="p5">
  <div class="page-header">
    <h2>INCIDENT INTELLIGENCE DIGEST</h2>
    <span class="page-num">PAGE 5 OF 6  |  ${this.cfg.org}  |  CONFIDENTIAL</span>
  </div>

  <div class="incident-list">
    ${d.incidents.slice(0, 8).map((inc, i) => {
      const sCol = {Critical:'#da3633',High:'#e85c0d',Medium:'#e3b341',Low:'#3fb950'}[inc.severity] || '#8b949e';
      const cCol = CAT_COLORS[inc.category] || '#8b949e';
      const title = inc.title.substring(0,90) + (inc.title.length>90?'…':'');
      const summary = (inc.summary||'No summary available.').substring(0,160);
      return `
      <div class="incident-card">
        <div class="inc-num">${i+1}</div>
        <div class="inc-severity-bar" style="background:${sCol}"></div>
        <div class="inc-body">
          <div class="inc-top">
            <div class="inc-title">${title}</div>
            <div class="inc-badges">
              <span class="inc-cat-badge" style="background:${cCol}25; color:${cCol}; border:1px solid ${cCol}50">${inc.category.substring(0,10)}</span>
              <span class="inc-sev-badge" style="background:${sCol}; color:#fff">${inc.severity.toUpperCase()}</span>
            </div>
          </div>
          <div class="inc-summary">${summary}</div>
          <div class="inc-meta">
            ${inc.stateName && inc.stateName !== 'Unknown' ? `<span>📍 ${inc.stateName}</span>` : ''}
            ${inc.source ? `<span>🔗 ${inc.source}</span>` : ''}
            <span>🕐 ${new Date(inc.timestamp||Date.now()).toLocaleDateString('en-GB')}</span>
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>

  <div class="footer">
    <span>${this.cfg.org}  |  ${this.cfg.site}  |  ${this.cfg.phone}</span>
    <span>CONFIDENTIAL  |  Page 5 of 6</span>
  </div>
</div>

<!-- ═══════════════════════════════════════
     PAGE 6 — RECOMMENDATIONS + SOURCES
═══════════════════════════════════════ -->
<div class="page" id="p6">
  <div class="page-header">
    <h2>STATE RISK ASSESSMENT & STRATEGIC RECOMMENDATIONS</h2>
    <span class="page-num">PAGE 6 OF 6  |  ${this.cfg.org}  |  CONFIDENTIAL</span>
  </div>

  <div class="recs-section">
    <div class="section-title">STRATEGIC RECOMMENDATIONS</div>
    ${(d.recommendations || [
      'Strengthen inter-agency security coordination and real-time intelligence sharing in critical risk states.',
      'Enhance community intelligence networks and establish early-warning systems in identified hotspot zones.',
      'Deploy rapid response capability and reinforce security presence in north-west and north-east corridors.',
      'Increase surveillance, monitoring, and patrols along identified conflict flashpoints and transit routes.',
      'Implement proactive humanitarian contingency planning and resource pre-positioning in affected states.',
    ]).slice(0,5).map((rec, i) => {
      const cols = ['#e63946','#f77f00','#e3b341','#4361ee','#2dc653'];
      return `
      <div class="rec-card">
        <div class="rec-num" style="background:${cols[i]}">${i+1}</div>
        <div class="rec-text">${cleanText(rec)}</div>
      </div>`;
    }).join('')}
  </div>

  ${d.stateRiskAnalyses?.length > 0 ? `
  <div class="recs-section" style="padding-top:4px">
    <div class="section-title">STATE RISK PROFILES</div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px">
      ${d.stateRiskAnalyses.slice(0,4).map(a => {
        const rCol = {Critical:'#da3633',High:'#e85c0d',Medium:'#e3b341',Low:'#3fb950'}[a.riskLevel] || '#8b949e';
        return `
        <div style="background:var(--card); border:1px solid ${rCol}50; border-left:4px solid ${rCol}; border-radius:4px; padding:10px 12px">
          <div style="font-weight:700; font-size:10px; color:${rCol}">${a.stateName}</div>
          <div style="font-size:8px; color:var(--sub); margin:3px 0">${a.riskLevel||'?'} RISK  ·  ${a.incidentCount||0} incidents</div>
          <div style="font-size:8px; color:var(--muted); line-height:1.5">${cleanText(a.analysis||'').substring(0,120)}…</div>
        </div>`;
      }).join('')}
    </div>
  </div>` : ''}

  <div class="sources-box">
    <h4>DATA SOURCES & METHODOLOGY</h4>
    <p>This report is generated from open-source intelligence (OSINT) including verified Nigerian news sources, official government statements, NGO field reports, and community intelligence feeds. Data is processed through AI classification algorithms for incident categorisation and threat assessment. All information is collated within a 7-day reporting window. For informational purposes only — distribution restricted to authorised recipients.</p>
  </div>

  <div class="footer">
    <span>${this.cfg.org}  |  ${this.cfg.site}  |  ${this.cfg.phone}  |  ${this.cfg.email}</span>
    <span>Generated: ${now.toLocaleString('en-NG',{timeZone:'Africa/Lagos'})}  |  CONFIDENTIAL  |  Page 6 of 6</span>
  </div>
</div>

<!-- ═══════════════════════════════════════
     CHART.JS INITIALISATION
═══════════════════════════════════════ -->
<script>
(function() {
  const C = { accent:'#e63946', orange:'#f77f00', yellow:'#e3b341',
              blue:'#4361ee', green:'#2dc653', purple:'#9b5de5',
              teal:'#00b4d8', sub:'#8b949e', border:'#30363d', text:'#f0f6fc' };

  const catData  = ${JSON.stringify(sortedCats)};
  const stateData = ${JSON.stringify(topStates)};
  const daily    = ${JSON.stringify(daily)};
  const catColors = ${JSON.stringify(CAT_COLORS)};

  Chart.defaults.color = C.sub;
  Chart.defaults.font  = { family: 'Inter', size: 9 };

  // ── Donut ──
  new Chart(document.getElementById('donutChart'), {
    type: 'doughnut',
    data: {
      labels: catData.map(c=>c[0]),
      datasets: [{ data: catData.map(c=>c[1]),
        backgroundColor: catData.map(c => catColors[c[0]] || C.sub),
        borderColor: '#161b22', borderWidth: 2 }]
    },
    options: {
      animation: false, cutout: '60%',
      plugins: {
        legend: { position:'right', labels:{ boxWidth:10, padding:8, font:{size:8} } }
      }
    }
  });

  // ── State Bar ──
  new Chart(document.getElementById('stateBar'), {
    type: 'bar',
    data: {
      labels: stateData.map(s=>s[0]),
      datasets: [{
        data: stateData.map(s=>s[1]),
        backgroundColor: stateData.map((_,i) => {
          const p=['#e63946','#f77f00','#e3b341','#4361ee','#2dc653','#9b5de5','#00b4d8','#fcbf49','#e040fb','#8b949e'];
          return p[i%p.length];
        }),
        borderRadius: 3, barPercentage: 0.7
      }]
    },
    options: {
      animation: false, indexAxis: 'y',
      plugins: { legend:{ display:false } },
      scales: {
        x: { grid:{ color:C.border }, ticks:{ font:{size:8} } },
        y: { grid:{ display:false }, ticks:{ font:{size:8} } }
      }
    }
  });

  // ── Trend ──
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const maxV = Math.max(...daily, 1);
  new Chart(document.getElementById('trendChart'), {
    type: 'bar',
    data: {
      labels: days,
      datasets: [{
        type: 'line',
        data: daily, borderColor: C.orange, backgroundColor: 'transparent',
        borderWidth: 2, pointRadius: 4,
        pointBackgroundColor: daily.map(v => v >= maxV*0.7 ? '#da3633' : v >= maxV*0.4 ? C.yellow : C.blue),
        tension: 0.4, order: 1
      }, {
        type: 'bar',
        data: daily,
        backgroundColor: daily.map(v => v >= maxV*0.7 ? '#da363360' : v >= maxV*0.4 ? C.yellow+'60' : C.blue+'60'),
        borderRadius: 3, barPercentage: 0.5, order: 2
      }]
    },
    options: {
      animation: false,
      plugins: { legend:{ display:false } },
      scales: {
        y: { grid:{ color:C.border }, ticks:{ font:{size:8} } },
        x: { grid:{ display:false }, ticks:{ font:{size:9} } }
      }
    }
  });
})();
</script>
</body>
</html>`;
  }

  // ── Helper: metric card ──────────────────────────────────────
  _metricCard(value, label, sub, icon, color) {
    return `
    <div class="metric-card">
      <div class="mc-top-bar" style="background:${color}"></div>
      <div class="mc-icon">${icon}</div>
      <div class="mc-value" style="color:${color}">${value}</div>
      <div class="mc-label" style="color:${color}">${label}</div>
      <div class="mc-sub">${sub}</div>
    </div>`;
  }

  // ── Choropleth SVG ────────────────────────────────────────────
  _buildChoropleth(stateCounts) {
    if (!NIGERIA_SVG) {
      return `<div style="background:#161b22; border:1px solid #30363d; height:300px; display:flex; align-items:center; justify-content:center; color:#484f58; font-size:11px">Map SVG not found — place nigeria-map.svg in /public/</div>`;
    }

    const maxCount = Math.max(...Object.values(stateCounts), 1);

    const getColor = (count) => {
      if (!count) return '#1c2333';
      if (count >= 10) return '#da3633';
      if (count >= 6)  return '#e85c0d';
      if (count >= 3)  return '#e3b341';
      return '#3fb950';
    };

    let svg = NIGERIA_SVG
      .replace(/<style[^>]*>[\s\S]*?<\/style>/i, '')
      .replace(/\.land\s*\{[^}]*\}/g, '');

    // Colour each state path
    for (const [stateName, svgId] of Object.entries(STATE_SVG_IDS)) {
      const count = stateCounts[stateName] || 0;
      const fill  = getColor(count);
      const stroke = '#0d1117';
      svg = svg.replace(
        new RegExp(`id="${svgId}"[^/]*/?>`, 'g'),
        `id="${svgId}" style="fill:${fill}; stroke:${stroke}; stroke-width:0.8">`
      );
    }

    // Default unfilled states
    svg = svg.replace(/class="land"/g, 'style="fill:#1c2333; stroke:#0d1117; stroke-width:0.8"');

    return `<div style="background:#0d1117; border-radius:6px; padding:8px">${svg}</div>`;
  }

  // ── Zone builder ──────────────────────────────────────────────
  _buildZones(stateCounts) {
    const affected = new Set(Object.keys(stateCounts).map(s => s.toLowerCase()));
    const zones = [
      { name:'NORTH EAST',    states:['Borno','Yobe','Adamawa','Gombe','Bauchi','Taraba'] },
      { name:'NORTH WEST',    states:['Zamfara','Katsina','Sokoto','Kebbi','Kano','Kaduna','Jigawa'] },
      { name:'NORTH CENTRAL', states:['Niger','Benue','Nasarawa','Plateau','Kogi','Kwara','FCT'] },
      { name:'SOUTH WEST',    states:['Lagos','Ogun','Oyo','Osun','Ondo','Ekiti'] },
      { name:'SOUTH EAST',    states:['Anambra','Enugu','Ebonyi','Imo','Abia'] },
      { name:'SOUTH SOUTH',   states:['Rivers','Delta','Bayelsa','Cross River','Akwa Ibom','Edo'] },
    ];
    return zones.map(z => {
      const affN  = z.states.filter(s => affected.has(s.toLowerCase())).length;
      const ratio = affN / z.states.length;
      let color, label;
      if      (ratio >= 0.5)  { color='#da3633'; label='HIGH'; }
      else if (ratio >= 0.28) { color='#e3b341'; label='MODERATE'; }
      else if (ratio > 0)     { color='#4361ee'; label='LOW'; }
      else                    { color='#3fb950'; label='CALM'; }
      return { ...z, color, label, affected: affN, total: z.states.length,
               affectedStates: affected };
    });
  }

  // ── Highlights ────────────────────────────────────────────────
  _highlights(d) {
    const h = [];
    if (d.incidents.length > 0)
      h.push(`${d.incidents.length} security incidents recorded across ${d.statesAffected} states during the reporting period.`);
    if (d.casualties > 0)
      h.push(`An estimated ${d.casualties} casualties reported across recorded incidents.`);
    if (d.abductions > 0)
      h.push(`${d.abductions} persons reported abducted in kidnapping and banditry-related incidents.`);
    const tops = Object.entries(d.stateCounts).sort((a,b)=>b[1]-a[1]).slice(0,3).map(e=>e[0]);
    if (tops.length > 0)
      h.push(`Highest incident concentration recorded in ${tops.join(', ')}.`);
    const terror = d.incidents.filter(i => i.category === 'Terrorism').length;
    if (terror > 0)
      h.push(`${terror} terrorism-related incident${terror>1?'s':''} reported, indicating continued NSAG activity.`);
    if (h.length < 3)
      h.push('Security forces conducted operations across multiple states. Displacement and humanitarian access constraints reported in affected areas.');
    return h;
  }

  // ── Threat level ──────────────────────────────────────────────
  _threatLevel(incCount) {
    if (incCount >= 20) return { lvlColor:'#da3633', lvlLabel:'CRITICAL', lvlDesc:'Severe environment — restrict non-essential movement' };
    if (incCount >= 10) return { lvlColor:'#e85c0d', lvlLabel:'HIGH',     lvlDesc:'Elevated threat — heightened security posture required' };
    if (incCount >= 5)  return { lvlColor:'#e3b341', lvlLabel:'MODERATE', lvlDesc:'Notable incidents — standard precautions advised' };
    return                     { lvlColor:'#3fb950', lvlLabel:'LOW',      lvlDesc:'Minimal activity — maintain situational awareness' };
  }

  _fmtDate(d) {
    return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase();
  }

  // ── Email ─────────────────────────────────────────────────────
  async sendReportEmail(email, pdfBuffer, reportName) {
    if (!this.validEmail(email)) return { success:false, error:'Invalid email' };
    if (!Buffer.isBuffer(pdfBuffer)||pdfBuffer.length===0) return { success:false, error:'Invalid PDF' };
    if (this.useBrevo) return this._sendBrevo(email, pdfBuffer, reportName);
    if (this.smtp)     return this._sendGmail(email, pdfBuffer, reportName);
    return { success:false, error:'Email not configured' };
  }

  async _sendBrevo(email, pdf, name) {
    try {
      const brevo = require('@getbrevo/brevo');
      const mail  = new brevo.SendSmtpEmail();
      mail.subject     = this.cfg.org + ' — Weekly Security Intelligence Report';
      mail.to          = [{ email }];
      mail.sender      = { name: this.cfg.org, email: this.cfg.sender };
      mail.htmlContent = this._emailHTML();
      mail.attachment  = [{ content: pdf.toString('base64'), name: name||'suntrenia-report.pdf' }];
      const r = await this.brevo.sendTransacEmail(mail);
      return { success:true, provider:'Brevo', messageId:r.messageId };
    } catch(e) { return { success:false, error:e.message }; }
  }

  async _sendGmail(email, pdf, name) {
    try {
      await this.smtp.sendMail({
        from: this.cfg.sender, to: email,
        subject: this.cfg.org + ' — Weekly Security Intelligence Report',
        html: this._emailHTML(),
        attachments: [{ filename: name||'suntrenia-report.pdf', content: pdf }],
      });
      return { success:true, provider:'Gmail' };
    } catch(e) { return { success:false, error:e.message }; }
  }

  _emailHTML() {
    return `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d1117;">
      <div style="background:#0f1923;padding:28px 30px;border-top:4px solid #e63946;">
        <div style="font-size:22px;font-weight:900;color:#f0f6fc;letter-spacing:2px;">SUNTRENIA</div>
        <div style="font-size:9px;color:#e63946;letter-spacing:3px;margin-top:2px;">INTELLIGENCE PLATFORM</div>
      </div>
      <div style="padding:26px 30px;background:#161b22;">
        <h2 style="color:#f0f6fc;margin:0 0 6px;font-size:15px;">Your Weekly Security Intelligence Report</h2>
        <p style="color:#8b949e;font-size:12px;margin:0 0 18px;">Your full 6-page PDF report is attached to this email.</p>
        <p style="color:#484f58;font-size:9px;border-top:1px solid #30363d;padding-top:12px;margin:0;">
          Classification: CONFIDENTIAL &nbsp;•&nbsp; ${this.cfg.org} &nbsp;•&nbsp; ${this.cfg.phone}
        </p>
      </div>
    </div>`;
  }
}

module.exports = PDFReportService;
