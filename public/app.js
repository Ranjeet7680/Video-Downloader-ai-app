// ============================================================
// 📱 Android WebView Detection & API Config
// ============================================================
const VERCEL_URL = 'https://your-app.vercel.app';
const API_BASE = (typeof window !== 'undefined' && window.isAndroidApp)
  ? `${VERCEL_URL}/api`
  : '/api';

// --- State Management ---
const state = {
  videoUrl: '',
  videoInfo: null,
  qualities: [],
  selectedQualityId: '720p',
  sortOrder: 'asc', // 'asc' = Low to High (144p -> 4K), 'desc' = High to Low (4K -> 144p)
  filterType: 'all', // 'all', 'hd', 'saver', 'audio'
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
const elClearBtn = document.getElementById('clear-btn');
const elFetchBtn = document.getElementById('fetch-info-btn');
const elProcessBtn = document.getElementById('process-btn');
const elPreview = document.getElementById('video-preview');
const elPanelUrl = document.getElementById('panel-url');
const elPanelFeatures = document.getElementById('panel-features');
const elPanelResults = document.getElementById('panel-results');
const elJobsContainer = document.getElementById('jobs-container');
const elLangRow = document.getElementById('lang-row');
const elQualityGrid = document.getElementById('quality-grid');
const elSqBadge = document.getElementById('sq-badge');
const elSqTitle = document.getElementById('sq-title');
const elSqDesc = document.getElementById('sq-desc');
const elSqBtnLabel = document.getElementById('sq-btn-label');
const elSortIcon = document.getElementById('sort-icon');
const elSortLabel = document.getElementById('sort-label');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initRating();

  if (elUrlInput) {
    elUrlInput.addEventListener('input', (e) => {
      state.videoUrl = e.target.value.trim();
      toggleClearButton(!!state.videoUrl);
      if (state.videoUrl) {
        if (elProcessBtn) {
          elProcessBtn.disabled = true;
          elProcessBtn.style.opacity = '0.5';
        }
      }
    });

    elUrlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        fetchVideoInfo();
      }
    });
  }

  if (elProcessBtn) {
    elProcessBtn.disabled = true;
    elProcessBtn.style.opacity = '0.5';
  }
});

// --- URL & Clipboard Helpers ---
function toggleClearButton(show) {
  if (elClearBtn) {
    elClearBtn.style.display = show ? 'block' : 'none';
  }
}

function clearUrlInput() {
  if (elUrlInput) {
    elUrlInput.value = '';
    state.videoUrl = '';
    toggleClearButton(false);
    elPreview.style.display = 'none';
    if (elProcessBtn) {
      elProcessBtn.disabled = true;
      elProcessBtn.style.opacity = '0.5';
    }
  }
}

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      elUrlInput.value = text.trim();
      state.videoUrl = text.trim();
      toggleClearButton(true);
      showToast('Pasted link from clipboard');
      fetchVideoInfo();
    }
  } catch (err) {
    showToast('Clipboard access denied, please paste manually', 'error');
  }
}

function loadSampleUrl(url) {
  if (elUrlInput) {
    elUrlInput.value = url;
    state.videoUrl = url;
    toggleClearButton(true);
    showToast('Sample loaded! Fetching info...');
    fetchVideoInfo();
  }
}

// --- Notification Toast ---
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.innerHTML = type === 'error' ? `❌ ${message}` : `✅ ${message}`;
  toast.className = `toast show ${type}`;

  setTimeout(() => {
    toast.className = 'toast';
  }, 3500);
}

// --- Video Info & Quality Engine ---
async function fetchVideoInfo() {
  const url = elUrlInput ? elUrlInput.value.trim() : '';
  if (!url) {
    showToast('Please enter a valid video URL', 'error');
    return;
  }

  try {
    if (elFetchBtn) {
      elFetchBtn.innerHTML = '⏳ Analyzing streams...';
      elFetchBtn.disabled = true;
    }

    const res = await fetch(`${API_BASE}/video/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to retrieve video details');

    state.videoInfo = data.data;
    state.qualities = data.data.qualities || [];

    // Select default recommended quality (or highest available under 1080p)
    const recommended = state.qualities.find(q => q.isRecommended && q.type === 'video') ||
                        state.qualities.find(q => q.type === 'video') ||
                        state.qualities[0];
    if (recommended) {
      state.selectedQualityId = recommended.id;
    }

    renderVideoPreview(data.data);
    renderQualityCards();
    updateSelectedBanner();

    showToast('Streams & qualities loaded!');

    if (elProcessBtn) {
      elProcessBtn.disabled = false;
      elProcessBtn.style.opacity = '1';
    }

    // Smooth scroll down to preview
    elPreview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  } catch (err) {
    console.error('Fetch error:', err);
    showToast(err.message || 'Error fetching video streams', 'error');
  } finally {
    if (elFetchBtn) {
      elFetchBtn.innerHTML = '🔍 Fetch Qualities & Info';
      elFetchBtn.disabled = false;
    }
  }
}

function renderVideoPreview(info) {
  const thumb = document.getElementById('preview-thumb');
  const dur = document.getElementById('preview-duration');
  const plat = document.getElementById('preview-platform');
  const title = document.getElementById('preview-title');
  const channel = document.getElementById('preview-channel');
  const views = document.getElementById('preview-views');
  const date = document.getElementById('preview-date');

  if (thumb) thumb.src = info.thumbnail;
  if (dur) dur.innerText = info.duration || '0:00';
  if (plat) plat.innerText = info.platform || 'Video';
  if (title) title.innerText = info.title || 'Untitled';
  if (channel) channel.innerText = info.channel || '@creator';
  if (views) views.innerText = info.views || 'N/A';
  if (date) date.innerText = info.uploadDate ? `Uploaded ${info.uploadDate}` : 'Available';

  elPreview.style.display = 'block';
}

// --- Quality Sorting & Filtering ---
function toggleQualitySort() {
  state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';

  if (elSortIcon && elSortLabel) {
    if (state.sortOrder === 'asc') {
      elSortIcon.innerText = '🔼';
      elSortLabel.innerText = 'Low to High';
    } else {
      elSortIcon.innerText = '🔽';
      elSortLabel.innerText = 'High to Low';
    }
  }

  renderQualityCards();
  showToast(`Sorted: ${state.sortOrder === 'asc' ? 'Low to High' : 'High to Low'}`);
}

function setQualityFilter(filter) {
  state.filterType = filter;

  document.querySelectorAll('.filter-pill').forEach(btn => {
    if (btn.dataset.filter === filter) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  renderQualityCards();
}

function renderQualityCards() {
  if (!elQualityGrid) return;

  let list = [...state.qualities];

  // Apply Filter
  if (state.filterType === 'hd') {
    list = list.filter(q => q.height >= 720 && q.height <= 4320);
  } else if (state.filterType === 'saver') {
    list = list.filter(q => q.height > 0 && q.height < 720);
  } else if (state.filterType === 'audio') {
    list = list.filter(q => q.type === 'audio');
  }

  // Apply Sort (Low to High vs High to Low)
  list.sort((a, b) => {
    // Keep Audio and Auto at bottom or top sensibly
    if (a.type === 'audio') return 1;
    if (b.type === 'audio') return -1;
    if (a.id === 'best') return 1;
    if (b.id === 'best') return -1;

    if (state.sortOrder === 'asc') {
      return a.height - b.height;
    } else {
      return b.height - a.height;
    }
  });

  if (list.length === 0) {
    elQualityGrid.innerHTML = `
      <div class="quality-empty">
        <span>No formats match this filter. Try selecting 'All'.</span>
      </div>
    `;
    return;
  }

  const html = list.map(q => {
    const isSelected = q.id === state.selectedQualityId;
    const tagClass = `badge-${(q.tag || 'std').toLowerCase()}`;
    const isAudio = q.type === 'audio';

    return `
      <div class="quality-card ${isSelected ? 'active' : ''} ${isAudio ? 'card-audio' : ''}"
           onclick="selectQuality('${q.id}')">
        <div class="qc-top">
          <span class="qc-badge ${tagClass}">${q.tag}</span>
          <span class="qc-size">${q.size || 'Auto Size'}</span>
        </div>
        <div class="qc-title">${q.label}</div>
        <div class="qc-desc">${q.desc || ''}</div>
        <div class="qc-footer">
          <span class="qc-format-pill">${(q.ext || 'mp4').toUpperCase()}</span>
          ${q.fps && q.fps > 30 ? `<span class="qc-fps-pill">${q.fps} FPS</span>` : ''}
          <div class="qc-radio ${isSelected ? 'checked' : ''}">
            ${isSelected ? '✓' : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  elQualityGrid.innerHTML = html;
}

function selectQuality(id) {
  state.selectedQualityId = id;
  renderQualityCards();
  updateSelectedBanner();
}

function updateSelectedBanner() {
  const chosen = state.qualities.find(q => q.id === state.selectedQualityId) || state.qualities[0];
  if (!chosen) return;

  if (elSqBadge) elSqBadge.innerText = chosen.tag || chosen.quality;
  if (elSqTitle) elSqTitle.innerText = chosen.label;
  if (elSqDesc) {
    const isAudio = chosen.type === 'audio';
    elSqDesc.innerText = isAudio
      ? `Estimated ${chosen.size} • High Fidelity MP3 Audio (No Video)`
      : `Estimated ${chosen.size} • Full MP4 Video with Merged Audio`;
  }
  if (elSqBtnLabel) elSqBtnLabel.innerText = chosen.label;
}

// --- Quick Download & Processing ---
async function quickDownload() {
  if (!state.videoInfo) {
    showToast('Please fetch video info first', 'error');
    return;
  }

  // Ensure download is active
  state.features.download = true;
  state.features.summary = false;
  state.features.highlights = false;
  state.features.subtitles = false;

  triggerDownloadPipeline();
}

function toggleFeature(element, featureId) {
  const isEnabled = !state.features[featureId];
  state.features[featureId] = isEnabled;

  if (isEnabled) {
    element.classList.add('active');
    document.getElementById(`switch-${featureId}`).classList.add('on');
  } else {
    element.classList.remove('active');
    document.getElementById(`switch-${featureId}`).classList.remove('on');
  }

  if (featureId === 'subtitles' && elLangRow) {
    elLangRow.style.display = isEnabled ? 'flex' : 'none';
  }
}

async function startProcessing() {
  if (!state.videoInfo) {
    showToast('Please fetch video info first', 'error');
    return;
  }

  const hasFeatures = Object.values(state.features).some(v => v);
  if (!hasFeatures) {
    showToast('Please select at least one action or download option', 'error');
    return;
  }

  triggerDownloadPipeline();
}

async function triggerDownloadPipeline() {
  // Switch view to results panel
  elPanelUrl.style.display = 'none';
  elPanelFeatures.style.display = 'none';
  elPanelResults.style.display = 'block';
  elJobsContainer.innerHTML = '';

  const chosenQuality = state.selectedQualityId || '720p';
  const isAudio = chosenQuality === 'audio' || chosenQuality === 'audio-mp3';

  if (document.getElementById('lang-select')) {
    state.subtitleLang = document.getElementById('lang-select').value;
  }

  try {
    // 1. Download Job
    const dlRes = await fetch(`${API_BASE}/video/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: state.videoUrl,
        quality: chosenQuality,
        title: state.videoInfo.title || 'Video'
      })
    });

    const dlData = await dlRes.json();
    if (!dlRes.ok) throw new Error(dlData.error || 'Failed to start download');

    const rootJobId = dlData.jobId;
    createJobCard(rootJobId, 'download', isAudio ? '🎵 MP3 Audio Download' : `🎥 Video Download (${chosenQuality})`);
    pollJob(rootJobId);

    // 2. Optional AI Suite Jobs
    if (state.features.summary) {
      const res = await startAiJob('/ai/summarize', {
        jobId: rootJobId,
        videoTitle: state.videoInfo.title
      });
      createJobCard(res.jobId, 'summary', '🧠 AI Auto Summary');
      pollJob(res.jobId);
    }

    if (state.features.highlights) {
      const res = await startAiJob('/ai/highlights', { jobId: rootJobId });
      createJobCard(res.jobId, 'highlights', '✂️ Reel Highlights (9:16)');
      pollJob(res.jobId);
    }

    if (state.features.subtitles) {
      const res = await startAiJob('/ai/subtitles', {
        jobId: rootJobId,
        language: state.subtitleLang
      });
      createJobCard(res.jobId, 'subtitles', `💬 Auto Subtitles (${state.subtitleLang.toUpperCase()})`);
      pollJob(res.jobId);
    }

    // Scroll to results
    elPanelResults.scrollIntoView({ behavior: 'smooth' });

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

// --- Job Polling & UI ---
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
          <span id="step-${jobId}">Starting stream engine...</span>
          <span id="pct-${jobId}" class="pct-badge">0%</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" id="bar-${jobId}"></div>
        </div>
        <div class="job-metrics-row" id="metrics-${jobId}" style="display:none;">
          <span class="metric-pill" id="speed-${jobId}">⚡ Speed: --</span>
          <span class="metric-pill" id="eta-${jobId}">⏱️ ETA: --</span>
        </div>
      </div>
      <div class="job-result" id="res-${jobId}"></div>
    </div>
  `;
  elJobsContainer.insertAdjacentHTML('beforeend', html);
}

function getIconForType(type) {
  return { download: '⬇️', summary: '🧠', highlights: '✂️', subtitles: '💬' }[type] || '⚙️';
}

function pollJob(jobId) {
  if (state.activeJobs.has(jobId)) return;

  const interval = setInterval(async () => {
    try {
      const res = await fetch(`${API_BASE}/jobs/${jobId}`);
      const data = await res.json();

      if (!res.ok || !data.job) throw new Error('Job fetch error');

      const job = data.job;
      updateJobUI(job);

      if (job.status === 'completed' || job.status === 'error') {
        clearInterval(interval);
        state.activeJobs.delete(jobId);
      }
    } catch (err) {
      console.error('Poll error:', err);
    }
  }, 900);

  state.activeJobs.set(jobId, interval);
}

function updateJobUI(job) {
  const elStatus = document.getElementById(`status-${job.id}`);
  const elStep = document.getElementById(`step-${job.id}`);
  const elPct = document.getElementById(`pct-${job.id}`);
  const elBar = document.getElementById(`bar-${job.id}`);
  const elRes = document.getElementById(`res-${job.id}`);
  const elProgWrap = document.getElementById(`progwrap-${job.id}`);
  const elMetrics = document.getElementById(`metrics-${job.id}`);
  const elSpeed = document.getElementById(`speed-${job.id}`);
  const elEta = document.getElementById(`eta-${job.id}`);

  if (!elStatus) return;

  if (job.status === 'processing') {
    if (elStep) elStep.innerText = job.currentStep || 'Processing...';
    if (elPct) elPct.innerText = `${job.progress || 0}%`;
    if (elBar) elBar.style.width = `${Math.min(job.progress || 0, 100)}%`;

    if (job.downloadSpeed && elMetrics && elSpeed && elEta) {
      elMetrics.style.display = 'flex';
      elSpeed.innerText = `⚡ ${job.downloadSpeed}`;
      elEta.innerText = `⏱️ ETA: ${job.downloadEta || 'calculating'}`;
    }
  } else if (job.status === 'completed') {
    elStatus.className = 'job-status-badge completed';
    elStatus.innerText = 'Completed ✓';
    if (elProgWrap) elProgWrap.style.display = 'none';

    if (elRes) {
      elRes.style.display = 'block';
      renderJobResult(job.type, job.result, elRes);
    }

    showToast(`Done: ${job.type} ready!`);
  } else if (job.status === 'error') {
    elStatus.className = 'job-status-badge error';
    elStatus.innerText = 'Failed';
    if (elStep) elStep.innerText = 'Error: ' + (job.error || 'Download failed');
    if (elBar) elBar.style.background = '#ef4444';
  }
}

function renderJobResult(type, result, container) {
  if (!result) return;
  let html = '';

  if (type === 'download') {
    const isAudio = result.isAudio || result.ext === 'mp3';
    html = `
      <div class="result-media-card">
        <div class="media-preview-box">
          ${isAudio ? `
            <div class="audio-player-box">
              <div class="audio-avatar">🎵</div>
              <div class="audio-meta">
                <div class="audio-title">${result.title || 'Audio Stream'}</div>
                <div class="audio-sub">High Quality MP3 • ${result.size}</div>
              </div>
              <audio controls src="${result.path}" class="native-audio-player"></audio>
            </div>
          ` : `
            <video controls playsinline src="${result.path}" class="native-video-player" poster="${state.videoInfo?.thumbnail || ''}"></video>
          `}
        </div>

        <div class="result-specs-row">
          <div class="spec-pill">
            <span class="spec-label">Quality</span>
            <span class="spec-val highlight">${result.quality}</span>
          </div>
          <div class="spec-pill">
            <span class="spec-label">File Size</span>
            <span class="spec-val">${result.size}</span>
          </div>
          <div class="spec-pill">
            <span class="spec-label">Format</span>
            <span class="spec-val">${(result.ext || 'mp4').toUpperCase()}</span>
          </div>
        </div>

        <div class="result-actions-row">
          <a href="${result.downloadUrl}" download="${result.filename}" class="result-btn primary big-btn">
            ⬇️ Save ${isAudio ? 'MP3 Audio' : 'Video File'}
          </a>
          <button class="result-btn" onclick="copyDirectDownloadLink('${result.downloadUrl}')">
            📋 Copy Direct Link
          </button>
          <button class="result-btn ghost" onclick="resetTool()">
            🔄 Download Another Quality
          </button>
        </div>
      </div>
    `;
  } else if (type === 'summary') {
    const safeSummary = (result.summary || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    html = `
      <div class="summary-text">${result.summary}</div>
      <div style="font-weight:700; margin-bottom:0.5rem; font-size:0.95rem;">Key Takeaways:</div>
      <ul class="key-points">
        ${(result.keyPoints || []).map(p => `<li>${p}</li>`).join('')}
      </ul>
      <div class="result-actions-row" style="margin-top:1rem;">
        <button class="result-btn primary" onclick="navigator.clipboard.writeText('${safeSummary}'); showToast('Summary copied!');">
          📋 Copy Summary
        </button>
        <button class="result-btn" onclick="downloadStringAsFile('${safeSummary}', 'video-summary.txt', 'text/plain')">
          📄 Download .TXT
        </button>
      </div>
    `;
  } else if (type === 'highlights') {
    html = `
      <div class="clips-grid">
        ${(result.clips || []).map(c => `
          <div class="clip-item">
            <div class="clip-info">
              <span class="clip-time">${c.startTime} - ${c.endTime}</span>
              <span class="clip-desc">${c.emotion} (Score: ${c.score})</span>
            </div>
            <button class="result-btn" style="margin:0;" onclick="showToast('Highlight clip ready for export!')">⬇️ Clip MP4</button>
          </div>
        `).join('')}
      </div>
    `;
  } else if (type === 'subtitles') {
    const safeSRT = (result.srtContent || '').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n');
    html = `
      <div style="font-size:0.875rem; color:#9ca3af; margin-bottom: 0.5rem;">
        Language: ${(result.language || 'EN').toUpperCase()} | Total Lines: ${result.totalLines || 0}
      </div>
      <div style="background:rgba(0,0,0,0.3); padding:0.75rem; border-radius:0.5rem; max-height:120px; overflow-y:auto; font-family:monospace; font-size:0.75rem; color:#9ca3af; margin-bottom:0.75rem; white-space:pre-wrap;">${result.srtContent}</div>
      <button class="result-btn primary" onclick="downloadStringAsFile('${safeSRT}', '${result.filename || 'subtitles.srt'}', 'text/plain')">
        ⬇️ Download .SRT Subtitle File
      </button>
    `;
  }

  container.innerHTML = html;
}

function copyDirectDownloadLink(relativeUrl) {
  const fullUrl = window.location.origin + relativeUrl;
  navigator.clipboard.writeText(fullUrl);
  showToast('Direct download link copied to clipboard!');
}

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
  for (const interval of state.activeJobs.values()) {
    clearInterval(interval);
  }
  state.activeJobs.clear();

  elPanelResults.style.display = 'none';
  elPanelUrl.style.display = 'block';
  elPanelFeatures.style.display = 'block';

  elPanelUrl.scrollIntoView({ behavior: 'smooth' });
  showToast('Ready for another video or quality!');
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
          s.style.transform = 'scale(1.15)';
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
      if (hasRated) return;
      hasRated = true;
      const val = parseInt(this.getAttribute('data-val'));
      stars.forEach(s => {
        if (parseInt(s.getAttribute('data-val')) <= val) {
          s.classList.add('selected');
          s.style.color = '#fbbf24';
          s.style.transform = 'scale(1.15)';
        } else {
          s.classList.remove('selected');
          s.style.color = 'var(--text-muted)';
          s.style.transform = 'scale(1)';
        }
      });
      if (ratingMsg) {
        ratingMsg.style.display = 'block';
        ratingMsg.style.animation = 'slide-down 0.3s ease';
        const messages = ['Oh no! We will improve! 😢', 'Thanks! Working hard to get better!', 'Good feedback! 👍', 'Glad you loved it! 🔥', 'You are amazing! Thank you so much! 💖'];
        ratingMsg.innerText = messages[val - 1] || 'Thank you!';
      }
      showToast(`Thank you for rating ${val} stars!`);
    });
  });
}
