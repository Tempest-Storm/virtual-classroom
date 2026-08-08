import { Router } from 'express';
import * as ctrl from '../controllers/analyticsController.js';
import { protect, restrict } from '../middleware/auth.js';

const router = Router();
router.use(protect);

router.get('/dashboard/student', ctrl.myDashboard);
router.get('/dashboard/teacher', restrict('teacher', 'admin'), ctrl.teacherDashboard);
router.get('/course/:courseId', restrict('teacher', 'admin'), ctrl.getCourseAnalytics);
router.get('/course/:courseId/scoreboard', ctrl.scoreboard);
router.get('/course/:courseId/attendance', restrict('teacher', 'admin'), ctrl.attendanceReport);
router.get('/course/:courseId/student/:studentId', ctrl.getStudentAnalytics);
router.post('/course/:courseId/regenerate', restrict('teacher', 'admin'), ctrl.regenerate);
router.get('/insights', ctrl.listInsights);
router.post('/insights/:id/acknowledge', ctrl.acknowledgeInsight);

export default router;
