import { Router } from 'express';
import * as ctrl from '../controllers/assignmentController.js';
import { protect, restrict } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();
router.use(protect);

router.get('/', ctrl.listAssignments);
router.post('/', restrict('teacher', 'admin'), upload.array('attachments', 5), ctrl.createAssignment);
router.get('/:id', ctrl.getAssignment);
router.post('/:id/submit', restrict('student'), upload.array('files', 5), ctrl.submit);
router.post('/submissions/:submissionId/grade', restrict('teacher', 'admin'), ctrl.grade);

export default router;
