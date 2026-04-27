const express = require('express');
const authController = require('../controllers/auth.controller');
const auth = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload');

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);




router.use(auth);
router.post(
  "/logo-upload",
  upload.single("logo"), // 👈 field name from frontend
  authController.uploadLogoController
);
router.post('/checkout', authController.verifyCheckout);
router.post('/updatetemp', authController.upsertTemplate);
router.get('/gettemp', authController.getTemplates);
router.get('/getprofile', authController.getProfile);
router.put('/updateprofile', authController.updateProfile);




module.exports = router;
