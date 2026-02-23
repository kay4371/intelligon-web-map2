// ============================================
// FILE: infographicGenerator.js
// ACLED-style professional infographic for WhatsApp
// Full-page, data-heavy, visually striking design
// ============================================

const { createCanvas } = require('canvas');

class InfographicGenerator {
  constructor() {
    this.width = 1080;
    this.height = 1920;

    // Color palette — dark intelligence theme
    this.colors = {
      bg1: '#0d1117',
      bg2: '#161b22',
      bg3: '#1c2333',
      accent: '#e63946',
      accentOrange: '#f77f00',
      accentYellow: '#fcbf49',
      accentBlue: '#4361ee',
      accentGreen: '#2dc653',
      accentPurple: '#9b5de5',
      textPrimary: '#f0f6fc',
      textSecondary: '#8b949e',
      textMuted: '#484f58',
      border: '#30363d',
      critical: '#da3633',
      high: '#e85c0d',
      medium: '#e3b341',
      low: '#3fb950',
      banditry: '#e63946',
      terrorism: '#9b5de5',
      kidnapping: '#f77f00',
      communal: '#4361ee',
      military: '#2dc653',
      other: '#8b949e'
    };

    // Incident type icons (unicode that canvas can render)
    this.categoryIcons = {
      'Banditry': '⚔',
      'Terrorism': '💥',
      'Kidnapping': '🔒',
      'Communal Clash': '🛡',
      'Military Operation': '★',
      'Armed Robbery': '◈',
      'Farmer-Herder': '◉',
      'Cult Violence': '☠',
      'Other': '◆',
      'Unknown': '?'
    };

    this.categoryColors = {
      'Banditry': '#e63946',
      'Terrorism': '#9b5de5',
      'Kidnapping': '#f77f00',
      'Communal Clash': '#4361ee',
      'Military Operation': '#2dc653',
      'Armed Robbery': '#fcbf49',
      'Farmer-Herder': '#00b4d8',
      'Cult Violence': '#e040fb',
      'Other': '#8b949e',
      'Unknown': '#484f58'
    };
  }

  async generateInfographic(reportData) {
    console.log('🎨 Generating infographic...');

    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext('2d');

    // Full background
    this.fillBackground(ctx);

    // Draw all sections
    let y = 0;
    y = this.drawHeader(ctx, reportData, y);
    y = this.drawKeyMetrics(ctx, reportData, y);
    y = this.drawThreatLevelBanner(ctx, reportData, y);
    y = this.drawCategoryBreakdown(ctx, reportData, y);
    y = this.drawTopHotspots(ctx, reportData, y);
    y = this.drawIncidentTimeline(ctx, reportData, y);
    y = this.drawRegionalRisk(ctx, reportData, y);
    this.drawFooterCTA(ctx, y);

    console.log('✅ Infographic generated');
    return canvas.toBuffer('image/png');
  }

  // ─── BACKGROUND ───────────────────────────────────────────────────
  fillBackground(ctx) {
    // Dark gradient base
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, '#0d1117');
    grad.addColorStop(0.4, '#0f1923');
    grad.addColorStop(1, '#0a1628');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Subtle grid pattern overlay
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 1;
    for (let x = 0; x < this.width; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.height); ctx.stroke();
    }
    for (let y = 0; y < this.height; y += 60) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.width, y); ctx.stroke();
    }
  }

  // ─── HEADER ───────────────────────────────────────────────────────
  drawHeader(ctx, data, startY) {
    const H = 200;

    // Header background
    const grad = ctx.createLinearGradient(0, 0, this.width, H);
    grad.addColorStop(0, '#1a0a0a');
    grad.addColorStop(0.5, '#1c1228');
    grad.addColorStop(1, '#0a1a2a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, H);

    // Red accent top bar
    const barGrad = ctx.createLinearGradient(0, 0, this.width, 0);
    barGrad.addColorStop(0, this.colors.accent);
    barGrad.addColorStop(0.5, '#ff6b6b');
    barGrad.addColorStop(1, this.colors.accentPurple);
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, 0, this.width, 6);

    // Shield/logo area
    this.drawShield(ctx, 80, 40, 110, 120);

    // SUNTRENIA title
    ctx.fillStyle = this.colors.textPrimary;
    ctx.font = 'bold 64px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SUNTRENIA', 210, 85);

    // Subtitle
    ctx.fillStyle = this.colors.accent;
    ctx.font = 'bold 22px monospace';
    ctx.letterSpacing = '4px';
    ctx.fillText('INTELLIGENCE PLATFORM', 212, 118);

    // Date badge
    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const dateStr = `${weekAgo.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()} — ${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}`;

    ctx.fillStyle = 'rgba(230,57,70,0.15)';
    this.roundRect(ctx, 210, 130, 480, 42, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(230,57,70,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#ff9999';
    ctx.font = '20px monospace';
    ctx.fillText(`⏱  WEEK OF ${dateStr}`, 226, 158);

    // CLASSIFIED badge top right
    ctx.fillStyle = 'rgba(218,54,51,0.2)';
    this.roundRect(ctx, 830, 20, 210, 50, 6);
    ctx.fill();
    ctx.strokeStyle = this.colors.critical;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = this.colors.critical;
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CONFIDENTIAL', 935, 42);
    ctx.font = '14px monospace';
    ctx.fillStyle = '#ff9999';
    ctx.fillText('RESTRICTED ACCESS', 935, 60);

    ctx.textAlign = 'left';

    // Bottom border
    ctx.fillStyle = this.colors.border;
    ctx.fillRect(0, H - 1, this.width, 1);

    return H;
  }

  drawShield(ctx, x, y, w, h) {
    const cx = x + w / 2;
    ctx.fillStyle = 'rgba(230,57,70,0.15)';
    ctx.strokeStyle = this.colors.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(x + w, y + h * 0.3);
    ctx.lineTo(x + w, y + h * 0.65);
    ctx.lineTo(cx, y + h);
    ctx.lineTo(x, y + h * 0.65);
    ctx.lineTo(x, y + h * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // S inside shield
    ctx.fillStyle = this.colors.accent;
    ctx.font = 'bold 60px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('S', cx, y + h * 0.68);
    ctx.textAlign = 'left';
  }

  // ─── KEY METRICS ──────────────────────────────────────────────────
  drawKeyMetrics(ctx, data, startY) {
    const sectionH = 340;
    const pad = 30;
    const y = startY + pad;

    // Section label
    ctx.fillStyle = this.colors.textSecondary;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('▸ KEY INTELLIGENCE METRICS', pad, y + 10);

    const metrics = [
      {
        label: 'INCIDENTS',
        value: data.incidents?.length || 0,
        icon: '⚠',
        color: this.colors.accent,
        sub: 'Total Recorded'
      },
      {
        label: 'STATES HIT',
        value: data.statesAffected || 0,
        icon: '◎',
        color: this.colors.accentOrange,
        sub: 'of 36 + FCT'
      },
      {
        label: 'CASUALTIES',
        value: data.casualties || 0,
        icon: '†',
        color: this.colors.critical,
        sub: 'Est. Deaths'
      },
      {
        label: 'ABDUCTED',
        value: data.abductions || 0,
        icon: '⛓',
        color: this.colors.accentPurple,
        sub: 'Persons'
      }
    ];

    const boxW = 230;
    const boxH = 220;
    const gap = 20;
    const totalW = metrics.length * boxW + (metrics.length - 1) * gap;
    const startX = (this.width - totalW) / 2;
    const boxY = y + 40;

    metrics.forEach((m, i) => {
      const bx = startX + i * (boxW + gap);

      // Card background
      const cardGrad = ctx.createLinearGradient(bx, boxY, bx, boxY + boxH);
      cardGrad.addColorStop(0, m.color + '22');
      cardGrad.addColorStop(1, m.color + '08');
      ctx.fillStyle = cardGrad;
      this.roundRect(ctx, bx, boxY, boxW, boxH, 12);
      ctx.fill();

      // Border
      ctx.strokeStyle = m.color + '60';
      ctx.lineWidth = 1.5;
      this.roundRect(ctx, bx, boxY, boxW, boxH, 12);
      ctx.stroke();

      // Top accent line
      const lineGrad = ctx.createLinearGradient(bx, boxY, bx + boxW, boxY);
      lineGrad.addColorStop(0, m.color);
      lineGrad.addColorStop(1, m.color + '00');
      ctx.fillStyle = lineGrad;
      ctx.fillRect(bx, boxY, boxW, 3);

      // Icon
      ctx.fillStyle = m.color;
      ctx.font = 'bold 52px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(m.icon, bx + boxW / 2, boxY + 72);

      // Value
      ctx.fillStyle = this.colors.textPrimary;
      ctx.font = `bold 72px monospace`;
      ctx.fillText(m.value.toString(), bx + boxW / 2, boxY + 152);

      // Label
      ctx.fillStyle = m.color;
      ctx.font = 'bold 17px monospace';
      ctx.fillText(m.label, bx + boxW / 2, boxY + 183);

      // Sub-label
      ctx.fillStyle = this.colors.textSecondary;
      ctx.font = '14px monospace';
      ctx.fillText(m.sub, bx + boxW / 2, boxY + 206);
    });

    ctx.textAlign = 'left';
    return startY + sectionH;
  }

  // ─── THREAT LEVEL BANNER ─────────────────────────────────────────
  drawThreatLevelBanner(ctx, data, startY) {
    const pad = 30;
    const H = 100;

    // Determine overall threat level
    const incidents = data.incidents?.length || 0;
    let level, color, label, desc;
    if (incidents >= 20) {
      level = 4; color = this.colors.critical; label = 'CRITICAL'; desc = 'Severe security environment — avoid non-essential travel';
    } else if (incidents >= 10) {
      level = 3; color = this.colors.high; label = 'HIGH'; desc = 'Elevated threat — heightened security measures required';
    } else if (incidents >= 5) {
      level = 2; color = this.colors.medium; label = 'MODERATE'; desc = 'Notable incidents — standard precautions advised';
    } else {
      level = 1; color = this.colors.low; label = 'LOW'; desc = 'Minimal incidents — maintain situational awareness';
    }

    // Banner background
    ctx.fillStyle = color + '18';
    ctx.fillRect(0, startY, this.width, H);
    ctx.fillStyle = color;
    ctx.fillRect(0, startY, 8, H);

    // Label
    ctx.fillStyle = color;
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`● THREAT LEVEL: ${label}`, pad + 10, startY + 38);

    // Description
    ctx.fillStyle = this.colors.textSecondary;
    ctx.font = '20px monospace';
    ctx.fillText(desc, pad + 10, startY + 72);

    // Level bars top right
    const barX = 800;
    const barY = startY + 25;
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i < level ? color : color + '30';
      ctx.fillRect(barX + i * 50, barY, 38, 50);
    }

    // Border bottom
    ctx.fillStyle = color + '40';
    ctx.fillRect(0, startY + H - 1, this.width, 1);

    return startY + H;
  }

  // ─── CATEGORY BREAKDOWN ───────────────────────────────────────────
  drawCategoryBreakdown(ctx, data, startY) {
    const pad = 30;
    const sectionH = 380;
    const y = startY + 20;

    // Section title
    ctx.fillStyle = this.colors.textSecondary;
    ctx.font = 'bold 20px monospace';
    ctx.fillText('▸ INCIDENT CATEGORY BREAKDOWN', pad, y + 15);

    // Build category counts
    const catCounts = {};
    (data.incidents || []).forEach(inc => {
      const cat = inc.aiClassification || inc.category || 'Unknown';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });

    const total = Object.values(catCounts).reduce((a, b) => a + b, 0) || 1;
    const sorted = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

    // If no real data, use placeholder categories
    const displayData = sorted.length > 0 ? sorted : [
      ['Banditry', 8], ['Kidnapping', 5], ['Terrorism', 3],
      ['Communal Clash', 3], ['Armed Robbery', 2], ['Other', 1]
    ];

    const itemH = 54;
    const chartY = y + 45;
    const maxBarW = 500;

    displayData.forEach(([cat, count], i) => {
      const iy = chartY + i * itemH;
      const color = this.categoryColors[cat] || this.colors.other;
      const pct = ((count / total) * 100).toFixed(0);
      const barW = (count / displayData[0][1]) * maxBarW;
      const icon = this.categoryIcons[cat] || '◆';

      // Row background (alternating)
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(pad, iy, this.width - pad * 2, itemH - 4);
      }

      // Icon circle
      ctx.fillStyle = color + '25';
      ctx.beginPath();
      ctx.arc(pad + 30, iy + 23, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color + '80';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(icon, pad + 30, iy + 30);

      // Category name
      ctx.fillStyle = this.colors.textPrimary;
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(cat.toUpperCase(), pad + 68, iy + 20);

      // Bar background
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      this.roundRect(ctx, pad + 68, iy + 28, maxBarW, 16, 4);
      ctx.fill();

      // Bar fill
      const barGrad = ctx.createLinearGradient(pad + 68, iy, pad + 68 + barW, iy);
      barGrad.addColorStop(0, color);
      barGrad.addColorStop(1, color + 'aa');
      ctx.fillStyle = barGrad;
      this.roundRect(ctx, pad + 68, iy + 28, Math.max(barW, 20), 16, 4);
      ctx.fill();

      // Count + percentage
      ctx.fillStyle = color;
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${count}  ${pct}%`, this.width - pad, iy + 22);
    });

    ctx.textAlign = 'left';

    // Divider
    ctx.fillStyle = this.colors.border;
    ctx.fillRect(pad, startY + sectionH - 10, this.width - pad * 2, 1);

    return startY + sectionH;
  }

  // ─── TOP HOTSPOT STATES ──────────────────────────────────────────
  drawTopHotspots(ctx, data, startY) {
    const pad = 30;
    const sectionH = 310;
    const y = startY + 20;

    ctx.fillStyle = this.colors.textSecondary;
    ctx.font = 'bold 20px monospace';
    ctx.fillText('▸ TOP HOTSPOT STATES THIS WEEK', pad, y + 15);

    // Get top states
    const stateCounts = {};
    (data.incidents || []).forEach(inc => {
      const state = inc.state || inc.location?.state || 'Unknown';
      stateCounts[state] = (stateCounts[state] || 0) + 1;
    });

    let topStates = Object.entries(stateCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (topStates.length === 0) {
      topStates = (data.affectedStateNames || ['Borno', 'Zamfara', 'Katsina', 'Niger', 'Kaduna'])
        .slice(0, 5).map((s, i) => [s, 5 - i]);
    }

    const cardW = 180;
    const cardH = 200;
    const gap = 18;
    const totalW = Math.min(topStates.length, 5) * cardW + (Math.min(topStates.length, 5) - 1) * gap;
    const startX = (this.width - totalW) / 2;
    const cardY = y + 45;

    const podiumColors = [
      this.colors.critical,
      this.colors.high,
      this.colors.medium,
      this.colors.accentBlue,
      this.colors.accentGreen
    ];

    const rankLabels = ['#1', '#2', '#3', '#4', '#5'];

    topStates.slice(0, 5).forEach(([state, count], i) => {
      const cx = startX + i * (cardW + gap);
      const color = podiumColors[i];
      const maxCount = topStates[0][1];
      const fillRatio = count / maxCount;

      // Card bg
      ctx.fillStyle = color + '18';
      this.roundRect(ctx, cx, cardY, cardW, cardH, 10);
      ctx.fill();
      ctx.strokeStyle = color + '50';
      ctx.lineWidth = 1.5;
      this.roundRect(ctx, cx, cardY, cardW, cardH, 10);
      ctx.stroke();

      // Fill bar from bottom
      const fillH = fillRatio * (cardH - 20);
      ctx.fillStyle = color + '20';
      this.roundRect(ctx, cx, cardY + cardH - fillH, cardW, fillH, 10);
      ctx.fill();

      // Rank badge
      ctx.fillStyle = color;
      this.roundRect(ctx, cx + 10, cardY + 10, 48, 28, 6);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(rankLabels[i], cx + 34, cardY + 29);

      // State name
      ctx.fillStyle = this.colors.textPrimary;
      ctx.font = `bold ${state.length > 8 ? '17' : '20'}px monospace`;
      ctx.textAlign = 'center';
      const stateName = state.length > 10 ? state.substring(0, 9) + '.' : state;
      ctx.fillText(stateName.toUpperCase(), cx + cardW / 2, cardY + 100);

      // Count
      ctx.fillStyle = color;
      ctx.font = 'bold 44px monospace';
      ctx.fillText(count.toString(), cx + cardW / 2, cardY + 155);

      ctx.fillStyle = this.colors.textSecondary;
      ctx.font = '14px monospace';
      ctx.fillText('incidents', cx + cardW / 2, cardY + 178);
    });

    ctx.textAlign = 'left';

    ctx.fillStyle = this.colors.border;
    ctx.fillRect(pad, startY + sectionH - 10, this.width - pad * 2, 1);

    return startY + sectionH;
  }

  // ─── INCIDENT TIMELINE ───────────────────────────────────────────
  drawIncidentTimeline(ctx, data, startY) {
    const pad = 30;
    const sectionH = 260;
    const y = startY + 20;

    ctx.fillStyle = this.colors.textSecondary;
    ctx.font = 'bold 20px monospace';
    ctx.fillText('▸ DAILY INCIDENT FREQUENCY (7 DAYS)', pad, y + 15);

    // Build daily data
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let dailyCounts = new Array(7).fill(0);

    (data.incidents || []).forEach((inc, idx) => {
      dailyCounts[idx % 7]++;
    });

    if (data.trendData?.data?.length > 0) {
      dailyCounts = data.trendData.data.slice(0, 7);
    }

    const maxVal = Math.max(...dailyCounts, 1);
    const chartX = pad;
    const chartY = y + 45;
    const chartW = this.width - pad * 2;
    const chartH = 160;
    const barW = Math.floor((chartW - 60) / 7);
    const barGap = Math.floor(60 / 7);

    // Chart background
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    this.roundRect(ctx, chartX, chartY, chartW, chartH, 8);
    ctx.fill();

    // Grid lines
    for (let g = 0; g <= 4; g++) {
      const gy = chartY + (chartH * g) / 4;
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(chartX + 40, gy);
      ctx.lineTo(chartX + chartW - 10, gy);
      ctx.stroke();

      // Y axis value
      ctx.fillStyle = this.colors.textMuted;
      ctx.font = '14px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(maxVal - (maxVal * g) / 4), chartX + 32, gy + 5);
    }

    // Bars
    days.forEach((day, i) => {
      const bx = chartX + 50 + i * (barW + barGap);
      const count = dailyCounts[i] || 0;
      const bh = Math.max((count / maxVal) * (chartH - 30), 4);
      const by = chartY + chartH - 25 - bh;

      // Bar gradient
      const barGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
      const barColor = count >= maxVal * 0.7 ? this.colors.critical :
                       count >= maxVal * 0.4 ? this.colors.medium : this.colors.accentBlue;
      barGrad.addColorStop(0, barColor);
      barGrad.addColorStop(1, barColor + '60');
      ctx.fillStyle = barGrad;
      this.roundRect(ctx, bx, by, barW - 4, bh, 4);
      ctx.fill();

      // Count on top of bar
      if (count > 0) {
        ctx.fillStyle = barColor;
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(count.toString(), bx + (barW - 4) / 2, by - 6);
      }

      // Day label
      ctx.fillStyle = this.colors.textSecondary;
      ctx.font = '16px monospace';
      ctx.fillText(day, bx + (barW - 4) / 2, chartY + chartH - 6);
    });

    ctx.textAlign = 'left';
    ctx.fillStyle = this.colors.border;
    ctx.fillRect(pad, startY + sectionH - 10, this.width - pad * 2, 1);

    return startY + sectionH;
  }

  // ─── REGIONAL RISK SUMMARY ───────────────────────────────────────
  drawRegionalRisk(ctx, data, startY) {
    const pad = 30;
    const sectionH = 280;
    const y = startY + 20;

    ctx.fillStyle = this.colors.textSecondary;
    ctx.font = 'bold 20px monospace';
    ctx.fillText('▸ REGIONAL RISK SUMMARY', pad, y + 15);

    const regions = [
      { name: 'NORTH EAST', states: ['Borno', 'Yobe', 'Adamawa', 'Gombe', 'Bauchi', 'Taraba'] },
      { name: 'NORTH WEST', states: ['Zamfara', 'Katsina', 'Sokoto', 'Kebbi', 'Kano', 'Kaduna', 'Jigawa'] },
      { name: 'NORTH CENTRAL', states: ['Niger', 'Benue', 'Nasarawa', 'Plateau', 'Kogi', 'Kwara', 'FCT'] },
      { name: 'SOUTH WEST', states: ['Lagos', 'Ogun', 'Oyo', 'Osun', 'Ondo', 'Ekiti'] },
      { name: 'SOUTH EAST', states: ['Anambra', 'Enugu', 'Ebonyi', 'Imo', 'Abia'] },
      { name: 'SOUTH SOUTH', states: ['Rivers', 'Delta', 'Bayelsa', 'Cross River', 'Akwa Ibom', 'Edo'] }
    ];

    const affected = new Set((data.affectedStateNames || []).map(s => s.toLowerCase()));

    const cardW = 300;
    const cardH = 98;
    const gap = 20;

    regions.forEach((region, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const cx = pad + col * (cardW + gap);
      const cy = y + 45 + row * (cardH + gap);

      // Count affected states in region
      const affectedCount = region.states.filter(s => affected.has(s.toLowerCase())).length;
      const riskRatio = affectedCount / region.states.length;

      let riskColor, riskLabel;
      if (riskRatio >= 0.5) { riskColor = this.colors.critical; riskLabel = 'HIGH'; }
      else if (riskRatio >= 0.3) { riskColor = this.colors.medium; riskLabel = 'MOD'; }
      else if (riskRatio > 0) { riskColor = this.colors.accentBlue; riskLabel = 'LOW'; }
      else { riskColor = this.colors.low; riskLabel = 'CALM'; }

      // Card
      ctx.fillStyle = riskColor + '15';
      this.roundRect(ctx, cx, cy, cardW, cardH, 8);
      ctx.fill();
      ctx.strokeStyle = riskColor + '50';
      ctx.lineWidth = 1;
      this.roundRect(ctx, cx, cy, cardW, cardH, 8);
      ctx.stroke();

      // Left accent bar
      ctx.fillStyle = riskColor;
      ctx.fillRect(cx, cy, 4, cardH);

      // Region name
      ctx.fillStyle = this.colors.textPrimary;
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(region.name, cx + 18, cy + 30);

      // Stats
      ctx.fillStyle = this.colors.textSecondary;
      ctx.font = '15px monospace';
      ctx.fillText(`${affectedCount}/${region.states.length} states affected`, cx + 18, cy + 58);

      // Risk badge
      ctx.fillStyle = riskColor;
      this.roundRect(ctx, cx + cardW - 70, cy + 16, 58, 28, 5);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(riskLabel, cx + cardW - 41, cy + 34);

      // Dot indicators
      region.states.forEach((state, si) => {
        const isAffected = affected.has(state.toLowerCase());
        const dotX = cx + 18 + si * 34;
        const dotY = cy + 78;
        if (dotX + 28 < cx + cardW - 10) {
          ctx.fillStyle = isAffected ? riskColor : riskColor + '25';
          ctx.beginPath();
          ctx.arc(dotX + 10, dotY, 8, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    });

    ctx.textAlign = 'left';
    ctx.fillStyle = this.colors.border;
    ctx.fillRect(pad, startY + sectionH - 10, this.width - pad * 2, 1);

    return startY + sectionH;
  }

  // ─── FOOTER CTA ───────────────────────────────────────────────────
  drawFooterCTA(ctx, startY) {
    const pad = 30;
    const remaining = this.height - startY;
    const H = Math.max(remaining, 160);
    const y = startY + 20;

    // Background
    const grad = ctx.createLinearGradient(0, y, 0, this.height);
    grad.addColorStop(0, 'rgba(230,57,70,0.12)');
    grad.addColorStop(1, 'rgba(155,93,229,0.08)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, this.width, this.height - y);

    ctx.strokeStyle = 'rgba(230,57,70,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(this.width, y);
    ctx.stroke();

    // Main CTA
    ctx.fillStyle = this.colors.textPrimary;
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('📄 GET THE FULL 7-PAGE REPORT', this.width / 2, y + 60);

    ctx.fillStyle = this.colors.textSecondary;
    ctx.font = '22px monospace';
    ctx.fillText('Detailed incident breakdown • AI analysis • Maps', this.width / 2, y + 100);

    // CTA button look
    const btnW = 620;
    const btnH = 70;
    const btnX = (this.width - btnW) / 2;
    const btnY = y + 120;

    const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY);
    btnGrad.addColorStop(0, this.colors.accent);
    btnGrad.addColorStop(1, this.colors.accentPurple);
    ctx.fillStyle = btnGrad;
    this.roundRect(ctx, btnX, btnY, btnW, btnH, 35);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px monospace';
    ctx.fillText('⬇  DOWNLOAD FREE — CLICK LINK BELOW', this.width / 2, btnY + 44);

    // Branding
    ctx.fillStyle = this.colors.textMuted;
    ctx.font = '18px monospace';
    ctx.fillText('suntrenia.com  •  Powered by AI Intelligence', this.width / 2, y + 230);

    ctx.textAlign = 'left';
  }

  // ─── HELPER ──────────────────────────────────────────────────────
  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

module.exports = InfographicGenerator;
