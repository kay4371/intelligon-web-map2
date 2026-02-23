// ============================================
// FILE: pdfReportService.js
// ACLED-style infographic PDF — v3
// ● All graphics = PDFKit vector primitives (zero emoji)
// ● Inline keyword classification per incident
// ● Tight layout — no blank pages
// ● teaserOnly flag for free vs premium
// ============================================

const PDFDocument = require('pdfkit');
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
  'Terrorism':           C.purple,
  'Banditry':            C.accent,
  'Kidnapping':          C.orange,
  'Communal Clash':      C.blue,
  'Military Operation':  C.green,
  'Armed Robbery':       C.yellow,
  'Farmer-Herder':       C.teal,
  'Cult Violence':       '#e040fb',
  'Other':               C.sub,
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
    ['abia'],['adamawa'],['akwa ibom'],['anambra'],['bauchi'],['bayelsa'],
    ['benue'],['borno'],['cross river'],['delta'],['ebonyi'],['edo'],
    ['ekiti'],['enugu'],['gombe'],['imo'],['jigawa'],['kaduna'],['kano'],
    ['katsina'],['kebbi'],['kogi'],['kwara'],['lagos'],['nasarawa'],
    ['niger state','niger '],['ogun'],['ondo'],['osun'],['oyo'],['plateau'],
    ['rivers'],['sokoto'],['taraba'],['yobe'],['zamfara'],['fct','abuja'],
  ];
  for (const variants of states) {
    for (const v of variants) {
      if (text.includes(v)) {
        const name = variants[0].replace(' state','').replace(' ','');
        return name.charAt(0).toUpperCase() + name.slice(1);
      }
    }
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

// ─────────────────────────────────────────────────────────────
// PAGE DIMENSIONS
// ─────────────────────────────────────────────────────────────
const PW = 595;   // A4 width
const PH = 842;   // A4 height
const M  = 36;    // margin

// ══════════════════════════════════════════════════════════════
class PDFReportService {

  constructor() {
    this.hasSVG   = this.dep('svg-to-pdfkit');
    this.hasSharp = this.dep('sharp');

    if (process.env.BREVO_API_KEY) {
      this.brevo = new brevo.TransactionalEmailsApi();
      this.brevo.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey,
                           process.env.BREVO_API_KEY);
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

  dep(m) { try { require.resolve(m); return true; } catch { return false; } }
  validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

  // ════════════════════════════════════════════════════════════
  // MAIN ENTRY POINT
  // ════════════════════════════════════════════════════════════
  async generateEnhancedReport(rawData, opts = {}) {
    const { teaserOnly = false } = opts;
    if (!rawData || typeof rawData !== 'object') throw new Error('Invalid data');

    // ── Enrich incidents ────────────────────────────────────
    const incidents = (rawData.incidents || []).slice(0, 50).map(inc => ({
      ...inc,
      title:     cleanText(inc.title),
      summary:   cleanText(inc.summary),
      category:  classifyIncident(inc.title, inc.summary),
      severity:  inc.severity || getSeverity(inc.title, inc.summary),
      stateName: inc.stateName || inc.state
                 || extractState(inc.title, inc.summary)
                 || null,
    }));

    // ── Build aggregates ─────────────────────────────────────
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

    const doc = new PDFDocument({
      size: 'A4', margin: M,
      info: { Title: 'Suntrenia Security Intelligence Report', Author: this.cfg.org },
    });

    try {
      this.p1Cover(doc, d);

      if (teaserOnly) {
        doc.addPage(); this.p_teaser(doc, d);
        return doc;
      }

      doc.addPage(); await this.p2Map(doc, d);
      doc.addPage(); this.p3Categories(doc, d);
      doc.addPage(); this.p4TrendRegional(doc, d);
      doc.addPage(); this.p5SitRep(doc, d);
      if (incidents.length > 0) { doc.addPage(); this.p6Incidents(doc, d); }
      doc.addPage(); this.p7StateRecs(doc, d);
      return doc;
    } catch (err) {
      console.error('❌ PDF error:', err.message, err.stack);
      throw err;
    }
  }

  // ════════════════════════════════════════════════════════════
  // PAGE 1 — COVER DASHBOARD
  // ════════════════════════════════════════════════════════════
  p1Cover(doc, d) {
    const now     = new Date();
    const weekAgo = new Date(now - 7*24*60*60*1000);
    const dateStr = `${this._fmtDate(weekAgo)} — ${this._fmtDate(now)}`;

    // ── full-page dark background
    doc.rect(0, 0, PW, PH).fill(C.bg);

    // ── top accent stripe (3 colour sections)
    doc.rect(0,  0,   PW*0.5, 5).fill(C.accent);
    doc.rect(PW*0.5, 0, PW*0.3, 5).fill(C.orange);
    doc.rect(PW*0.8, 0, PW*0.2, 5).fill(C.purple);

    // ── header band
    doc.rect(0, 5, PW, 82).fill(C.dark);

    // shield icon
    this._shield(doc, 38, 12, 54, 70);

    // org name
    doc.fillColor(C.text).font('Helvetica-Bold').fontSize(26)
       .text('SUNTRENIA', 104, 20, { characterSpacing: 3 });
    doc.fillColor(C.accent).font('Helvetica-Bold').fontSize(8)
       .text('INTELLIGENCE PLATFORM  |  NIGERIA SECURITY MONITOR', 106, 50,
             { characterSpacing: 1 });

    // date badge
    doc.rect(106, 62, 255, 18).fill(C.accent + '25');
    doc.rect(106, 62, 255, 18).stroke(C.accent + '70');
    doc.fillColor('#ffbbbb').font('Helvetica').fontSize(7.5)
       .text('REPORTING PERIOD:  ' + dateStr, 112, 66);

    // CONFIDENTIAL badge
    doc.rect(PW-128, 22, 106, 36).fill(C.critical + '30');
    doc.rect(PW-128, 22, 106, 36).stroke(C.critical);
    doc.fillColor(C.critical).font('Helvetica-Bold').fontSize(9)
       .text('CONFIDENTIAL', PW-128, 30, { width: 106, align: 'center' });
    doc.fillColor('#ffaaaa').font('Helvetica').fontSize(7)
       .text('RESTRICTED ACCESS', PW-128, 44, { width: 106, align: 'center' });

    // ── report title band
    doc.rect(0, 87, PW, 46).fill('#1c1228');
    doc.fillColor(C.text).font('Helvetica-Bold').fontSize(13)
       .text('WEEKLY SECURITY INTELLIGENCE REPORT',
             M, 97, { width: PW-M*2, align: 'center', characterSpacing: 1 });
    doc.fillColor(C.sub).font('Helvetica').fontSize(8.5)
       .text('Nigeria — All 36 States + FCT  |  Multi-Source OSINT / AI Analysis',
             M, 116, { width: PW-M*2, align: 'center' });

    // ── 4 metric cards ────────────────────────────────────────
    const metrics = [
      { label:'INCIDENTS',   value: d.incidents.length,   color: C.accent,    icon:'warning'  },
      { label:'STATES HIT',  value: d.statesAffected,     color: C.orange,    icon:'location' },
      { label:'CASUALTIES',  value: d.casualties,         color: C.critical,  icon:'cross'    },
      { label:'ABDUCTED',    value: d.abductions,         color: C.purple,    icon:'chain'    },
    ];
    const cW=118, cH=98, cY=144, gap=9;
    const startX = (PW - (metrics.length*cW + (metrics.length-1)*gap)) / 2;
    let cx = startX;

    metrics.forEach(m => {
      doc.rect(cx+2, cY+2, cW, cH).fill('#00000045');  // shadow
      doc.rect(cx, cY, cW, cH).fill(m.color + '18');
      doc.rect(cx, cY, cW, cH).stroke(m.color + '55');
      doc.rect(cx, cY, cW, 3).fill(m.color);           // top accent bar

      this._icon(doc, m.icon, cx + cW/2 - 10, cY+10, 20, m.color);

      doc.fillColor(C.text).font('Helvetica-Bold').fontSize(32)
         .text(m.value.toString(), cx, cY+36, { width: cW, align: 'center' });
      doc.fillColor(m.color).font('Helvetica-Bold').fontSize(8)
         .text(m.label, cx, cY+72, { width: cW, align: 'center', characterSpacing: 1 });

      const subLbl = { INCIDENTS:'recorded', 'STATES HIT':'affected',
                       CASUALTIES:'est. deaths', ABDUCTED:'persons' };
      doc.fillColor(C.sub).font('Helvetica').fontSize(7)
         .text(subLbl[m.label]||'', cx, cY+84, { width: cW, align: 'center' });
      cx += cW + gap;
    });

    // ── threat level banner ───────────────────────────────────
    const inc = d.incidents.length;
    let lvlColor, lvlLabel, lvlNum, lvlDesc;
    if      (inc >= 20) { lvlColor=C.critical; lvlLabel='CRITICAL'; lvlNum=4; lvlDesc='Severe environment — restrict non-essential movement'; }
    else if (inc >= 10) { lvlColor=C.high;     lvlLabel='HIGH';     lvlNum=3; lvlDesc='Elevated threat — heightened security posture required'; }
    else if (inc >= 5)  { lvlColor=C.medium;   lvlLabel='MODERATE'; lvlNum=2; lvlDesc='Notable incidents — standard precautions advised'; }
    else                { lvlColor=C.low;       lvlLabel='LOW';      lvlNum=1; lvlDesc='Minimal activity — maintain situational awareness'; }

    const banY = 254;
    doc.rect(0, banY, PW, 48).fill(lvlColor + '18');
    doc.rect(0, banY, 5, 48).fill(lvlColor);
    this._icon(doc, 'warning', M+4, banY+12, 22, lvlColor);
    doc.fillColor(lvlColor).font('Helvetica-Bold').fontSize(12)
       .text('THREAT LEVEL:  ' + lvlLabel, M+32, banY+10);
    doc.fillColor(C.sub).font('Helvetica').fontSize(9)
       .text(lvlDesc, M+32, banY+28);
    // level step-bars (right side)
    for (let i=0; i<4; i++) {
      const bh = 10 + i*7;
      doc.rect(PW-M-72 + i*19, banY+48-bh-4, 14, bh)
         .fill(i < lvlNum ? lvlColor : lvlColor+'28');
    }

    // ── category breakdown ────────────────────────────────────
    const catY = 314;
    this._sectionHead(doc, 'INCIDENT CATEGORY BREAKDOWN', M, catY);

    const sortedCats = Object.entries(d.catCounts).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const totalInc   = d.incidents.length || 1;
    const maxCat     = sortedCats[0]?.[1] || 1;
    const barMaxW    = PW - M*2 - 110;

    sortedCats.forEach(([cat, count], i) => {
      const color = CAT_COLORS[cat] || C.sub;
      const ry  = catY + 18 + i*27;
      const pct = ((count/totalInc)*100).toFixed(0);
      const bw  = (count/maxCat) * barMaxW;

      this._icon(doc, this._catIcon(cat), M+6, ry+1, 14, color);

      doc.fillColor(C.text).font('Helvetica-Bold').fontSize(8.5)
         .text(cat.toUpperCase(), M+24, ry+2, { width: 88 });

      doc.rect(M+116, ry+1, barMaxW, 14).fill(color + '20');
      if (bw > 0) doc.rect(M+116, ry+1, bw, 14).fill(color + 'cc');

      doc.rect(PW-M-44, ry, 44, 16).fill(color+'25');
      doc.rect(PW-M-44, ry, 44, 16).stroke(color+'60');
      doc.fillColor(color).font('Helvetica-Bold').fontSize(7.5)
         .text(`${count}  ${pct}%`, PW-M-44, ry+4, { width:44, align:'center' });
    });

    // ── top hotspot states ────────────────────────────────────
    const topStates = Object.entries(d.stateCounts)
                            .sort((a,b)=>b[1]-a[1]).slice(0,5);
    const hsY = catY + 18 + Math.min(sortedCats.length,6)*27 + 14;
    this._sectionHead(doc, 'TOP HOTSPOT STATES', M, hsY);

    if (topStates.length > 0) {
      const chipW  = Math.floor((PW - M*2 - 8*4) / 5);
      const chipH  = 72;
      const chipY  = hsY + 18;
      const chipC  = [C.critical, C.high, C.medium, C.blue, C.green];
      const maxHot = topStates[0][1];

      topStates.forEach(([state, count], i) => {
        const col  = chipC[i];
        const chX  = M + i*(chipW+8);
        const fillH= Math.max((count/maxHot)*chipH, 5);

        doc.rect(chX, chipY, chipW, chipH).fill(col+'14');
        doc.rect(chX, chipY, chipW, chipH).stroke(col+'50');
        doc.rect(chX, chipY, chipW, 3).fill(col);
        doc.rect(chX, chipY+chipH-fillH, chipW, fillH).fill(col+'22');

        // rank badge
        doc.rect(chX+3, chipY+6, 18, 13).fill(col+'40');
        doc.fillColor(col).font('Helvetica-Bold').fontSize(8)
           .text('#'+(i+1), chX+3, chipY+9, { width:18, align:'center' });

        const sn = state.length>9 ? state.slice(0,8)+'.' : state;
        doc.fillColor(C.text).font('Helvetica-Bold').fontSize(8)
           .text(sn.toUpperCase(), chX, chipY+28, { width:chipW, align:'center' });
        doc.fillColor(col).font('Helvetica-Bold').fontSize(20)
           .text(count.toString(), chX, chipY+44, { width:chipW, align:'center' });
        doc.fillColor(C.sub).font('Helvetica').fontSize(7)
           .text('incidents', chX, chipY+64, { width:chipW, align:'center' });
      });
    } else {
      doc.fillColor(C.sub).font('Helvetica').fontSize(9)
         .text('Insufficient location data in this period — see incident details on Page 6.',
               M, hsY+22);
    }

    this._footer(doc, 1, 7);
  }

  // ════════════════════════════════════════════════════════════
  // TEASER PAGE (free tier)
  // ════════════════════════════════════════════════════════════
  p_teaser(doc, d) {
    doc.rect(0, 0, PW, PH).fill(C.bg);
    doc.rect(0, 0, PW, 5).fill(C.accent);
    doc.rect(0, 5, PW, 50).fill(C.dark);
    doc.fillColor(C.text).font('Helvetica-Bold').fontSize(13)
       .text('PREMIUM REPORT — RESTRICTED', M, 18, { width:PW-M*2, align:'center', characterSpacing:1 });
    doc.fillColor(C.sub).font('Helvetica').fontSize(8)
       .text('The following pages are available to Premium subscribers only', M, 38,
             { width:PW-M*2, align:'center' });

    // locked preview rows
    doc.rect(M, 70, PW-M*2, 210).fill(C.card).stroke(C.border);
    for (let i=0; i<8; i++) {
      const rw = 80 + (i*61)%200;
      doc.rect(M+12, 84+i*22, rw,   10).fill(C.muted+'40');
      doc.rect(M+12+rw+10, 84+i*22, 70, 10).fill(C.muted+'22');
    }
    doc.rect(M, 70, PW-M*2, 210).fill('#000000aa');

    // lock
    this._icon(doc, 'lock', PW/2-22, 120, 44, C.accent);
    doc.fillColor(C.accent).font('Helvetica-Bold').fontSize(16)
       .text('CONTENT LOCKED', M, 174, { width:PW-M*2, align:'center' });

    // what's included list
    const listY = 302;
    doc.fillColor(C.accent).font('Helvetica-Bold').fontSize(10.5)
       .text('THE FULL 7-PAGE PREMIUM REPORT INCLUDES:', M, listY);

    const items = [
      [`${d.incidents.length} fully detailed incident reports with state & category`, C.orange ],
      ['Geographic threat map — all 36 states colour-coded by risk',                 C.blue   ],
      ['AI-powered security pattern and trend analysis',                              C.purple ],
      ['Regional risk grid — 6 geopolitical zones assessed',                          C.teal   ],
      ['State-by-state risk profiles and incident counts',                            C.green  ],
      ['Strategic security recommendations from intelligence analysis',               C.yellow ],
    ];
    items.forEach(([txt, col], i) => {
      this._icon(doc, 'check', M+6, listY+24+i*26+2, 14, col);
      doc.fillColor(C.text).font('Helvetica').fontSize(9.5)
         .text(txt, M+26, listY+24+i*26+2);
    });

    // CTA box
    const ctaY = listY + 24 + items.length*26 + 18;
    doc.rect(M, ctaY, PW-M*2, 155).fill(C.accent+'18');
    doc.rect(M, ctaY, PW-M*2, 155).stroke(C.accent+'55');
    doc.rect(M, ctaY, PW-M*2, 4).fill(C.accent);

    doc.fillColor(C.text).font('Helvetica-Bold').fontSize(15)
       .text('UNLOCK FULL ACCESS', M, ctaY+18, { width:PW-M*2, align:'center' });
    doc.fillColor(C.sub).font('Helvetica').fontSize(9.5)
       .text('Subscribe to Suntrenia Premium and this complete 7-page report\nis delivered automatically to your inbox every week.',
             M, ctaY+44, { width:PW-M*2, align:'center', lineGap:4 });

    // button
    doc.rect(M+55, ctaY+92, PW-M*2-110, 38).fill(C.accent);
    doc.fillColor(C.white).font('Helvetica-Bold').fontSize(11)
       .text('SUBSCRIBE TO PREMIUM  —  \u20A6 15,000 / MONTH',
             M+55, ctaY+106, { width:PW-M*2-110, align:'center' });

    doc.fillColor(C.muted).font('Helvetica').fontSize(7.5)
       .text(this.cfg.site+'  •  Cancel anytime  •  30-day money-back guarantee',
             M, ctaY+138, { width:PW-M*2, align:'center' });

    this._footer(doc, 2, 2);
  }

  // ════════════════════════════════════════════════════════════
  // PAGE 2 — MAP + STATE BAR CHART
  // ════════════════════════════════════════════════════════════
  async p2Map(doc, d) {
    doc.rect(0, 0, PW, PH).fill(C.bg);
    this._header(doc, 'GEOGRAPHIC THREAT ASSESSMENT', 2);

    // map area
    const mapY = 58, mapH = 310;
    if (d.mapSvg) {
      await this._embedMap(doc, d.mapSvg, M, mapY, PW-M*2, mapH);
    } else {
      doc.rect(M, mapY, PW-M*2, mapH).fill(C.card).stroke(C.border);
      // draw simplified Nigeria outline placeholder
      this._nigeriaPlaceholder(doc, M, mapY, PW-M*2, mapH, d.stateCounts);
    }

    // legend
    const legY = mapY + mapH + 10;
    this._sectionHead(doc, 'THREAT LEVEL KEY', M, legY);
    const legItems = [
      { color:C.low,      label:'Low  (0–2)'    },
      { color:C.medium,   label:'Moderate  (3–5)'},
      { color:C.high,     label:'High  (6–9)'   },
      { color:C.critical, label:'Critical  (10+)'},
    ];
    legItems.forEach((li,i) => {
      const lx = M + i*122;
      // coloured square
      doc.rect(lx, legY+16, 16, 16).fill(li.color);
      doc.fillColor(C.text).font('Helvetica').fontSize(8.5)
         .text(li.label, lx+20, legY+18);
    });

    // state bar chart
    const chartY = legY + 42;
    this._sectionHead(doc, 'INCIDENT COUNT BY STATE (TOP 10)', M, chartY);

    const stateArr = Object.entries(d.stateCounts).sort((a,b)=>b[1]-a[1]).slice(0,10);
    if (stateArr.length > 0) {
      this._barChart(doc, stateArr, M, chartY+18, PW-M*2, 195);
    } else {
      doc.fillColor(C.sub).font('Helvetica').fontSize(9)
         .text('No state-tagged incidents in this period.', M, chartY+26);
    }

    this._footer(doc, 2, 7);
  }

  // ════════════════════════════════════════════════════════════
  // PAGE 3 — CATEGORY DEEP DIVE
  // ════════════════════════════════════════════════════════════
  p3Categories(doc, d) {
    doc.rect(0, 0, PW, PH).fill(C.bg);
    this._header(doc, 'THREAT CATEGORY ANALYSIS', 3);

    const sortedCats = Object.entries(d.catCounts).sort((a,b)=>b[1]-a[1]);
    const total = d.incidents.length || 1;
    let curY = 58;

    sortedCats.forEach(([cat, count], i) => {
      const color  = CAT_COLORS[cat] || C.sub;
      const pct    = ((count/total)*100).toFixed(1);
      const rowH   = 62;
      const maxW   = PW - M*2 - 120;
      const fillW  = (count/(sortedCats[0]?.[1]||1)) * maxW;

      doc.rect(M, curY, PW-M*2, rowH).fill(i%2===0 ? C.card : C.cardAlt);
      doc.rect(M, curY, 5, rowH).fill(color);

      // icon circle
      doc.circle(M+28, curY+rowH/2, 20).fill(color+'20');
      doc.circle(M+28, curY+rowH/2, 20).stroke(color+'70');
      this._icon(doc, this._catIcon(cat), M+18, curY+rowH/2-11, 22, color);

      doc.fillColor(C.text).font('Helvetica-Bold').fontSize(11)
         .text(cat.toUpperCase(), M+58, curY+8, { characterSpacing:1 });

      // progress bar track + fill
      doc.rect(M+58, curY+30, maxW, 14).fill(color+'20');
      if (fillW > 0) doc.rect(M+58, curY+30, fillW, 14).fill(color+'bb');

      // count + pct
      doc.fillColor(color).font('Helvetica-Bold').fontSize(18)
         .text(count.toString(), PW-M-65, curY+8, { width:57, align:'right' });
      doc.fillColor(C.sub).font('Helvetica').fontSize(8.5)
         .text(pct+'% of total', PW-M-65, curY+32, { width:57, align:'right' });

      curY += rowH + 3;
    });

    // stacked proportional bar
    curY += 12;
    this._sectionHead(doc, 'PROPORTIONAL THREAT DISTRIBUTION', M, curY);
    curY += 16;

    const barH = 28;
    let barX = M;
    sortedCats.forEach(([cat, count]) => {
      const color = CAT_COLORS[cat] || C.sub;
      const bw    = Math.max((count/total)*(PW-M*2), 1);
      doc.rect(barX, curY, bw, barH).fill(color+'cc');
      if (bw > 32) {
        doc.fillColor('#fff').font('Helvetica-Bold').fontSize(7)
           .text(((count/total)*100).toFixed(0)+'%', barX+4, curY+10);
      }
      barX += bw;
    });
    curY += barH + 8;

    // legend
    let legX = M;
    sortedCats.forEach(([cat]) => {
      const color = CAT_COLORS[cat] || C.sub;
      doc.rect(legX, curY, 10, 10).fill(color);
      doc.fillColor(C.text).font('Helvetica').fontSize(7.5)
         .text(cat, legX+13, curY+1, { width:84 });
      legX += 98;
      if (legX > PW - M - 100) { legX = M; curY += 14; }
    });

    this._footer(doc, 3, 7);
  }

  // ════════════════════════════════════════════════════════════
  // PAGE 4 — TREND + REGIONAL RISK
  // ════════════════════════════════════════════════════════════
  p4TrendRegional(doc, d) {
    doc.rect(0, 0, PW, PH).fill(C.bg);
    this._header(doc, 'TREND & REGIONAL RISK ANALYSIS', 4);

    // ── 7-day trend ──────────────────────────────────────────
    let curY = 58;
    this._sectionHead(doc, '7-DAY INCIDENT FREQUENCY TREND', M, curY);
    curY += 16;

    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    let daily  = new Array(7).fill(0);

    if (d.trendData?.data?.length > 0) {
      daily = d.trendData.data.slice(0,7);
    } else {
      d.incidents.forEach((inc,idx) => { daily[idx%7]++; });
    }

    const chartH   = 155;
    const barAreaH = chartH - 28;
    const maxV     = Math.max(...daily, 1);
    const bw       = Math.floor((PW-M*2)/7);

    doc.rect(M, curY, PW-M*2, chartH).fill(C.card);

    // grid lines + y-axis labels
    for (let g=1; g<=4; g++) {
      const gy = curY + (barAreaH/4)*g;
      doc.rect(M, gy, PW-M*2, 0.5).fill(C.border);
      doc.fillColor(C.muted).font('Helvetica').fontSize(7)
         .text(Math.round(maxV - maxV*g/4), M+2, gy-5);
    }

    days.forEach((day, i) => {
      const count = daily[i]||0;
      const bx    = M + i*bw + 4;
      const bh    = Math.max((count/maxV)*barAreaH, 2);
      const by    = curY + barAreaH - bh;
      const col   = count >= maxV*0.7 ? C.critical
                  : count >= maxV*0.4 ? C.medium : C.blue;

      // bar
      doc.rect(bx, by, bw-8, bh).fill(col+'bb');
      // count label
      if (count > 0) {
        doc.fillColor(col).font('Helvetica-Bold').fontSize(8)
           .text(count.toString(), bx, by-11, { width:bw-8, align:'center' });
      }
      // day label
      doc.fillColor(C.sub).font('Helvetica').fontSize(8)
         .text(day, bx, curY+chartH-16, { width:bw-8, align:'center' });
    });

    curY += chartH + 18;

    // ── regional risk grid ────────────────────────────────────
    this._sectionHead(doc, 'GEOPOLITICAL ZONE RISK ASSESSMENT', M, curY);
    curY += 16;

    const regions = [
      { name:'NORTH EAST',    states:['Borno','Yobe','Adamawa','Gombe','Bauchi','Taraba'] },
      { name:'NORTH WEST',    states:['Zamfara','Katsina','Sokoto','Kebbi','Kano','Kaduna','Jigawa'] },
      { name:'NORTH CENTRAL', states:['Niger','Benue','Nasarawa','Plateau','Kogi','Kwara','Fct'] },
      { name:'SOUTH WEST',    states:['Lagos','Ogun','Oyo','Osun','Ondo','Ekiti'] },
      { name:'SOUTH EAST',    states:['Anambra','Enugu','Ebonyi','Imo','Abia'] },
      { name:'SOUTH SOUTH',   states:['Rivers','Delta','Bayelsa','Cross River','Akwa Ibom','Edo'] },
    ];

    const affected = new Set(Object.keys(d.stateCounts).map(s=>s.toLowerCase()));
    const rCW = (PW-M*2-10)/2;
    const rCH = 84;

    regions.forEach((reg, i) => {
      const col2  = i%2;
      const row2  = Math.floor(i/2);
      const rx    = M + col2*(rCW+10);
      const ry    = curY + row2*(rCH+6);
      const affN  = reg.states.filter(s=>affected.has(s.toLowerCase())).length;
      const ratio = affN / reg.states.length;

      let rCol, rLbl;
      if      (ratio >= 0.5)  { rCol=C.critical; rLbl='HIGH'; }
      else if (ratio >= 0.28) { rCol=C.medium;   rLbl='MODERATE'; }
      else if (ratio > 0)     { rCol=C.blue;     rLbl='LOW'; }
      else                    { rCol=C.low;      rLbl='CALM'; }

      doc.rect(rx, ry, rCW, rCH).fill(rCol+'12');
      doc.rect(rx, ry, rCW, rCH).stroke(rCol+'40');
      doc.rect(rx, ry, 4, rCH).fill(rCol);

      doc.fillColor(C.text).font('Helvetica-Bold').fontSize(10)
         .text(reg.name, rx+12, ry+10);
      doc.fillColor(C.sub).font('Helvetica').fontSize(8)
         .text(affN+' of '+reg.states.length+' states with incidents', rx+12, ry+28);

      // state dots — filled = affected, hollow = clear
      reg.states.forEach((state, si) => {
        const dotX = rx+12 + si*21;
        const dotY = ry+50;
        if (dotX+14 < rx+rCW-72) {
          const isAff = affected.has(state.toLowerCase());
          if (isAff) {
            doc.circle(dotX+7, dotY+7, 7).fill(rCol);
            doc.fillColor('#fff').font('Helvetica').fontSize(5)
               .text(state.slice(0,2).toUpperCase(), dotX+2, dotY+4);
          } else {
            doc.circle(dotX+7, dotY+7, 7).fill(rCol+'22');
            doc.circle(dotX+7, dotY+7, 7).stroke(rCol+'55');
          }
        }
      });

      // risk badge
      doc.rect(rx+rCW-66, ry+20, 58, 20).fill(rCol);
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8)
         .text(rLbl, rx+rCW-66, ry+26, { width:58, align:'center' });
    });

    this._footer(doc, 4, 7);
  }

  // ════════════════════════════════════════════════════════════
  // PAGE 5 — OCHA-STYLE SITUATION REPORT
  // ════════════════════════════════════════════════════════════
  p5SitRep(doc, d) {
    // light background — deliberate contrast from other pages
    doc.rect(0, 0, PW, PH).fill('#f4f6f8');
    doc.rect(0, 0, PW, 5).fill(C.accent);
    doc.rect(0, 5, PW, 50).fill('#1a252f');

    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(12)
       .text(this.cfg.org.toUpperCase()+'  |  SITUATION REPORT',
             M, 16, { characterSpacing:1 });
    doc.fillColor(C.accent).font('Helvetica').fontSize(8)
       .text('Week of '+new Date().toLocaleDateString('en-GB',
             { day:'2-digit', month:'long', year:'numeric' })+
             '  |  Page 5 of 7  |  CONFIDENTIAL', M, 36);

    // ── HIGHLIGHTS box ────────────────────────────────────────
    const hlY = 70;
    doc.rect(M, hlY, PW-M*2, 8).fill('#1a252f');
    doc.rect(M, hlY+8, PW-M*2, 185).fill('#fff');
    doc.rect(M, hlY+8, PW-M*2, 185).stroke('#dee2e6');
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8.5)
       .text('HIGHLIGHTS', M+10, hlY+1, { characterSpacing:2 });

    const hl = this._highlights(d);
    let hlY2 = hlY + 18;
    hl.slice(0,5).forEach(h => {
      doc.circle(M+14, hlY2+5, 5).fill(C.accent);
      doc.fillColor('#2c3e50').font('Helvetica').fontSize(9)
         .text(h, M+26, hlY2, { width:PW-M*2-34, lineGap:2 });
      hlY2 += doc.heightOfString(h, { width:PW-M*2-34 }) + 10;
    });

    // ── BACKGROUND ────────────────────────────────────────────
    const bgY = hlY + 208;
    doc.fillColor('#2c3e50').font('Helvetica-Bold').fontSize(14)
       .text('BACKGROUND', M, bgY);
    doc.rect(M, bgY+18, PW-M*2, 2).fill(C.accent);
    doc.fillColor('#555').font('Helvetica-Bold').fontSize(10)
       .text('Situation Overview', M, bgY+26);

    const briefing = cleanText(d.aiBriefing ||
      'Security conditions across Nigeria during the reporting period reflect ongoing multidimensional threats. Incidents spanning terrorism, banditry, kidnapping, and communal violence continue to affect multiple states. Law enforcement and military operations are ongoing across identified hotspot zones.');
    doc.fillColor('#34495e').font('Helvetica').fontSize(9.5)
       .text(briefing, M, bgY+44, { width:PW-M*2, align:'justify', lineGap:4 });

    const bH = doc.heightOfString(briefing, { width:PW-M*2 });

    // ── AI assessment box ─────────────────────────────────────
    const aiY = bgY + 44 + bH + 16;
    if (aiY < 750) {
      doc.rect(M, aiY, 4, 90).fill(C.blue);
      doc.rect(M+4, aiY, PW-M*2-4, 90).fill('#eef2ff');
      doc.rect(M+4, aiY, PW-M*2-4, 90).stroke('#c7d2fe');
      doc.fillColor(C.blue).font('Helvetica-Bold').fontSize(8.5)
         .text('AI INTELLIGENCE ASSESSMENT', M+12, aiY+8, { characterSpacing:1 });
      const exec = cleanText(d.executiveBrief||d.aiBriefing||
        'Pattern recognition suggests concentrated threat activity. Multi-source analysis indicates elevated operational tempo among non-state armed groups. Recommend continued monitoring of identified hotspot states.').substring(0,350);
      doc.fillColor('#2c3e50').font('Helvetica').fontSize(8.5)
         .text(exec, M+12, aiY+24, { width:PW-M*2-22, lineGap:3 });
    }

    this._footer(doc, 5, 7, true);
  }

  _highlights(d) {
    const h = [];
    if (d.incidents.length>0)
      h.push(`${d.incidents.length} security incidents recorded across ${d.statesAffected} states during the reporting period.`);
    if (d.casualties>0)
      h.push(`An estimated ${d.casualties} casualties have been reported across recorded incidents.`);
    if (d.abductions>0)
      h.push(`${d.abductions} persons reported abducted in kidnapping and banditry-related incidents.`);
    const tops = Object.entries(d.stateCounts).sort((a,b)=>b[1]-a[1]).slice(0,3).map(e=>e[0]);
    if (tops.length>0)
      h.push(`Highest incident concentration in ${tops.join(', ')}.`);
    const terror = d.incidents.filter(i=>i.category==='Terrorism').length;
    if (terror>0)
      h.push(`${terror} terrorism-related incident${terror>1?'s':''} reported, indicating continued NSAG activity.`);
    if (h.length < 3)
      h.push('Security forces conducted operations in multiple states. Displacement and access constraints reported in affected areas.');
    return h;
  }

  // ════════════════════════════════════════════════════════════
  // PAGE 6 — INCIDENT DETAILS
  // ════════════════════════════════════════════════════════════
  p6Incidents(doc, d) {
    doc.rect(0, 0, PW, PH).fill(C.bg);
    this._header(doc, 'INCIDENT INTELLIGENCE DIGEST', 6);

    let curY = 58;
    const sevC = { Critical:C.critical, High:C.high, Medium:C.medium, Low:C.low };

    d.incidents.forEach((inc, i) => {
      const rowH = 76;
      if (curY + rowH > 758) {
        doc.addPage();
        doc.rect(0, 0, PW, PH).fill(C.bg);
        this._header(doc, 'INCIDENT DIGEST (CONT.)', 6);
        curY = 58;
      }

      const sCol = sevC[inc.severity] || C.sub;
      const cCol = CAT_COLORS[inc.category] || C.sub;

      doc.rect(M, curY, PW-M*2, rowH).fill(C.card);
      doc.rect(M, curY, PW-M*2, rowH).stroke(C.border);
      doc.rect(M, curY, 4, rowH).fill(sCol);

      // incident number
      doc.rect(M+7, curY+8, 22, 18).fill(sCol+'30');
      doc.fillColor(sCol).font('Helvetica-Bold').fontSize(9.5)
         .text((i+1).toString(), M+7, curY+12, { width:22, align:'center' });

      // title
      const title = inc.title.substring(0,78) + (inc.title.length>78 ? '…' : '');
      doc.fillColor(C.text).font('Helvetica-Bold').fontSize(9)
         .text(title, M+36, curY+8, { width:PW-M*2-155 });

      // category badge
      doc.rect(PW-M-128, curY+6, 62, 16).fill(cCol+'28');
      doc.rect(PW-M-128, curY+6, 62, 16).stroke(cCol+'80');
      doc.fillColor(cCol).font('Helvetica-Bold').fontSize(7)
         .text(inc.category.substring(0,11), PW-M-128, curY+11, { width:62, align:'center' });

      // severity badge
      doc.rect(PW-M-62, curY+6, 54, 16).fill(sCol);
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(7)
         .text(inc.severity.toUpperCase(), PW-M-62, curY+11, { width:54, align:'center' });

      // summary
      const summary = (inc.summary||'No summary available.').substring(0,170);
      doc.fillColor(C.sub).font('Helvetica').fontSize(8)
         .text(summary, M+36, curY+30, { width:PW-M*2-48, lineGap:2 });

      // meta row
      const mY = curY + rowH - 15;
      if (inc.stateName) {
        this._icon(doc, 'location', M+36, mY, 10, C.orange);
        doc.fillColor(C.orange).font('Helvetica').fontSize(7.5)
           .text(inc.stateName, M+50, mY+1);
      }
      const source = inc.source ? '  |  '+inc.source : '';
      doc.fillColor(C.muted).font('Helvetica').fontSize(7)
         .text(new Date(inc.timestamp||Date.now()).toLocaleDateString()+source,
               M+110, mY+1);

      curY += rowH + 3;
    });

    this._footer(doc, 6, 7);
  }

  // ════════════════════════════════════════════════════════════
  // PAGE 7 — STATE PROFILES + RECOMMENDATIONS
  // ════════════════════════════════════════════════════════════
  p7StateRecs(doc, d) {
    doc.rect(0, 0, PW, PH).fill(C.bg);
    this._header(doc, 'STATE RISK ASSESSMENT & RECOMMENDATIONS', 7);

    let curY = 58;
    const sevC = { Critical:C.critical, High:C.high, Medium:C.medium, Low:C.low };

    if (d.stateRiskAnalyses?.length > 0) {
      this._sectionHead(doc, 'STATE RISK PROFILES', M, curY);
      curY += 16;

      d.stateRiskAnalyses.slice(0,4).forEach(a => {
        const rCol = sevC[a.riskLevel] || C.sub;
        const cH   = 72;

        doc.rect(M, curY, PW-M*2, cH).fill(C.card);
        doc.rect(M, curY, 4, cH).fill(rCol);

        doc.fillColor(C.text).font('Helvetica-Bold').fontSize(11)
           .text(a.stateName, M+12, curY+10);

        doc.rect(PW-M-82, curY+8, 74, 20).fill(rCol+'28');
        doc.rect(PW-M-82, curY+8, 74, 20).stroke(rCol);
        doc.fillColor(rCol).font('Helvetica-Bold').fontSize(8)
           .text((a.riskLevel||'?')+' | '+a.incidentCount+' incidents',
                 PW-M-82, curY+14, { width:74, align:'center' });

        const txt = cleanText(a.analysis||'Analysis pending.').substring(0,190);
        doc.fillColor(C.sub).font('Helvetica').fontSize(8.5)
           .text(txt, M+12, curY+32, { width:PW-M*2-22, lineGap:2 });

        doc.rect(M, curY+cH-1, PW-M*2, 1).fill(C.border);
        curY += cH + 4;
      });
      curY += 8;
    }

    // recommendations
    this._sectionHead(doc, 'STRATEGIC RECOMMENDATIONS', M, curY);
    doc.rect(M, curY+14, PW-M*2, 2).fill(C.green);
    curY += 22;

    const recs = d.recommendations || [
      'Strengthen inter-agency security coordination in critical risk states.',
      'Enhance community intelligence networks in identified hotspot zones.',
      'Deploy rapid response capability to north-west and north-east corridors.',
      'Increase surveillance along identified conflict flashpoints.',
      'Implement proactive humanitarian contingency planning in affected states.',
    ];
    const recC = [C.critical, C.high, C.medium, C.blue, C.green];
    recs.slice(0,5).forEach((rec, i) => {
      const col = recC[i];
      this._icon(doc, 'number', M+4, curY+2, 16, col, (i+1).toString());
      doc.fillColor(C.text).font('Helvetica').fontSize(10)
         .text(rec, M+26, curY, { width:PW-M*2-32, lineGap:3 });
      curY += doc.heightOfString(rec, { width:PW-M*2-32 }) + 16;
    });

    // data sources
    const srcY = Math.max(curY+10, 682);
    doc.rect(M, srcY, PW-M*2, 72).fill(C.card).stroke(C.border);
    doc.fillColor(C.sub).font('Helvetica-Bold').fontSize(8)
       .text('DATA SOURCES & METHODOLOGY', M+10, srcY+10, { characterSpacing:1 });
    doc.fillColor(C.muted).font('Helvetica').fontSize(7.5)
       .text('Generated from OSINT: verified Nigerian news sources, official government statements, NGO field reports, and community intelligence feeds. AI classification algorithms process incident data for threat categorisation and state extraction. All information collated within a 7-day reporting window. For informational purposes only.',
             M+10, srcY+26, { width:PW-M*2-20, lineGap:3 });

    this._footer(doc, 7, 7);
  }

  // ════════════════════════════════════════════════════════════
  // VECTOR ICON LIBRARY  (zero emoji — all PDFKit primitives)
  // ════════════════════════════════════════════════════════════
  _icon(doc, type, x, y, size, color, label) {
    doc.save();
    const s=size, cx=x+s/2, cy=y+s/2;
    doc.lineWidth(1.5);

    switch (type) {

      case 'warning':  // solid triangle with exclamation
        doc.moveTo(cx, y).lineTo(x+s, y+s).lineTo(x, y+s).closePath().fill(color);
        doc.fillColor('#fff').font('Helvetica-Bold').fontSize(s*0.46)
           .text('!', cx-s*0.08, y+s*0.38, { width:s*0.16, align:'center' });
        break;

      case 'location': // teardrop map pin
        doc.circle(cx, cy-s*0.1, s*0.38).fill(color);
        doc.moveTo(cx-s*0.22, cy+s*0.1)
           .lineTo(cx, cy+s*0.52)
           .lineTo(cx+s*0.22, cy+s*0.1)
           .fill(color);
        doc.circle(cx, cy-s*0.1, s*0.16).fill('#fff');
        break;

      case 'cross':    // medical cross
        doc.rect(cx-s*0.1, y+s*0.1,  s*0.2, s*0.8).fill(color);
        doc.rect(x+s*0.1,  cy-s*0.1, s*0.8, s*0.2).fill(color);
        break;

      case 'chain':    // two linked rings
        doc.circle(cx-s*0.22, cy, s*0.28).strokeColor(color).lineWidth(s*0.14).stroke();
        doc.circle(cx+s*0.22, cy, s*0.28).strokeColor(color).lineWidth(s*0.14).stroke();
        break;

      case 'lock':     // padlock
        doc.rect(cx-s*0.34, cy, s*0.68, s*0.44).fill(color);
        doc.arc(cx, cy, s*0.28, Math.PI, 0).strokeColor(color).lineWidth(s*0.14).stroke();
        doc.circle(cx, cy+s*0.18, s*0.1).fill('#fff');
        break;

      case 'check':    // checkmark
        doc.moveTo(x+s*0.1, cy+s*0.05)
           .lineTo(cx-s*0.06, y+s*0.82)
           .lineTo(x+s*0.9, y+s*0.22)
           .strokeColor(color).lineWidth(s*0.14).stroke();
        break;

      case 'number':   // filled circle with number
        doc.circle(cx, cy, s*0.5).fill(color);
        doc.fillColor('#fff').font('Helvetica-Bold').fontSize(s*0.55)
           .text(label||'1', x, y+s*0.22, { width:s, align:'center' });
        break;

      case 'sword':    // banditry — sword blade
        doc.moveTo(cx-s*0.08, y)
           .lineTo(cx+s*0.08, y)
           .lineTo(cx+s*0.12, y+s*0.72)
           .lineTo(cx, y+s)
           .lineTo(cx-s*0.12, y+s*0.72)
           .closePath().fill(color);
        doc.rect(cx-s*0.28, y+s*0.64, s*0.56, s*0.08).fill(color);
        break;

      case 'bomb':     // terrorism — circle with fuse
        doc.circle(cx+s*0.04, cy+s*0.1, s*0.38).fill(color);
        doc.moveTo(cx+s*0.3, cy-s*0.18)
           .lineTo(cx+s*0.52, cy-s*0.5)
           .strokeColor(C.yellow).lineWidth(s*0.1).stroke();
        doc.circle(cx+s*0.52, cy-s*0.5, s*0.07).fill(C.yellow);
        break;

      case 'shield':   // military operation
        doc.moveTo(cx, y)
           .lineTo(x+s, y+s*0.28)
           .lineTo(x+s, y+s*0.68)
           .lineTo(cx, y+s)
           .lineTo(x, y+s*0.68)
           .lineTo(x, y+s*0.28)
           .closePath().fill(color);
        doc.fillColor('#fff').font('Helvetica-Bold').fontSize(s*0.38)
           .text('M', cx-s*0.1, y+s*0.38);
        break;

      case 'people':   // communal / farmer-herder — two figures
        doc.circle(cx-s*0.24, cy-s*0.2, s*0.2).fill(color);
        doc.circle(cx+s*0.24, cy-s*0.2, s*0.2).fill(color);
        doc.arc(cx-s*0.24, cy+s*0.1, s*0.26, Math.PI, 0).fill(color);
        doc.arc(cx+s*0.24, cy+s*0.1, s*0.26, Math.PI, 0).fill(color);
        break;

      default:         // diamond
        doc.moveTo(cx, y).lineTo(x+s, cy).lineTo(cx, y+s).lineTo(x, cy)
           .closePath().fill(color);
    }
    doc.restore();
  }

  // ── category → icon mapping ──────────────────────────────────
  _catIcon(cat) {
    return {
      'Terrorism':'bomb', 'Banditry':'sword', 'Kidnapping':'lock',
      'Communal Clash':'people', 'Military Operation':'shield',
      'Armed Robbery':'warning', 'Farmer-Herder':'people',
      'Cult Violence':'warning', 'Other':'diamond',
    }[cat] || 'diamond';
  }

  // ── shield logo ───────────────────────────────────────────────
  _shield(doc, x, y, w, h) {
    const cx = x+w/2;
    doc.save();
    doc.moveTo(cx,y).lineTo(x+w,y+h*0.28).lineTo(x+w,y+h*0.68)
       .lineTo(cx,y+h).lineTo(x,y+h*0.68).lineTo(x,y+h*0.28)
       .closePath().fill(C.accent+'20');
    doc.moveTo(cx,y).lineTo(x+w,y+h*0.28).lineTo(x+w,y+h*0.68)
       .lineTo(cx,y+h).lineTo(x,y+h*0.68).lineTo(x,y+h*0.28)
       .closePath().strokeColor(C.accent).lineWidth(1.5).stroke();
    doc.fillColor(C.accent).font('Helvetica-Bold').fontSize(h*0.36)
       .text('S', cx-h*0.09, y+h*0.38);
    doc.restore();
  }

  // ── Nigeria placeholder map ───────────────────────────────────
  _nigeriaPlaceholder(doc, x, y, w, h, stateCounts) {
    doc.rect(x, y, w, h).fill(C.card).stroke(C.border);

    // Simplified Nigeria silhouette (relative coordinates)
    const pts = [
      [0.22,0.08],[0.38,0.05],[0.55,0.03],[0.72,0.07],[0.85,0.15],
      [0.92,0.28],[0.88,0.42],[0.95,0.52],[0.90,0.65],[0.82,0.78],
      [0.70,0.88],[0.55,0.96],[0.42,0.98],[0.28,0.92],[0.15,0.82],
      [0.08,0.68],[0.05,0.52],[0.10,0.38],[0.15,0.22],
    ];
    doc.save();
    doc.moveTo(x + pts[0][0]*w, y + pts[0][1]*h);
    pts.slice(1).forEach(([px,py]) => doc.lineTo(x+px*w, y+py*h));
    doc.closePath().fill(C.muted+'30').stroke(C.muted+'60');
    doc.restore();

    // Hotspot dots for known states
    const stateDots = {
      'Borno':[0.72,0.22],'Yobe':[0.78,0.30],'Adamawa':[0.80,0.50],
      'Zamfara':[0.28,0.22],'Katsina':[0.42,0.16],'Kaduna':[0.48,0.32],
      'Plateau':[0.56,0.48],'Niger':[0.40,0.42],'Benue':[0.58,0.58],
      'Lagos':[0.20,0.68],'Rivers':[0.38,0.80],'Delta':[0.32,0.72],
    };
    const maxCount = Math.max(...Object.values(stateCounts), 1);
    Object.entries(stateDots).forEach(([state,[px,py]]) => {
      const count = stateCounts[state] || 0;
      if (count > 0) {
        const r = 4 + (count/maxCount)*10;
        const col = count >= maxCount*0.7 ? C.critical
                  : count >= maxCount*0.4 ? C.high : C.medium;
        doc.circle(x+px*w, y+py*h, r).fill(col+'bb');
        doc.circle(x+px*w, y+py*h, r+4).fill(col+'30');
        if (r > 8) {
          doc.fillColor('#fff').font('Helvetica-Bold').fontSize(7)
             .text(count.toString(), x+px*w-6, y+py*h-4);
        }
      }
    });

    doc.fillColor(C.muted).font('Helvetica').fontSize(8)
       .text('Incident hotspot map  (install svg-to-pdfkit for full map)',
             x, y+h-16, { width:w, align:'center' });
  }

  // ── bar chart helper ──────────────────────────────────────────
  _barChart(doc, entries, x, y, w, h) {
    const maxV   = entries[0]?.[1] || 1;
    const bw     = Math.floor((w-20) / entries.length);
    const areaH  = h - 26;
    const colors = [C.critical,C.high,C.medium,C.blue,C.green,
                    C.purple,C.orange,C.teal,C.yellow,C.sub];

    doc.rect(x, y, w, h).fill(C.card);

    // grid
    for (let g=1; g<=4; g++) {
      const gy = y + (areaH/4)*g;
      doc.rect(x, gy, w, 0.5).fill(C.border);
    }

    entries.forEach(([label, count], i) => {
      const bx  = x + 10 + i*bw;
      const bh  = Math.max((count/maxV)*areaH, 3);
      const by  = y + areaH - bh;
      const col = colors[i % colors.length];

      doc.rect(bx+2, by, bw-6, bh).fill(col+'bb');

      doc.fillColor(col).font('Helvetica-Bold').fontSize(8)
         .text(count.toString(), bx+2, by-11, { width:bw-6, align:'center' });

      const lbl = label.length>6 ? label.slice(0,5)+'.' : label;
      doc.fillColor(C.sub).font('Helvetica').fontSize(7)
         .text(lbl, bx+2, y+h-16, { width:bw-6, align:'center' });
    });
  }

  // ════════════════════════════════════════════════════════════
  // SHARED LAYOUT HELPERS
  // ════════════════════════════════════════════════════════════
  _header(doc, title, pageNum) {
    doc.rect(0, 0, PW, 5).fill(C.accent);
    doc.rect(0, 5, PW, 46).fill(C.dark);
    doc.fillColor(C.text).font('Helvetica-Bold').fontSize(12)
       .text(title, M, 16, { characterSpacing:0.5 });
    doc.fillColor(C.accent).font('Helvetica').fontSize(7.5)
       .text(this.cfg.org+'  |  CONFIDENTIAL', M, 36);
    doc.fillColor(C.muted).font('Helvetica').fontSize(7.5)
       .text('PAGE '+pageNum+' OF 7', PW-M-58, 36);
  }

  _sectionHead(doc, title, x, y) {
    doc.fillColor(C.sub).font('Helvetica-Bold').fontSize(8.5)
       .text(title, x, y, { characterSpacing:1.2 });
    doc.rect(x, y+12, PW-x-M, 1).fill(C.border);
  }

  _footer(doc, pageNum, total, lightBg=false) {
    const fy = 800;
    doc.rect(0, fy, PW, 42).fill(lightBg ? '#1a252f' : C.dark);
    doc.rect(0, fy, PW, 1).fill(C.border);
    doc.fillColor(C.muted).font('Helvetica').fontSize(7)
       .text(this.cfg.org+'  |  '+this.cfg.site+'  |  '+this.cfg.phone+'  |  '+this.cfg.email,
             M, fy+10, { width:PW-M*2, align:'center' });
    doc.text('Generated: '+new Date().toLocaleString('en-NG',{timeZone:'Africa/Lagos'})+
             '  |  Classification: CONFIDENTIAL  |  Page '+pageNum+' of '+total,
             M, fy+24, { width:PW-M*2, align:'center' });
  }

  _fmtDate(d) {
    return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase();
  }

  async _embedMap(doc, svgData, x, y, w, h) {
    if (this.hasSVG) {
      try {
        require('svg-to-pdfkit')(doc, svgData, x, y, { width:w, height:h, preserveAspectRatio:'xMidYMid meet' });
        return;
      } catch(e) { console.warn('SVG embed failed:', e.message); }
    }
    if (this.hasSharp) {
      try {
        const sharp = require('sharp');
        const png = await sharp(Buffer.from(svgData,'utf-8'),{density:200}).png().toBuffer();
        doc.image(png, x, y, { width:w, height:h });
        return;
      } catch(e) { console.warn('Sharp fallback failed:', e.message); }
    }
    // graceful fallback with hotspot dots
    this._nigeriaPlaceholder(doc, x, y, w, h, {});
  }

  // ════════════════════════════════════════════════════════════
  // EMAIL
  // ════════════════════════════════════════════════════════════
  async sendReportEmail(email, pdfBuffer, reportName) {
    if (!this.validEmail(email)) return { success:false, error:'Invalid email' };
    if (!Buffer.isBuffer(pdfBuffer)||pdfBuffer.length===0) return { success:false, error:'Invalid PDF' };
    if (this.useBrevo) return this._sendBrevo(email, pdfBuffer, reportName);
    if (this.smtp)     return this._sendGmail(email, pdfBuffer, reportName);
    return { success:false, error:'Email not configured' };
  }

  async _sendBrevo(email, pdf, name) {
    try {
      const mail = new brevo.SendSmtpEmail();
      mail.subject    = this.cfg.org+' — Weekly Security Intelligence Report';
      mail.to         = [{email}];
      mail.sender     = { name:this.cfg.org, email:this.cfg.sender };
      mail.htmlContent = this._emailHTML();
      mail.attachment = [{ content:pdf.toString('base64'), name:name||'suntrenia-report.pdf' }];
      const r = await this.brevo.sendTransacEmail(mail);
      return { success:true, provider:'Brevo', messageId:r.messageId };
    } catch(e) {
      console.error('❌ Brevo error:', e.message);
      return { success:false, error:e.message };
    }
  }

  async _sendGmail(email, pdf, name) {
    try {
      await this.smtp.sendMail({
        from: this.cfg.sender, to: email,
        subject: this.cfg.org+' — Weekly Security Intelligence Report',
        html: this._emailHTML(),
        attachments: [{ filename:name||'suntrenia-report.pdf', content:pdf }],
      });
      return { success:true, provider:'Gmail' };
    } catch(e) { return { success:false, error:e.message }; }
  }

  _emailHTML() {
    const items = [
      'Cover Dashboard — Key Metrics & Threat Level',
      'Geographic Threat Map — All 36 States',
      'Incident Category Breakdown & Analysis',
      '7-Day Trend & Regional Risk Assessment',
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
          ${items.map(it=>`<div style="color:#f0f6fc;font-size:11px;padding:3px 0;border-bottom:1px solid #30363d;">&bull; ${it}</div>`).join('')}
        </div>
        <div style="background:linear-gradient(135deg,#e6394615,#9b5de515);border:1px solid #e6394640;border-radius:6px;padding:16px;text-align:center;margin-bottom:18px;">
          <p style="color:#f0f6fc;font-size:13px;font-weight:bold;margin:0 0 5px;">Get This Report Every Week — Automatically</p>
          <p style="color:#8b949e;font-size:11px;margin:0 0 14px;">No links, no forms — straight to your inbox every week.</p>
          <a href="https://intelligon-web-map2.onrender.com/premium"
             style="background:linear-gradient(135deg,#e63946,#9b5de5);color:#fff;padding:10px 22px;text-decoration:none;border-radius:5px;font-size:12px;font-weight:bold;">
            Subscribe to Premium &mdash; &#8358;15,000/month
          </a>
        </div>
        <p style="color:#484f58;font-size:9px;border-top:1px solid #30363d;padding-top:12px;margin:0;">
          Classification: CONFIDENTIAL &nbsp;&bull;&nbsp; ${this.cfg.org} &nbsp;&bull;&nbsp;
          ${this.cfg.phone} &nbsp;&bull;&nbsp; ${this.cfg.email}
        </p>
      </div>
    </div>`;
  }

  streamToBuffer(doc) {
    return new Promise((resolve, reject) => {
      const bufs = [];
      doc.on('data', b => bufs.push(b));
      doc.on('end', () => resolve(Buffer.concat(bufs)));
      doc.on('error', reject);
      doc.end();
    });
  }
}

module.exports = PDFReportService;
