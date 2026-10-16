const axios = require('axios');
const path = require('path');
const fs = require('fs');

let ytDlp = null;
try {
  ytDlp = require('yt-dlp-exec');
  if (fs.existsSync('/usr/local/bin/yt-dlp')) {
    ytDlp = require('yt-dlp-exec').create('/usr/local/bin/yt-dlp');
  }
} catch (e) {}

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

function extractYouTubeId(url) {
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
  const match = (url || '').match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

function extractTwitterId(url) {
  const match = (url || '').match(/(?:twitter|x)\.com\/(?:#!\/)?(\w+)\/status(?:es)?\/(\d+)/i);
  return match ? { user: match[1], id: match[2] } : null;
}

// 1. YouTube Resolver via yt-dlp (Local / VPS)
async function resolveYouTubeLocalYtDlp(url, quality = '720p', isAudio = false) {
  if (!ytDlp) return null;
  // If explicitly on serverless, yt-dlp binary is not functional
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) return null;

  try {
    const height = parseInt((quality || '720').replace('p', '')) || 720;
    const format = isAudio
      ? 'bestaudio/140/best'
      : `bestvideo[height<=${height}][ext=mp4]+bestaudio/best[height<=${height}][ext=mp4]/18/best`;

    const directUrl = await ytDlp(url, {
      getUrl: true,
      format,
      jsRuntimes: 'node',
      noWarnings: true,
      noCheckCertificate: true
    });

    if (directUrl && typeof directUrl === 'string' && directUrl.startsWith('http')) {
      const clean = directUrl.trim().split('\n')[0].trim();
      if (clean) return clean;
    }
  } catch (e) {
    console.warn('yt-dlp getUrl warning:', e.message);
  }
  return null;
}

// In-memory cache for resolved media streams (30-minute validity)
const resolvedStreamCache = new Map();

// 2. YouTube Resolver via Cloud Loader Engine (Serverless / Vercel resilient)
async function resolveYouTubeLoader(url, quality = '720p', isAudio = false) {
  try {
    let format = '720';
    if (isAudio) {
      format = 'mp3';
    } else if (quality.includes('1080')) {
      format = '1080';
    } else if (quality.includes('1440') || quality.includes('2k')) {
      format = '1440';
    } else if (quality.includes('2160') || quality.includes('4k')) {
      format = '4k';
    } else if (quality.includes('480')) {
      format = '480';
    } else if (quality.includes('360')) {
      format = '360';
    }

    const cacheKey = `loader_${url}_${format}`;
    const cached = resolvedStreamCache.get(cacheKey);
    if (cached && (Date.now() - cached.ts) < 30 * 60 * 1000) {
      return cached.url;
    }

    const res = await axios.get('https://loader.to/ajax/download.php', {
      params: { format, url },
      headers: { 'User-Agent': BROWSER_UA },
      timeout: 8000
    });

    if (res.data && res.data.progress_url) {
      // Poll progress for up to 14 attempts (approx 15 seconds)
      for (let i = 0; i < 14; i++) {
        await new Promise(r => setTimeout(r, 1100));
        try {
          const poll = await axios.get(res.data.progress_url, {
            headers: { 'User-Agent': BROWSER_UA },
            timeout: 5000
          });
          if (poll.data && poll.data.download_url && poll.data.download_url.startsWith('http')) {
            resolvedStreamCache.set(cacheKey, { url: poll.data.download_url, ts: Date.now() });
            return poll.data.download_url;
          }
        } catch (pollErr) {}
      }
    }
  } catch (e) {
    console.warn('Loader engine resolver warning:', e.message);
  }
  return null;
}

// 3. YouTube Resolver via Piped API
async function resolveYouTubePiped(url, isAudio = false) {
  const ytId = extractYouTubeId(url);
  if (!ytId) return null;

  const instances = [
    'https://api.piped.private.coffee',
    'https://pipedapi.tokhmi.xyz'
  ];

  for (const inst of instances) {
    try {
      const res = await axios.get(`${inst}/streams/${ytId}`, { timeout: 4500 });
      if (res.data) {
        if (isAudio && res.data.audioStreams && res.data.audioStreams.length > 0) {
          const best = res.data.audioStreams.find(a => !a.url?.includes('odycdn')) || res.data.audioStreams[0];
          if (best && best.url && !best.url.includes('odycdn')) return best.url;
        }
        const prog = (res.data.videoStreams || []).filter(v =>
          !v.videoOnly &&
          (v.format || '').includes('MP4') &&
          v.url &&
          !v.url.includes('odycdn')
        );
        if (prog.length > 0 && prog[0].url) {
          return prog[0].url;
        }
      }
    } catch (e) {}
  }
  return null;
}

// 4. TikTok Resolver via TikWM API (Fast, Watermark-Free MP4)
async function resolveTikTok(url, isAudio = false) {
  try {
    const res = await axios.post('https://www.tikwm.com/api/', { url }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': BROWSER_UA
      },
      timeout: 6000
    });

    if (res.data && res.data.data) {
      if (isAudio && res.data.data.music) {
        return res.data.data.music;
      }
      return res.data.data.play || res.data.data.wmplay || null;
    }
  } catch (e) {
    console.warn('TikTok resolver warning:', e.message);
  }
  return null;
}

// 5. Twitter / X Resolver via VxTwitter API
async function resolveTwitter(url) {
  const parsed = extractTwitterId(url);
  if (!parsed) return null;

  try {
    const res = await axios.get(`https://api.vxtwitter.com/Twitter/status/${parsed.id}`, {
      headers: { 'User-Agent': BROWSER_UA },
      timeout: 5000
    });
    if (res.data && res.data.media_URLs && res.data.media_URLs.length > 0) {
      const videoUrl = res.data.media_URLs.find(u => u.includes('.mp4')) || res.data.media_URLs[0];
      if (videoUrl && videoUrl.includes('.mp4')) return videoUrl;
    }
  } catch (e) {}

  try {
    const res2 = await axios.get(`https://api.fxtwitter.com/Twitter/status/${parsed.id}`, {
      headers: { 'User-Agent': BROWSER_UA },
      timeout: 5000
    });
    if (res2.data?.tweet?.media?.videos?.[0]?.url) {
      return res2.data.tweet.media.videos[0].url;
    }
  } catch (e) {}

  return null;
}

// 6. Reddit Resolver
async function resolveReddit(url) {
  try {
    const cleanUrl = url.split('?')[0].replace(/\/+$/, '') + '.json';
    const res = await axios.get(cleanUrl, {
      headers: { 'User-Agent': BROWSER_UA },
      timeout: 5000
    });
    const postData = res.data?.[0]?.data?.children?.[0]?.data;
    if (postData) {
      const video = postData.secure_media?.reddit_video || postData.media?.reddit_video;
      if (video?.fallback_url) return video.fallback_url;
    }
  } catch (e) {}
  return null;
}

// 7. Universal HTML / OpenGraph Scraper
async function resolveOpenGraphVideo(url) {
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 5000,
      maxRedirects: 4
    });

    const html = typeof res.data === 'string' ? res.data : '';
    const ogMatch = html.match(/<meta\s+property=["']og:video(?::secure_url|:url)?["']\s+content=["']([^"']+)["']/i) ||
                    html.match(/<meta\s+name=["']twitter:player:stream["']\s+content=["']([^"']+)["']/i) ||
                    html.match(/<video[^>]+src=["']([^"']+)["']/i) ||
                    html.match(/<source[^>]+src=["']([^"']+\.mp4[^"']*)["']/i);

    if (ogMatch && ogMatch[1]) {
      let vUrl = ogMatch[1].replace(/&amp;/g, '&');
      if (vUrl.startsWith('//')) vUrl = 'https:' + vUrl;
      return vUrl;
    }
  } catch (e) {}
  return null;
}

/**
 * Universal Stream Resolver:
 * Resolves a direct, high-speed, streamable media URL for any video platform.
 */
async function resolveRealMediaStream(url, quality = '720p', isAudio = false) {
  if (!url) return null;

  // Direct media URLs
  if (
    url.endsWith('.mp4') ||
    url.endsWith('.mp3') ||
    url.endsWith('.webm') ||
    url.endsWith('.m4a') ||
    url.includes('.googlevideo.com') ||
    url.includes('.tiktokcdn') ||
    url.includes('.fbcdn.net') ||
    url.includes('.cdninstagram.com')
  ) {
    return url;
  }

  const lower = url.toLowerCase();

  // 1. TikTok
  if (lower.includes('tiktok.com')) {
    const tik = await resolveTikTok(url, isAudio);
    if (tik) return tik;
  }

  // 2. YouTube
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    // Attempt local yt-dlp first (if running on node server/VPS)
    const ytdlpStream = await resolveYouTubeLocalYtDlp(url, quality, isAudio);
    if (ytdlpStream) return ytdlpStream;

    // Attempt cloud loader engine (works on Vercel serverless)
    const loaderStream = await resolveYouTubeLoader(url, quality, isAudio);
    if (loaderStream) return loaderStream;

    // Attempt piped stream
    const pipedStream = await resolveYouTubePiped(url, isAudio);
    if (pipedStream) return pipedStream;
  }

  // 3. Twitter / X
  if (lower.includes('twitter.com') || lower.includes('x.com')) {
    const tw = await resolveTwitter(url);
    if (tw) return tw;
  }

  // 4. Reddit
  if (lower.includes('reddit.com') || lower.includes('v.redd.it')) {
    const red = await resolveReddit(url);
    if (red) return red;
  }

  // 5. OpenGraph & HTML fallback (Instagram, Facebook, Vimeo, Web Video)
  const og = await resolveOpenGraphVideo(url);
  if (og) return og;

  return null;
}

module.exports = {
  resolveRealMediaStream,
  extractYouTubeId
};
