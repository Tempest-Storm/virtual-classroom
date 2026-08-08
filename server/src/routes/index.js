import { Router } from 'express';
import authRoutes from './authRoutes.js';
import courseRoutes from './courseRoutes.js';
import sessionRoutes from './sessionRoutes.js';
import assignmentRoutes from './assignmentRoutes.js';
import analyticsRoutes from './analyticsRoutes.js';

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
router.use('/auth', authRoutes);
router.use('/courses', courseRoutes);
router.use('/sessions', sessionRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
