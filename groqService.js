
// groqService.js - AI Integration using Groq API
const axios = require('axios');

class GroqService {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.GROQ_API_KEY;
    this.baseURL = 'https://api.groq.com/openai/v1';
    // Groq models: llama3-70b-8192, mixtral-8x7b-32768, gemma-7b-it
    this.model = 'llama-3.1-8b-instant';
  }
/**
 * ✅ Generic method for AI analysis (required by WhatsAppService)
 */
async analyzeWithGroq(prompt, options = {}) {
  return await this.callGroq(prompt, options);
}
  /**
   * Analyze security incidents and generate insights
   */
  async analyzeIncidents(incidents) {
    const prompt = `You are a security intelligence analyst. Analyze these Nigerian security incidents and provide:
1. Executive Summary (2-3 sentences)
2. Key Trends
3. Most Affected Regions
4. Risk Level Assessment (Low/Medium/High/Critical)
5. Recommended Actions

Incidents:
${incidents.map((item, i) => `${i + 1}. ${item.title} - ${item.summary}`).join('\n')}

Provide structured analysis.`;

    return await this.callGroq(prompt);
  }

  /**
   * Enhanced incident classification with context
   */
  async classifyIncident(title, summary) {
    const prompt = `Classify this security incident into ONE category and extract key details:

Title: ${title}
Summary: ${summary}

Respond in JSON format:
{
  "category": "Kidnapping|Banditry|Terrorism|Herder-Farmer Conflict|Cult Violence|Armed Robbery|Other",
  "subcategory": "specific type",
  "severity": "Low|Medium|High|Critical",
  "casualties": {
    "deaths": number,
    "injuries": number,
    "abducted": number
  },
  "perpetrators": "identified group or unknown",
  "locations": ["specific locations mentioned"],
  "extracted_facts": ["key fact 1", "key fact 2"]
}`;

    const response = await this.callGroq(prompt, { temperature: 0.1 });
    
    try {
      // Try to parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      // Fallback if not JSON
      return {
        category: 'Other',
        severity: 'Medium',
        casualties: { deaths: 0, injuries: 0, abducted: 0 },
        perpetrators: 'Unknown',
        locations: [],
        extracted_facts: [response.substring(0, 100)]
      };
    } catch (error) {
      console.error('JSON parse error:', error);
      return {
        category: 'Other',
        severity: 'Medium',
        casualties: { deaths: 0, injuries: 0, abducted: 0 },
        perpetrators: 'Unknown',
        locations: [],
        extracted_facts: []
      };
    }
  }

  /**
   * Generate weekly executive briefing
   */
  async generateWeeklyBriefing(stats, incidents, affectedStates) {
    const prompt = `Generate a professional executive briefing for Nigerian security stakeholders.

STATISTICS:
- Total Incidents: ${incidents.length}
- States Affected: ${affectedStates.length}
- Estimated Casualties: ${stats.fatalities}
- Abductions: ${stats.abducted}

TOP INCIDENTS:
${incidents.slice(0, 10).map((item, i) => `${i + 1}. ${item.title}`).join('\n')}

AFFECTED STATES: ${affectedStates.join(', ')}

Create a briefing with:
1. SITUATION OVERVIEW (2-3 paragraphs)
2. HOTSPOT ANALYSIS (identify 3-4 critical areas)
3. EMERGING THREATS (new patterns or escalations)
4. WEEK-OVER-WEEK COMPARISON (if this is an increase/decrease)
5. RECOMMENDATIONS (3-5 actionable items)

Write in professional intelligence briefing style.`;

    return await this.callGroq(prompt, { max_tokens: 2000 });
  }

  /**
   * Generate state-specific risk assessment
   */
  async generateStateRiskAssessment(stateName, incidents) {
    const stateIncidents = incidents.filter(item => 
      (item.title + item.summary).toLowerCase().includes(stateName.toLowerCase())
    );

    if (stateIncidents.length === 0) {
      return { 
        stateName,
        riskLevel: 'Low', 
        analysis: `No significant security incidents reported for ${stateName} this week.`,
        incidentCount: 0
      };
    }

    const prompt = `Analyze security situation in ${stateName} state, Nigeria:

INCIDENTS (${stateIncidents.length} reported):
${stateIncidents.map((item, i) => `${i + 1}. ${item.title}`).join('\n')}

Provide:
1. Risk Level: Low/Medium/High/Critical
2. Primary Threats (categorized)
3. Vulnerable Areas
4. Trend Analysis
5. Specific Recommendations for ${stateName}

Format as structured analysis.`;

    const response = await this.callGroq(prompt);
    
    return {
      stateName,
      riskLevel: this.extractRiskLevel(response),
      analysis: response,
      incidentCount: stateIncidents.length
    };
  }

  /**
   * Generate natural language summary from structured data
   */
  async generateNarrativeSummary(incidentData) {
    const prompt = `Convert this security incident data into a flowing narrative paragraph suitable for a report:

Incident: ${incidentData.title}
Details: ${incidentData.summary}
Location: ${incidentData.location || 'Not specified'}
Date: ${incidentData.timestamp}

Write a concise, professional 2-3 sentence summary that captures the key facts.`;

    return await this.callGroq(prompt, { max_tokens: 200 });
  }

  /**
   * Detect patterns and emerging trends
   */
  async detectPatterns(currentWeekIncidents, previousWeekIncidents) {
    const prompt = `You are analyzing Nigerian security patterns. Compare these two datasets:

CURRENT WEEK (${currentWeekIncidents.length} incidents):
${currentWeekIncidents.slice(0, 20).map(i => i.title).join('\n')}

PREVIOUS WEEK (${previousWeekIncidents.length} incidents):
${previousWeekIncidents.slice(0, 20).map(i => i.title).join('\n')}

Identify:
1. Escalating threats (increase in frequency/severity)
2. New patterns or tactics
3. Geographic shifts
4. Changes in perpetrator activity
5. Notable differences

Provide actionable intelligence insights.`;

    return await this.callGroq(prompt);
  }

  /**
   * Generate alert message for critical incidents
   */
  async generateAlert(incident) {
    const prompt = `Generate a concise security alert for this incident:

${incident.title}
${incident.summary}

Format:
ALERT: [Category] - [Location]
SEVERITY: [Level]
DETAILS: [2-3 sentences]
ACTION REQUIRED: [Yes/No and why]

Keep it under 100 words, urgent tone.`;

    return await this.callGroq(prompt, { max_tokens: 150 });
  }

  /**
   * Enhance incident data with AI extraction
   */
  async enrichIncidentData(incidents) {
    const enrichedData = [];
    
    // Process in batches to avoid rate limits
    for (let i = 0; i < Math.min(incidents.length, 50); i += 5) {
      const batch = incidents.slice(i, i + 5);
      
      const enrichedBatch = await Promise.all(
        batch.map(async (incident) => {
          try {
            const classification = await this.classifyIncident(incident.title, incident.summary);
            return {
              ...incident,
              enriched: true,
              aiClassification: classification.category,
              severity: classification.severity,
              casualties: classification.casualties,
              extractedLocations: classification.locations,
              perpetrators: classification.perpetrators
            };
          } catch (err) {
            console.error(`Failed to enrich incident: ${incident.title}`, err.message);
            return incident;
          }
        })
      );
      
      enrichedData.push(...enrichedBatch);
      
      // Rate limiting delay (Groq allows 30 req/min on free tier)
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Add remaining incidents without enrichment
    if (incidents.length > 50) {
      enrichedData.push(...incidents.slice(50));
    }
    
    return enrichedData;
  }

  /**
   * Core API call to Groq
   */
  async callGroq(prompt, options = {}) {
    try {
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: options.model || this.model,
          messages: [
            {
              role: 'system',
              content: 'You are a professional security intelligence analyst specializing in Nigerian security affairs. Provide accurate, actionable, and well-structured analysis.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: options.temperature || 0.3,
          max_tokens: options.max_tokens || 1000,
          top_p: options.top_p || 0.9
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('Groq API Error:', error.response?.data || error.message);
      throw new Error(`Groq API call failed: ${error.message}`);
    }
  }

  /**
   * Helper to extract risk level from response
   */
  extractRiskLevel(text) {
    const levels = ['Critical', 'High', 'Medium', 'Low'];
    for (const level of levels) {
      if (text.includes(`Risk Level: ${level}`) || 
          text.includes(`${level} Risk`) ||
          text.includes(`risk level is ${level.toLowerCase()}`)) {
        return level;
      }
    }
    return 'Medium'; // Default
  }
}

module.exports = GroqService;
