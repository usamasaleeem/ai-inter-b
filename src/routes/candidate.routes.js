const express = require('express');
const auth = require('../middlewares/auth.middleware');
const candidateController = require('../controllers/candidate.controller');
const upload = require("../middlewares/upload");
const router = express.Router();
const parseResume = require("../middlewares/parse.middleware");


router.post('/apply', candidateController.apply);
router.post(
  "/resume-upload",
  upload.single("resume"),
  // 🔥 THIS uploads file to Cloudinary
  candidateController.uploadResumeController
);
// the rest require auth
router.use(auth);

router.get('/getall', candidateController.getCandidatesByOrg);

router.get('/job/:jobId', candidateController.getCandidatesByJob);
router.get('/:id', candidateController.getCandidate);
router.patch('/:id/status', candidateController.updateStatus);

module.exports = router;
