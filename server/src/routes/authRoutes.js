import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as ctrl from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', authLimiter, ctrl.register);
router.post('/login', authLimiter, ctrl.login);

router.use(protect);
router.get('/me', ctrl.me);
router.patch('/me', ctrl.updateProfile);
router.post('/change-password', ctrl.changePassword);
router.post('/face/enrol', ctrl.enrolFace);
router.delete('/face', ctrl.deleteFaceData);

export default router;
