require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const app = express();
// ✅ Trust proxy for Vercel reverse proxy and rate limiting
app.set('trust proxy', 1);

// ✅ Create uploads directory if not exists (Vercel ephemeral /tmp supported)
const uploadsDir = (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
  ? '/tmp/uploads'
  : path.join(__dirname, '../uploads');

try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (dirErr) {
  console.warn('Could not initialize uploads dir:', dirErr.message);
}

// ✅ Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // allow inline scripts in frontend
}));

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-guest-id'],
}));

// ✅ Rate limiting (allows polling without triggering 429)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 1000,
  skip: (req) => req.path.startsWith('/jobs') || req.path === '/health',
  message: { error: 'Too many requests, please try again in a few minutes.' }
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ Serve static frontend and uploads
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(uploadsDir));

// ✅ Routes
const videoRoutes = require('./routes/video');
const aiRoutes = require('./routes/ai');
const jobRoutes = require('./routes/jobs');
const accountRoutes = require('./routes/account');

app.use('/api/video', videoRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/account', accountRoutes);

// ✅ API Root & Health checks
app.get('/api', (req, res) => {
  res.json({
    status: 'ok',
    name: 'VideoDownloader AI API',
    version: '2.0.0',
    platform: process.env.VERCEL ? 'Vercel Serverless' : 'Node.js Local',
    endpoints: {
      health: 'GET /api/health',
      videoInfo: 'POST /api/video/info',
      videoDownload: 'POST /api/video/download',
      videoStream: 'GET /api/video/stream?url=...&quality=720p',
      userStats: 'GET /api/account/me',
      plans: 'GET /api/account/plans',
      history: 'GET /api/account/downloads'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    message: '🔥 VideoDownloader AI is running!',
    platform: process.env.VERCEL ? 'Vercel Serverless' : 'Local Environment',
    timestamp: new Date().toISOString(),
    features: ['video-download', 'stream-direct', 'auto-summary', 'reel-highlights', 'subtitles', 'quotas']
  });
});

// ✅ Fallback to frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ✅ Error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🔥 VideoDownloader AI Server Running!`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`🌍 API: http://localhost:${PORT}/api/health\n`);
  });
}

module.exports = app;
