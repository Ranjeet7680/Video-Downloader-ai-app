const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Persistent data directory
const DATA_DIR = (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) ? '/tmp/data' : path.join(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure directory exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not initialize DATA_DIR:', e.message);
}

// Initial plans definition
const DEFAULT_PLANS = [
  {
    id: 'free',
    name: 'Free Starter',
    badge: 'FREE FOREVER',
    priceMonthlyINR: 0,
    priceMonthlyUSD: 0,
    priceYearlyINR: 0,
    priceYearlyUSD: 0,
    dailyLimit: 3,
    maxQuality: '720p',
    maxHeight: 720,
    hasWatermark: true,
    speedMultiplier: 1,
    isPopular: false,
    description: 'Perfect for casual downloads and quick previews',
    features: [
      '3 Video Downloads / Day',
      'Up to 720p HD Video Quality',
      '💧 Subtle Video Watermark',
      'Basic AI Summaries',
      'Standard Download Speed',
      'Community Support'
    ]
  },
  {
    id: 'pro',
    name: 'Pro Creator',
    badge: 'MOST POPULAR',
    priceMonthlyINR: 199,
    priceMonthlyUSD: 2.99,
    priceYearlyINR: 1799,
    priceYearlyUSD: 24.99,
    dailyLimit: 50,
    maxQuality: '1080p',
    maxHeight: 1080,
    hasWatermark: false,
    speedMultiplier: 3,
    isPopular: true,
    description: 'Ideal for content creators, students, and regular downloaders',
    features: [
      '50 Video Downloads / Day',
      '✨ 100% Watermark-Free (Clean Videos)',
      '1080p Full HD Video Quality',
      'High-Bitrate 320kbps MP3 Audio',
      'Full AI Auto Summaries & Key Points',
      'Auto-Generated Subtitle Files (.SRT)',
      '3x Faster Download Speed Engine',
      'No Daily Interruptions'
    ]
  },
  {
    id: 'vip',
    name: 'VIP Unlimited',
    badge: 'BEST VALUE',
    priceMonthlyINR: 499,
    priceMonthlyUSD: 5.99,
    priceYearlyINR: 3999,
    priceYearlyUSD: 49.99,
    dailyLimit: 999999, // Unlimited
    maxQuality: '4K',
    maxHeight: 4320,
    hasWatermark: false,
    speedMultiplier: 10,
    isPopular: false,
    description: 'Ultimate power: zero limits, 4K cinema quality, and all AI features',
    features: [
      'Unlimited Video Downloads (∞ / Day)',
      '✨ 100% Watermark-Free (Crystal Clean)',
      '4K Ultra HD & 2K QHD Quality',
      'All Video & Audio Formats (MP4/MP3)',
      'Full AI Suite: Summaries, Reels, Subs',
      'Priority Fast-Track Queue & Max Speed',
      'Bulk Video Queue Support',
      '24/7 VIP Priority Support'
    ]
  }
];

// In-memory cache with mtime tracking
let dbData = null;
let lastDbMtime = 0;

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const stat = fs.statSync(DB_FILE);
      if (!dbData || stat.mtimeMs > lastDbMtime) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        dbData = JSON.parse(raw);
        lastDbMtime = stat.mtimeMs;
      }
    }
  } catch (err) {
    console.error('Failed reading DB file, recreating default:', err.message);
  }

  if (!dbData) {
    dbData = {
      users: [],
      subscriptions: [],
      downloads: [],
      plans: DEFAULT_PLANS,
      jobs: {},
      version: '2.0.0'
    };
    saveDb();
  }

  // Ensure all keys exist
  if (!dbData.users) dbData.users = [];
  if (!dbData.subscriptions) dbData.subscriptions = [];
  if (!dbData.downloads) dbData.downloads = [];
  dbData.plans = DEFAULT_PLANS;
  if (!dbData.jobs) dbData.jobs = {};

  return dbData;
}

// Safe save for Windows and Vercel
function saveDb() {
  if (!dbData) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const raw = JSON.stringify(dbData, null, 2);
    fs.writeFileSync(DB_FILE, raw, 'utf8');
    const stat = fs.statSync(DB_FILE);
    lastDbMtime = stat.mtimeMs;
  } catch (err) {
    console.error('Error saving DB:', err.message);
  }
}

// Password hashing
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  const testHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return testHash === hash;
}

// -------------------------------------------------------------
// USER MANAGEMENT
// -------------------------------------------------------------
function getOrCreateUser(userIdOrGuestId, metadata = {}) {
  const db = loadDb();
  if (!userIdOrGuestId) userIdOrGuestId = `guest_${uuidv4().slice(0, 12)}`;

  let user = db.users.find(u => u.id === userIdOrGuestId || u.guestId === userIdOrGuestId);

  if (!user) {
    const isGuest = userIdOrGuestId.startsWith('guest_');
    user = {
      id: userIdOrGuestId,
      guestId: isGuest ? userIdOrGuestId : null,
      email: isGuest ? null : metadata.email,
      name: metadata.name || (isGuest ? 'Guest User' : 'User'),
      plan: 'free',
      isGuest: isGuest,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    };
    db.users.push(user);
    saveDb();
  } else {
    user.lastActive = new Date().toISOString();
  }

  return user;
}

function registerUser(email, password, name = '') {
  const db = loadDb();
  const normalizedEmail = (email || '').trim().toLowerCase();

  if (!normalizedEmail || !password) {
    throw new Error('Email and password are required');
  }

  const existing = db.users.find(u => u.email === normalizedEmail);
  if (existing) {
    throw new Error('An account with this email already exists');
  }

  const { hash, salt } = hashPassword(password);
  const user = {
    id: `usr_${uuidv4().slice(0, 10)}`,
    email: normalizedEmail,
    name: name.trim() || normalizedEmail.split('@')[0],
    passwordHash: hash,
    salt: salt,
    plan: 'free',
    isGuest: false,
    createdAt: new Date().toISOString(),
    lastActive: new Date().toISOString()
  };

  db.users.push(user);
  saveDb();

  const { passwordHash, salt: _, ...safeUser } = user;
  return safeUser;
}

function loginUser(email, password) {
  const db = loadDb();
  const normalizedEmail = (email || '').trim().toLowerCase();
  const user = db.users.find(u => u.email === normalizedEmail);

  if (!user || !user.passwordHash || !user.salt) {
    throw new Error('Invalid email or password');
  }

  const isValid = verifyPassword(password, user.passwordHash, user.salt);
  if (!isValid) {
    throw new Error('Invalid email or password');
  }

  user.lastActive = new Date().toISOString();
  saveDb();

  const { passwordHash, salt: _, ...safeUser } = user;
  return safeUser;
}

// -------------------------------------------------------------
// SUBSCRIPTIONS & PLANS
// -------------------------------------------------------------
function getPlans() {
  const db = loadDb();
  return db.plans;
}

function getPlan(planId = 'free') {
  const db = loadDb();
  return db.plans.find(p => p.id === planId) || db.plans[0];
}

function getUserSubscription(userId) {
  const db = loadDb();
  // Find latest active subscription
  const sub = db.subscriptions
    .filter(s => s.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

  if (!sub) return null;

  // Check if expired
  const now = new Date();
  const endDate = new Date(sub.endDate);
  const isExpired = endDate < now;

  if (isExpired && sub.status === 'active') {
    sub.status = 'expired';
    saveDb();
  }

  const daysRemaining = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));

  return {
    ...sub,
    isExpired,
    daysRemaining
  };
}

function createSubscription(userId, planId, billingCycle = 'monthly', paymentMethod = 'card') {
  const db = loadDb();
  const user = getOrCreateUser(userId);
  const plan = getPlan(planId);

  if (!plan || plan.id === 'free') {
    throw new Error('Invalid plan selected for subscription');
  }

  const durationDays = billingCycle === 'yearly' ? 365 : 30;
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

  // Invalidate previous active subscriptions for this user
  db.subscriptions.forEach(s => {
    if (s.userId === user.id && s.status === 'active') {
      s.status = 'replaced';
    }
  });

  const price = billingCycle === 'yearly' ? plan.priceYearlyINR : plan.priceMonthlyINR;
  const priceUSD = billingCycle === 'yearly' ? plan.priceYearlyUSD : plan.priceMonthlyUSD;

  const sub = {
    id: `sub_${uuidv4().slice(0, 8)}`,
    userId: user.id,
    planId: plan.id,
    planName: plan.name,
    billingCycle: billingCycle,
    priceINR: price,
    priceUSD: priceUSD,
    currency: 'INR',
    paymentMethod: paymentMethod,
    status: 'active',
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    createdAt: startDate.toISOString(),
    transactionId: `TXN_${Date.now()}_${Math.floor(Math.random() * 10000)}`
  };

  db.subscriptions.push(sub);

  // Update user's active plan
  user.plan = plan.id;
  saveDb();

  return {
    subscription: sub,
    plan,
    daysRemaining: durationDays
  };
}

function renewSubscription(userId) {
  const db = loadDb();
  const user = getOrCreateUser(userId);
  const sub = getUserSubscription(userId);

  if (!sub) {
    throw new Error('No previous subscription found to renew');
  }

  const plan = getPlan(sub.planId);
  const durationDays = sub.billingCycle === 'yearly' ? 365 : 30;
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

  sub.status = 'active';
  sub.startDate = startDate.toISOString();
  sub.endDate = endDate.toISOString();
  sub.renewedAt = startDate.toISOString();
  sub.transactionId = `RENEW_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  user.plan = sub.planId;
  saveDb();

  return {
    subscription: sub,
    plan,
    daysRemaining: durationDays
  };
}

// -------------------------------------------------------------
// DOWNLOAD LIMITS & USAGE TRACKING
// -------------------------------------------------------------
function getUserStats(userId) {
  const db = loadDb();
  const user = getOrCreateUser(userId);
  const sub = getUserSubscription(user.id);

  let effectivePlanId = 'free';
  if (sub && sub.status === 'active' && !sub.isExpired) {
    effectivePlanId = sub.planId;
  }
  user.plan = effectivePlanId;

  const plan = getPlan(effectivePlanId);

  // Count downloads performed today (UTC midnight to now)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const userDownloads = db.downloads.filter(d => d.userId === user.id);
  const downloadsToday = userDownloads.filter(d => new Date(d.downloadedAt) >= todayStart).length;

  const isUnlimited = plan.dailyLimit >= 999999;
  const remainingToday = isUnlimited ? 999999 : Math.max(0, plan.dailyLimit - downloadsToday);
  const isLimitReached = !isUnlimited && downloadsToday >= plan.dailyLimit;

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      isGuest: user.isGuest,
      plan: effectivePlanId
    },
    plan,
    subscription: sub,
    downloadsToday,
    dailyLimit: plan.dailyLimit,
    remainingToday,
    isUnlimited,
    isLimitReached,
    totalDownloads: userDownloads.length
  };
}

function canUserDownload(userId, requestedQuality = '720p') {
  const stats = getUserStats(userId);

  // Check Daily Download Limit
  if (stats.isLimitReached) {
    return {
      allowed: false,
      reason: 'DAILY_LIMIT_REACHED',
      message: `Daily download limit of ${stats.dailyLimit} videos reached on ${stats.plan.name} plan. Upgrade your plan to continue downloading!`,
      stats
    };
  }

  // Check Quality Tier Restriction
  const reqHeight = parseInt(String(requestedQuality).replace('p', '')) || 720;
  if (reqHeight > stats.plan.maxHeight && requestedQuality !== 'audio') {
    return {
      allowed: false,
      reason: 'QUALITY_RESTRICTED',
      message: `${requestedQuality} quality is locked on ${stats.plan.name} (Max: ${stats.plan.maxQuality}). Upgrade to Pro or VIP to unlock high-definition downloads!`,
      stats
    };
  }

  return {
    allowed: true,
    stats
  };
}

// -------------------------------------------------------------
// DOWNLOAD RECORDS & HISTORY
// -------------------------------------------------------------
function recordDownload(userId, info = {}) {
  const db = loadDb();
  const user = getOrCreateUser(userId);

  const entry = {
    id: `dl_${uuidv4().slice(0, 8)}`,
    userId: user.id,
    videoTitle: info.videoTitle || 'Untitled Video',
    url: info.url || '',
    thumbnail: info.thumbnail || '',
    quality: info.quality || '720p',
    format: (info.format || 'mp4').toLowerCase(),
    fileSize: info.fileSize || 'N/A',
    filename: info.filename || '',
    downloadUrl: info.downloadUrl || '',
    downloadedAt: new Date().toISOString()
  };

  db.downloads.unshift(entry); // newest first
  saveDb();

  return entry;
}

function getUserDownloads(userId) {
  const db = loadDb();
  const user = getOrCreateUser(userId);
  return db.downloads.filter(d => d.userId === user.id);
}

function deleteDownloadRecord(userId, downloadId) {
  const db = loadDb();
  const idx = db.downloads.findIndex(d => d.id === downloadId && d.userId === userId);
  if (idx !== -1) {
    db.downloads.splice(idx, 1);
    saveDb();
    return true;
  }
  return false;
}

// -------------------------------------------------------------
// PERSISTENT JOBS STORE (Supports Vercel & Local)
// -------------------------------------------------------------
function setJob(jobId, data) {
  const db = loadDb();
  db.jobs[jobId] = {
    ...(db.jobs[jobId] || {}),
    ...data,
    updatedAt: new Date().toISOString()
  };
  saveDb();
  return db.jobs[jobId];
}

function getJob(jobId) {
  const db = loadDb();
  return db.jobs[jobId] || null;
}

function getAllJobs() {
  const db = loadDb();
  return Object.values(db.jobs);
}

function deleteJob(jobId) {
  const db = loadDb();
  if (db.jobs[jobId]) {
    delete db.jobs[jobId];
    saveDb();
    return true;
  }
  return false;
}

module.exports = {
  loadDb,
  saveDb,
  getPlans,
  getPlan,
  getOrCreateUser,
  registerUser,
  loginUser,
  getUserSubscription,
  createSubscription,
  renewSubscription,
  getUserStats,
  canUserDownload,
  recordDownload,
  getUserDownloads,
  deleteDownloadRecord,
  setJob,
  getJob,
  getAllJobs,
  deleteJob
};
