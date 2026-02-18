// ============================================
// FILE: infographicGenerator.js
// Beautiful infographic generator for WhatsApp
// ============================================

const { createCanvas } = require('canvas');

class InfographicGenerator {
  constructor() {
    this.width = 1080;
    this.height = 1920; // Instagram story size
    this.backgroundColor = '#1a1a2e';
    this.accentColor = '#e94560';
    this.textColor = '#ffffff';
  }

  /**
   * ✅ MAIN: Generate beautiful infographic from report data
   */
  async generateInfographic(reportData) {
    console.log('🎨 Generating infographic...');
    
    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext('2d');

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.5, '#16213e');
    gradient.addColorStop(1, '#0f3460');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    // Header section
    await this.drawHeader(ctx, reportData);
    
    // Stats grid
    await this.drawStatsGrid(ctx, reportData);
    
    // Map preview
    await this.drawMapPreview(ctx, reportData);
    
    // State distribution
    await this.drawStateDistribution(ctx, reportData);
    
    // Footer with CTA
    await this.drawFooter(ctx);

    console.log('✅ Infographic generated');
    return canvas.toBuffer('image/png');
  }

  /**
   * Draw header with logo and title
   */
  async drawHeader(ctx, data) {
    // Shield icon
    ctx.fillStyle = this.accentColor;
    ctx.beginPath();
    ctx.moveTo(540, 80);
    ctx.lineTo(620, 120);
    ctx.lineTo(620, 200);
    ctx.lineTo(540, 240);
    ctx.lineTo(460, 200);
    ctx.lineTo(460, 120);
    ctx.closePath();
    ctx.fill();

    // Title
    ctx.fillStyle = this.textColor;
    ctx.font = 'bold 72px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SUNTRENIA', 540, 320);
    
    ctx.font = '36px Arial';
    ctx.fillStyle = '#a8dadc';
    ctx.fillText('INTELLIGENCE BRIEF', 540, 370);

    // Date range
    const endDate = new Date();
    const startDate = new Date(endDate - 7 * 24 * 60 * 60 * 1000);
    ctx.font = '28px Arial';
    ctx.fillStyle = '#ffffff80';
    ctx.fillText(
      `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, 2026`,
      540, 420
    );
  }

  /**
   * Draw key statistics grid
   */
  async drawStatsGrid(ctx, data) {
    const stats = [
      { 
        icon: '🚨', 
        label: 'INCIDENTS', 
        value: data.incidents?.length || 0,
        color: '#e94560'
      },
      { 
        icon: '📍', 
        label: 'STATES', 
        value: data.statesAffected || 0,
        color: '#f39c12'
      },
      { 
        icon: '⚰️', 
        label: 'CASUALTIES', 
        value: data.casualties || 0,
        color: '#c0392b'
      },
      { 
        icon: '👤', 
        label: 'ABDUCTIONS', 
        value: data.abductions || 0,
        color: '#9b59b6'
      }
    ];

    const startY = 500;
    const boxSize = 240;
    const spacing = 40;
    const cols = 2;

    stats.forEach((stat, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const x = 120 + col * (boxSize + spacing);
      const y = startY + row * (boxSize + spacing);

      // Box with gradient
      const boxGradient = ctx.createLinearGradient(x, y, x, y + boxSize);
      boxGradient.addColorStop(0, stat.color + '40');
      boxGradient.addColorStop(1, stat.color + '10');
      
      ctx.fillStyle = boxGradient;
      this.roundRect(ctx, x, y, boxSize, boxSize, 20);
      ctx.fill();

      // Border
      ctx.strokeStyle = stat.color + '80';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Icon
      ctx.font = '60px Arial';
      ctx.fillText(stat.icon, x + boxSize/2, y + 80);

      // Value
      ctx.font = 'bold 64px Arial';
      ctx.fillStyle = this.textColor;
      ctx.fillText(stat.value.toString(), x + boxSize/2, y + 160);

      // Label
      ctx.font = '20px Arial';
      ctx.fillStyle = '#ffffff90';
      ctx.fillText(stat.label, x + boxSize/2, y + 200);
    });
  }

  /**
   * Draw mini map preview
   */
  async drawMapPreview(ctx, data) {
    const y = 1060;
    
    // Section title
    ctx.fillStyle = this.textColor;
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('AFFECTED REGIONS', 540, y);

    // Map placeholder (simplified Nigeria map)
    ctx.fillStyle = '#ffffff20';
    ctx.strokeStyle = '#ffffff40';
    ctx.lineWidth = 2;
    
    // Simple Nigeria outline
    ctx.beginPath();
    ctx.moveTo(400, y + 100);
    ctx.lineTo(680, y + 100);
    ctx.lineTo(700, y + 200);
    ctx.lineTo(650, y + 350);
    ctx.lineTo(430, y + 350);
    ctx.lineTo(380, y + 200);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Hotspot markers
    if (data.affectedStates?.length > 0) {
      const hotspots = [
        { x: 450, y: y + 150 }, // North
        { x: 540, y: y + 200 }, // Center
        { x: 600, y: y + 300 }  // South
      ];

      hotspots.slice(0, Math.min(3, data.affectedStates.length)).forEach(spot => {
        ctx.fillStyle = this.accentColor;
        ctx.beginPath();
        ctx.arc(spot.x, spot.y, 15, 0, Math.PI * 2);
        ctx.fill();
        
        // Pulse effect
        ctx.strokeStyle = this.accentColor + '40';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(spot.x, spot.y, 25, 0, Math.PI * 2);
        ctx.stroke();
      });
    }
  }

  /**
   * Draw top affected states
   */
  async drawStateDistribution(ctx, data) {
    const y = 1480;
    
    ctx.fillStyle = this.textColor;
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('TOP AFFECTED STATES', 120, y);

    const topStates = (data.affectedStateNames || []).slice(0, 3);
    const stateColors = ['#e94560', '#f39c12', '#9b59b6'];

    topStates.forEach((state, index) => {
      const itemY = y + 50 + index * 60;
      
      // Color indicator
      ctx.fillStyle = stateColors[index];
      ctx.fillRect(120, itemY - 20, 8, 40);
      
      // State name
      ctx.fillStyle = this.textColor;
      ctx.font = '24px Arial';
      ctx.fillText(state, 150, itemY + 5);
      
      // Severity bar
      const barWidth = 200;
      const severity = (3 - index) / 3;
      
      ctx.fillStyle = '#ffffff20';
      this.roundRect(ctx, 720, itemY - 15, barWidth, 30, 15);
      ctx.fill();
      
      ctx.fillStyle = stateColors[index];
      this.roundRect(ctx, 720, itemY - 15, barWidth * severity, 30, 15);
      ctx.fill();
    });
  }

  /**
   * Draw footer with download CTA
   */
  async drawFooter(ctx) {
    const y = 1720;
    
    // Gradient box for CTA
    const gradient = ctx.createLinearGradient(0, y, 0, y + 150);
    gradient.addColorStop(0, this.accentColor + '60');
    gradient.addColorStop(1, this.accentColor + '20');
    
    ctx.fillStyle = gradient;
    this.roundRect(ctx, 120, y, 840, 140, 20);
    ctx.fill();

    ctx.strokeStyle = this.accentColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // CTA text
    ctx.fillStyle = this.textColor;
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('📄 FULL 7-PAGE REPORT', 540, y + 55);
    
    ctx.font = '28px Arial';
    ctx.fillStyle = '#ffffff90';
    ctx.fillText('Tap below to download FREE', 540, y + 95);

    // Suntrenia branding
    ctx.font = '20px Arial';
    ctx.fillStyle = '#ffffff60';
    ctx.fillText('suntrenia.com/intelligence', 540, y + 125);
  }

  /**
   * Helper: Draw rounded rectangle
   */
  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}

module.exports = InfographicGenerator;