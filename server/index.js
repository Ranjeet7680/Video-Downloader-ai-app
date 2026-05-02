require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Create uploads directory if not exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ✅ Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // allow inline scripts in frontend
}));

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ✅ Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 50,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ Serve static frontend and uploads
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ✅ Routes
const videoRoutes = require('./routes/video');
const aiRoutes = require('./routes/ai');
const jobRoutes = require('./routes/jobs');

app.use('/api/video', videoRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/jobs', jobRoutes);

// ✅ Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    message: '🔥 AI Video Tool is running!',
    timestamp: new Date().toISOString(),
    features: ['video-download', 'auto-summary', 'reel-highlights', 'subtitles']
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

app.listen(PORT, () => {
  console.log(`\n🔥 AI Video Tool Server Running!`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🌍 API: http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
