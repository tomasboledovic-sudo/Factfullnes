import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * @param {string} filePath
 * @param {boolean} override Ak true, hodnoty zo súboru vždy prepíšu process.env (rieši staré SUPABASE_* z shellu)
 */
function loadEnvFromPath(filePath, override = false) {
    try {
        const envContent = readFileSync(filePath, 'utf8');
        envContent.split('\n').forEach((line) => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const idx = trimmed.indexOf('=');
                if (idx > 0) {
                    const key = trimmed.substring(0, idx).trim();
                    const value = trimmed.substring(idx + 1).trim();
                    if (override) {
                        process.env[key] = value;
                    } else if (!process.env[key]) {
                        process.env[key] = value;
                    }
                }
            }
        });
        return true;
    } catch {
        return false;
    }
}

// Koreň .env (VITE_*, USE_LOCAL_TOPIC_DATA, …), potom backend/.env s prednosťou — vždy platí konfigurácia backendu
loadEnvFromPath(join(__dirname, '..', '.env'), false);
loadEnvFromPath(join(__dirname, '.env'), true);

import assessmentRoutes from './routes/assessmentRoutes.js';
import topicRoutes from './routes/topicRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import contentRoutes from './routes/contentRoutes.js';
import authRoutes from './routes/authRoutes.js';
import {
    listFiles,
    uploadFile,
    deleteFile,
    summarizeFile,
    generateFileQuiz,
    getFileQuiz,
    submitFileQuiz
} from './controllers/filesController.js';
import { requireAuth } from './middleware/auth.js';
import { getGeminiModelId } from './services/geminiService.js';

const app = express();
const PORT = process.env.PORT || 3001;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

/** Lokál + URL(y) frontendu na Vercel (premenná FRONTEND_URL v Project Settings). */
const LOCAL_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

function getAllowedOrigins() {
    const extra = (process.env.FRONTEND_URL || '')
        .split(',')
        .map((s) => s.trim().replace(/\/+$/, ''))
        .filter(Boolean);
    return [...LOCAL_ORIGINS, ...extra];
}

function isOriginAllowed(origin) {
    if (!origin) return true;
    return getAllowedOrigins().includes(origin);
}

app.use(
    cors({
        origin(origin, cb) {
            if (isOriginAllowed(origin)) return cb(null, true);
            cb(null, false);
        },
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    })
);
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

// File management routes (iba prihlásený používateľ — vlastné súbory)
app.get('/api/files', requireAuth, listFiles);
app.post('/api/files', requireAuth, upload.single('file'), uploadFile);
app.delete('/api/files/:id', requireAuth, deleteFile);
app.post('/api/files/:id/summarize', requireAuth, summarizeFile);
app.post('/api/files/:id/quiz/generate', requireAuth, generateFileQuiz);
app.get('/api/files/:id/quiz', requireAuth, getFileQuiz);
app.post('/api/files/:id/quiz/submit', requireAuth, submitFileQuiz);

app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Server is running', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Backend API — cesty majú prefix /api. Ak voláš len doménu bez /api, dostaneš 404.',
        examples: { health: '/api/health', topics: '/api/topics' }
    });
});

/**
 * Krátka, bezpečná správa pre klienta (dlhé / omylom vložené texty z .env neposielame celé).
 */
function publicErrorMessage(err) {
    const raw = String(err?.message ?? '').trim();
    if (!raw) return 'Došlo k chybe na serveri';
    if (raw.length > 380) {
        return 'Došlo k chybe na serveri. Podrobnosti nájdeš v logu servera (konzola / Vercel).';
    }
    return raw;
}

app.use((err, req, res, next) => {
    console.error('Error:', err);
    const origin = req.headers.origin;
    if (origin && isOriginAllowed(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    const status = err.status || 500;
    const details =
        status < 500 && err.details != null && String(err.message ?? '').length <= 380 ? err.details : null;
    res.status(status).json({
        success: false,
        error: {
            code: err.code || 'INTERNAL_ERROR',
            message: publicErrorMessage(err),
            details
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
        console.log(`✅ Gemini model: ${getGeminiModelId()} (prepíš cez GEMINI_MODEL v .env ak API vracia 404)`);
        try {
            const u = process.env.SUPABASE_URL;
            console.log(
                `✅ Supabase: ${u ? new URL(u).host : 'CHÝBA SUPABASE_URL — skontroluj backend/.env'}`
            );
        } catch {
            console.log('✅ Supabase URL: (neplatná)');
        }
        const localTopics =
            process.env.USE_LOCAL_TOPIC_DATA === '1' ||
            String(process.env.USE_LOCAL_TOPIC_DATA || '').toLowerCase() === 'true';
        if (localTopics) {
            console.log('[topics] Lokálne JSON (USE_LOCAL_TOPIC_DATA=true)');
        }
    });
}

export default app;
