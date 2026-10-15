# ============================================================
# 🐳 VideoDownloader AI - Production Dockerfile
# Complete with Node.js 20, Python 3, FFmpeg, and latest yt-dlp
# ============================================================

FROM node:20-bookworm-slim

# Install system dependencies: Python 3, FFmpeg, curl, ca-certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install latest official yt-dlp standalone binary
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && yt-dlp --version

# Set working directory
WORKDIR /app

# Ensure uploads and data directories exist
RUN mkdir -p /app/uploads /app/data

# Copy dependency manifests and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Environment configuration
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data \
    UPLOADS_DIR=/app/uploads

# Expose server port
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the Node.js server
CMD ["npm", "start"]
