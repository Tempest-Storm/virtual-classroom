import { Router } from 'express';
import * as ctrl from '../controllers/courseController.js';
import { protect, restrict } from '../middleware/auth.js';

const router = Router();
router.use(protect);

router.get('/', ctrl.listCourses);
router.post('/', restrict('teacher', 'admin'), ctrl.createCourse);
router.post('/enrol', ctrl.enrol);
router.get('/:id', ctrl.getCourse);
router.patch('/:id', restrict('teacher', 'admin'), ctrl.updateCourse);
router.post('/:id/enrol', ctrl.enrol);
router.post('/:id/unenrol', ctrl.unenrol);

export default router;
