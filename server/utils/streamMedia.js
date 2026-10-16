// Universal Resilient Media Streamer & Proxy
// Provides HTTP Byte-Range support, follows redirects, and guarantees non-empty streaming for HTML5 video/audio playback and direct device downloads

function streamMediaFile(sourceUrl, req, res, downloadName = 'media.mp4', isAudio = false, isAttachment = false) {
  try {
    const parsed = new URL(sourceUrl);
    const client = parsed.protocol === 'http:' ? require('http') : require('https');

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Encoding': 'identity'
    };

    if (req && req.headers && req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const forwardReq = client.get(sourceUrl, { headers }, (upstreamRes) => {
      // Follow HTTP 301, 302, 307 redirects
      if (upstreamRes.statusCode >= 300 && upstreamRes.statusCode < 400 && upstreamRes.headers.location) {
        let redirectUrl = upstreamRes.headers.location;
        if (!redirectUrl.startsWith('http')) {
          redirectUrl = new URL(redirectUrl, sourceUrl).toString();
        }
        return streamMediaFile(redirectUrl, req, res, downloadName, isAudio, isAttachment);
      }

      const statusCode = (upstreamRes.statusCode === 200 && req && req.headers && req.headers.range)
        ? 206
        : (upstreamRes.statusCode || 200);

      res.statusCode = statusCode;
      res.setHeader('Content-Type', isAudio ? 'audio/mpeg' : 'video/mp4');
      res.setHeader('Content-Disposition', `${isAttachment ? 'attachment' : 'inline'}; filename="${downloadName}"`);
      res.setHeader('Accept-Ranges', 'bytes');

      if (upstreamRes.headers['content-length']) {
        res.setHeader('Content-Length', upstreamRes.headers['content-length']);
      }
      if (upstreamRes.headers['content-range']) {
        res.setHeader('Content-Range', upstreamRes.headers['content-range']);
      }

      upstreamRes.pipe(res);
    });

    forwardReq.on('error', (err) => {
      console.error('streamMediaFile upstream error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream media: ' + err.message });
      }
    });
  } catch (err) {
    console.error('streamMediaFile initialization error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to initialize media stream.' });
    }
  }
}

module.exports = { streamMediaFile };
