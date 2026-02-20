const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const brevo = require('@getbrevo/brevo');
const fs = require('fs');
const path = require('path');

class PDFReportService {
  // ============================================
  // CONSTANTS
  // ============================================
  static PAGE_WIDTH = 595;
  static PAGE_HEIGHT = 842;
  static MARGIN = 50;
  static CLASSIFICATION_BANNER_HEIGHT = 35;
  static MAX_INCIDENTS_PER_REPORT = 50;
  static MAX_STATES_TO_ANALYZE = 20;

  // ============================================
  // CONSTRUCTOR
  // ============================================
  constructor() {
    // Check for optional dependencies
    this.hasSVGSupport = this.checkDependency('svg-to-pdfkit');
    this.hasSharpSupport = this.checkDependency('sharp');

    // Check if using Brevo API (recommended for cloud hosting)
    if (process.env.BREVO_API_KEY) {
      this.brevoClient = new brevo.TransactionalEmailsApi();
      this.brevoClient.setApiKey(
        brevo.TransactionalEmailsApiApiKeys.apiKey,
        process.env.BREVO_API_KEY
      );
      this.useBrevo = true;
      console.log('✅ Email: Brevo API configured');
    }
    // Fallback to Gmail SMTP (if Brevo not available)
    else if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 465,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000
      });
      this.useBrevo = false;
      console.log('✅ Email: Gmail SMTP configured');
    } else {
      console.warn('⚠️ Email credentials not configured - email feature disabled');
      this.emailTransporter = null;
      this.useBrevo = false;
    }

    // Configuration from environment variables
    this.config = {
      organizationName: process.env.ORG_NAME || 'Suntrenia Intelligence',
      contactPhone: process.env.CONTACT_PHONE || '+234 703 499 5589',
      contactEmail: process.env.CONTACT_EMAIL || 'info@suntrenia.com',
      senderEmail: process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER,
      website: process.env.WEBSITE || 'www.suntrenia.com'
    };
  }

  // ============================================
  // DEPENDENCY CHECKING
  // ============================================
  checkDependency(moduleName) {
    try {
      require.resolve(moduleName);
      return true;
    } catch (e) {
      console.warn(`⚠️ Optional dependency ${moduleName} not installed`);
      return false;
    }
  }

  // ============================================
  // VALIDATION METHODS
  // ============================================
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return input.replace(/[<>'"]/g, '');
  }

  // ============================================
  // PDF GENERATION
  // ============================================
  async generateEnhancedReport(data, options = {}) {
    const { reportType = 'weekly' } = options;

    // Validate data
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data provided for report generation');
    }

    // Limit data sizes to prevent memory issues
    const limitedData = {
      ...data,
      incidents: (data.incidents || []).slice(0, PDFReportService.MAX_INCIDENTS_PER_REPORT),
      stateRiskAnalyses: (data.stateRiskAnalyses || []).slice(0, PDFReportService.MAX_STATES_TO_ANALYZE)
    };

    if (data.incidents?.length > PDFReportService.MAX_INCIDENTS_PER_REPORT) {
      console.warn(`⚠️ Truncating incidents from ${data.incidents.length} to ${PDFReportService.MAX_INCIDENTS_PER_REPORT}`);
    }

    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: PDFReportService.MARGIN,
      info: {
        Title: 'Suntrenia Security Intelligence Report',
        Author: 'Olukayode Joel Fakorede',
        Subject: 'Nigeria Security Analysis',
        Keywords: 'security, intelligence, Nigeria'
      }
    });

    try {
      // PAGE 1: Cover Page
      this.addCoverPage(doc, reportType);

      // PAGE 2: Classification & Executive Summary
      doc.addPage();
      this.addClassificationHeader(doc);
      this.addExecutiveSummary(doc, limitedData);

      // PAGE 3: Key Statistics Dashboard
      doc.addPage();
      this.addStatisticsDashboard(doc, limitedData);

      // PAGE 4: Geographic Risk Assessment (MAP - MOVED UP)
      if (limitedData.mapSvg) {
        doc.addPage();
        await this.addMap(doc, limitedData);
      }

      // PAGE 5: Visual Analytics & Trends
      doc.addPage();
      this.addVisualAnalytics(doc, limitedData);

      // PAGE 6: Incident Analysis
      if (limitedData.incidents && limitedData.incidents.length > 0) {
        doc.addPage();
        this.addIncidentDetails(doc, limitedData);
      }

      // PAGE 7: State Risk Assessment
      if (limitedData.stateRiskAnalyses && limitedData.stateRiskAnalyses.length > 0) {
        doc.addPage();
        this.addStateAnalysis(doc, limitedData);
      }

      // PAGE 8: Pattern Analysis
      if (limitedData.patternAnalysis) {
        doc.addPage();
        this.addPatternAnalysis(doc, limitedData);
      }

      // PAGE 9: Strategic Recommendations
      doc.addPage();
      this.addRecommendations(doc, limitedData);

      return doc;
    } catch (error) {
      console.error('❌ PDF generation error:', error);
      throw error;
    }
  }

  addCoverPage(doc, reportType) {
    // Header background
    doc.rect(0, 0, PDFReportService.PAGE_WIDTH, 220)
       .fill('#1a252f');

    // Organization name
    doc.fontSize(52)
       .font('Helvetica-Bold')
       .fillColor('#ffffff')
       .text('SECURITY INTELLIGENCE REPORT', PDFReportService.MARGIN, 70, { align: 'center' });
    
    // Subtitle
    doc.fontSize(14)
       .font('Helvetica')
       .fillColor('#3498db')
       .text(`POWERED BY ${this.config.organizationName.toUpperCase()}`, PDFReportService.MARGIN, 130, { align: 'center' });
    
    // Report type
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .fillColor('#ecf0f1')
       .text(`${reportType.toUpperCase()} INTELLIGENCE REPORT`, PDFReportService.MARGIN, 170, { align: 'center' });

    // Accent line
    doc.moveTo(150, 210)
       .lineTo(445, 210)
       .strokeColor('#3498db')
       .lineWidth(3)
       .stroke();

    // Report metadata
    const reportDate = new Date().toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Lagos'
    });

    doc.fontSize(11)
       .fillColor('#2c3e50')
       .font('Helvetica')
       .text(`Report Generated: ${reportDate}`, PDFReportService.MARGIN, 260, { align: 'center' });

    doc.fontSize(10)
       .fillColor('#7f8c8d')
       .text('CLASSIFICATION: CONFIDENTIAL', PDFReportService.MARGIN, 285, { align: 'center' });

    // Information box
    doc.roundedRect(100, 340, 395, 180, 8)
       .fillAndStroke('#f8f9fa', '#dee2e6');

    doc.fontSize(13)
       .fillColor('#2c3e50')
       .font('Helvetica-Bold')
       .text('REPORT INFORMATION', 120, 360);

    const reportInfo = [
      `Report Type: ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Security Assessment`,
      `Geographic Scope: Federal Republic of Nigeria`,
      `Analysis Period: Last 7 Days`,
      `Methodology: Multi-Source Intelligence (OSINT/HUMINT)`,
      `Classification Level: Confidential`,
      `Distribution: Restricted to Authorized Personnel`
    ];

    let infoY = 390;
    reportInfo.forEach(info => {
      doc.fontSize(10)
         .fillColor('#34495e')
         .font('Helvetica')
         .text(`• ${info}`, 120, infoY);
      infoY += 20;
    });

    // Footer
    doc.fontSize(8)
       .fillColor('#95a5a6')
       .text(`Powered by ${this.config.organizationName} AI Security Intelligence Platform`, PDFReportService.MARGIN, 720, { align: 'center' });
    
    doc.fontSize(7)
       .text('This document contains sensitive security information. Unauthorized disclosure prohibited.', PDFReportService.MARGIN, 735, { align: 'center' });
  }

  addClassificationHeader(doc) {
    // Classification banner
    doc.rect(0, 0, PDFReportService.PAGE_WIDTH, PDFReportService.CLASSIFICATION_BANNER_HEIGHT)
       .fill('#c0392b');

    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor('#ffffff')
       .text('CONFIDENTIAL - SECURITY INTELLIGENCE', 0, 12, { align: 'center' });
  }

  addExecutiveSummary(doc, data) {
    const startY = 60;

    // Section header
    doc.fontSize(22)
       .font('Helvetica-Bold')
       .fillColor('#2c3e50')
       .text('EXECUTIVE BRIEFING', PDFReportService.MARGIN, startY);

    // Underline
    doc.moveTo(PDFReportService.MARGIN, startY + 28)
       .lineTo(545, startY + 28)
       .strokeColor('#3498db')
       .lineWidth(2)
       .stroke();

    // Classification label
    doc.fontSize(9)
       .font('Helvetica-Bold')
       .fillColor('#c0392b')
       .text('CLASSIFICATION: CONFIDENTIAL', PDFReportService.MARGIN, startY + 40);

    doc.fontSize(9)
       .fillColor('#7f8c8d')
       .font('Helvetica')
       .text(`DATE: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 300, startY + 40);

    // Content box
    const briefing = data.aiBriefing || 'Executive briefing is currently being generated. This report provides a comprehensive analysis of security incidents across Nigeria based on multi-source intelligence gathering and AI-enhanced threat assessment.';
    
    doc.fontSize(11)
       .fillColor('#2c3e50')
       .font('Helvetica')
       .text(briefing, PDFReportService.MARGIN, startY + 65, {
         align: 'justify',
         width: 495,
         lineGap: 6
       });
  }

  addStatisticsDashboard(doc, data) {
    const startY = 50;

    // Add classification banner
    this.addClassificationHeader(doc);

    // Section header
    doc.fontSize(22)
       .fillColor('#2c3e50')
       .font('Helvetica-Bold')
       .text('KEY INTELLIGENCE METRICS', PDFReportService.MARGIN, startY);

    doc.moveTo(PDFReportService.MARGIN, startY + 28)
       .lineTo(545, startY + 28)
       .strokeColor('#3498db')
       .lineWidth(2)
       .stroke();

    // Statistics cards
    const stats = [
      { label: 'Total Incidents', value: data.incidents?.length || 0, color: '#e74c3c', symbol: '*' },
      { label: 'States Affected', value: data.statesAffected || 0, color: '#e67e22', symbol: '+' },
      { label: 'Est. Casualties', value: data.casualties || 0, color: '#c0392b', symbol: 'x' },
      { label: 'Abductions', value: data.abductions || 0, color: '#d35400', symbol: '!' }
    ];

    const boxWidth = 115;
    const boxHeight = 95;
    const spacing = 15;
    const startX = PDFReportService.MARGIN;
    const boxStartY = startY + 50;

    stats.forEach((stat, index) => {
      const xPos = startX + (index * (boxWidth + spacing));

      // Card shadow
      doc.rect(xPos + 2, boxStartY + 2, boxWidth, boxHeight)
         .fill('#95a5a6');

      // Card background
      doc.rect(xPos, boxStartY, boxWidth, boxHeight)
         .fillAndStroke('#ffffff', '#dee2e6');

      // Top accent bar
      doc.rect(xPos, boxStartY, boxWidth, 4)
         .fill(stat.color);

      // Symbol (replacing emoji)
      doc.fontSize(28)
         .font('Helvetica-Bold')
         .fillColor(stat.color)
         .text(stat.symbol, xPos, boxStartY + 15, {
           width: boxWidth,
           align: 'center'
         });

      // Value
      doc.fontSize(32)
         .font('Helvetica-Bold')
         .fillColor('#2c3e50')
         .text(stat.value.toString(), xPos, boxStartY + 45, {
           width: boxWidth,
           align: 'center'
         });

      // Label
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('#7f8c8d')
         .text(stat.label.toUpperCase(), xPos, boxStartY + 78, {
           width: boxWidth,
           align: 'center'
         });
    });

    // Affected States section
    this.addAffectedStatesCompact(doc, data, boxStartY + boxHeight + 40);
  }

  addAffectedStatesCompact(doc, data, startY) {
    doc.fontSize(16)
       .fillColor('#2c3e50')
       .font('Helvetica-Bold')
       .text('AFFECTED STATES', PDFReportService.MARGIN, startY);

    doc.moveTo(PDFReportService.MARGIN, startY + 22)
       .lineTo(545, startY + 22)
       .strokeColor('#dee2e6')
       .lineWidth(1)
       .stroke();

    const states = data.affectedStateNames || [];
    
    if (states.length === 0) {
      doc.fontSize(10)
         .fillColor('#7f8c8d')
         .font('Helvetica')
         .text('No states currently affected', PDFReportService.MARGIN, startY + 35);
      return;
    }

    let xPos = PDFReportService.MARGIN;
    let yPos = startY + 35;
    const chipWidth = 90;
    const chipHeight = 26;
    const chipSpacing = 10;

    states.forEach((state) => {
      if (xPos + chipWidth > 545) {
        xPos = PDFReportService.MARGIN;
        yPos += chipHeight + chipSpacing;
      }

      if (yPos + chipHeight > 750) {
        doc.addPage();
        yPos = 50;
        xPos = PDFReportService.MARGIN;
      }

      // Chip shadow
      doc.roundedRect(xPos + 1, yPos + 1, chipWidth, chipHeight, 4)
         .fill('#95a5a6');

      // Chip background
      doc.roundedRect(xPos, yPos, chipWidth, chipHeight, 4)
         .fillAndStroke('#ffffff', '#3498db');

      // State name
      doc.fontSize(9)
         .fillColor('#2c3e50')
         .font('Helvetica-Bold')
         .text(state, xPos, yPos + 9, {
           width: chipWidth,
           align: 'center'
         });

      xPos += chipWidth + chipSpacing;
    });
  }

  async addMap(doc, data) {
    const mapSvg = data.mapSvg;

    if (!mapSvg) {
      console.warn('⚠️ No map SVG data provided');
      return;
    }

    // Add classification banner
    this.addClassificationHeader(doc);

    const startY = 50;

    doc.fontSize(22)
       .fillColor('#2c3e50')
       .font('Helvetica-Bold')
       .text('GEOGRAPHIC THREAT ASSESSMENT', PDFReportService.MARGIN, startY);

    doc.moveTo(PDFReportService.MARGIN, startY + 28)
       .lineTo(545, startY + 28)
       .strokeColor('#3498db')
       .lineWidth(2)
       .stroke();

    console.log('🗺️ Embedding map in PDF...');

    let mapEmbedded = false;

    // Try SVG embedding first (if available)
    if (this.hasSVGSupport) {
      try {
        const SVGtoPDF = require('svg-to-pdfkit');
        
        SVGtoPDF(doc, mapSvg, 72, startY + 50, {
          width: 450,
          height: 380,
          preserveAspectRatio: 'xMidYMid meet'
        });
        
        console.log('✅ Map embedded successfully via SVG');
        mapEmbedded = true;
        
      } catch (error) {
        console.error('❌ SVG embedding error:', error.message);
      }
    }

    // Try PNG fallback (if SVG failed and Sharp is available)
    if (!mapEmbedded && this.hasSharpSupport) {
      try {
        const sharp = require('sharp');
        const svgBuffer = Buffer.from(mapSvg, 'utf-8');
        const pngBuffer = await sharp(svgBuffer, { density: 300 })
          .png({ quality: 90 })
          .toBuffer();

        doc.image(pngBuffer, 72, startY + 50, { width: 450, height: 380 });
        console.log('✅ Map embedded as PNG fallback');
        mapEmbedded = true;
      } catch (pngError) {
        console.error('❌ PNG fallback failed:', pngError.message);
      }
    }

    // If all methods failed, show error message
    if (!mapEmbedded) {
      doc.fontSize(11)
         .fillColor('#c0392b')
         .text('Map rendering unavailable. Install svg-to-pdfkit or sharp for map support.', 100, startY + 100);
    }

    // Risk legend
    const legendY = 470;

    doc.fontSize(12)
       .fillColor('#2c3e50')
       .font('Helvetica-Bold')
       .text('THREAT LEVEL INDICATORS', PDFReportService.MARGIN, legendY);

    const legendItems = [
      { color: '#27ae60', label: 'Low Risk (0-2 incidents)', symbol: '■' },
      { color: '#ffd700', label: 'Moderate Risk (3-5 incidents)', symbol: '■' },
      { color: '#ff8c00', label: 'High Risk (6-9 incidents)', symbol: '■' },
      { color: '#dc143c', label: 'Critical Risk (10+ incidents)', symbol: '■' }
    ];

    let legendItemY = legendY + 25;
    legendItems.forEach(item => {
      doc.fontSize(18)
         .fillColor(item.color)
         .text(item.symbol, PDFReportService.MARGIN, legendItemY);

      doc.fontSize(10)
         .fillColor('#2c3e50')
         .font('Helvetica')
         .text(item.label, 75, legendItemY + 3);

      legendItemY += 25;
    });

    // Map metadata
    doc.fontSize(8)
       .fillColor('#7f8c8d')
       .text(`Map generated: ${new Date().toLocaleString()} | Data source: Multi-source intelligence`, PDFReportService.MARGIN, 670, { align: 'center' });
  }

  addVisualAnalytics(doc, data) {
    // Add classification banner
    this.addClassificationHeader(doc);

    const startY = 50;

    doc.fontSize(22)
       .fillColor('#2c3e50')
       .font('Helvetica-Bold')
       .text('ANALYTICAL INTELLIGENCE', PDFReportService.MARGIN, startY);

    doc.moveTo(PDFReportService.MARGIN, startY + 28)
       .lineTo(545, startY + 28)
       .strokeColor('#3498db')
       .lineWidth(2)
       .stroke();

    // State distribution chart
    if (data.stateData && data.stateData.labels && data.stateData.labels.length > 0) {
      this.drawBarChart(doc, {
        title: 'INCIDENT DISTRIBUTION BY STATE',
        data: data.stateData,
        x: PDFReportService.MARGIN,
        y: startY + 50,
        width: 495,
        height: 180
      });
    }

    // Category breakdown
    if (data.categoryData && Object.keys(data.categoryData).length > 0) {
      this.drawCategoryBreakdown(doc, {
        title: 'THREAT CATEGORY BREAKDOWN',
        data: data.categoryData,
        x: PDFReportService.MARGIN,
        y: startY + 280,
        width: 495
      });
    }

    // Trend analysis
    if (data.trendData && data.trendData.data && data.trendData.data.length > 0) {
      this.drawTrendChart(doc, {
        title: 'INCIDENT TREND ANALYSIS',
        data: data.trendData,
        x: PDFReportService.MARGIN,
        y: startY + 480,
        width: 495,
        height: 140
      });
    }
  }

  drawBarChart(doc, options) {
    const { title, data, x, y, width, height } = options;

    doc.fontSize(13)
       .fillColor('#2c3e50')
       .font('Helvetica-Bold')
       .text(title, x, y);

    doc.rect(x, y + 25, width, height)
       .fillAndStroke('#ffffff', '#dee2e6');

    if (!data.counts || data.counts.length === 0) {
      doc.fontSize(10)
         .fillColor('#7f8c8d')
         .text('No data available', x + width/2 - 50, y + height/2);
      return;
    }

    const maxValue = Math.max(...data.counts, 1);
    const barWidth = Math.floor((width - 40) / Math.min(data.labels.length, 10));
    const chartHeight = height - 50;

    data.labels.slice(0, 10).forEach((label, index) => {
      const count = data.counts[index] || 0;
      const barHeight = (count / maxValue) * chartHeight;
      const barX = x + 20 + (index * barWidth);
      const barY = y + 25 + height - 40 - barHeight;

      // Bar
      doc.rect(barX + 4, barY, barWidth - 8, barHeight)
         .fill(data.colors[index] || '#3498db');

      // Value label
      doc.fontSize(8)
         .fillColor('#2c3e50')
         .font('Helvetica-Bold')
         .text(count.toString(), barX, barY - 12, {
           width: barWidth,
           align: 'center'
         });

      // State label
      doc.fontSize(7)
         .fillColor('#7f8c8d')
         .font('Helvetica')
         .text(label.substring(0, 6), barX, y + 25 + height - 30, {
           width: barWidth,
           align: 'center'
         });
    });
  }

  drawCategoryBreakdown(doc, options) {
    const { title, data, x, y, width } = options;

    doc.fontSize(13)
       .fillColor('#2c3e50')
       .font('Helvetica-Bold')
       .text(title, x, y);

    const colors = ['#dc143c', '#ff8c00', '#ffd700', '#4169e1', '#808080'];
    const total = Object.values(data).reduce((sum, val) => sum + (val || 0), 0);

    if (total === 0) {
      doc.fontSize(10)
         .fillColor('#7f8c8d')
         .text('No category data available', x, y + 25);
      return;
    }

    let currentY = y + 25;
    Object.entries(data).forEach(([category, value], index) => {
      const percentage = ((value / total) * 100).toFixed(1);

      // Category indicator
      doc.rect(x, currentY, 16, 16)
         .fill(colors[index] || '#808080');

      // Category name
      doc.fontSize(10)
         .fillColor('#2c3e50')
         .font('Helvetica')
         .text(`${category}:`, x + 25, currentY + 2);

      // Value
      doc.font('Helvetica-Bold')
         .text(`${value} (${percentage}%)`, x + 150, currentY + 2);

      // Progress bar
      const barWidth = Math.min((value / total) * (width - 280), width - 280);
      doc.rect(x + 250, currentY + 4, barWidth, 10)
         .fill(colors[index] || '#808080');

      currentY += 28;
    });
  }

  drawTrendChart(doc, options) {
    const { title, data, x, y, width, height } = options;

    doc.fontSize(13)
       .fillColor('#2c3e50')
       .font('Helvetica-Bold')
       .text(title, x, y);

    doc.rect(x, y + 25, width, height)
       .fillAndStroke('#ffffff', '#dee2e6');

    if (!data.data || data.data.length === 0) {
      doc.fontSize(10)
         .fillColor('#7f8c8d')
         .text('No trend data available', x + width/2 - 50, y + height/2);
      return;
    }

    const maxValue = Math.max(...data.data, 1);
    const stepX = width / (data.labels.length - 1);
    const chartHeight = height - 40;

    // Draw grid lines
    for (let i = 0; i <= 4; i++) {
      const gridY = y + 30 + (chartHeight / 4) * i;
      doc.moveTo(x + 5, gridY)
         .lineTo(x + width - 5, gridY)
         .strokeColor('#ecf0f1')
         .lineWidth(1)
         .stroke();
    }

    // Draw trend line
    doc.strokeColor('#3498db')
       .lineWidth(2.5);

    data.data.forEach((value, index) => {
      const pointX = x + (index * stepX);
      const pointY = y + 30 + chartHeight - ((value / maxValue) * chartHeight);

      if (index === 0) {
        doc.moveTo(pointX, pointY);
      } else {
        doc.lineTo(pointX, pointY);
      }

      // Data point
      doc.circle(pointX, pointY, 3.5)
         .fill('#3498db');
    });

    doc.stroke();

    // X-axis labels
    data.labels.forEach((label, index) => {
      const pointX = x + (index * stepX);
      doc.fontSize(7)
         .fillColor('#7f8c8d')
         .font('Helvetica')
         .text(label, pointX - 15, y + 25 + height - 15, {
           width: 30,
           align: 'center'
         });
    });
  }

  addIncidentDetails(doc, data) {
    // Add classification banner
    this.addClassificationHeader(doc);

    const startY = 50;

    doc.fontSize(22)
       .fillColor('#2c3e50')
       .font('Helvetica-Bold')
       .text('INCIDENT INTELLIGENCE DIGEST', PDFReportService.MARGIN, startY);

    doc.moveTo(PDFReportService.MARGIN, startY + 28)
       .lineTo(545, startY + 28)
       .strokeColor('#3498db')
       .lineWidth(2)
       .stroke();

    const incidents = data.incidents || [];
    
    if (incidents.length === 0) {
      doc.fontSize(11).text('No incidents recorded for this period.', PDFReportService.MARGIN, startY + 50);
      return;
    }

    let currentY = startY + 50;

    incidents.forEach((incident, i) => {
      if (currentY > 680) {
        doc.addPage();
        // Add classification banner on new page
        this.addClassificationHeader(doc);
        currentY = 50;
      }

      // Incident header box
      doc.rect(PDFReportService.MARGIN, currentY, 495, 30)
         .fillAndStroke('#f8f9fa', '#dee2e6');

      // Incident number
      doc.rect(PDFReportService.MARGIN, currentY, 35, 30)
         .fill('#3498db');
      
      doc.fontSize(14)
         .fillColor('#ffffff')
         .font('Helvetica-Bold')
         .text((i + 1).toString(), PDFReportService.MARGIN, currentY + 9, {
           width: 35,
           align: 'center'
         });

      // Incident title
      doc.fontSize(11)
         .fillColor('#2c3e50')
         .font('Helvetica-Bold')
         .text(incident.title || 'Untitled Incident', 95, currentY + 9, {
           width: 445,
           lineGap: 2
         });

      currentY += 35;

      // Metadata row
      let metaY = currentY;

      // Severity badge
      if (incident.severity) {
        const severityColors = {
          'Critical': '#c0392b',
          'High': '#e74c3c',
          'Medium': '#f39c12',
          'Low': '#27ae60'
        };

        doc.roundedRect(PDFReportService.MARGIN, metaY, 65, 18, 3)
           .fill(severityColors[incident.severity] || '#7f8c8d');

        doc.fontSize(8)
           .fillColor('#ffffff')
           .font('Helvetica-Bold')
           .text(incident.severity.toUpperCase(), PDFReportService.MARGIN, metaY + 5, {
             width: 65,
             align: 'center'
           });

        // Classification
        if (incident.aiClassification) {
          doc.fontSize(9)
             .fillColor('#7f8c8d')
             .font('Helvetica')
             .text(`Category: ${incident.aiClassification}`, 125, metaY + 5);
        }

        currentY += 25;
      }

      // Summary
      const summary = incident.summary || 'No summary available';
      doc.fontSize(10)
         .fillColor('#34495e')
         .font('Helvetica')
         .text(summary, PDFReportService.MARGIN, currentY, {
           width: 495,
           align: 'justify',
           lineGap: 4
         });

      currentY += Math.min(doc.heightOfString(summary, { width: 495 }), 70) + 8;

      // Casualties
      if (incident.casualties) {
        doc.fontSize(9)
           .fillColor('#c0392b')
           .font('Helvetica')
           .text(`Casualties - Deaths: ${incident.casualties.deaths || 0} | Injuries: ${incident.casualties.injuries || 0} | Abducted: ${incident.casualties.abducted || 0}`, PDFReportService.MARGIN, currentY);
        currentY += 18;
      }

      // Source
      if (incident.link) {
        doc.fontSize(8)
           .fillColor('#3498db')
           .font('Helvetica')
           .text(`Source: ${incident.link.substring(0, 80)}...`, PDFReportService.MARGIN, currentY, {
             link: incident.link,
             underline: true
           });
      }

      currentY += 20;

      // Separator
      doc.moveTo(PDFReportService.MARGIN, currentY)
         .lineTo(545, currentY)
         .strokeColor('#dee2e6')
         .lineWidth(1)
         .stroke();

      currentY += 15;
    });
  }

  addStateAnalysis(doc, data) {
    // Add classification banner
    this.addClassificationHeader(doc);

    const startY = 50;

    doc.fontSize(22)
       .fillColor('#2c3e50')
       .font('Helvetica-Bold')
       .text('STATE RISK ASSESSMENT', PDFReportService.MARGIN, startY);

    doc.moveTo(PDFReportService.MARGIN, startY + 28)
       .lineTo(545, startY + 28)
       .strokeColor('#3498db')
       .lineWidth(2)
       .stroke();

    const stateAnalyses = data.stateRiskAnalyses || [];

    if (stateAnalyses.length === 0) {
      doc.fontSize(11).text('No state-specific analysis available.', PDFReportService.MARGIN, startY + 50);
      return;
    }

    let currentY = startY + 50;

    stateAnalyses.forEach((analysis) => {
      if (currentY > 640) {
        doc.addPage();
        this.addClassificationHeader(doc);
        currentY = 50;
      }

      // State header
      doc.rect(PDFReportService.MARGIN, currentY, 495, 35)
         .fillAndStroke('#f8f9fa', '#dee2e6');

      doc.fontSize(15)
         .fillColor('#2c3e50')
         .font('Helvetica-Bold')
         .text(analysis.stateName, 60, currentY + 10);

      currentY += 40;

      // Risk indicator and stats
      const riskColors = {
        'Critical': '#c0392b',
        'High': '#e74c3c',
        'Medium': '#f39c12',
        'Low': '#27ae60'
      };

      doc.roundedRect(PDFReportService.MARGIN, currentY, 90, 22, 3)
         .fill(riskColors[analysis.riskLevel] || '#7f8c8d');

      doc.fontSize(10)
         .fillColor('#ffffff')
         .font('Helvetica-Bold')
         .text(analysis.riskLevel.toUpperCase(), PDFReportService.MARGIN, currentY + 6, {
           width: 90,
           align: 'center'
         });

      doc.fontSize(10)
         .fillColor('#2c3e50')
         .font('Helvetica')
         .text(`Incidents Recorded: ${analysis.incidentCount}`, 150, currentY + 6);

      currentY += 32;

      // Analysis content
      doc.fontSize(10)
         .fillColor('#34495e')
         .font('Helvetica')
         .text(analysis.analysis || 'Detailed analysis unavailable', PDFReportService.MARGIN, currentY, {
           width: 495,
           align: 'justify',
           lineGap: 5
         });

      currentY += doc.heightOfString(analysis.analysis || 'Detailed analysis unavailable', { width: 495 }) + 25;

      // Separator
      doc.moveTo(PDFReportService.MARGIN, currentY)
         .lineTo(545, currentY)
         .strokeColor('#dee2e6')
         .lineWidth(1)
         .stroke();

      currentY += 20;
    });
  }

  addPatternAnalysis(doc, data) {
    // Add classification banner
    this.addClassificationHeader(doc);

    const startY = 50;

    doc.fontSize(22)
       .fillColor('#2c3e50')
       .font('Helvetica-Bold')
       .text('PATTERN & TREND ANALYSIS', PDFReportService.MARGIN, startY);

    doc.moveTo(PDFReportService.MARGIN, startY + 28)
       .lineTo(545, startY + 28)
       .strokeColor('#3498db')
       .lineWidth(2)
       .stroke();

    const analysis = data.patternAnalysis || 'Pattern analysis requires historical data comparison. Longitudinal trend analysis will be available in subsequent reporting periods.';

    doc.fontSize(11)
       .fillColor('#34495e')
       .font('Helvetica')
       .text(analysis, PDFReportService.MARGIN, startY + 50, {
         width: 495,
         align: 'justify',
         lineGap: 6
       });
  }

  addRecommendations(doc, data) {
    // Add classification banner
    this.addClassificationHeader(doc);

    const startY = 50;

    doc.fontSize(22)
       .fillColor('#2c3e50')
       .font('Helvetica-Bold')
       .text('STRATEGIC RECOMMENDATIONS', PDFReportService.MARGIN, startY);

    doc.moveTo(PDFReportService.MARGIN, startY + 28)
       .lineTo(545, startY + 28)
       .strokeColor('#3498db')
       .lineWidth(2)
       .stroke();

    const recommendations = data.recommendations || [
      'Enhance security infrastructure in states identified as high-risk zones',
      'Strengthen inter-agency intelligence coordination and information sharing protocols',
      'Deploy community-based security initiatives in vulnerable regions',
      'Implement advanced surveillance and early warning systems in critical areas',
      'Increase border security measures in states experiencing cross-border threats'
    ];

    let currentY = startY + 50;

    recommendations.forEach((rec, i) => {
      if (currentY > 680) {
        doc.addPage();
        this.addClassificationHeader(doc);
        currentY = 50;
      }

      // Recommendation number
      doc.circle(62, currentY + 10, 11)
         .fill('#3498db');

      doc.fontSize(11)
         .fillColor('#ffffff')
         .font('Helvetica-Bold')
         .text((i + 1).toString(), 57, currentY + 5);

      // Recommendation text
      doc.fontSize(11)
         .fillColor('#2c3e50')
         .font('Helvetica')
         .text(rec, 85, currentY, {
           width: 460,
           align: 'justify',
           lineGap: 4
         });

      currentY += doc.heightOfString(rec, { width: 460 }) + 22;
    });

    // Document footer
    currentY = Math.max(currentY, 650);

    doc.moveTo(PDFReportService.MARGIN, currentY)
       .lineTo(545, currentY)
       .strokeColor('#dee2e6')
       .lineWidth(2)
       .stroke();

    doc.fontSize(10)
       .fillColor('#2c3e50')
       .font('Helvetica-Bold')
       .text('DOCUMENT CLASSIFICATION', PDFReportService.MARGIN, currentY + 15, { align: 'center' });

    doc.fontSize(8)
       .fillColor('#7f8c8d')
       .font('Helvetica')
       .text('This document contains sensitive security intelligence. Distribution restricted to authorized personnel only.', PDFReportService.MARGIN, currentY + 32, { align: 'center', width: 495 });

    doc.fontSize(8)
       .text(`${this.config.organizationName} AI Security Intelligence Platform | ${this.config.website}`, PDFReportService.MARGIN, currentY + 50, { align: 'center' });

    doc.fontSize(7)
       .fillColor('#95a5a6')
       .text(`Report ID: ${Date.now()} | Generated: ${new Date().toLocaleString()} | Classification: CONFIDENTIAL`, PDFReportService.MARGIN, currentY + 65, { align: 'center', width: 495 });
  }

  // ============================================
  // EMAIL SENDING METHODS
  // ============================================
  async sendReportEmail(recipientEmail, pdfBuffer, reportName) {
    // Validate inputs
    if (!this.validateEmail(recipientEmail)) {
      return { 
        success: false, 
        error: 'Invalid email format' 
      };
    }

    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
      return { 
        success: false, 
        error: 'Invalid PDF buffer' 
      };
    }

    // Sanitize report name
    const sanitizedReportName = this.sanitizeInput(reportName) || 'suntrenia-security-report.pdf';

    if (this.useBrevo) {
      return this.sendViaBrevo(recipientEmail, pdfBuffer, sanitizedReportName);
    } else if (this.emailTransporter) {
      return this.sendViaGmail(recipientEmail, pdfBuffer, sanitizedReportName);
    } else {
      return { 
        success: false, 
        error: 'Email service not configured. Please set BREVO_API_KEY or EMAIL credentials in .env' 
      };
    }
  }

  async sendViaBrevo(recipientEmail, pdfBuffer, reportName) {
    try {
      const sendSmtpEmail = new brevo.SendSmtpEmail();

      sendSmtpEmail.subject = `${this.config.organizationName} Security Intelligence Report - ${new Date().toLocaleDateString()}`;
      sendSmtpEmail.to = [{ email: recipientEmail }];
      sendSmtpEmail.sender = { 
        name: this.config.organizationName, 
        email: this.config.senderEmail
      };
      sendSmtpEmail.htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1a252f; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0;">${this.config.organizationName}</h1>
            <p style="color: #3498db; margin: 10px 0 0 0;">Security Intelligence Report</p>
          </div>
          
          <div style="padding: 30px; background: #ffffff;">
            <h2 style="color: #2c3e50;">Security Intelligence Briefing</h2>
            <p style="color: #34495e; line-height: 1.6;">
              Your comprehensive security intelligence report is attached. This report contains
              classified information and should be handled according to your organization's
              security protocols.
            </p>
            
            <div style="background: #f8f9fa; padding: 20px; border-left: 4px solid #3498db; margin: 20px 0;">
              <h3 style="color: #2c3e50; margin-top: 0;">Report Contents</h3>
              <ul style="color: #34495e;">
                <li>Executive Security Briefing</li>
                <li>Geographic Threat Assessment</li>
                <li>Incident Intelligence Digest</li>
                <li>State-by-State Risk Analysis</li>
                <li>Strategic Recommendations</li>
              </ul>
            </div>
            
            <p style="color: #7f8c8d; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
              <strong>Classification:</strong> CONFIDENTIAL<br>
              <strong>Generated:</strong> ${new Date().toLocaleString()}<br>
              <strong>Platform:</strong> ${this.config.organizationName} AI Security Intelligence<br>
              <strong>Contact:</strong> ${this.config.contactPhone}
            </p>
          </div>
        </div>
      `;
      
      // Attach PDF
      sendSmtpEmail.attachment = [{
        content: pdfBuffer.toString('base64'),
        name: reportName
      }];

      const result = await this.brevoClient.sendTransacEmail(sendSmtpEmail);
      console.log('✅ Email sent via Brevo to:', recipientEmail);
      console.log('   Message ID:', result.messageId);
      return { 
        success: true, 
        provider: 'Brevo',
        messageId: result.messageId 
      };
    } catch (error) {
      console.error('❌ Brevo error:', error.message);
      console.error('   Details:', error.response?.body || error);
      return { 
        success: false, 
        error: error.message,
        details: error.response?.body 
      };
    }
  }

  async sendViaGmail(recipientEmail, pdfBuffer, reportName) {
    if (!this.emailTransporter) {
      return { 
        success: false, 
        error: 'Email service not configured' 
      };
    }

    try {
      const mailOptions = {
        from: this.config.senderEmail,
        to: recipientEmail,
        subject: `${this.config.organizationName} Security Intelligence Report - ${new Date().toLocaleDateString()}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1a252f; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0;">${this.config.organizationName}</h1>
              <p style="color: #3498db; margin: 10px 0 0 0;">Security Intelligence Report</p>
            </div>
            
            <div style="padding: 30px; background: #ffffff;">
              <h2 style="color: #2c3e50;">Security Intelligence Briefing</h2>
              <p style="color: #34495e; line-height: 1.6;">
                Your comprehensive security intelligence report is attached. This report contains
                classified information and should be handled according to your organization's
                security protocols.
              </p>
              
              <div style="background: #f8f9fa; padding: 20px; border-left: 4px solid #3498db; margin: 20px 0;">
                <h3 style="color: #2c3e50; margin-top: 0;">Report Contents</h3>
                <ul style="color: #34495e;">
                  <li>Executive Security Briefing</li>
                  <li>Geographic Threat Assessment</li>
                  <li>Incident Intelligence Digest</li>
                  <li>State-by-State Risk Analysis</li>
                  <li>Strategic Recommendations</li>
                </ul>
              </div>
              
              <p style="color: #7f8c8d; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                <strong>Classification:</strong> CONFIDENTIAL<br>
                <strong>Generated:</strong> ${new Date().toLocaleString()}<br>
                <strong>Platform:</strong> ${this.config.organizationName} AI Security Intelligence<br>
                <strong>Contact:</strong> ${this.config.contactPhone}<br>
                <strong>Email:</strong> ${this.config.contactEmail}
              </p>
            </div>
          </div>
        `,
        attachments: [{
          filename: reportName,
          content: pdfBuffer
        }]
      };

      const info = await this.emailTransporter.sendMail(mailOptions);
      console.log('✅ Email sent via Gmail:', info.messageId);
      return { 
        success: true, 
        provider: 'Gmail',
        messageId: info.messageId 
      };
    } catch (error) {
      console.error('❌ Gmail error:', error.message);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================
  streamToBuffer(doc) {
    return new Promise((resolve, reject) => {
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);
      doc.end();
    });
  }
}

module.exports = PDFReportService
