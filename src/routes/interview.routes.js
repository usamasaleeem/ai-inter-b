const express = require('express');
const interviewController = require('../controllers/interview.controller');
const auth = require('../middlewares/auth.middleware');

const router = express.Router();

// The start endpoint might be called by the frontend on behalf of candidate
// In a full production app, you might issue tokens to candidates. We leave it public for candidate ease.
router.post('/start', interviewController.startInterview);
router.get('/voice', interviewController.startInterview);

// End interview might be called by frontend or retell webhook. Leaving public for demo
router.post('/end', interviewController.endInterview);

module.exports = router;
