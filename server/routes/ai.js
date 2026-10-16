const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const jobStore = require('../utils/jobStore');
const { streamMediaFile } = require('../utils/streamMedia');

// Ensure sample vertical reel MP4 is available for instant clip downloads
const UPLOADS_DIR = process.env.VERCEL ? '/tmp/uploads' : path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const cachedReelPath = path.join(UPLOADS_DIR, 'sample_reel.mp4');
function ensureSampleReel() {
  if (fs.existsSync(cachedReelPath) && fs.statSync(cachedReelPath).size > 1000) {
    return cachedReelPath;
  }
  try {
    let ffmpeg = null;
    try { ffmpeg = require('ffmpeg-static'); } catch (e) {}
    if (ffmpeg && fs.existsSync(ffmpeg)) {
      spawnSync(ffmpeg, [
        '-y',
        '-f', 'lavfi',
        '-i', 'color=c=0x1e1b4b:s=720x1280:d=4',
        '-vf', "drawtext=text='VideoDownloader AI - 9:16 Reel':x=(w-text_w)/2:y=(h-text_h)/2:fontsize=32:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=10",
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        cachedReelPath
      ]);
    }
  } catch (err) {
    console.warn('Could not generate sample reel:', err.message);
  }
  return cachedReelPath;
}

// ✅ POST /api/ai/summarize & /api/ai/summary
// Generates AI summary from video transcript
router.post(['/summarize', '/summary'], async (req, res) => {
  try {
    const { jobId, transcript, videoTitle } = req.body;

    if (!transcript && !jobId) {
      return res.status(400).json({ error: 'Either transcript or jobId is required' });
    }

    const newJobId = uuidv4();
    const job = {
      id: newJobId,
      type: 'summarize',
      parentJobId: jobId,
      status: 'processing',
      progress: 0,
      createdAt: new Date().toISOString(),
      steps: []
    };

    jobStore.set(newJobId, job);
    const isVercel = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    if (isVercel) {
      await simulateSummary(newJobId, transcript, videoTitle);
      return res.json({
        success: true,
        jobId: newJobId,
        job: jobStore.get(newJobId) || job,
        message: '🧠 AI Summary generated!'
      });
    }

    simulateSummary(newJobId, transcript, videoTitle);

    res.json({
      success: true,
      jobId: newJobId,
      job,
      message: '🧠 AI Summary generation started!'
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ POST /api/ai/highlights
// Detects reel-worthy highlight moments
router.post('/highlights', async (req, res) => {
  try {
    const { jobId, duration = 300 } = req.body;

    const newJobId = uuidv4();
    const job = {
      id: newJobId,
      type: 'highlights',
      parentJobId: jobId,
      status: 'processing',
      progress: 0,
      createdAt: new Date().toISOString(),
      steps: []
    };

    jobStore.set(newJobId, job);
    const isVercel = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    if (isVercel) {
      await simulateHighlights(newJobId, duration);
      return res.json({
        success: true,
        jobId: newJobId,
        job: jobStore.get(newJobId) || job,
        message: '✂️ Highlights extracted!'
      });
    }

    simulateHighlights(newJobId, duration);

    res.json({
      success: true,
      jobId: newJobId,
      job,
      message: '✂️ Highlight detection started!'
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ POST /api/ai/subtitles
// Generates SRT subtitle file
router.post('/subtitles', async (req, res) => {
  try {
    const { jobId, language = 'en' } = req.body;

    const newJobId = uuidv4();
    const job = {
      id: newJobId,
      type: 'subtitles',
      parentJobId: jobId,
      status: 'processing',
      progress: 0,
      language,
      createdAt: new Date().toISOString(),
      steps: []
    };

    jobStore.set(newJobId, job);
    const isVercel = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    if (isVercel) {
      await simulateSubtitles(newJobId, language);
      return res.json({
        success: true,
        jobId: newJobId,
        job: jobStore.get(newJobId) || job,
        message: '💬 Subtitles ready!'
      });
    }

    simulateSubtitles(newJobId, language);

    res.json({
      success: true,
      jobId: newJobId,
      job,
      message: '💬 Subtitle generation started!'
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ GET /api/ai/clip-download
// Downloads reel highlight video clip
router.get('/clip-download', (req, res) => {
  const { clipId = '1', title = 'Highlight_Reel' } = req.query;
  const filename = `${title.replace(/[^\w\-]/g, '_')}_${clipId}.mp4`;
  const reelPath = ensureSampleReel();

  if (fs.existsSync(reelPath) && fs.statSync(reelPath).size > 1000) {
    return res.download(reelPath, filename);
  }

  // Same-origin resilient media stream proxy (preserves attachment filename on browser downloads)
  return streamMediaFile('https://www.w3schools.com/html/mov_bbb.mp4', req, res, filename, false, true);
});

// ✅ GET /api/ai/subtitles-download
// Downloads subtitle file in SRT or VTT format
router.get('/subtitles-download', (req, res) => {
  const { format = 'srt', lang = 'en' } = req.query;
  const isVtt = format.toLowerCase() === 'vtt';
  const ext = isVtt ? 'vtt' : 'srt';
  const content = isVtt ? generateMockVTT() : generateMockSRT();

  res.setHeader('Content-Disposition', `attachment; filename="subtitles_${lang}.${ext}"`);
  res.setHeader('Content-Type', isVtt ? 'text/vtt' : 'text/plain');
  res.send(content);
});

// ✅ Simulate AI Summary generation
async function simulateSummary(jobId, transcript, videoTitle) {
  const steps = [
    { progress: 15, step: '🎵 Extracting audio...', delay: 1200 },
    { progress: 35, step: '🎙️ Running Whisper AI transcription...', delay: 2500 },
    { progress: 55, step: '🧠 Sending to GPT-4 for analysis...', delay: 2000 },
    { progress: 75, step: '✍️ Generating summary...', delay: 1500 },
    { progress: 90, step: '🔑 Extracting key points...', delay: 1000 },
    { progress: 100, step: '✅ Summary ready!', delay: 500 },
  ];

  const isVercel = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  for (const { progress, step, delay } of steps) {
    if (!isVercel) await sleep(delay);
    const job = jobStore.get(jobId);
    if (!job) break;

    job.progress = progress;
    job.currentStep = step;
    job.steps.push({ progress, message: step, timestamp: new Date().toISOString() });

    if (progress === 100) {
      job.status = 'completed';
      job.result = {
        summary: generateMockSummary(videoTitle),
        keyPoints: generateMockKeyPoints(),
        sentiment: ['positive', 'educational', 'engaging'][Math.floor(Math.random() * 3)],
        wordCount: Math.floor(Math.random() * 2000 + 500),
        readingTime: Math.floor(Math.random() * 5 + 2) + ' minutes',
        language: 'English',
        topics: ['AI', 'Machine Learning', 'Technology', 'Tutorial'],
        confidence: (Math.random() * 10 + 90).toFixed(1) + '%'
      };
    }

    jobStore.set(jobId, job);
  }
}

// ✅ Simulate Highlight detection
async function simulateHighlights(jobId, duration) {
  const steps = [
    { progress: 10, step: '📊 Analyzing audio peaks...', delay: 1500 },
    { progress: 30, step: '🎬 Detecting scene changes...', delay: 2000 },
    { progress: 50, step: '🧠 NLP sentence scoring...', delay: 2000 },
    { progress: 70, step: '😂 Emotion detection running...', delay: 1500 },
    { progress: 85, step: '✂️ Cutting highlight clips...', delay: 1500 },
    { progress: 100, step: '✅ Highlights extracted!', delay: 500 },
  ];

  const isVercel = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  for (const { progress, step, delay } of steps) {
    if (!isVercel) await sleep(delay);
    const job = jobStore.get(jobId);
    if (!job) break;

    job.progress = progress;
    job.currentStep = step;
    job.steps.push({ progress, message: step, timestamp: new Date().toISOString() });

    if (progress === 100) {
      job.status = 'completed';
      job.result = {
        clips: generateMockClips(duration),
        totalClips: 5,
        recommendedForReels: 3,
        totalHighlightDuration: '2:45',
        techniques: ['Audio peaks', 'Scene detection', 'NLP scoring', 'Emotion analysis']
      };
    }

    jobStore.set(jobId, job);
  }
}

// ✅ Simulate Subtitle generation
async function simulateSubtitles(jobId, language) {
  const steps = [
    { progress: 20, step: '🎵 Extracting audio...', delay: 1000 },
    { progress: 45, step: '🎙️ Whisper AI transcribing...', delay: 3000 },
    { progress: 70, step: '⏱️ Generating timestamps...', delay: 1500 },
    { progress: 85, step: `🌍 Formatting ${language.toUpperCase()} subtitles...`, delay: 1000 },
    { progress: 100, step: '✅ Subtitles ready!', delay: 500 },
  ];

  const isVercel = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  for (const { progress, step, delay } of steps) {
    if (!isVercel) await sleep(delay);
    const job = jobStore.get(jobId);
    if (!job) break;

    job.progress = progress;
    job.currentStep = step;
    job.steps.push({ progress, message: step, timestamp: new Date().toISOString() });

    if (progress === 100) {
      job.status = 'completed';
      job.result = {
        srtContent: generateMockSRT(),
        vttContent: generateMockVTT(),
        filename: `subtitles_${jobId.slice(0, 8)}.srt`,
        language,
        totalLines: 42,
        duration: '10:24',
        wordAccuracy: (Math.random() * 4 + 95).toFixed(1) + '%',
        formats: ['SRT', 'VTT', 'ASS']
      };
    }

    jobStore.set(jobId, job);
  }
}

// ✅ Mock data generators
function generateMockSummary(title) {
  const summaries = [
    `This video provides a comprehensive introduction to Artificial Intelligence and Machine Learning concepts. The creator explains the fundamental differences between supervised and unsupervised learning, demonstrates practical examples using Python, and shows how to build your first neural network. Key insights include the importance of data preprocessing, model evaluation metrics, and deployment strategies. The video concludes with real-world applications in healthcare, finance, and autonomous vehicles.`,
    `An in-depth tutorial covering advanced JavaScript concepts including async/await, Promises, and modern ES6+ syntax. The presenter walks through building a complete REST API with Node.js and Express, implementing authentication with JWT tokens, and deploying to cloud platforms. Viewers learn best practices for code organization, error handling, and performance optimization.`,
    `This content explores the fundamentals of digital marketing in the AI era. The presenter covers SEO optimization techniques, social media algorithms, content creation strategies, and analytics interpretation. Special focus is given to leveraging AI tools for content generation, audience targeting, and campaign optimization to maximize ROI.`
  ];
  return summaries[Math.floor(Math.random() * summaries.length)];
}

function generateMockKeyPoints() {
  return [
    '🎯 Core concepts explained with practical examples',
    '💡 Step-by-step implementation guide provided',
    '🚀 Performance optimization techniques shared',
    '📊 Real-world data and case studies included',
    '🔧 Tools and resources mentioned throughout',
    '⚡ Advanced tips for experienced users'
  ];
}

function generateMockClips(totalDuration) {
  const emotions = ['😄 Engaging', '🔥 High Energy', '💡 Insightful', '😂 Funny', '🎯 Key Climax'];
  return Array.from({ length: 5 }, (_, i) => ({
    clipId: i + 1,
    startTime: formatTime(Math.floor(Math.random() * Math.max(10, (totalDuration - 60)))),
    endTime: formatTime(Math.floor(Math.random() * 25 + 15)),
    duration: Math.floor(Math.random() * 25 + 15) + 's',
    score: (Math.random() * 15 + 85).toFixed(0) + '%',
    emotion: emotions[i],
    reason: ['High audio energy peak', 'Viral hook phrase detected', 'Audience engagement spike', 'Emotional reaction point', 'Key actionable takeaway'][i],
    recommendedFor: i < 3 ? '🎬 9:16 Reels / Shorts' : '📱 Story Reel',
    filename: `viral_reel_clip_${i + 1}.mp4`,
    downloadUrl: `/api/ai/clip-download?clipId=${i + 1}&title=Viral_Reel_${i + 1}`
  }));
}

function generateMockVTT() {
  return `WEBVTT - Auto-generated by VideoDownloader AI

1
00:00:01.000 --> 00:00:04.000
Hello everyone, welcome to this amazing tutorial!

2
00:00:04.500 --> 00:00:08.000
Today we're going to learn about Artificial Intelligence.

3
00:00:08.500 --> 00:00:12.000
This is one of the most exciting topics in technology.

4
00:00:12.500 --> 00:00:16.500
Let's start with the basics of machine learning.

5
00:00:17.000 --> 00:00:21.000
Machine learning is a subset of artificial intelligence.

6
00:00:21.500 --> 00:00:26.000
It allows computers to learn from data without being explicitly programmed.

7
00:00:26.500 --> 00:00:31.000
There are three main types: supervised, unsupervised, and reinforcement learning.

8
00:00:31.500 --> 00:00:36.000
In supervised learning, we train models on labeled datasets.

9
00:00:36.500 --> 00:00:41.500
This is the most commonly used approach in real-world applications.

10
00:00:42.000 --> 00:00:47.000
Let me show you a practical example using Python and scikit-learn.`;
}

function generateMockSRT() {
  return `1
00:00:01,000 --> 00:00:04,000
Hello everyone, welcome to this amazing tutorial!

2
00:00:04,500 --> 00:00:08,000
Today we're going to learn about Artificial Intelligence.

3
00:00:08,500 --> 00:00:12,000
This is one of the most exciting topics in technology.

4
00:00:12,500 --> 00:00:16,500
Let's start with the basics of machine learning.

5
00:00:17,000 --> 00:00:21,000
Machine learning is a subset of artificial intelligence.

6
00:00:21,500 --> 00:00:26,000
It allows computers to learn from data without being explicitly programmed.

7
00:00:26,500 --> 00:00:31,000
There are three main types: supervised, unsupervised, and reinforcement learning.

8
00:00:31,500 --> 00:00:36,000
In supervised learning, we train models on labeled datasets.

9
00:00:36,500 --> 00:00:41,500
This is the most commonly used approach in real-world applications.

10
00:00:42,000 --> 00:00:47,000
Let me show you a practical example using Python and scikit-learn.`;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = router;
