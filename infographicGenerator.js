// ============================================
// FILE: infographicGenerator.js
// Puppeteer-based infographic generator
// Beautiful, responsive charts with proper graphics
// ============================================

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;

class InfographicGenerator {
  constructor() {
    this.width = 1080;
    this.height = 1920;
    
    // Color palette
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
      low: '#3fb950'
    };

    this.categoryColors = {
      'Not crossing at crosswalk': '#e63946',
      'Crossing at crosswalk': '#4361ee',
      'Moving w/ traffic on roadway': '#f77f00',
      'Moving against traffic on roadway': '#9b5de5',
      'Standing in roadway': '#fcbf49',
      'Pushing or working on a vehicle': '#2dc653'
    };
  }

  async generateInfographic(reportData) {
    console.log('🎨 Generating infographic with Puppeteer...');

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: this.width, height: this.height });

      // Generate HTML content with embedded charts
      const html = this.generateHTML(reportData);
      
      // Set content and wait for all charts to render
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      // Wait for Chart.js to initialize
      await page.waitForFunction(() => {
        return typeof window.Chart !== 'undefined';
      });

      // Take screenshot
      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: true,
        omitBackground: true
      });

      console.log('✅ Infographic generated successfully');
      return screenshot;

    } finally {
      await browser.close();
    }
  }

  generateHTML(data) {
    const { pedestrianData = this.getDefaultPedestrianData() } = data;
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Pedestrian Safety Report</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels"></script>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }

        body {
          width: 1080px;
          min-height: 1920px;
          background: linear-gradient(135deg, #0d1117 0%, #0f1923 50%, #0a1628 100%);
          padding: 40px;
          position: relative;
        }

        /* Grid overlay */
        body::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: 
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 60px 60px;
          pointer-events: none;
        }

        /* Header Styles */
        .header {
          background: linear-gradient(135deg, #1a0a0a 0%, #1c1228 50%, #0a1a2a 100%);
          border-radius: 20px;
          padding: 30px;
          margin-bottom: 40px;
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(230,57,70,0.3);
        }

        .header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, #e63946, #ff6b6b, #9b5de5);
        }

        .header-content {
          display: flex;
          align-items: center;
          gap: 30px;
        }

        .shield {
          width: 100px;
          height: 120px;
          background: rgba(230,57,70,0.15);
          border: 2px solid #e63946;
          clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 48px;
          font-weight: bold;
          color: #e63946;
        }

        .title-area {
          flex: 1;
        }

        .title-area h1 {
          font-size: 48px;
          font-weight: 800;
          color: #f0f6fc;
          margin-bottom: 5px;
          letter-spacing: 2px;
        }

        .title-area .subtitle {
          font-size: 18px;
          color: #e63946;
          letter-spacing: 3px;
          margin-bottom: 15px;
        }

        .date-badge {
          display: inline-block;
          background: rgba(230,57,70,0.15);
          border: 1px solid rgba(230,57,70,0.4);
          border-radius: 30px;
          padding: 8px 20px;
          color: #ff9999;
          font-size: 14px;
          font-weight: 500;
        }

        .confidential {
          position: absolute;
          top: 20px;
          right: 30px;
          background: rgba(218,54,51,0.2);
          border: 1.5px solid #da3633;
          border-radius: 8px;
          padding: 10px 20px;
          text-align: center;
        }

        .confidential .label {
          color: #da3633;
          font-size: 14px;
          font-weight: bold;
          letter-spacing: 1px;
        }

        .confidential .restricted {
          color: #ff9999;
          font-size: 11px;
        }

        /* Metrics Grid */
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 30px;
        }

        .metric-card {
          background: linear-gradient(135deg, rgba(230,57,70,0.1) 0%, rgba(230,57,70,0.02) 100%);
          border: 1px solid rgba(230,57,70,0.3);
          border-radius: 16px;
          padding: 25px 20px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }

        .metric-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #e63946, #ff6b6b);
        }

        .metric-icon {
          font-size: 48px;
          margin-bottom: 15px;
        }

        .metric-value {
          font-size: 72px;
          font-weight: 800;
          color: #f0f6fc;
          line-height: 1;
          margin-bottom: 5px;
        }

        .metric-label {
          font-size: 16px;
          font-weight: 600;
          color: #e63946;
          letter-spacing: 1px;
          margin-bottom: 5px;
        }

        .metric-sub {
          font-size: 12px;
          color: #8b949e;
        }

        /* Threat Level Banner */
        .threat-banner {
          background: linear-gradient(90deg, rgba(218,54,51,0.1) 0%, rgba(218,54,51,0.05) 100%);
          border-left: 6px solid #da3633;
          border-radius: 12px;
          padding: 20px 30px;
          margin-bottom: 40px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .threat-content {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .threat-icon {
          font-size: 32px;
          color: #da3633;
        }

        .threat-text {
          color: #da3633;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: 2px;
        }

        .threat-desc {
          color: #8b949e;
          font-size: 16px;
        }

        .level-bars {
          display: flex;
          gap: 8px;
        }

        .level-bar {
          width: 40px;
          height: 60px;
          background: rgba(218,54,51,0.2);
          border-radius: 4px;
        }

        .level-bar.active {
          background: #da3633;
        }

        /* Section Styles */
        .section {
          margin-bottom: 40px;
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 20px;
        }

        .section-title .indicator {
          width: 4px;
          height: 24px;
          background: #e63946;
          border-radius: 2px;
        }

        .section-title h2 {
          font-size: 18px;
          font-weight: 600;
          color: #8b949e;
          letter-spacing: 1.5px;
          text-transform: uppercase;
        }

        .section-divider {
          height: 1px;
          background: linear-gradient(90deg, #30363d, transparent);
          margin: 30px 0;
        }

        /* Chart Container */
        .chart-container {
          background: rgba(22, 27, 34, 0.7);
          border: 1px solid #30363d;
          border-radius: 16px;
          padding: 25px;
          backdrop-filter: blur(10px);
        }

        .chart-wrapper {
          height: 300px;
          margin-bottom: 20px;
        }

        /* Bar Chart */
        .bar-chart {
          display: flex;
          align-items: flex-end;
          justify-content: space-around;
          height: 300px;
          margin: 20px 0 40px;
          gap: 10px;
        }

        .bar-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .bar {
          width: 100%;
          background: linear-gradient(180deg, #e63946 0%, #9b5de5 100%);
          border-radius: 8px 8px 0 0;
          transition: height 0.3s ease;
          min-height: 4px;
        }

        .bar-value {
          color: #e63946;
          font-weight: bold;
          font-size: 14px;
        }

        .bar-label {
          color: #8b949e;
          font-size: 12px;
          text-transform: uppercase;
        }

        /* Category List */
        .category-list {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .category-item {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 10px;
          background: rgba(255,255,255,0.02);
          border-radius: 8px;
        }

        .category-icon {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          border: 1.5px solid;
        }

        .category-name {
          flex: 1;
          font-weight: 600;
          color: #f0f6fc;
          font-size: 14px;
        }

        .category-bar-container {
          flex: 2;
          height: 16px;
          background: rgba(255,255,255,0.06);
          border-radius: 8px;
          overflow: hidden;
        }

        .category-bar {
          height: 100%;
          background: linear-gradient(90deg, var(--bar-color), var(--bar-color-light));
          border-radius: 8px;
        }

        .category-stats {
          min-width: 80px;
          text-align: right;
          color: var(--bar-color);
          font-weight: bold;
          font-size: 14px;
        }

        /* Hotspot Grid */
        .hotspot-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 15px;
          margin-top: 20px;
        }

        .hotspot-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid;
          border-radius: 12px;
          padding: 20px 10px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }

        .hotspot-rank {
          position: absolute;
          top: 10px;
          left: 10px;
          background: currentColor;
          color: #fff;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
        }

        .hotspot-name {
          font-weight: 600;
          color: #f0f6fc;
          margin: 15px 0 5px;
          font-size: 14px;
        }

        .hotspot-value {
          font-size: 44px;
          font-weight: 800;
          color: currentColor;
          line-height: 1;
        }

        .hotspot-label {
          font-size: 11px;
          color: #8b949e;
          margin-top: 5px;
        }

        /* Footer */
        .footer {
          margin-top: 60px;
          padding: 30px;
          background: linear-gradient(180deg, rgba(230,57,70,0.05) 0%, transparent 100%);
          border-top: 1px solid #30363d;
          text-align: center;
        }

        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #e63946, #9b5de5);
          padding: 20px 60px;
          border-radius: 40px;
          color: white;
          font-size: 24px;
          font-weight: bold;
          text-decoration: none;
          margin: 20px 0;
          border: none;
          cursor: pointer;
        }

        .footer-text {
          color: #484f58;
          font-size: 12px;
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <!-- Header -->
      <div class="header">
        <div class="header-content">
          <div class="shield">P</div>
          <div class="title-area">
            <h1>PEDESTRIAN SAFETY</h1>
            <div class="subtitle">ATHENS-CLARKE COUNTY</div>
            <div class="date-badge">JANUARY 2017 — DECEMBER 2021</div>
          </div>
        </div>
        <div class="confidential">
          <div class="label">CONFIDENTIAL</div>
          <div class="restricted">RESTRICTED ACCESS</div>
        </div>
      </div>

      <!-- Key Metrics -->
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-icon">⚠️</div>
          <div class="metric-value">17</div>
          <div class="metric-label">PEDESTRIAN DEATHS</div>
          <div class="metric-sub">Fatalities</div>
        </div>
        <div class="metric-card">
          <div class="metric-icon">🏥</div>
          <div class="metric-value">40</div>
          <div class="metric-label">SERIOUS INJURIES</div>
          <div class="metric-sub">Hospitalized</div>
        </div>
        <div class="metric-card">
          <div class="metric-icon">📊</div>
          <div class="metric-value">292</div>
          <div class="metric-label">CASUALTIES</div>
          <div class="metric-sub">Total Affected</div>
        </div>
        <div class="metric-card">
          <div class="metric-icon">🚗</div>
          <div class="metric-value">41</div>
          <div class="metric-label">CRASHES</div>
          <div class="metric-sub">Involving Pedestrians</div>
        </div>
      </div>

      <!-- Fatalities & Serious Injuries Chart -->
      <div class="section">
        <div class="section-title">
          <div class="indicator"></div>
          <h2>PEDESTRIAN FATALITIES & SERIOUS INJURIES (2017-2021)</h2>
        </div>
        <div class="chart-container">
          <div class="chart-wrapper">
            <canvas id="injuriesChart"></canvas>
          </div>
        </div>
      </div>

      <!-- Social Impact Statement -->
      <div style="background: rgba(230,57,70,0.1); border-left: 4px solid #e63946; padding: 25px; border-radius: 12px; margin-bottom: 40px;">
        <div style="color: #f0f6fc; font-size: 18px; font-style: italic; margin-bottom: 10px;">
          "Communities with lower car ownership rates & lower socioeconomic indicators are most affected by pedestrian traffic fatalities."
        </div>
        <div style="color: #8b949e; font-size: 14px; text-align: right;">
          — Analysis of Athens-Clarke County Data
        </div>
      </div>

      <!-- Crashes by Pedestrian Maneuver -->
      <div class="section">
        <div class="section-title">
          <div class="indicator"></div>
          <h2>CRASHES BY PEDESTRIAN MANEUVER</h2>
        </div>
        <div class="chart-container">
          <div class="category-list" id="maneuverList">
            ${this.generateManeuverBars(pedestrianData)}
          </div>
        </div>
      </div>

      <!-- Year-over-Year Trend -->
      <div class="section">
        <div class="section-title">
          <div class="indicator"></div>
          <h2>ANNUAL TREND (2017-2021)</h2>
        </div>
        <div class="chart-container">
          <div class="chart-wrapper">
            <canvas id="trendChart"></canvas>
          </div>
        </div>
      </div>

      <!-- Hotspots -->
      <div class="section">
        <div class="section-title">
          <div class="indicator"></div>
          <h2>HIGH-RISK LOCATIONS</h2>
        </div>
        <div class="hotspot-grid">
          ${this.generateHotspots(pedestrianData)}
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <div style="color: #f0f6fc; font-size: 24px; font-weight: bold; margin-bottom: 20px;">
          📊 FULL SAFETY ANALYSIS REPORT
        </div>
        <div style="color: #8b949e; font-size: 16px; margin-bottom: 20px;">
          Detailed incident breakdown • Location mapping • Safety recommendations
        </div>
        <button class="cta-button">
          ⬇ DOWNLOAD COMPLETE REPORT
        </button>
        <div class="footer-text">
          athensclarke.gov/safety • Data Source: ACCPD • Analysis Period: 2017-2021
        </div>
      </div>

      <script>
        (function() {
          // Wait for DOM to be ready
          setTimeout(() => {
            // Fatalities & Injuries Chart
            const injuriesCtx = document.getElementById('injuriesChart')?.getContext('2d');
            if (injuriesCtx) {
              new Chart(injuriesCtx, {
                type: 'bar',
                data: {
                  labels: ['2017', '2018', '2019', '2020', '2021'],
                  datasets: [
                    {
                      label: 'Fatalities',
                      data: [4, 3, 5, 2, 3],
                      backgroundColor: '#e63946',
                      borderRadius: 6,
                      barPercentage: 0.7
                    },
                    {
                      label: 'Serious Injuries',
                      data: [8, 7, 9, 6, 10],
                      backgroundColor: '#4361ee',
                      borderRadius: 6,
                      barPercentage: 0.7
                    }
                  ]
                },
                options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      labels: { color: '#f0f6fc', font: { size: 12 } }
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      grid: { color: '#30363d' },
                      ticks: { color: '#8b949e' }
                    },
                    x: {
                      grid: { display: false },
                      ticks: { color: '#8b949e' }
                    }
                  }
                }
              });
            }

            // Trend Chart
            const trendCtx = document.getElementById('trendChart')?.getContext('2d');
            if (trendCtx) {
              new Chart(trendCtx, {
                type: 'line',
                data: {
                  labels: ['2017', '2018', '2019', '2020', '2021'],
                  datasets: [{
                    label: 'Total Crashes',
                    data: [12, 10, 14, 8, 13],
                    borderColor: '#e63946',
                    backgroundColor: 'rgba(230,57,70,0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#e63946'
                  }]
                },
                options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { labels: { color: '#f0f6fc' } }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      grid: { color: '#30363d' },
                      ticks: { color: '#8b949e' }
                    },
                    x: {
                      grid: { display: false },
                      ticks: { color: '#8b949e' }
                    }
                  }
                }
              });
            }
          }, 100);
        })();
      </script>
    </body>
    </html>
    `;
  }

  generateManeuverBars(data) {
    const maneuvers = [
      { name: 'Not crossing at crosswalk', count: 22, color: '#e63946' },
      { name: 'Crossing at crosswalk', count: 15, color: '#4361ee' },
      { name: 'Moving w/ traffic on roadway', count: 8, color: '#f77f00' },
      { name: 'Moving against traffic on roadway', count: 6, color: '#9b5de5' },
      { name: 'Standing in roadway', count: 4, color: '#fcbf49' },
      { name: 'Pushing or working on a vehicle', count: 2, color: '#2dc653' }
    ];

    const maxCount = Math.max(...maneuvers.map(m => m.count));

    return maneuvers.map(m => `
      <div class="category-item">
        <div class="category-icon" style="border-color: ${m.color}; color: ${m.color};">
          ${this.getManeuverIcon(m.name)}
        </div>
        <div class="category-name">${m.name}</div>
        <div class="category-bar-container">
          <div class="category-bar" style="--bar-color: ${m.color}; --bar-color-light: ${m.color}80; width: ${(m.count / maxCount) * 100}%"></div>
        </div>
        <div class="category-stats" style="color: ${m.color};">${m.count}</div>
      </div>
    `).join('');
  }

  generateHotspots(data) {
    const hotspots = [
      { location: 'Downtown', count: 12, rank: '#1', color: '#da3633' },
      { location: 'Eastside', count: 9, rank: '#2', color: '#e85c0d' },
      { location: 'Westside', count: 7, rank: '#3', color: '#e3b341' },
      { location: 'North Ave', count: 5, rank: '#4', color: '#4361ee' },
      { location: 'Southside', count: 4, rank: '#5', color: '#2dc653' }
    ];

    return hotspots.map(h => `
      <div class="hotspot-card" style="border-color: ${h.color}40;">
        <div class="hotspot-rank" style="background: ${h.color};">${h.rank}</div>
        <div class="hotspot-name">${h.location}</div>
        <div class="hotspot-value" style="color: ${h.color};">${h.count}</div>
        <div class="hotspot-label">incidents</div>
      </div>
    `).join('');
  }

  getManeuverIcon(maneuver) {
    const icons = {
      'Not crossing at crosswalk': '🚶',
      'Crossing at crosswalk': '🚦',
      'Moving w/ traffic on roadway': '➡️',
      'Moving against traffic on roadway': '⬅️',
      'Standing in roadway': '⛔',
      'Pushing or working on a vehicle': '🔧'
    };
    return icons[maneuver] || '⚠️';
  }

  getDefaultPedestrianData() {
    return {
      fatalities: [4, 3, 5, 2, 3],
      seriousInjuries: [8, 7, 9, 6, 10],
      totalCrashes: [12, 10, 14, 8, 13],
      maneuvers: {
        'Not crossing at crosswalk': 22,
        'Crossing at crosswalk': 15,
        'Moving w/ traffic on roadway': 8,
        'Moving against traffic on roadway': 6,
        'Standing in roadway': 4,
        'Pushing or working on a vehicle': 2
      }
    };
  }
}

module.exports = InfographicGenerator;
