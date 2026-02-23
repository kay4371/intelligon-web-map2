
// ✅ 1. Load environment variables FIRST
require('dotenv').config();
const express = require('express');
const PDFReportService = require('./pdfReportService');
const pdfService = new PDFReportService();
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const RSSParser = require('rss-parser');
const NodeCache = require('node-cache');
const PDFDocument = require('pdfkit');
const { Readable } = require('stream');
const fs = require('fs');
const sharp = require('sharp');
const GroqService = require('./groqService');
const WhatsAppService = require('./whatsappService');
const InfographicGenerator = require('./infographicGenerator');
const infographicGen = new InfographicGenerator();
global.reportCache = global.reportCache || {};
const app = express();
const port = 3000;

// ✅ 3. Initialize Groq service
const groqService = new GroqService(process.env.GROQ_API_KEY);

// ✅ Pass groqService to enable AI analysis
const whatsappService = new WhatsAppService(
  process.env.WHATSAPP_TOKEN, 
  groqService
);
const Brevo = require('@getbrevo/brevo');

// Initialize Brevo for email list management
let brevoApiInstance = null;
let brevoContactsApi = null;

if (process.env.BREVO_API_KEY) {
  brevoApiInstance = new Brevo.TransactionalEmailsApi();
  brevoApiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);
  
  brevoContactsApi = new Brevo.ContactsApi();
  brevoContactsApi.setApiKey(Brevo.ContactsApiApiKeys.apiKey, process.env.BREVO_API_KEY);
  
  console.log('✅ Brevo: Email list service configured');
}
// // ✅ Pre-configure your Intel group
// const monitoredGroups = new Set([
//   '2349059837622-1620639190@g.us'  // Intel Region News A47
// ]);
// ✅ Configure Intelligence Source Group (where data is fetched FROM)
// ✅ Configure Intelligence Source Group (where data is fetched FROM)
const INTELLIGENCE_SOURCE_GROUP = process.env.INTELLIGENCE_SOURCE_GROUP || '2349059837622-1620639190@g.us';
const monitoredGroups = new Set([
  INTELLIGENCE_SOURCE_GROUP  // Intel Region News A47
]);

// ✅ Configure Report Target Group (where reports are sent TO)
const WHATSAPP_REPORT_RECIPIENT = process.env.WHATSAPP_REPORT_RECIPIENT || '120363420328527467@g.us';
const selectedWhatsAppGroups = new Set();

// ✅ 4. Continue with the rest of your server code...
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Cache for 15 minutes
const newsCache = new NodeCache({ stdTTL: 900 });
const addWeeklySummaryRoute = require('./WeeklyReport');
addWeeklySummaryRoute(app, newsCache, scrapeAllSources);

// ─────────────────────────────────────────────────────────────────
// SECURITY KEYWORDS — strict 3-pass filter
// ─────────────────────────────────────────────────────────────────
const keywords = [
  'bandits','banditry','kidnap','abduct','hostage','ransom',
  'gunmen','armed men','unknown gunmen','boko haram','iswap','ansaru',
  'terror','bomb','ied','suicide vest','explosion','blast',
  'herdsmen','herder','farmer-herder','fulani attack',
  'communal clash','ethnic clash','village attack',
  'ipob','esn','cult','cultists','confraternity','rival gang',
  'militants','insurgents','armed robbery','robbers',
  'soldiers killed','troops killed','police killed','officer killed',
  'military operation','airstrike','air strike','army raid',
  'massacre','mass killing','death toll','bodies found','corpses',
  'displacement','idp','internally displaced',
  'attack on','ambush','shootout','gun battle','firefight',
];

// Must contain at least one Nigeria geographic/institutional marker
const NIGERIA_CONTEXT = [
  'nigeria','nigerian',
  'abuja','lagos','kano','kaduna','borno','zamfara','katsina',
  'sokoto','adamawa','yobe','plateau','benue','niger state',
  'taraba','nasarawa','kebbi','gombe','bauchi','jigawa','kogi','kwara',
  'anambra','enugu','imo','abia','ebonyi','rivers','delta','bayelsa',
  'cross river','akwa ibom','edo','ondo','osun','oyo','ogun','ekiti',
  'nigerian army','nigerian police','nigerian air force','nigerian navy',
  'dss','nscdc','naf ','nnpc','dssc',
  'state government','local government area','lga',
];

// Hard exclusions — these topics must NEVER appear in a security brief
const EXCLUSIONS = [
  // Sports
  'premier league','epl','champions league','la liga','bundesliga',
  'serie a','ligue 1','nba','nfl','mlb','nhl','cricket','tennis',
  'golf','formula 1',' f1 ','transfer fee','footballer','manager sacked',
  'match result','league table','scored a goal','hat trick',
  // International non-Nigeria news
  'el mencho','mexico cartel','colombia','afghanistan','ukraine war',
  'russia ukraine','israel-hamas','gaza strip','west bank','taiwan strait',
  'us politics','trump','biden','democrat','republican',
  // Finance / crypto
  'stock market','cryptocurrency','bitcoin','ethereum','forex trading',
  'interest rate fed','wall street',
  // Entertainment
  'nollywood','music album','concert tour','award show','grammy',
  'afrobeats chart','celebrity wedding','bbnaija','big brother',
  'fashion week','beauty pageant','lifestyle','recipe','restaurant review',
  // Sports personalities (common false positives with Nigerian names)
  'adebayor','osimhen','musa ahmed','john mikel','iheanacho',
];

/**
 * Returns true only if the story is a genuine Nigeria security incident.
 * Three-pass filter: keyword match → Nigeria context → exclusion check.
 */
function isRelevantSecurityStory(title, summary) {
  const text = ((title || '') + ' ' + (summary || '')).toLowerCase();
  if (!keywords.some(k => text.includes(k)))         return false;
  if (!NIGERIA_CONTEXT.some(c => text.includes(c)))  return false;
  if (EXCLUSIONS.some(e => text.includes(e)))         return false;
  return true;
}

const parser = new RSSParser();

// RSS feeds
const rssFeeds = [
  'https://guardian.ng/feed/',
  'https://www.premiumtimesng.com/feed',
  'https://dailypost.ng/feed'
];


/**
 * Check if server is fully awake and ready
 */
function isServerReady() {
  // Check if all services are initialized
  return !!(
    whatsappService && 
    groqService && 
    pdfService &&
    process.uptime() > 10 // At least 10 seconds uptime
  );
}



/**
 * Wait for server to be fully ready (with timeout)
 */
async function waitForServerReady(maxWaitMs = 60000) {
  const startTime = Date.now();
  
  while (!isServerReady()) {
    if (Date.now() - startTime > maxWaitMs) {
      throw new Error('Server failed to become ready within timeout');
    }
    
    console.log('⏳ Waiting for server to fully wake up...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('✅ Server is fully awake and ready');
}


// 🔐 IMPROVED CRON AUTHENTICATION
// ============================================


const cronAuth = (req, res, next) => {
  const cronSecret = process.env.CRON_SECRET || 'suntrenia_cron_2026_x9k3m2p8q5w7n4j6';
  
  // Accept secret from EITHER header OR query parameter
  const providedSecret = req.headers['x-cron-secret'] || req.query.secret;
  
  if (providedSecret !== cronSecret) {
    console.warn('⚠️ Unauthorized cron attempt from:', req.ip);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  console.log('✅ Cron authentication successful');
  next();
};

app.get('/api/debug/chrome', async (req, res) => {
  const fs = require('fs');
  const { execSync } = require('child_process');
  
  const info = {
    CHROME_PATH_ENV: process.env.CHROME_PATH || 'NOT SET',
    checks: {}
  };

  const paths = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser', 
    '/usr/bin/google-chrome',
    '/root/.cache/puppeteer/chrome',
  ];

  for (const p of paths) {
    info.checks[p] = fs.existsSync(p) ? 'EXISTS' : 'NOT FOUND';
  }

  try {
    info.whichChromium = execSync('which chromium 2>/dev/null || echo "not found"').toString().trim();
    info.whichChrome = execSync('which google-chrome 2>/dev/null || echo "not found"').toString().trim();
    info.cacheDir = execSync('ls /root/.cache/puppeteer/chrome/ 2>/dev/null || echo "empty/missing"').toString().trim();
  } catch(e) {
    info.execError = e.message;
  }

  res.json(info);
});




app.get('/api/cron/wake', async (req, res) => {
  console.log('\n⏰ ========================================');
  console.log('🛌 WAKE-UP PING RECEIVED');
  console.log('========================================');
  console.log(`⏰ Time: ${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })} WAT`);
  console.log(`⏱️  Uptime: ${Math.floor(process.uptime())}s`);
  
  try {
    // Wait for server to be ready
    await waitForServerReady(30000); // 30 second timeout
    
    console.log('✅ Server is awake and ready for tasks');
    console.log('========================================\n');
    
    res.json({
      success: true,
      message: 'Server is awake and ready',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        whatsapp: !!process.env.WHATSAPP_TOKEN,
        groq: !!process.env.GROQ_API_KEY,
        email: !!(process.env.BREVO_API_KEY || process.env.EMAIL_USER)
      }
    });
  } catch (error) {
    console.error('❌ Failed to wake server:', error.message);
    res.status(503).json({
      success: false,
      error: 'Server not ready',
      timestamp: new Date().toISOString()
    });
  }
});


// ============================================
// // 🔐 CRON AUTHENTICATION MIDDLEWARE
// // ============================================
// const cronAuth = (req, res, next) => {
//   const cronSecret = process.env.CRON_SECRET || 'your-secret-key-change-this';
//   const providedSecret = req.headers['x-cron-secret'] || req.query.secret;
  
//   if (providedSecret !== cronSecret) {
//     console.warn('⚠️ Unauthorized cron attempt from:', req.ip);
//     return res.status(401).json({ error: 'Unauthorized' });
//   }
//   next();
// };

// ============================================
// HELPER FUNCTIONS
// ============================================

async function fetchFromRSS() {
  const items = [];
  for (const url of rssFeeds) {
    try {
      const response = await axios.get(url, { responseType: 'text' });
      const sanitized = response.data.replace(/&(?!amp;|lt;|gt;|quot;|apos;)/g, '&amp;');
      const feed = await parser.parseString(sanitized);

      feed.items.forEach(item => {
        if (isRelevantSecurityStory(item.title, item.contentSnippet || item.content || '')) {
          items.push({
            title:     item.title,
            link:      item.link,
            summary:   item.contentSnippet || '',
            source:    feed.title,
            timestamp: item.pubDate || item.isoDate,
          });
        }
      });
    } catch (err) {
      console.warn(`⚠️ RSS fetch failed (${url}): ${err.message}`);
    }
  }
  return items;
}

const WORLDNEWS_URL = 'https://api.worldnewsapi.com/search-news?source-country=ng&language=en&number=50&api-key=demo';
async function fetchFromApi() {
  try {
    const resp = await axios.get(WORLDNEWS_URL);
    const articles = resp.data.articles || [];
    return articles
      .filter(a => isRelevantSecurityStory(a.title, a.summary))
      .map(a => ({
        title:     a.title,
        link:      a.url,
        summary:   a.summary || '',
        source:    a.source_name || 'WorldNewsAPI',
        timestamp: a.publishedAt,
      }));
  } catch (err) {
    console.warn(`⚠️ Free API fetch failed: ${err.message}`);
    return [];
  }
}
// ============================================
// OPTIMIZED fetchFromWhatsApp() for Security Groups
// - Fewer messages (20 instead of 100)
// - Lighter filtering (group is already security-focused)
// - Faster AI analysis (top 10 instead of 15)
// ============================================

async function fetchFromWhatsApp() {
  try {
    if (monitoredGroups.size === 0) {
      return [];
    }
    
    console.log(`\n📱 ========== WHATSAPP INTELLIGENCE FETCH ==========`);
    console.log(`⏰ Time: ${new Date().toLocaleString()}`);
    console.log(`👥 Monitoring ${monitoredGroups.size} group(s)`);
    console.log(`📍 Intelligence Source: ${INTELLIGENCE_SOURCE_GROUP}`);
    console.log(`🎯 Mode: OPTIMIZED (Security-Focused Group)`);
    
    const allIncidents = [];
    
    for (const groupId of monitoredGroups) {
      try {
        console.log(`\n🔍 Processing group: ${groupId}`);
        
        // ✅ OPTIMIZED: Fetch only 20 most recent messages (instead of 100)
        console.log('  ↳ Step 1/4: Fetching recent messages...');
        const messages = await whatsappService.getGroupMessages(groupId, 20);
        console.log(`  ✅ Fetched ${messages.length} messages`);
        
        // ✅ OPTIMIZED: Light filtering (most messages are already security-related)
        console.log('  ↳ Step 2/4: Light filtering for quality...');
        const qualityMessages = whatsappService.filterSecurityMessagesLight(messages);
        console.log(`  ✅ Kept ${qualityMessages.length} quality messages`);
        
        if (qualityMessages.length === 0) {
          console.log('  ℹ️ No messages to process');
          continue;
        }
        
        // ✅ OPTIMIZED: Analyze top 10 with AI (instead of 15)
        console.log('  ↳ Step 3/4: Analyzing top 10 with Groq AI...');
        const topMessages = qualityMessages
          .sort((a, b) => b.relevanceScore - a.relevanceScore)
          .slice(0, 10);  // ⬅️ Reduced from 15
        
        const analyzed = await whatsappService.batchAnalyzeIncidents(topMessages);
        console.log(`  ✅ AI analysis complete: ${analyzed.filter(m => m.aiAnalysis).length}/${topMessages.length} successful`);
        
        // Step 4: Convert to news format
        console.log('  ↳ Step 4/4: Converting to news format...');
        const incidents = whatsappService.convertToNewsFormat(analyzed, 'Intel Region News A47');
        console.log(`  ✅ Converted ${incidents.length} incidents`);

        // Log preview
        if (incidents.length > 0) {
          console.log(`\n  📋 Most Recent 3 Incidents:`);
          incidents.slice(0, 3).forEach((inc, index) => {
            console.log(`     ${index + 1}. ${inc.title.substring(0, 80)}...`);
            if (inc.aiAnalysis?.where) {
              console.log(`        📍 ${inc.aiAnalysis.where.lga}, ${inc.aiAnalysis.where.state}`);
            }
          });
        }

        // Log state distribution
        const stateDistribution = {};
        incidents.forEach(inc => {
          const state = inc.aiAnalysis?.where?.state || 'Unknown';
          stateDistribution[state] = (stateDistribution[state] || 0) + 1;
        });

        console.log(`\n  📊 State Distribution:`);
        Object.entries(stateDistribution)
          .sort((a, b) => b[1] - a[1])
          .forEach(([state, count]) => {
            console.log(`     • ${state}: ${count} incident(s)`);
          });
        
        allIncidents.push(...incidents);
        
      } catch (groupError) {
        console.error(`  ❌ Error processing group ${groupId}:`, groupError.message);
      }
    }
    
    console.log(`\n✅ WhatsApp intelligence fetch complete: ${allIncidents.length} total incidents`);
    console.log(`⏱️  Estimated processing time: ~${allIncidents.length * 2} seconds`);
    console.log(`==================================================\n`);
    
    return allIncidents;
    
  } catch (error) {
    console.error('❌ WhatsApp intelligence fetch failed:', error.message);
    return [];
  }
}

// Aggregate all sources
async function scrapeAllSources() {
  const [rss, api, whatsapp] = await Promise.all([
    fetchFromRSS(),
    fetchFromApi(),
    fetchFromWhatsApp()
  ]);
  return [...rss, ...api, ...whatsapp];
}

// State name mapping
const STATE_NAME_MAP = {
  'NG-AB': 'Abia', 'NG-AD': 'Adamawa', 'NG-AK': 'Akwa Ibom', 'NG-AN': 'Anambra',
  'NG-BA': 'Bauchi', 'NG-BE': 'Benue', 'NG-BO': 'Borno', 'NG-BY': 'Bayelsa',
  'NG-CR': 'Cross River', 'NG-DE': 'Delta', 'NG-EB': 'Ebonyi', 'NG-ED': 'Edo',
  'NG-EK': 'Ekiti', 'NG-EN': 'Enugu', 'NG-FC': 'FCT', 'NG-GO': 'Gombe',
  'NG-IM': 'Imo', 'NG-JI': 'Jigawa', 'NG-KD': 'Kaduna', 'NG-KE': 'Kebbi',
  'NG-KN': 'Kano', 'NG-KO': 'Kogi', 'NG-KT': 'Katsina', 'NG-KW': 'Kwara',
  'NG-LA': 'Lagos', 'NG-NA': 'Nasarawa', 'NG-NI': 'Niger', 'NG-OG': 'Ogun',
  'NG-ON': 'Ondo', 'NG-OS': 'Osun', 'NG-OY': 'Oyo', 'NG-PL': 'Plateau',
  'NG-RI': 'Rivers', 'NG-SO': 'Sokoto', 'NG-TA': 'Taraba', 'NG-YO': 'Yobe',
  'NG-ZA': 'Zamfara'
};

function getStateNameFromCode(code) {
  return STATE_NAME_MAP[code] || code;
}

function prepareStateData(severityData) {
  const sorted = Object.entries(severityData)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);
  
  return {
    labels: sorted.map(([id]) => STATE_NAME_MAP[id] || id),
    counts: sorted.map(([, data]) => data.count),
    colors: sorted.map(([, data]) => {
      if (data.severity === 'severe') return '#dc143c';
      if (data.severity === 'moderate') return '#ff8c00';
      return '#ffd700';
    })
  };
}

function prepareTrendData(newsData) {
  const last7Days = {};
  const today = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const key = date.toISOString().split('T')[0];
    last7Days[key] = 0;
  }
  
  newsData.forEach(item => {
    if (item.timestamp) {
      const date = new Date(item.timestamp).toISOString().split('T')[0];
      if (last7Days.hasOwnProperty(date)) {
        last7Days[date]++;
      }
    }
  });
  
  return {
    labels: Object.keys(last7Days).map(d => {
      const date = new Date(d);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }),
    data: Object.values(last7Days)
  };
}

function prepareCategoryData(newsData) {
  const categories = {
    'Kidnapping': 0,
    'Banditry': 0,
    'Terrorism': 0,
    'Communal Clash': 0,
    'Other': 0
  };
  
  newsData.forEach(item => {
    const content = (item.title + ' ' + item.summary).toLowerCase();
    
    if (content.includes('kidnap') || content.includes('abduct')) {
      categories['Kidnapping']++;
    } else if (content.includes('bandit')) {
      categories['Banditry']++;
    } else if (content.includes('boko') || content.includes('iswap') || content.includes('terror')) {
      categories['Terrorism']++;
    } else if (content.includes('herdsmen') || content.includes('communal')) {
      categories['Communal Clash']++;
    } else {
      categories['Other']++;
    }
  });
  
  return categories;
}

async function getMapSvgWithSeverity() {
  try {
    const severityResponse = await axios.get('http://localhost:3000/api/state-severity');
    const severityData = severityResponse.data;
    
    const svgPath = path.join(__dirname, 'public', 'index.html');
    let htmlContent = fs.readFileSync(svgPath, 'utf-8');
    
    const svgStartIndex = htmlContent.indexOf('<svg');
    const svgEndIndex = htmlContent.lastIndexOf('</svg>') + 6;
    
    if (svgStartIndex === -1 || svgEndIndex < 6) {
      console.warn('⚠️ Could not extract SVG from index.html');
      return '';
    }
    
    let svgContent = htmlContent.substring(svgStartIndex, svgEndIndex);
    const $ = cheerio.load(svgContent, { xmlMode: true });
    
    $('style').remove();
    $('path').removeAttr('class');
    
    const $svg = $('svg');
    if (!$svg.attr('width')) $svg.attr('width', '800');
    if (!$svg.attr('height')) $svg.attr('height', '600');
    
    const severityColor = (sev) => {
      if (sev === 'severe') return '#dc143c';
      if (sev === 'moderate') return '#ff8c00';
      return '#ffd700';
    };

    $('path').each((i, elem) => {
      $(elem).attr('fill', '#cccccc');
      $(elem).attr('stroke', '#ffffff');
      $(elem).attr('stroke-width', '0.5');
    });

    let affectedCount = 0;
    
    Object.entries(severityData).forEach(([stateId, data]) => {
      const color = severityColor(data.severity);
      const pathElement = $(`path#${stateId}`);
      
      if (pathElement.length > 0) {
        pathElement.attr('fill', color);
        pathElement.attr('stroke', '#ffffff');
        pathElement.attr('stroke-width', '0.5');
        affectedCount++;
      }
    });

    const modifiedSvg = $.xml();
    console.log(`✅ Map SVG prepared: ${affectedCount} states colored`);
    
    return modifiedSvg;
    
  } catch (error) {
    console.error('❌ Map SVG generation error:', error.message);
    return '';
  }
}

function prepareStateDataForPDF(severityData) {
  const sorted = Object.entries(severityData)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);
  
  return {
    labels: sorted.map(([id]) => STATE_NAME_MAP[id] || id),
    counts: sorted.map(([, data]) => data.count),
    colors: sorted.map(([, data]) => {
      if (data.severity === 'severe') return '#dc143c';
      if (data.severity === 'moderate') return '#ff8c00';
      return '#ffd700';
    })
  };
}

function prepareTrendDataForPDF(newsData) {
  const last7Days = {};
  const today = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const key = date.toISOString().split('T')[0];
    last7Days[key] = 0;
  }
  
  newsData.forEach(item => {
    if (item.timestamp) {
      const date = new Date(item.timestamp).toISOString().split('T')[0];
      if (last7Days.hasOwnProperty(date)) {
        last7Days[date]++;
      }
    }
  });
  
  return {
    labels: Object.keys(last7Days).map(d => {
      const date = new Date(d);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }),
    data: Object.values(last7Days)
  };
}

function prepareCategoryDataForPDF(newsData) {
  const categories = {
    'Kidnapping': 0,
    'Banditry': 0,
    'Terrorism': 0,
    'Communal Clash': 0,
    'Other': 0
  };
  
  newsData.forEach(item => {
    const content = (item.title + ' ' + item.summary).toLowerCase();
    
    if (content.includes('kidnap') || content.includes('abduct')) {
      categories['Kidnapping']++;
    } else if (content.includes('bandit')) {
      categories['Banditry']++;
    } else if (content.includes('boko') || content.includes('iswap') || content.includes('terror')) {
      categories['Terrorism']++;
    } else if (content.includes('herdsmen') || content.includes('communal')) {
      categories['Communal Clash']++;
    } else {
      categories['Other']++;
    }
  });
  
  return categories;
}


// EXAMPLE: WhatsApp Fetch Endpoint
app.post('/api/cron/whatsapp-fetch', cronAuth, async (req, res) => {
  console.log('\n🤖 ========================================');
  console.log('⏰ CRON TRIGGERED: WhatsApp Intelligence Fetch');
  console.log('========================================');
  console.log(`⏰ Time: ${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })} WAT`);
  console.log(`⏱️  Uptime: ${Math.floor(process.uptime())}s`);
  
  // ✅ RESPOND IMMEDIATELY
  res.status(202).json({
    success: true,
    message: 'WhatsApp fetch job started',
    timestamp: new Date().toISOString()
  });
  
  // ✅ PROCESS ASYNCHRONOUSLY
  setImmediate(async () => {
    try {
      await waitForServerReady(30000);
      
      console.log('📱 Starting WhatsApp intelligence fetch...');
      const whatsappData = await fetchFromWhatsApp();
      
      // Update cache
      newsCache.set('whatsapp_latest', whatsappData, 86400);
      const existingNews = newsCache.get('news') || [];
      const otherSources = existingNews.filter(item => 
        !item.source || !item.source.includes('WhatsApp')
      );
      const combinedNews = [...otherSources, ...whatsappData];
      newsCache.set('news', combinedNews);
      
      console.log(`✅ WhatsApp fetch completed successfully`);
      console.log(`📊 Fetched: ${whatsappData.length} incidents`);
      console.log(`💾 Total cached: ${combinedNews.length} incidents`);
      console.log('========================================\n');
      
    } catch (error) {
      console.error('❌ WhatsApp fetch failed:', error.message);
      console.error('Stack:', error.stack);
    }
  });
});


// EXAMPLE: Email Report Endpoint
app.post('/api/cron/email-report', cronAuth, async (req, res) => {
  console.log('\n📧 ========================================');
  console.log('⏰ CRON TRIGGERED: Email Report');
  console.log('========================================');
  console.log(`⏰ Time: ${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })} WAT`);
  console.log(`⏱️  Uptime: ${Math.floor(process.uptime())}s`);
  
  // ✅ RESPOND IMMEDIATELY (within 30 seconds)
  res.status(202).json({
    success: true,
    message: 'Email report job started',
    timestamp: new Date().toISOString()
  });
  
  // ✅ PROCESS ASYNCHRONOUSLY (can take as long as needed)
  setImmediate(async () => {
    try {
      // Ensure server is ready
      await waitForServerReady(30000);
      
      // ✅ Get manual recipients from .env
      const manualRecipients = process.env.REPORT_EMAIL_RECIPIENTS
        ? process.env.REPORT_EMAIL_RECIPIENTS.split(',').map(e => e.trim()).filter(e => e)
        : [];

      // ✅ Also fetch subscribers from Brevo list (reuses existing brevoContactsApi)
      let brevoSubscribers = [];
      if (brevoContactsApi) {
        try {
          const contactsResponse = await brevoContactsApi.getContactsFromList(2, undefined, 500);
          brevoSubscribers = (contactsResponse.body?.contacts || [])
            .map(c => c.email)
            .filter(e => e);
          console.log(`📋 Brevo subscribers fetched: ${brevoSubscribers.length}`);
        } catch (err) {
          console.warn('⚠️ Could not fetch Brevo subscribers:', err.message);
        }
      }

      // ✅ Merge both lists, remove duplicates
      const emailList = [...new Set([...manualRecipients, ...brevoSubscribers])];

      if (emailList.length === 0) {
        throw new Error('No recipients configured — add REPORT_EMAIL_RECIPIENTS to .env or get subscribers');
      }

      console.log(`📬 Sending to ${emailList.length} recipient(s): ${emailList.join(', ')}`);
      
      const results = [];
      
      for (const email of emailList) {
        try {
          console.log(`   → Sending to ${email}...`);
          
          // Generate and send report
          const [news, affectedStates, incidentSummary, severityData] = await Promise.all([
            scrapeAllSources(),
            axios.get('http://localhost:3000/api/affected-states').then(r => r.data).catch(() => ({ affected: [] })),
            axios.get('http://localhost:3000/api/incident-summary').then(r => r.data).catch(() => ({})),
            axios.get('http://localhost:3000/api/state-severity').then(r => r.data).catch(() => ({}))
          ]);

          let aiBriefing = '';
          try {
            const briefingRes = await axios.get('http://localhost:3000/api/briefing/weekly', { timeout: 25000 });
            aiBriefing = briefingRes.data.briefing;
          } catch (err) {
            aiBriefing = 'AI briefing generation timed out.';
          }

          const mapSvg = await getMapSvgWithSeverity();
          const stateData = prepareStateDataForPDF(severityData);
          const trendData = prepareTrendDataForPDF(news);
          const categoryData = prepareCategoryDataForPDF(news);
          const affectedStateNames = (affectedStates.affected || []).map(code => STATE_NAME_MAP[code] || code);

          const reportData = {
            incidents: news,
            aiBriefing,
            statesAffected: affectedStates.affected?.length || 0,
            affectedStates: affectedStates.affected || [],
            affectedStateNames,
            casualties: incidentSummary.fatalities || 0,
            abductions: incidentSummary.abducted || 0,
            stateData,
            trendData,
            categoryData,
            mapSvg
          };

          const doc = await pdfService.generateEnhancedReport(reportData, {
            includeAIAnalysis: true,
            reportType: 'weekly'
          });

          const pdfBuffer = await pdfService.streamToBuffer(doc);
          const emailResult = await pdfService.sendReportEmail(
            email,
            pdfBuffer,
            `suntrenia-report-weekly-${Date.now()}.pdf`
          );
          
          if (emailResult.success) {
            console.log(`   ✅ Sent to ${email}`);
            results.push({ email, success: true, messageId: emailResult.messageId });
          } else {
            console.log(`   ❌ Failed for ${email}: ${emailResult.error}`);
            results.push({ email, success: false, error: emailResult.error });
          }
          
          // Rate limiting
          if (emailList.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
        } catch (emailError) {
          console.error(`   ❌ Error sending to ${email}:`, emailError.message);
          results.push({ email, success: false, error: emailError.message });
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      console.log(`\n📊 Email Report Summary:`);
      console.log(`   ✅ Sent: ${successCount}/${emailList.length}`);
      console.log(`   ❌ Failed: ${emailList.length - successCount}`);
      console.log(`   📋 Manual: ${manualRecipients.length} | Brevo: ${brevoSubscribers.length}`);
      console.log('========================================\n');
      
    } catch (error) {
      console.error('❌ Email report failed:', error.message);
      console.error('Stack:', error.stack);
    }
  });
});

// ============================================
// REPLACE YOUR WHATSAPP REPORT ENDPOINT IN server.js
// ============================================
// ============================================
// REPLACE WHATSAPP REPORT ENDPOINT - ASYNC VERSION
// Responds in <10s, processes in background
// ============================================
app.post('/api/cron/whatsapp-report', cronAuth, async (req, res) => {
  console.log('\n📱 ========================================');
  console.log('⏰ CRON TRIGGERED: WhatsApp Infographic Report');
  console.log('========================================');
  
  res.status(202).json({
    success: true,
    message: 'Infographic report job started',
    timestamp: new Date().toISOString()
  });
  
  (async () => {
    try {
      await waitForServerReady(30000);
      
      console.log('📊 Step 1/4: Collecting intelligence data...');
      const [news, affectedStates, incidentSummary, severityData] = await Promise.allSettled([
        scrapeAllSources(),
        axios.get('http://localhost:3000/api/affected-states').then(r => r.data),
        axios.get('http://localhost:3000/api/incident-summary').then(r => r.data),
        axios.get('http://localhost:3000/api/state-severity').then(r => r.data)
      ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : {}));

      console.log(`   ✅ Collected: ${news.length} incidents`);

      // Get AI briefing
      let aiBriefing = '';
      try {
        const briefingRes = await axios.get('http://localhost:3000/api/briefing/weekly', { timeout: 25000 });
        aiBriefing = briefingRes.data.briefing;
      } catch (err) {
        aiBriefing = 'AI briefing generation timed out.';
      }

      // Prepare all data BEFORE building reportData
      const mapSvg = await getMapSvgWithSeverity().catch(() => '');
      const stateData = prepareStateDataForPDF(severityData);
      const trendData = prepareTrendDataForPDF(news);
      const categoryData = prepareCategoryDataForPDF(news);

      const reportData = {
        incidents: news,
        statesAffected: affectedStates.affected?.length || 0,
        affectedStates: affectedStates.affected || [],
        affectedStateNames: (affectedStates.affected || []).map(code => STATE_NAME_MAP[code] || code),
        casualties: incidentSummary.fatalities || 0,
        abductions: incidentSummary.abducted || 0,
        aiBriefing,
        mapSvg,
        stateData,
        trendData,
        categoryData
      };
      
      // Generate PDF (for download)
      console.log('📄 Step 2/4: Generating PDF report...');
      const doc = await pdfService.generateEnhancedReport(reportData, {
        includeAIAnalysis: true,
        reportType: 'weekly'
      });
      
      const pdfBuffer = await pdfService.streamToBuffer(doc);
      const pdfSizeMB = (pdfBuffer.length / 1024 / 1024).toFixed(2);
      console.log(`   ✅ PDF generated (${pdfSizeMB} MB)`);
      
      // Save PDF temporarily for downloads
      const reportId = `report-${Date.now()}`;
      global.reportCache = global.reportCache || {};
      // global.reportCache[reportId] = {
      //   buffer: pdfBuffer,
      //   createdAt: Date.now(),
      //   reportData: reportData
      // };
      // Save to disk so it survives restarts
      const reportsDir = path.join(__dirname, 'reports');
      if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir);
      fs.writeFileSync(path.join(reportsDir, `${reportId}.pdf`), pdfBuffer);

      global.reportCache[reportId] = {
        buffer: pdfBuffer,
        createdAt: Date.now()
      };
      // Generate beautiful infographic
      console.log('🎨 Step 3/4: Creating infographic...');
      const infographicBuffer = await infographicGen.generateInfographic(reportData);
      console.log(`   ✅ Infographic created (${(infographicBuffer.length / 1024).toFixed(2)} KB)`);
      
      // Send to WhatsApp
      console.log('📱 Step 4/4: Sending to WhatsApp...');
      
      // First: Send the beautiful infographic
      const imageBase64 = infographicBuffer.toString('base64');
      const imageMediaString = `data:image/png;name=intelligence-brief.png;base64,${imageBase64}`;
      
      await whatsappService.sendImage(
        WHATSAPP_REPORT_RECIPIENT,
        imageMediaString,
        `🛡️ *WEEKLY INTELLIGENCE BRIEF*\n\nVisual summary of security incidents this week.`
      );
      
      console.log('   ✅ Infographic sent');
      
      // Second: Send message with download link
      const downloadUrl = `https://intelligon-web-map2.onrender.com/api/reports/download/${reportId}`;
      // const downloadUrl = `https://intelligon-web-map-new-with-trigger.onrender.com/intelligence/download?id=${reportId}`;
      const message = `📊 *FULL DETAILED REPORT AVAILABLE*\n\n` +
        `✨ Get the complete 7-page PDF report with:\n` +
        `• Detailed incident analysis\n` +
        `• Interactive security maps\n` +
        `• AI-powered insights\n` +
        `• State-by-state breakdown\n\n` +
        `📥 *Download for FREE:*\n${downloadUrl}\n\n` +
        `⚡ Limited time access • No spam • Instant download`;
      
      await whatsappService.sendTextMessage(WHATSAPP_REPORT_RECIPIENT, message);
      
      console.log('   ✅ Download link sent');
      console.log(`\n📊 Report Summary:`);
      console.log(`   📸 Infographic: Sent`);
      console.log(`   🔗 Download URL: ${downloadUrl}`);
      console.log(`   📄 PDF Size: ${pdfSizeMB} MB`);
      console.log(`   📊 Incidents: ${news.length}`);
      console.log('========================================\n');
      
    } catch (error) {
      console.error('❌ Infographic report failed:', error.message);
      console.error('Stack:', error.stack);
    }
  })();
});
/**
 * ✅ ENDPOINT 4: Health Check
 */
app.get('/api/health', (req, res) => {
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: `${hours}h ${minutes}m`,
    ready: isServerReady(),
    services: {
      whatsapp: !!process.env.WHATSAPP_TOKEN,
      groq: !!process.env.GROQ_API_KEY,
      email: !!(process.env.BREVO_API_KEY || process.env.EMAIL_USER)
    }
  });
});


/**
 * ✅ ENDPOINT 5: Manual Test
 */
app.post('/api/cron/test', cronAuth, async (req, res) => {
  const { action } = req.body;
  
  console.log(`🧪 Manual test triggered: ${action}`);
  
  try {
    await waitForServerReady(30000);
    
    let result;
    
    switch(action) {
      case 'whatsapp-fetch':
        result = await fetchFromWhatsApp();
        break;
      case 'email':
        const testEmail = process.env.REPORT_EMAIL_RECIPIENTS?.split(',')[0]?.trim();
        if (!testEmail) throw new Error('No email configured');
        // Trigger email report internally
        const emailReq = await axios.post('http://localhost:3000/api/cron/email-report', {}, {
          headers: { 'x-cron-secret': process.env.CRON_SECRET }
        });
        result = emailReq.data;
        break;
      case 'whatsapp-report':
        const whatsappReq = await axios.post('http://localhost:3000/api/cron/whatsapp-report', {}, {
          headers: { 'x-cron-secret': process.env.CRON_SECRET }
        });
        result = whatsappReq.data;
        break;
      default:
        throw new Error('Invalid action. Use: whatsapp-fetch, email, or whatsapp-report');
    }
    
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
// ============================================
// ORIGINAL ENDPOINTS (Keep all existing)
// ============================================

app.get('/api/news', async (req, res) => {
  const cached = newsCache.get('news');
  if (cached) return res.json(cached);

  try {
    const data = await scrapeAllSources();
    newsCache.set('news', data);
    res.json(data);
  } catch (err) {
    console.error('🛠️ ScrapeAll error:', err.message);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

app.get('/api/whatsapp/groups', async (req, res) => {
  try {
    const groups = await whatsappService.getAllGroups();
    res.json({
      success: true,
      count: groups.length,
      monitored: Array.from(monitoredGroups),
      groups: groups.map(g => ({
        ...g,
        isMonitored: monitoredGroups.has(g.id)
      }))
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch groups', 
      details: error.message 
    });
  }
});

app.post('/api/whatsapp/groups/remove', async (req, res) => {
  try {
    const { groupId } = req.body;
    if (!groupId) {
      return res.status(400).json({ error: 'groupId is required' });
    }
    monitoredGroups.delete(groupId);
    res.json({
      success: true,
      message: 'Group removed from monitoring',
      monitoredGroups: Array.from(monitoredGroups)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove group', details: error.message });
  }
});

app.get('/api/state-severity', async (req, res) => {
  try {
    const allNews = await scrapeAllSources();
    const stateSeverity = {};
    const stateKeywords = {
      'NG-AB': ['abia'], 'NG-AD': ['adamawa'], 'NG-AK': ['akwa ibom','akwaibom'],
      'NG-AN': ['anambra'], 'NG-BA': ['bauchi'], 'NG-BE': ['benue'],
      'NG-BO': ['borno'], 'NG-BY': ['bayelsa'], 'NG-CR': ['cross river'],
      'NG-DE': ['delta'], 'NG-EB': ['ebonyi'], 'NG-ED': ['edo'],
      'NG-EK': ['ekiti'], 'NG-EN': ['enugu'], 'NG-FC': ['fct','abuja'],
      'NG-GO': ['gombe'], 'NG-IM': ['imo'], 'NG-JI': ['jigawa'],
      'NG-KD': ['kaduna'], 'NG-KE': ['kebbi'], 'NG-KN': ['kano'],
      'NG-KO': ['kogi'], 'NG-KT': ['katsina'], 'NG-KW': ['kwara'],
      'NG-LA': ['lagos'], 'NG-NA': ['nasarawa','nassarawa'], 'NG-NI': ['niger'],
      'NG-OG': ['ogun'], 'NG-ON': ['ondo'], 'NG-OS': ['osun'],
      'NG-OY': ['oyo'], 'NG-PL': ['plateau'], 'NG-RI': ['rivers'],
      'NG-SO': ['sokoto'], 'NG-TA': ['taraba'], 'NG-YO': ['yobe'],
      'NG-ZA': ['zamfara']
    };

    for (const [stateId, terms] of Object.entries(stateKeywords)) {
      let count = 0;
      
      allNews.forEach(article => {
        const content = (article.title + ' ' + article.summary).toLowerCase();
        const matchesKeyword = terms.some(t => content.includes(t));
        const matchesAILocation = article.aiAnalysis?.where?.state?.toLowerCase() === terms[0].toLowerCase();
        
        if (matchesKeyword || matchesAILocation) {
          count++;
        }
      });
      
      let severity = 'mild';
      if (count >= 10) severity = 'severe';
      else if (count >= 5) severity = 'moderate';
      
      if (count > 0) {
        stateSeverity[stateId] = { count: count, severity: severity };
      }
    }
    
    res.json(stateSeverity);
  } catch (err) {
    console.error('❌ State severity error:', err);
    res.status(500).json({ error: 'Failed to calculate state severity' });
  }
});

app.get('/api/affected-states', async (req, res) => {
  const news = newsCache.get('news') || await scrapeAllSources();
  const stateKeywords = {
    'NG-AB': ['abia'], 'NG-AD': ['adamawa'], 'NG-AK': ['akwa ibom','akwaibom'],
    'NG-AN': ['anambra'], 'NG-BA': ['bauchi'], 'NG-BE': ['benue'],
    'NG-BO': ['borno'], 'NG-BY': ['bayelsa'], 'NG-CR': ['cross river'],
    'NG-DE': ['delta'], 'NG-EB': ['ebonyi'], 'NG-ED': ['edo'],
    'NG-EK': ['ekiti'], 'NG-EN': ['enugu'], 'NG-FC': ['fct','abuja'],
    'NG-GO': ['gombe'], 'NG-IM': ['imo'], 'NG-JI': ['jigawa'],
    'NG-KD': ['kaduna'], 'NG-KE': ['kebbi'], 'NG-KN': ['kano'],
    'NG-KO': ['kogi'], 'NG-KT': ['katsina'], 'NG-KW': ['kwara'],
    'NG-LA': ['lagos'], 'NG-NA': ['nasarawa','nassarawa'], 'NG-NI': ['niger'],
    'NG-OG': ['ogun'], 'NG-ON': ['ondo'], 'NG-OS': ['osun'],
    'NG-OY': ['oyo'], 'NG-PL': ['plateau'], 'NG-RI': ['rivers'],
    'NG-SO': ['sokoto'], 'NG-TA': ['taraba'], 'NG-YO': ['yobe'],
    'NG-ZA': ['zamfara']
  };

  const affected = new Set();
  for (const article of news) {
    const content = (article.title + ' ' + article.summary).toLowerCase();
    for (const [stateId, terms] of Object.entries(stateKeywords)) {
      if (terms.some(t => content.includes(t))) {
        affected.add(stateId);
      }
    }
  }
  res.json({ affected: Array.from(affected) });
});

app.get('/api/incident-summary', async (req, res) => {
  const news = newsCache.get('news') || await scrapeAllSources();
  const incidents = news.length;
  const abducted = news.filter(item => 
    (item.title + item.summary).toLowerCase().includes('kidnap') ||
    (item.title + item.summary).toLowerCase().includes('abduct')
  ).length;
  const fatalities = news.filter(item => 
    (item.title + item.summary).toLowerCase().includes('kill') ||
    (item.title + item.summary).toLowerCase().includes('death')
  ).length * 3;
  const statesResponse = await axios.get('http://localhost:3000/api/affected-states');
  const statesAffected = statesResponse.data.affected.length;
  
  res.json({ incidents, abducted, fatalities, statesAffected });
});

app.get('/api/news/enhanced', async (req, res) => {
  try {
    const cached = newsCache.get('enriched_news');
    if (cached) return res.json(cached);
    const rawNews = newsCache.get('news') || await scrapeAllSources();
    const enrichedNews = await groqService.enrichIncidentData(rawNews);
    newsCache.set('enriched_news', enrichedNews, 1800);
    res.json(enrichedNews);
  } catch (err) {
    res.status(500).json({ error: 'Failed to enrich news data' });
  }
});

app.get('/api/briefing/weekly', async (req, res) => {
  try {
    const news = newsCache.get('news') || await scrapeAllSources();
    const statesResponse = await axios.get('http://localhost:3000/api/affected-states');
    const stats = await axios.get('http://localhost:3000/api/incident-summary').then(r => r.data);
    const briefing = await groqService.generateWeeklyBriefing(stats, news, statesResponse.data.affected);
    res.json({ briefing, generatedAt: new Date(), stats, affectedStates: statesResponse.data.affected.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate briefing' });
  }
});

app.get('/api/reports/generate', async (req, res) => {
  try {
    const { type = 'weekly' } = req.query;
    const [news, affectedStatesRes, incidentSummaryRes, severityData] = await Promise.all([
      scrapeAllSources(),
      axios.get('http://localhost:3000/api/affected-states').then(r => r.data).catch(() => ({ affected: [] })),
      axios.get('http://localhost:3000/api/incident-summary').then(r => r.data).catch(() => ({ incidents: 0, fatalities: 0, abducted: 0, statesAffected: 0 })),
      axios.get('http://localhost:3000/api/state-severity').then(r => r.data).catch(() => ({}))
    ]);

    let aiBriefing = '';
    try {
      const briefingRes = await axios.get('http://localhost:3000/api/briefing/weekly', { timeout: 25000 });
      aiBriefing = briefingRes.data.briefing;
    } catch (err) {
      aiBriefing = 'AI briefing generation timed out.';
    }

    const stateData = prepareStateDataForPDF(severityData);
    const trendData = prepareTrendDataForPDF(news);
    const categoryData = prepareCategoryDataForPDF(news);
    const mapSvg = await getMapSvgWithSeverity();
    const affectedStateNames = (affectedStatesRes.affected || []).map(code => STATE_NAME_MAP[code] || code);

    const reportData = {
      incidents: news,
      aiBriefing,
      statesAffected: affectedStatesRes.affected?.length || 0,
      affectedStates: affectedStatesRes.affected || [],
      affectedStateNames,
      casualties: incidentSummaryRes.fatalities || 0,
      abductions: incidentSummaryRes.abducted || 0,
      stateData,
      trendData,
      categoryData,
      mapSvg
    };

    const doc = await pdfService.generateEnhancedReport(reportData, { includeAIAnalysis: true, reportType: type });
    const filename = `suntrenia-report-${type}-${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);
  } catch (error) {
    console.error('❌ PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
});

app.post('/api/reports/email', async (req, res) => {
  try {
    const { email, reportType = 'weekly' } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const [news, affectedStates, incidentSummary, severityData] = await Promise.all([
      scrapeAllSources(),
      axios.get('http://localhost:3000/api/affected-states').then(r => r.data),
      axios.get('http://localhost:3000/api/incident-summary').then(r => r.data),
      axios.get('http://localhost:3000/api/state-severity').then(r => r.data)
    ]);

    let aiBriefing = '';
    try {
      const briefingRes = await axios.get('http://localhost:3000/api/briefing/weekly');
      aiBriefing = briefingRes.data.briefing;
    } catch (err) {
      aiBriefing = 'AI briefing unavailable.';
    }

    const mapSvg = await getMapSvgWithSeverity();
    const stateData = prepareStateData(severityData);
    const trendData = prepareTrendData(news);
    const categoryData = prepareCategoryData(news);
    const affectedStateNames = affectedStates.affected?.map(code => STATE_NAME_MAP[code] || code) || [];

    const reportData = {
      incidents: news, aiBriefing,
      statesAffected: affectedStates.affected?.length || 0,
      affectedStates: affectedStates.affected || [],
      affectedStateNames,
      casualties: incidentSummary.fatalities || 0,
      abductions: incidentSummary.abducted || 0,
      stateData, trendData, categoryData, mapSvg
    };

    const doc = await pdfService.generateEnhancedReport(reportData, { includeAIAnalysis: true, reportType });
    const pdfBuffer = await pdfService.streamToBuffer(doc);
    const result = await pdfService.sendReportEmail(email, pdfBuffer, `suntrenia-report-${reportType}-${Date.now()}.pdf`);

    if (result.success) {
      res.json({ success: true, message: 'Report sent to ' + email, messageId: result.messageId });
    } else {
      res.status(500).json({ success: false, error: 'Failed to send email' });
    }
  } catch (error) {
    console.error('❌ Email error:', error);
    res.status(500).json({ error: 'Failed to send report' });
  }
});
// ============================================
// Landing Page for Download
// ============================================
app.get('/intelligence/download', (req, res) => {
  const reportId = req.query.id;
  
  if (!reportId || !global.reportCache?.[reportId]) {
    return res.status(404).send('Report not found or expired');
  }
  
  res.sendFile(path.join(__dirname, 'public', 'download.html'));
});


// ============================================
// ✅ GATED DOWNLOAD - Email required, report sent to inbox
// User cannot download directly — must receive via email
// ============================================
app.post('/intelligence/download', async (req, res) => {
  try {
    const { email, reportId } = req.body;

    // Validate inputs
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Valid email required' });
    }

    if (!reportId) {
      return res.status(400).json({ success: false, error: 'Report ID required' });
    }

    // Block disposable emails
    const disposableDomains = [
      'tempmail.com', 'throwaway.email', 'guerrillamail.com',
      'mailinator.com', '10minutemail.com', 'temp-mail.org',
      'fakeinbox.com', 'trashmail.com', 'getnada.com',
      'maildrop.cc', 'yopmail.com', 'mohmal.com', 'sharklasers.com'
    ];
    const domain = email.split('@')[1]?.toLowerCase();
    if (disposableDomains.includes(domain)) {
      return res.status(400).json({ success: false, error: 'Disposable email not allowed. Please use a real email to receive your report.' });
    }

    // Get PDF buffer — check memory then disk
    let pdfBuffer = global.reportCache?.[reportId]?.buffer;

    if (!pdfBuffer) {
      const filePath = path.join(__dirname, 'reports', `${reportId}.pdf`);
      if (fs.existsSync(filePath)) {
        pdfBuffer = fs.readFileSync(filePath);
      }
    }

    if (!pdfBuffer) {
      return res.status(404).json({ success: false, error: 'Report not found or expired. Please request a new report.' });
    }

    console.log(`\n📧 Gated download — sending report to: ${email}`);

    // ✅ SEND report to email — user only gets it if email is real
    const result = await pdfService.sendReportEmail(
      email,
      pdfBuffer,
      `suntrenia-intelligence-report-${reportId}.pdf`
    );

    if (result.success) {
      // Add to Brevo list
      await addToBrevoList(email);

      // Track CPA conversion
      await fetch('http://localhost:3000/api/cpa/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          action: 'gated_download_delivered',
          timestamp: new Date().toISOString()
        })
      }).catch(() => {});

      console.log(`✅ Report delivered to inbox: ${email}`);
      res.json({
        success: true,
        message: `Report sent to ${email}. Please check your inbox (and spam folder).`
      });

    } else {
      console.error(`❌ Failed to deliver to ${email}`);
      res.status(500).json({
        success: false,
        error: 'Failed to send email. Please check the address and try again.'
      });
    }

  } catch (error) {
    console.error('❌ Gated download error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});







app.post('/api/verify-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.json({ valid: false, reason: 'Invalid email format' });
    }
    
    // Block disposable email domains
    const disposableDomains = [
      'tempmail.com', 'throwaway.email', 'guerrillamail.com', 
      'mailinator.com', '10minutemail.com', 'temp-mail.org',
      'fakeinbox.com', 'trashmail.com', 'getnada.com',
      'maildrop.cc', 'yopmail.com', 'mohmal.com', 'sharklasers.com'
    ];
    
    const domain = email.split('@')[1]?.toLowerCase();
    if (disposableDomains.includes(domain)) {
      console.log(`🚫 Blocked disposable email: ${email}`);
      return res.json({ valid: false, reason: 'Disposable email not allowed' });
    }
    
    console.log(`✅ Email verified: ${email}`);
    res.json({ valid: true });
    
  } catch (error) {
    console.error('Email verification error:', error);
    res.json({ valid: true }); // Fail open
  }
});

// Add Email to Brevo List
// ============================================
async function addToBrevoList(email) {
  if (!brevoContactsApi) {
    console.warn('⚠️ Brevo not configured');
    return { success: false };
  }
  
  try {
    const createContact = new Brevo.CreateContact();
    createContact.email = email;
    createContact.attributes = {
      SUBSCRIBED_DATE: new Date().toISOString(),
      SOURCE: 'CPA Landing Page'
    };
    createContact.listIds = [2]; // Your Brevo list ID
    createContact.updateEnabled = true;
    
    await brevoContactsApi.createContact(createContact);
    console.log(`✅ Added to list: ${email}`);
    return { success: true };
    
  } catch (error) {
    if (error.message?.includes('already exists')) {
      console.log(`ℹ️ Already subscribed: ${email}`);
      return { success: true };
    }
    console.error('❌ Brevo error:', error.message);
    return { success: false };
  }
}
// ============================================
// ✅ Premium Subscription Endpoint
// Saves to separate Brevo premium list (List ID 3)
// ============================================
// ============================================
// ✅ Premium Subscription Endpoint
// Verifies Paystack payment then saves to Brevo
// ============================================
app.post('/api/subscribe/premium', async (req, res) => {
  try {
    const { email, name, plan = 'premium', paystackRef } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Valid email required' });
    }

    if (!paystackRef) {
      return res.status(400).json({ success: false, error: 'Payment reference required' });
    }

    // ✅ Verify payment with Paystack API
    console.log(`\n⭐ Verifying Paystack payment: ${paystackRef} for ${email}`);
    const verifyResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${paystackRef}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    const paystackData = verifyResponse.data;

    // Check payment was actually successful
    if (!paystackData.status || paystackData.data?.status !== 'success') {
      console.warn(`⚠️ Payment verification failed for ref: ${paystackRef}`);
      return res.status(400).json({ success: false, error: 'Payment verification failed' });
    }

    // Check email matches what was paid
    if (paystackData.data?.customer?.email?.toLowerCase() !== email.toLowerCase()) {
      console.warn(`⚠️ Email mismatch for ref: ${paystackRef}`);
      return res.status(400).json({ success: false, error: 'Email mismatch with payment' });
    }

    console.log(`✅ Payment verified: ₦${paystackData.data.amount / 100} from ${email}`);

    // ✅ Add to general Brevo list (reuses existing addToBrevoList)
    await addToBrevoList(email);

    // ✅ Add to premium list (List ID 3) using existing brevoContactsApi
    if (brevoContactsApi) {
      try {
        const createContact = new Brevo.CreateContact();
        createContact.email = email;
        createContact.attributes = {
          FIRSTNAME: name || '',
          SUBSCRIBED_DATE: new Date().toISOString(),
          PLAN: plan,
          PAYSTACK_REF: paystackRef,
          SOURCE: 'Premium Subscription Page'
        };
        createContact.listIds = [2, 3]; // General + Premium lists
        createContact.updateEnabled = true;
        await brevoContactsApi.createContact(createContact);
        console.log(`✅ Added to premium Brevo list: ${email}`);
      } catch (err) {
        if (!err.message?.includes('already exists')) {
          console.warn('⚠️ Brevo premium list error:', err.message);
        }
      }
    }

    // ✅ Send welcome email using existing brevoApiInstance
    if (brevoApiInstance) {
      try {
        const sendSmtpEmail = new Brevo.SendSmtpEmail();
        sendSmtpEmail.to = [{ email, name: name || 'Subscriber' }];
        sendSmtpEmail.subject = '🛡️ Welcome to Suntrenia Premium — You\'re In!';
        sendSmtpEmail.htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; color: #fff; padding: 40px; border-radius: 12px;">
            <h1 style="color: #e94560; text-align: center;">SUNTRENIA</h1>
            <h2 style="text-align: center; color: #fff;">Welcome to Premium, ${name || 'Subscriber'}! 🎉</h2>
            <p style="color: #ffffff90; line-height: 1.6; margin-bottom: 20px;">Your payment of ₦${paystackData.data.amount / 100} has been confirmed. You now have full premium access.</p>
            <p style="color: #ffffff90; line-height: 1.6;">Every week you'll automatically receive:</p>
            <ul style="color: #ffffff90; line-height: 2; margin: 15px 0;">
              <li>📊 Full weekly intelligence report (PDF)</li>
              <li>🗺️ Nigeria state-by-state threat map</li>
              <li>🤖 AI-powered security briefings</li>
              <li>📈 Trend data & forecasts</li>
              <li>⚡ Daily briefings (coming soon)</li>
            </ul>
            <p style="color: #ffffff80; font-size: 0.85em; margin-top: 15px;">Payment Reference: ${paystackRef}</p>
            <p style="color: #ffffff60; font-size: 0.8em; margin-top: 30px; text-align: center;">
              To cancel or get support, reply to this email.<br>30-day money-back guarantee applies.
            </p>
          </div>
        `;
        sendSmtpEmail.sender = {
          name: process.env.EMAIL_FROM_NAME || 'Suntrenia Intelligence',
          email: process.env.EMAIL_FROM || process.env.EMAIL_USER
        };
        await brevoApiInstance.sendTransacEmail(sendSmtpEmail);
        console.log(`✅ Welcome email sent to: ${email}`);
      } catch (err) {
        console.warn('⚠️ Welcome email failed (non-fatal):', err.message);
      }
    }

    // ✅ Track CPA conversion (reuses existing endpoint)
    await fetch('http://localhost:3000/api/cpa/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        action: 'premium_payment_confirmed',
        paystackRef,
        amount: paystackData.data.amount / 100,
        timestamp: new Date().toISOString()
      })
    }).catch(() => {});

    console.log(`⭐ Premium activation complete for: ${email}`);
    res.json({
      success: true,
      message: `Premium activated! Reports will be sent to ${email}`
    });

  } catch (error) {
    console.error('❌ Premium subscription error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ✅ Subscriber Count (for social proof on premium page)
// ============================================
app.get('/api/subscribers/count', async (req, res) => {
  try {
    if (!brevoContactsApi) {
      return res.json({ count: 0 });
    }
    const response = await brevoContactsApi.getContactsFromList(2, undefined, 1);
    const count = response.body?.count || 0;
    res.json({ count });
  } catch (err) {
    console.warn('⚠️ Could not fetch subscriber count:', err.message);
    res.json({ count: 0 });
  }
});
// ============================================
// Send Report to Email Endpoint
// ============================================
app.post('/api/reports/send-to-email', async (req, res) => {
  try {
    const { email, reportType = 'weekly' } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email required' });
    }
    
    console.log(`\n📧 Sending report to: ${email}`);
    
    // Use existing email function from pdfReportService
    const [news, affectedStates, incidentSummary, severityData] = await Promise.all([
      scrapeAllSources(),
      axios.get('http://localhost:3000/api/affected-states').then(r => r.data).catch(() => ({ affected: [] })),
      axios.get('http://localhost:3000/api/incident-summary').then(r => r.data).catch(() => ({})),
      axios.get('http://localhost:3000/api/state-severity').then(r => r.data).catch(() => ({}))
    ]);
    
    let aiBriefing = '';
    try {
      const briefingRes = await axios.get('http://localhost:3000/api/briefing/weekly', { timeout: 20000 });
      aiBriefing = briefingRes.data.briefing;
    } catch (err) {
      aiBriefing = 'AI briefing unavailable.';
    }
    
    const mapSvg = await getMapSvgWithSeverity().catch(() => '');
    const stateData = prepareStateDataForPDF(severityData);
    const trendData = prepareTrendDataForPDF(news);
    const categoryData = prepareCategoryDataForPDF(news);
    const affectedStateNames = (affectedStates.affected || []).map(code => STATE_NAME_MAP[code] || code);
    
    const reportData = {
      incidents: news,
      aiBriefing,
      statesAffected: affectedStates.affected?.length || 0,
      affectedStates: affectedStates.affected || [],
      affectedStateNames,
      casualties: incidentSummary.fatalities || 0,
      abductions: incidentSummary.abducted || 0,
      stateData,
      trendData,
      categoryData,
      mapSvg
    };
    
    const doc = await pdfService.generateEnhancedReport(reportData, {
      includeAIAnalysis: true,
      reportType
    });
    
    const pdfBuffer = await pdfService.streamToBuffer(doc);
    const result = await pdfService.sendReportEmail(email, pdfBuffer, `suntrenia-report-${Date.now()}.pdf`);
    
    if (result.success) {
      // Add to Brevo list
      await addToBrevoList(email);
      
      // Track conversion
      await fetch('http://localhost:3000/api/cpa/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          action: 'report_delivered',
          timestamp: new Date().toISOString()
        })
      }).catch(() => {});
      
      console.log(`✅ Report sent successfully to ${email}`);
      res.json({ success: true, message: 'Report sent', messageId: result.messageId });
    } else {
      res.status(500).json({ success: false, error: 'Failed to send email' });
    }
    
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CPA Tracking Endpoint
// ============================================
app.post('/api/cpa/track', async (req, res) => {
  try {
    const { email, action, timestamp } = req.body;
    
    console.log(`💰 ========================================`);
    console.log(`💰 CPA CONVERSION TRACKED`);
    console.log(`========================================`);
    console.log(`📧 Email: ${email}`);
    console.log(`🎯 Action: ${action || 'signup'}`);
    console.log(`⏰ Time: ${timestamp || new Date().toISOString()}`);
    console.log(`========================================\n`);
    
    // TODO: Integrate with CPA network
    // Example: CPALead, MaxBounty, etc.
    
    res.json({ success: true, message: 'Tracked' });
    
  } catch (error) {
    console.error('❌ CPA tracking error:', error);
    res.status(500).json({ success: false });
  }
});
// ============================================
// PDF Download Endpoint
// ============================================
// app.get('/api/reports/download/:reportId', (req, res) => {
//   const { reportId } = req.params;
  
//   const report = global.reportCache?.[reportId];
  
//   if (!report) {
//     return res.status(404).json({ error: 'Report not found or expired' });
//   }
  
//   // Check if report is older than 24 hours
//   const age = Date.now() - report.createdAt;
//   if (age > 24 * 60 * 60 * 1000) {
//     delete global.reportCache[reportId];
//     return res.status(410).json({ error: 'Report expired' });
//   }
  
//   console.log(`📥 Download: ${reportId}`);
  
//   res.setHeader('Content-Type', 'application/pdf');
//   res.setHeader('Content-Disposition', `attachment; filename="suntrenia-intelligence-${reportId}.pdf"`);
//   res.send(report.buffer);
  
//   // Clean up old reports (older than 48 hours)
//   Object.keys(global.reportCache).forEach(id => {
//     const reportAge = Date.now() - global.reportCache[id].createdAt;
//     if (reportAge > 48 * 60 * 60 * 1000) {
//       delete global.reportCache[id];
//     }
//   });
// });
app.get('/api/reports/download/:reportId', (req, res) => {
  const { reportId } = req.params;
  
  // Check memory cache first
  let pdfBuffer = global.reportCache?.[reportId]?.buffer;
  const cachedReport = global.reportCache?.[reportId];
  
  // Check if memory cache exists but is expired (24 hours)
  if (cachedReport) {
    const age = Date.now() - cachedReport.createdAt;
    if (age > 24 * 60 * 60 * 1000) {
      delete global.reportCache[reportId];
      pdfBuffer = null;
    }
  }
  
  // ✅ NEW: If not in memory, check disk (survives Render restarts)
  if (!pdfBuffer) {
    const filePath = path.join(__dirname, 'reports', `${reportId}.pdf`);
    if (fs.existsSync(filePath)) {
      // Check disk file age too (24 hours)
      const fileStat = fs.statSync(filePath);
      const fileAge = Date.now() - fileStat.mtimeMs;
      if (fileAge > 24 * 60 * 60 * 1000) {
        fs.unlinkSync(filePath); // Delete expired file
        return res.status(410).json({ error: 'Report expired' });
      }
      pdfBuffer = fs.readFileSync(filePath);
    }
  }
  
  if (!pdfBuffer) {
    return res.status(404).json({ error: 'Report not found or expired' });
  }
  
  console.log(`📥 Download: ${reportId}`);
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="suntrenia-intelligence-${reportId}.pdf"`);
  res.send(pdfBuffer);
  
  // ✅ Clean up old reports from memory (older than 48 hours)
  if (global.reportCache) {
    Object.keys(global.reportCache).forEach(id => {
      const reportAge = Date.now() - global.reportCache[id].createdAt;
      if (reportAge > 48 * 60 * 60 * 1000) {
        delete global.reportCache[id];
      }
    });
  }
  
  // ✅ Clean up old files from disk (older than 48 hours)
  const reportsDir = path.join(__dirname, 'reports');
  if (fs.existsSync(reportsDir)) {
    fs.readdirSync(reportsDir).forEach(file => {
      const filePath = path.join(reportsDir, file);
      const fileStat = fs.statSync(filePath);
      const fileAge = Date.now() - fileStat.mtimeMs;
      if (fileAge > 48 * 60 * 60 * 1000) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Cleaned up expired report: ${file}`);
      }
    });
  }
});
app.listen(port, () => {
  console.log(`\n✅ ========================================`);
  console.log(`🚀 Suntrenia Intelligence Server Started`);
  console.log(`========================================`);
  console.log(`📡 Server: http://localhost:${port}`);
  console.log(`🤖 Groq AI: ${process.env.GROQ_API_KEY ? '✅ ENABLED' : '❌ DISABLED'}`);
  console.log(`📱 WhatsApp: ${process.env.WHATSAPP_TOKEN ? '✅ ENABLED' : '❌ DISABLED'}`);
  console.log(`👥 Monitored Groups: ${monitoredGroups.size}`);
  console.log(`\n🤖 CRON ENDPOINTS:`);
  console.log(`   • POST /api/cron/whatsapp-fetch (Daily)`);
  console.log(`   • POST /api/cron/email-report (Weekly)`);
  console.log(`   • POST /api/cron/whatsapp-report (Every 3 days)`);
  console.log(`   • GET  /api/health (Every 10 min)`);
  console.log(`========================================\n`);
});

// ============================================
// Infographic Generator Page
// ============================================
app.get('/infographic', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'infographic.html'));
});

// ============================================
// CPA Landing Page
// ============================================
app.get('/cpa', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cpa.html'));
});


app.get('/premium', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'premium.html'));
});
