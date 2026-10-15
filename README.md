# 🎥 Video Downloader AI — Low to High Quality (144p to 4K) & MP3 Downloader

An advanced, AI-powered video downloading web application and API supporting multi-platform video extraction from **144p Data Saver** up to **4K Ultra HD**, audio extraction in **320kbps MP3**, and AI capabilities for **summarization**, **viral reel clipping**, and **automatic timestamped subtitles**.

---

## 🌟 Key Features

### 🎚️ Low to High Quality Engine (144p to 4K UHD)
- **144p / 240p Data Saver**: Ultra-compact downloads with minimal cellular data usage.
- **360p / 480p Standard Quality (SD)**: Smooth playback for mobile devices.
- **720p HD Quality**: High Definition with crisp video and full stereo audio.
- **1080p Full HD (FHD)**: Crystal clear 1080p with FFmpeg audio/video stream merging.
- **1440p 2K & 2160p 4K UHD**: Cinema quality for monitors, 4K TVs, and editors.
- **Audio Only (MP3)**: Automatic conversion to high-bitrate 320kbps MP3.

### ⚡ Smart Quality Selector & Controls
- **🔼 Low to High & 🔽 High to Low sorting**: Order resolutions with one click.
- **Filter Tabs**: Filter by `All Formats`, `HD & 4K`, `Data Saver`, or `Audio (MP3)`.
- **Dynamic File Size Estimates**: Know the exact or estimated file size before starting the download.
- **Instant Quick Download**: Download selected resolution immediately with a single click.

### 🎬 Real-time Progress & Integrated Media Player
- **Real-time Download Metrics**: Live percentage, download speed (e.g. `⚡ 4.2 MB/s`), and ETA countdown.
- **Built-in HTML5 Video & Audio Player**: Preview the downloaded video or audio directly in the browser.
- **Direct Attachment Downloads**: Files download directly with clear, sanitized filenames (e.g., `Song_Title_1080p.mp4`).

### 🤖 Built-in AI Capabilities
- **🧠 AI Auto Summary**: Generates structured summaries with key takeaways.
- **✂️ Reel Highlights**: Detects the top 5 high-energy moments formatted in 9:16 vertical ratio.
- **💬 Auto Subtitles (.SRT)**: Generates timestamped subtitle files in 10+ languages.

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

## 🛠️ Tech Stack

| Component | Technology | Description |
|---|---|---|
| **Downloader** | `yt-dlp` & `yt-dlp-exec` | Multi-platform video and audio extractor |
| **Media Engine** | `ffmpeg-static` (FFmpeg 6.1) | Merges high-def video with audio streams & converts MP3 |
| **Server** | `Node.js` + `Express` | REST API with rate-limiting and job store |
| **AI Transcription**| `Whisper AI` | Speech-to-text with millisecond timestamps |
| **AI Insights** | `GPT-4` | Natural language video summarization |
| **Frontend** | Vanilla JS, HTML5, CSS3 | Glassmorphic, responsive UI with Dark, Light & Pink modes |
| **Mobile** | Android WebView & Capacitor | Packaged for Android mobile devices |

---

## 📡 API Endpoints

### 1. `POST /api/video/info`
Extract video metadata and available qualities from low to high.
```json
// Request
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}

// Response
{
  "success": true,
  "data": {
    "title": "Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)",
    "thumbnail": "https://i.ytimg.com/vi/...",
    "duration": "3:33",
    "qualities": [
      { "id": "144p", "label": "144p Data Saver", "tag": "SAVER", "size": "5.3 MB" },
      { "id": "360p", "label": "360p Standard", "tag": "SD", "size": "18.8 MB" },
      { "id": "720p", "label": "720p HD Quality", "tag": "HD", "size": "35.0 MB" },
      { "id": "1080p", "label": "1080p Full HD", "tag": "FHD", "size": "122.3 MB" },
      { "id": "2160p", "label": "2160p 4K UHD", "tag": "4K", "size": "488.7 MB" },
      { "id": "audio", "label": "Audio Only (MP3)", "tag": "MP3", "size": "3.3 MB" }
    ]
  }
}
```

### 2. `POST /api/video/download`
Initiates async download for the specified quality.
```json
// Request
{
  "url": "https://www.youtube.com/watch?v=...",
  "quality": "1080p",
  "title": "MyVideo"
}

// Response
{
  "success": true,
  "jobId": "daea84c7-a1c9-4cae-a4ba-18256dc0ad75",
  "message": "Download started at 1080p!"
}
```

### 3. `GET /api/jobs/:jobId`
Polls real-time download status, percentage, speed, and completed file URL.

### 4. `GET /api/video/file/:filename`
Directly downloads the media file with `Content-Disposition: attachment` headers.

---

## 📱 Mobile App (Android Studio)
For Android setup instructions, open [ANDROID_SETUP.md](ANDROID_SETUP.md).

---

## 📄 License
MIT © 2026 Ranjeet Kumar
