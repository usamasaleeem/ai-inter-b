const express = require('express');

const authRoutes = require('./auth.routes');
const jobRoutes = require('./job.routes');
const candidateRoutes = require('./candidate.routes');
const interviewRoutes = require('./interview.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/jobs', jobRoutes);
router.use('/candidates', candidateRoutes);
router.use('/interview', interviewRoutes);

router.get('/health', (req, res) => {
  res.status(200).send('OK');
});

module.exports = router;
