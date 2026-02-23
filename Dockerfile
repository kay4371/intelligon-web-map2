FROM node:20-bullseye

# Install canvas native dependencies + Chromium for Puppeteer
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    python3 \
    g++ \
    make \
    pkg-config \
    chromium \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libnss3 \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer where Chrome is — baked in, no env var needed on Render
ENV CHROME_PATH=/usr/bin/chromium

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start command
CMD ["node", "server.js"]
