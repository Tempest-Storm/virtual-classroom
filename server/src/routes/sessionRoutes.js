import { Router } from 'express';
import * as ctrl from '../controllers/sessionController.js';
import { protect, restrict } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();
router.use(protect);

router.get('/', ctrl.listSessions);
router.post('/', restrict('teacher', 'admin'), ctrl.createSession);
router.get('/:id', ctrl.getSession);
router.post('/:id/start', restrict('teacher', 'admin'), ctrl.startSession);
router.post('/:id/end', restrict('teacher', 'admin'), ctrl.endSession);
router.post('/:id/recognise', ctrl.submitRecognition);
router.get('/:id/attendance', ctrl.sessionAttendance);
router.post('/:id/attendance/override', restrict('teacher', 'admin'), ctrl.overrideAttendance);
router.post('/:id/recording', restrict('teacher', 'admin'), upload.single('recording'), ctrl.saveRecording);

export default router;
