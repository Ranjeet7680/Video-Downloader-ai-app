// ✅ In-memory job store (use Redis for production)
const jobs = new Map();

module.exports = {
  set: (id, job) => jobs.set(id, job),
  get: (id) => jobs.get(id),
  delete: (id) => jobs.delete(id),
  getAll: () => Array.from(jobs.values()),
  has: (id) => jobs.has(id),
  clear: () => jobs.clear(),
  size: () => jobs.size,
};
