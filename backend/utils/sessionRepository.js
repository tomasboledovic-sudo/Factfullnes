import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import supabase from '../services/supabaseClient.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSIONS_FILE = join(__dirname, '../data/sessions.json');

/** @type {'supabase' | 'local' | null} */
let sessionsBackendMode = null;

/** @type {Map<string, object>} */
let memorySessions = new Map();

function isMissingTable(error, tableName) {
    if (!error) return false;
    const msg = String(error.message || '');
    if (error.code === 'PGRST205' && msg.includes(tableName)) return true;
    return msg.includes('Could not find the table') && msg.includes(tableName);
}

function defaultSessionRow(id, topicId, userId) {
    const now = new Date().toISOString();
    return {
        id,
        user_id: userId ?? null,
        topic_id: topicId,
        status: 'pre_assessment',
        pre_test_answers: null,
        pre_test_score: null,
        generated_content: null,
        content_generated_at: null,
        post_test_answers: null,
        post_test_score: null,
        post_test_completed_at: null,
        post_test_time_seconds: null,
        completed: false,
        test_generation_started_at: null,
        test_generated_at: null,
        created_at: now
    };
}

function loadLocalSessionsFromDisk() {
    if (!existsSync(SESSIONS_FILE)) {
        memorySessions = new Map();
        return;
    }
    try {
        const raw = readFileSync(SESSIONS_FILE, 'utf8').trim();
        if (!raw) {
            memorySessions = new Map();
            return;
        }
        const arr = JSON.parse(raw);
        memorySessions = new Map((Array.isArray(arr) ? arr : []).map(s => [s.id, s]));
    } catch {
        memorySessions = new Map();
    }
}

function persistLocalSessions() {
    writeFileSync(SESSIONS_FILE, JSON.stringify([...memorySessions.values()], null, 2), 'utf8');
}

function switchToLocal(reason) {
    if (sessionsBackendMode !== 'local') {
        console.warn(`[sessions] ${reason}`);
    }
    sessionsBackendMode = 'local';
    loadLocalSessionsFromDisk();
}

export async function ensureSessionsBackend() {
    if (sessionsBackendMode !== null) return;
    const { error } = await supabase.from('sessions').select('id').limit(1);
    if (error && isMissingTable(error, 'sessions')) {
        switchToLocal('Tabuľka sessions v Supabase chýba — používam data/sessions.json');
    } else {
        sessionsBackendMode = 'supabase';
    }
}

/**
 * @returns {Promise<{ id: string, topic_id: number, status: string, created_at: string } & object>}
 */
export async function insertSession({ topicId, userId }) {
    await ensureSessionsBackend();
    if (sessionsBackendMode === 'local') {
        const id = randomUUID();
        const row = defaultSessionRow(id, topicId, userId);
        memorySessions.set(id, row);
        persistLocalSessions();
        return {
            id: row.id,
            topic_id: row.topic_id,
            status: row.status,
            created_at: row.created_at
        };
    }
    const { data, error } = await supabase
        .from('sessions')
        .insert({ topic_id: topicId, user_id: userId || null, status: 'pre_assessment' })
        .select('id, topic_id, status, created_at')
        .single();
    if (error && isMissingTable(error, 'sessions')) {
        switchToLocal('Tabuľka sessions v Supabase chýba — používam data/sessions.json');
        return insertSession({ topicId, userId });
    }
    if (error) throw error;
    return data;
}

export async function getSessionById(sessionId) {
    await ensureSessionsBackend();
    if (sessionsBackendMode === 'local') {
        return memorySessions.get(sessionId) ?? null;
    }
    const { data, error } = await supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle();
    if (error && isMissingTable(error, 'sessions')) {
        switchToLocal('Tabuľka sessions v Supabase chýba — používam data/sessions.json');
        return memorySessions.get(sessionId) ?? null;
    }
    if (error) throw error;
    return data ?? null;
}

export async function patchSession(sessionId, fields) {
    await ensureSessionsBackend();
    if (sessionsBackendMode === 'local') {
        const s = memorySessions.get(sessionId);
        if (!s) {
            const err = new Error('Session s daným ID neexistuje');
            err.status = 404;
            throw err;
        }
        Object.assign(s, fields);
        memorySessions.set(sessionId, s);
        persistLocalSessions();
        return;
    }
    const { error } = await supabase.from('sessions').update(fields).eq('id', sessionId);
    if (error && isMissingTable(error, 'sessions')) {
        switchToLocal('Tabuľka sessions v Supabase chýba — používam data/sessions.json');
        return patchSession(sessionId, fields);
    }
    if (error) throw error;
}

/**
 * Dokončené relácie používateľa (profil).
 * @param {string} userId
 */
export async function listCompletedSessionsForUser(userId) {
    const all = await listSessionsForUser(userId);
    return all.filter((s) => s.completed === true);
}

/**
 * Všetky relácie používateľa (história vrátane nedokončených).
 * @param {string} userId
 */
export async function listSessionsForUser(userId) {
    await ensureSessionsBackend();
    if (sessionsBackendMode === 'local') {
        const uid = String(userId);
        return [...memorySessions.values()]
            .filter((s) => s.user_id != null && String(s.user_id) === uid)
            .sort((a, b) => {
                const ta = new Date(a.created_at || 0).getTime();
                const tb = new Date(b.created_at || 0).getTime();
                return tb - ta;
            })
            .map((s) => ({
                id: s.id,
                topic_id: s.topic_id,
                status: s.status,
                completed: !!s.completed,
                pre_test_score: s.pre_test_score,
                post_test_score: s.post_test_score,
                post_test_completed_at: s.post_test_completed_at,
                created_at: s.created_at
            }));
    }
    const { data, error } = await supabase
        .from('sessions')
        .select(
            'id, topic_id, status, completed, pre_test_score, post_test_score, post_test_completed_at, created_at'
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    if (error && isMissingTable(error, 'sessions')) {
        switchToLocal('Tabuľka sessions v Supabase chýba — používam data/sessions.json');
        return listSessionsForUser(userId);
    }
    if (error) throw error;
    return data || [];
}
