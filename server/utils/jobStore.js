const db = require('./db');

// In-memory cache + persistent database sync (supports Vercel serverless)
const memoryJobs = new Map();

module.exports = {
  set: (id, job) => {
    memoryJobs.set(id, job);
    try {
      db.setJob(id, job);
    } catch (e) {
      // safe fallback
    }
    return job;
  },

  get: (id) => {
    if (memoryJobs.has(id)) {
      return memoryJobs.get(id);
    }
    try {
      const persisted = db.getJob(id);
      if (persisted) {
        memoryJobs.set(id, persisted);
        return persisted;
      }
    } catch (e) {
      // safe fallback
    }
    return null;
  },

  delete: (id) => {
    memoryJobs.delete(id);
    try {
      return db.deleteJob(id);
    } catch (e) {
      return false;
    }
  },

  getAll: () => {
    try {
      const fromDb = db.getAllJobs();
      if (fromDb && fromDb.length > 0) return fromDb;
    } catch (e) {}
    return Array.from(memoryJobs.values());
  },

  has: (id) => {
    return memoryJobs.has(id) || !!db.getJob(id);
  },

  clear: () => {
    memoryJobs.clear();
  },

  size: () => {
    return memoryJobs.size;
  }
};
