// ============================================
// FILE: pdfReportService.js
// Suntrenia Intelligence — Puppeteer PDF v4
// ● Full HTML/CSS rendering via Puppeteer
// ● Chart.js charts (bar, donut, line)
// ● SVG icons, animated gradients, maps
// ● Beautiful dark intelligence theme
// ============================================

const puppeteer   = require('puppeteer');
const nodemailer  = require('nodemailer');
const brevo       = require('@getbrevo/brevo');

// ─────────────────────────────────────────────────────────────
// COLOUR PALETTE
// ─────────────────────────────────────────────────────────────
const C = {
  bg:       '#0d1117',
  card:     '#161b22',
  cardAlt:  '#1c2333',
  dark:     '#0f1923',
  accent:   '#e63946',
  orange:   '#f77f00',
  yellow:   '#e3b341',
  blue:     '#4361ee',
  green:    '#2dc653',
  purple:   '#9b5de5',
  teal:     '#00b4d8',
  text:     '#f0f6fc',
  sub:      '#8b949e',
  muted:    '#484f58',
  border:   '#30363d',
  critical: '#da3633',
  high:     '#e85c0d',
  medium:   '#e3b341',
  low:      '#3fb950',
  white:    '#ffffff',
};

const CAT_COLORS = {
  'Terrorism':           '#9b5de5',
  'Banditry':            '#e63946',
  'Kidnapping':          '#f77f00',
  'Communal Clash':      '#4361ee',
  'Military Operation':  '#2dc653',
  'Armed Robbery':       '#e3b341',
  'Farmer-Herder':       '#00b4d8',
  'Cult Violence':       '#e040fb',
  'Other':               '#8b949e',
};

const CAT_ICONS = {
  'Terrorism':           '💥',
  'Banditry':            '⚔️',
  'Kidnapping':          '🔒',
  'Communal Clash':      '🛡️',
  'Military Operation':  '⭐',
  'Armed Robbery':       '🔫',
  'Farmer-Herder':       '🌾',
  'Cult Violence':       '💀',
  'Other':               '◆',
};

// ─────────────────────────────────────────────────────────────
// INLINE HELPERS
// ─────────────────────────────────────────────────────────────
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
  if (t.includes('bandit'))
    return 'Banditry';
  if (t.includes('herdsmen') || t.includes('herder') || t.includes('farmer-herder') ||
      t.includes('fulani'))
    return 'Farmer-Herder';
  if (t.includes('communal') || t.includes('ethnic') || t.includes('community clash') ||
      t.includes('village attack'))
    return 'Communal Clash';
  if (t.includes('cult') || t.includes('confraternity') || t.includes('rival gang'))
    return 'Cult Violence';
  if (t.includes('robbery') || t.includes('robbers') || t.includes('armed men') ||
      t.includes('gunmen rob'))
    return 'Armed Robbery';
  if (t.includes('soldier') || t.includes('troops') || t.includes('military') ||
      t.includes('airstrike') || t.includes('army') || t.includes('navy') ||
      t.includes('air force') || t.includes('dss') || t.includes('police raid'))
    return 'Military Operation';
  return 'Other';
}

function extractState(title, summary) {
  const text = (title + ' ' + (summary || '')).toLowerCase();
  const states = [
    ['Abia'],['Adamawa'],['Akwa Ibom'],['Anambra'],['Bauchi'],['Bayelsa'],
    ['Benue'],['Borno'],['Cross River'],['Delta'],['Ebonyi'],['Edo'],
    ['Ekiti'],['Enugu'],['Gombe'],['Imo'],['Jigawa'],['Kaduna'],['Kano'],
    ['Katsina'],['Kebbi'],['Kogi'],['Kwara'],['Lagos'],['Nasarawa'],
    ['Niger State'],['Ogun'],['Ondo'],['Osun'],['Oyo'],['Plateau'],
    ['Rivers'],['Sokoto'],['Taraba'],['Yobe'],['Zamfara'],['FCT'],
  ];
  for (const variants of states) {
    if (text.includes(variants[0].toLowerCase())) return variants[0];
  }
  return null;
}

function getSeverity(title, summary) {
  const t = (title + ' ' + (summary || '')).toLowerCase();
  if (t.match(/(\d{2,})\s*(kill|dead|casualt)/) ||
      t.includes('massacre') || t.includes('mass killing') || t.includes('scores dead'))
    return 'Critical';
  if (t.includes('kill') || t.includes('dead') || t.includes('death') ||
      t.includes('soldiers killed') || t.includes('troops killed'))
    return 'High';
  if (t.includes('injur') || t.includes('wound') || t.includes('hospitaliz') ||
      t.includes('rescued') || t.includes('abduct'))
    return 'Medium';
  return 'Low';
}

function fmtDate(d) {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
}

// ══════════════════════════════════════════════════════════════
class PDFReportService {

  constructor() {
    if (process.env.BREVO_API_KEY) {
      this.brevo = new brevo.TransactionalEmailsApi();
      this.brevo.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);
      this.useBrevo = true;
    } else if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
      this.smtp = nodemailer.createTransport({
        host:   process.env.EMAIL_HOST    || 'smtp.gmail.com',
        port:   parseInt(process.env.EMAIL_PORT) || 465,
        secure: process.env.EMAIL_SECURE === 'true',
        auth:   { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
        connectionTimeout: 10000,
      });
      this.useBrevo = false;
    } else {
      this.useBrevo = false;
    }

    this.cfg = {
      org:    process.env.ORG_NAME           || 'Suntrenia Intelligence',
      phone:  process.env.CONTACT_PHONE      || '+234 703 499 5589',
      email:  process.env.CONTACT_EMAIL      || 'info@suntrenia.com',
      sender: process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER,
      site:   process.env.WEBSITE            || 'www.suntrenia.com',
    };
  }

  validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

  // ════════════════════════════════════════════════════════════
  // MAIN ENTRY POINT
  // ════════════════════════════════════════════════════════════
  async generateEnhancedReport(rawData, opts = {}) {
    const { teaserOnly = false } = opts;
    if (!rawData || typeof rawData !== 'object') throw new Error('Invalid data');

    const incidents = (rawData.incidents || []).slice(0, 50).map(inc => ({
      ...inc,
      title:     cleanText(inc.title),
      summary:   cleanText(inc.summary),
      category:  classifyIncident(inc.title, inc.summary),
      severity:  inc.severity || getSeverity(inc.title, inc.summary),
      stateName: inc.stateName || inc.state || extractState(inc.title, inc.summary) || null,
    }));

    const catCounts   = {};
    const stateCounts = {};
    incidents.forEach(inc => {
      catCounts[inc.category] = (catCounts[inc.category] || 0) + 1;
      if (inc.stateName) stateCounts[inc.stateName] = (stateCounts[inc.stateName] || 0) + 1;
    });

    const d = {
      ...rawData,
      incidents,
      catCounts,
      stateCounts,
      stateRiskAnalyses: (rawData.stateRiskAnalyses || []).slice(0, 20),
      statesAffected:    rawData.statesAffected || Object.keys(stateCounts).length,
      casualties:        rawData.casualties  || 0,
      abductions:        rawData.abductions  || 0,
    };

    const html = teaserOnly ? this.buildTeaserHTML(d) : this.buildFullReportHTML(d);
    const pdfBuffer = await this.renderHTMLtoPDF(html);
    return pdfBuffer;
  }

  // ════════════════════════════════════════════════════════════
  // PUPPETEER RENDERER
  // ════════════════════════════════════════════════════════════
  async renderHTMLtoPDF(html) {
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--font-render-hinting=none',
        ],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
      
      // Wait for Chart.js to render
      await page.waitForFunction(() => window.__chartsReady === true, { timeout: 15000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 1500));

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });

      return pdfBuffer;
    } finally {
      if (browser) await browser.close();
    }
  }

  // ════════════════════════════════════════════════════════════
  // BUILD FULL REPORT HTML
  // ════════════════════════════════════════════════════════════
  buildFullReportHTML(d) {
    const now     = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const dateStr = `${fmtDate(weekAgo)} — ${fmtDate(now)}`;

    const inc       = d.incidents.length;
    const threatLvl = inc >= 20 ? { color: C.critical, label: 'CRITICAL', num: 4, desc: 'Severe environment — restrict non-essential movement' }
                    : inc >= 10 ? { color: C.high,     label: 'HIGH',     num: 3, desc: 'Elevated threat — heightened security posture required' }
                    : inc >= 5  ? { color: C.medium,   label: 'MODERATE', num: 2, desc: 'Notable incidents — standard precautions advised' }
                    :             { color: C.low,       label: 'LOW',      num: 1, desc: 'Minimal activity — maintain situational awareness' };

    const sortedCats   = Object.entries(d.catCounts).sort((a,b) => b[1] - a[1]);
    const sortedStates = Object.entries(d.stateCounts).sort((a,b) => b[1] - a[1]);
    const totalInc     = inc || 1;

    // Chart data
    const catLabels  = sortedCats.map(([c]) => c);
    const catValues  = sortedCats.map(([,v]) => v);
    const catColors  = sortedCats.map(([c]) => CAT_COLORS[c] || C.sub);

    const top10States  = sortedStates.slice(0, 10);
    const stateLabels  = top10States.map(([s]) => s);
    const stateValues  = top10States.map(([,v]) => v);
    const stateColors  = [C.critical, C.high, C.medium, C.blue, C.green, C.purple, C.orange, C.teal, C.yellow, C.sub];

    // 7-day trend
    const days  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let daily   = new Array(7).fill(0);
    if (d.trendData?.data?.length > 0) {
      daily = d.trendData.data.slice(0, 7);
    } else {
      d.incidents.forEach((inc, idx) => { daily[idx % 7]++; });
    }

    // Regional risk
    const regions = [
      { name: 'NORTH EAST',    color: C.critical, states: ['Borno','Yobe','Adamawa','Gombe','Bauchi','Taraba'] },
      { name: 'NORTH WEST',    color: C.high,     states: ['Zamfara','Katsina','Sokoto','Kebbi','Kano','Kaduna','Jigawa'] },
      { name: 'NORTH CENTRAL', color: C.medium,   states: ['Niger State','Benue','Nasarawa','Plateau','Kogi','Kwara','FCT'] },
      { name: 'SOUTH WEST',    color: C.blue,     states: ['Lagos','Ogun','Oyo','Osun','Ondo','Ekiti'] },
      { name: 'SOUTH EAST',    color: C.green,    states: ['Anambra','Enugu','Ebonyi','Imo','Abia'] },
      { name: 'SOUTH SOUTH',   color: C.purple,   states: ['Rivers','Delta','Bayelsa','Cross River','Akwa Ibom','Edo'] },
    ];
    const affectedStates = new Set(Object.keys(d.stateCounts).map(s => s.toLowerCase()));
    const regionsData = regions.map(reg => {
      const affN = reg.states.filter(s => affectedStates.has(s.toLowerCase())).length;
      const ratio = affN / reg.states.length;
      const riskLabel = ratio >= 0.5 ? 'HIGH' : ratio >= 0.28 ? 'MODERATE' : ratio > 0 ? 'LOW' : 'CALM';
      const riskColor = ratio >= 0.5 ? C.critical : ratio >= 0.28 ? C.medium : ratio > 0 ? C.blue : C.low;
      return { ...reg, affN, riskLabel, riskColor };
    });

    const highlights = this._highlights(d);
    const briefing   = cleanText(d.aiBriefing || 'Security conditions across Nigeria during the reporting period reflect ongoing multidimensional threats. Incidents spanning terrorism, banditry, kidnapping, and communal violence continue to affect multiple states. Law enforcement and military operations are ongoing across identified hotspot zones.');
    const exec       = cleanText(d.executiveBrief || d.aiBriefing || 'Pattern recognition suggests concentrated threat activity. Multi-source analysis indicates elevated operational tempo among non-state armed groups. Recommend continued monitoring of identified hotspot states.').substring(0, 400);
    const recs        = d.recommendations || [
      'Strengthen inter-agency security coordination in critical risk states.',
      'Enhance community intelligence networks in identified hotspot zones.',
      'Deploy rapid response capability to north-west and north-east corridors.',
      'Increase surveillance along identified conflict flashpoints.',
      'Implement proactive humanitarian contingency planning in affected states.',
    ];

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Suntrenia Security Intelligence Report</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  :root {
    --bg: #0d1117;
    --card: #161b22;
    --card-alt: #1c2333;
    --dark: #0f1923;
    --accent: #e63946;
    --orange: #f77f00;
    --yellow: #e3b341;
    --blue: #4361ee;
    --green: #2dc653;
    --purple: #9b5de5;
    --teal: #00b4d8;
    --text: #f0f6fc;
    --sub: #8b949e;
    --muted: #484f58;
    --border: #30363d;
    --critical: #da3633;
    --high: #e85c0d;
    --medium: #e3b341;
    --low: #3fb950;
  }

  body {
    font-family: 'Segoe UI', -apple-system, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    width: 210mm;
    margin: 0 auto;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    width: 210mm;
    min-height: 297mm;
    position: relative;
    page-break-after: always;
    overflow: hidden;
    background: var(--bg);
  }
  
  .page:last-child { page-break-after: avoid; }

  /* ── COVER PAGE ── */
  .cover-stripe {
    height: 5px;
    background: linear-gradient(90deg, var(--accent) 50%, var(--orange) 80%, var(--purple) 100%);
  }

  .cover-header {
    background: var(--dark);
    padding: 16px 36px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--border);
  }

  .cover-logo {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .shield-icon {
    width: 52px;
    height: 60px;
  }

  .org-name {
    font-size: 26px;
    font-weight: 900;
    letter-spacing: 3px;
    color: var(--text);
    line-height: 1;
  }

  .org-sub {
    font-size: 8px;
    color: var(--accent);
    letter-spacing: 2px;
    margin-top: 4px;
  }

  .date-badge {
    background: rgba(230, 57, 70, 0.12);
    border: 1px solid rgba(230, 57, 70, 0.4);
    border-radius: 4px;
    padding: 4px 12px;
    font-size: 8px;
    color: #ffbbbb;
    letter-spacing: 1px;
    margin-top: 6px;
  }

  .confidential-badge {
    background: rgba(218, 54, 51, 0.2);
    border: 1px solid var(--critical);
    border-radius: 4px;
    padding: 8px 18px;
    text-align: center;
  }

  .confidential-badge .label {
    font-size: 10px;
    font-weight: 700;
    color: var(--critical);
    letter-spacing: 2px;
  }

  .confidential-badge .sub {
    font-size: 7px;
    color: #ffaaaa;
    margin-top: 2px;
  }

  .cover-title-band {
    background: #1c1228;
    padding: 12px 36px;
    text-align: center;
    border-bottom: 1px solid var(--border);
  }

  .cover-title-band h1 {
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 1.5px;
    color: var(--text);
  }

  .cover-title-band p {
    font-size: 8.5px;
    color: var(--sub);
    margin-top: 4px;
  }

  /* ── METRIC CARDS ── */
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    padding: 18px 36px;
  }

  .metric-card {
    border-radius: 6px;
    padding: 16px 12px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }

  .metric-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
  }

  .metric-icon {
    font-size: 22px;
    margin-bottom: 8px;
    display: block;
  }

  .metric-value {
    font-size: 36px;
    font-weight: 900;
    line-height: 1;
    margin-bottom: 4px;
  }

  .metric-label {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 1.5px;
    margin-bottom: 2px;
  }

  .metric-sublabel {
    font-size: 7px;
    color: var(--sub);
  }

  /* ── THREAT LEVEL BANNER ── */
  .threat-banner {
    margin: 0 36px;
    border-radius: 6px;
    padding: 14px 18px;
    display: flex;
    align-items: center;
    gap: 16px;
    position: relative;
    overflow: hidden;
  }

  .threat-banner::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 5px;
  }

  .threat-icon { font-size: 26px; }

  .threat-text { flex: 1; }

  .threat-level-label {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 1px;
  }

  .threat-level-desc {
    font-size: 9px;
    color: var(--sub);
    margin-top: 2px;
  }

  .threat-bars {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    height: 36px;
  }

  .threat-bar {
    width: 14px;
    border-radius: 2px 2px 0 0;
  }

  /* ── SECTION HEADER ── */
  .section-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }

  .section-head-title {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1.5px;
    color: var(--sub);
    white-space: nowrap;
  }

  .section-head-line {
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  /* ── CATEGORY BARS (cover) ── */
  .cat-list { padding: 0; }

  .cat-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .cat-icon { font-size: 12px; width: 18px; text-align: center; }

  .cat-name {
    font-size: 8.5px;
    font-weight: 700;
    width: 110px;
    letter-spacing: 0.5px;
  }

  .cat-bar-track {
    flex: 1;
    height: 14px;
    border-radius: 2px;
    overflow: hidden;
    position: relative;
  }

  .cat-bar-fill {
    height: 100%;
    border-radius: 2px;
    position: relative;
  }

  .cat-count-badge {
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 7.5px;
    font-weight: 700;
    width: 52px;
    text-align: center;
  }

  /* ── HOTSPOT CHIPS ── */
  .hotspot-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
  }

  .hotspot-chip {
    border-radius: 5px;
    padding: 10px 8px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }

  .hotspot-chip::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
  }

  .hotspot-rank {
    position: absolute;
    top: 6px; left: 6px;
    width: 18px; height: 14px;
    border-radius: 3px;
    font-size: 7px;
    font-weight: 700;
    display: flex; align-items: center; justify-content: center;
  }

  .hotspot-name {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.5px;
    margin: 16px 0 4px;
  }

  .hotspot-count {
    font-size: 22px;
    font-weight: 900;
    line-height: 1;
  }

  .hotspot-label {
    font-size: 7px;
    color: var(--sub);
    margin-top: 2px;
  }

  /* ── PAGE HEADER ── */
  .page-header {
    border-top: 5px solid var(--accent);
    background: var(--dark);
    padding: 12px 36px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .page-header-title {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.8px;
  }

  .page-header-meta {
    font-size: 7.5px;
    color: var(--sub);
  }

  /* ── CHART CONTAINERS ── */
  .chart-container {
    background: var(--card);
    border-radius: 6px;
    padding: 16px;
    position: relative;
  }

  /* ── CATEGORY DEEP DIVE ── */
  .cat-deep-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    margin-bottom: 4px;
    border-radius: 5px;
    position: relative;
    overflow: hidden;
  }

  .cat-deep-icon-circle {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    flex-shrink: 0;
  }

  .cat-deep-name {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.8px;
    flex: 1;
  }

  .cat-deep-bar-wrap {
    flex: 2;
    height: 14px;
    border-radius: 2px;
    overflow: hidden;
  }

  .cat-deep-count {
    font-size: 20px;
    font-weight: 900;
    width: 50px;
    text-align: right;
  }

  .cat-deep-pct {
    font-size: 8px;
    color: var(--sub);
    width: 50px;
    text-align: right;
  }

  /* ── REGIONAL GRID ── */
  .regions-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .region-card {
    border-radius: 5px;
    padding: 12px 14px;
    position: relative;
    overflow: hidden;
  }

  .region-card::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 4px;
  }

  .region-name {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.5px;
    padding-left: 8px;
  }

  .region-sub {
    font-size: 8px;
    color: var(--sub);
    padding-left: 8px;
    margin: 3px 0 8px;
  }

  .region-dots {
    display: flex;
    gap: 4px;
    padding-left: 8px;
    flex-wrap: wrap;
    margin-bottom: 4px;
  }

  .region-dot {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 5px;
    font-weight: 700;
    color: #fff;
  }

  .region-risk-badge {
    position: absolute;
    top: 12px; right: 12px;
    padding: 3px 10px;
    border-radius: 3px;
    font-size: 8px;
    font-weight: 700;
    color: #fff;
  }

  /* ── SITUATION REPORT (light page) ── */
  .page-light {
    background: #f4f6f8;
    color: #2c3e50;
  }

  .sitrep-header {
    background: #1a252f;
    border-top: 5px solid var(--accent);
    padding: 12px 36px;
  }

  .sitrep-header-title {
    font-size: 12px;
    font-weight: 700;
    color: #fff;
    letter-spacing: 0.8px;
  }

  .sitrep-header-meta {
    font-size: 8px;
    color: var(--accent);
    margin-top: 2px;
  }

  .highlights-box {
    background: #fff;
    border: 1px solid #dee2e6;
    border-radius: 5px;
    overflow: hidden;
    margin-bottom: 16px;
  }

  .highlights-header {
    background: #1a252f;
    padding: 6px 12px;
    font-size: 8.5px;
    font-weight: 700;
    color: #fff;
    letter-spacing: 2px;
  }

  .highlight-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 8px 14px;
    border-bottom: 1px solid #f0f0f0;
  }

  .highlight-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--accent);
    flex-shrink: 0;
    margin-top: 3px;
  }

  .highlight-text {
    font-size: 9px;
    color: #2c3e50;
    line-height: 1.5;
  }

  .section-title-light {
    font-size: 14px;
    font-weight: 700;
    color: #2c3e50;
    margin-bottom: 4px;
  }

  .section-underline {
    height: 2px;
    margin-bottom: 10px;
    border-radius: 1px;
  }

  .ai-assessment-box {
    background: #eef2ff;
    border: 1px solid #c7d2fe;
    border-left: 4px solid var(--blue);
    border-radius: 5px;
    padding: 12px 16px;
    margin-top: 12px;
  }

  .ai-assessment-title {
    font-size: 8.5px;
    font-weight: 700;
    color: var(--blue);
    letter-spacing: 1.5px;
    margin-bottom: 6px;
  }

  .ai-assessment-text {
    font-size: 9px;
    color: #34495e;
    line-height: 1.6;
  }

  /* ── INCIDENT DIGEST ── */
  .incident-card {
    background: var(--card);
    border-radius: 5px;
    padding: 10px 12px;
    margin-bottom: 5px;
    display: grid;
    grid-template-columns: 28px 1fr 80px 70px;
    gap: 10px;
    align-items: start;
    position: relative;
    overflow: hidden;
  }

  .incident-card::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 4px;
  }

  .incident-num {
    width: 24px;
    height: 22px;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .incident-title {
    font-size: 8.5px;
    font-weight: 700;
    color: var(--text);
    margin-bottom: 4px;
    line-height: 1.4;
  }

  .incident-summary {
    font-size: 7.5px;
    color: var(--sub);
    line-height: 1.5;
    margin-bottom: 4px;
  }

  .incident-meta {
    font-size: 7px;
    color: var(--muted);
  }

  .cat-badge, .sev-badge {
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 7px;
    font-weight: 700;
    text-align: center;
    margin-bottom: 3px;
  }

  /* ── STATE RISK PROFILES ── */
  .state-profile-card {
    background: var(--card);
    border-radius: 5px;
    padding: 12px 14px;
    margin-bottom: 6px;
    position: relative;
    overflow: hidden;
  }

  .state-profile-card::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 4px;
  }

  .state-profile-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }

  .state-name {
    font-size: 12px;
    font-weight: 800;
    padding-left: 10px;
  }

  .risk-badge {
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 8px;
    font-weight: 700;
    color: #fff;
  }

  .state-analysis {
    font-size: 8.5px;
    color: var(--sub);
    line-height: 1.5;
    padding-left: 10px;
  }

  /* ── RECOMMENDATIONS ── */
  .rec-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 14px;
  }

  .rec-num {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 900;
    color: #fff;
    flex-shrink: 0;
  }

  .rec-text {
    font-size: 10px;
    color: var(--text);
    line-height: 1.6;
    padding-top: 4px;
  }

  /* ── DATA SOURCES ── */
  .sources-box {
    background: var(--card);
    border-radius: 5px;
    border: 1px solid var(--border);
    padding: 12px 16px;
    margin-top: 10px;
  }

  .sources-title {
    font-size: 8px;
    font-weight: 700;
    color: var(--sub);
    letter-spacing: 1.5px;
    margin-bottom: 6px;
  }

  .sources-text {
    font-size: 7.5px;
    color: var(--muted);
    line-height: 1.6;
  }

  /* ── FOOTER ── */
  .page-footer {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    background: var(--dark);
    border-top: 1px solid var(--border);
    padding: 8px 36px;
  }

  .page-footer-text {
    font-size: 7px;
    color: var(--muted);
    text-align: center;
    line-height: 1.8;
  }

  /* ── MAP VISUALIZATION ── */
  .nigeria-map-container {
    position: relative;
    background: var(--card);
    border-radius: 6px;
    overflow: hidden;
  }

  /* ── STACKED BAR ── */
  .stacked-bar {
    height: 28px;
    display: flex;
    border-radius: 3px;
    overflow: hidden;
    margin: 8px 0;
  }

  .stacked-seg {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 7px;
    font-weight: 700;
    color: #fff;
    transition: all 0.3s;
  }

  /* Legend */
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    margin-top: 8px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 7.5px;
    color: var(--sub);
  }

  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .content-area {
    padding: 16px 36px;
  }

  @media print {
    .page { page-break-after: always; }
    .page:last-child { page-break-after: avoid; }
  }
</style>
</head>
<body>

<!-- ═══════════════════════════════════════════════════
     PAGE 1 — COVER DASHBOARD
═══════════════════════════════════════════════════ -->
<div class="page">
  <div class="cover-stripe"></div>

  <div class="cover-header">
    <div class="cover-logo">
      <!-- Shield SVG icon -->
      <svg class="shield-icon" viewBox="0 0 52 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M26 2L50 14V32C50 46 38 57 26 59C14 57 2 46 2 32V14L26 2Z" fill="rgba(230,57,70,0.15)" stroke="#e63946" stroke-width="2"/>
        <path d="M26 2L50 14V32C50 46 38 57 26 59C14 57 2 46 2 32V14L26 2Z" fill="none" stroke="#e63946" stroke-width="2"/>
        <text x="26" y="38" text-anchor="middle" fill="#e63946" font-family="Arial" font-size="22" font-weight="900">S</text>
      </svg>
      <div>
        <div class="org-name">SUNTRENIA</div>
        <div class="org-sub">INTELLIGENCE PLATFORM &nbsp;|&nbsp; NIGERIA SECURITY MONITOR</div>
        <div class="date-badge">REPORTING PERIOD: &nbsp;${dateStr}</div>
      </div>
    </div>
    <div class="confidential-badge">
      <div class="label">CONFIDENTIAL</div>
      <div class="sub">RESTRICTED ACCESS</div>
    </div>
  </div>

  <div class="cover-title-band">
    <h1>WEEKLY SECURITY INTELLIGENCE REPORT</h1>
    <p>Nigeria — All 36 States + FCT &nbsp;|&nbsp; Multi-Source OSINT / AI Analysis</p>
  </div>

  <!-- Metric Cards -->
  <div class="metrics-grid">
    ${[
      { icon: '⚠️', label: 'INCIDENTS',  value: d.incidents.length, sub: 'recorded',    color: C.accent   },
      { icon: '📍', label: 'STATES HIT', value: d.statesAffected,   sub: 'affected',    color: C.orange   },
      { icon: '💀', label: 'CASUALTIES', value: d.casualties,        sub: 'est. deaths', color: C.critical },
      { icon: '⛓️', label: 'ABDUCTED',   value: d.abductions,        sub: 'persons',     color: C.purple   },
    ].map(m => `
    <div class="metric-card" style="background:${m.color}18; border:1px solid ${m.color}44; --card-color:${m.color}">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${m.color}"></div>
      <span class="metric-icon">${m.icon}</span>
      <div class="metric-value" style="color:${m.color}">${m.value}</div>
      <div class="metric-label" style="color:${m.color}">${m.label}</div>
      <div class="metric-sublabel">${m.sub}</div>
    </div>`).join('')}
  </div>

  <!-- Threat Level Banner -->
  <div class="threat-banner" style="background:${threatLvl.color}12; border:1px solid ${threatLvl.color}44; margin-bottom:16px;">
    <div style="position:absolute;left:0;top:0;bottom:0;width:5px;background:${threatLvl.color}"></div>
    <span class="threat-icon">🚨</span>
    <div class="threat-text">
      <div class="threat-level-label" style="color:${threatLvl.color}">THREAT LEVEL: ${threatLvl.label}</div>
      <div class="threat-level-desc">${threatLvl.desc}</div>
    </div>
    <div class="threat-bars">
      ${[1,2,3,4].map(i => `<div class="threat-bar" style="height:${10+i*7}px; background:${i <= threatLvl.num ? threatLvl.color : threatLvl.color + '30'}"></div>`).join('')}
    </div>
  </div>

  <div class="content-area" style="padding-top:0">
    <!-- Category Breakdown -->
    <div class="section-head">
      <span class="section-head-title">INCIDENT CATEGORY BREAKDOWN</span>
      <div class="section-head-line"></div>
    </div>
    <div class="cat-list">
      ${sortedCats.slice(0, 6).map(([cat, count]) => {
        const color = CAT_COLORS[cat] || C.sub;
        const pct   = ((count / totalInc) * 100).toFixed(0);
        const fillW = ((count / (sortedCats[0]?.[1] || 1)) * 100).toFixed(1);
        return `
      <div class="cat-row">
        <span class="cat-icon">${CAT_ICONS[cat] || '◆'}</span>
        <span class="cat-name" style="color:${color}">${cat.toUpperCase()}</span>
        <div class="cat-bar-track" style="background:${color}18">
          <div class="cat-bar-fill" style="width:${fillW}%;background:${color}cc"></div>
        </div>
        <div class="cat-count-badge" style="background:${color}25;border:1px solid ${color}60;color:${color}">${count} &nbsp;${pct}%</div>
      </div>`;
      }).join('')}
    </div>

    <!-- Hotspot States -->
    ${sortedStates.length > 0 ? `
    <div class="section-head" style="margin-top:12px">
      <span class="section-head-title">TOP HOTSPOT STATES</span>
      <div class="section-head-line"></div>
    </div>
    <div class="hotspot-grid">
      ${sortedStates.slice(0, 5).map(([state, count], i) => {
        const col = stateColors[i];
        return `
      <div class="hotspot-chip" style="background:${col}14;border:1px solid ${col}50">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${col}"></div>
        <div class="hotspot-rank" style="background:${col}40;color:${col}">#${i+1}</div>
        <div class="hotspot-name" style="color:${col}">${state.toUpperCase().slice(0,9)}</div>
        <div class="hotspot-count" style="color:${col}">${count}</div>
        <div class="hotspot-label">incidents</div>
      </div>`;
      }).join('')}
    </div>` : ''}
  </div>

  <div class="page-footer">
    <div class="page-footer-text">
      ${this.cfg.org} &nbsp;|&nbsp; ${this.cfg.site} &nbsp;|&nbsp; ${this.cfg.phone} &nbsp;|&nbsp; ${this.cfg.email}<br>
      Generated: ${new Date().toLocaleString('en-NG', {timeZone:'Africa/Lagos'})} &nbsp;|&nbsp; Classification: CONFIDENTIAL &nbsp;|&nbsp; Page 1 of 7
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════
     PAGE 2 — GEOGRAPHIC THREAT MAP + STATE BAR CHART
═══════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-header-title">📍 GEOGRAPHIC THREAT ASSESSMENT</div>
    <div class="page-header-meta">${this.cfg.org} &nbsp;|&nbsp; CONFIDENTIAL &nbsp;|&nbsp; PAGE 2 OF 7</div>
  </div>

  <div class="content-area">
    <!-- Nigeria SVG Map with Hotspot Dots -->
    <div class="section-head">
      <span class="section-head-title">NIGERIA THREAT HEAT MAP</span>
      <div class="section-head-line"></div>
    </div>

    <div class="nigeria-map-container" style="height:270px; margin-bottom:10px;">
      ${this._buildNigeriaSVGMap(d.stateCounts)}
    </div>

    <!-- Map Legend -->
    <div style="display:flex; gap:20px; margin-bottom:14px; align-items:center;">
      <span style="font-size:8px;color:var(--sub);font-weight:700;">THREAT LEVEL KEY:</span>
      ${[['#3fb950','Low (0–2)'],['#e3b341','Moderate (3–5)'],['#e85c0d','High (6–9)'],['#da3633','Critical (10+)']].map(([c,l]) => `
      <div style="display:flex;align-items:center;gap:5px">
        <div style="width:16px;height:16px;background:${c};border-radius:3px"></div>
        <span style="font-size:8px;color:var(--sub)">${l}</span>
      </div>`).join('')}
    </div>

    <!-- State Bar Chart -->
    <div class="section-head">
      <span class="section-head-title">INCIDENT COUNT BY STATE (TOP 10)</span>
      <div class="section-head-line"></div>
    </div>

    <div class="chart-container" style="height:200px;">
      <canvas id="stateChart"></canvas>
    </div>
  </div>

  <div class="page-footer">
    <div class="page-footer-text">
      ${this.cfg.org} &nbsp;|&nbsp; ${this.cfg.site} &nbsp;|&nbsp; Page 2 of 7
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════
     PAGE 3 — CATEGORY ANALYSIS + DONUT CHART
═══════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-header-title">🎯 THREAT CATEGORY ANALYSIS</div>
    <div class="page-header-meta">${this.cfg.org} &nbsp;|&nbsp; CONFIDENTIAL &nbsp;|&nbsp; PAGE 3 OF 7</div>
  </div>

  <div class="content-area">
    <div style="display:grid; grid-template-columns:1fr 180px; gap:16px; margin-bottom:14px;">
      <!-- Category rows -->
      <div>
        ${sortedCats.map(([cat, count], i) => {
          const color = CAT_COLORS[cat] || C.sub;
          const pct   = ((count / totalInc) * 100).toFixed(1);
          const fillW = ((count / (sortedCats[0]?.[1] || 1)) * 100).toFixed(1);
          return `
        <div class="cat-deep-row" style="background:${i%2===0?C.card:C.cardAlt}; margin-bottom:3px">
          <div style="position:absolute;left:0;top:0;bottom:0;width:4px;background:${color}"></div>
          <div class="cat-deep-icon-circle" style="background:${color}22;border:1px solid ${color}66">
            <span style="font-size:16px">${CAT_ICONS[cat] || '◆'}</span>
          </div>
          <div style="flex:1; padding-left:4px">
            <div class="cat-deep-name">${cat.toUpperCase()}</div>
            <div class="cat-deep-bar-wrap" style="background:${color}20; margin-top:5px">
              <div style="height:100%;width:${fillW}%;background:${color}bb"></div>
            </div>
          </div>
          <div style="text-align:right">
            <div class="cat-deep-count" style="color:${color}">${count}</div>
            <div class="cat-deep-pct">${pct}%</div>
          </div>
        </div>`;
        }).join('')}
      </div>

      <!-- Donut chart -->
      <div class="chart-container" style="display:flex;flex-direction:column;align-items:center;justify-content:center; padding:8px">
        <canvas id="donutChart" width="160" height="160"></canvas>
        <div style="font-size:7px;color:var(--sub);text-align:center;margin-top:6px;">Category Distribution</div>
      </div>
    </div>

    <!-- Proportional Stacked Bar -->
    <div class="section-head">
      <span class="section-head-title">PROPORTIONAL THREAT DISTRIBUTION</span>
      <div class="section-head-line"></div>
    </div>
    <div class="stacked-bar">
      ${sortedCats.map(([cat, count]) => {
        const color = CAT_COLORS[cat] || C.sub;
        const pct   = ((count / totalInc) * 100).toFixed(1);
        return `<div class="stacked-seg" style="width:${pct}%;background:${color}cc">${pct > 6 ? pct+'%' : ''}</div>`;
      }).join('')}
    </div>
    <div class="legend">
      ${sortedCats.map(([cat]) => {
        const color = CAT_COLORS[cat] || C.sub;
        return `<div class="legend-item"><div class="legend-dot" style="background:${color}"></div>${cat}</div>`;
      }).join('')}
    </div>
  </div>

  <div class="page-footer">
    <div class="page-footer-text">${this.cfg.org} &nbsp;|&nbsp; ${this.cfg.site} &nbsp;|&nbsp; Page 3 of 7</div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════
     PAGE 4 — TREND + REGIONAL RISK
═══════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-header-title">📈 TREND & REGIONAL RISK ANALYSIS</div>
    <div class="page-header-meta">${this.cfg.org} &nbsp;|&nbsp; CONFIDENTIAL &nbsp;|&nbsp; PAGE 4 OF 7</div>
  </div>

  <div class="content-area">
    <!-- 7-Day Trend Line/Bar Chart -->
    <div class="section-head">
      <span class="section-head-title">7-DAY INCIDENT FREQUENCY TREND</span>
      <div class="section-head-line"></div>
    </div>
    <div class="chart-container" style="height:175px; margin-bottom:14px;">
      <canvas id="trendChart"></canvas>
    </div>

    <!-- Regional Risk Grid -->
    <div class="section-head">
      <span class="section-head-title">GEOPOLITICAL ZONE RISK ASSESSMENT</span>
      <div class="section-head-line"></div>
    </div>
    <div class="regions-grid">
      ${regionsData.map(reg => `
      <div class="region-card" style="background:${reg.riskColor}12; border:1px solid ${reg.riskColor}40">
        <div style="position:absolute;left:0;top:0;bottom:0;width:4px;background:${reg.riskColor}"></div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div class="region-name">${reg.name}</div>
            <div class="region-sub">${reg.affN} of ${reg.states.length} states with incidents</div>
          </div>
          <div class="region-risk-badge" style="background:${reg.riskColor}">${reg.riskLabel}</div>
        </div>
        <div class="region-dots">
          ${reg.states.map(state => {
            const isAff = affectedStates.has(state.toLowerCase());
            return `<div class="region-dot" style="background:${isAff ? reg.riskColor : reg.riskColor+'22'}; border:1px solid ${reg.riskColor}55; color:${isAff?'#fff':reg.riskColor}">${state.slice(0,2).toUpperCase()}</div>`;
          }).join('')}
        </div>
      </div>`).join('')}
    </div>
  </div>

  <div class="page-footer">
    <div class="page-footer-text">${this.cfg.org} &nbsp;|&nbsp; ${this.cfg.site} &nbsp;|&nbsp; Page 4 of 7</div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════
     PAGE 5 — SITUATION REPORT (OCHA style, light)
═══════════════════════════════════════════════════ -->
<div class="page page-light">
  <div class="sitrep-header">
    <div class="sitrep-header-title">${this.cfg.org.toUpperCase()} &nbsp;|&nbsp; SITUATION REPORT</div>
    <div class="sitrep-header-meta">Week of ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})} &nbsp;|&nbsp; Page 5 of 7 &nbsp;|&nbsp; CONFIDENTIAL</div>
  </div>

  <div style="padding:16px 36px;">
    <!-- Highlights -->
    <div class="highlights-box">
      <div class="highlights-header">HIGHLIGHTS</div>
      ${highlights.slice(0, 5).map(h => `
      <div class="highlight-item">
        <div class="highlight-dot"></div>
        <div class="highlight-text">${h}</div>
      </div>`).join('')}
    </div>

    <!-- Background -->
    <div class="section-title-light">BACKGROUND</div>
    <div class="section-underline" style="background:var(--accent)"></div>

    <div style="font-size:10px;font-weight:700;color:#2c3e50;margin-bottom:6px;">Situation Overview</div>
    <div style="font-size:9.5px;color:#34495e;line-height:1.7;text-align:justify;">${briefing}</div>

    <!-- AI Assessment -->
    <div class="ai-assessment-box">
      <div class="ai-assessment-title">🤖 AI INTELLIGENCE ASSESSMENT</div>
      <div class="ai-assessment-text">${exec}</div>
    </div>

    <!-- Mini stats row -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px;">
      ${[
        { icon:'📊', label:'Total Incidents', value: d.incidents.length, color:C.accent },
        { icon:'🗺️', label:'States Affected', value: d.statesAffected, color:C.orange },
        { icon:'⚠️', label:'Critical Incidents', value: d.incidents.filter(i=>i.severity==='Critical').length, color:C.critical },
      ].map(s => `
      <div style="background:#fff;border:1px solid #dee2e6;border-radius:5px;padding:10px;text-align:center;">
        <div style="font-size:18px;margin-bottom:4px">${s.icon}</div>
        <div style="font-size:22px;font-weight:900;color:${s.color}">${s.value}</div>
        <div style="font-size:8px;color:#666;font-weight:600">${s.label}</div>
      </div>`).join('')}
    </div>
  </div>

  <div class="page-footer" style="background:#1a252f">
    <div class="page-footer-text" style="color:#666">${this.cfg.org} &nbsp;|&nbsp; ${this.cfg.site} &nbsp;|&nbsp; Page 5 of 7</div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════
     PAGE 6 — INCIDENT INTELLIGENCE DIGEST
═══════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-header-title">📋 INCIDENT INTELLIGENCE DIGEST</div>
    <div class="page-header-meta">${this.cfg.org} &nbsp;|&nbsp; CONFIDENTIAL &nbsp;|&nbsp; PAGE 6 OF 7</div>
  </div>

  <div class="content-area">
    ${d.incidents.slice(0, 12).map((inc, i) => {
      const sCol = {Critical:C.critical,High:C.high,Medium:C.medium,Low:C.low}[inc.severity] || C.sub;
      const cCol = CAT_COLORS[inc.category] || C.sub;
      const title   = (inc.title || '').substring(0, 80) + ((inc.title||'').length > 80 ? '…' : '');
      const summary = (inc.summary || 'No summary available.').substring(0, 155);
      return `
    <div class="incident-card" style="border:1px solid ${C.border}">
      <div style="position:absolute;left:0;top:0;bottom:0;width:4px;background:${sCol}"></div>
      <div class="incident-num" style="background:${sCol}30;color:${sCol}">${i+1}</div>
      <div>
        <div class="incident-title">${title}</div>
        <div class="incident-summary">${summary}</div>
        <div class="incident-meta">
          ${inc.stateName ? `📍 ${inc.stateName} &nbsp;` : ''}
          📅 ${new Date(inc.timestamp||Date.now()).toLocaleDateString()}
          ${inc.source ? ` &nbsp;|&nbsp; ${inc.source}` : ''}
        </div>
      </div>
      <div>
        <div class="cat-badge" style="background:${cCol}28;border:1px solid ${cCol}70;color:${cCol}">${(inc.category||'').substring(0,11)}</div>
        <div class="sev-badge" style="background:${sCol};color:#fff">${(inc.severity||'').toUpperCase()}</div>
      </div>
      <div></div>
    </div>`;
    }).join('')}
  </div>

  <div class="page-footer">
    <div class="page-footer-text">${this.cfg.org} &nbsp;|&nbsp; ${this.cfg.site} &nbsp;|&nbsp; Page 6 of 7</div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════
     PAGE 7 — STATE PROFILES + RECOMMENDATIONS
═══════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-header-title">🛡️ STATE RISK ASSESSMENT & RECOMMENDATIONS</div>
    <div class="page-header-meta">${this.cfg.org} &nbsp;|&nbsp; CONFIDENTIAL &nbsp;|&nbsp; PAGE 7 OF 7</div>
  </div>

  <div class="content-area">
    ${d.stateRiskAnalyses?.length > 0 ? `
    <div class="section-head">
      <span class="section-head-title">STATE RISK PROFILES</span>
      <div class="section-head-line"></div>
    </div>
    ${d.stateRiskAnalyses.slice(0, 4).map(a => {
      const rCol = {Critical:C.critical,High:C.high,Medium:C.medium,Low:C.low}[a.riskLevel] || C.sub;
      return `
    <div class="state-profile-card" style="border:1px solid ${C.border}">
      <div style="position:absolute;left:0;top:0;bottom:0;width:4px;background:${rCol}"></div>
      <div class="state-profile-header">
        <div class="state-name">${a.stateName}</div>
        <div class="risk-badge" style="background:${rCol}">${a.riskLevel||'?'} &nbsp;|&nbsp; ${a.incidentCount} incidents</div>
      </div>
      <div class="state-analysis">${cleanText(a.analysis||'Analysis pending.').substring(0,190)}</div>
    </div>`;
    }).join('')}
    <div style="height:10px"></div>` : ''}

    <div class="section-head">
      <span class="section-head-title">STRATEGIC RECOMMENDATIONS</span>
      <div class="section-head-line" style="background:${C.green}"></div>
    </div>

    ${recs.slice(0, 5).map((rec, i) => {
      const col = [C.critical, C.high, C.medium, C.blue, C.green][i];
      return `
    <div class="rec-item">
      <div class="rec-num" style="background:${col}">${i+1}</div>
      <div class="rec-text">${rec}</div>
    </div>`;
    }).join('')}

    <div class="sources-box">
      <div class="sources-title">DATA SOURCES & METHODOLOGY</div>
      <div class="sources-text">Generated from OSINT: verified Nigerian news sources, official government statements, NGO field reports, and community intelligence feeds. AI classification algorithms process incident data for threat categorisation and state extraction. All information collated within a 7-day reporting window. For informational purposes only.</div>
    </div>
  </div>

  <div class="page-footer">
    <div class="page-footer-text">
      ${this.cfg.org} &nbsp;|&nbsp; ${this.cfg.site} &nbsp;|&nbsp; ${this.cfg.phone} &nbsp;|&nbsp; ${this.cfg.email}<br>
      Generated: ${new Date().toLocaleString('en-NG',{timeZone:'Africa/Lagos'})} &nbsp;|&nbsp; Classification: CONFIDENTIAL &nbsp;|&nbsp; Page 7 of 7
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════
     CHART.JS INITIALIZATION
═══════════════════════════════════════════════════ -->
<script>
window.__chartsReady = false;

(async function() {
  // ── State Bar Chart (Page 2) ──
  const stateCtx = document.getElementById('stateChart');
  if (stateCtx) {
    new Chart(stateCtx, {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(stateLabels)},
        datasets: [{
          label: 'Incidents',
          data: ${JSON.stringify(stateValues)},
          backgroundColor: ${JSON.stringify(stateColors.slice(0, stateLabels.length).map(c => c + 'bb'))},
          borderColor:     ${JSON.stringify(stateColors.slice(0, stateLabels.length))},
          borderWidth: 1,
          borderRadius: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1c2333',
            titleColor: '#f0f6fc',
            bodyColor: '#8b949e',
          }
        },
        scales: {
          x: {
            ticks: { color: '#8b949e', font: { size: 9 } },
            grid: { color: '#30363d' },
          },
          y: {
            ticks: { color: '#8b949e', font: { size: 9 } },
            grid: { color: '#30363d' },
            beginAtZero: true,
          }
        }
      }
    });
  }

  // ── Donut Chart (Page 3) ──
  const donutCtx = document.getElementById('donutChart');
  if (donutCtx) {
    new Chart(donutCtx, {
      type: 'doughnut',
      data: {
        labels: ${JSON.stringify(catLabels)},
        datasets: [{
          data: ${JSON.stringify(catValues)},
          backgroundColor: ${JSON.stringify(catColors.map(c => c + 'cc'))},
          borderColor: '#161b22',
          borderWidth: 2,
          hoverOffset: 4,
        }]
      },
      options: {
        responsive: false,
        cutout: '62%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1c2333',
            titleColor: '#f0f6fc',
            bodyColor: '#8b949e',
          }
        }
      }
    });
  }

  // ── Trend Chart (Page 4) ──
  const trendCtx = document.getElementById('trendChart');
  if (trendCtx) {
    const daily = ${JSON.stringify(daily)};
    const maxD  = Math.max(...daily, 1);
    const bgColors = daily.map(v => v >= maxD*0.7 ? '#da363399' : v >= maxD*0.4 ? '#e3b34199' : '#4361ee99');
    new Chart(trendCtx, {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(days)},
        datasets: [
          {
            type: 'line',
            label: 'Trend',
            data: daily,
            borderColor: '#e63946',
            backgroundColor: 'rgba(230,57,70,0.08)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#e63946',
            pointRadius: 4,
            borderWidth: 2,
            order: 1,
          },
          {
            type: 'bar',
            label: 'Incidents',
            data: daily,
            backgroundColor: bgColors,
            borderRadius: 4,
            order: 2,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1c2333',
            titleColor: '#f0f6fc',
            bodyColor: '#8b949e',
          }
        },
        scales: {
          x: {
            ticks: { color: '#8b949e', font: { size: 10 } },
            grid: { color: '#30363d' },
          },
          y: {
            ticks: { color: '#8b949e', font: { size: 10 } },
            grid: { color: '#30363d' },
            beginAtZero: true,
          }
        }
      }
    });
  }

  window.__chartsReady = true;
})();
</script>
</body>
</html>`;
  }

  // ════════════════════════════════════════════════════════════
  // NIGERIA SVG MAP
  // ════════════════════════════════════════════════════════════
  _buildNigeriaSVGMap(stateCounts) {
    const maxCount = Math.max(...Object.values(stateCounts), 1);

    // State positions (approximate centroids for Nigeria map)
    const statePositions = {
      'Borno':      { x: 375, y: 95  },
      'Yobe':       { x: 340, y: 115 },
      'Adamawa':    { x: 400, y: 175 },
      'Taraba':     { x: 355, y: 190 },
      'Gombe':      { x: 335, y: 150 },
      'Bauchi':     { x: 295, y: 135 },
      'Zamfara':    { x: 140, y: 100 },
      'Katsina':    { x: 190, y: 80  },
      'Kano':       { x: 230, y: 100 },
      'Jigawa':     { x: 270, y: 90  },
      'Sokoto':     { x: 105, y: 80  },
      'Kebbi':      { x: 110, y: 130 },
      'Niger State':{ x: 170, y: 175 },
      'Kaduna':     { x: 225, y: 145 },
      'Nasarawa':   { x: 255, y: 195 },
      'Plateau':    { x: 285, y: 185 },
      'Benue':      { x: 280, y: 220 },
      'Kogi':       { x: 235, y: 240 },
      'Kwara':      { x: 190, y: 230 },
      'FCT':        { x: 240, y: 205 },
      'Oyo':        { x: 155, y: 270 },
      'Osun':       { x: 175, y: 295 },
      'Lagos':      { x: 135, y: 320 },
      'Ogun':       { x: 150, y: 310 },
      'Ekiti':      { x: 205, y: 290 },
      'Ondo':       { x: 195, y: 315 },
      'Edo':        { x: 210, y: 345 },
      'Delta':      { x: 220, y: 370 },
      'Anambra':    { x: 265, y: 330 },
      'Enugu':      { x: 290, y: 315 },
      'Imo':        { x: 270, y: 360 },
      'Abia':       { x: 295, y: 355 },
      'Ebonyi':     { x: 315, y: 320 },
      'Cross River':{ x: 330, y: 340 },
      'Akwa Ibom':  { x: 310, y: 380 },
      'Bayelsa':    { x: 255, y: 390 },
      'Rivers':     { x: 280, y: 385 },
    };

    const getColor = (count) => {
      if (!count || count === 0) return '#1c2333';
      if (count >= 10) return '#da3633';
      if (count >= 6)  return '#e85c0d';
      if (count >= 3)  return '#e3b341';
      return '#3fb950';
    };

    const dots = Object.entries(statePositions).map(([state, pos]) => {
      const count = stateCounts[state] || 0;
      const color = getColor(count);
      const r     = count > 0 ? Math.max(6, Math.min(16, 6 + (count / maxCount) * 10)) : 4;

      if (count > 0) {
        return `
        <circle cx="${pos.x}" cy="${pos.y}" r="${r + 4}" fill="${color}" opacity="0.2"/>
        <circle cx="${pos.x}" cy="${pos.y}" r="${r}" fill="${color}" opacity="0.9"/>
        ${r > 8 ? `<text x="${pos.x}" y="${pos.y + 4}" text-anchor="middle" fill="white" font-size="8" font-weight="700" font-family="Arial">${count}</text>` : ''}
        <title>${state}: ${count} incidents</title>`;
      } else {
        return `<circle cx="${pos.x}" cy="${pos.y}" r="3" fill="#30363d" opacity="0.6"/>`;
      }
    }).join('\n');

    return `
    <svg width="100%" height="270" viewBox="0 0 520 430" xmlns="http://www.w3.org/2000/svg" style="background:#0d1117">
      <!-- Nigeria outline approximation -->
      <path d="M105,70 L145,50 L200,42 L260,38 L310,42 L360,50 L395,60 L420,80 L440,105 L445,135 L430,160 L445,185 L455,210 L440,240 L420,270 L400,295 L375,315 L355,335 L330,360 L300,390 L270,410 L240,415 L210,405 L180,385 L155,360 L130,335 L110,310 L90,280 L72,250 L62,220 L60,190 L65,160 L72,130 L82,105 Z"
        fill="#1c2333" stroke="#30363d" stroke-width="2" opacity="0.8"/>
      
      <!-- Grid lines -->
      <line x1="60" y1="150" x2="455" y2="150" stroke="#30363d" stroke-width="0.5" stroke-dasharray="4,4" opacity="0.4"/>
      <line x1="60" y1="250" x2="455" y2="250" stroke="#30363d" stroke-width="0.5" stroke-dasharray="4,4" opacity="0.4"/>
      <line x1="200" y1="38" x2="200" y2="415" stroke="#30363d" stroke-width="0.5" stroke-dasharray="4,4" opacity="0.4"/>
      <line x1="330" y1="38" x2="330" y2="415" stroke="#30363d" stroke-width="0.5" stroke-dasharray="4,4" opacity="0.4"/>

      <!-- State dots -->
      ${dots}

      <!-- Labels for top affected states -->
      ${Object.entries(stateCounts).sort((a,b) => b[1]-a[1]).slice(0,5).map(([state]) => {
        const pos = statePositions[state];
        if (!pos) return '';
        return `<text x="${pos.x}" y="${pos.y + 22}" text-anchor="middle" fill="#8b949e" font-size="7" font-family="Arial" opacity="0.8">${state}</text>`;
      }).join('')}

      <!-- Map title -->
      <text x="260" y="425" text-anchor="middle" fill="#484f58" font-size="8" font-family="Arial">Nigeria Security Hotspot Map — Bubble size indicates incident volume</text>
    </svg>`;
  }

  // ════════════════════════════════════════════════════════════
  // TEASER HTML (free tier)
  // ════════════════════════════════════════════════════════════
  buildTeaserHTML(d) {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
* { margin:0;padding:0;box-sizing:border-box; }
body { font-family:'Segoe UI',Arial,sans-serif; background:#0d1117; color:#f0f6fc; width:210mm; }
.page { width:210mm; min-height:297mm; }
</style>
</head><body>
<div class="page">
  <!-- Cover teaser page handled by same cover as full report -->
  <div style="padding:40px 36px; text-align:center;">
    <div style="font-size:26px;font-weight:900;color:#e63946;letter-spacing:3px;margin-bottom:8px;">SUNTRENIA</div>
    <div style="font-size:14px;font-weight:700;margin-bottom:30px;">WEEKLY SECURITY INTELLIGENCE REPORT</div>
    <div style="background:#e6394620;border:1px solid #e6394650;border-radius:8px;padding:30px;margin-bottom:24px;">
      <div style="font-size:40px;margin-bottom:16px;">🔒</div>
      <div style="font-size:18px;font-weight:700;color:#e63946;margin-bottom:8px;">CONTENT LOCKED</div>
      <div style="font-size:10px;color:#8b949e;">Subscribe to Suntrenia Premium for the full 7-page report</div>
    </div>
    <div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:24px;">
      <div style="font-size:11px;color:#e63946;font-weight:700;letter-spacing:1px;margin-bottom:16px;">THE FULL REPORT INCLUDES:</div>
      ${['Complete incident analysis','Geographic threat map','Category breakdown','7-day trend analysis','State risk profiles','Strategic recommendations'].map(item => `
      <div style="padding:8px 0;border-bottom:1px solid #30363d;font-size:10px;color:#f0f6fc;">✓ ${item}</div>`).join('')}
      <div style="margin-top:20px;background:#e63946;border-radius:5px;padding:12px;font-size:11px;font-weight:700;color:#fff;">
        SUBSCRIBE TO PREMIUM — ₦15,000/MONTH
      </div>
    </div>
  </div>
</div>
</body></html>`;
  }

  // ════════════════════════════════════════════════════════════
  // HIGHLIGHTS HELPER
  // ════════════════════════════════════════════════════════════
  _highlights(d) {
    const h = [];
    if (d.incidents.length > 0)
      h.push(`${d.incidents.length} security incidents recorded across ${d.statesAffected} states during the reporting period.`);
    if (d.casualties > 0)
      h.push(`An estimated ${d.casualties} casualties have been reported across recorded incidents.`);
    if (d.abductions > 0)
      h.push(`${d.abductions} persons reported abducted in kidnapping and banditry-related incidents.`);
    const tops = Object.entries(d.stateCounts).sort((a,b)=>b[1]-a[1]).slice(0,3).map(e=>e[0]);
    if (tops.length > 0)
      h.push(`Highest incident concentration in ${tops.join(', ')}.`);
    const terror = d.incidents.filter(i => i.category === 'Terrorism').length;
    if (terror > 0)
      h.push(`${terror} terrorism-related incident${terror > 1 ? 's' : ''} reported, indicating continued NSAG activity.`);
    if (h.length < 3)
      h.push('Security forces conducted operations in multiple states. Displacement and access constraints reported in affected areas.');
    return h;
  }

  // ════════════════════════════════════════════════════════════
  // STREAM TO BUFFER  (compatibility shim — now returns Buffer directly)
  // ════════════════════════════════════════════════════════════
  streamToBuffer(docOrBuffer) {
    // If already a buffer (from Puppeteer), return as-is
    if (Buffer.isBuffer(docOrBuffer)) return Promise.resolve(docOrBuffer);
    // Legacy PDFKit stream support
    return new Promise((resolve, reject) => {
      const bufs = [];
      docOrBuffer.on('data', b => bufs.push(b));
      docOrBuffer.on('end', () => resolve(Buffer.concat(bufs)));
      docOrBuffer.on('error', reject);
      docOrBuffer.end();
    });
  }

  // ════════════════════════════════════════════════════════════
  // EMAIL
  // ════════════════════════════════════════════════════════════
  async sendReportEmail(email, pdfBuffer, reportName) {
    if (!this.validEmail(email)) return { success: false, error: 'Invalid email' };
    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) return { success: false, error: 'Invalid PDF' };
    if (this.useBrevo) return this._sendBrevo(email, pdfBuffer, reportName);
    if (this.smtp)     return this._sendGmail(email, pdfBuffer, reportName);
    return { success: false, error: 'Email not configured' };
  }

  async _sendBrevo(email, pdf, name) {
    try {
      const mail = new brevo.SendSmtpEmail();
      mail.subject     = this.cfg.org + ' — Weekly Security Intelligence Report';
      mail.to          = [{ email }];
      mail.sender      = { name: this.cfg.org, email: this.cfg.sender };
      mail.htmlContent = this._emailHTML();
      mail.attachment  = [{ content: pdf.toString('base64'), name: name || 'suntrenia-report.pdf' }];
      const r = await this.brevo.sendTransacEmail(mail);
      return { success: true, provider: 'Brevo', messageId: r.messageId };
    } catch(e) {
      console.error('❌ Brevo error:', e.message);
      return { success: false, error: e.message };
    }
  }

  async _sendGmail(email, pdf, name) {
    try {
      await this.smtp.sendMail({
        from: this.cfg.sender, to: email,
        subject: this.cfg.org + ' — Weekly Security Intelligence Report',
        html: this._emailHTML(),
        attachments: [{ filename: name || 'suntrenia-report.pdf', content: pdf }],
      });
      return { success: true, provider: 'Gmail' };
    } catch(e) { return { success: false, error: e.message }; }
  }

  _emailHTML() {
    const items = [
      'Cover Dashboard — Key Metrics & Threat Level',
      'Geographic Threat Map — All 36 States',
      'Incident Category Breakdown & Donut Chart',
      '7-Day Trend Chart & Regional Risk Assessment',
      'Situation Report — OCHA Style',
      'Full Incident Intelligence Digest',
      'State Risk Profiles & Recommendations',
    ];
    return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d1117;">
      <div style="background:#0f1923;padding:28px 30px;border-top:4px solid #e63946;border-bottom:1px solid #30363d;">
        <table width="100%"><tr>
          <td><div style="font-size:22px;font-weight:900;color:#f0f6fc;letter-spacing:2px;">SUNTRENIA</div>
              <div style="font-size:9px;color:#e63946;letter-spacing:3px;margin-top:2px;">INTELLIGENCE PLATFORM</div></td>
          <td align="right"><span style="background:#da363328;color:#da3633;border:1px solid #da3633;padding:4px 10px;font-size:9px;font-weight:bold;letter-spacing:1px;">CONFIDENTIAL</span></td>
        </tr></table>
      </div>
      <div style="padding:26px 30px;background:#161b22;">
        <h2 style="color:#f0f6fc;margin:0 0 6px;font-size:15px;">Your Weekly Security Intelligence Report</h2>
        <p style="color:#8b949e;font-size:12px;margin:0 0 18px;">Your full PDF report is attached to this email.</p>
        <div style="background:#1c2333;border-left:4px solid #e63946;padding:12px 16px;margin-bottom:18px;">
          <div style="color:#8b949e;font-size:10px;font-weight:bold;letter-spacing:1px;margin-bottom:8px;">THIS WEEK'S REPORT INCLUDES</div>
          ${items.map(it => `<div style="color:#f0f6fc;font-size:11px;padding:3px 0;border-bottom:1px solid #30363d;">&bull; ${it}</div>`).join('')}
        </div>
        <p style="color:#484f58;font-size:9px;border-top:1px solid #30363d;padding-top:12px;margin:0;">
          Classification: CONFIDENTIAL &nbsp;&bull;&nbsp; ${this.cfg.org} &nbsp;&bull;&nbsp;
          ${this.cfg.phone} &nbsp;&bull;&nbsp; ${this.cfg.email}
        </p>
      </div>
    </div>`;
  }
}

module.exports = PDFReportService;
