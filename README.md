# 🎥 Video Downloader AI — 144p to 4K Downloader & Subscription Platform

An advanced, full-stack video downloader platform and REST API with **persistent database storage**, **daily download limits**, **subscription plans & renewals**, **download records/history**, and multi-format downloading from **144p Data Saver** up to **4K Ultra HD** and **320kbps MP3 Audio**.

---

## 🌟 Key Features

### 🎚️ Low to High Quality Engine (144p to 4K UHD)
- **144p / 240p Data Saver**: Ultra-compact downloads with minimal cellular data usage.
- **360p / 480p Standard Quality (SD)**: Smooth playback for mobile devices.
- **720p HD Quality**: High Definition with crisp video and full stereo audio.
- **1080p Full HD (FHD)**: Crystal clear 1080p with FFmpeg audio/video stream merging.
- **1440p 2K & 2160p 4K UHD**: Cinema quality for monitors, 4K TVs, and editors.
- **Audio Only (MP3)**: Automatic conversion to high-bitrate 320kbps MP3.

### 💳 Plans, Subscriptions & Limits
- **Daily Download Limits**:
  - **Free Starter**: 3 downloads / day, up to 720p HD.
  - **Pro Creator** (₹199 / $2.99 mo): 50 downloads / day, up to 1080p FHD, MP3 audio, 3x faster engine.
  - **VIP Unlimited** (₹499 / $5.99 mo): Unlimited downloads (∞), 4K UHD, priority fast-track queue, all AI features.
- **Plan Renewal & Expiry**:
  - Automatic expiration detection (`endDate < now`).
  - One-click renewal button extending the subscription by 30 days or 1 year.
  - Graceful downgrade to Free tier when a subscription expires.
- **Limit Reached Upgrade Modal**:
  - Pops up automatically when a user exceeds their daily quota with instant upgrade options.

### 🗄️ Real Working Database & Download Records
- **Persistent JSON/SQLite Database (`server/utils/db.js`)**:
  - Manages `users`, `subscriptions`, `downloads`, `plans`, and `jobs`.
  - Works out of the box locally and in serverless environments like **Vercel** (`/tmp/data`).
  - Mtime-synchronized cache prevents concurrency locks on Windows and Linux.
- **Download History / Records**:
  - Keeps a history of downloaded videos with title, thumbnail, quality, file size, and timestamp.
  - Quick "Save to Device" re-download and record deletion.

### ⚡ Vercel & Serverless End-to-End Compatibility
- **Direct Stream Endpoint (`/api/video/stream`)**:
  - Streams audio/video bytes directly to the client with `Content-Disposition: attachment`.
  - Works on Vercel without relying on persistent local disk storage.
- **Serverless Job Store**:
  - Jobs are synced into the database so polling works across different serverless invocations.

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v18+ (tested on Node v24)
- Python 3.8+ (for yt-dlp)

### Installation
```bash
# Clone the repository
git clone https://github.com/Ranjeet7680/Video-Downloader-ai-app.git
cd Video-Downloader-ai-app

# Install dependencies
npm install

# Start development server
npm start
```

The web application will be live at:
👉 **`http://localhost:3000`**

---

## 📡 API Endpoints

### 1. Account & Subscription APIs
- `GET /api/account/me` — Current user stats, active plan, remaining daily downloads, and subscription status.
- `POST /api/account/register` — Register a new account (`{ email, password, name }`).
- `POST /api/account/login` — Login with credentials.
- `GET /api/account/plans` — List available subscription plans and pricing.
- `POST /api/account/subscribe` — Subscribe / upgrade to Pro or VIP (`{ planId, billingCycle }`).
- `POST /api/account/renew` — Renew an active or expired subscription for 30 days.
- `GET /api/account/history` — Get download records for current user.
- `DELETE /api/account/history/:id` — Delete a download record.

### 2. Video Downloader APIs
- `POST /api/video/info` — Extracts metadata and available low-to-high qualities (144p to 4K + MP3).
- `POST /api/video/download` — Starts async download (enforces plan limit and records in database).
- `GET /api/jobs/:jobId` — Real-time progress monitoring, download speed, and ETA.
- `GET /api/video/file/:filename` — Direct file download with attachment header.
- `GET /api/video/stream` — Real-time direct streaming for Vercel/serverless environments.

---

## 🛠️ Tech Stack

| Component | Technology | Description |
|---|---|---|
| **Downloader** | `yt-dlp` & `yt-dlp-exec` | Multi-platform video and audio extractor |
| **Media Engine** | `ffmpeg-static` (FFmpeg 6.1) | Merges high-def video with audio streams & converts MP3 |
| **Database** | Persistent File/JSON Engine | Users, subscriptions, limits, history & jobs |
| **Server** | `Node.js` + `Express` | REST API with rate-limiting and account authentication |
| **Frontend** | Vanilla JS, HTML5, CSS3 | Glassmorphic, responsive UI with Dark, Light & Pink modes |
| **Deployment** | Vercel Ready | Zero-config Serverless with extended 60s timeout & 1GB RAM |

---

## ⚡ 1-Click Vercel Deployment Guide

Deploying **Video Downloader AI** to Vercel takes less than 60 seconds with **zero configuration**:

### Option 1: Deploy with Vercel Web Dashboard (Recommended)
1. Fork or push this repository to your GitHub account:
   ```
   https://github.com/Ranjeet7680/Video-Downloader-ai-app
   ```
2. Go to **[vercel.com/new](https://vercel.com/new)** and log in with GitHub.
3. Select **Video-Downloader-ai-app** and click **Import**.
4. Leave all settings at default:
   - **Framework Preset**: *Other* (automatically detected)
   - **Root Directory**: `./`
   - **Build Command**: *None / Leave blank*
   - **Output Directory**: *Leave blank*
5. (Optional) Add Environment Variables:
   - `YOUTUBE_API_KEY`: *(Optional)* Your YouTube Data API v3 key for fast YouTube metadata.
   - `META_API_KEY`: *(Optional)* Graph API token for Instagram oEmbed.
6. Click **Deploy**! 🚀
   - Your site will be live instantly with a free `https://*.vercel.app` domain.
   - Both the frontend UI and the full Express REST API (`/api/*`) work out of the box!

### Option 2: Deploy with Vercel CLI
```bash
# 1. Install Vercel CLI globally
npm install -g vercel

# 2. Login to your Vercel account
vercel login

# 3. Deploy to production in 1 command
vercel --prod
```

### 🛡️ How Vercel Compatibility Works
- **Zero-Config Handler (`api/index.js`)**: Routes all `/api/*` calls into the Express app via native Serverless Functions.
- **Extended Timeout (`vercel.json`)**: Configured with `maxDuration: 60` and `memory: 1024` to allow seamless video extraction and conversion without timeout.
- **Ephemeral `/tmp` Storage**: Video processing (`/tmp/uploads`) and the database (`/tmp/data/db.json`) write safely to Vercel's temporary lambda storage without filesystem permission errors.
- **Direct Stream Fallback (`/api/video/stream`)**: Automatically handles direct chunked streaming for client downloads.
- **Edge Static CDN**: Serves all HTML, CSS, and JS assets at maximum global speeds directly from Vercel's edge cache.

---

## 📱 Mobile App (Android Studio)
For Android setup instructions, open [ANDROID_SETUP.md](ANDROID_SETUP.md).

---

## 📄 License
MIT © 2026 Ranjeet Kumar
