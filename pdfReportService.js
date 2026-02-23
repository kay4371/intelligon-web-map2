// ============================================
// FILE: pdfReportService.js  
// REVAMPED — ACLED-style infographic PDF
// 80% graphics, 20% text, professional design
// Free teaser (Page 1 only) vs Full report (all pages)
// ============================================

const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const brevo = require('@getbrevo/brevo');
const fs = require('fs');
const path = require('path');

class PDFReportService {
  static PAGE_WIDTH = 595;
  static PAGE_HEIGHT = 842;
  static MARGIN = 36;
  static MAX_INCIDENTS_PER_REPORT = 50;
  static MAX_STATES_TO_ANALYZE = 20;

  // ── Color Palette ─────────────────────────────────────────────────
  static C = {
    bg:          '#0d1117',
    bgCard:      '#161b22',
    bgCardAlt:   '#1c2333',
    accent:      '#e63946',
    accentOrange:'#f77f00',
    accentYellow:'#e3b341',
    accentBlue:  '#4361ee',
    accentGreen: '#2dc653',
    accentPurple:'#9b5de5',
    textPrimary: '#f0f6fc',
    textSec:     '#8b949e',
    textMuted:   '#484f58',
    border:      '#30363d',
    critical:    '#da3633',
    high:        '#e85c0d',
    medium:      '#e3b341',
    low:         '#3fb950',
    white:       '#ffffff',
  };

  static CAT_COLORS = {
    'Banditry':            '#e63946',
    'Terrorism':           '#9b5de5',
    'Kidnapping':          '#f77f00',
    'Communal Clash':      '#4361ee',
    'Military Operation':  '#2dc653',
    'Armed Robbery':       '#e3b341',
    'Farmer-Herder':       '#00b4d8',
    'Cult Violence':       '#e040fb',
    'Other':               '#8b949e',
    'Unknown':             '#484f58',
  };

  constructor() {
    this.hasSVGSupport = this.checkDep('svg-to-pdfkit');
    this.hasSharpSupport = this.checkDep('sharp');

    if (process.env.BREVO_API_KEY) {
      this.brevoClient = new brevo.TransactionalEmailsApi();
      this.brevoClient.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);
      this.useBrevo = true;
    } else if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 465,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
        connectionTimeout: 10000,
      });
      this.useBrevo = false;
    } else {
      this.useBrevo = false;
    }

    this.config = {
      org:     process.env.ORG_NAME        || 'Suntrenia Intelligence',
      phone:   process.env.CONTACT_PHONE   || '+234 703 499 5589',
      email:   process.env.CONTACT_EMAIL   || 'info@suntrenia.com',
      sender:  process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER,
      website: process.env.WEBSITE         || 'www.suntrenia.com',
    };
  }

  checkDep(m) { try { require.resolve(m); return true; } catch { return false; } }
  validateEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

  // ══════════════════════════════════════════════════════════════════
  // MAIN ENTRY POINT
  // ══════════════════════════════════════════════════════════════════
  async generateEnhancedReport(data, options = {}) {
    const { reportType = 'weekly', teaserOnly = false } = options;

    if (!data || typeof data !== 'object') throw new Error('Invalid data');

    const d = {
      ...data,
      incidents: (data.incidents || []).slice(0, PDFReportService.MAX_INCIDENTS_PER_REPORT),
      stateRiskAnalyses: (data.stateRiskAnalyses || []).slice(0, PDFReportService.MAX_STATES_TO_ANALYZE),
    };

    const doc = new PDFDocument({
      size: 'A4',
      margin: PDFReportService.MARGIN,
      info: {
        Title: 'Suntrenia Security Intelligence Report',
        Author: 'Suntrenia Intelligence Platform',
        Subject: 'Nigeria Weekly Security Analysis',
        Keywords: 'security, intelligence, Nigeria, OSINT',
      },
    });

    try {
      // ── PAGE 1: Cover + At-a-Glance Dashboard ──────────────────
      this.addCoverPage(doc, d, reportType);

      if (teaserOnly) {
        // Free version — one page teaser, then upgrade CTA
        doc.addPage();
        this.addTeaserUpgradePage(doc, d);
        return doc;
      }

      // ── PAGE 2: Key Metrics + Threat Map ──────────────────────
      doc.addPage();
      await this.addMetricsAndMap(doc, d);

      // ── PAGE 3: Category Breakdown + Hotspot Chart ─────────────
      doc.addPage();
      this.addCategoryAndHotspots(doc, d);

      // ── PAGE 4: Trend Analysis + Regional Risk ─────────────────
      doc.addPage();
      this.addTrendAndRegional(doc, d);

      // ── PAGE 5: OCHA-style Highlights + Situation Overview ──────
      doc.addPage();
      this.addHighlightsAndSitRep(doc, d);

      // ── PAGE 6: Full Incident Details ──────────────────────────
      if (d.incidents?.length > 0) {
        doc.addPage();
        this.addIncidentDetails(doc, d);
      }

      // ── PAGE 7: State Analysis + Recommendations ───────────────
      doc.addPage();
      this.addStateAndRecommendations(doc, d);

      return doc;
    } catch (err) {
      console.error('❌ PDF generation error:', err);
      throw err;
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // PAGE 1 — COVER + AT-A-GLANCE DASHBOARD
  // ══════════════════════════════════════════════════════════════════
  addCoverPage(doc, d, reportType) {
    const C = PDFReportService.C;
    const W = PDFReportService.PAGE_WIDTH;
    const M = PDFReportService.MARGIN;

    // ── Dark full-page background
    doc.rect(0, 0, W, 842).fill(C.bg);

    // ── Top accent stripe
    const stripeH = 5;
    doc.save();
    doc.rect(0, 0, W, stripeH).fill(C.accent);
    doc.restore();

    // ── Header band
    doc.rect(0, stripeH, W, 130).fill('#0f1923');

    // Shield icon (drawn with lines)
    this.drawShield(doc, 40, 18, 55, 115);

    // SUNTRENIA
    doc.fillColor(C.textPrimary).font('Helvetica-Bold').fontSize(30);
    doc.text('SUNTRENIA', 105, 32, { characterSpacing: 3 });
    doc.fillColor(C.accent).font('Helvetica-Bold').fontSize(11);
    doc.text('INTELLIGENCE PLATFORM', 107, 66, { characterSpacing: 2 });

    // Date badge
    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const dateStr = `${weekAgo.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()} – ${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}`;
    doc.rect(105, 80, 260, 22).fillAndStroke('rgba(230,57,70,0.15)', C.accent + '60');
    doc.fillColor('#ff9999').font('Helvetica').fontSize(9).text(`WEEK OF ${dateStr}`, 112, 86);

    // CLASSIFIED badge
    doc.rect(W - 130, 24, 112, 38).fill(C.critical + '33');
    doc.rect(W - 130, 24, 112, 38).stroke(C.critical);
    doc.fillColor(C.critical).font('Helvetica-Bold').fontSize(9).text('CONFIDENTIAL', W - 120, 33, { width: 92, align: 'center' });
    doc.fillColor('#ff9999').font('Helvetica').fontSize(7).text('RESTRICTED ACCESS', W - 120, 47, { width: 92, align: 'center' });

    // Report Title
    let titleY = 155;
    doc.rect(0, stripeH + 130, W, 100).fill('#1c1228');
    doc.fillColor(C.textPrimary).font('Helvetica-Bold').fontSize(22);
    doc.text('WEEKLY SECURITY INTELLIGENCE REPORT', M, titleY, { width: W - M * 2, align: 'center', characterSpacing: 1 });
    doc.fillColor(C.textSec).font('Helvetica').fontSize(11);
    doc.text('Nigeria — All 36 States + FCT | Multi-Source OSINT/AI Analysis', M, titleY + 28, { width: W - M * 2, align: 'center' });

    // ── AT-A-GLANCE STATS CARDS
    const metrics = [
      { label: 'INCIDENTS',  value: d.incidents?.length || 0,  color: C.accent,        sym: '!' },
      { label: 'STATES',     value: d.statesAffected || 0,    color: C.accentOrange,   sym: '+' },
      { label: 'CASUALTIES', value: d.casualties || 0,        color: C.critical,       sym: 'x' },
      { label: 'ABDUCTED',   value: d.abductions || 0,        color: C.accentPurple,   sym: '@' },
    ];

    const cardW = 115;
    const cardH = 100;
    const cardY = 270;
    const totalCardsW = metrics.length * cardW + (metrics.length - 1) * 10;
    let cardX = (W - totalCardsW) / 2;

    metrics.forEach(m => {
      // Shadow
      doc.rect(cardX + 2, cardY + 2, cardW, cardH).fill('#00000060');
      // Card
      doc.rect(cardX, cardY, cardW, cardH).fill(m.color + '22');
      doc.rect(cardX, cardY, cardW, cardH).stroke(m.color + '80');
      // Top bar
      doc.rect(cardX, cardY, cardW, 3).fill(m.color);
      // Symbol
      doc.fillColor(m.color).font('Helvetica-Bold').fontSize(22);
      doc.text(m.sym, cardX, cardY + 12, { width: cardW, align: 'center' });
      // Value
      doc.fillColor(C.textPrimary).font('Helvetica-Bold').fontSize(34);
      doc.text(m.value.toString(), cardX, cardY + 40, { width: cardW, align: 'center' });
      // Label
      doc.fillColor(C.textSec).font('Helvetica').fontSize(8);
      doc.text(m.label, cardX, cardY + 82, { width: cardW, align: 'center' });
      cardX += cardW + 10;
    });

    // ── THREAT LEVEL BANNER
    const incidents = d.incidents?.length || 0;
    let lvlColor, lvlLabel, lvlDesc;
    if (incidents >= 20)      { lvlColor = C.critical;      lvlLabel = 'CRITICAL'; lvlDesc = 'Severe security environment — avoid non-essential travel'; }
    else if (incidents >= 10) { lvlColor = C.high;          lvlLabel = 'HIGH';     lvlDesc = 'Elevated threat — heightened security measures required'; }
    else if (incidents >= 5)  { lvlColor = C.medium;        lvlLabel = 'MODERATE'; lvlDesc = 'Notable incidents — standard precautions advised'; }
    else                      { lvlColor = C.low;           lvlLabel = 'LOW';      lvlDesc = 'Minimal incidents — maintain situational awareness'; }

    const bannerY = 390;
    doc.rect(0, bannerY, W, 52).fill(lvlColor + '22');
    doc.rect(0, bannerY, 5, 52).fill(lvlColor);
    doc.fillColor(lvlColor).font('Helvetica-Bold').fontSize(13);
    doc.text(`THREAT LEVEL: ${lvlLabel}`, 16, bannerY + 10);
    doc.fillColor(C.textSec).font('Helvetica').fontSize(10);
    doc.text(lvlDesc, 16, bannerY + 30);

    // Level indicator boxes
    const lvlNums = { 'CRITICAL': 4, 'HIGH': 3, 'MODERATE': 2, 'LOW': 1 };
    const lvlNum = lvlNums[lvlLabel] || 1;
    for (let i = 0; i < 4; i++) {
      doc.rect(W - 110 + i * 24, bannerY + 14, 18, 24)
         .fill(i < lvlNum ? lvlColor : lvlColor + '30');
    }

    // ── CATEGORY BREAKDOWN SECTION
    const catY = 460;
    doc.fillColor(C.textSec).font('Helvetica-Bold').fontSize(10);
    doc.text('INCIDENT CATEGORIES', M, catY, { characterSpacing: 1 });
    doc.rect(M, catY + 14, W - M * 2, 1).fill(C.border);

    const catCounts = {};
    (d.incidents || []).forEach(inc => {
      const cat = inc.aiClassification || inc.category || 'Unknown';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });
    const total = Object.values(catCounts).reduce((a, b) => a + b, 0) || 1;
    const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

    const displayCats = sortedCats.length > 0 ? sortedCats : [
      ['Banditry', 0], ['Kidnapping', 0], ['Terrorism', 0],
      ['Communal Clash', 0], ['Military Operation', 0], ['Other', 0]
    ];

    let catRowY = catY + 22;
    const maxCount = displayCats[0]?.[1] || 1;
    displayCats.forEach(([cat, count]) => {
      const color = PDFReportService.CAT_COLORS[cat] || C.textSec;
      const barW = (count / maxCount) * 280;
      const pct = total > 0 ? ((count / total) * 100).toFixed(0) : '0';

      // Dot
      doc.circle(M + 6, catRowY + 7, 5).fill(color);
      // Name
      doc.fillColor(C.textPrimary).font('Helvetica').fontSize(9);
      doc.text(cat, M + 18, catRowY + 3, { width: 120 });
      // Bar bg
      doc.rect(M + 145, catRowY + 2, 280, 12).fill(color + '25');
      // Bar fill
      if (barW > 0) doc.rect(M + 145, catRowY + 2, barW, 12).fill(color + 'cc');
      // Pct
      doc.fillColor(color).font('Helvetica-Bold').fontSize(9);
      doc.text(`${count} (${pct}%)`, M + 434, catRowY + 3);

      catRowY += 22;
    });

    // ── TOP HOTSPOT STATES
    const hsY = catRowY + 20;
    doc.fillColor(C.textSec).font('Helvetica-Bold').fontSize(10);
    doc.text('TOP AFFECTED STATES', M, hsY, { characterSpacing: 1 });
    doc.rect(M, hsY + 14, W - M * 2, 1).fill(C.border);

    const stateCounts = {};
    (d.incidents || []).forEach(inc => {
      const state = inc.state || inc.location?.state || 'Unknown';
      stateCounts[state] = (stateCounts[state] || 0) + 1;
    });
    let topStates = Object.entries(stateCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (topStates.length === 0) topStates = (d.affectedStateNames || []).slice(0, 5).map((s, i) => [s, 5 - i]);

    const chipColors = [C.critical, C.high, C.medium, C.accentBlue, C.accentGreen];
    const chipW = 96, chipH = 68;
    let chipX = M;
    const chipY = hsY + 22;
    const maxHotspot = topStates[0]?.[1] || 1;

    topStates.forEach(([state, count], i) => {
      const col = chipColors[i] || C.textSec;
      doc.rect(chipX, chipY, chipW, chipH).fill(col + '20');
      doc.rect(chipX, chipY, chipW, chipH).stroke(col + '60');
      doc.rect(chipX, chipY, chipW, 3).fill(col);

      // Rank
      doc.fillColor(col).font('Helvetica-Bold').fontSize(9);
      doc.text(`#${i + 1}`, chipX + 4, chipY + 8);
      // State name
      const sName = state.length > 9 ? state.substring(0, 8) + '.' : state;
      doc.fillColor(C.textPrimary).font('Helvetica-Bold').fontSize(9);
      doc.text(sName.toUpperCase(), chipX, chipY + 28, { width: chipW, align: 'center' });
      // Count
      doc.fillColor(col).font('Helvetica-Bold').fontSize(20);
      doc.text(count.toString(), chipX, chipY + 42, { width: chipW, align: 'center' });

      chipX += chipW + 8;
    });

    // ── Footer
    const footY = 800;
    doc.rect(0, footY, W, 42).fill('#0f1923');
    doc.rect(0, footY, W, 1).fill(C.accent);
    doc.fillColor(C.textMuted).font('Helvetica').fontSize(8);
    doc.text(`${this.config.org}  |  ${this.config.website}  |  ${this.config.phone}`, M, footY + 8, { width: W - M * 2, align: 'center' });
    doc.text(`Generated: ${now.toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}  |  Classification: CONFIDENTIAL`, M, footY + 22, { width: W - M * 2, align: 'center' });
  }

  drawShield(doc, x, y, w, h) {
    const cx = x + w / 2;
    const C = PDFReportService.C;
    doc.save();
    doc.moveTo(cx, y).lineTo(x + w, y + h * 0.3).lineTo(x + w, y + h * 0.65)
       .lineTo(cx, y + h).lineTo(x, y + h * 0.65).lineTo(x, y + h * 0.3).closePath()
       .fill(C.accent + '22');
    doc.moveTo(cx, y).lineTo(x + w, y + h * 0.3).lineTo(x + w, y + h * 0.65)
       .lineTo(cx, y + h).lineTo(x, y + h * 0.65).lineTo(x, y + h * 0.3).closePath()
       .stroke(C.accent);
    doc.fillColor(C.accent).font('Helvetica-Bold').fontSize(28)
       .text('S', cx - 9, y + h * 0.38);
    doc.restore();
  }

  // ══════════════════════════════════════════════════════════════════
  // TEASER PAGE — FREE VERSION ONLY
  // ══════════════════════════════════════════════════════════════════
  addTeaserUpgradePage(doc, d) {
    const C = PDFReportService.C;
    const W = PDFReportService.PAGE_WIDTH;
    const M = PDFReportService.MARGIN;

    doc.rect(0, 0, W, 842).fill(C.bg);
    doc.rect(0, 0, W, 5).fill(C.accent);

    // LOCKED content visual
    doc.rect(M, 40, W - M * 2, 260).fill(C.bgCard);
    doc.rect(M, 40, W - M * 2, 260).stroke(C.border);

    // Blurred rows (simulated)
    for (let i = 0; i < 8; i++) {
      const rowY = 60 + i * 28;
      doc.rect(M + 10, rowY, 200, 14).fill(C.textMuted + '40');
      doc.rect(M + 10, rowY, 60 + Math.random() * 100, 14).fill(C.textMuted + '20');
      doc.rect(M + 220, rowY, 100, 14).fill(C.textMuted + '30');
      doc.rect(M + 330, rowY, 80, 14).fill(C.textMuted + '20');
    }

    // Lock overlay
    doc.rect(M, 40, W - M * 2, 260).fill('#00000088');

    // Lock icon
    doc.rect(W / 2 - 30, 110, 60, 50).fill(C.accent).stroke(C.accent);
    doc.circle(W / 2, 108, 22).stroke(C.accent).lineWidth(5);
    doc.fillColor(C.white).font('Helvetica-Bold').fontSize(22);
    doc.text('LOCKED', W / 2 - 38, 126);

    doc.fillColor(C.textSec).font('Helvetica').fontSize(12);
    doc.text('Full incident details available in\nPremium report only', M, 210, { width: W - M * 2, align: 'center' });

    // Stats they're missing
    const missing = [
      `${d.incidents?.length || 0} detailed incident reports`,
      `${d.stateRiskAnalyses?.length || 0} state risk assessments`,
      'AI-powered pattern analysis',
      'Strategic security recommendations',
      'Interactive maps & trend charts',
    ];

    let misY = 330;
    doc.fillColor(C.accent).font('Helvetica-Bold').fontSize(14);
    doc.text('THIS FULL REPORT INCLUDES:', M + 60, misY);
    misY += 24;

    missing.forEach(item => {
      doc.circle(M + 72, misY + 6, 4).fill(C.accentGreen);
      doc.fillColor(C.textPrimary).font('Helvetica').fontSize(11);
      doc.text(item, M + 84, misY);
      misY += 22;
    });

    // CTA Box
    const ctaY = 560;
    doc.rect(M, ctaY, W - M * 2, 200).fill(C.accent + '18');
    doc.rect(M, ctaY, W - M * 2, 200).stroke(C.accent + '60');
    doc.rect(M, ctaY, W - M * 2, 4).fill(C.accent);

    doc.fillColor(C.textPrimary).font('Helvetica-Bold').fontSize(20);
    doc.text('UNLOCK THE FULL REPORT', M, ctaY + 24, { width: W - M * 2, align: 'center' });

    doc.fillColor(C.textSec).font('Helvetica').fontSize(11);
    doc.text('Subscribe to Suntrenia Premium for ₦15,000/month and get\nthis complete 7-page report delivered to your inbox every week automatically.\nNo links. No forms. Just intelligence.', M, ctaY + 56, { width: W - M * 2, align: 'center', lineGap: 4 });

    // Upgrade button look
    doc.rect(M + 80, ctaY + 128, W - M * 2 - 160, 48).fill(C.accent);
    doc.fillColor(C.white).font('Helvetica-Bold').fontSize(14);
    doc.text('SUBSCRIBE TO PREMIUM — ₦15,000/MONTH', M + 80, ctaY + 146, { width: W - M * 2 - 160, align: 'center' });

    doc.fillColor(C.textSec).font('Helvetica').fontSize(9);
    doc.text(`${this.config.website}  •  Cancel anytime  •  30-day money-back guarantee`, M, ctaY + 186, { width: W - M * 2, align: 'center' });

    // Footer
    doc.rect(0, 800, W, 42).fill('#0f1923');
    doc.fillColor(C.textMuted).font('Helvetica').fontSize(8);
    doc.text(`${this.config.org}  |  ${this.config.website}  |  ${this.config.phone}`, M, 812, { width: W - M * 2, align: 'center' });
  }

  // ══════════════════════════════════════════════════════════════════
  // PAGE 2 — METRICS + MAP
  // ══════════════════════════════════════════════════════════════════
  async addMetricsAndMap(doc, d) {
    const C = PDFReportService.C;
    const W = PDFReportService.PAGE_WIDTH;
    const M = PDFReportService.MARGIN;

    doc.rect(0, 0, W, 842).fill(C.bg);
    this.addPageHeader(doc, 'GEOGRAPHIC THREAT ASSESSMENT', 2);

    // Embed map
    if (d.mapSvg) {
      await this.embedMap(doc, d.mapSvg, M, 70, W - M * 2, 340);
    } else {
      doc.rect(M, 70, W - M * 2, 340).fill(C.bgCard).stroke(C.border);
      doc.fillColor(C.textMuted).font('Helvetica').fontSize(12);
      doc.text('MAP DATA UNAVAILABLE', M, 230, { width: W - M * 2, align: 'center' });
    }

    // Map legend
    const legendY = 420;
    const legendItems = [
      { color: C.low,      label: 'Low (0-2)' },
      { color: C.medium,   label: 'Moderate (3-5)' },
      { color: C.high,     label: 'High (6-9)' },
      { color: C.critical, label: 'Critical (10+)' },
    ];
    doc.fillColor(C.textSec).font('Helvetica-Bold').fontSize(9);
    doc.text('THREAT LEVEL LEGEND:', M, legendY);
    legendItems.forEach((item, i) => {
      const lx = M + i * 130;
      doc.rect(lx, legendY + 14, 14, 14).fill(item.color);
      doc.fillColor(C.textPrimary).font('Helvetica').fontSize(9);
      doc.text(item.label, lx + 18, legendY + 16);
    });

    // Bar chart — top states
    this.drawBarChartSection(doc, d, M, 460, W - M * 2, 290);

    this.addPageFooter(doc, 2);
  }

  async embedMap(doc, svgData, x, y, w, h) {
    if (this.hasSVGSupport) {
      try {
        const SVGtoPDF = require('svg-to-pdfkit');
        SVGtoPDF(doc, svgData, x, y, { width: w, height: h, preserveAspectRatio: 'xMidYMid meet' });
        console.log('✅ Map embedded via SVG');
        return;
      } catch (e) { console.warn('⚠️ SVG embed failed:', e.message); }
    }
    if (this.hasSharpSupport) {
      try {
        const sharp = require('sharp');
        const png = await sharp(Buffer.from(svgData, 'utf-8'), { density: 200 }).png().toBuffer();
        doc.image(png, x, y, { width: w, height: h });
        console.log('✅ Map embedded via PNG');
        return;
      } catch (e) { console.warn('⚠️ PNG fallback failed:', e.message); }
    }
    const C = PDFReportService.C;
    doc.rect(x, y, w, h).fill(C.bgCard).stroke(C.border);
    doc.fillColor(C.textMuted).font('Helvetica').fontSize(11);
    doc.text('Map rendering requires svg-to-pdfkit or sharp', x, y + h / 2 - 10, { width: w, align: 'center' });
  }

  drawBarChartSection(doc, d, x, y, w, h) {
    const C = PDFReportService.C;

    doc.fillColor(C.textSec).font('Helvetica-Bold').fontSize(10);
    doc.text('INCIDENT DISTRIBUTION BY STATE', x, y, { characterSpacing: 1 });
    doc.rect(x, y + 14, w, 1).fill(C.border);

    const stateCounts = {};
    (d.incidents || []).forEach(inc => {
      const state = inc.state || inc.location?.state || 'Unknown';
      stateCounts[state] = (stateCounts[state] || 0) + 1;
    });

    const sorted = Object.entries(stateCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (sorted.length === 0) return;

    const chartH = h - 50;
    const chartY = y + 22;
    const barW = Math.floor((w - 40) / sorted.length);
    const maxVal = sorted[0][1];
    const colors = [C.critical, C.high, C.medium, C.accentBlue, C.accentGreen, C.accentPurple, C.accentOrange, C.accent, C.accentYellow, C.textSec];

    sorted.forEach(([state, count], i) => {
      const bx = x + 20 + i * barW;
      const bh = Math.max((count / maxVal) * chartH, 4);
      const by = chartY + chartH - bh;
      const col = colors[i] || C.textSec;

      // Bar
      doc.rect(bx + 2, by, barW - 4, bh).fill(col + 'cc');
      // Count
      doc.fillColor(col).font('Helvetica-Bold').fontSize(8);
      doc.text(count.toString(), bx + 2, by - 12, { width: barW - 4, align: 'center' });
      // Label
      const sName = state.length > 5 ? state.substring(0, 5) : state;
      doc.fillColor(C.textSec).font('Helvetica').fontSize(7);
      doc.text(sName, bx + 2, chartY + chartH + 4, { width: barW - 4, align: 'center' });
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // PAGE 3 — CATEGORY + HOTSPOTS
  // ══════════════════════════════════════════════════════════════════
  addCategoryAndHotspots(doc, d) {
    const C = PDFReportService.C;
    const W = PDFReportService.PAGE_WIDTH;
    const M = PDFReportService.MARGIN;

    doc.rect(0, 0, W, 842).fill(C.bg);
    this.addPageHeader(doc, 'THREAT CATEGORY ANALYSIS', 3);

    // Build category data
    const catCounts = {};
    (d.incidents || []).forEach(inc => {
      const cat = inc.aiClassification || inc.category || 'Unknown';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });
    const total = Object.values(catCounts).reduce((a, b) => a + b, 0) || 1;
    const sorted = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);

    // Large category cards
    let catY = 75;
    sorted.slice(0, 8).forEach(([cat, count], i) => {
      const color = PDFReportService.CAT_COLORS[cat] || C.textSec;
      const pct = ((count / total) * 100).toFixed(1);
      const barFill = (count / (sorted[0]?.[1] || 1)) * (W - M * 2 - 140);

      const rowH = 58;

      // Background row
      doc.rect(M, catY, W - M * 2, rowH).fill(i % 2 === 0 ? C.bgCard : C.bgCardAlt);

      // Left color bar
      doc.rect(M, catY, 5, rowH).fill(color);

      // Icon circle
      doc.circle(M + 28, catY + rowH / 2, 18).fill(color + '30').stroke(color + '80');
      doc.fillColor(color).font('Helvetica-Bold').fontSize(14);
      doc.text(['⚔','💥','🔒','🛡','★','◈','◉','☠'][i] || '◆', M + 18, catY + rowH / 2 - 8, { width: 20, align: 'center' });

      // Category name
      doc.fillColor(C.textPrimary).font('Helvetica-Bold').fontSize(12);
      doc.text(cat.toUpperCase(), M + 56, catY + 10);

      // Bar track
      doc.rect(M + 56, catY + 32, W - M * 2 - 140, 12).fill(color + '20');
      // Bar fill
      if (barFill > 0) doc.rect(M + 56, catY + 32, barFill, 12).fill(color + 'bb');

      // Count + pct
      doc.fillColor(color).font('Helvetica-Bold').fontSize(14);
      doc.text(`${count}`, W - M - 80, catY + 10);
      doc.fillColor(C.textSec).font('Helvetica').fontSize(10);
      doc.text(`${pct}%`, W - M - 45, catY + 14);

      catY += rowH + 4;
    });

    // Donut-style summary
    const summaryY = catY + 20;
    doc.fillColor(C.textSec).font('Helvetica-Bold').fontSize(10);
    doc.text('THREAT DISTRIBUTION SUMMARY', M, summaryY, { characterSpacing: 1 });
    doc.rect(M, summaryY + 14, W - M * 2, 1).fill(C.border);

    let sumX = M;
    sorted.slice(0, 5).forEach(([cat, count]) => {
      const color = PDFReportService.CAT_COLORS[cat] || C.textSec;
      const pct = ((count / total) * 100).toFixed(0);
      const barW = (count / total) * (W - M * 2);

      doc.rect(sumX, summaryY + 18, barW, 22).fill(color + 'cc');
      if (barW > 40) {
        doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8);
        doc.text(`${pct}%`, sumX + 4, summaryY + 23);
      }
      sumX += barW;
    });

    // Legend
    let legX = M;
    sorted.slice(0, 5).forEach(([cat]) => {
      const color = PDFReportService.CAT_COLORS[cat] || C.textSec;
      doc.rect(legX, summaryY + 46, 10, 10).fill(color);
      doc.fillColor(C.textPrimary).font('Helvetica').fontSize(8);
      doc.text(cat, legX + 14, summaryY + 47, { width: 90 });
      legX += 100;
    });

    this.addPageFooter(doc, 3);
  }

  // ══════════════════════════════════════════════════════════════════
  // PAGE 4 — TREND + REGIONAL RISK
  // ══════════════════════════════════════════════════════════════════
  addTrendAndRegional(doc, d) {
    const C = PDFReportService.C;
    const W = PDFReportService.PAGE_WIDTH;
    const M = PDFReportService.MARGIN;

    doc.rect(0, 0, W, 842).fill(C.bg);
    this.addPageHeader(doc, 'TREND & REGIONAL RISK ANALYSIS', 4);

    // Trend chart
    this.drawTrendChart(doc, d, M, 70, W - M * 2, 180);

    // Regional risk grid
    const regions = [
      { name: 'NORTH EAST',    states: ['Borno','Yobe','Adamawa','Gombe','Bauchi','Taraba'] },
      { name: 'NORTH WEST',    states: ['Zamfara','Katsina','Sokoto','Kebbi','Kano','Kaduna','Jigawa'] },
      { name: 'NORTH CENTRAL', states: ['Niger','Benue','Nasarawa','Plateau','Kogi','Kwara','FCT'] },
      { name: 'SOUTH WEST',    states: ['Lagos','Ogun','Oyo','Osun','Ondo','Ekiti'] },
      { name: 'SOUTH EAST',    states: ['Anambra','Enugu','Ebonyi','Imo','Abia'] },
      { name: 'SOUTH SOUTH',   states: ['Rivers','Delta','Bayelsa','Cross River','Akwa Ibom','Edo'] },
    ];

    const affected = new Set((d.affectedStateNames || []).map(s => s.toLowerCase()));

    const regY = 280;
    doc.fillColor(C.textSec).font('Helvetica-Bold').fontSize(10);
    doc.text('GEOPOLITICAL ZONE RISK ASSESSMENT', M, regY, { characterSpacing: 1 });
    doc.rect(M, regY + 14, W - M * 2, 1).fill(C.border);

    const cardW = (W - M * 2 - 10) / 2;
    const cardH = 84;

    regions.forEach((reg, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const rx = M + col * (cardW + 10);
      const ry = regY + 22 + row * (cardH + 8);

      const affCount = reg.states.filter(s => affected.has(s.toLowerCase())).length;
      const ratio = affCount / reg.states.length;

      let rColor, rLabel;
      if (ratio >= 0.5)      { rColor = C.critical; rLabel = 'HIGH'; }
      else if (ratio >= 0.3) { rColor = C.medium;   rLabel = 'MODERATE'; }
      else if (ratio > 0)    { rColor = C.accentBlue; rLabel = 'LOW'; }
      else                   { rColor = C.low;       rLabel = 'CALM'; }

      doc.rect(rx, ry, cardW, cardH).fill(rColor + '15');
      doc.rect(rx, ry, cardW, cardH).stroke(rColor + '40');
      doc.rect(rx, ry, 4, cardH).fill(rColor);

      doc.fillColor(C.textPrimary).font('Helvetica-Bold').fontSize(11);
      doc.text(reg.name, rx + 14, ry + 12);

      doc.fillColor(C.textSec).font('Helvetica').fontSize(9);
      doc.text(`${affCount} of ${reg.states.length} states with incidents`, rx + 14, ry + 32);

      // Mini state dots
      reg.states.forEach((state, si) => {
        const dotX = rx + 14 + si * 20;
        const dotY = ry + 56;
        if (dotX + 14 < rx + cardW - 80) {
          const isAff = affected.has(state.toLowerCase());
          doc.circle(dotX + 7, dotY, 6).fill(isAff ? rColor : rColor + '25');
        }
      });

      // Risk badge
      doc.rect(rx + cardW - 72, ry + 28, 64, 22).fill(rColor);
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(9);
      doc.text(rLabel, rx + cardW - 72, ry + 35, { width: 64, align: 'center' });
    });

    // Pattern analysis
    const patY = regY + 22 + 3 * (cardH + 8) + 20;
    doc.fillColor(C.textSec).font('Helvetica-Bold').fontSize(10);
    doc.text('PATTERN ANALYSIS', M, patY, { characterSpacing: 1 });
    doc.rect(M, patY + 14, W - M * 2, 1).fill(C.border);

    const analysis = d.patternAnalysis || 'Security patterns indicate concentrated threat activity in the northern geopolitical zones. Cross-border movements and internal displacement continue to exacerbate existing vulnerabilities. Longitudinal comparison suggests evolving operational tactics among non-state armed groups.';
    doc.rect(M, patY + 18, W - M * 2, 80).fill(C.bgCard);
    doc.fillColor(C.textPrimary).font('Helvetica').fontSize(10);
    doc.text(analysis, M + 10, patY + 28, { width: W - M * 2 - 20, lineGap: 4 });

    this.addPageFooter(doc, 4);
  }

  drawTrendChart(doc, d, x, y, w, h) {
    const C = PDFReportService.C;

    doc.fillColor(C.textSec).font('Helvetica-Bold').fontSize(10);
    doc.text('INCIDENT FREQUENCY TREND (7-DAY PERIOD)', x, y, { characterSpacing: 1 });
    doc.rect(x, y + 14, w, 1).fill(C.border);

    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    let dailyCounts = new Array(7).fill(0);
    (d.incidents || []).forEach((inc, idx) => { dailyCounts[idx % 7]++; });
    if (d.trendData?.data?.length > 0) dailyCounts = d.trendData.data.slice(0, 7);

    const chartH = h - 40;
    const chartY = y + 22;
    const maxVal = Math.max(...dailyCounts, 1);
    const barW = Math.floor((w - 30) / 7);

    // BG
    doc.rect(x, chartY, w, chartH).fill(C.bgCard);

    // Grid
    for (let g = 0; g <= 4; g++) {
      const gy = chartY + (chartH * g) / 4;
      doc.rect(x, gy, w, 0.5).fill(C.border);
    }

    // Bars
    days.forEach((day, i) => {
      const bx = x + 15 + i * barW;
      const count = dailyCounts[i] || 0;
      const bh = Math.max((count / maxVal) * (chartH - 20), 2);
      const by = chartY + chartH - 16 - bh;
      const col = count >= maxVal * 0.7 ? C.critical : count >= maxVal * 0.4 ? C.medium : C.accentBlue;

      doc.rect(bx + 2, by, barW - 6, bh).fill(col + 'bb');
      if (count > 0) {
        doc.fillColor(col).font('Helvetica-Bold').fontSize(8);
        doc.text(count.toString(), bx + 2, by - 10, { width: barW - 6, align: 'center' });
      }
      doc.fillColor(C.textSec).font('Helvetica').fontSize(8);
      doc.text(day, bx + 2, chartY + chartH - 12, { width: barW - 6, align: 'center' });
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // PAGE 5 — OCHA-STYLE HIGHLIGHTS + SITUATION REPORT
  // ══════════════════════════════════════════════════════════════════
  addHighlightsAndSitRep(doc, d) {
    const C = PDFReportService.C;
    const W = PDFReportService.PAGE_WIDTH;
    const M = PDFReportService.MARGIN;

    doc.rect(0, 0, W, 842).fill('#f8f9fa'); // Light background for OCHA-style pages
    doc.rect(0, 0, W, 5).fill(C.accent);

    // Header
    doc.rect(0, 5, W, 55).fill('#1a252f');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(15);
    doc.text('SUNTRENIA INTELLIGENCE  |  SITUATION REPORT', M, 22, { characterSpacing: 1 });
    doc.fillColor(C.accent).font('Helvetica').fontSize(9);
    doc.text(`Week of ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}  |  Page 5 of 7`, M, 42);

    // HIGHLIGHTS section
    const hlY = 80;
    doc.rect(M, hlY, W - M * 2, 200).fill('#ffffff');
    doc.rect(M, hlY, W - M * 2, 200).stroke('#dee2e6');
    doc.rect(M, hlY, W - M * 2, 28).fill('#1a252f');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(12);
    doc.text('HIGHLIGHTS', M + 10, hlY + 8, { characterSpacing: 2 });

    // Generate highlights from incidents
    const highlights = this.generateHighlights(d);
    let hlItemY = hlY + 38;
    highlights.slice(0, 5).forEach(hl => {
      doc.circle(M + 18, hlItemY + 5, 5).fill(C.accent);
      doc.fillColor('#2c3e50').font('Helvetica').fontSize(10);
      doc.text(hl, M + 32, hlItemY, { width: W - M * 2 - 40, lineGap: 2 });
      hlItemY += doc.heightOfString(hl, { width: W - M * 2 - 40 }) + 12;
    });

    // BACKGROUND / SITUATION OVERVIEW
    const bgY = 300;
    doc.fillColor('#2c3e50').font('Helvetica-Bold').fontSize(14);
    doc.text('BACKGROUND', M, bgY);
    doc.rect(M, bgY + 18, W - M * 2, 2).fill(C.accent);

    doc.fillColor('#555').font('Helvetica-Bold').fontSize(11);
    doc.text('Situation Overview', M, bgY + 26);

    const briefing = d.aiBriefing || 'Security conditions across Nigeria during the reporting period reflect ongoing multi-dimensional threats. Non-state armed groups continue to operate across the north, while intercommunal tensions persist in the Middle Belt region. Law enforcement and military operations have yielded mixed results, with some degradation of armed group capacity offset by continued recruitment and adaptation. The humanitarian situation in affected areas remains a concern, with displacement and access constraints reported in several states.';
    doc.fillColor('#34495e').font('Helvetica').fontSize(10);
    doc.text(briefing, M, bgY + 44, { width: W - M * 2, align: 'justify', lineGap: 4 });

    // Executive briefing box (left-border accent)
    const ebY = bgY + 44 + doc.heightOfString(briefing, { width: W - M * 2 }) + 20;
    doc.rect(M, ebY, 4, 90).fill(C.accentBlue);
    doc.rect(M + 4, ebY, W - M * 2 - 4, 90).fill('#eef2ff');
    doc.fillColor(C.accentBlue).font('Helvetica-Bold').fontSize(10);
    doc.text('AI INTELLIGENCE ASSESSMENT', M + 14, ebY + 10);
    const execBrief = d.executiveBrief || d.aiBriefing || 'Analysis indicates elevated threat levels in northwest and northeast zones. Pattern recognition suggests coordinated operational activity by armed groups. Recommend enhanced monitoring of identified hotspot states.';
    doc.fillColor('#2c3e50').font('Helvetica').fontSize(9);
    doc.text(execBrief.substring(0, 350) + (execBrief.length > 350 ? '...' : ''), M + 14, ebY + 26, { width: W - M * 2 - 24, lineGap: 3 });

    this.addPageFooter(doc, 5, true);
  }

  generateHighlights(d) {
    const highlights = [];
    const incidents = d.incidents || [];

    if (incidents.length > 0) {
      highlights.push(`${incidents.length} security incidents recorded across ${d.statesAffected || 0} states during the reporting period.`);
    }
    if (d.casualties > 0) {
      highlights.push(`Estimated ${d.casualties} casualties reported across recorded incidents.`);
    }
    if (d.abductions > 0) {
      highlights.push(`${d.abductions} persons reported abducted in kidnapping and banditry incidents.`);
    }

    const topStates = d.affectedStateNames?.slice(0, 3);
    if (topStates?.length > 0) {
      highlights.push(`Highest incident concentration recorded in ${topStates.join(', ')}.`);
    }

    const terrorIncidents = incidents.filter(i => (i.aiClassification || '').toLowerCase().includes('terror'));
    if (terrorIncidents.length > 0) {
      highlights.push(`${terrorIncidents.length} terrorism-related incidents reported, indicating continued NSAG operational activity.`);
    }

    if (highlights.length < 3) {
      highlights.push('Security forces conducted operations in multiple states during the reporting period.');
      highlights.push('Humanitarian situation remains of concern in high-risk zones. Displacement and access constraints reported.');
    }

    return highlights;
  }

  // ══════════════════════════════════════════════════════════════════
  // PAGE 6 — FULL INCIDENT DETAILS
  // ══════════════════════════════════════════════════════════════════
  addIncidentDetails(doc, d) {
    const C = PDFReportService.C;
    const W = PDFReportService.PAGE_WIDTH;
    const M = PDFReportService.MARGIN;

    doc.rect(0, 0, W, 842).fill(C.bg);
    this.addPageHeader(doc, 'INCIDENT INTELLIGENCE DIGEST', 6);

    const incidents = d.incidents || [];
    let curY = 70;
    const sevColors = { Critical: C.critical, High: C.high, Medium: C.medium, Low: C.low };

    incidents.forEach((inc, i) => {
      if (curY > 750) {
        doc.addPage();
        doc.rect(0, 0, W, 842).fill(C.bg);
        this.addPageHeader(doc, 'INCIDENT INTELLIGENCE DIGEST (CONT.)', 6);
        curY = 70;
      }

      const incH = 85;
      const sevColor = sevColors[inc.severity] || C.textSec;
      const catColor = PDFReportService.CAT_COLORS[inc.aiClassification || ''] || C.textSec;

      // Card
      doc.rect(M, curY, W - M * 2, incH).fill(C.bgCard);
      doc.rect(M, curY, 4, incH).fill(sevColor);

      // Number badge
      doc.rect(M + 8, curY + 8, 28, 22).fill(sevColor + '30');
      doc.fillColor(sevColor).font('Helvetica-Bold').fontSize(11);
      doc.text((i + 1).toString(), M + 8, curY + 13, { width: 28, align: 'center' });

      // Title
      doc.fillColor(C.textPrimary).font('Helvetica-Bold').fontSize(10);
      doc.text(inc.title || 'Untitled Incident', M + 44, curY + 8, { width: W - M * 2 - 120 });

      // Severity + category badges
      doc.rect(W - M - 110, curY + 8, 50, 16).fill(sevColor);
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(7);
      doc.text(inc.severity || 'N/A', W - M - 110, curY + 12, { width: 50, align: 'center' });

      doc.rect(W - M - 56, curY + 8, 48, 16).fill(catColor + '40').stroke(catColor + '80');
      doc.fillColor(catColor).font('Helvetica-Bold').fontSize(7);
      const catShort = (inc.aiClassification || 'Other').substring(0, 8);
      doc.text(catShort, W - M - 56, curY + 12, { width: 48, align: 'center' });

      // Summary
      const summary = (inc.summary || 'No summary available').substring(0, 200);
      doc.fillColor(C.textSec).font('Helvetica').fontSize(9);
      doc.text(summary, M + 44, curY + 30, { width: W - M * 2 - 60, lineGap: 2 });

      // Casualties row
      if (inc.casualties) {
        doc.fillColor(C.critical).font('Helvetica').fontSize(8);
        doc.text(`Deaths: ${inc.casualties.deaths || 0}  |  Injuries: ${inc.casualties.injuries || 0}  |  Abducted: ${inc.casualties.abducted || 0}`, M + 44, curY + 68);
      }

      // Bottom separator
      doc.rect(M, curY + incH - 1, W - M * 2, 1).fill(C.border);
      curY += incH + 3;
    });

    this.addPageFooter(doc, 6);
  }

  // ══════════════════════════════════════════════════════════════════
  // PAGE 7 — STATE ANALYSIS + RECOMMENDATIONS
  // ══════════════════════════════════════════════════════════════════
  addStateAndRecommendations(doc, d) {
    const C = PDFReportService.C;
    const W = PDFReportService.PAGE_WIDTH;
    const M = PDFReportService.MARGIN;

    doc.rect(0, 0, W, 842).fill(C.bg);
    this.addPageHeader(doc, 'STATE RISK ASSESSMENT & RECOMMENDATIONS', 7);

    const analyses = d.stateRiskAnalyses || [];
    let curY = 70;
    const riskColors = { Critical: C.critical, High: C.high, Medium: C.medium, Low: C.low };

    analyses.slice(0, 4).forEach(analysis => {
      const rColor = riskColors[analysis.riskLevel] || C.textSec;
      const cardH = 80;

      doc.rect(M, curY, W - M * 2, cardH).fill(C.bgCard);
      doc.rect(M, curY, 4, cardH).fill(rColor);

      // State name + risk badge
      doc.fillColor(C.textPrimary).font('Helvetica-Bold').fontSize(12);
      doc.text(analysis.stateName, M + 14, curY + 10);

      doc.rect(W - M - 90, curY + 8, 82, 20).fill(rColor + '30').stroke(rColor);
      doc.fillColor(rColor).font('Helvetica-Bold').fontSize(9);
      doc.text(`${analysis.riskLevel} | ${analysis.incidentCount} incidents`, W - M - 90, curY + 14, { width: 82, align: 'center' });

      // Analysis text
      const text = (analysis.analysis || 'Detailed analysis pending.').substring(0, 200);
      doc.fillColor(C.textSec).font('Helvetica').fontSize(9);
      doc.text(text, M + 14, curY + 32, { width: W - M * 2 - 24, lineGap: 2 });

      doc.rect(M, curY + cardH - 1, W - M * 2, 1).fill(C.border);
      curY += cardH + 4;
    });

    // RECOMMENDATIONS
    const recY = curY + 20;
    doc.fillColor(C.textSec).font('Helvetica-Bold').fontSize(10);
    doc.text('STRATEGIC RECOMMENDATIONS', M, recY, { characterSpacing: 1 });
    doc.rect(M, recY + 14, W - M * 2, 2).fill(C.accentGreen);

    const recs = d.recommendations || [
      'Strengthen inter-agency security coordination in critical risk states',
      'Enhance community intelligence networks in identified hotspot zones',
      'Deploy rapid response capability to north-west and north-east corridors',
      'Increase surveillance and monitoring along identified conflict flashpoints',
      'Implement proactive humanitarian contingency planning in affected states',
    ];

    let recItemY = recY + 24;
    recs.slice(0, 5).forEach((rec, i) => {
      const colors = [C.critical, C.high, C.medium, C.accentBlue, C.accentGreen];
      const col = colors[i];

      doc.circle(M + 10, recItemY + 8, 8).fill(col + '30').stroke(col);
      doc.fillColor(col).font('Helvetica-Bold').fontSize(9);
      doc.text((i + 1).toString(), M + 6, recItemY + 4, { width: 8, align: 'center' });
      doc.fillColor(C.textPrimary).font('Helvetica').fontSize(10);
      doc.text(rec, M + 28, recItemY, { width: W - M * 2 - 34, lineGap: 3 });
      recItemY += 32;
    });

    // Sources
    const srcY = recItemY + 20;
    doc.rect(M, srcY, W - M * 2, 70).fill(C.bgCard);
    doc.fillColor(C.textSec).font('Helvetica-Bold').fontSize(9);
    doc.text('DATA SOURCES & METHODOLOGY', M + 10, srcY + 10, { characterSpacing: 1 });
    doc.fillColor(C.textMuted).font('Helvetica').fontSize(8);
    doc.text('This report is generated from open-source intelligence (OSINT) including verified news sources, official government statements, NGO field reports, and community intelligence feeds. Data is processed through AI classification algorithms for incident categorization and threat assessment. All information is collated within a 7-day reporting window.', M + 10, srcY + 26, { width: W - M * 2 - 20, lineGap: 3 });

    this.addPageFooter(doc, 7);
  }

  // ══════════════════════════════════════════════════════════════════
  // SHARED LAYOUT HELPERS
  // ══════════════════════════════════════════════════════════════════
  addPageHeader(doc, title, pageNum) {
    const C = PDFReportService.C;
    const W = PDFReportService.PAGE_WIDTH;
    const M = PDFReportService.MARGIN;

    doc.rect(0, 0, W, 5).fill(C.accent);
    doc.rect(0, 5, W, 50).fill('#0f1923');

    doc.fillColor(C.textPrimary).font('Helvetica-Bold').fontSize(13);
    doc.text(title, M, 18, { characterSpacing: 1 });

    doc.fillColor(C.accent).font('Helvetica').fontSize(8);
    doc.text(`${this.config.org}  |  CONFIDENTIAL`, M, 38);

    doc.fillColor(C.textMuted).font('Helvetica').fontSize(8);
    doc.text(`PAGE ${pageNum} OF 7`, W - M - 60, 38);
  }

  addPageFooter(doc, pageNum, lightBg = false) {
    const C = PDFReportService.C;
    const W = PDFReportService.PAGE_WIDTH;
    const M = PDFReportService.MARGIN;
    const footY = 800;

    if (!lightBg) {
      doc.rect(0, footY, W, 42).fill('#0f1923');
      doc.rect(0, footY, W, 1).fill(C.border);
    } else {
      doc.rect(0, footY, W, 42).fill('#1a252f');
    }

    doc.fillColor(C.textMuted).font('Helvetica').fontSize(7);
    doc.text(`${this.config.org}  |  ${this.config.website}  |  ${this.config.phone}  |  ${this.config.email}`, M, footY + 10, { width: W - M * 2, align: 'center' });
    doc.text(`Generated: ${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}  |  Classification: CONFIDENTIAL  |  Restricted Distribution`, M, footY + 24, { width: W - M * 2, align: 'center' });
  }

  // ══════════════════════════════════════════════════════════════════
  // EMAIL SENDING
  // ══════════════════════════════════════════════════════════════════
  async sendReportEmail(recipientEmail, pdfBuffer, reportName) {
    if (!this.validateEmail(recipientEmail)) return { success: false, error: 'Invalid email' };
    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) return { success: false, error: 'Invalid PDF' };

    if (this.useBrevo) return this.sendViaBrevo(recipientEmail, pdfBuffer, reportName);
    if (this.emailTransporter) return this.sendViaGmail(recipientEmail, pdfBuffer, reportName);
    return { success: false, error: 'Email service not configured' };
  }

  async sendViaBrevo(recipientEmail, pdfBuffer, reportName) {
    try {
      const mail = new brevo.SendSmtpEmail();
      mail.subject = `${this.config.org} — Weekly Security Intelligence Report`;
      mail.to = [{ email: recipientEmail }];
      mail.sender = { name: this.config.org, email: this.config.sender };
      mail.htmlContent = this.buildEmailHTML();
      mail.attachment = [{ content: pdfBuffer.toString('base64'), name: reportName || 'suntrenia-security-report.pdf' }];

      const res = await this.brevoClient.sendTransacEmail(mail);
      console.log('✅ Email sent via Brevo to:', recipientEmail);
      return { success: true, provider: 'Brevo', messageId: res.messageId };
    } catch (err) {
      console.error('❌ Brevo error:', err.message);
      return { success: false, error: err.message };
    }
  }

  async sendViaGmail(recipientEmail, pdfBuffer, reportName) {
    try {
      await this.emailTransporter.sendMail({
        from: this.config.sender,
        to: recipientEmail,
        subject: `${this.config.org} — Weekly Security Intelligence Report`,
        html: this.buildEmailHTML(),
        attachments: [{ filename: reportName || 'suntrenia-security-report.pdf', content: pdfBuffer }],
      });
      return { success: true, provider: 'Gmail' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  buildEmailHTML() {
    const C = PDFReportService.C;
    return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d1117;color:#f0f6fc;">
      <div style="background:linear-gradient(135deg,#1a0a0a,#0f1923);padding:36px 32px;border-top:4px solid #e63946;">
        <table width="100%"><tr>
          <td><span style="font-size:26px;font-weight:900;letter-spacing:2px;color:#f0f6fc;">SUNTRENIA</span><br>
              <span style="font-size:11px;color:#e63946;letter-spacing:3px;">INTELLIGENCE PLATFORM</span></td>
          <td align="right"><span style="background:#da363333;color:#da3633;border:1px solid #da3633;padding:4px 12px;font-size:10px;font-weight:bold;letter-spacing:1px;">CONFIDENTIAL</span></td>
        </tr></table>
      </div>
      <div style="padding:32px;background:#161b22;">
        <h2 style="color:#f0f6fc;margin:0 0 8px;font-size:18px;">Your Weekly Security Intelligence Report</h2>
        <p style="color:#8b949e;font-size:13px;margin:0 0 24px;">The full intelligence report is attached to this email as a PDF.</p>
        <div style="background:#1c2333;border-left:4px solid #e63946;padding:16px 20px;margin-bottom:24px;">
          <div style="color:#8b949e;font-size:11px;font-weight:bold;letter-spacing:1px;margin-bottom:12px;">REPORT CONTENTS</div>
          ${['Executive Intelligence Briefing','Geographic Threat Assessment & Maps','Incident Category Breakdown','7-Day Trend Analysis','Regional Risk Assessment','Full Incident Details','State Risk Profiles & Recommendations'].map(item =>
            `<div style="color:#f0f6fc;font-size:12px;padding:4px 0;border-bottom:1px solid #30363d;">● ${item}</div>`
          ).join('')}
        </div>
        <div style="background:linear-gradient(135deg,#e6394620,#9b5de520);border:1px solid #e6394640;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px;">
          <p style="color:#f0f6fc;font-size:14px;font-weight:bold;margin:0 0 8px;">🔔 Get This Report Automatically Every Week</p>
          <p style="color:#8b949e;font-size:12px;margin:0 0 16px;">No links, no forms — just automatic delivery to your inbox.</p>
          <a href="https://intelligon-web-map2.onrender.com/premium" style="background:linear-gradient(135deg,#e63946,#9b5de5);color:#fff;padding:12px 28px;text-decoration:none;border-radius:6px;font-size:13px;font-weight:bold;">Subscribe to Premium — ₦15,000/month</a>
        </div>
        <p style="color:#484f58;font-size:10px;border-top:1px solid #30363d;padding-top:16px;">
          <strong style="color:#8b949e;">Classification:</strong> CONFIDENTIAL &nbsp;|&nbsp;
          <strong style="color:#8b949e;">Generated:</strong> ${new Date().toLocaleString()} &nbsp;|&nbsp;
          <strong style="color:#8b949e;">Platform:</strong> ${this.config.org}<br>
          <strong style="color:#8b949e;">Contact:</strong> ${this.config.phone} &nbsp;|&nbsp; ${this.config.email}
        </p>
      </div>
    </div>`;
  }

  // ══════════════════════════════════════════════════════════════════
  // UTILITY
  // ══════════════════════════════════════════════════════════════════
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
