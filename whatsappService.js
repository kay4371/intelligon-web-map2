// whatsappService.js - COMPLETE WITH FIXED MEDIA UPLOAD
const axios = require('axios');
const FormData = require('form-data');

class WhatsAppService {
  constructor(apiToken, groqService = null) {
    this.baseURL = 'https://gate.whapi.cloud';
    this.token = apiToken;
    this.groqService = groqService;
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * ✅ CORE: Fetch messages from specific group
   */
  async getGroupMessages(chatId, count = 100) {
    try {
      console.log(`📱 Fetching ${count} messages from group: ${chatId}`);
      
      const response = await this.axiosInstance.get(`/messages/list/${chatId}`, {
        params: { count: count, offset: 0 }
      });
      
      const messages = response.data.messages || [];
      console.log(`✅ Fetched ${messages.length} messages`);
      
      return messages.map(msg => ({
        id: msg.id,
        from: msg.from,
        fromName: msg.notifyName || msg.pushName || msg.from,
        text: this.extractText(msg),
        timestamp: msg.timestamp ? new Date(msg.timestamp * 1000) : new Date(),
        type: msg.type,
        hasMedia: ['image', 'video', 'document', 'audio'].includes(msg.type),
        mediaUrl: msg.media?.url || null,
        location: msg.location || null,
        raw: msg
      }));
    } catch (error) {
      console.error(`❌ Error fetching messages from ${chatId}:`, error.message);
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }
  }

  /**
   * Extract text from various WhatsApp message formats
   */
  extractText(msg) {
    if (msg.text?.body) return msg.text.body;
    if (msg.body) return msg.body;
    if (msg.caption) return msg.caption;
    if (msg.conversation) return msg.conversation;
    if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
    return '';
  }

  /**
   * ✅ ENHANCED: Filter security + traffic intelligence messages
   */
  /**
 * ✅ ULTRA-MINIMAL FILTER: For security-focused groups
 * Only removes system messages and empty content
 */
filterSecurityMessagesLight(messages) {
  console.log(`  🔍 Applying ultra-minimal filter (security group)...`);
  
  return messages.filter(msg => {
    // Remove empty messages
    if (!msg.text || msg.text.trim().length === 0) {
      return false;
    }
    
    // Remove VERY short (likely just emojis or single-word reactions)
    if (msg.text.trim().length < 10) {
      return false;
    }
    
    // Remove messages that are ONLY emojis/symbols
    const textWithoutEmojis = msg.text.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
    if (textWithoutEmojis.length < 5) {
      return false;
    }
    
    // ✅ KEEP EVERYTHING ELSE
    return true;
    
  }).map(msg => ({
    ...msg,
    source: 'WhatsApp Intelligence Network',
    relevanceScore: this.calculateRelevanceScoreLight(msg.text)
  }));
}
  
  /**
   * ✅ LIGHT RELEVANCE SCORING
   * Simpler scoring for security-focused groups
   */
  calculateRelevanceScoreLight(text) {
    const lowerText = text.toLowerCase();
    let score = 50; // Base score
    
    // High-priority keywords
    const criticalKeywords = [
      'urgent', 'breaking', 'just now', 'happening now',
      'alert', 'warning', 'confirmed', 'verified'
    ];
    
    criticalKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) {
        score += 15;
      }
    });
    
    // ✅ COMPLETE: All 36 Nigerian states + FCT (with variations)
    const nigerianStates = [
      // North West (7 states)
      'kaduna', 'kano', 'katsina', 'kebbi', 'sokoto', 'zamfara', 'jigawa',
      
      // North East (6 states)
      'adamawa', 'bauchi', 'borno', 'gombe', 'taraba', 'yobe',
      
      // North Central (7 states + FCT)
      'benue', 'kogi', 'kwara', 'nasarawa', 'nassarawa', 'niger', 'plateau', 
      'abuja', 'fct', 'federal capital territory',
      
      // South West (6 states)
      'ekiti', 'lagos', 'ogun', 'ondo', 'osun', 'oyo',
      
      // South East (5 states)
      'abia', 'anambra', 'ebonyi', 'enugu', 'imo',
      
      // South South (6 states)
      'akwa ibom', 'akwaibom', 'akwa-ibom',
      'bayelsa', 
      'cross river', 'cross-river',
      'delta', 'edo', 'rivers'
    ];
    
    const hasLocation = nigerianStates.some(state => lowerText.includes(state));
    if (hasLocation) {
      score += 20;
    }
    
    // Has casualties/numbers
    if (lowerText.match(/\d+\s*(killed|dead|injured|wounded|abducted|kidnapped)/)) {
      score += 15;
    }
    
    // Length bonus (longer = more detail)
    if (text.length > 200) score += 10;
    if (text.length > 500) score += 10;
    
    return Math.min(score, 100);
  }
  /**
   * ✅ BATCH: Analyze multiple incidents with rate limiting
   */
  async batchAnalyzeIncidents(messages) {
    console.log(`🤖 Analyzing ${messages.length} incidents with Groq AI...`);
    
    const analyzed = [];
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      console.log(`  → Analyzing incident ${i + 1}/${messages.length}...`);
      
      try {
        const analysis = await this.analyzeIncidentWithAI(msg);
        analyzed.push({ ...msg, aiAnalysis: analysis });
        
        if (i < messages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`  ⚠️ Failed to analyze message ${msg.id}`);
        analyzed.push(msg);
      }
    }
    
    console.log(`✅ AI analysis complete: ${analyzed.filter(m => m.aiAnalysis).length}/${messages.length} successful`);
    return analyzed;
  }

  /**
   * ✅ INTEGRATION: Convert to news format
   */
  convertToNewsFormat(messages, groupName = 'WhatsApp Intelligence') {
    return messages.map(msg => {
      const analysis = msg.aiAnalysis || {};
      
      let title = msg.text.substring(0, 100);
      if (analysis.what) {
        title = analysis.what;
      }
      if (title.length > 150) {
        title = title.substring(0, 147) + '...';
      }
      
      return {
        title: title,
        summary: msg.text,
        link: `whatsapp://message/${msg.id}`,
        source: `WhatsApp: ${groupName}`,
        timestamp: msg.timestamp.toISOString(),
        fromName: msg.fromName,
        relevanceScore: msg.relevanceScore,
        aiClassification: analysis.category || 'Other',
        severity: analysis.severity || 'Medium',
        casualties: analysis.who?.casualties || {},
        location: analysis.where?.state || null,
        extractedLocations: [
          analysis.where?.state,
          analysis.where?.lga,
          analysis.where?.specificLocation
        ].filter(Boolean),
        aiAnalysis: analysis,
        isTrafficAlert: analysis.category === 'Traffic Alert',
        trafficImpact: analysis.trafficImpact || null,
        hasMedia: msg.hasMedia,
        mediaUrl: msg.mediaUrl,
        verificationStatus: analysis.verificationStatus || 'Unverified',
        whatsappMetadata: {
          messageId: msg.id,
          from: msg.from,
          timestamp: msg.timestamp
        }
      };
    });
  }

  /**
   * ✅ FIXED: Send document via WhatsApp using Base64
   * This method sends PDF directly without uploading to /media endpoint
   */
  async sendDocumentWithPDF(recipient, pdfBuffer, filename, caption = '') {
    try {
      console.log(`📎 Sending document to: ${recipient}`);
      console.log(`📄 File: ${filename} (${(pdfBuffer.length / 1024).toFixed(2)} KB)`);
      
      // Convert PDF buffer to Base64
      const base64Data = pdfBuffer.toString('base64');
      
      // Format: data:application/pdf;name=filename.pdf;base64,BASE64STRING
      const mediaString = `data:application/pdf;name=${filename};base64,${base64Data}`;
      
      // Send directly to /messages/document endpoint
      const response = await this.axiosInstance.post('/messages/document', {
        to: recipient,
        media: mediaString,
        caption: caption
      });
      
      console.log(`✅ Document sent: ${response.data.id}`);
      
      return {
        success: true,
        id: response.data.id,
        timestamp: response.data.timestamp,
        status: response.data.status
      };
      
    } catch (error) {
      console.error('❌ Document send failed:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      }
      throw new Error(`Failed to send document: ${error.message}`);
    }
  }

  /**
   * ✅ ALTERNATIVE: Send document via URL (if you have public URL)
   */
  async sendDocumentWithURL(recipient, fileUrl, caption = '') {
    try {
      console.log(`📎 Sending document from URL to: ${recipient}`);
      
      const response = await this.axiosInstance.post('/messages/document', {
        to: recipient,
        media: fileUrl,
        caption: caption
      });
      
      console.log(`✅ Document sent: ${response.data.id}`);
      
      return {
        success: true,
        id: response.data.id,
        timestamp: response.data.timestamp
      };
      
    } catch (error) {
      console.error('❌ Document send failed:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      }
      throw new Error(`Failed to send document: ${error.message}`);
    }
  }

  /**
   * ✅ Send text message via WhatsApp
   * Endpoint: POST /messages/text
   */
  async sendTextMessage(recipient, message) {
    try {
      console.log(`💬 Sending text to: ${recipient}`);
      
      const response = await this.axiosInstance.post('/messages/text', {
        to: recipient,
        body: message
      });
      
      console.log(`✅ Text sent: ${response.data.id}`);
      
      return {
        id: response.data.id,
        timestamp: response.data.timestamp
      };
      
    } catch (error) {
      console.error('❌ Text message send failed:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      }
      throw new Error(`Failed to send text: ${error.message}`);
    }
  }

  /**
   * ✅ HELPER: Get all groups
   */
  async getAllGroups() {
    try {
      const response = await this.axiosInstance.get('/groups', {
        params: { count: 100 }
      });
      
      const groups = response.data.groups || [];
      
      return groups.map(group => ({
        id: group.id,
        name: group.name || 'Unnamed Group',
        participantCount: group.participants?.length || 0,
        description: group.description || '',
        createdAt: group.creation ? new Date(group.creation * 1000) : null
      }));
    } catch (error) {
      console.error('❌ Error fetching WhatsApp groups:', error.message);
      throw new Error(`Failed to fetch groups: ${error.message}`);
    }
  }

  /**
   * ✅ Send image via WhatsApp
   * Accepts either a Buffer (preferred) or a base64 data URI string
   */
  async sendImage(recipient, imageData, caption = '') {
    try {
      console.log(`📸 Sending image to: ${recipient}`);

      let buffer;

      // Handle both Buffer and base64 data URI
      if (Buffer.isBuffer(imageData)) {
        buffer = imageData;
      } else if (typeof imageData === 'string' && imageData.startsWith('data:')) {
        const base64 = imageData.split(',')[1];
        buffer = Buffer.from(base64, 'base64');
      } else {
        throw new Error('imageData must be a Buffer or base64 data URI');
      }

      console.log(`   📦 Image size: ${(buffer.length / 1024).toFixed(1)} KB`);

      // Upload via multipart form — Whapi accepts this reliably
      const form = new FormData();
      form.append('to', recipient);
      form.append('caption', caption);
      form.append('media', buffer, {
        filename: 'intelligence-brief.png',
        contentType: 'image/png',
      });

      const response = await axios.post(
        `${this.baseURL}/messages/image`,
        form,
        {
          headers: {
            ...form.getHeaders(),
            'Authorization': `Bearer ${this.token}`,
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 60000,
        }
      );

      console.log(`✅ Image sent: ${response.data.id}`);

      return {
        success: true,
        id: response.data.id,
        timestamp: response.data.timestamp
      };

    } catch (error) {
      console.error('❌ Image send failed:', error.message);
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Response:', JSON.stringify(error.response.data, null, 2));
      }
      throw new Error(`Failed to send image: ${error.message}`);
    }
  }

}


module.exports = WhatsAppService;
