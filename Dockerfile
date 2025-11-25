FROM node:18-bullseye

# Install Playwright dependencies
RUN apt-get update && apt-get install -y \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    libu2f-udev \
    libvulkan1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Install Playwright and browsers
RUN npx playwright install --with-deps chromium

# Copy application files
COPY . .

# Create necessary directories
RUN mkdir -p logs sessions

# Set environment variables
ENV NODE_ENV=production
ENV HEADLESS=true

# Expose port (Railway will set PORT dynamically)
EXPOSE 3000

# Start application
CMD ["node", "server.js"]
