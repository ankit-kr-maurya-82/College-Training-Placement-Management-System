import express from 'express';
import { createTpoAccount, loginManager } from '../controllers/auth.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/role.middleware.js';

const router = express.Router();

// Only already-provisioned ADMIN/TPO users can sign in; there is no public staff signup.
router.post('/manager/login', loginManager);
router.post('/manager/tpos', authenticateToken, authorizeRoles('ADMIN'), createTpoAccount);

export default router;
