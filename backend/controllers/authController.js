import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import supabase from '../services/supabaseClient.js';
import { getTopicById } from '../utils/supabaseData.js';
import { listSessionsForUser } from '../utils/sessionRepository.js';
import { listFilesMetadataForUser } from './filesController.js';
import { isAdminUser } from '../utils/adminAccess.js';

function generateToken(userId) {
    const secret = process.env.JWT_SECRET?.trim();
    if (!secret) {
        const err = new Error(
            'JWT_SECRET nie je nastavený. V backend/.env alebo .env v koreni projektu pridaj napr. JWT_SECRET=nahodny-dlhy-retazec'
        );
        err.status = 500;
        throw err;
    }
    return jwt.sign({ userId }, secret, { expiresIn: '30d' });
}

export async function register(req, res, next) {
    try {
        const { email, name, password } = req.body;
        if (!email || !name || !password) {
            return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Email, meno a heslo sú povinné' } });
        }
        if (password.length < 6) {
            return res.status(400).json({ success: false, error: { code: 'WEAK_PASSWORD', message: 'Heslo musí mať aspoň 6 znakov' } });
        }

        const { data: existing, error: existingErr } = await supabase
            .from('users')
            .select('id')
            .eq('email', email.toLowerCase())
            .maybeSingle();
        if (existingErr) throw existingErr;
        if (existing) {
            return res.status(409).json({ success: false, error: { code: 'EMAIL_EXISTS', message: 'Tento email je už zaregistrovaný' } });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const { data: newUser, error } = await supabase.from('users')
            .insert({ email: email.toLowerCase(), name: name.trim(), password_hash: passwordHash })
            .select('id, email, name, created_at').single();
        if (error) throw error;

        const token = generateToken(newUser.id);
        const payloadUser = {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            createdAt: newUser.created_at,
            isAdmin: isAdminUser(newUser)
        };
        res.status(201).json({ success: true, data: { token, user: payloadUser } });
    } catch (error) {
        next(error);
    }
}

export async function login(req, res, next) {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Email a heslo sú povinné' } });
        }

        const { data: user, error: userErr } = await supabase
            .from('users')
            .select('*')
            .eq('email', email.toLowerCase())
            .maybeSingle();
        if (userErr) throw userErr;
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Nesprávny email alebo heslo' } });
        }

        const token = generateToken(user.id);
        const payloadUser = {
            id: user.id,
            email: user.email,
            name: user.name,
            createdAt: user.created_at,
            isAdmin: isAdminUser(user)
        };
        res.json({ success: true, data: { token, user: payloadUser } });
    } catch (error) {
        next(error);
    }
}

export async function getProfile(req, res, next) {
    try {
        const { data: user, error: userError } = await supabase.from('users').select('id, email, name, created_at').eq('id', req.userId).maybeSingle();
        if (userError || !user) {
            return res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'Používateľ neexistuje' } });
        }

        const sessions = await listSessionsForUser(req.userId);
        let uploadedFiles = [];
        if (isAdminUser(user)) {
            try {
                uploadedFiles = await listFilesMetadataForUser(req.userId);
            } catch (e) {
                console.warn('[profile] Súbory sa nepodarilo načítať:', e.message);
            }
        }

        const testHistory = await Promise.all(
            (sessions || []).map(async (s) => {
                const topic = await getTopicById(s.topic_id);
                const pre = s.pre_test_score;
                const post = s.post_test_score;
                const improvement =
                    pre != null && post != null ? Math.round((post - pre) * 10) / 10 : null;
                const completed = s.completed === true;
                const continuePath = !completed
                    ? s.status === 'pre_assessment'
                        ? `/session/${s.id}/pre-test`
                        : `/session/${s.id}/learning`
                    : null;
                return {
                    sessionId: s.id,
                    topicId: s.topic_id,
                    topicTitle: topic?.title || 'Neznáma téma',
                    topicCategory: topic?.category || '',
                    sessionStatus: s.status,
                    completed,
                    createdAt: s.created_at,
                    completedAt: s.post_test_completed_at || null,
                    preTestScore: pre ?? null,
                    finalTestScore: post ?? null,
                    improvement,
                    continuePath
                };
            })
        );

        const completedOnly = testHistory.filter((t) => t.completed);
        const totalCompleted = completedOnly.length;

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    createdAt: user.created_at,
                    isAdmin: isAdminUser(user)
                },
                testHistory,
                stats: {
                    totalSessions: testHistory.length,
                    completedCount: totalCompleted
                },
                uploadedFiles,
                /** Spätná kompatibilita */
                completedTests: completedOnly.map((t) => ({
                    sessionId: t.sessionId,
                    topicId: t.topicId,
                    topicTitle: t.topicTitle,
                    topicCategory: t.topicCategory,
                    completedAt: t.completedAt || t.createdAt,
                    preTestScore: t.preTestScore ?? 0,
                    finalTestScore: t.finalTestScore ?? 0,
                    improvement: t.improvement ?? 0
                })),
                totalCompleted
            }
        });
    } catch (error) {
        next(error);
    }
}
