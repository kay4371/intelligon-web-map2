// ============================================
// FILE: infographicGenerator.js
// Suntrenia Intelligence — Puppeteer Infographic v4
// ● Full HTML/CSS rendering via Puppeteer (1080×1920)
// ● Replaces buggy node-canvas emoji/font rendering
// ● Chart.js charts, SVG icons, gradients, maps
// ● WhatsApp-optimised portrait infographic
// ============================================

const puppeteer = require('puppeteer');

class InfographicGenerator {
  constructor() {
    this.width  = 1080;
    this.height = 1920;

    this.colors = {
      bg1: '#0d1117', bg2: '#161b22', bg3: '#1c2333',
      accent: '#e63946', accentOrange: '#f77f00',
      accentYellow: '#fcbf49', accentBlue: '#4361ee',
      accentGreen: '#2dc653', accentPurple: '#9b5de5',
      textPrimary: '#f0f6fc', textSecondary: '#8b949e',
      textMuted: '#484f58', border: '#30363d',
      critical: '#da3633', high: '#e85c0d',
      medium: '#e3b341', low: '#3fb950',
    };

    this.categoryColors = {
      'Banditry':           '#e63946',
      'Terrorism':          '#9b5de5',
      'Kidnapping':         '#f77f00',
      'Communal Clash':     '#4361ee',
      'Military Operation': '#2dc653',
      'Armed Robbery':      '#fcbf49',
      'Farmer-Herder':      '#00b4d8',
      'Cult Violence':      '#e040fb',
      'Other':              '#8b949e',
      'Unknown':            '#484f58',
    };

    this.categoryIcons = {
      'Banditry':           '⚔️',
      'Terrorism':          '💥',
      'Kidnapping':         '🔒',
      'Communal Clash':     '🛡️',
      'Military Operation': '⭐',
      'Armed Robbery':      '🔫',
      'Farmer-Herder':      '🌾',
      'Cult Violence':      '💀',
      'Other':              '◆',
      'Unknown':            '?',
    };
  }

  // ════════════════════════════════════════════════════════════
  // MAIN ENTRY — renders HTML to PNG via Puppeteer
  // ════════════════════════════════════════════════════════════
  async generateInfographic(reportData) {
    console.log('🎨 Generating infographic via Puppeteer...');

    const html = this.buildHTML(reportData);
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
      await page.setViewport({ width: this.width, height: this.height, deviceScaleFactor: 2 });
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });

      // Wait for Chart.js to finish rendering
      await page.waitForFunction(() => window.__chartsReady === true, { timeout: 15000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 1000));

      const buffer = await page.screenshot({
        type: 'png',
        fullPage: true,
        clip: { x: 0, y: 0, width: this.width, height: this.height },
      });

      console.log('✅ Infographic generated via Puppeteer');
      return buffer;

    } finally {
      if (browser) await browser.close();
    }
  }

  // ════════════════════════════════════════════════════════════
  // BUILD HTML
  // ════════════════════════════════════════════════════════════
  buildHTML(data) {
    const incidents = data.incidents || [];
    const total     = incidents.length || 1;

    // Category counts
    const catCounts = {};
    incidents.forEach(inc => {
      const cat = inc.aiClassification || inc.category || 'Unknown';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });
    const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 7);
    if (sortedCats.length === 0) {
      sortedCats.push(...[['Banditry',8],['Kidnapping',5],['Terrorism',3],['Communal Clash',2],['Other',1]]);
    }

    // State counts
    const stateCounts = {};
    incidents.forEach(inc => {
      const state = inc.stateName || inc.state || inc.location?.state;
      if (state) stateCounts[state] = (stateCounts[state] || 0) + 1;
    });
    let topStates = Object.entries(stateCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (topStates.length === 0) {
      topStates = (data.affectedStateNames || ['Borno','Zamfara','Katsina','Niger','Kaduna'])
        .slice(0, 5).map((s, i) => [s, 5 - i]);
    }

    // Trend data
    let daily = new Array(7).fill(0);
    if (data.trendData?.data?.length > 0) {
      daily = data.trendData.data.slice(0, 7);
    } else {
      incidents.forEach((inc, idx) => { daily[idx % 7]++; });
    }

    // Threat level
    const inc = incidents.length;
    const threatLvl = inc >= 20 ? { color: '#da3633', label: 'CRITICAL', num: 4, desc: 'Severe — avoid non-essential travel' }
                    : inc >= 10 ? { color: '#e85c0d', label: 'HIGH',     num: 3, desc: 'Elevated — heightened precautions' }
                    : inc >= 5  ? { color: '#e3b341', label: 'MODERATE', num: 2, desc: 'Notable — standard precautions' }
                    :             { color: '#3fb950', label: 'LOW',       num: 1, desc: 'Minimal — maintain awareness' };

    // Regional risk
    const regions = [
      { name: 'NORTH EAST',    states: ['Borno','Yobe','Adamawa','Gombe','Bauchi','Taraba'] },
      { name: 'NORTH WEST',    states: ['Zamfara','Katsina','Sokoto','Kebbi','Kano','Kaduna','Jigawa'] },
      { name: 'NORTH CENTRAL', states: ['Niger State','Benue','Nasarawa','Plateau','Kogi','Kwara','FCT'] },
      { name: 'SOUTH WEST',    states: ['Lagos','Ogun','Oyo','Osun','Ondo','Ekiti'] },
      { name: 'SOUTH EAST',    states: ['Anambra','Enugu','Ebonyi','Imo','Abia'] },
      { name: 'SOUTH SOUTH',   states: ['Rivers','Delta','Bayelsa','Cross River','Akwa Ibom','Edo'] },
    ];
    const affectedSet = new Set(Object.keys(stateCounts).map(s => s.toLowerCase()));
    const regionColors = ['#da3633','#e85c0d','#e3b341','#4361ee','#2dc653','#9b5de5'];

    // Dates
    const now     = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const dateStr = `${weekAgo.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}).toUpperCase()} — ${now.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase()}`;

    const catLabels  = sortedCats.map(([c]) => c);
    const catValues  = sortedCats.map(([,v]) => v);
    const catColors  = sortedCats.map(([c]) => this.categoryColors[c] || '#8b949e');
    const days       = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  
  body {
    font-family: 'Segoe UI', -apple-system, Arial, sans-serif;
    background: #0d1117;
    width: ${this.width}px;
    height: ${this.height}px;
    overflow: hidden;
    color: #f0f6fc;
  }

  .wrap {
    width: ${this.width}px;
    background: linear-gradient(180deg, #0d1117 0%, #0f1923 40%, #0a1628 100%);
    position: relative;
    padding-bottom: 0;
  }

  /* subtle grid overlay */
  .wrap::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
    background-size: 60px 60px;
    pointer-events: none;
    z-index: 0;
  }

  .content { position: relative; z-index: 1; }

  /* ── HEADER ── */
  .header {
    background: linear-gradient(135deg, #1a0a0a 0%, #1c1228 50%, #0a1a2a 100%);
    padding: 0;
    border-bottom: 1px solid #30363d;
  }

  .header-top-bar {
    height: 8px;
    background: linear-gradient(90deg, #e63946 0%, #ff6b6b 50%, #9b5de5 100%);
  }

  .header-inner {
    padding: 28px 40px 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header-left { display: flex; align-items: center; gap: 20px; }

  .shield-svg { width: 80px; height: 92px; }

  .org-title { font-size: 58px; font-weight: 900; letter-spacing: 4px; color: #f0f6fc; line-height: 1; }
  .org-sub   { font-size: 17px; color: #e63946; letter-spacing: 4px; margin-top: 5px; font-weight: 700; }

  .date-badge {
    background: rgba(230,57,70,0.12);
    border: 1.5px solid rgba(230,57,70,0.4);
    border-radius: 6px;
    padding: 6px 16px;
    font-size: 17px;
    color: #ff9999;
    letter-spacing: 1px;
    margin-top: 10px;
    display: inline-block;
  }

  .confidential-badge {
    background: rgba(218,54,51,0.2);
    border: 2px solid #da3633;
    border-radius: 6px;
    padding: 12px 22px;
    text-align: center;
  }
  .confidential-badge .lbl { font-size: 18px; font-weight: 700; color: #da3633; letter-spacing: 2px; }
  .confidential-badge .sub { font-size: 13px; color: #ff9999; margin-top: 3px; }

  .report-title-band {
    background: #1c1228;
    padding: 14px 40px;
    text-align: center;
    border-bottom: 1px solid #30363d;
  }
  .report-title-band h1 { font-size: 26px; font-weight: 800; letter-spacing: 2px; }
  .report-title-band p  { font-size: 16px; color: #8b949e; margin-top: 4px; }

  /* ── METRICS ── */
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    padding: 24px 40px;
  }

  .metric-card {
    border-radius: 12px;
    padding: 24px 16px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }

  .metric-card-bar {
    position: absolute; top: 0; left: 0; right: 0; height: 4px;
  }

  .metric-icon { font-size: 36px; margin-bottom: 10px; }
  .metric-value { font-size: 64px; font-weight: 900; line-height: 1; margin-bottom: 6px; }
  .metric-label { font-size: 15px; font-weight: 700; letter-spacing: 2px; margin-bottom: 4px; }
  .metric-sub   { font-size: 13px; color: #8b949e; }

  /* ── THREAT BANNER ── */
  .threat-banner {
    margin: 0 40px 20px;
    border-radius: 10px;
    padding: 20px 24px;
    display: flex;
    align-items: center;
    gap: 20px;
    position: relative;
  }
  .threat-banner-bar { position: absolute; left:0; top:0; bottom:0; width:6px; border-radius:10px 0 0 10px; }
  .threat-icon { font-size: 40px; }
  .threat-text { flex: 1; }
  .threat-level-lbl { font-size: 22px; font-weight: 800; letter-spacing: 1px; }
  .threat-level-desc { font-size: 16px; color: #8b949e; margin-top: 4px; }
  .threat-bars { display: flex; align-items: flex-end; gap: 5px; height: 44px; }
  .threat-bar { width: 20px; border-radius: 3px 3px 0 0; }

  /* ── SECTION HEADER ── */
  .section-hd {
    display: flex; align-items: center; gap: 12px;
    padding: 0 40px; margin-bottom: 14px;
  }
  .section-hd-title { font-size: 17px; font-weight: 700; letter-spacing: 2px; color: #8b949e; white-space: nowrap; }
  .section-hd-line  { flex: 1; height: 1px; background: #30363d; }

  /* ── CATEGORY BARS ── */
  .cat-section { padding: 0 40px; margin-bottom: 20px; }

  .cat-row {
    display: flex; align-items: center; gap: 12px;
    margin-bottom: 10px;
  }
  .cat-icon-circle {
    width: 46px; height: 46px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; flex-shrink: 0;
  }
  .cat-name  { font-size: 16px; font-weight: 700; width: 200px; letter-spacing: 0.5px; }
  .cat-track { flex: 1; height: 20px; border-radius: 4px; overflow: hidden; }
  .cat-fill  { height: 100%; border-radius: 4px; }
  .cat-badge { padding: 4px 14px; border-radius: 5px; font-size: 14px; font-weight: 700; width: 100px; text-align: center; }

  /* ── HOTSPOT STATES ── */
  .hotspot-section { padding: 0 40px; margin-bottom: 20px; }
  .hotspot-grid    { display: grid; grid-template-columns: repeat(5,1fr); gap: 12px; }

  .hotspot-chip {
    border-radius: 10px; padding: 16px 10px;
    text-align: center; position: relative; overflow: hidden;
  }
  .hotspot-chip-bar { position: absolute; top: 0; left: 0; right: 0; height: 4px; }
  .hotspot-rank {
    position: absolute; top: 10px; left: 10px;
    width: 28px; height: 20px; border-radius: 4px;
    font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center;
  }
  .hotspot-name  { font-size: 13px; font-weight: 700; letter-spacing: 0.5px; margin: 22px 0 6px; }
  .hotspot-count { font-size: 42px; font-weight: 900; line-height: 1; }
  .hotspot-label { font-size: 12px; color: #8b949e; margin-top: 3px; }

  /* ── CHARTS ── */
  .chart-section { padding: 0 40px; margin-bottom: 20px; }
  .chart-box { background: #161b22; border-radius: 10px; padding: 20px; }

  /* ── REGIONAL GRID ── */
  .regions-section { padding: 0 40px; margin-bottom: 20px; }
  .regions-grid    { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }

  .region-card {
    border-radius: 8px; padding: 16px 14px;
    position: relative; overflow: hidden;
  }
  .region-card-bar { position: absolute; left:0; top:0; bottom:0; width:5px; }
  .region-name { font-size: 14px; font-weight: 800; padding-left: 10px; letter-spacing: 0.5px; }
  .region-sub  { font-size: 12px; color: #8b949e; padding-left: 10px; margin: 3px 0 8px; }
  .region-dots { display: flex; gap: 5px; padding-left: 10px; flex-wrap: wrap; }
  .region-dot  {
    width: 26px; height: 26px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 8px; font-weight: 700;
  }
  .region-risk-badge {
    position: absolute; top: 14px; right: 12px;
    padding: 4px 10px; border-radius: 4px;
    font-size: 11px; font-weight: 700; color: #fff;
  }

  /* ── CTA FOOTER ── */
  .footer-cta {
    background: linear-gradient(180deg, rgba(230,57,70,0.10) 0%, rgba(155,93,229,0.07) 100%);
    border-top: 1px solid rgba(230,57,70,0.3);
    padding: 28px 40px 32px;
    text-align: center;
  }
  .footer-cta h2 { font-size: 30px; font-weight: 800; margin-bottom: 8px; }
  .footer-cta p  { font-size: 18px; color: #8b949e; margin-bottom: 20px; }
  .cta-btn {
    background: linear-gradient(135deg, #e63946, #9b5de5);
    border-radius: 40px;
    padding: 18px 48px;
    display: inline-block;
    font-size: 20px;
    font-weight: 800;
    color: #fff;
    letter-spacing: 1px;
    margin-bottom: 16px;
  }
  .footer-brand { font-size: 16px; color: #484f58; }

  /* Divider */
  .divider { height: 1px; background: #30363d; margin: 0 40px 20px; }
</style>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
</head>
<body>
<div class="wrap">
<div class="content">

  <!-- ── HEADER ── -->
  <div class="header">
    <div class="header-top-bar"></div>
    <div class="header-inner">
      <div class="header-left">
        <svg class="shield-svg" viewBox="0 0 80 92" xmlns="http://www.w3.org/2000/svg">
          <path d="M40 4L76 20V52C76 72 60 86 40 90C20 86 4 72 4 52V20Z"
            fill="rgba(230,57,70,0.15)" stroke="#e63946" stroke-width="3"/>
          <text x="40" y="62" text-anchor="middle" fill="#e63946"
            font-family="Arial" font-size="40" font-weight="900">S</text>
        </svg>
        <div>
          <div class="org-title">SUNTRENIA</div>
          <div class="org-sub">INTELLIGENCE PLATFORM</div>
          <div class="date-badge">⏱ WEEK OF ${dateStr}</div>
        </div>
      </div>
      <div class="confidential-badge">
        <div class="lbl">CONFIDENTIAL</div>
        <div class="sub">RESTRICTED ACCESS</div>
      </div>
    </div>
  </div>

  <div class="report-title-band">
    <h1>WEEKLY SECURITY INTELLIGENCE REPORT</h1>
    <p>Nigeria — All 36 States + FCT &nbsp;|&nbsp; Multi-Source OSINT / AI Analysis</p>
  </div>

  <!-- ── KEY METRICS ── -->
  <div class="metrics-grid">
    ${[
      { icon: '⚠️',  label: 'INCIDENTS',  value: incidents.length,              sub: 'Total Recorded', color: '#e63946' },
      { icon: '📍',  label: 'STATES HIT', value: data.statesAffected || Object.keys(stateCounts).length, sub: 'of 36 + FCT', color: '#f77f00' },
      { icon: '💀',  label: 'CASUALTIES', value: data.casualties || 0,           sub: 'Est. Deaths',    color: '#da3633' },
      { icon: '⛓️',  label: 'ABDUCTED',   value: data.abductions || 0,           sub: 'Persons',        color: '#9b5de5' },
    ].map(m => `
    <div class="metric-card" style="background:${m.color}18;border:1.5px solid ${m.color}44">
      <div class="metric-card-bar" style="background:${m.color}"></div>
      <div class="metric-icon">${m.icon}</div>
      <div class="metric-value" style="color:${m.color}">${m.value}</div>
      <div class="metric-label" style="color:${m.color}">${m.label}</div>
      <div class="metric-sub">${m.sub}</div>
    </div>`).join('')}
  </div>

  <!-- ── THREAT LEVEL BANNER ── -->
  <div class="threat-banner" style="background:${threatLvl.color}12;border:1px solid ${threatLvl.color}44">
    <div class="threat-banner-bar" style="background:${threatLvl.color}"></div>
    <span class="threat-icon">🚨</span>
    <div class="threat-text">
      <div class="threat-level-lbl" style="color:${threatLvl.color}">THREAT LEVEL: ${threatLvl.label}</div>
      <div class="threat-level-desc">${threatLvl.desc}</div>
    </div>
    <div class="threat-bars">
      ${[1,2,3,4].map(i => `<div class="threat-bar" style="height:${14+i*9}px;background:${i<=threatLvl.num?threatLvl.color:threatLvl.color+'30'}"></div>`).join('')}
    </div>
  </div>

  <div class="divider"></div>

  <!-- ── CATEGORY BREAKDOWN ── -->
  <div class="section-hd">
    <span class="section-hd-title">▸ INCIDENT CATEGORY BREAKDOWN</span>
    <div class="section-hd-line"></div>
  </div>

  <div class="cat-section">
    ${sortedCats.map(([cat, count]) => {
      const color  = this.categoryColors[cat] || '#8b949e';
      const icon   = this.categoryIcons[cat]  || '◆';
      const pct    = ((count / total) * 100).toFixed(0);
      const fillW  = ((count / (sortedCats[0][1] || 1)) * 100).toFixed(1);
      return `
    <div class="cat-row">
      <div class="cat-icon-circle" style="background:${color}25;border:1.5px solid ${color}70">
        <span>${icon}</span>
      </div>
      <div class="cat-name" style="color:${color}">${cat.toUpperCase()}</div>
      <div class="cat-track" style="background:${color}20">
        <div class="cat-fill" style="width:${fillW}%;background:linear-gradient(90deg,${color},${color}aa)"></div>
      </div>
      <div class="cat-badge" style="background:${color}28;border:1px solid ${color}60;color:${color}">
        ${count} &nbsp; ${pct}%
      </div>
    </div>`;
    }).join('')}
  </div>

  <div class="divider"></div>

  <!-- ── HOTSPOT STATES ── -->
  <div class="section-hd">
    <span class="section-hd-title">▸ TOP HOTSPOT STATES</span>
    <div class="section-hd-line"></div>
  </div>

  <div class="hotspot-section">
    <div class="hotspot-grid">
      ${topStates.map(([state, count], i) => {
        const colors = ['#da3633','#e85c0d','#e3b341','#4361ee','#2dc653'];
        const col    = colors[i];
        const sName  = state.length > 9 ? state.slice(0,8)+'.' : state;
        return `
      <div class="hotspot-chip" style="background:${col}14;border:1.5px solid ${col}50">
        <div class="hotspot-chip-bar" style="background:${col}"></div>
        <div class="hotspot-rank" style="background:${col}40;color:${col}">#${i+1}</div>
        <div class="hotspot-name" style="color:${col}">${sName.toUpperCase()}</div>
        <div class="hotspot-count" style="color:${col}">${count}</div>
        <div class="hotspot-label">incidents</div>
      </div>`;
      }).join('')}
    </div>
  </div>

  <div class="divider"></div>

  <!-- ── DAILY TREND CHART ── -->
  <div class="section-hd">
    <span class="section-hd-title">▸ DAILY INCIDENT FREQUENCY (7 DAYS)</span>
    <div class="section-hd-line"></div>
  </div>

  <div class="chart-section">
    <div class="chart-box" style="height:260px">
      <canvas id="trendChart"></canvas>
    </div>
  </div>

  <div class="divider"></div>

  <!-- ── CATEGORY DONUT ── -->
  <div class="section-hd">
    <span class="section-hd-title">▸ CATEGORY DISTRIBUTION</span>
    <div class="section-hd-line"></div>
  </div>

  <div class="chart-section" style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
    <div class="chart-box" style="height:300px;display:flex;align-items:center;justify-content:center">
      <canvas id="donutChart" width="260" height="260"></canvas>
    </div>
    <div class="chart-box" style="height:300px;display:flex;flex-direction:column;justify-content:center;gap:12px;padding:20px 24px">
      ${sortedCats.slice(0,7).map(([cat,count]) => {
        const color = this.categoryColors[cat] || '#8b949e';
        const pct   = ((count/total)*100).toFixed(0);
        return `
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:14px;height:14px;background:${color};border-radius:3px;flex-shrink:0"></div>
        <div style="flex:1;font-size:15px;color:#8b949e">${cat}</div>
        <div style="font-size:15px;font-weight:700;color:${color}">${count} <span style="color:#484f58;font-weight:400">(${pct}%)</span></div>
      </div>`;
      }).join('')}
    </div>
  </div>

  <div class="divider"></div>

  <!-- ── REGIONAL RISK ── -->
  <div class="section-hd">
    <span class="section-hd-title">▸ REGIONAL RISK SUMMARY</span>
    <div class="section-hd-line"></div>
  </div>

  <div class="regions-section">
    <div class="regions-grid">
      ${regions.map((reg, i) => {
        const affN   = reg.states.filter(s => affectedSet.has(s.toLowerCase())).length;
        const ratio  = affN / reg.states.length;
        const rLabel = ratio >= 0.5 ? 'HIGH' : ratio >= 0.28 ? 'MOD' : ratio > 0 ? 'LOW' : 'CALM';
        const rColor = ratio >= 0.5 ? '#da3633' : ratio >= 0.28 ? '#e3b341' : ratio > 0 ? '#4361ee' : '#3fb950';
        return `
      <div class="region-card" style="background:${rColor}12;border:1px solid ${rColor}40">
        <div class="region-card-bar" style="background:${rColor}"></div>
        <div class="region-name">${reg.name}</div>
        <div class="region-sub">${affN}/${reg.states.length} states</div>
        <div class="region-dots">
          ${reg.states.map(s => {
            const isAff = affectedSet.has(s.toLowerCase());
            return `<div class="region-dot" style="background:${isAff?rColor:rColor+'22'};border:1px solid ${rColor}55;color:${isAff?'#fff':rColor}">${s.slice(0,2).toUpperCase()}</div>`;
          }).join('')}
        </div>
        <div class="region-risk-badge" style="background:${rColor}">${rLabel}</div>
      </div>`;
      }).join('')}
    </div>
  </div>

  <div class="divider"></div>

  <!-- ── FOOTER CTA ── -->
  <div class="footer-cta">
    <h2>📄 GET THE FULL 7-PAGE REPORT</h2>
    <p>Detailed incident breakdown • AI analysis • State risk profiles</p>
    <div class="cta-btn">⬇ DOWNLOAD FREE — CLICK LINK BELOW</div>
    <br>
    <div class="footer-brand">suntrenia.com &nbsp;•&nbsp; Powered by AI Intelligence &nbsp;•&nbsp; Generated ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase()}</div>
  </div>

</div>
</div>

<script>
window.__chartsReady = false;
(async function() {
  // ── Trend Chart ──
  const trendCtx = document.getElementById('trendChart');
  if (trendCtx) {
    const daily = ${JSON.stringify(daily)};
    const maxD  = Math.max(...daily, 1);
    const barBg = daily.map(v => v >= maxD*0.7 ? '#da363399' : v >= maxD*0.4 ? '#e3b34199' : '#4361ee99');
    new Chart(trendCtx, {
      data: {
        labels: ${JSON.stringify(days)},
        datasets: [
          {
            type: 'line',
            data: daily,
            borderColor: '#e63946',
            backgroundColor: 'rgba(230,57,70,0.08)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#e63946',
            pointRadius: 6,
            borderWidth: 3,
            order: 1,
          },
          {
            type: 'bar',
            data: daily,
            backgroundColor: barBg,
            borderRadius: 5,
            order: 2,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#8b949e', font: { size: 16 } }, grid: { color: '#30363d' } },
          y: { ticks: { color: '#8b949e', font: { size: 16 } }, grid: { color: '#30363d' }, beginAtZero: true },
        }
      }
    });
  }

  // ── Donut Chart ──
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
          borderWidth: 3,
          hoverOffset: 6,
        }]
      },
      options: {
        responsive: false,
        cutout: '60%',
        plugins: { legend: { display: false } },
      }
    });
  }

  window.__chartsReady = true;
})();
</script>
</body>
</html>`;
  }
}

module.exports = InfographicGenerator;
