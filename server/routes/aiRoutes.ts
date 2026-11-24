import { Router } from 'express';
import multer from 'multer';
import {
  chatStream,
  getKnowledgeBase,
  getKnowledgeDocContent,
  ingestTextKnowledge,
  reindexKnowledge,
  removeKnowledgeDocument,
  uploadKnowledgeFile,
} from '../controllers/aiController.ts';
import { optionalAuth, requireAuth, requireRole } from '../middleware/authMiddleware.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
  },
  fileFilter: (_req, file, cb) => {
    const lower = file.originalname.toLowerCase();
    const allowed =
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'text/plain' ||
      file.mimetype === 'text/markdown' ||
      lower.endsWith('.pdf') ||
      lower.endsWith('.md') ||
      lower.endsWith('.txt');
    if (allowed) {
      cb(null, true);
    } else {
      cb(new Error('Only .pdf, .md, and .txt files are supported.'));
    }
  },
});

// Public / Authenticated streaming AI Concierge SSE endpoint
router.post('/chat', optionalAuth, asyncHandler(chatStream));

// Admin Knowledge Base Manager endpoints
router.get('/knowledge', requireAuth, requireRole('admin'), asyncHandler(getKnowledgeBase));
router.get(
  '/knowledge/content',
  requireAuth,
  requireRole('admin'),
  asyncHandler(getKnowledgeDocContent)
);
router.post(
  '/knowledge/text',
  requireAuth,
  requireRole('admin'),
  asyncHandler(ingestTextKnowledge)
);
router.post(
  '/knowledge/upload',
  requireAuth,
  requireRole('admin'),
  upload.single('file'),
  asyncHandler(uploadKnowledgeFile)
);
router.post(
  '/knowledge/reindex',
  requireAuth,
  requireRole('admin'),
  asyncHandler(reindexKnowledge)
);
router.delete(
  '/knowledge',
  requireAuth,
  requireRole('admin'),
  asyncHandler(removeKnowledgeDocument)
);

export default router;
