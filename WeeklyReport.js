

// === weeklySummaryReport.js (MVP Add-on Module for Suntrenia) ===


  const express = require('express');
  const PDFDocument = require('pdfkit');
  const { Readable } = require('stream');
  const axios = require('axios');
  const QuickChart = require('quickchart-js');
  const { getHighlightedMapBuffer, stateNameToId } = require('./utils/mapUtils'); // ✅ Correct path
  
  module.exports = function (app, newsCache, scrapeAllSources) {
    const fallbackData = generateFictitiousData();
  
    app.get('/api/news/weekly-summary', async (req, res) => {
      const realData = newsCache.get('news') || await scrapeAllSources();
      const data = realData.length ? realData : fallbackData;
  
      const stats = computeStats(data);
      const affectedIds = Array.from(stats.states).map(stateNameToId);
      const mapBuffer = await getHighlightedMapBuffer(affectedIds);
  
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const stream = new Readable().wrap(doc);
  
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="weekly_summary_report.pdf"');
  
      doc.fontSize(22).text('SUNTRENIA SECURITY INTELLIGENCE REPORT', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(14).text(`WEEKLY SPOTLIGHT - ${getWeekLabel()}`, { align: 'center' });
      doc.moveDown(1.5);
  
      // ✅ Now the map will render correctly
      doc.image(mapBuffer, { width: 400 }).moveDown();
  
      const pieChartUrl = await generateChart('pie', 'Incident Breakdown', stats.byType);
      const barChartUrl = await generateChart('bar', 'Summary Statistics', {
        'States Affected': stats.states.size,
        'Total Incidents': data.length,
        'Abductions': stats.abducted,
        'Fatalities': stats.fatalities
      });
      const timelineChartUrl = await generateChart('line', 'Incident Timeline', stats.byDate);
  
      doc.image(await getImageBuffer(pieChartUrl), { width: 400 }).moveDown();
      doc.image(await getImageBuffer(barChartUrl), { width: 400 }).moveDown();
      doc.image(await getImageBuffer(timelineChartUrl), { width: 400 }).moveDown();
  
      doc.addPage();
      doc.fontSize(16).text('🗒️ DETAILED INCIDENTS SUMMARY', { underline: true }).moveDown();
      data.slice(0, 15).forEach((item, i) => {
        doc.fontSize(12).text(`${i + 1}. ${item.title}`);
        doc.fontSize(10).fillColor('blue').text(item.link, { link: item.link });
        doc.fontSize(11).fillColor('black').text(item.summary).moveDown();
      });
  
      doc.end();
      stream.pipe(res);
    });
  };
  



function getWeekLabel() {
  const now = new Date();
  const week = Math.ceil(((now - new Date(now.getFullYear(), 0, 1)) / 86400000 + now.getDay() + 1) / 7);
  const start = new Date(now.setDate(now.getDate() - now.getDay() + 1));
  const end = new Date(start); end.setDate(start.getDate() + 6);
  return `Week ${week} | ${start.toDateString()} - ${end.toDateString()}`;
}

function computeStats(data) {
  const stats = {
    byType: {},
    byDate: {},
    states: new Set(),
    abducted: 0,
    fatalities: 0
  };

  data.forEach(item => {
    const type = classifyIncident(item.title + ' ' + item.summary);
    stats.byType[type] = (stats.byType[type] || 0) + 1;
    const date = new Date(item.timestamp).toISOString().split('T')[0];
    stats.byDate[date] = (stats.byDate[date] || 0) + 1;

    (item.states || []).forEach(s => stats.states.add(s));
    stats.abducted += item.abducted || 0;
    stats.fatalities += item.fatalities || 0;
  });
  return stats;
}

function classifyIncident(text) {
  text = text.toLowerCase();
  if (text.includes('kidnap') || text.includes('abduct')) return 'Kidnapping';
  if (text.includes('bandit')) return 'Banditry';
  if (text.includes('herdsmen')) return 'Herders’ Attacks';
  if (text.includes('boko') || text.includes('iswap') || text.includes('ipob')) return 'Terrorism';
  return 'Other';
}

async function generateChart(type, label, dataObj) {
  const chart = new QuickChart();
  chart.setConfig({
    type,
    data: {
      labels: Object.keys(dataObj),
      datasets: [{ label, data: Object.values(dataObj) }]
    }
  });
  chart.setWidth(500).setHeight(300);
  return await chart.getShortUrl();
}

async function getImageBuffer(url) {
  const res = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(res.data, 'binary');
}

function generateFictitiousData() {
  const fakeStates = ['Kaduna', 'Zamfara', 'Benue', 'Borno', 'Imo', 'Katsina'];
  const fakeTitles = [
    'Gunmen abduct 12 in Zamfara village',
    'Bandits attack farmers in Benue',
    'Herders clash leaves 3 dead in Plateau',
    'Suspected IPOB members kill two truck drivers in Imo',
    'Militants bomb oil pipeline in Rivers',
    'Gunmen raid school in Kaduna, abduct students'
  ];
  return fakeTitles.map((t, i) => ({
    title: t,
    link: 'https://example.com/story/' + i,
    summary: 'Details about: ' + t,
    source: 'Fictitious News',
    timestamp: new Date(Date.now() - Math.random() * 6 * 86400000).toISOString(),
    states: [fakeStates[Math.floor(Math.random() * fakeStates.length)]],
    abducted: Math.random() > 0.5 ? Math.floor(Math.random() * 10) : 0,
    fatalities: Math.random() > 0.4 ? Math.floor(Math.random() * 20) : 0
  }));
}

