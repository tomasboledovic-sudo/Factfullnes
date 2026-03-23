import { readData } from '../utils/paths.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import supabase from '../services/supabaseClient.js';


function generateToken(userId) {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

/**
 * POST /api/auth/register
 */
export async function register(req, res, next) {
    try {
        const { email, name, password } = req.body;

        if (!email || !name || !password) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_INPUT', message: 'Email, meno a heslo sú povinné' }
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error: { code: 'WEAK_PASSWORD', message: 'Heslo musí mať aspoň 6 znakov' }
            });
        }

        const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('email', email.toLowerCase())
            .maybeSingle();

        if (existing) {
            return res.status(409).json({
                success: false,
                error: { code: 'EMAIL_EXISTS', message: 'Tento email je už zaregistrovaný' }
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const { data: newUser, error } = await supabase
            .from('users')
            .insert({ email: email.toLowerCase(), name: name.trim(), password_hash: passwordHash })
            .select('id, email, name, created_at')
            .single();

        if (error) throw error;

        const token = generateToken(newUser.id);
        console.log(`✅ Nový používateľ zaregistrovaný: ${email}`);

        res.status(201).json({
            success: true,
            data: { token, user: { id: newUser.id, email: newUser.email, name: newUser.name, createdAt: newUser.created_at } }
        });
    } catch (error) {
        next(error);
    }
}

/**
 * POST /api/auth/login
 */
export async function login(req, res, next) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_INPUT', message: 'Email a heslo sú povinné' }
            });
        }

        const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('email', email.toLowerCase())
            .maybeSingle();

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({
                success: false,
                error: { code: 'INVALID_CREDENTIALS', message: 'Nesprávny email alebo heslo' }
            });
        }

        const token = generateToken(user.id);
        console.log(`✅ Prihlásenie: ${email}`);

        res.json({
            success: true,
            data: { token, user: { id: user.id, email: user.email, name: user.name, createdAt: user.created_at } }
        });
    } catch (error) {
        next(error);
    }
}

/**
 * GET /api/auth/profile
 */
export async function getProfile(req, res, next) {
    try {
        const userId = req.userId;

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, email, name, created_at')
            .eq('id', userId)
            .maybeSingle();

        if (userError || !user) {
            return res.status(404).json({
                success: false,
                error: { code: 'USER_NOT_FOUND', message: 'Používateľ neexistuje' }
            });
        }

        const { data: sessions } = await supabase
            .from('sessions')
            .select('id, topic_id, pre_test_score, post_test_score, post_test_completed_at, created_at')
            .eq('user_id', userId)
            .eq('completed', true)
            .order('post_test_completed_at', { ascending: false });

        const topics = readData('topics.json');

        const completedTests = (sessions || []).map(s => {
            const topic = topics.find(t => t.id === s.topic_id);
            const preScore = s.pre_test_score || 0;
            const postScore = s.post_test_score || 0;
            return {
                sessionId: s.id,
                topicId: s.topic_id,
                topicTitle: topic?.title || 'Neznáma téma',
                topicCategory: topic?.category || '',
                completedAt: s.post_test_completed_at || s.created_at,
                preTestScore: preScore,
                finalTestScore: postScore,
                improvement: postScore - preScore
            };
        });

        res.json({
            success: true,
            data: {
                user: { id: user.id, email: user.email, name: user.name, createdAt: user.created_at },
                completedTests,
                totalCompleted: completedTests.length
            }
        });
    } catch (error) {
        next(error);
    }
}
