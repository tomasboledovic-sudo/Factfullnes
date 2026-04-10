import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { readFileSync } from 'fs';

// Load .env in dev (Vercel injects env vars automatically in production)
try {
    const envContent = readFileSync(new URL('.env', import.meta.url), 'utf8');
    envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const idx = trimmed.indexOf('=');
            if (idx > 0) {
                const key = trimmed.substring(0, idx).trim();
                const value = trimmed.substring(idx + 1).trim();
                if (!process.env[key]) process.env[key] = value;
            }
        }
    });
} catch (e) {
    // .env not present (production / Vercel) — env vars injected by platform
}

import assessmentRoutes from './routes/assessmentRoutes.js';
import topicRoutes from './routes/topicRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import contentRoutes from './routes/contentRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { listFiles, uploadFile, deleteFile, summarizeFile } from './controllers/filesController.js';

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

app.use('/api/auth', authRoutes);
app.use('/api/topics', topicRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/sessions', assessmentRoutes);
app.use('/api/sessions', contentRoutes);

// File management routes
app.get('/api/files', listFiles);
app.post('/api/files', upload.single('file'), uploadFile);
app.delete('/api/files/:id', deleteFile);
app.post('/api/files/:id/summarize', summarizeFile);

app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Server is running', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        error: {
            code: err.code || 'INTERNAL_ERROR',
            message: err.message || 'Došlo k chybe na serveri',
            details: err.details || null
        }
    });
});

app.use((req, res) => {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint neexistuje' } });
});

// Only start HTTP server in local dev
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`🚀 Server beží na http://localhost:${PORT}`);
        console.log(`✅ Gemini API key: ${process.env.GEMINI_API_KEY ? 'Načítaný' : 'CHÝBA!'}`);
        console.log(`✅ Supabase URL: ${process.env.SUPABASE_URL ? 'Načítaná' : 'CHÝBA!'}`);
    });
}

export default app;
