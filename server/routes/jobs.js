const express = require('express');
const router = express.Router();
const jobStore = require('../utils/jobStore');

// ✅ GET /api/jobs/:jobId - Get job status & progress
router.get('/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobStore.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found', jobId });
  }

  res.json({
    success: true,
    job: {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      currentStep: job.currentStep,
      steps: job.steps,
      result: job.result || null,
      createdAt: job.createdAt,
      completedAt: job.status === 'completed' ? new Date().toISOString() : null
    }
  });
});

// ✅ GET /api/jobs - Get all jobs
router.get('/', (req, res) => {
  const allJobs = jobStore.getAll();
  res.json({
    success: true,
    total: allJobs.length,
    jobs: allJobs.map(j => ({
      id: j.id,
      type: j.type,
      status: j.status,
      progress: j.progress,
      createdAt: j.createdAt
    }))
  });
});

// ✅ DELETE /api/jobs/:jobId - Cancel/delete a job
router.delete('/:jobId', (req, res) => {
  const { jobId } = req.params;
  const deleted = jobStore.delete(jobId);

  if (!deleted) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json({ success: true, message: 'Job deleted' });
});

module.exports = router;
