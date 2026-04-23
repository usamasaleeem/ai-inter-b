const express = require('express');
const auth = require('../middlewares/auth.middleware');
const jobController = require('../controllers/job.controller');
const interviewController = require('../controllers/interview.controller');
const authController = require('../controllers/auth.controller');

const router = express.Router();





router
  .route('/public/:id')
  .get(jobController.getPublicJob)

// all routes require auth
router.use(auth);

router
  .route('/')
  .post(jobController.createJob)
  .get(jobController.getJobs);


router
  .route('/:id')
  .get(jobController.getJob)
  .put(jobController.updateJob)
  .delete(jobController.deleteJob);

router.post('/:id/publish', jobController.publishJob);
router.post('/:id/draft', jobController.draftJob);
//router.post('/:jobId/agent', interviewController.createJobAgent);

module.exports = router;
