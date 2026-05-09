// ============================================================
// 📱 Android WebView Detection
// window.isAndroidApp is injected by MainActivity.java
// when running inside the Android WebView wrapper
// ============================================================
const VERCEL_URL = 'https://your-app.vercel.app'; // ← Replace with your Vercel URL
const API_BASE = (typeof window !== 'undefined' && window.isAndroidApp)
  ? `${VERCEL_URL}/api`
  : '/api';

// --- State Management ---
const state = {
  videoUrl: '',
  videoInfo: null,
  features: {
    download: true,
    summary: false,
    highlights: false,
    subtitles: false
  },
  subtitleLang: 'en',
  activeJobs: new Map() // jobId -> pollInterval
};


// --- DOM Elements ---
const elUrlInput = document.getElementById('video-url');
const elFetchBtn = document.getElementById('fetch-info-btn');
const elProcessBtn = document.getElementById('process-btn');
const elPreview = document.getElementById('video-preview');
const elPanelUrl = document.getElementById('panel-url');
const elPanelFeatures = document.getElementById('panel-features');
const elPanelResults = document.getElementById('panel-results');
const elJobsContainer = document.getElementById('jobs-container');
const elLangRow = document.getElementById('lang-row');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initRating();
  
  // Add input listener to enable/disable fetch button
  elUrlInput.addEventListener('input', (e) => {
    state.videoUrl = e.target.value.trim();
    if(state.videoUrl) {
      elPreview.style.display = 'none';
      elProcessBtn.disabled = true;
      elProcessBtn.style.opacity = '0.5';
    }
  });

  // Initially disable process button
  elProcessBtn.disabled = true;
  elProcessBtn.style.opacity = '0.5';
});

// --- UI Helpers ---
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.innerHTML = type === 'error' ? `❌ ${message}` : `✅ ${message}`;
  toast.className = `toast show ${type}`;
  
  setTimeout(() => {
    toast.className = 'toast';
  }, 3000);
}

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    elUrlInput.value = text;
    state.videoUrl = text.trim();
    showToast('Pasted from clipboard');
    fetchVideoInfo();
  } catch (err) {
    showToast('Failed to read clipboard', 'error');
  }
}

function toggleFeature(element, featureId) {
  const isEnabled = !state.features[featureId];
  state.features[featureId] = isEnabled;
  
  // Toggle UI
  if (isEnabled) {
    element.classList.add('active');
    document.getElementById(`switch-${featureId}`).classList.add('on');
  } else {
    element.classList.remove('active');
    document.getElementById(`switch-${featureId}`).classList.remove('on');
  }

  // Show/Hide language select for subtitles
  if (featureId === 'subtitles') {
    elLangRow.style.display = isEnabled ? 'flex' : 'none';
  }
}

// --- API Calls ---
async function fetchVideoInfo() {
  const url = elUrlInput.value.trim();
  if (!url) {
    showToast('Please enter a video URL', 'error');
    return;
  }

  try {
    elFetchBtn.innerHTML = '⏳ Fetching...';
    elFetchBtn.disabled = true;

    const res = await fetch(`${API_BASE}/video/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Failed to fetch video info');

    state.videoInfo = data.data;
    renderVideoPreview(data.data);
    showToast('Video information loaded');
    
    // Enable processing
    elProcessBtn.disabled = false;
    elProcessBtn.style.opacity = '1';

  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    elFetchBtn.innerHTML = '🔍 Fetch Video Info';
    elFetchBtn.disabled = false;
  }
}

function renderVideoPreview(info) {
  document.getElementById('preview-thumb').src = info.thumbnail;
  document.getElementById('preview-duration').innerText = info.duration;
  document.getElementById('preview-platform').innerText = info.platform;
  document.getElementById('preview-title').innerText = info.title;
  document.getElementById('preview-channel').innerText = info.channel;
  document.getElementById('preview-views').innerText = info.views;

  const qualityWrap = document.getElementById('quality-options');
  qualityWrap.innerHTML = info.qualities.map((q, i) => 
    `<button class="quality-btn ${i === 0 ? 'active' : ''}" onclick="selectQuality(this, '${q}')">${q}</button>`
  ).join('');

  state.quality = info.qualities[0];
  elPreview.style.display = 'flex';
}

function selectQuality(btn, quality) {
  document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.quality = quality;
}

// --- Processing Logic ---
async function startProcessing() {
  if (!state.videoInfo) {
    showToast('Please fetch video info first', 'error');
    return;
  }

  // Check if at least one feature is selected
  const hasFeatures = Object.values(state.features).some(v => v);
  if (!hasFeatures) {
    showToast('Please select at least one AI feature', 'error');
    return;
  }

  // Switch UI to results
  elPanelUrl.style.display = 'none';
  elPanelFeatures.style.display = 'none';
  elPanelResults.style.display = 'block';
  elJobsContainer.innerHTML = '';

  state.subtitleLang = document.getElementById('lang-select').value;

  try {
    // 1. Start Download Job (Root Job)
    // We always start a mock download job for the demo, even if they didn't ask for the mp4
    const dlRes = await fetch(`${API_BASE}/video/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: state.videoUrl, quality: state.quality })
    });
    
    const dlData = await dlRes.json();
    if (!dlRes.ok) throw new Error(dlData.error);
    
    const rootJobId = dlData.jobId;
    createJobCard(rootJobId, 'download', '🎥 Video Download');
    pollJob(rootJobId);

    // 2. Start AI Jobs
    if (state.features.summary) {
      const res = await startAiJob('/ai/summarize', { jobId: rootJobId, videoTitle: state.videoInfo.title });
      createJobCard(res.jobId, 'summary', '🧠 AI Summary');
      pollJob(res.jobId);
    }
    
    if (state.features.highlights) {
      const res = await startAiJob('/ai/highlights', { jobId: rootJobId });
      createJobCard(res.jobId, 'highlights', '✂️ Reel Highlights');
      pollJob(res.jobId);
    }
    
    if (state.features.subtitles) {
      const res = await startAiJob('/ai/subtitles', { jobId: rootJobId, language: state.subtitleLang });
      createJobCard(res.jobId, 'subtitles', `💬 Subtitles (${state.subtitleLang.toUpperCase()})`);
      pollJob(res.jobId);
    }

  } catch (err) {
    showToast(err.message, 'error');
    resetTool();
  }
}

async function startAiJob(endpoint, payload) {
  const res = await fetch(API_BASE + endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

// --- Polling & Job UI ---
function createJobCard(jobId, type, title) {
  const html = `
    <div class="job-card" id="job-${jobId}">
      <div class="job-header">
        <div class="job-title-wrap">
          <span class="job-icon">${getIconForType(type)}</span>
          <span class="job-title">${title}</span>
        </div>
        <span class="job-status-badge processing" id="status-${jobId}">Processing</span>
      </div>
      <div class="job-progress-wrap" id="progwrap-${jobId}">
        <div class="job-step">
          <span id="step-${jobId}">Waiting to start...</span>
          <span id="pct-${jobId}">0%</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" id="bar-${jobId}"></div>
        </div>
      </div>
      <div class="job-result" id="res-${jobId}"></div>
    </div>
  `;
  elJobsContainer.insertAdjacentHTML('beforeend', html);
}

function getIconForType(type) {
  return { download: '🎥', summary: '🧠', highlights: '✂️', subtitles: '💬' }[type] || '⚙️';
}

function pollJob(jobId) {
  if (state.activeJobs.has(jobId)) return;

  const interval = setInterval(async () => {
    try {
      const res = await fetch(`${API_BASE}/jobs/${jobId}`);
      const data = await res.json();
      
      if (!res.ok || !data.job) throw new Error('Job fetch failed');
      
      const job = data.job;
      updateJobUI(job);

      if (job.status === 'completed' || job.status === 'error') {
        clearInterval(interval);
        state.activeJobs.delete(jobId);
      }
    } catch (err) {
      console.error(err);
    }
  }, 1000); // poll every 1s

  state.activeJobs.set(jobId, interval);
}

function updateJobUI(job) {
  const elStatus = document.getElementById(`status-${job.id}`);
  const elStep = document.getElementById(`step-${job.id}`);
  const elPct = document.getElementById(`pct-${job.id}`);
  const elBar = document.getElementById(`bar-${job.id}`);
  const elRes = document.getElementById(`res-${job.id}`);
  const elProgWrap = document.getElementById(`progwrap-${job.id}`);

  if (!elStatus) return; // element removed

  if (job.status === 'processing') {
    elStep.innerText = job.currentStep || 'Processing...';
    elPct.innerText = `${job.progress}%`;
    elBar.style.width = `${job.progress}%`;
  } else if (job.status === 'completed') {
    elStatus.className = 'job-status-badge completed';
    elStatus.innerText = 'Completed';
    elProgWrap.style.display = 'none';
    
    // Render Results
    elRes.style.display = 'block';
    renderJobResult(job.type, job.result, elRes);
    
    showToast(`${getIconForType(job.type)} ${job.type} complete!`);
  } else if (job.status === 'error') {
    elStatus.className = 'job-status-badge error';
    elStatus.innerText = 'Error';
    elStep.innerText = 'Failed: ' + (job.error || 'Unknown error');
    elBar.style.background = '#ef4444';
  }
}

function renderJobResult(type, result, container) {
  if (!result) return;
  
  let html = '';

  if (type === 'download') {
    html = `
      <div style="font-size:0.875rem; color:#9ca3af; margin-bottom: 0.5rem;">
        File: ${result.filename} (${result.size}) | Quality: ${result.quality}
      </div>
      <a href="${result.downloadUrl}" download="${result.filename}" class="result-btn primary" target="_blank">⬇️ Download MP4</a>
    `;
  } else if (type === 'summary') {
    // Escape quotes for onclick
    const safeSummary = result.summary.replace(/'/g, "\\'").replace(/"/g, "&quot;");
    html = `
      <div class="summary-text">${result.summary}</div>
      <div style="font-weight:600; margin-bottom:0.5rem; font-size:0.9rem;">Key Points:</div>
      <ul class="key-points">
        ${result.keyPoints.map(p => `<li>${p}</li>`).join('')}
      </ul>
      <button class="result-btn" onclick="downloadStringAsFile('${safeSummary}', 'summary.txt', 'text/plain')">📄 Download TXT</button>
      <button class="result-btn primary" onclick="navigator.clipboard.writeText('${safeSummary}'); showToast('Copied to clipboard');">📋 Copy Summary</button>
    `;
  } else if (type === 'highlights') {
    html = `
      <div class="clips-grid">
        ${result.clips.map(c => `
          <div class="clip-item">
            <div class="clip-info">
              <span class="clip-time">${c.startTime} - ${c.endTime}</span>
              <span class="clip-desc">${c.emotion} | Score: ${c.score}</span>
            </div>
            <button class="result-btn" style="margin:0;" onclick="showToast('Highlight clip ready for export!')">⬇️ MP4 (Mock)</button>
          </div>
        `).join('')}
      </div>
      <button class="result-btn primary" onclick="downloadStringAsFile('<timeline></timeline>', 'timeline.xml', 'text/xml')">🎬 Export timeline XML</button>
    `;
  } else if (type === 'subtitles') {
    const safeSRT = result.srtContent.replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/\n/g, '\\n');
    html = `
      <div style="font-size:0.875rem; color:#9ca3af; margin-bottom: 0.5rem;">
        Language: ${result.language.toUpperCase()} | Lines: ${result.totalLines}
      </div>
      <div style="background:rgba(0,0,0,0.3); padding:0.5rem; border-radius:0.5rem; max-height:100px; overflow-y:auto; font-family:monospace; font-size:0.75rem; color:#9ca3af; margin-bottom:0.5rem; white-space:pre-wrap;">${result.srtContent}</div>
      <button class="result-btn primary" onclick="downloadStringAsFile('${safeSRT}', '${result.filename}', 'text/plain')">⬇️ Download .SRT</button>
    `;
  }

  container.innerHTML = html;
}

// Utility to download string content as file
function downloadStringAsFile(content, filename, type) {
  const blob = new Blob([content], { type: type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function resetTool() {
  // Clear Intervals
  for (const interval of state.activeJobs.values()) {
    clearInterval(interval);
  }
  state.activeJobs.clear();
  
  // Reset UI
  elPanelResults.style.display = 'none';
  elPanelUrl.style.display = 'block';
  elPanelFeatures.style.display = 'block';
  
  elUrlInput.value = '';
  state.videoUrl = '';
  state.videoInfo = null;
  elPreview.style.display = 'none';
  elProcessBtn.disabled = true;
  elProcessBtn.style.opacity = '0.5';
  
  showToast('Ready for next video!');
}

// --- Theme Switcher ---
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  setTheme(savedTheme);

  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const theme = e.currentTarget.dataset.setTheme;
      setTheme(theme);
    });
  });
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  
  document.querySelectorAll('.theme-btn').forEach(btn => {
    if (btn.dataset.setTheme === theme) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// --- Rating System ---
function initRating() {
  const stars = document.querySelectorAll('.star');
  const ratingMsg = document.getElementById('rating-msg');
  let hasRated = false;

  stars.forEach(star => {
    star.addEventListener('mouseover', function() {
      if (hasRated) return;
      const val = parseInt(this.getAttribute('data-val'));
      stars.forEach(s => {
        if (parseInt(s.getAttribute('data-val')) <= val) {
          s.style.color = '#fbbf24';
          s.style.transform = 'scale(1.1)';
        } else {
          s.style.color = 'var(--text-muted)';
          s.style.transform = 'scale(1)';
        }
      });
    });
    
    star.addEventListener('mouseout', function() {
      if (hasRated) return;
      stars.forEach(s => {
        s.style.color = 'var(--text-muted)';
        s.style.transform = 'scale(1)';
      });
    });
    
    star.addEventListener('click', function() {
      if (hasRated) return; // Only allow rating once per session
      hasRated = true;
      const val = parseInt(this.getAttribute('data-val'));
      stars.forEach(s => {
        if (parseInt(s.getAttribute('data-val')) <= val) {
          s.classList.add('selected');
          s.style.color = '#fbbf24';
          s.style.transform = 'scale(1.1)';
        } else {
          s.classList.remove('selected');
          s.style.color = 'var(--text-muted)';
          s.style.transform = 'scale(1)';
        }
      });
      ratingMsg.style.display = 'block';
      ratingMsg.style.animation = 'slide-down 0.3s ease';
      
      const messages = ['Oh no! 😢', 'Thanks! We will improve!', 'Not bad! 👍', 'Glad you liked it! 🔥', 'Awesome! Thank you so much! 💖'];
      ratingMsg.innerText = messages[val - 1];
      
      showToast(`You rated us ${val} stars!`);
    });
  });
}
