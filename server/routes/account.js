const express = require('express');
const router = express.Router();
const db = require('../utils/db');

// Helper to extract user identity from request
function getUserIdFromReq(req) {
  return (
    req.headers['x-user-id'] ||
    req.headers['x-guest-id'] ||
    req.query.userId ||
    req.body.userId ||
    'guest_default'
  );
}

// ✅ GET /api/account/me
// Get current user stats, plan, remaining downloads, subscription status
router.get('/me', (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const stats = db.getUserStats(userId);
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Account /me error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch account info' });
  }
});

// ✅ POST /api/account/register
router.post('/register', (req, res) => {
  try {
    const { email, password, name, guestId } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.registerUser(email, password, name);

    // If migrating from guest, migrate guest downloads
    if (guestId) {
      const dbInstance = db.loadDb();
      dbInstance.downloads.forEach(d => {
        if (d.userId === guestId) d.userId = user.id;
      });
      dbInstance.subscriptions.forEach(s => {
        if (s.userId === guestId) s.userId = user.id;
      });
      db.saveDb();
    }

    const stats = db.getUserStats(user.id);

    res.json({
      success: true,
      message: 'Account registered successfully!',
      user,
      stats
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(400).json({ error: error.message || 'Registration failed' });
  }
});

// ✅ POST /api/account/login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.loginUser(email, password);
    const stats = db.getUserStats(user.id);

    res.json({
      success: true,
      message: 'Welcome back!',
      user,
      stats
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: error.message || 'Invalid credentials' });
  }
});

// ✅ GET /api/account/plans
router.get('/plans', (req, res) => {
  try {
    const plans = db.getPlans();
    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ POST /api/account/subscribe
// Select and activate a subscription plan (Pro or VIP)
router.post('/subscribe', (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const { planId, billingCycle = 'monthly', paymentMethod = 'card' } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'Please choose a plan to subscribe' });
    }

    const result = db.createSubscription(userId, planId, billingCycle, paymentMethod);
    const stats = db.getUserStats(userId);

    res.json({
      success: true,
      message: `🎉 Successfully subscribed to ${result.plan.name}! Your download limits have been upgraded.`,
      subscription: result.subscription,
      plan: result.plan,
      stats
    });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(400).json({ error: error.message || 'Subscription failed' });
  }
});

// ✅ POST /api/account/renew
// Renew an expired or expiring subscription
router.post('/renew', (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const result = db.renewSubscription(userId);
    const stats = db.getUserStats(userId);

    res.json({
      success: true,
      message: `🎉 Your ${result.plan.name} subscription has been renewed for another 30 days!`,
      subscription: result.subscription,
      plan: result.plan,
      stats
    });
  } catch (error) {
    console.error('Renew error:', error);
    res.status(400).json({ error: error.message || 'Renewal failed' });
  }
});

// ✅ GET /api/account/history
// Get download records / history for the current user
router.get('/history', (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const history = db.getUserDownloads(userId);
    res.json({
      success: true,
      total: history.length,
      data: history
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ DELETE /api/account/history/:id
// Delete a specific download record
router.delete('/history/:id', (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const { id } = req.params;
    const deleted = db.deleteDownloadRecord(userId, id);

    if (!deleted) {
      return res.status(404).json({ error: 'Record not found' });
    }

    res.json({
      success: true,
      message: 'Record removed from history'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
