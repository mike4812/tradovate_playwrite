# Dockerfile for Tradovate Multi-Account Control System
FROM mcr.microsoft.com/playwright:v1.40.0-focal

# Set working directory
WORKDIR /app

# Install Node.js dependencies
COPY package*.json ./
RUN npm install

# Copy application files
COPY . .

# Create necessary directories
RUN mkdir -p sessions config logs

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]
