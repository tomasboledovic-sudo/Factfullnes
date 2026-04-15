import express from 'express';
import { 
    getPreTest, 
    submitPreTest, 
    submitPostTest, 
    getContentStatus,
    getTestStatus,
    startTestGeneration,
    regenerateLearning
} from '../controllers/assessmentController.js';

const router = express.Router();

// Vstupný test
router.get('/:sessionId/pre-test', getPreTest);
router.post('/:sessionId/pre-test/submit', submitPreTest);

// Znovu vygenerovať učebné materiály (AI)
router.post('/:sessionId/regenerate-content', regenerateLearning);

// Status generovania
router.get('/:sessionId/content/status', getContentStatus);
router.get('/:sessionId/test/status', getTestStatus);

// Spustenie generovania záverečného testu
router.post('/:sessionId/generate-test', startTestGeneration);

// Záverečný test
router.post('/:sessionId/post-test/submit', submitPostTest);

export default router;
